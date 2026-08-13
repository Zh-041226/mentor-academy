# 公告功能设计

## 总体方案

采用“前后台一体”的公告模块：
- 后台：公告管理页，负责增删改查、附件上传、发布状态控制。
- 前台：公告列表页，展示已发布公告，并支持登录后下载附件。
- 后端：公告表 + 管理接口 + 公共列表接口 + 受控下载接口。

## 数据模型

公告表建议字段：
- id
- title
- summary
- content
- published
- publishedAt
- attachmentPath
- attachmentOriginalName
- attachmentMimeType
- attachmentSizeBytes
- createdAt
- updatedAt

## 接口设计

### 管理端
- GET `/api/admin/announcements`
- POST `/api/admin/announcements`
- PUT `/api/admin/announcements/:id`
- DELETE `/api/admin/announcements/:id`
- POST `/api/admin/upload/document?type=announcement`

### 前台
- GET `/api/announcements`
- GET `/api/announcements/:id`
- GET `/api/announcements/:id/download`（需登录）

## 权限设计

- 管理接口：`auth + adminAuth`。
- 下载接口：仅要求登录。
- 公共列表/详情：仅返回已发布公告。

## 前端页面

### 前台公告页
- 列表模式展示标题、发布时间、摘要、附件信息。
- 点击进入详情或直接下载。
- 未登录点击下载时跳转登录。

### 后台公告管理页
- 统一使用现有 admin 页面头、工具栏、表格与对话框风格。
- 支持新增、编辑、删除、发布/草稿切换。
- 附件上传仅允许公告文档类型。

## 风险控制

- 附件存放到受控目录，不复用公开 `/uploads` 静态访问。
- 若数据库尚未迁移，需先更新 Prisma schema 并执行迁移/同步。
