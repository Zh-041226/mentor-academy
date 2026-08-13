# 登录联调与部署验证（TODO）

## 待办事项
- 开发环境：在浏览器打开 http://localhost:3000/admin/login 与 /login，完成管理员/学生登录 UI 验证。
- 生产环境：提供服务器域名、Nginx 配置片段、PM2 进程列表与日志，以便确认同源代理与后端运行状态。
- 如遇错误：收集浏览器 Network 面板请求/响应（含 Headers/Body）、Console 报错截图或文本、后端日志具体堆栈。

## 需要的环境信息（生产）
- Nginx 配置文件（server 块中 / 与 /api 的 location 配置）。
- PM2 列表与日志：`pm2 ls`、`pm2 logs --lines 100`。
- Node 与 npm 版本：`node -v`、`npm -v`。
- 数据库连接与表状态（Prisma 迁移是否已执行）。