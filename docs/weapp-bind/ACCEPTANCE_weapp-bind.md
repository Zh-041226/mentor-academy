# 验收记录：小程序原生登录与账号绑定（weapp-bind）

## 完成项
- Prisma `User` 新增绑定字段：`weappOpenId`、`weappUnionId`、`weappBoundAt`。
- `/api/weapp/login`：
  - 已绑定用户返回站点 JWT；
  - 未绑定返回 `{ status: 'need_bind' }`。
- `/api/weapp/bind`：
  - 使用 `code + studentId + password` 绑定 `openid/unionid`，成功返回 JWT。
- 小程序前端：
  - `pages/index` 采用原生登录流程，存储 JWT 或跳转绑定页；
  - `pages/bind` 完成绑定交互与存储 JWT；
  - `utils/request.js` 注入 JWT 到请求头。

## 验收结论
- 按验收标准逐项达成；
- 无需 `web-view`，避免个人主体业务域名限制；
- 与现有站点用户模型与登录口径一致。

## 运行验证（操作提示）
- 需在微信公众平台小程序后台配置 API 域名为「request 合法域名」，且为 HTTPS；
- 使用微信开发者工具或真机进行 `wx.login` 流程验证。