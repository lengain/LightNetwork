/**
 * 不蒜子统计数据收集和备份脚本
 * 在前端运行，收集不蒜子数据到localStorage和IndexedDB
 * 
 * 工作流程：
 * 1. 页面加载时，此脚本在不蒜子js加载后执行
 * 2. 周期性地将BUSUANZI对象数据保存到本地存储
 * 3. 定期将累计数据发送到服务器备份（可选）
 * 4. 当不蒜子服务不可用时，使用本地备份数据显示
 */

(function() {
  'use strict';
  
  const STORAGE_KEY = 'busuanzi_backup_data';
  const SAVE_INTERVAL = 5 * 60 * 1000; // 每5分钟保存一次
  const CONFIG = {
    enableLocalStorage: true,
    enableIndexedDB: true,
    enableServerBackup: false, // 需要后端支持
    serverBackupUrl: '/api/backup-busuanzi',
    maxRecords: 30
  };
  
  /**
   * 初始化方法
   */
  function init() {
    console.log('[Busuanzi Backup] 初始化数据收集...');
    
    // 等待busuanzi加载完成
    waitForBusuanzi(() => {
      console.log('[Busuanzi Backup] 检测到busuanzi已加载');
      startDataCollection();
    });
  }
  
  /**
   * 等待busuanzi加载完成
   */
  function waitForBusuanzi(callback, maxAttempts = 30) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof BUSUANZI !== 'undefined' && BUSUANZI.site_pv) {
        clearInterval(checkInterval);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn('[Busuanzi Backup] 等待超时，跳过数据收集');
      }
    }, 500);
  }
  
  /**
   * 开始数据收集
   */
  function startDataCollection() {
    // 立即收集一次
    collectData();
    
    // 定期收集
    setInterval(collectData, SAVE_INTERVAL);
    
    // 页面关闭时保存一次
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', collectData);
    }
  }
  
  /**
   * 收集当前的统计数据
   */
  function collectData() {
    if (typeof BUSUANZI === 'undefined') return;
    
    const data = {
      timestamp: new Date().toISOString(),
      site_pv: BUSUANZI.site_pv || 0,
      site_uv: BUSUANZI.site_uv || 0,
      page_pv: BUSUANZI.page_pv || 0,
      page_url: window.location.pathname,
      page_title: document.title
    };
    
    // 保存到localStorage
    if (CONFIG.enableLocalStorage) {
      saveToLocalStorage(data);
    }
    
    // 保存到IndexedDB（容量更大）
    if (CONFIG.enableIndexedDB) {
      saveToIndexedDB(data);
    }
    
    // 可选：发送到服务器备份
    if (CONFIG.enableServerBackup) {
      sendToServer(data);
    }
  }
  
  /**
   * 保存到localStorage
   */
  function saveToLocalStorage(data) {
    try {
      let backup = {
        lastUpdate: data.timestamp,
        records: []
      };
      
      // 尝试读取现有数据
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        try {
          backup = JSON.parse(existing);
        } catch (e) {
          console.warn('[Busuanzi Backup] 现有localStorage数据格式错误');
        }
      }
      
      // 添加新记录
      backup.records = backup.records || [];
      if (!backup.records.some(r => r.timestamp === data.timestamp)) {
        backup.records.push(data);
        
        // 只保留最近N条记录
        if (backup.records.length > CONFIG.maxRecords) {
          backup.records = backup.records.slice(-CONFIG.maxRecords);
        }
      }
      
      backup.lastUpdate = data.timestamp;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(backup));
      
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[Busuanzi Backup] localStorage已满，清空旧数据');
        localStorage.removeItem(STORAGE_KEY);
      } else {
        console.error('[Busuanzi Backup] localStorage保存失败:', e.message);
      }
    }
  }
  
  /**
   * 保存到IndexedDB（容量更大，推荐）
   */
  function saveToIndexedDB(data) {
    if (!('indexedDB' in window)) {
      console.warn('[Busuanzi Backup] 浏览器不支持IndexedDB');
      return;
    }
    
    try {
      const request = indexedDB.open('BusuanziBackup', 1);
      
      request.onerror = () => {
        console.error('[Busuanzi Backup] IndexedDB打开失败');
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['statistics'], 'readwrite');
        const store = transaction.objectStore('statistics');
        
        // 添加数据
        store.add({
          timestamp: data.timestamp,
          data: data
        }).catch(e => {
          // 如果key已经存在，则更新
          if (e.name === 'ConstraintError') {
            store.put({
              timestamp: data.timestamp,
              data: data
            });
          }
        });
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('statistics')) {
          const store = db.createObjectStore('statistics', { keyPath: 'timestamp' });
          store.createIndex('date', 'timestamp', { unique: false });
        }
      };
    } catch (e) {
      console.error('[Busuanzi Backup] IndexedDB保存失败:', e.message);
    }
  }
  
  /**
   * 可选：发送到服务器备份
   */
  function sendToServer(data) {
    // 这个需要后端API支持
    if (!CONFIG.serverBackupUrl) return;
    
    try {
      fetch(CONFIG.serverBackupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(e => console.warn('[Busuanzi Backup] 服务器备份失败:', e.message));
    } catch (e) {
      console.warn('[Busuanzi Backup] 无法发送到服务器');
    }
  }
  
  /**
   * 导出备份数据（用于下载或查看）
   */
  window.busuanziExportBackup = function() {
    try {
      const backup = localStorage.getItem(STORAGE_KEY);
      if (backup) {
        const data = JSON.parse(backup);
        console.log('导出的不蒜子备份数据:', data);
        
        // 触发下载
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `busuanzi_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        return data;
      } else {
        console.log('没有找到备份数据');
        return null;
      }
    } catch (e) {
      console.error('导出失败:', e);
      return null;
    }
  };
  
  /**
   * 查看备份数据（在控制台中）
   */
  window.busuanziViewBackup = function() {
    try {
      const backup = localStorage.getItem(STORAGE_KEY);
      if (backup) {
        const data = JSON.parse(backup);
        console.table(data.records || []);
        return data;
      }
    } catch (e) {
      console.error('查看失败:', e);
    }
  };
  
  /**
   * 清除备份数据
   */
  window.busuanziClearBackup = function() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Busuanzi Backup] 已清除本地备份数据');
  };
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  console.log('[Busuanzi Backup] 脚本已加载');
  console.log('可用命令:');
  console.log('  busuanziExportBackup()  - 导出并下载备份数据');
  console.log('  busuanziViewBackup()    - 在控制台查看备份数据');
  console.log('  busuanziClearBackup()   - 清除备份数据');
  
})();
