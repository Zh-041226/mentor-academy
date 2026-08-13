# 导师进书院系统部署指南 - cdsyzh.cn

## 📋 服务器信息

- **实例ID**: 051b2d65035143bc90cb9126fabd0f37
- **公网IP**: 121.41.168.208
- **私有IP**: 172.25.55.160
- **域名**: cdsyzh.cn
- **系统**: Ubuntu 20.04+ (推荐)

## 🚀 快速部署步骤

### 第一步：连接服务器

```bash
# 使用SSH连接到您的服务器
ssh root@121.41.168.208

# 或者使用阿里云控制台的远程连接功能
```

### 第二步：上传部署文件

将 `deploy` 目录下的所有文件上传到服务器：

```bash
# 在本地执行（Windows PowerShell）
scp -r deploy/ root@121.41.168.208:/root/

# 或者使用 WinSCP、FileZilla 等工具上传
```

### 第三步：执行自动部署脚本

```bash
# 在服务器上执行
cd /root/deploy
chmod +x cdsyzh-deploy.sh
./cdsyzh-deploy.sh
```

脚本将自动完成：
- ✅ 系统更新
- ✅ 安装 Node.js、Nginx、MySQL
- ✅ 配置防火墙
- ✅ 创建数据库和用户
- ✅ 配置 Nginx

### 第四步：构建前端项目

在本地构建前端项目：

```bash
# 在本地项目目录执行
cd frontend
npm run build
```

### 第五步：上传项目文件

```bash
# 上传后端代码
scp -r backend/ root@121.41.168.208:/var/www/mentor-academy/

# 上传前端构建文件
scp -r frontend/dist/ root@121.41.168.208:/var/www/mentor-academy/frontend/

# 上传部署配置
scp deploy/.env.production root@121.41.168.208:/var/www/mentor-academy/backend/.env
scp deploy/ecosystem.config.js root@121.41.168.208:/var/www/mentor-academy/
```

### 第六步：配置后端

```bash
# 在服务器上执行
cd /var/www/mentor-academy/backend

# 安装依赖
npm install --production

# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 设置文件权限
chown -R www-data:www-data /var/www/mentor-academy
chmod -R 755 /var/www/mentor-academy
```

### 第七步：启动应用

```bash
# 启动后端服务
cd /var/www/mentor-academy
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save
pm2 startup

# 检查服务状态
pm2 status
```

### 第八步：配置域名解析

在您的域名管理面板中添加以下DNS记录：

```
类型: A
主机记录: @
记录值: 121.41.168.208
TTL: 600

类型: A  
主机记录: www
记录值: 121.41.168.208
TTL: 600
```

### 第九步：配置SSL证书（推荐）

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 获取SSL证书
certbot --nginx -d cdsyzh.cn -d www.cdsyzh.cn

# 设置自动续期
crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔍 验证部署

### 检查服务状态

```bash
# 检查 Nginx
systemctl status nginx

# 检查 MySQL
systemctl status mysql

# 检查 PM2 进程
pm2 status

# 检查端口占用
netstat -tlnp | grep :80
netstat -tlnp | grep :443
netstat -tlnp | grep :3001
```

### 访问测试

1. **HTTP访问**: http://cdsyzh.cn
2. **HTTPS访问**: https://cdsyzh.cn (配置SSL后)
3. **API测试**: https://cdsyzh.cn/api/health

## 🛠️ 常用管理命令

### PM2 管理

```bash
# 查看日志
pm2 logs mentor-academy-backend

# 重启应用
pm2 restart mentor-academy-backend

# 停止应用
pm2 stop mentor-academy-backend

# 删除应用
pm2 delete mentor-academy-backend
```

### Nginx 管理

```bash
# 测试配置
nginx -t

# 重新加载配置
systemctl reload nginx

# 重启 Nginx
systemctl restart nginx

# 查看错误日志
tail -f /var/log/nginx/error.log
```

### 数据库管理

```bash
# 连接数据库
mysql -u mentor_user -p academy_mentor

# 备份数据库
mysqldump -u mentor_user -p academy_mentor > backup.sql

# 恢复数据库
mysql -u mentor_user -p academy_mentor < backup.sql
```

## 🔧 故障排除

### 常见问题

1. **域名无法访问**
   - 检查DNS解析是否生效：`nslookup cdsyzh.cn`
   - 检查防火墙设置：`ufw status`

2. **后端API无法访问**
   - 检查PM2状态：`pm2 status`
   - 查看后端日志：`pm2 logs mentor-academy-backend`

3. **数据库连接失败**
   - 检查MySQL状态：`systemctl status mysql`
   - 验证数据库配置：检查 `.env` 文件

4. **文件上传失败**
   - 检查上传目录权限：`ls -la /var/www/mentor-academy/backend/uploads`
   - 确保目录存在：`mkdir -p /var/www/mentor-academy/backend/uploads`

### 日志位置

- **Nginx访问日志**: `/var/log/nginx/access.log`
- **Nginx错误日志**: `/var/log/nginx/error.log`
- **PM2日志**: `~/.pm2/logs/`
- **MySQL日志**: `/var/log/mysql/error.log`

## 📊 性能监控

### 系统监控

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
ss -tulpn
```

### 应用监控

```bash
# PM2 监控
pm2 monit

# 查看应用性能
pm2 show mentor-academy-backend
```

## 🔒 安全建议

1. **定期更新系统**
   ```bash
   apt update && apt upgrade -y
   ```

2. **配置SSH密钥登录**
   ```bash
   # 禁用密码登录，使用密钥登录
   vim /etc/ssh/sshd_config
   # 设置 PasswordAuthentication no
   ```

3. **定期备份数据**
   ```bash
   # 创建备份脚本
   vim /root/backup.sh
   ```

4. **监控日志**
   ```bash
   # 定期检查异常日志
   tail -f /var/log/nginx/error.log
   ```

## 📞 技术支持

如果在部署过程中遇到问题，请检查：

1. 服务器配置是否满足最低要求
2. 域名DNS解析是否正确
3. 防火墙端口是否开放
4. 各项服务是否正常运行

部署完成后，您的导师进书院系统将在 https://cdsyzh.cn 上线运行！