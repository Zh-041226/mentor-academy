# 共识：小程序原生登录与账号绑定（weapp-bind）

## 需求描述
- 绑定依据：学号 + 密码。
- API 域名具备 HTTPS，并可配置为「request 合法域名」。
- 由于个人主体无法配置「业务域名」，不使用 `web-view` 打开外部 H5；采用纯原生小程序接口完成登录与绑定。

## 技术实现方案
- 后端：
  - Prisma `User` 模型新增 `weappOpenId`、`weappUnionId`、`weappBoundAt` 字段。
  - `/api/weapp/login`：使用 `wx.login` 获取 `code`，服务端 `jscode2session` 得到 `openid/unionid`；
    - 若已绑定用户：返回站点 JWT（`token`）。
    - 若未绑定：返回 `{ status: 'need_bind' }`，引导前端进入绑定页。
  - `/api/weapp/bind`：提交 `code + studentId + password`；验证通过后，将 `openid/unionid` 绑定到对应用户并返回 JWT。
- 小程序前端：
  - `pages/index`：调用 `/api/weapp/login`；收到 `token` 即存储并登录；收到 `need_bind` 跳转 `pages/bind`。
  - `pages/bind`：提交绑定信息至 `/api/weapp/bind`，成功后存储 JWT 并完成登录。
  - `utils/request.js`：封装请求并注入 `Authorization: Bearer <jwt>`。

## 任务边界与约束
- 不改动既有 Web/H5 登录流程与页面。
- 不使用 `web-view`，避免个人主体业务域名限制。
- 保持与现有 Express + Prisma 架构一致，代码风格延续项目规范。

## 验收标准
1. 未绑定用户：
   - `/api/weapp/login` 返回 `status='need_bind'`；
   - 在 `pages/bind` 输入正确学号与密码可成功绑定并获得 JWT；
2. 已绑定用户：
   - `/api/weapp/login` 直接返回 `token`，前端缓存并登录；
3. 小程序能在真机环境下正常调用后端（API 域名已配置为「request 合法域名」）。

## 不确定性与结论
- 绑定字段与口径已与现有用户模型对齐：以 `studentId + password` 匹配老用户。
- HTTPS 与域名配置由用户侧完成；后端不负责证书与备案。