#!/usr/bin/env node

/**
 * 博客访问模拟脚本 v4.0 (多线程版)
 * 
 * 功能：
 * - 使用Puppeteer自动化Chrome浏览器
 * - 多线程并发访问，提升效率
 * - 从归档页面抓取所有文章链接
 * - 对每篇文章模拟 300-500 次访问
 * - 随机访问间隔，模拟真实用户行为
 * - 连续3次失败自动跳过
 * 
 * 安装依赖：
 * npm install puppeteer
 * 
 * 使用方法：
 * node tools/simulate_visits.js
 * 
 * 参数：
 * --url 网站地址（默认：https://lengain.github.io）
 * --min-visits 每篇文章最小访问次数（默认：300）
 * --max-visits 每篇文章最大访问次数（默认：500）
 * --delay 每次访问间隔毫秒（默认：1000）
 * --concurrency 并发浏览器数（默认：3）
 * 
 * 示例：
 * node tools/simulate_visits.js --url https://lengain.github.io --min-visits 300 --max-visits 500 --concurrency 5
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  siteUrl: 'https://lengain.github.io',
  minVisits: 300,
  maxVisits: 500,
  delay: 500,
  timeout: 30000,
  headless: 'new',
  retries: 3,
  concurrency: 3, // 并发浏览器数
  verbose: true
};

let logFileStream = null;
let logFilePath = null;
let taskQueue = [];
let activeWorkers = 0;
let completedTasks = 0;
let totalTasks = 0;

function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      CONFIG.siteUrl = args[i + 1];
      i++;
    } else if (args[i] === '--min-visits' && args[i + 1]) {
      CONFIG.minVisits = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--max-visits' && args[i + 1]) {
      CONFIG.maxVisits = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      CONFIG.delay = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      CONFIG.concurrency = parseInt(args[i + 1]);
      i++;
    }
  }
  
  if (CONFIG.minVisits < 1) {
    console.error('❌ min-visits 必须大于 0');
    process.exit(1);
  }
  if (CONFIG.maxVisits < CONFIG.minVisits) {
    console.error('❌ max-visits 必须大于或等于 min-visits');
    process.exit(1);
  }
  if (CONFIG.concurrency < 1 || CONFIG.concurrency > 10) {
    console.error('❌ concurrency 必须在 1-10 之间');
    process.exit(1);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (CONFIG.verbose) {
    console.log(logMessage);
  }
  
  if (logFileStream) {
    logFileStream.write(logMessage + '\n');
  }
}

async function extractArticleLinks(page, baseUrl) {
  log('正在从归档页面提取文章链接...', 'INFO');
  
  const archiveUrl = `${baseUrl}/archives/`;
  await page.goto(archiveUrl, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
  log(`已加载归档页面: ${archiveUrl}`, 'DEBUG');
  
  const articles = await page.evaluate(() => {
    const links = [];
    
    // 方法1: 查找归档页面的文章链接
    const archiveLinks = document.querySelectorAll('.archive-list .archive-list-item a');
    archiveLinks.forEach(el => {
      const href = el.getAttribute('href');
      const title = el.textContent?.trim();
      
      if (href && title && title.length > 0) {
        links.push({ href, title, source: 'archive' });
      }
    });
    
    // 方法2: 查找所有包含日期格式的文章链接
    const allLinks = document.querySelectorAll('a[href]');
    allLinks.forEach(el => {
      const href = el.getAttribute('href');
      const title = el.textContent?.trim();
      
      if (href && 
          title && 
          href.match(/^\/\d{4}\/\d{2}\/\d{2}\//) &&
          title.length > 2 && 
          title.length < 200) {
        links.push({ href, title, source: 'date-pattern' });
      }
    });
    
    return links;
  });
  
  log(`原始提取到 ${articles.length} 个链接`, 'DEBUG');
  
  const uniqueLinks = new Map();
  
  articles.forEach(article => {
    let url = article.href;
    if (url.startsWith('/')) {
      url = new URL(url, baseUrl).href;
    }
    
    const isExcluded = 
      url.includes('/tags/') || 
      url.includes('/categories/') ||
      url.includes('/#') ||
      url.includes('/about') ||
      url.includes('/search');
    
    if (isExcluded) return;
    
    if (url.startsWith(baseUrl)) {
      uniqueLinks.set(url, {
        url,
        title: article.title,
        source: article.source
      });
    }
  });
  
  const result = Array.from(uniqueLinks.entries()).map(([url, data]) => data);
  log(`✅ 成功找到 ${result.length} 篇文章`, 'INFO');
  
  return result;
}

async function visitPageWithRetry(page, url, visitCount, articleTitle, articleIndex, totalCount) {
  log(`📖 [${articleIndex}/${totalCount}] 开始访问: ${articleTitle}`, 'INFO');
  log(`   URL: ${url}`, 'DEBUG');
  log(`   计划访问次数: ${visitCount}`, 'DEBUG');
  
  let successCount = 0;
  let failCount = 0;
  let consecutiveFailures = 0;
  let shouldSkip = false;
  const startTime = Date.now();
  
  for (let i = 1; i <= visitCount; i++) {
    if (consecutiveFailures >= 3) {
      log(`   ⚠️  连续3次访问失败，跳过剩余 ${visitCount - i + 1} 次访问`, 'WARN');
      shouldSkip = true;
      break;
    }
    
    let retryCount = 0;
    let success = false;
    
    while (retryCount < CONFIG.retries && !success) {
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: CONFIG.timeout 
        });
        
        await delay(randomInt(200, 800));
        
        success = true;
        successCount++;
        consecutiveFailures = 0;
        
        if (i % 20 === 0 || i === 1 || i === visitCount) {
          const progress = Math.round((i / visitCount) * 100);
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          log(`   进度: ${i}/${visitCount} (${progress}%) | 成功: ${successCount} | 失败: ${failCount}`, 'INFO');
        }
        
      } catch (error) {
        retryCount++;
        failCount++;
        consecutiveFailures++;
        
        if (retryCount < CONFIG.retries) {
          await delay(500);
        } else {
          log(`   ❌ 访问失败 (连续失败: ${consecutiveFailures})`, 'DEBUG');
        }
      }
    }
    
    await delay(CONFIG.delay);
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const successRate = ((successCount / visitCount) * 100).toFixed(2);
  
  if (shouldSkip) {
    log(`⏭️  文章访问被跳过 | 成功: ${successCount}/${visitCount} | 成功率: ${successRate}%`, 'WARN');
  } else {
    log(`✅ 文章访问完成 | 成功: ${successCount}/${visitCount} | 成功率: ${successRate}% | 耗时: ${totalTime}s`, 'INFO');
  }
  
  return { successCount, failCount, totalTime, skipped: shouldSkip };
}

async function worker(workerId) {
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(CONFIG.timeout);
  
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
  
  const results = [];
  
  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    
    try {
      const result = await visitPageWithRetry(
        page, 
        task.url, 
        task.visitCount, 
        task.title, 
        task.index, 
        totalTasks
      );
      
      results.push({
        index: task.index,
        title: task.title,
        url: task.url,
        plannedVisits: task.visitCount,
        successCount: result.successCount,
        failCount: result.failCount,
        totalTime: result.totalTime,
        successRate: ((result.successCount / task.visitCount) * 100).toFixed(2),
        skipped: result.skipped,
        workerId
      });
      
      completedTasks++;
      const overallProgress = Math.round((completedTasks / totalTasks) * 100);
      log(`📊 总进度: ${completedTasks}/${totalTasks} (${overallProgress}%) | Worker ${workerId} 完成: ${task.title}`, 'INFO');
      
    } catch (error) {
      log(`❌ Worker ${workerId} 处理任务失败: ${error.message}`, 'ERROR');
      results.push({
        index: task.index,
        title: task.title,
        url: task.url,
        plannedVisits: task.visitCount,
        successCount: 0,
        failCount: task.visitCount,
        totalTime: 0,
        successRate: '0.00',
        skipped: true,
        workerId,
        error: error.message
      });
      completedTasks++;
    }
    
    await delay(randomInt(500, 1500));
  }
  
  await browser.close();
  log(`🔚 Worker ${workerId} 完成所有任务，共处理 ${results.length} 篇文章`, 'INFO');
  
  return results;
}

async function main() {
  const scriptStartTime = Date.now();
  
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🤖 博客访问模拟工具 v4.0 (多线程版)');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
  
  parseArgs();
  
  logFilePath = path.join(__dirname, '../data', `visit_log_${Date.now()}.log`);
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  
  log('═════════════════════════════════════════════════════════════════', 'INFO');
  log('博客访问模拟工具启动 (多线程模式)', 'INFO');
  log('═════════════════════════════════════════════════════════════════', 'INFO');
  log(`配置信息:`, 'INFO');
  log(`  网站地址: ${CONFIG.siteUrl}`, 'INFO');
  log(`  访问次数范围: ${CONFIG.minVisits} - ${CONFIG.maxVisits} 次/文章`, 'INFO');
  log(`  访问间隔: ${CONFIG.delay}ms`, 'INFO');
  log(`  超时时间: ${CONFIG.timeout}ms`, 'INFO');
  log(`  失败重试: ${CONFIG.retries} 次`, 'INFO');
  log(`  并发浏览器数: ${CONFIG.concurrency}`, 'INFO');
  log(`  详细日志: ${CONFIG.verbose}`, 'INFO');
  log(`  日志文件: ${logFilePath}`, 'INFO');
  log('', 'INFO');
  
  let browser;
  let articleResults = [];
  
  try {
    log('正在启动主浏览器...', 'INFO');
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    log('主浏览器启动成功', 'INFO');
    
    const mainPage = await browser.newPage();
    mainPage.setDefaultNavigationTimeout(CONFIG.timeout);
    
    const articles = await extractArticleLinks(mainPage, CONFIG.siteUrl);
    await browser.close();
    
    if (articles.length === 0) {
      log('❌ 未找到文章链接，脚本退出', 'ERROR');
      logFileStream.end();
      process.exit(1);
    }
    
    log('', 'INFO');
    log('📝 文章列表：', 'INFO');
    articles.forEach((article, index) => {
      log(`  ${index + 1}. ${article.title}`, 'INFO');
      log(`     URL: ${article.url}`, 'DEBUG');
    });
    log(`总共找到 ${articles.length} 篇文章`, 'INFO');
    log('', 'INFO');
    
    // 准备任务队列
    totalTasks = articles.length;
    articles.forEach((article, index) => {
      taskQueue.push({
        index: index + 1,
        title: article.title,
        url: article.url,
        visitCount: randomInt(CONFIG.minVisits, CONFIG.maxVisits)
      });
    });
    
    log(`🚀 开始多线程并发访问 (并发数: ${CONFIG.concurrency})...`, 'INFO');
    log('═════════════════════════════════════════════════════════════════', 'INFO');
    log('', 'INFO');
    
    const visitStartTime = Date.now();
    
    // 启动并发 workers
    const workers = [];
    for (let i = 0; i < CONFIG.concurrency; i++) {
      workers.push(worker(i + 1));
    }
    
    // 等待所有 workers 完成
    const workerResults = await Promise.all(workers);
    
    // 合并结果
    workerResults.forEach(results => {
      articleResults.push(...results);
    });
    
    // 按索引排序
    articleResults.sort((a, b) => a.index - b.index);
    
    const elapsed = Math.round((Date.now() - visitStartTime) / 1000);
    const totalElapsed = Math.round((Date.now() - scriptStartTime) / 1000);
    
    const totalVisits = articleResults.reduce((sum, r) => sum + r.plannedVisits, 0);
    const totalSuccess = articleResults.reduce((sum, r) => sum + r.successCount, 0);
    const totalFailed = articleResults.reduce((sum, r) => sum + r.failCount, 0);
    
    log('', 'INFO');
    log('═════════════════════════════════════════════════════════════════', 'INFO');
    log('✅ 访问模拟完成！', 'INFO');
    log('═════════════════════════════════════════════════════════════════', 'INFO');
    log('', 'INFO');
    log('📊 统计信息：', 'INFO');
    log(`  文章总数: ${articles.length}`, 'INFO');
    log(`  总访问次数: ${totalVisits}`, 'INFO');
    log(`  成功次数: ${totalSuccess}`, 'INFO');
    log(`  失败次数: ${totalFailed}`, 'INFO');
    log(`  整体成功率: ${((totalSuccess / totalVisits) * 100).toFixed(2)}%`, 'INFO');
    log(`  访问阶段耗时: ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒`, 'INFO');
    log(`  总运行耗时: ${Math.floor(totalElapsed / 60)} 分 ${totalElapsed % 60} 秒`, 'INFO');
    log(`  平均每秒访问: ${(totalVisits / elapsed).toFixed(2)} 次`, 'INFO');
    log(`  加速比: ~${CONFIG.concurrency}x`, 'INFO');
    log('', 'INFO');
    
    log('📋 详细结果：', 'INFO');
    articleResults.forEach((result, index) => {
      const status = result.skipped ? '⏭️ 跳过' : '✅ 完成';
      log(`  ${status} ${index + 1}. ${result.title} [Worker ${result.workerId}]`, 'INFO');
      log(`     计划: ${result.plannedVisits} | 成功: ${result.successCount} | 失败: ${result.failCount} | 成功率: ${result.successRate}% | 耗时: ${result.totalTime}s`, 'INFO');
    });
    log('', 'INFO');
    
    const jsonData = {
      timestamp: new Date().toISOString(),
      siteUrl: CONFIG.siteUrl,
      config: CONFIG,
      articles: articleResults,
      summary: {
        totalArticles: articles.length,
        totalVisits,
        totalSuccess,
        totalFailed,
        successRate: ((totalSuccess / totalVisits) * 100).toFixed(2),
        visitElapsedSeconds: elapsed,
        totalElapsedSeconds: totalElapsed,
        avgVisitsPerSecond: (totalVisits / elapsed).toFixed(2),
        concurrency: CONFIG.concurrency
      }
    };
    
    const jsonFile = logFilePath.replace('.log', '.json');
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
    log(`💾 JSON日志已保存: ${jsonFile}`, 'INFO');
    
    logFileStream.end();
    
  } catch (error) {
    log('', 'ERROR');
    log('❌ 发生错误:', 'ERROR');
    log(`错误类型: ${error.name}`, 'ERROR');
    log(`错误信息: ${error.message}`, 'ERROR');
    log(`错误堆栈: ${error.stack}`, 'ERROR');
    
    if (logFileStream) {
      logFileStream.end();
    }
    process.exit(1);
  }
  
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('脚本执行完成！');
  console.log(`日志文件: ${logFilePath}`);
  console.log(`并发数: ${CONFIG.concurrency}x`);
  console.log('═════════════════════════════════════════════════════════════════');
}

try {
  require.resolve('puppeteer');
  main().catch(console.error);
} catch (e) {
  console.log('❌ 未安装puppeteer依赖');
  console.log('');
  console.log('📦 请先安装：');
  console.log('   npm install puppeteer');
  console.log('');
  console.log('💡 如果安装失败，可以尝试使用 chromium 版本：');
  console.log('   npm install puppeteer-core');
  console.log('');
  console.log('⚠️  puppeteer 安装时可能需要较长时间，因为它会下载 Chromium 浏览器');
  console.log('');
  process.exit(1);
}
