# 部署上线与后端聚合增强 - 共识文档

## 目标
- 部署：将前端最新产物构建并同步至服务器的静态目录，重载 Nginx 完成线上验证。
- 后端增强：新增基于“报名创建时间”的聚合分析接口，支持更精细维度与筛选，并优化统计性能。

## 范围与边界
- 范围：
  - 前端构建与静态资源部署（Vite 构建、同步到 `/var/www/mentor-academy/frontend/`）。
  - Nginx 配置验证与重载（站点：`/etc/nginx/sites-available/mentor-academy`）。
  - 后端分析接口实现与本地联调（基于 Prisma 与 MySQL）。
- 边界（不包含）：
  - 数据库结构迁移与历史数据清洗。
  - 复杂权限模型调整与 SSO 集成。
  - 单元测试与性能压测（如需可后续补充）。

## 技术约束与对齐
- 前端：Vue3 + Vite，生产构建输出 `frontend/dist`。
- 后端：Node.js 18 + Express + Prisma 6，数据库 MySQL。
- 部署：Nginx 反向代理后端 `http://localhost:3001/`，前端静态根 `/var/www/mentor-academy/frontend/`。
- 安全：JWT 管理员认证，接口需 `Authorization: Bearer <token>`。

## 验收标准（可测试）
1. 前端部署
   - 访问站点首页返回 200，静态资源加载成功，无 404/500。
   - 管理端仪表盘 KPI 火柴线与新增图表（累计曲线、日历热力）正确渲染。
2. Nginx
   - `nginx -t` 配置检查通过；`systemctl reload nginx` 无错误。
   - `/api/` 路由正确代理到后端 3001。
3. 后端接口
   - GET `/api/admin/analytics/registrations/by-day?days=7` 返回 `{ labels[], series[] }` 且 200。
   - GET `/api/admin/analytics/registrations/by-hour?date=YYYY-MM-DD` 返回 `{ labels[24], series[24] }` 且 200。
   - GET `/api/admin/analytics/registrations/status-by-day?days=30` 返回堆叠数据结构且 200。
   - GET `/api/admin/analytics/registrations/top?dimension=category&limit=10&days=90` 返回排序结果且 200。

## 不确定性与澄清点
- 服务器 SSH 访问方式（账户/密钥）、域名与实际 Nginx 站点文件路径是否与 `deploy/` 目录一致。
- 是否需要在生产环境重启后端（PM2）或仅前端静态资源更新即可。
- 是否需要将新增分析接口集成到前端图表页面（目前已具备可用数据结构，是否开放配置入口）。

以上问题需在执行部署前确认，以确保线上环境一致性与最小风险。