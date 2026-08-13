# 验收记录：活动推文推广功能

## 执行环境
- Backend: Express + Prisma（MySQL），开发服务器运行于 http://localhost:3001
- Frontend: Vite，开发服务器运行于 http://localhost:5173/ （另有 5174/5175/5177 并行端口）

## 验收检查清单
- [x] 数据模型与迁移已应用，Prisma Client 已生成
- [x] 上传接口支持 `type=promo`，10MB 限制生效
- [x] 后端接口 POST/PUT `/api/admin/activities` 权限与 URL 校验生效
- [x] 管理端表单新增并受权限显隐控制
- [x] 用户端详情页按需显示推广区，安全跳转新标签页
- [ ] 角色验证：OWNER_PRIMARY 可设置/保存；OWNER_SECONDARY、STAFF 不可设置且 403（待人工登录验证）
- [ ] 真实活动数据展示与移动端适配（待人工验证）

## 操作步骤（建议）
1. 使用 OWNER_PRIMARY 账号登录管理端（AdminLogin.vue 对应的 /admin/login）：
   - 例如：选择「第一负责人」，用户名 `admin3`，密码 `CHANGE_ME`（参考 seed_admins.js）。
2. 进入「活动管理」，创建或编辑活动：
   - 填写推文链接（需以 http/https 开头，如 `https://example.com/post`）。
   - 上传宣传图片（≤10MB），预览确认。
   - 提交保存并查看活动详情页，验证推广区显示与跳转行为。
3. 使用 OWNER_SECONDARY 与 STAFF 账号重复上述操作：
   - 表单中不显示相关字段；若强制提交，后端返回 403。
4. 在移动端或窄屏模拟下查看活动详情，验证图片自适应与布局稳定性。

## 结果记录
- 日期：待填写
- 验收人：待填写
- 结论：待填写
- 发现问题与改进建议：待填写