/**
 * 不蒜子Fallback脚本
 * 当不蒜子服务不可用时，使用本地备份数据显示统计信息
 * 确保service降级时仍能显示历史数据
 */

(function() {
  'use strict';
  
  const STORAGE_KEY = 'busuanzi_backup_data';
  const FALLBACK_TIMEOUT = 8000; // 8秒后认为不蒜子不可用
  const FALLBACK_CLASS = 'busuanzi-fallback';
  
  /**
   * 从本地存储读取备份数据
   */
  function getBackupData() {
    try {
      const backup = localStorage.getItem(STORAGE_KEY);
      if (backup) {
        const data = JSON.parse(backup);
        return data;
      }
    } catch (e) {
      console.error('[Busuanzi Fallback] 读取备份数据失败:', e);
    }
    return null;
  }
  
  /**
   * 获取最新的数据点
   */
  function getLatestStats() {
    const backup = getBackupData();
    if (!backup || !backup.records || backup.records.length === 0) {
      return null;
    }
    return backup.records[backup.records.length - 1];
  }
  
  /**
   * 应用Fallback统计信息到DOM
   */
  function applyFallbackStats() {
    const stats = getLatestStats();
    if (!stats) {
      console.warn('[Busuanzi Fallback] 没有找到备份数据');
      return false;
    }
    
    // 标记为使用了fallback
    document.body.classList.add(FALLBACK_CLASS);
    
    const updates = [];
    
    // 更新总访客数 (site_uv)
    if (stats.site_uv) {
      const uvElements = document.querySelectorAll('.busuanzi-value');
      if (uvElements.length > 0) {
        // First element is usually site_uv
        uvElements[0].textContent = formatNumber(stats.site_uv);
        updates.push('site_uv: ' + stats.site_uv);
      }
    }
    
    // 更新总浏览数 (site_pv)
    if (stats.site_pv) {
      const pvElements = document.querySelectorAll('.busuanzi-value');
      if (pvElements.length > 1) {
        pvElements[1].textContent = formatNumber(stats.site_pv);
        updates.push('site_pv: ' + stats.site_pv);
      }
    }
    
    // 更新当前页面浏览数 (page_pv)
    if (stats.page_pv) {
      const pageElements = document.querySelectorAll('.post-meta-item .busuanzi-value');
      if (pageElements.length > 0) {
        pageElements[0].textContent = formatNumber(stats.page_pv);
        updates.push('page_pv: ' + stats.page_pv);
      }
    }
    
    if (updates.length > 0) {
      console.log('[Busuanzi Fallback] ✅ 已应用备份数据:', updates.join(', '));
      console.log('备份时间:', stats.timestamp);
      addFallbackIndicator();
      return true;
    }
    
    return false;
  }
  
  /**
   * 检测不蒜子是否加载成功
   */
  function isBusuanziLoaded() {
    return typeof BUSUANZI !== 'undefined' && BUSUANZI.site_pv;
  }
  
  /**
   * 等待不蒜子加载或超时后使用Fallback
   */
  function setupFallbackMechanism() {
    let busuanziLoaded = false;
    let fallbackApplied = false;
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!busuanziLoaded && !fallbackApplied) {
        console.warn('[Busuanzi Fallback] 不蒜子加载超时，应用Fallback策略');
        fallbackApplied = applyFallbackStats();
      }
    }, FALLBACK_TIMEOUT);
    
    // 监听BUSUANZI加载完成
    const checkInterval = setInterval(() => {
      if (isBusuanziLoaded()) {
        busuanziLoaded = true;
        clearTimeout(timeout);
        clearInterval(checkInterval);
        console.log('[Busuanzi Fallback] 不蒜子已正常加载，无需Fallback');
      }
    }, 200);
  }
  
  /**
   * 格式化数字
   */
  function formatNumber(num) {
    if (!num) return '0';
    return num.toString();
  }
  
  /**
   * 添加Fallback指示器（可选，用于调试）
   */
  function addFallbackIndicator() {
    // 添加CSS标记表示使用了fallback
    const style = document.createElement('style');
    style.textContent = `
      .${FALLBACK_CLASS} .busuanzi-value {
        position: relative;
      }
      .${FALLBACK_CLASS} .busuanzi-value::after {
        content: '*';
        font-size: 0.8em;
        margin-left: 2px;
        color: #999;
        opacity: 0.5;
      }
    `;
    document.head.appendChild(style);
    
    // 在控制台输出提示
    console.info('%c[Busuanzi Fallback] 当前显示的是备份数据', 
      'color: #ff6b6b; font-weight: bold; font-size: 12px');
  }
  
  /**
   * 导出当前备份数据供用户下载
   */
  window.busuanziExportBackupFile = function() {
    const backup = getBackupData();
    if (!backup) {
      console.log('没有备份数据可导出');
      return;
    }
    
    try {
      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `busuanzi_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✅ 备份数据已下载');
    } catch (e) {
      console.error('导出失败:', e);
    }
  };
  
  /**
   * 显示备份统计摘要
   */
  window.busuanziShowBackupSummary = function() {
    const stats = getLatestStats();
    if (!stats) {
      console.log('没有备份数据');
      return;
    }
    
    console.table({
      '最后更新': stats.timestamp,
      '网站总浏览数': stats.site_pv || '未统计',
      '网站总访客数': stats.site_uv || '未统计',
      '当前页面浏览数': stats.page_pv || '未统计',
      '最后访问页面': stats.page_title || stats.page_url
    });
  };
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFallbackMechanism);
  } else {
    setupFallbackMechanism();
  }
  
  console.log('[Busuanzi Fallback] 脚本已加载，将在不蒜子超时后自动启用');
  console.log('可用命令:');
  console.log('  busuanziExportBackupFile()    - 导出备份文件');
  console.log('  busuanziShowBackupSummary()   - 显示备份摘要');
  
})();
