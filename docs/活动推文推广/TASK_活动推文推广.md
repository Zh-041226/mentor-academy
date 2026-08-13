# 任务拆分文档：活动推文推广功能

## 原子任务清单

### T1. 扩展数据模型与迁移
- 输入契约：现有 Prisma schema，MySQL 环境
- 输出契约：Activity 增加 `promoLinkUrl`、`promoImageUrl`、`promoImageSizeBytes`；迁移成功；Prisma Client 可用
- 实现约束：兼容现有版本；字段为可选；不破坏既有逻辑
- 依赖关系：后续后端接口与前端表单依赖此模型

### T2. 后端上传接口支持 type=promo
- 输入契约：`multipart/form-data`、type=promo、图片文件
- 输出契约：返回 `{ filename, size }`
- 实现约束：大小 ≤ 10MB；仅允许 JPEG/PNG/WebP；沿用现有存储策略
- 依赖关系：前端 AdminActivities 上传预览依赖

### T3. 后端活动创建/更新权限与校验
- 输入契约：POST/PUT `/api/admin/activities`；携带 promo 字段
- 输出契约：权限允许则写入；权限不允许返回 403；URL 非法返回 400
- 实现约束：角色仅 OWNER_PRIMARY、SUPERVISOR、SUPER_ADMIN 可设置；校验 `http/https` 链接
- 依赖关系：前端表单提交与用户端展示的基础

### T4. 前端管理端表单与上传
- 输入契约：管理员登录态、RBAC、Axios 层 `getAuthHeaders()`
- 输出契约：表单带 URL 校验与图片上传预览；提交包含必要字段
- 实现约束：字段显隐依权限；UI 一致；使用现有组件与风格
- 依赖关系：后端接口与模型

### T5. 用户端详情展示推广区
- 输入契约：GET `/api/activities/:id` 返回包含 promo 字段
- 输出契约：仅当同时存在 `promoLinkUrl` 与 `promoImageUrl` 时显示推广区；图片可点击新标签打开；安全属性 `rel="noopener"`；`alt` 来自标题
- 实现约束：移动端自适应；与现有详情页样式一致
- 依赖关系：后端接口与模型

### T6. QA 验证
- 输入契约：种子管理员账号、已运行的前后端服务器
- 输出契约：权限与展示行为均符合验收标准；实际操作无异常
- 实现约束：不修改生产数据；在开发环境验证
- 依赖关系：前端/后端已完成

## 状态汇总
- T1～T5：已完成
- T6：进行中（待人工登录与交互验证）