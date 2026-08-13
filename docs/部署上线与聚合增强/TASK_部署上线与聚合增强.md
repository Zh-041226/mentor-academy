# 部署上线与后端聚合增强 - 原子任务拆分

## 任务清单

1. 前端生产构建
   - 输入契约：已更新的前端代码（AdminCharts.vue、AdminDashboard.vue）、Node 18、npm
   - 输出契约：`frontend/dist/` 构建产物
   - 约束：与现有 Vite 构建配置兼容
   - 依赖：无

2. 打包构建产物
   - 输入契约：`frontend/dist/`
   - 输出契约：`frontend/dist.zip`
   - 约束：ZIP 打包不丢失目录结构
   - 依赖：任务1

3. 同步至服务器静态目录
   - 输入契约：服务器 SSH 访问权限，目标目录 `/var/www/mentor-academy/frontend/`
   - 输出契约：前端静态资源已替换/更新
   - 约束：覆盖旧版本前置备份；权限 `www-data` 可读
   - 依赖：任务2

4. Nginx 验证与重载
   - 输入契约：站点配置文件 `/etc/nginx/sites-available/mentor-academy`
   - 输出契约：`nginx -t` 通过；服务重载成功
   - 约束：禁止改动后端代理前缀 `/api/`
   - 依赖：任务3

5. 线上功能验证
   - 输入契约：浏览器访问域名/公网IP
   - 输出契约：页面加载OK，图表渲染正常，接口 200
   - 约束：管理员登录可用；后端健康运行
   - 依赖：任务4

6. 后端聚合接口实现
   - 输入契约：Prisma 模型、MySQL 数据；Express 应用
   - 输出契约：新增 4 个分析接口（by-day/by-hour/status-by-day/top）
   - 约束：仅统计 `ActivityRegistration.createdAt` 时间维度；支持筛选与枚举校验
   - 依赖：无（但建议任务1完成后联调）

7. 本地联调与校验
   - 输入契约：管理员 JWT；curl 或 Postman
   - 输出契约：接口返回结构与约定一致
   - 约束：边界参数校验与错误响应清晰
   - 依赖：任务6

8. 文档与交付物完善
   - 输入契约：上述执行结果
   - 输出契约：CONSENSUS/DESIGN/TASK/ACCEPTANCE/FINAL/TODO
   - 约束：对齐项目现有架构，内容简洁可执行
   - 依赖：任务1-7