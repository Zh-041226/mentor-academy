#!/bin/bash

# 导师进书院系统部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 开始部署导师进书院系统..."

# 配置变量
PROJECT_DIR="/var/www/mentor-academy"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/mentor-academy"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 权限运行此脚本"
    exit 1
fi

# 1. 更新系统包
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 2. 安装必要软件
echo "🔧 安装必要软件..."
apt install -y curl wget git nginx mysql-server

# 3. 安装 Node.js 18.x
echo "📥 安装 Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 4. 安装 PM2
echo "⚙️ 安装 PM2..."
npm install -g pm2

# 5. 创建项目目录
echo "📁 创建项目目录..."
mkdir -p $PROJECT_DIR
mkdir -p /var/log/mentor-academy

# 6. 创建数据库
echo "🗄️ 配置数据库..."
mysql -e "CREATE DATABASE IF NOT EXISTS academy_mentor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'mentor_user'@'localhost' IDENTIFIED BY 'CHANGE_ME';"
mysql -e "GRANT ALL PRIVILEGES ON academy_mentor.* TO 'mentor_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 7. 配置 Nginx
echo "🌐 配置 Nginx..."
cp nginx.conf $NGINX_CONF
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 8. 启用服务
echo "🔄 启用服务..."
systemctl enable nginx
systemctl enable mysql

echo "✅ 基础环境配置完成！"
echo ""
echo "📋 接下来请手动执行以下步骤："
echo "1. 将项目文件上传到 $PROJECT_DIR"
echo "2. 保留并备份线上 uploads 与后端 .env 后，再覆盖代码"
echo "3. 配置环境变量文件 $BACKEND_DIR/.env"
echo "4. 安装依赖并生成 Prisma Client: cd $BACKEND_DIR && npm ci --omit=dev && npm run prisma:generate"
echo "5. 运行数据库迁移: cd $BACKEND_DIR && npm run prisma:deploy"
echo "6. 启动应用: pm2 start $PROJECT_DIR/deploy/ecosystem.config.js"
echo "7. 保存 PM2 配置: pm2 save && pm2 startup"
