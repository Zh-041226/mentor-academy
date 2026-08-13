# 登录联调与部署验证（ACCEPTANCE）

本验收文档用于验证“用户登录”“活动报名/取消”“我的报名”“管理员考勤标记”等关键接口在本地与生产环境的正确性与一致性，确保不出现 500 异常并返回统一的 JSON 结构。

## 目标与范围

- 验证用户端登录、活动报名、取消、我的报名接口行为与返回结构。
- 验证管理端登录与出勤标记（attended/noShow）行为与返回结构。
- 验证错误场景的统一返回：`{ code, message }`。

## 环境

- 本地后端地址：`http://localhost:3001`
- 生产后端地址：`https://cdsyzh.cn`
- 依赖环境变量：`DATABASE_URL`、`JWT_SECRET`

## 验收步骤（顺序）

- 用户登录获取用户 JWT token。
- 拉取活动列表并选择可报名的活动。
- 进行报名，验证成功返回与重复报名冲突返回。
- 查看“我的报名”，确认包含刚报名的记录。
- 发起取消申请（提供 5–200 字的取消事由），验证成功返回。
- 管理员登录获取管理端 JWT token。
- 管理员对报名记录进行出勤标记（attended 或 noShow），验证成功返回；noShow 触发禁报名逻辑并返回 `ban` 信息。
- 验证错误场景的统一返回（403/409/400 等）。

## curl 用例（本地示例，生产将域名替换为 `https://cdsyzh.cn`）

> 提示：Windows PowerShell 可使用 `Invoke-RestMethod`，文档示例采用通用 `curl`。

### 1. 用户登录获取 token

```
curl -sS -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<学号>","password":"<密码>"}'
```

预期：返回 `{"token":"<JWT>"}`。

### 2. 获取活动列表，选择活动 ID

```
curl -sS http://localhost:3001/api/activities
```

预期：返回包含活动数组（至少一个活动），选择其中的 `id` 供后续使用。

### 3. 活动报名

```
curl -sS -X POST http://localhost:3001/api/activities/<activityId>/register \
  -H "Authorization: Bearer <USER_TOKEN>"
```

预期：返回 `{"message":"报名成功","registrationId":<id>}`。

重复报名验证：再次执行上述命令，预期返回 `409`：

```
{"code":"ALREADY_REGISTERED","message":"你已报名该活动，无需重复报名"}
```

报名截止/活动已结束/名额已满的错误场景（基于活动数据状态）：

- 报名截止：`{"code":"REGISTRATION_DEADLINE_PASSED","message":"报名已截止"}`
- 活动关闭或已结束：`{"code":"REGISTRATION_CLOSED","message":"当前活动已关闭报名或已结束"}`
- 名额已满：`{"code":"REGISTRATION_FULL","message":"名额已满，无法报名"}`

### 4. 我的报名列表

```
curl -sS -X GET http://localhost:3001/api/users/me/registrations \
  -H "Authorization: Bearer <USER_TOKEN>"
```

预期：返回数组，包含刚报名的记录；过滤状态为 `REGISTERED`、`PENDING_CANCEL`、`CANCELED`。

### 5. 取消报名（需填写 5–200 字取消事由）

```
curl -sS -X POST http://localhost:3001/api/activities/<activityId>/cancel \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"临时有课，无法参加"}'
```

预期：返回 `{"message":"已提交取消申请，待管理员审核","registrationId":<id>}`。
重复取消或未报名：预期返回 `409`，包含 `CONFLICT` 与对应文案。

### 6. 管理员登录获取 token

```
curl -sS -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<管理员用户名或学号>","password":"<密码>","level":"普通干事"}'
```

预期：返回 `{"token":"<JWT>"}`。`level` 支持中文等级映射：`梦碎怜云/主管老师/第一负责人/第二负责人/普通干事`。

### 7. 管理员出勤标记（已到）

```
curl -sS -X POST http://localhost:3001/api/admin/activities/<activityId>/registrations/<registrationId>/attendance \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"attended":true}'
```

预期：返回 `{"message":"标记成功","registration":{"id":<id>,"attended":true,"noShow":false,"markedAt":"..."}}`。

### 8. 管理员出勤标记（未到）并自动禁报名

```
curl -sS -X POST http://localhost:3001/api/admin/activities/<activityId>/registrations/<registrationId>/attendance \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"noShow":true}'
```

预期：返回 `{"message":"标记成功","registration":{"noShow":true,...},"ban":{"id":<userId>,"bannedUntil":"...","bannedCount":<n>}}`。

## 错误返回结构验收

- 统一为 JSON：`{"code":"<ERROR_CODE>","message":"<描述>"}`。
- 常见错误码示例：
  - `VALIDATION_ERROR`：参数校验失败（如取消事由长度非法）。
  - `UNAUTHORIZED`：登录凭证错误或未登录。
  - `FORBIDDEN`：非管理员或账号处于禁报名期。
  - `NOT_FOUND`：活动或用户不存在。
  - `CONFLICT`：业务冲突（重复取消、尚未报名）。
  - `REGISTRATION_CLOSED/REGISTRATION_FULL/REGISTRATION_DEADLINE_PASSED`：报名不可用。
  - `SERVER_ERROR`：后端异常，需查看日志定位。

## 通过标准

- 所有步骤返回码与内容符合预期，无 500 异常。
- 本地与生产行为一致，数据库字段对齐（含 `attended/noShow/markedAt` 与 `reviewNote`）。
- 用户与管理员登录均可获取 token，受限接口需携带 `Authorization: Bearer <token>`。

## 备注

- 若在生产环境复验时出现异常，请先通过 `pm2 logs mentor-academy-backend` 检查最新日志，并对照上游 Prisma 模型与数据表结构是否一致。

## 完成情况记录

- [x] 后端服务已在本地 3001 正常启动（npm run start），/api/health 返回 { ok: true }。
- [x] 管理员 API 端到端验证成功（POST /api/admin/auth/login → 200，获取 token；GET /api/users/me → ADMIN/MENGSUILIANYUN）。
- [x] 学生 API 端到端验证成功（POST /api/auth/login → 200，获取 token；GET /api/users/me → STUDENT/null）。
- [ ] 开发环境前端 UI 管理员登录验证（/admin/login → 跳转 /admin/dashboard）。
- [ ] 开发环境前端 UI 学生登录验证（/login → 跳转 /activities）。
- [ ] 生产环境同源代理验证（Nginx /api → 3001，登录成功）。

## 验收结论（将根据联调结果持续更新）

- 当前：后端与 API 认证链路已验证；等待前端 UI 登录与生产同源代理验证结果。
