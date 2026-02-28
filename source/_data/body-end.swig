{# 不蒜子统计数据备份和Fallback脚本 #}
{# 为防止不蒜子服务不可用导致数据丢失，启用数据备份和降级方案 #}

{# 脚本1：不蒜子Fallback降级方案 - 必须先加载，快速提供降级方案 #}
<script src="/js/busuanzi_fallback.js"></script>

{# 脚本2：不蒜子数据收集和备份脚本 - 在不蒜子加载后执行，收集数据备份 #}
<script src="/js/busuanzi_backup.js"></script>

{# 备注文档 #}
{# 
数据备份说明：
1. busuanzi_fallback.js - 当不蒜子超时（>8s）时自动启用，使用localStorage备份数据显示
2. busuanzi_backup.js - 持续收集BUSUANZI对象数据，保存到localStorage和IndexedDB

可用的浏览器命令（在console中运行）：
- busuanziExportBackup()     - 导出备份数据为JSON文件下载
- busuanziViewBackup()       - 在console查看备份数据
- busuanziClearBackup()      - 清除本地备份数据
- busuanziShowBackupSummary() - 显示备份数据摘要

Node.js版本的导出脚本：
- npm run export:busuanzi    - 导出统计数据到data/busuanzi_stats.json
#}
