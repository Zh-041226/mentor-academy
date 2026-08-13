#!/bin/bash

# 导师进书院系统部署脚本 - cdsyzh.cn
# 服务器IP: 121.41.168.208
# 域名: cdsyzh.cn
# 使用方法: chmod +x cdsyzh-deploy.sh && ./cdsyzh-deploy.sh

set -e

echo "🚀 开始部署导师进书院系统到 cdsyzh.cn..."

# 配置变量
PROJECT_DIR="/var/www/mentor-academy"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/mentor-academy"
DOMAIN="cdsyzh.cn"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 权限运行此脚本"
    exit 1
fi

echo "📋 服务器信息:"
echo "   - 公网IP: 121.41.168.208"
echo "   - 域名: $DOMAIN"
echo "   - 项目目录: $PROJECT_DIR"
echo ""

# 1. 更新系统包
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 2. 安装必要软件
echo "🔧 安装必要软件..."
apt install -y curl wget git nginx mysql-server ufw htop

# 3. 配置防火墙
echo "🔒 配置防火墙..."
ufw --force enable
ufw allow ssh
ufw allow http
ufw allow https
ufw status

# 4. 安装 Node.js 18.x
echo "📥 安装 Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 5. 安装 PM2
echo "⚙️ 安装 PM2..."
npm install -g pm2

# 6. 创建项目目录
echo "📁 创建项目目录..."
mkdir -p $PROJECT_DIR
mkdir -p /var/log/mentor-academy
chown -R www-data:www-data $PROJECT_DIR

# 7. 配置数据库
echo "🗄️ 配置数据库..."
mysql -e "CREATE DATABASE IF NOT EXISTS academy_mentor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'mentor_user'@'localhost' IDENTIFIED BY 'CHANGE_ME';"
mysql -e "GRANT ALL PRIVILEGES ON academy_mentor.* TO 'mentor_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 8. 配置 Nginx
echo "🌐 配置 Nginx..."
cp nginx.conf $NGINX_CONF
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 9. 启用服务
echo "🔄 启用服务..."
systemctl enable nginx
systemctl enable mysql

# 10. 检查域名解析
echo "🔍 检查域名解析..."
if nslookup $DOMAIN | grep -q "121.41.168.208"; then
    echo "✅ 域名解析正确"
else
    echo "⚠️  域名解析可能还未生效，请稍后再试"
fi

echo ""
echo "✅ 基础环境配置完成！"
echo ""
echo "📋 接下来请按以下步骤操作："
echo ""
echo "1️⃣ 上传项目文件到服务器："
echo "   scp -r backend/ root@121.41.168.208:/var/www/mentor-academy/"
echo "   scp -r frontend/dist/ root@121.41.168.208:/var/www/mentor-academy/frontend/"
echo ""
echo "2️⃣ 配置后端环境："
echo "   cd $BACKEND_DIR"
echo "   cp /root/deploy/.env.production .env"
echo "   # 先备份并保留旧的 .env 与 uploads 目录"
echo "   npm ci --omit=dev"
echo "   npm run prisma:generate"
echo "   npm run prisma:deploy"
echo ""
echo "3️⃣ 启动应用："
echo "   pm2 start /var/www/mentor-academy/deploy/ecosystem.config.js"
echo "   pm2 save && pm2 startup"
echo ""
echo "4️⃣ 配置SSL证书（推荐）："
echo "   apt install certbot python3-certbot-nginx"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "🌐 完成后访问: http://$DOMAIN"
echo "🔒 配置SSL后访问: https://$DOMAIN"
