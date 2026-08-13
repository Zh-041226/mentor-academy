# 导师进书院系统 - 轻量化服务器部署指南

## 服务器要求

### 最低配置
- **CPU**: 1核心
- **内存**: 2GB RAM（推荐 4GB）
- **存储**: 20GB SSD（推荐 40GB）
- **带宽**: 1Mbps（推荐 5Mbps）
- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+

### 推荐云服务商
- 阿里云轻量应用服务器（2核4G）
- 腾讯云轻量应用服务器（2核4G）
- 华为云云耀云服务器（2核4G）

## 部署步骤

### 1. 准备服务器环境

```bash
# 连接到服务器
ssh root@your-server-ip

# 上传部署文件到服务器
scp -r deploy/ root@your-server-ip:/root/
```

### 2. 运行自动化部署脚本

```bash
cd /root/deploy
chmod +x deploy.sh
./deploy.sh
```

### 3. 上传项目文件

将项目文件上传到服务器：

```bash
# 方法1: 使用 scp
scp -r backend/ root@your-server-ip:/var/www/mentor-academy/
scp -r frontend/dist/ root@your-server-ip:/var/www/mentor-academy/frontend/

# 方法2: 使用 Git（推荐）
cd /var/www/mentor-academy
git clone https://github.com/your-username/mentor-academy.git .
```

### 4. 配置后端环境

```bash
cd /var/www/mentor-academy/backend

# 复制并编辑环境配置
cp /root/deploy/.env.production .env
nano .env  # 修改配置信息

# 安装依赖
npm install --production

# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 创建管理员账户（可选）
npm run seed:admins
```

### 5. 构建并部署前端

```bash
cd /var/www/mentor-academy/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 复制构建文件到 Nginx 目录
cp -r dist/* /var/www/mentor-academy/frontend/
```

### 6. 启动应用

```bash
# 复制 PM2 配置
cp /root/deploy/ecosystem.config.js /var/www/mentor-academy/

# 启动后端服务
cd /var/www/mentor-academy
pm2 start ecosystem.config.js

# 保存 PM2 配置并设置开机自启
pm2 save
pm2 startup
```

### 7. 配置域名（可选）

如果您有域名，请：

1. 将域名解析到服务器IP
2. 修改 `/etc/nginx/sites-available/mentor-academy` 中的 `server_name`
3. 重启 Nginx：`systemctl reload nginx`

## 常用管理命令

### PM2 进程管理
```bash
pm2 list                # 查看进程状态
pm2 restart all         # 重启所有进程
pm2 stop all           # 停止所有进程
pm2 logs               # 查看日志
pm2 monit              # 监控面板
```

### Nginx 管理
```bash
systemctl status nginx  # 查看状态
systemctl reload nginx  # 重新加载配置
nginx -t               # 测试配置文件
```

### 数据库管理
```bash
mysql -u mentor_user -p academy_mentor  # 连接数据库
mysqldump -u mentor_user -p academy_mentor > backup.sql  # 备份数据库
```

## 安全建议

1. **防火墙配置**
```bash
ufw enable
ufw allow ssh
ufw allow http
ufw allow https
```

2. **定期更新**
```bash
apt update && apt upgrade -y
npm update
```

3. **SSL证书**（推荐使用 Let's Encrypt）
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

4. **数据库安全**
```bash
mysql_secure_installation
```

## 故障排除

### 常见问题

1. **端口被占用**
```bash
lsof -i :3001  # 查看端口占用
```

2. **权限问题**
```bash
chown -R www-data:www-data /var/www/mentor-academy
chmod -R 755 /var/www/mentor-academy
```

3. **数据库连接失败**
- 检查 MySQL 服务状态：`systemctl status mysql`
- 验证数据库用户权限
- 检查 `.env` 文件中的数据库配置

4. **Nginx 配置错误**
```bash
nginx -t  # 测试配置
tail -f /var/log/nginx/error.log  # 查看错误日志
```

## 监控和维护

### 日志位置
- Nginx 访问日志：`/var/log/nginx/access.log`
- Nginx 错误日志：`/var/log/nginx/error.log`
- 应用日志：`/var/log/mentor-academy/`
- PM2 日志：`~/.pm2/logs/`

### 性能监控
```bash
# 系统资源监控
htop
df -h
free -h

# 应用监控
pm2 monit
```

## 备份策略

建议定期备份：
1. 数据库数据
2. 上传的文件
3. 配置文件

```bash
# 创建备份脚本
cat > /root/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/$DATE"
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u mentor_user -p academy_mentor > $BACKUP_DIR/database.sql

# 备份上传文件
cp -r /var/www/mentor-academy/backend/uploads $BACKUP_DIR/

# 备份配置文件
cp /var/www/mentor-academy/backend/.env $BACKUP_DIR/
EOF

chmod +x /root/backup.sh
```

## 支持

如果遇到问题，请检查：
1. 服务器日志文件
2. 应用程序日志
3. 数据库连接状态
4. 网络配置

需要技术支持时，请提供详细的错误信息和日志内容。