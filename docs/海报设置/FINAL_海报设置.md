# 海报设置最终交付

## 实现概述

- 新增 AdminPoster.vue 与 /admin/poster 路由、菜单入口（仅梦碎怜云）
- 新增 /api/admin/hero/main（GET/POST）用于读取与设置主海报
- 修改 /api/hero-slides 将主海报置于第一项，并保留原有兜底逻辑
- 优化 HomeHeroCarousel 在开发环境也尝试拉取后端列表

## 兼容性与规范

- 与现有 Vue 3/Element Plus/Vite 架构一致；保持统一的上传与鉴权模式
- 不引入新依赖；代码风格与项目一致

## 后续建议

- 增加图片裁剪与压缩以降低体积
- 支持主海报的有效期与定时轮换
- 在管理员日志中记录主海报变更历史