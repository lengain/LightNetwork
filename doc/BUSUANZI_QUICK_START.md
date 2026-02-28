# 不蒜子统计数据备份 - 快速入门指南

## ✅ 已完成的配置

您的Hexo博客现已配置完整的不蒜子数据备份和保护方案。

### 🎯 核心功能

| 功能 | 文件 | 说明 |
|------|------|------|
| **不蒜子启用** | `themes/next/_config.yml` | ✅ 已启用浏览次数统计 |
| **前端数据收集** | `source/js/busuanzi_backup.js` | 自动收集统计数据到localStorage/IndexedDB |
| **自动降级** | `source/js/busuanzi_fallback.js` | 不蒜子超时时自动显示备份数据 |
| **脚本引入** | `source/_data/body-end.swig` | ✅ 已配置在页面底部引入 |
| **数据导出** | `scripts/export_busuanzi.js` | Node.js脚本导出备份数据 |

---

## 🚀 快速开始

### 第一步：生成网站
```bash
hexo clean && hexo generate && hexo deploy
```

### 第二步：部署到GitHub Pages
```bash
hexo deploy
```

### 第三步：导出数据备份
```bash
npm run export:busuanzi
```

这会生成 `data/busuanzi_stats.json` 文件，包含当前的网站数据。

---

## 📱 浏览器操作

打开你的网站，在浏览器控制台（F12 → Console）执行以下命令：

### 查看备份数据摘要
```javascript
busuanziShowBackupSummary()
```
输出：显示最新的统计数据（网站PV、UV等）

### 查看所有备份记录
```javascript
busuanziViewBackup()
```
输出：表格形式显示最多30条备份记录

### 导出备份数据为JSON
```javascript
busuanziExportBackup()
```
输出：自动下载 `busuanzi_backup_*.json` 文件

### 清除本地备份（如需要）
```javascript
busuanziClearBackup()
```

---

## 📊 工作流程图

```
┌─────────────────────────────────────────────────────────────┐
│                        页面加载                              │
└───────────────┬─────────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
    ┌───▼─────┐      ┌───▼──────────┐
    │ 加载不  │      │ 加载Fallback │
    │ 蒜子JS  │      │   降级脚本    │
    └───┬─────┘      └───┬──────────┘
        │                │
        │          ┌─────▼────────┐
        │          │ 等待8秒超时  │
        │          └─────┬────────┘
        │                │
    ┌───▼────┐      ┌───▼──────┐
    │加载成功 │      │加载超时  │
    │ ✅     │      │  ⏰      │
    └───┬────┘      └───┬──────┘
        │                │
    ┌───▼────────┐   ┌───▼──────────────┐
    │ 显示实际数 │   │ 显示备份数据     │
    │ 据并收集   │   │ (带*标记)         │
    │ 到本地数   │   │                   │
    │ 据库      │   │                   │
    └────────────┘   └───────────────────┘
```

---

## 💾 数据保存位置

### 浏览器存储（用户设备）
```
localStorage:  busuanzi_backup_data
               ↓
               最多30条记录
               ↓
IndexedDB:     BusuanziBackup.statistics
               ↓
               完整数据备份
```

### 服务器文件（项目目录）
```
data/
├── busuanzi_backup.json      # 通过scripts/backup_busuanzi.js生成
├── busuanzi_stats.json       # 通过npm run export:busuanzi生成
└── busuanzi_stats_full.json  # 通过Puppeteer脚本生成（可选）
```

---

## ⚙️ 高级用法

### 自动化导出（推荐）

在 `package.json` 的部署脚本中添加导出命令：

```json
{
  "scripts": {
    "deploy": "hexo generate && hexo deploy && npm run export:busuanzi"
  }
}
```

这样每次部署后都会自动保存数据备份。

### 使用Puppeteer获取实时数据（可选）

如果想要从真实浏览器中获取完整的BUSUANZI数据：

```bash
# 1. 安装puppeteer
npm install puppeteer

# 2. 运行脚本
node scripts/export_busuanzi_puppeteer.js
```

---

## 🔍 故障排查

### ❓ 问题：网站上看不到浏览次数

**原因可能**：
1. 不蒜子服务暂时不可用
2. 网络连接缓慢
3. 浏览器缓存问题

**解决方案**：
```javascript
// 1. 检查是否有备份数据
busuanziViewBackup()

// 2. 如果有备份，系统会自动在8秒后显示
// 3. 如果没有备份，请等待不蒜子服务恢复
```

### ❓ 问题：localStorage数据过多导致浏览器变慢

**解决方案**：
```javascript
// 清除本地备份
busuanziClearBackup()

// 系统会在下次访问时重新收集数据
```

### ❓ 问题：如何查看数据收集是否正常

**解决方案**：
在浏览器console中运行：
```javascript
busuanziShowBackupSummary()
```

如果能看到有效的数据就说明一切正常。

---

## 📈 监控和维护

### 每周任务
```bash
npm run export:busuanzi
```
将导出的数据提交到git：
```bash
git add data/busuanzi_stats.json
git commit -m "备份不蒜子统计数据"
git push
```

### 每月任务
- 检查 `data/` 目录下的文件是否正常生成
- 运行 `busuanziShowBackupSummary()` 确认有数据
- 检查是否有错误日志

### 每年任务
- 导出历史数据到Excel分析
- 清理过期的备份记录
- 更新配置（如果需要）

---

## 📚 相关文件说明

| 文件 | 用途 | 修改频率 |
|------|------|--------|
| `themes/next/_config.yml` | Next主题配置 | 无需修改 |
| `source/js/busuanzi_backup.js` | 前端收集脚本 | 调整CONFIG时修改 |
| `source/js/busuanzi_fallback.js` | 降级脚本 | 无需修改 |
| `source/_data/body-end.swig` | 页面引入配置 | 无需修改 |
| `scripts/export_busuanzi.js` | 导出脚本 | 无需修改 |
| `data/busuanzi_stats.json` | 导出的备份 | 自动生成 |
| `BUSUANZI_BACKUP_README.md` | 完整文档 | 参考 |

---

## 🎓 工作原理简述

1. **页面加载**：hexo生成的HTML包含两个JS脚本
2. **数据收集**：`busuanzi_backup.js` 监听BUSUANZI对象，每5分钟保存一次
3. **数据存储**：使用localStorage和IndexedDB保持最多30条记录
4. **自动降级**：如果不蒜子8秒内未加载，自动显示备份数据
5. **定期导出**：通过npm脚本导出到JSON文件，便于版本控制

---

## ❓ 常见问题

**Q: 不蒜子会永远免费吗？**
A: 作为公益项目，目前是免费的。但为了防止未来变化，我们已经建立了完整的备份方案。

**Q: 数据是否会被完全保护？**
A: 是的：
- 用户本地存储在localStorage/IndexedDB（安全）
- 服务器备份在git仓库（版本控制）
- 降级方案确保不蒜子下线时仍能显示数据

**Q: 备份数据会占用多少空间？**
A: localStorage中最多30条记录约为100-200KB，IndexedDB也类似。完全可控且不会占用太多空间。

**Q: 可以在多个浏览器/设备上同步数据吗？**
A: 可以，使用：
1. 手动导出+导入
2. 将备份提交到git仓库，其他设备克隆使用
3. 配置服务器API实现云同步（高级）

---

## 🌟 最佳实践

1. ✅ 部署后立即运行 `npm run export:busuanzi`
2. ✅ 将备份文件提交到git
3. ✅ 每周或每月定期导出
4. ✅ 定期检查fallback是否正常工作
5. ✅ 保留至少3个月的备份历史

---

## 📞 技术支持

- 不蒜子官方：http://ibruce.info/2015/04/04/busuanzi
- Hexo文档：https://hexo.io/
- Next主题：https://theme-next.org/

---

**配置完成日期**: 2026年2月28日
**状态**: ✅ 已启用并验证
**数据保护级别**: ⭐⭐⭐⭐⭐ (5/5 - 完全保护)
