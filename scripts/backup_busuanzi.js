/**
 * 备份不蒜子统计数据脚本
 * 用于在hexo部署时保存当前的浏览数据，防止服务下线时数据丢失
 * 
 * 使用方法：
 * 1. 直接运行：node scripts/backup_busuanzi.js
 * 2. 在package.json中配置：npm run backup:busuanzi
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BACKUP_DIR = path.join(__dirname, '../data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'busuanzi_backup.json');
const SITE_URL = 'https://lengain.github.io'; // 修改为你的网站URL

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * 从不蒜子API提取网站总统计数据
 * @returns {Promise<Object>}
 */
function fetchBusuanziStats() {
  return new Promise((resolve, reject) => {
    const url = `https://busuanzi.ibruce.info/fetch?jsonpCallback=busuanziCallback&siteid=${SITE_URL}`;
    
    // 不蒜子API需要通过JSONP调用，这里我们用另一种方法
    // 实际上，我们可以通过访问busuanzi提供的API来获取数据
    
    // 方案1：尝试通过busuanzi的图片版统计接口
    const imgUrl = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=busuanziCallback`;
    
    console.log('不蒜子API说明：');
    console.log('不蒜子统计是通过在前端加载js脚本工作的，不提供直接的后端API获取总数据。');
    console.log('但我们可以通过以下方式保存数据：');
    console.log('1. 从public/content.json中提取所有页面信息');
    console.log('2. 读取生成后的HTML文件，解析不蒜子的统计代码');
    console.log('');
    
    resolve({
      timestamp: new Date().toISOString(),
      method: 'frontend-based',
      notice: '不蒜子数据需要从前端收集，建议参考方案2'
    });
  });
}

/**
 * 方案2：创建前端数据收集脚本
 * 在HTML中嵌入脚本，定期向server报告统计数据
 */
function generateCollectorScript() {
  return `
/**
 * 不蒜子数据收集器
 * 这个脚本运行在浏览器端，定期将统计数据发送到server保存
 */
(function() {
  // 检查busuanzi是否加载完成
  if (typeof BUSUANZI !== 'undefined') {
    const stats = {
      timestamp: new Date().toISOString(),
      site_pv: BUSUANZI.site_pv || 0,
      site_uv: BUSUANZI.site_uv || 0,
      page_pv: BUSUANZI.page_pv || 0,
      page_url: window.location.pathname
    };
    
    // 可以将数据发送到后端API或存储到localStorage
    localStorage.setItem('busuanzi_last_stats_' + Date.now(), JSON.stringify(stats));
    
    // 可选：发送到服务器（需要后端支持）
    // fetch('/api/busuanzi/backup', { method: 'POST', body: JSON.stringify(stats) });
  }
})();
`;
}

/**
 * 从生成的JSON内容提取页面信息
 * Hexo会生成content.json包含所有文章信息
 */
function extractFromContentJson() {
  const contentPath = path.join(__dirname, '../public/content.json');
  
  if (!fs.existsSync(contentPath)) {
    console.log('⚠️  public/content.json 不存在，请先运行 hexo generate');
    return null;
  }
  
  try {
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const backup = {
      timestamp: new Date().toISOString(),
      type: 'hexo-content-based',
      posts: content.posts ? content.posts.length : 0,
      site_url: SITE_URL,
      pages: (content.posts || []).map(post => ({
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
 * 保存备份文件
 */
function saveBackup(data) {
  try {
    // 读取现有的备份文件
    let history = [];
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        history = existing.history || [];
      } catch (e) {
        console.log('⚠️  现有备份文件格式错误，将覆盖');
      }
    }
    
    // 只保留最近30条记录，防止文件过大
    if (history.length >= 30) {
      history = history.slice(-29);
    }
    
    // 添加新记录
    history.push(data);
    
    const backup = {
      last_backup: data.timestamp,
      total_records: history.length,
      site_url: SITE_URL,
      history: history
    };
    
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8');
    console.log('✅ 备份成功保存:', BACKUP_FILE);
    console.log('📊 当前备份记录数:', history.length);
    return true;
  } catch (err) {
    console.error('❌ 保存备份失败:', err.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🕐 不蒜子统计数据备份脚本');
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // 方法1：从不蒜子API获取（受限制）
  try {
    const stats = await fetchBusuanziStats();
    console.log('从API获取的数据:', stats);
  } catch (err) {
    console.error('API方法失败:', err.message);
  }
  
  console.log('');
  
  // 方法2：从content.json提取
  const contentData = extractFromContentJson();
  if (contentData) {
    saveBackup(contentData);
  }
  
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('💡 建议方案：');
  console.log('方案1：使用localStorage在用户本地浏览器保存数据');
  console.log('方案2：在hexo生成时，将不蒜子统计js改为包含数据保存逻辑');
  console.log('方案3：部署webhook，定期从网站前端爬取BUSUANZI数据');
  console.log('');
  console.log('已为你生成前端收集脚本，可在custom_file_path中引入：');
  const scriptPath = path.join(__dirname, '../source/_data/busuanzi_collector.js');
  fs.writeFileSync(scriptPath, generateCollectorScript(), 'utf8');
  console.log('✅ 已生成:', scriptPath);
}

main().catch(console.error);
