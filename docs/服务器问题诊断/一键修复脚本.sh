#!/bin/bash

# 导师进书院系统 - 一键修复脚本
# 使用方法: chmod +x 一键修复脚本.sh && sudo ./一键修复脚本.sh

echo "🚀 导师进书院系统 - 一键修复脚本"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径配置
PROJECT_PATH="/var/www/mentor-academy"
BACKEND_PATH="$PROJECT_PATH/backend"
FRONTEND_PATH="$PROJECT_PATH/frontend"
UPLOADS_PATH="$BACKEND_PATH/uploads"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用sudo权限运行此脚本${NC}"
    echo "使用方法: sudo ./一键修复脚本.sh"
    exit 1
fi

echo -e "${BLUE}🔍 开始系统修复...${NC}"
echo ""

# 1. 检查项目目录
echo -e "${YELLOW}📁 检查项目目录...${NC}"
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}❌ 项目目录不存在: $PROJECT_PATH${NC}"
    echo "请确认项目是否正确部署"
    exit 1
fi
echo -e "${GREEN}✅ 项目目录存在${NC}"

# 2. 创建必要目录
echo -e "${YELLOW}📂 创建必要目录...${NC}"
mkdir -p "$UPLOADS_PATH"
mkdir -p "$BACKEND_PATH/logs"
echo -e "${GREEN}✅ 目录创建完成${NC}"

# 3. 修复文件权限
echo -e "${YELLOW}🔐 修复文件权限...${NC}"

# 设置项目根目录权限
chown -R www-data:www-data "$PROJECT_PATH"
chmod -R 755 "$PROJECT_PATH"

# 设置uploads目录特殊权限
chown -R www-data:www-data "$UPLOADS_PATH"
chmod -R 777 "$UPLOADS_PATH"

# 设置前端构建文件权限
if [ -d "$FRONTEND_PATH" ]; then
    chown -R www-data:www-data "$FRONTEND_PATH"
    chmod -R 755 "$FRONTEND_PATH"
fi

echo -e "${GREEN}✅ 文件权限修复完成${NC}"

# 4. 检查和修复环境变量
echo -e "${YELLOW}🔧 检查环境变量配置...${NC}"
ENV_FILE="$BACKEND_PATH/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env文件不存在，创建默认配置...${NC}"
    cat > "$ENV_FILE" << 'EOF'
# 生产环境配置
PORT=3001
JWT_SECRET=cdsyzh-mentor-academy-jwt-secret-2025-change-me
DATABASE_URL=mysql://mentor_user:CHANGE_ME@localhost:3306/academy_mentor
UPLOAD_PATH=/var/www/mentor-academy/backend/uploads
CORS_ORIGIN=https://cdsyzh.cn
EOF
    chown www-data:www-data "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo -e "${GREEN}✅ .env文件已创建${NC}"
else
    echo -e "${GREEN}✅ .env文件存在${NC}"
fi

# 5. 检查Node.js和npm
echo -e "${YELLOW}📦 检查Node.js环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js未安装，正在安装...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm未安装${NC}"
    exit 1
fi

echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"
echo -e "${GREEN}✅ Node.js环境正常${NC}"

# 6. 安装/更新依赖
echo -e "${YELLOW}📥 检查项目依赖...${NC}"
if [ -f "$BACKEND_PATH/package.json" ]; then
    cd "$BACKEND_PATH"
    echo "安装后端依赖..."
    npm install --production
    echo -e "${GREEN}✅ 后端依赖安装完成${NC}"
else
    echo -e "${RED}❌ 后端package.json不存在${NC}"
fi

# 7. 检查和配置PM2
echo -e "${YELLOW}🔄 检查PM2配置...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安装，正在安装...${NC}"
    npm install -g pm2
fi

# 停止现有进程
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 启动后端服务
if [ -f "$BACKEND_PATH/src/server.js" ]; then
    cd "$BACKEND_PATH"
    pm2 start src/server.js --name "mentor-academy-backend" --env production
    echo -e "${GREEN}✅ 后端服务已启动${NC}"
else
    echo -e "${RED}❌ 后端服务文件不存在${NC}"
fi

# 保存PM2配置
pm2 save
pm2 startup

echo -e "${GREEN}✅ PM2配置完成${NC}"

# 8. 检查和配置Nginx
echo -e "${YELLOW}🌐 检查Nginx配置...${NC}"

# 检查Nginx是否安装
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}⚠️  Nginx未安装，正在安装...${NC}"
    apt-get update
    apt-get install -y nginx
fi

# 创建Nginx配置
NGINX_CONFIG="/etc/nginx/sites-available/mentor-academy"
cat > "$NGINX_CONFIG" << 'EOF'
server {
    listen 80;
    server_name cdsyzh.cn www.cdsyzh.cn;
    
    # 前端静态文件
    location / {
        root /var/www/mentor-academy/frontend;
        try_files $uri $uri/ /index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API 代理到后端
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 文件上传大小限制
        client_max_body_size 10M;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # 上传文件访问
    location /uploads/ {
        alias /var/www/mentor-academy/backend/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
EOF

# 启用站点配置
ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/mentor-academy

# 删除默认配置（如果存在）
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置正确${NC}"
    systemctl enable nginx
    systemctl restart nginx
else
    echo -e "${RED}❌ Nginx配置错误${NC}"
    nginx -t
fi

# 9. 检查数据库连接
echo -e "${YELLOW}🗄️  检查数据库连接...${NC}"
if command -v mysql &> /dev/null; then
    # 尝试连接数据库
    if mysql -u mentor_user -pCHANGE_ME -h localhost academy_mentor -e "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}✅ 数据库连接正常${NC}"
    else
        echo -e "${YELLOW}⚠️  数据库连接失败，请检查数据库配置${NC}"
        echo "请确认:"
        echo "1. MySQL服务是否运行: systemctl status mysql"
        echo "2. 数据库用户是否存在: mysql -u root -p"
        echo "3. 数据库是否存在: SHOW DATABASES;"
    fi
else
    echo -e "${YELLOW}⚠️  MySQL客户端未安装${NC}"
fi

# 10. 清理和优化
echo -e "${YELLOW}🧹 系统清理和优化...${NC}"

# 清理npm缓存
npm cache clean --force 2>/dev/null || true

# 清理系统缓存
apt-get autoremove -y 2>/dev/null || true
apt-get autoclean 2>/dev/null || true

# 设置日志轮转
cat > /etc/logrotate.d/mentor-academy << 'EOF'
/var/www/mentor-academy/backend/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

echo -e "${GREEN}✅ 系统清理完成${NC}"

# 11. 最终检查
echo -e "${YELLOW}🔍 最终系统检查...${NC}"

# 检查服务状态
echo "服务状态检查:"
echo "- Nginx: $(systemctl is-active nginx)"
echo "- PM2进程:"
pm2 status

# 检查端口占用
echo ""
echo "端口占用检查:"
echo "- 端口3001 (后端): $(netstat -tlnp 2>/dev/null | grep :3001 | wc -l) 个进程"
echo "- 端口80 (HTTP): $(netstat -tlnp 2>/dev/null | grep :80 | wc -l) 个进程"

# 检查磁盘空间
echo ""
echo "磁盘空间:"
df -h / | tail -1

# 测试API连接
echo ""
echo "API连接测试:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/hero-slides | grep -q "200"; then
    echo -e "${GREEN}✅ 后端API响应正常${NC}"
else
    echo -e "${YELLOW}⚠️  后端API无响应，请检查日志${NC}"
fi

# 12. 生成状态报告
echo ""
echo -e "${BLUE}📋 修复完成报告${NC}"
echo "========================================"
echo "修复时间: $(date)"
echo "项目路径: $PROJECT_PATH"
echo "上传目录: $UPLOADS_PATH"
echo "配置文件: $ENV_FILE"
echo ""

# 检查关键文件
echo "关键文件检查:"
[ -f "$ENV_FILE" ] && echo -e "${GREEN}✅ 环境变量配置${NC}" || echo -e "${RED}❌ 环境变量配置${NC}"
[ -d "$UPLOADS_PATH" ] && echo -e "${GREEN}✅ 上传目录${NC}" || echo -e "${RED}❌ 上传目录${NC}"
[ -f "$NGINX_CONFIG" ] && echo -e "${GREEN}✅ Nginx配置${NC}" || echo -e "${RED}❌ Nginx配置${NC}"

echo ""
echo -e "${GREEN}🎉 系统修复完成！${NC}"
echo ""
echo -e "${BLUE}📝 后续建议:${NC}"
echo "1. 访问网站测试功能是否正常"
echo "2. 检查PM2日志: pm2 logs"
echo "3. 检查Nginx日志: tail -f /var/log/nginx/error.log"
echo "4. 如有问题，运行诊断脚本获取详细信息"
echo ""
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo "- 请修改.env文件中的JWT_SECRET为更安全的密钥"
echo "- 建议配置SSL证书启用HTTPS"
echo "- 定期备份数据库和上传文件"
echo ""
echo "========================================"