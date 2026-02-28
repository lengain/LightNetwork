#!/usr/bin/env node

/**
 * 不蒜子数据提取脚本 - Puppeteer版本（高级）
 * 
 * 功能：
 * 使用puppeteer自动化浏览器访问网站，
 * 等待不蒜子加载完成，然后直接提取BUSUANZI对象中的数据
 * 
 * 安装依赖：
 * npm install puppeteer
 * 
 * 使用方法：
 * node scripts/export_busuanzi_puppeteer.js --url https://lengain.github.io
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const EXPORT_FILE = path.join(DATA_DIR, 'busuanzi_stats_full.json');

/**
 * 检查puppeteer是否已安装
 */
function checkPuppeteer() {
  try {
    require.resolve('puppeteer');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🔍 不蒜子数据提取工具 - Puppeteer版本');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
  
  // 检查依赖
  if (!checkPuppeteer()) {
    console.log('❌ 未安装puppeteer依赖');
    console.log('');
    console.log('📦 请先安装：');
    console.log('   npm install puppeteer');
    console.log('');
    console.log('💡 或者，如果只想要基础功能，使用：');
    console.log('   npm run export:busuanzi');
    console.log('');
    process.exit(1);
  }
  
  try {
    const puppeteer = require('puppeteer');
    
    console.log('📱 启动浏览器...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 设置超时
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);
    
    const siteUrl = process.argv[3] || 'https://lengain.github.io';
    console.log(`🌐 访问网站: ${siteUrl}`);
    
    // 访问网站
    await page.goto(siteUrl, { waitUntil: 'networkidle2' });
    
    console.log('⏳ 等待不蒜子加载...');
    
    // 等待BUSUANZI对象加载
    const stats = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 40; // 20秒
        
        const checkInterval = setInterval(() => {
          attempts++;
          
          if (typeof BUSUANZI !== 'undefined' && BUSUANZI.site_pv) {
            clearInterval(checkInterval);
            resolve({
              timestamp: new Date().toISOString(),
              site_pv: BUSUANZI.site_pv,
              site_uv: BUSUANZI.site_uv,
              page_pv: BUSUANZI.page_pv,
              page_url: window.location.pathname,
              page_title: document.title,
              status: 'success'
            });
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve({
              timestamp: new Date().toISOString(),
              status: 'timeout',
              error: '等待不蒜子加载超时'
            });
          }
        }, 500);
      });
    });
    
    console.log('✅ 成功获取数据！');
    console.log('');
    
    if (stats.status === 'success') {
      console.table({
        '网站总浏览数 (PV)': stats.site_pv,
        '网站总访客数 (UV)': stats.site_uv,
        '当前页面浏览数': stats.page_pv,
        '访问页面': stats.page_url,
        '页面标题': stats.page_title,
        '获取时间': stats.timestamp
      });
      
      // 保存数据
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      let existing = [];
      if (fs.existsSync(EXPORT_FILE)) {
        try {
          const data = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
          existing = data.exports || [];
        } catch (e) {
          console.log('⚠️  现有数据格式错误');
        }
      }
      
      existing.push(stats);
      if (existing.length > 30) {
        existing = existing.slice(-30);
      }
      
      const exportData = {
        last_export: stats.timestamp,
        total_records: existing.length,
        site_url: siteUrl,
        note: '使用Puppeteer直接从网站提取的实时数据',
        exports: existing
      };
      
      fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportData, null, 2), 'utf8');
      console.log('');
      console.log('💾 数据已保存到:', EXPORT_FILE);
      
    } else {
      console.log('❌ 无法获取数据:', stats.error);
    }
    
    await browser.close();
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
  
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
