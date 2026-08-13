# 待办清单（部署上线与后端聚合增强）

## 需用户/服务器信息确认
- [ ] 服务器 SSH 账户与认证方式（root 或 sudo 用户、密钥/密码）
- [ ] 实际 Nginx 站点路径是否为 `/etc/nginx/sites-available/mentor-academy`
- [ ] 前端静态目录是否为 `/var/www/mentor-academy/frontend/`（如不同请提供）
- [ ] 是否需要 PM2 重启后端服务（或仅前端更新即可）

## 部署执行（得到服务器信息后）
- [ ] 上传 `frontend/dist.zip` 到服务器并解压覆盖静态目录
- [ ] 备份旧版本静态资源（可选）
- [ ] `nginx -t && systemctl reload nginx`
- [ ] 管理仪表盘目视验证与接口探测（200/结构正确）

## 前端功能（可选增强）
- [ ] 在 AdminCharts 页面增加筛选控件（类别/导师/状态），调用新增分析接口
- [ ] KPI 火柴线支持更多维度快速切换（近7/30/90天）