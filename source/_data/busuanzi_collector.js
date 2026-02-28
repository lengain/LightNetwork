
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
