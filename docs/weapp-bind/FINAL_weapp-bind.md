# 项目总结：小程序原生登录与账号绑定（weapp-bind）

## 概要
已实现基于学号+密码的原生绑定与登录闭环：未绑定引导绑定，已绑定直接登录；全程不依赖 `web-view`。

## 交付物
- 后端：Prisma 模型更新，`/api/weapp/login` 与 `/api/weapp/bind` 完整实现。
- 前端（小程序）：`pages/index`、`pages/bind`、`utils/request.js` 更新与新增。
- 文档：CONSENSUS、DESIGN、TASK、ACCEPTANCE。

## 兼容性与质量
- 架构与项目现有技术栈一致（Express + Prisma + 小程序）。
- 登录与 Token 签发遵循既有站点规则。

## 后续建议
- 登录成功后跳转到具体业务首页（例如活动列表页）。
- 若后端已支持 `unionid`，优先使用 `unionid` 以支持多个小程序统一身份。
- 完善前端错误文案与异常兜底。