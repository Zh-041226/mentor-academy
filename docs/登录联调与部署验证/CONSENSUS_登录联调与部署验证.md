# 登录联调与部署验证（CONSENSUS）

## 目标
- 在开发环境与生产环境中，完成管理员与学生登录端到端联调与验证。
- 保证前端与后端的同源/跨域配置正确，/api 路由可用，令牌鉴权与路由守卫正常工作。

## 项目上下文与技术栈
- 前端：Vite + Vue 3 + Vue Router + Element Plus
  - 环境变量：VITE_BACKEND_URL（为空使用同源 /api；非空使用绝对后端地址拼接 /api）
  - 请求封装：src/api/http.js（axios，携带 Authorization: Bearer <token>）
- 后端：Node.js + Express + Prisma（MySQL）
  - 监听：默认 3001
  - CORS：app.use(cors()) 已开启
  - 静态：/uploads、/logo、/hero、/auth
  - 主要接口：
    - POST /api/auth/login（学生）
    - POST /api/admin/auth/login（管理员，字段：studentId、password、level）
    - GET /api/users/me（携带令牌）
    - GET /api/health（健康检查：{ ok: true }）

## 需求范围
1. 开发环境联调：
   - 使用前端开发服（http://localhost:3000/）完成管理员与学生登录验证。
   - 验证路由守卫：未登录访问 /admin/** 跳转到 /admin/login；登录后可访问对应页面。
2. 生产环境检查：
   - Nginx 同源代理：将 /api 代理到后端 3001，前端 .env.production 将 VITE_BACKEND_URL 留空。
   - 确认域名与证书配置正确，浏览器无跨域与混合内容报错。
3. 故障收集：
   - 如登录失败或鉴权异常，收集浏览器控制台网络错误、PM2/后端日志、请求/响应详情。

## 边界与不做事项
- 不改动数据库结构与业务逻辑（除必要的种子数据用于联调）。
- 不编写单元测试（除非后续明确要求）。
- 不新增复杂 UI 功能，仅验证登录与基础守卫。

## 技术约束与兼容
- 严格兼容现有框架与版本（Vite/Vue/Express/Prisma）。
- .env/.env.production 的配置遵循现有前端 http.js 逻辑：
  - VITE_BACKEND_URL 为空：baseURL 为 '/api'（同源）。
  - 非空：baseURL 为 '<VITE_BACKEND_URL>/api'（跨域）。

## 验收标准（可测试）
1. 开发环境：
   - 在 http://localhost:3000/admin/login 使用管理员账号（studentId=mengsuilianyun，password=CHANGE_ME，level=梦碎怜云）登录成功并跳转至 /admin/dashboard；localStorage 存在 token。
   - 在 http://localhost:3000/login 使用学生账号（studentId=202511080001，password=CHANGE_ME）登录成功并跳转至 /activities；localStorage 存在 token。
   - 登录后访问 /api/users/me 返回 role 与 adminLevel（管理员：ADMIN/MENGSUILIANYUN；学生：STUDENT/null）。
2. 生产环境：
   - 通过域名访问前端页面，/api 由 Nginx 代理至 3001，登录流程成功，浏览器网络面板无 CORS/mixed-content 错误。
3. 健康检查：
   - GET /api/health 返回 { ok: true }。

## 不确定性与澄清
- 生产服务器具体环境（域名、证书、Nginx 与 PM2 状态）需由运维提供或在后续步骤中收集确认。