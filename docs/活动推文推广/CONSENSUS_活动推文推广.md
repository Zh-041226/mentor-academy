# 共识文档：活动推文推广功能（宣传图片+链接）

## 需求描述
- 为每个活动新增「推文推广」区域：当同时存在推广链接（promoLinkUrl）与宣传图片（promoImageUrl）时，在活动详情页显示一张可点击的宣传图片，点击后在新标签页打开推广链接（安全：`target="_blank"` + `rel="noopener"`）。
- 管理端允许具备高权限管理员（OWNER_PRIMARY、SUPERVISOR、SUPER_ADMIN）设置推广链接与上传宣传图片；低权限（OWNER_SECONDARY、STAFF）不可设置，若尝试设置后端返回 403。
- 图片上传复用现有接口 `/api/admin/upload/image`，新增 `type=promo`；大小限制沿用海报 10MB；支持 JPEG/PNG/WebP。
- 链接校验：仅允许 `http://` 或 `https://` 开头。

## 验收标准（可测试）
1. 管理端：
   - OWNER_PRIMARY 登录后可见「推文链接」「宣传图片」表单项，能成功保存并在活动详情页展示。
   - OWNER_SECONDARY 与 STAFF 登录后在表单中不显示该字段；若通过非预期方式提交该字段，后端返回 403。
2. 用户端：
   - 活动详情页仅当 `promoLinkUrl` 与 `promoImageUrl` 同时存在时显示推广区；图片点击在新标签页打开链接，且具备 `rel="noopener"`。
   - 图片拥有 `alt`（来自活动标题），在移动端自适应，页面不出现布局错乱。
3. 后端与数据：
   - Prisma 模型包含 `promoLinkUrl`、`promoImageUrl`、`promoImageSizeBytes` 字段；迁移成功，Prisma Client 已生成。
   - `/api/admin/activities` POST/PUT 按权限与校验规则生效。

## 技术实现方案对齐
- 数据模型：在 Activity 模型新增：
  - `promoLinkUrl` String?
  - `promoImageUrl` String?
  - `promoImageSizeBytes` Int?
- 上传接口：`/api/admin/upload/image?type=promo`，大小限制 10MB；返回文件名与大小。
- 管理端：AdminActivities.vue 中：
  - 新增「推文链接」输入（URL 校验），「宣传图片」上传（带预览与大小校验），字段显隐受 `isPromoAllowed` 控制。
- 用户端：ActivityDetail.vue 中：
  - 条件渲染推广区，图片可点击跳转，新标签页，`rel="noopener"`，`alt` 来源于活动标题。
- 权限：后端在创建/更新活动时对上述字段进行权限校验，仅允许高权限设置。

## 边界与约束
- 仅支持单张宣传图片与单个链接。
- 链接不做域名白名单限制（可在后续 TODO 评估）但要求以 `http/https` 开头。
- 图片类型与大小遵循现有上传策略；文件存储沿用 uploads 目录与现有命名策略。

## 不确定性与澄清
- 如需域名白名单或 UTM 追踪参数，可在后续迭代引入；本次先不强制。
- 如需国际化文案，后续统一到 i18n。