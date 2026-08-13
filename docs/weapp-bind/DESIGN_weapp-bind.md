# 设计：小程序原生登录与账号绑定（weapp-bind）

## 架构概览
```mermaid
flowchart LR
  A[WeChat Mini Program] -- wx.login(code) --> B[Backend /api/weapp/login]
  B -- bound -> C[Return JWT]
  A <-- store JWT --- C
  B -- need_bind --> D[Mini Program pages/bind]
  D -- code+studentId+password --> E[Backend /api/weapp/bind]
  E -- bind+JWT --> A
```

## 模块与分层
- 前端（小程序）：
  - `pages/index`：触发登录请求；处理 `token` 或 `need_bind`。
  - `pages/bind`：收集学号与密码并调用绑定接口。
  - `utils/request.js`：请求封装与 JWT 注入。
- 后端（Express + Prisma）：
  - `weapp login` 控制器：`jscode2session`、绑定状态判断、JWT 签发。
  - `weapp bind` 控制器：用户凭据校验、冲突检查、绑定并签发 JWT。
  - Prisma `User`：新增绑定字段以支撑状态判断与审计。

## 接口契约
- `POST /api/weapp/login`
  - 入参：`{ code }`
  - 出参：
    - 已绑定：`{ token, user, expires }`
    - 未绑定：`{ status: 'need_bind' }`
- `POST /api/weapp/bind`
  - 入参：`{ code, studentId, password }`
  - 出参：成功：`{ token, user, expires }`；失败：`{ message }`（4xx/5xx）。

## 数据流向
1. 小程序 `wx.login` 获取 `code`。
2. 服务器 `jscode2session` 获取 `openid/unionid`；查询 `User` 的绑定字段。
3. 已绑定：签发站点 JWT。
4. 未绑定：前端跳转绑定页，提交学号/密码；后端绑定 `openid/unionid` 并签发 JWT。

## 异常处理策略
- 登录失败：提示“登录失败，请重试”。
- 网络异常：提示“网络错误，请稍后重试”。
- 绑定失败：展示后端返回 `message`；无具体信息则提示“绑定失败，请稍后重试”。
- 冲突绑定：若学号已绑定至他人或 openid 已绑定至其他账号，返回 409 并给出明确文案。