# 任务拆分：小程序原生登录与账号绑定（weapp-bind）

## 原子任务

1) 修改 Prisma User 模型以支持绑定状态
- 输入：现有 `schema.prisma`
- 输出：新增 `weappOpenId`、`weappUnionId`、`weappBoundAt`
- 约束：字段可空但唯一约束需谨慎；与现有数据兼容
- 依赖：Prisma 迁移与部署

2) 扩展 `/api/weapp/login` 实现绑定判定与 JWT 返回
- 输入：`code`、`jscode2session` 响应
- 输出：已绑定返回 `{ token }`；未绑定返回 `{ status: 'need_bind' }`
- 约束：JWT 与现有站点对齐；错误处理规范化
- 依赖：User 绑定字段

3) 新增 `/api/weapp/bind` 完成绑定并返回 JWT
- 输入：`code, studentId, password`
- 输出：绑定成功返回 `{ token }`
- 约束：学号+密码校验；冲突检查；审计绑定时间
- 依赖：`/api/weapp/login`、User 绑定字段

4) 小程序新增 `pages/bind` 与 `utils/request.js`
- 输入：页面与交互需求
- 输出：绑定页、请求封装（JWT 注入）
- 约束：遵循小程序规范；简洁可靠
- 依赖：后端接口可用

5) 调整 `pages/index` 登录流程为原生逻辑
- 输入：现有登录页
- 输出：处理 `token` 或跳转绑定页
- 约束：避免 `web-view`；用户体验一致
- 依赖：后端接口可用