# 导师进书院系统（mentor-academy）

> 一个面向书院活动的报名与管理平台：学生可在 Web 端 / 微信小程序端浏览、报名、收藏活动，管理员可发布活动、审核报名、管理海报与公告，并查看数据看板。

线上站点：<https://cdsyzh.cn>

---

## ✨ 功能特性

### 学生端
- 活动浏览与分类筛选、活动详情（海报、二维码、推广链接）
- 活动报名 / 取消报名，报名审核状态查询
- 收藏活动、查看我的报名记录
- 微信小程序端绑定账号（SSO 免登录）

### 管理端（后台）
- 活动管理：发布 / 编辑 / 下架活动，设置报名截止、人数上限、分类、海报、QQ 群二维码、推广链接与宣传图
- 报名管理：审核（通过 / 拒绝 + 原因）、签到、标记爽约、禁报名期
- 用户管理：学生与管理员账号，五级权限体系（超级管理员 / 主管老师 / 第一负责人 / 第二负责人 / 普通干事）
- 海报管理：主海报与轮播海报（仅超级管理员）
- 公告管理：支持分类（讲座沙龙 / 成长团辅 / 主题活动 / “三园五感”品牌特色活动）
- 班级管理：班级导入与维护
- 数据看板：报名、活动、用户等统计图表（ECharts）
- 名单导出：报名名单导出为 Excel

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js · Express · Prisma ORM · MySQL 8 |
| 鉴权 | JWT（jsonwebtoken）· bcryptjs |
| 上传/图片 | multer · sharp（缩略图生成） |
| 前端 | Vue 3 · Vite · Element Plus · ECharts · Vue Router · Axios |
| 小程序 | 微信小程序（原生） |
| 部署 | Nginx · PM2 · Let's Encrypt（HTTPS） |

---

## 📁 项目结构

```
mentor-academy/
├── backend/            # 后端服务（Express + Prisma）
│   ├── src/            # 业务代码（server.js 等）
│   ├── prisma/         # schema.prisma + migrations
│   ├── uploads/        # 上传文件（海报/二维码/宣传图）
│   └── .env.example    # 环境变量示例
├── frontend/           # Web 前端（Vue 3 + Vite）
│   └── src/            # 页面、组件、路由、请求封装
├── WeChatProject/      # 微信小程序端
├── deploy/             # 部署脚本、Nginx 配置、PM2 配置
├── docs/               # 设计文档、验收文档、问题诊断指南
└── logo/               # Logo 与图片资源
```

---

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18
- MySQL 8
- npm

### 1. 初始化数据库

```sql
CREATE DATABASE academy_mentor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入数据库连接与 JWT 密钥
npm install
npx prisma migrate deploy   # 应用数据库迁移
npx prisma generate
npm run seed:admins         # （可选）初始化管理员账号
npm run dev                 # 启动开发服务（默认 3001 端口）
```

`.env` 示例：

```env
PORT=3001
JWT_SECRET=请替换为强随机密钥
DATABASE_URL=mysql://user:password@localhost:3306/academy_mentor

# 微信小程序（可选）
WECHAT_APPID=
WECHAT_SECRET=
WEAPP_SSO_TICKET_TTL_MINUTES=10
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev   # 开发环境（Vite，走 /api 同源代理）
```

### 4. 微信小程序

用微信开发者工具打开 `WeChatProject/` 目录，在 `project.config.json` 中填入你的 AppID。

---

## 📦 部署

生产环境部署脚本见 `deploy/` 目录（Nginx 反向代理 + PM2 进程守护）：

```bash
cd deploy
# 参考 cdsyzh-deploy.sh / deploy.sh 及同名部署指南
```

核心步骤：安装依赖 → 应用迁移 → `pm2 start ecosystem.config.js` → 配置 Nginx → （可选）Let's Encrypt 签发 HTTPS 证书。

---

## 🔐 说明

- 仓库中**不含任何真实密钥**：`.env` 未提交（仅保留 `.env.example` 模板），上传的图片、含服务器凭据的调试脚本均已通过 `.gitignore` 排除。
- 管理员初始账号由 `backend/src/scripts/seed_admins.js` 生成，密码以占位符形式存在，部署前请自行修改。
- 前端构建产物 `dist/` 与 `node_modules/` 未纳入版本管理。

---

## 📄 License

MIT
