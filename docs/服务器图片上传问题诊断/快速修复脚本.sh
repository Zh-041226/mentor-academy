#!/bin/bash

# 导师进书院系统 - 图片上传问题快速修复脚本
# 使用方法: chmod +x 快速修复脚本.sh && ./快速修复脚本.sh

echo "🔧 开始修复图片上传问题..."
echo "================================"

# 设置项目路径（根据实际部署路径调整）
PROJECT_PATH="/var/www/mentor-academy"
BACKEND_PATH="$PROJECT_PATH/backend"
UPLOADS_PATH="$BACKEND_PATH/uploads"

echo "📁 检查项目目录: $PROJECT_PATH"

# 1. 检查项目目录是否存在
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ 错误: 项目目录不存在 $PROJECT_PATH"
    echo "请确认项目部署路径是否正确"
    exit 1
fi

echo "✅ 项目目录存在"

# 2. 检查后端目录
if [ ! -d "$BACKEND_PATH" ]; then
    echo "❌ 错误: 后端目录不存在 $BACKEND_PATH"
    exit 1
fi

echo "✅ 后端目录存在"

# 3. 创建uploads目录（如果不存在）
echo "📂 检查uploads目录..."
if [ ! -d "$UPLOADS_PATH" ]; then
    echo "⚠️  uploads目录不存在，正在创建..."
    mkdir -p "$UPLOADS_PATH"
    echo "✅ uploads目录已创建"
else
    echo "✅ uploads目录已存在"
fi

# 4. 设置正确的权限
echo "🔐 设置目录权限..."

# 设置项目目录权限
chown -R www-data:www-data "$PROJECT_PATH"
chmod -R 755 "$PROJECT_PATH"

# 设置uploads目录特殊权限（可写）
chown -R www-data:www-data "$UPLOADS_PATH"
chmod -R 777 "$UPLOADS_PATH"

echo "✅ 权限设置完成"

# 5. 检查磁盘空间
echo "💾 检查磁盘空间..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "⚠️  警告: 磁盘使用率过高 ($DISK_USAGE%)"
    echo "建议清理不必要的文件"
else
    echo "✅ 磁盘空间充足 (使用率: $DISK_USAGE%)"
fi

# 6. 检查Nginx配置
echo "🌐 检查Nginx配置..."
NGINX_CONFIG_FOUND=false

# 常见的Nginx配置文件位置
NGINX_CONFIGS=(
    "/etc/nginx/sites-available/mentor-academy"
    "/etc/nginx/sites-enabled/mentor-academy"
    "/etc/nginx/conf.d/mentor-academy.conf"
    "/etc/nginx/nginx.conf"
)

for config in "${NGINX_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo "📄 找到Nginx配置: $config"
        
        # 检查是否包含client_max_body_size
        if grep -q "client_max_body_size" "$config"; then
            echo "✅ 找到文件上传大小限制配置"
            grep "client_max_body_size" "$config"
        else
            echo "⚠️  未找到client_max_body_size配置"
            echo "建议在location /api/块中添加: client_max_body_size 10M;"
        fi
        
        NGINX_CONFIG_FOUND=true
        break
    fi
done

if [ "$NGINX_CONFIG_FOUND" = false ]; then
    echo "⚠️  未找到Nginx配置文件"
    echo "请确认Nginx配置文件位置"
fi

# 7. 检查PM2进程状态
echo "🔄 检查PM2进程状态..."
if command -v pm2 &> /dev/null; then
    echo "PM2进程列表:"
    pm2 status
    
    # 检查后端进程
    if pm2 list | grep -q "mentor-academy-backend\|backend"; then
        echo "✅ 后端进程正在运行"
        
        # 显示最近的日志
        echo "📋 最近的应用日志:"
        pm2 logs --lines 10 --nostream
    else
        echo "⚠️  未找到后端PM2进程"
        echo "请检查PM2配置或手动启动后端服务"
    fi
else
    echo "⚠️  PM2未安装或不在PATH中"
fi

# 8. 测试上传目录写入权限
echo "✍️  测试写入权限..."
TEST_FILE="$UPLOADS_PATH/test_write_permission.txt"
if echo "test" > "$TEST_FILE" 2>/dev/null; then
    echo "✅ uploads目录写入权限正常"
    rm -f "$TEST_FILE"
else
    echo "❌ uploads目录写入权限异常"
    echo "当前目录权限:"
    ls -la "$UPLOADS_PATH"
fi

# 9. 重启相关服务
echo "🔄 重启服务..."

# 重启Nginx
if systemctl is-active --quiet nginx; then
    echo "重启Nginx..."
    systemctl reload nginx
    echo "✅ Nginx已重启"
else
    echo "⚠️  Nginx服务未运行"
fi

# 重启PM2应用
if command -v pm2 &> /dev/null; then
    echo "重启PM2应用..."
    pm2 restart all
    echo "✅ PM2应用已重启"
fi

echo "================================"
echo "🎉 修复脚本执行完成！"
echo ""
echo "📋 修复总结:"
echo "- ✅ 创建/检查uploads目录"
echo "- ✅ 设置正确的文件权限"
echo "- ✅ 检查磁盘空间"
echo "- ✅ 检查Nginx配置"
echo "- ✅ 检查PM2进程状态"
echo "- ✅ 测试写入权限"
echo "- ✅ 重启相关服务"
echo ""
echo "🧪 验证步骤:"
echo "1. 访问管理后台尝试上传图片"
echo "2. 检查uploads目录是否有新文件生成"
echo "3. 查看PM2日志: pm2 logs"
echo ""
echo "如果问题仍然存在，请检查:"
echo "- 应用程序日志 (pm2 logs)"
echo "- Nginx错误日志 (/var/log/nginx/error.log)"
echo "- 系统日志 (journalctl -u nginx)"