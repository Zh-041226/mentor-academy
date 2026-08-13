# 海报设置功能设计

## 系统架构与数据流

```mermaid
flowchart LR
  AdminPoster[前端: AdminPoster.vue]\n(仅梦碎怜云) -->|上传图片| UploadAPI[/api/admin/upload/image]
  AdminPoster -->|设置主海报| HeroMainSet[/api/admin/hero/main POST]
  AdminPoster -->|读取主海报| HeroMainGet[/api/admin/hero/main GET]
  HomeHero[前端: HomeHeroCarousel.vue] -->|拉取轮播| HeroSlides[/api/hero-slides]
  HeroSlides -->|合成列表|[主海报 + hero目录图片]
```

## 分层设计与核心组件

- 前端视图：AdminPoster.vue（上传、预览、清除、权限提示）
- 前端组件：HomeHeroCarousel.vue（默认本地→尝试后端→成功则替换）
- 后端接口：
  - GET /api/admin/hero/main（鉴权：仅梦碎怜云）
  - POST /api/admin/hero/main（鉴权：仅梦碎怜云；body.url 为空表示清除）
  - GET /api/hero-slides（读取主海报配置并合成 hero 目录图片列表）

## 接口契约

- POST /api/admin/hero/main
  - 请求：{ url: string } 或 {}
  - 响应：{ message: string, url?: string }
  - 约束：url 必须以 /uploads/ 开头且文件存在

- GET /api/admin/hero/main
  - 响应：{ url: string }
  - 约束：仅梦碎怜云可调用

- GET /api/hero-slides
  - 响应：{ items: Array<{ src: string, alt: string }> }
  - 规则：若设定主海报，主海报排第一；否则返回 hero 目录图片；若无图片则兜底为 /logo/background.png

## 异常处理策略

- 前端上传失败/设置失败：Element Plus message 警告提示；保留当前主海报状态。
- 后端校验失败：返回 400/403；日志记录具体错误。
- 读取失败：后端兜底返回默认背景图；前端保留默认本地海报。