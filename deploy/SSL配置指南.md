# SSL证书配置指南 - cdsyzh.cn

## 🔒 SSL证书配置方案

### 方案一：Let's Encrypt 免费证书（推荐）

Let's Encrypt 提供免费的SSL证书，有效期90天，支持自动续期。

#### 1. 前置条件检查

```bash
# 确保域名已正确解析到服务器IP
nslookup cdsyzh.cn
# 应该返回 121.41.168.208

# 确保80和443端口开放
ufw allow 80
ufw allow 443
```

#### 2. 安装 Certbot

```bash
# 更新包管理器
apt update

# 安装 Certbot 和 Nginx 插件
apt install certbot python3-certbot-nginx -y

# 验证安装
certbot --version
```

#### 3. 获取SSL证书

**方法A：自动配置（推荐）**
```bash
# Certbot 会自动修改 Nginx 配置
certbot --nginx -d cdsyzh.cn -d www.cdsyzh.cn

# 按提示输入邮箱地址
# 同意服务条款
# 选择是否接收邮件通知
```

**方法B：手动指定参数**
```bash
certbot --nginx \
  -d cdsyzh.cn \
  -d www.cdsyzh.cn \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

#### 4. 验证证书

```bash
# 检查证书状态
certbot certificates

# 测试证书配置
nginx -t

# 重新加载 Nginx
systemctl reload nginx
```

#### 5. 设置自动续期

```bash
# 测试续期命令
certbot renew --dry-run

# 设置定时任务
crontab -e

# 添加以下行（每天中午12点检查续期）
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

### 方案二：使用预配置的HTTPS Nginx文件

如果您想要更多控制，可以使用我们准备的HTTPS配置文件：

#### 1. 先获取证书（仅获取，不自动配置）

```bash
certbot certonly --webroot \
  -w /var/www/mentor-academy/frontend \
  -d cdsyzh.cn \
  -d www.cdsyzh.cn
```

#### 2. 使用预配置的Nginx文件

```bash
# 备份当前配置
cp /etc/nginx/sites-available/mentor-academy /etc/nginx/sites-available/mentor-academy.backup

# 使用HTTPS配置文件
cp /root/deploy/nginx-with-domain.conf /etc/nginx/sites-available/mentor-academy

# 测试配置
nginx -t

# 重新加载
systemctl reload nginx
```

## 🔧 SSL配置优化

### 安全性增强

在 `/etc/nginx/sites-available/mentor-academy` 中添加以下配置：

```nginx
# 安全头部
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/cdsyzh.cn/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### 性能优化

```nginx
# SSL会话缓存
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# 启用HTTP/2
listen 443 ssl http2;

# 启用gzip压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

## 🔍 验证和测试

### 1. 本地测试

```bash
# 测试HTTP重定向
curl -I http://cdsyzh.cn

# 测试HTTPS访问
curl -I https://cdsyzh.cn

# 检查证书信息
openssl s_client -connect cdsyzh.cn:443 -servername cdsyzh.cn
```

### 2. 在线测试工具

- **SSL Labs测试**: https://www.ssllabs.com/ssltest/
- **证书透明度检查**: https://crt.sh/?q=cdsyzh.cn

### 3. 浏览器测试

访问 https://cdsyzh.cn，检查：
- ✅ 地址栏显示锁图标
- ✅ 证书信息正确
- ✅ HTTP自动重定向到HTTPS

## 🛠️ 故障排除

### 常见问题

1. **证书获取失败**
   ```bash
   # 检查域名解析
   dig cdsyzh.cn
   
   # 检查80端口是否被占用
   netstat -tlnp | grep :80
   
   # 临时停止Nginx获取证书
   systemctl stop nginx
   certbot certonly --standalone -d cdsyzh.cn -d www.cdsyzh.cn
   systemctl start nginx
   ```

2. **Nginx配置错误**
   ```bash
   # 检查配置语法
   nginx -t
   
   # 查看错误日志
   tail -f /var/log/nginx/error.log
   ```

3. **证书路径错误**
   ```bash
   # 检查证书文件是否存在
   ls -la /etc/letsencrypt/live/cdsyzh.cn/
   
   # 应该包含以下文件：
   # - fullchain.pem
   # - privkey.pem
   # - cert.pem
   # - chain.pem
   ```

### 日志位置

- **Certbot日志**: `/var/log/letsencrypt/letsencrypt.log`
- **Nginx错误日志**: `/var/log/nginx/error.log`
- **Nginx访问日志**: `/var/log/nginx/access.log`

## 📅 维护计划

### 定期检查

```bash
# 每月检查证书状态
certbot certificates

# 检查证书到期时间
openssl x509 -in /etc/letsencrypt/live/cdsyzh.cn/cert.pem -text -noout | grep "Not After"

# 检查自动续期任务
crontab -l
```

### 备份证书

```bash
# 备份Let's Encrypt目录
tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# 存储到安全位置
mv letsencrypt-backup-*.tar.gz /root/backups/
```

## 🚀 快速部署命令

如果您已经完成了基础部署，只需要添加SSL：

```bash
# 一键SSL配置
apt install certbot python3-certbot-nginx -y && \
certbot --nginx -d cdsyzh.cn -d www.cdsyzh.cn --agree-tos --no-eff-email && \
echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx" | crontab -
```

配置完成后，您的网站将通过 https://cdsyzh.cn 安全访问！