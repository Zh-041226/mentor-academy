# 海报设置任务拆分

## 原子任务

1. 后端：实现主海报管理接口
   - 输入：JWT 鉴权、adminLevel=MENGSUILIANYUN、body.url
   - 输出：uploads/hero-main.json、接口响应
   - 约束：仅 /uploads/ 路径、文件必须存在

2. 后端：修改 /api/hero-slides 列表合成逻辑
   - 输入：uploads/hero-main.json、hero 目录
   - 输出：items 列表（主海报优先）

3. 前端：新增 AdminPoster.vue
   - 输入：管理员等级、上传文件、主海报 url
   - 输出：设置与清除操作、预览展示

4. 前端：菜单与路由
   - 输入：AdminLayout.vue、router/index.js
   - 输出：仅梦碎怜云显示入口、/admin/poster 路由

5. 前端：HomeHeroCarousel 优化
   - 输入：默认本地 slides、后端接口
   - 输出：成功请求后替换为后端列表，失败保留默认

6. 验证与预览
   - 输入：本地 dev 环境、账号权限
   - 输出：功能验证记录与结论