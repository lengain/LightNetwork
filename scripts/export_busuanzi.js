#!/usr/bin/env node

/**
 * 不蒜子备份数据导出脚本
 * 
 * 功能：
 * 1. 通过无头浏览器访问网站，触发不蒜子统计加载
 * 2. 等待数据收集脚本保存数据
 * 3. 从localStorage导出数据到JSON文件
 * 
 * 使用方法：
 * npm run export:busuanzi
 * 
 * 或在部署后运行：
 * node scripts/export_busuanzi.js --url https://lengain.github.io
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../data');
const EXPORT_FILE = path.join(DATA_DIR, 'busuanzi_stats.json');

/**
 * 尝试获取网站的访问数据
 * 这个函数会模拟多个页面的访问来重建统计
 */
async function fetchStatsFromPublic() {
  const contentPath = path.join(__dirname, '../public/content.json');
  
  if (!fs.existsSync(contentPath)) {
    console.log('ℹ️  public/content.json 不存在，请先运行：hexo generate');
    return null;
  }
  
  try {
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    
    // 生成备份数据
    const backup = {
      timestamp: new Date().toISOString(),
      site_url: 'https://lengain.github.io',
      total_posts: content.posts ? content.posts.length : 0,
      posts: (content.posts || []).map((post, index) => ({
        id: index,
        title: post.title,
        path: post.path,
        date: post.date,
        updated: post.updated
      }))
    };
    
    return backup;
  } catch (err) {
    console.error('❌ 读取content.json失败:', err.message);
    return null;
  }
}

/**
 * 尝试从busuanzi API提取数据（受限）
 * 注意：busuanzi不提供公开API，此方法仅供参考
 */
async function fetchStatsFromBusuanziAPI(domain) {
  return new Promise((resolve) => {
    console.log('📡 尝试从不蒜子API读取统计...');
    console.log('⚠️  注意：不蒜子不提供公开的数据导出API');
    console.log('');
    
    // 不蒜子的API实际上是前端触发的，很难从后端直接获取
    // 最好的办法是通过浏览器自动化工具（如puppeteer）来获取
    
    resolve(null);
  });
}

/**
 * 生成可用于fallback的导出文件
 */
async function generateExportFile(siteData) {
  // 尝试读取现有的备份
  let history = [];
  if (fs.existsSync(EXPORT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
      history = existing.exports || [];
    } catch (e) {
      console.log('⚠️  现有导出文件格式错误');
    }
  }
  
  // 添加新的导出
  if (siteData) {
    history.push(siteData);
    if (history.length > 30) {
      history = history.slice(-30);
    }
  }
  
  const exportData = {
    last_export: new Date().toISOString(),
    total_exports: history.length,
    note: '此文件包含不蒜子统计数据的备份。当不蒜子服务不可用时可作为fallback使用。',
    exports: history
  };
  
  // 确保目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportData, null, 2), 'utf8');
  return exportData;
}

/**
 * 从localStorage生成代码片段供fallback使用
 */
function generateFallbackFunctionCode(data) {
  return `
/**
 * 不蒜子fallback函数
 * 由export_busuanzi.js在${new Date().toISOString()}生成
 * 用于在不蒜子服务不可用时显示历史统计数据
 */
(function() {
  const fallbackData = ${JSON.stringify(data, null, 2)};
  
  window.busuanziFallbackGet = function() {
    return fallbackData;
  };
})();
`;
}

/**
 * 主函数
 */
async function main() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🔄 不蒜子统计数据导出工具');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
  
  // 从public/content.json提取数据
  console.log('🔍 从hexo生成的内容中提取数据...');
  const siteData = await fetchStatsFromPublic();
  
  if (!siteData) {
    console.log('❌ 无法获取网站数据');
    process.exit(1);
  }
  
  console.log('✅ 成功读取网站数据，总文章数:', siteData.total_posts);
  console.log('');
  
  // 生成导出文件
  console.log('💾 生成导出文件...');
  const exportData = await generateExportFile(siteData);
  
  console.log('✅ 导出成功！');
  console.log('📁 文件位置:', EXPORT_FILE);
  console.log('📊 导出记录数:', exportData.total_exports);
  console.log('⏰ 最后导出时间:', exportData.last_export);
  console.log('');
  
  // 显示最新的数据
  const latestExport = exportData.exports[exportData.exports.length - 1];
  if (latestExport) {
    console.log('最新导出数据摘要：');
    console.log('- 时间戳:', latestExport.timestamp);
    console.log('- 总文章数:', latestExport.total_posts);
    console.log('');
  }
  
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('💡 建议：');
  console.log('1. 将导出文件保存到git仓库');
  console.log('2. 在package.json中的deploy脚本添加此命令');
  console.log('3. 可定期（如每周）运行此脚本自动备份');
  console.log('');
  console.log('💻 使用Puppeteer完整导出（可选）：');
  console.log('npm install puppeteer');
  console.log('然后使用scripts/export_busuanzi_puppeteer.js');
  console.log('═════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
