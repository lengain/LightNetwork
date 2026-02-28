# 不蒜子统计数据备份和保护方案

## 🎯 目标
防止不蒜子服务下线或不可用时，导致网站浏览次数统计数据丢失。

## 📋 方案说明

### 1. **不蒜子启用**
在 `themes/next/_config.yml` 中已启用不蒜子统计：
```yaml
busuanzi_count:
  enable: true
  total_visitors: true
  total_views: true
  post_views: true
```

### 2. **数据备份机制**

#### A. 前端数据收集 (`source/js/busuanzi_backup.js`)
- 页面加载时自动启动
- 每5分钟的周期性地将 `BUSUANZI` 对象中的数据保存到：
  - `localStorage`（小容量，容易满）
  - `IndexedDB`（推荐，容量大）
- 只保留最近30条记录，防止存储溢出
- 页面关闭时自动保存一次

#### B. 降级方案 (`source/js/busuanzi_fallback.js`)
- 当不蒜子加载超时（>8秒）时自动启用
- 从本地存储读取最新的备份数据
- 将备份数据显示到页面上
- 确保用户看到的仍是有意义的统计数字

#### C. 后端导出脚本 (`scripts/export_busuanzi.js`)
- 从 `public/content.json` 提取网站内容信息
- 生成 `data/busuanzi_stats.json` 备份文件
- 可定期运行保存离线备份

## 🚀 使用指南

### 1. 生成和部署网站
```bash
# 清理和生成
hexo clean && hexo generate

# 部署网站
hexo deploy
```

### 2. 导出备份数据
部署后运行以下命令将数据导出到本地文件：
```bash
npm run export:busuanzi
```
这会生成：`data/busuanzi_stats.json`

### 3. 浏览器命令（在浏览器console中执行）

查看备份数据摘要：
```javascript
busuanziShowBackupSummary()
```

查看所有备份记录：
```javascript
busuanziViewBackup()
```

导出备份数据为JSON文件下载：
```javascript
busuanziExportBackup()
```

清除本地备份：
```javascript
busuanziClearBackup()
```

## 📊 数据结构

### localStorage 中的数据格式
```json
{
  "lastUpdate": "2026-02-28T10:30:00.000Z",
  "records": [
    {
      "timestamp": "2026-02-28T10:25:00.000Z",
      "site_pv": 12345,
      "site_uv": 5000,
      "page_pv": 42,
      "page_url": "/2024/03/article/",
      "page_title": "文章标题"
    }
  ]
}
```

## ⚙️ 配置选项

### 编辑 `source/js/busuanzi_backup.js`
```javascript
const CONFIG = {
  enableLocalStorage: true,      // 启用localStorage
  enableIndexedDB: true,         // 启用IndexedDB（推荐）
  enableServerBackup: false,     // 启用服务器备份（需要后端API）
  serverBackupUrl: '/api/backup-busuanzi',
  maxRecords: 30                 // 最多保留30条记录
};
```

## 🛡️ 保护措施

| 措施 | 说明 | 优先级 |
|------|------|--------|
| localStorage备份 | 浏览器本地存储 | ⭐⭐⭐ |
| IndexedDB备份 | 大容量本地数据库 | ⭐⭐⭐⭐ |
| Fallback降级 | 不蒜子不可用时自动启用 | ⭐⭐⭐⭐⭐ |
| 离线备份文件 | data/busuanzi_stats.json | ⭐⭐⭐ |

## 🔍 故障排查

### 问题：不蒜子加载失败
**表现**: 页面上没有显示统计数字
**解决**: 
1. 打开浏览器开发者工具（F12）
2. 检查Network标签，看 `busuanzi.ibruce.info` 是否已加载
3. 如果加载失败，fallback机制会自动启用显示备份数据
4. 备份数据用 `*` 标记区别

### 问题：需要查看统计数据
**方案 1**：在console中运行 `busuanziShowBackupSummary()`
**方案 2**：在console中运行 `busuanziViewBackup()` 查看详细记录

### 问题：想完全关闭备份
编辑 `source/_data/body-end.swig`，注释掉两行script标签

## 📚 文件清单

```
LNHexoBlog/
├── source/
│   ├── js/
│   │   ├── busuanzi_backup.js      # 前端数据收集脚本
│   │   └── busuanzi_fallback.js    # 降级方案脚本
│   └── _data/
│       └── body-end.swig            # 引入脚本的配置文件
├── scripts/
│   ├── export_busuanzi.js          # 导出备份数据脚本
│   └── backup_busuanzi.js          # 备份管理脚本
├── data/
│   └── busuanzi_backup.json        # 备份数据文件
├── package.json                     # npm脚本配置已更新
└── themes/next/_config.yml         # busuanzi已启用，bodyEnd已配置
```

## 🎓 技术细节

### 为什么要备份？
不蒜子是第三方免费服务，存在以下风险：
- 服务器故障或离线
- 运营团队放弃维护
- 域名过期
- DDoS攻击

### 为什么用localStorage/IndexedDB？
- 数据安全：数据存储在用户本地，不涉及隐私
- 永久性：即使关闭浏览器也能保留
- 实时性：页面加载时就能获得最新数据
- 无依赖：不需要额外的服务器支持

### Fallback如何工作？
1. 页面加载时，同时发送不蒜子和fallback脚本
2. fallback脚本设置8秒超时计时器
3. 如果不蒜子在8秒内加载完成，fallback被取消
4. 如果超时，fallback自动从localStorage加载备份数据并显示

## 🔄 维护建议

1. **周期导出**：每周运行 `npm run export:busuanzi` 保存离线备份
2. **版本控制**：将 `data/busuanzi_stats.json` 提交到git
3. **定期检查**：每月检查一次备份文件是否正常生成
4. **监控覆盖率**：使用 `busuanziShowBackupSummary()` 定期检查数据

## 📞 支持资源

- 不蒜子官方：http://ibruce.info/2015/04/04/busuanzi
- 浏览器localStorage：https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage
- IndexedDB文档：https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API

---

**最后更新**: 2026年2月28日
**维护者**: 自动化脚本系统
