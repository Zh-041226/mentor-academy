# 登录联调与部署验证（TASK）

## 原子任务列表

1. 开发环境健康检查
   - 输入：后端已启动（3001）、前端开发服（3000）。
   - 操作：GET /api/health。
   - 输出：{ ok: true }。
   - 验收：200 OK 且返回 ok=true。

2. 管理员登录联调（开发环境）
   - 输入：studentId=mengsuilianyun，password=CHANGE_ME，level=梦碎怜云。
   - 操作：在 /admin/login 提交；观察跳转与 localStorage token。
   - 输出：跳转 /admin/dashboard，token 写入。
   - 验收：UI成功进入后台仪表盘，GET /api/users/me 显示 role=ADMIN、adminLevel=MENGSUILIANYUN。

3. 学生登录联调（开发环境）
   - 输入：studentId=202511080001，password=CHANGE_ME。
   - 操作：在 /login 提交；观察跳转与 localStorage token。
   - 输出：跳转 /activities，token 写入。
   - 验收：GET /api/users/me 显示 role=STUDENT、adminLevel=null。

4. 路由守卫与受限访问验证
   - 输入：无 token 或学生 token。
   - 操作：访问 /admin/**。
   - 输出：跳转至 /admin/login 或提示无权限。
   - 验收：行为与 router/index.js 定义一致。

5. 静态资源联调
   - 输入：/logo、/hero 静态目录。
   - 操作：页面加载顶部图片与登录/管理页配图。
   - 输出：图片正常显示，无 CORB/ORB 报错。
   - 验收：浏览器控制台无资源类型拦截错误。

6. 生产环境 Nginx 同源代理验证
   - 输入：Nginx 配置（/api -> 3001），前端 .env.production（VITE_BACKEND_URL 为空）。
   - 操作：域名访问前端，完成管理员/学生登录；检查网络。
   - 输出：成功登录，所有 /api 请求 2xx，无 CORS 跨域错误。
   - 验收：端到端成功，日志无异常。

## 依赖关系
- 2、3、4、5 依赖 1 完成。
- 6 依赖前端构建与 Nginx 配置完成。