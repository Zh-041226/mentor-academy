# 导师进书院系统（Web 端）环境与工具说明

本文基于项目实际代码与部署配置整理，且不包括微信小程序部分。

## 开发的硬件环境

- 开发机：4 核 CPU，≥8GB 内存，≥50GB SSD
- 网络：稳定的宽带网络（建议 ≥20Mbps）

## 运行的硬件环境

- 服务器：2 核 CPU，≥4GB 内存，≥40GB SSD；带宽 ≥5Mbps（deploy/README.md:5-10）

## 开发该软件的操作系统

- Windows 11 64 位（本地开发环境）

## 软件开发环境 / 开发工具

- 编辑器：Visual Studio Code
- 运行时与包管理：Node.js ≥ 18、npm（backend/package.json:5-13）
- 前端框架与构建：Vue 3、Vite（frontend/package.json:7-23）
- UI 组件与图表：Element Plus、ECharts（frontend/package.json:11-19）
- ORM 与数据库工具：Prisma（backend/package.json:14-24；backend/prisma/schema.prisma:5-8）
- 版本管理：Git

## 该软件的运行平台 / 操作系统

- Linux（Ubuntu 20.04+ 等），Nginx 反向代理 + PM2 管理 Node 服务（deploy/README.md:10-16；deploy/nginx.conf:1-39；deploy/ecosystem.config.js:1-18）

## 软件运行支撑环境 / 支持软件

- Node.js ≥ 18（后端运行时）
- Nginx（静态资源与反向代理）（deploy/nginx.conf:1-39）
- PM2（进程守护与开机自启）（deploy/ecosystem.config.js:1-18）
- MySQL 8（业务数据库）（backend/prisma/schema.prisma:5-8；deploy/.env.production:10-12）
- OpenSSL / Let’s Encrypt（HTTPS 证书，可选）（deploy/README.md:151-155）

## 编程语言

- 后端：JavaScript（Node.js，ES Modules；backend/src/server.js）
- 前端：JavaScript（Vue 3 单文件组件）、HTML、CSS（frontend/src/\*\*）
