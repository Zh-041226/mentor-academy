#!/bin/bash

# 导师进书院系统 - 远程服务器全面诊断脚本
# 使用方法: chmod +x 远程服务器诊断脚本.sh && ./远程服务器诊断脚本.sh

echo "🔍 开始远程服务器诊断..."
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

echo -e "${BLUE}📋 系统信息收集${NC}"
echo "========================================"

# 1. 系统基本信息
echo -e "${YELLOW}🖥️  系统基本信息:${NC}"
echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "内核版本: $(uname -r)"
echo "系统时间: $(date)"
echo "运行时间: $(uptime)"
echo ""

# 2. 磁盘空间检查
echo -e "${YELLOW}💾 磁盘空间检查:${NC}"
df -h
echo ""

# 3. 内存使用情况
echo -e "${YELLOW}🧠 内存使用情况:${NC}"
free -h
echo ""

# 4. CPU负载
echo -e "${YELLOW}⚡ CPU负载:${NC}"
top -bn1 | head -5
echo ""

echo -e "${BLUE}📁 项目目录检查${NC}"
echo "========================================"

# 5. 项目目录结构
echo -e "${YELLOW}📂 项目目录结构:${NC}"
if [ -d "$PROJECT_PATH" ]; then
    echo -e "${GREEN}✅ 项目根目录存在: $PROJECT_PATH${NC}"
    ls -la "$PROJECT_PATH"
    echo ""
    
    # 检查后端目录
    if [ -d "$BACKEND_PATH" ]; then
        echo -e "${GREEN}✅ 后端目录存在: $BACKEND_PATH${NC}"
        ls -la "$BACKEND_PATH" | head -10
    else
        echo -e "${RED}❌ 后端目录不存在: $BACKEND_PATH${NC}"
    fi
    echo ""
    
    # 检查前端目录
    if [ -d "$FRONTEND_PATH" ]; then
        echo -e "${GREEN}✅ 前端目录存在: $FRONTEND_PATH${NC}"
        ls -la "$FRONTEND_PATH" | head -10
    else
        echo -e "${RED}❌ 前端目录不存在: $FRONTEND_PATH${NC}"
    fi
    echo ""
    
    # 检查uploads目录
    if [ -d "$UPLOADS_PATH" ]; then
        echo -e "${GREEN}✅ uploads目录存在: $UPLOADS_PATH${NC}"
        echo "目录权限: $(ls -ld "$UPLOADS_PATH")"
        echo "文件数量: $(ls -1 "$UPLOADS_PATH" | wc -l)"
        echo "目录大小: $(du -sh "$UPLOADS_PATH")"
    else
        echo -e "${RED}❌ uploads目录不存在: $UPLOADS_PATH${NC}"
    fi
else
    echo -e "${RED}❌ 项目根目录不存在: $PROJECT_PATH${NC}"
fi
echo ""

echo -e "${BLUE}🔧 服务状态检查${NC}"
echo "========================================"

# 6. Node.js和npm版本
echo -e "${YELLOW}📦 Node.js环境:${NC}"
if command -v node &> /dev/null; then
    echo "Node.js版本: $(node --version)"
else
    echo -e "${RED}❌ Node.js未安装${NC}"
fi

if command -v npm &> /dev/null; then
    echo "npm版本: $(npm --version)"
else
    echo -e "${RED}❌ npm未安装${NC}"
fi
echo ""

# 7. PM2状态检查
echo -e "${YELLOW}🔄 PM2进程状态:${NC}"
if command -v pm2 &> /dev/null; then
    echo "PM2版本: $(pm2 --version)"
    echo ""
    echo "PM2进程列表:"
    pm2 status
    echo ""
    
    # 检查具体的应用进程
    echo "应用进程详情:"
    pm2 show mentor-academy-backend 2>/dev/null || echo "后端进程未找到"
    pm2 show mentor-academy-frontend 2>/dev/null || echo "前端进程未找到"
else
    echo -e "${RED}❌ PM2未安装${NC}"
fi
echo ""

# 8. Nginx状态检查
echo -e "${YELLOW}🌐 Nginx状态检查:${NC}"
if command -v nginx &> /dev/null; then
    echo "Nginx版本: $(nginx -v 2>&1)"
    echo "Nginx状态: $(systemctl is-active nginx 2>/dev/null || echo '未知')"
    echo "Nginx配置测试:"
    nginx -t 2>&1
    echo ""
    
    # 检查Nginx配置文件
    echo "Nginx配置文件:"
    NGINX_CONFIGS=(
        "/etc/nginx/sites-available/mentor-academy"
        "/etc/nginx/sites-enabled/mentor-academy"
        "/etc/nginx/conf.d/mentor-academy.conf"
    )
    
    for config in "${NGINX_CONFIGS[@]}"; do
        if [ -f "$config" ]; then
            echo -e "${GREEN}✅ 找到配置文件: $config${NC}"
            echo "文件大小: $(ls -lh "$config" | awk '{print $5}')"
            echo "最后修改: $(ls -l "$config" | awk '{print $6, $7, $8}')"
            
            # 检查关键配置
            if grep -q "client_max_body_size" "$config"; then
                echo "上传限制: $(grep "client_max_body_size" "$config" | head -1 | xargs)"
            else
                echo -e "${YELLOW}⚠️  未找到client_max_body_size配置${NC}"
            fi
            break
        fi
    done
else
    echo -e "${RED}❌ Nginx未安装${NC}"
fi
echo ""

echo -e "${BLUE}🔌 网络和端口检查${NC}"
echo "========================================"

# 9. 端口占用检查
echo -e "${YELLOW}🔌 端口占用检查:${NC}"
echo "检查3001端口(后端):"
if netstat -tlnp 2>/dev/null | grep :3001; then
    echo -e "${GREEN}✅ 端口3001已被占用${NC}"
else
    echo -e "${RED}❌ 端口3001未被占用${NC}"
fi

echo "检查80端口(HTTP):"
if netstat -tlnp 2>/dev/null | grep :80; then
    echo -e "${GREEN}✅ 端口80已被占用${NC}"
else
    echo -e "${RED}❌ 端口80未被占用${NC}"
fi

echo "检查443端口(HTTPS):"
if netstat -tlnp 2>/dev/null | grep :443; then
    echo -e "${GREEN}✅ 端口443已被占用${NC}"
else
    echo -e "${RED}❌ 端口443未被占用${NC}"
fi
echo ""

# 10. 本地API测试
echo -e "${YELLOW}🧪 本地API测试:${NC}"
echo "测试后端健康检查:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/hero-slides | grep -q "200"; then
    echo -e "${GREEN}✅ 后端API响应正常${NC}"
else
    echo -e "${RED}❌ 后端API无响应${NC}"
fi
echo ""

echo -e "${BLUE}📄 配置文件检查${NC}"
echo "========================================"

# 11. 环境变量检查
echo -e "${YELLOW}🔐 环境变量检查:${NC}"
if [ -f "$BACKEND_PATH/.env" ]; then
    echo -e "${GREEN}✅ 后端.env文件存在${NC}"
    echo "文件大小: $(ls -lh "$BACKEND_PATH/.env" | awk '{print $5}')"
    echo "关键配置项:"
    grep -E "^(DATABASE_URL|JWT_SECRET|PORT)" "$BACKEND_PATH/.env" 2>/dev/null | sed 's/=.*/=***/' || echo "无法读取配置"
else
    echo -e "${RED}❌ 后端.env文件不存在${NC}"
fi

if [ -f "$FRONTEND_PATH/.env.production" ]; then
    echo -e "${GREEN}✅ 前端生产环境配置存在${NC}"
    cat "$FRONTEND_PATH/.env.production" 2>/dev/null || echo "无法读取配置"
else
    echo -e "${RED}❌ 前端生产环境配置不存在${NC}"
fi
echo ""

# 12. 数据库连接测试
echo -e "${YELLOW}🗄️  数据库连接测试:${NC}"
if [ -f "$BACKEND_PATH/.env" ]; then
    DATABASE_URL=$(grep "^DATABASE_URL" "$BACKEND_PATH/.env" 2>/dev/null | cut -d'=' -f2-)
    if [ ! -z "$DATABASE_URL" ]; then
        echo "数据库URL已配置"
        # 这里可以添加更具体的数据库连接测试
    else
        echo -e "${RED}❌ 数据库URL未配置${NC}"
    fi
else
    echo -e "${RED}❌ 无法检查数据库配置${NC}"
fi
echo ""

echo -e "${BLUE}📋 日志文件检查${NC}"
echo "========================================"

# 13. 应用日志
echo -e "${YELLOW}📋 应用日志检查:${NC}"
if command -v pm2 &> /dev/null; then
    echo "PM2日志 (最近20行):"
    pm2 logs --lines 20 --nostream 2>/dev/null || echo "无法获取PM2日志"
else
    echo "PM2未安装，无法获取应用日志"
fi
echo ""

# 14. Nginx日志
echo -e "${YELLOW}🌐 Nginx日志检查:${NC}"
if [ -f "/var/log/nginx/error.log" ]; then
    echo "Nginx错误日志 (最近10行):"
    tail -10 /var/log/nginx/error.log 2>/dev/null || echo "无法读取Nginx错误日志"
else
    echo "Nginx错误日志文件不存在"
fi

if [ -f "/var/log/nginx/access.log" ]; then
    echo "Nginx访问日志 (最近5行):"
    tail -5 /var/log/nginx/access.log 2>/dev/null || echo "无法读取Nginx访问日志"
else
    echo "Nginx访问日志文件不存在"
fi
echo ""

echo -e "${BLUE}🔍 问题诊断总结${NC}"
echo "========================================"

# 15. 问题总结和建议
echo -e "${YELLOW}📊 诊断总结:${NC}"

# 检查关键问题
ISSUES=()

# 检查项目目录
if [ ! -d "$PROJECT_PATH" ]; then
    ISSUES+=("项目目录不存在")
fi

# 检查uploads目录权限
if [ -d "$UPLOADS_PATH" ]; then
    UPLOAD_PERM=$(ls -ld "$UPLOADS_PATH" | cut -d' ' -f1)
    if [[ ! "$UPLOAD_PERM" =~ ^d.......w. ]]; then
        ISSUES+=("uploads目录权限不足")
    fi
else
    ISSUES+=("uploads目录不存在")
fi

# 检查PM2进程
if command -v pm2 &> /dev/null; then
    if ! pm2 list | grep -q "online"; then
        ISSUES+=("PM2进程未正常运行")
    fi
else
    ISSUES+=("PM2未安装")
fi

# 检查Nginx
if ! systemctl is-active --quiet nginx 2>/dev/null; then
    ISSUES+=("Nginx服务未运行")
fi

# 输出问题列表
if [ ${#ISSUES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 未发现明显问题${NC}"
else
    echo -e "${RED}❌ 发现以下问题:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
fi

echo ""
echo -e "${BLUE}🛠️  建议的修复步骤:${NC}"
echo "1. 检查并修复目录权限问题"
echo "2. 确保PM2进程正常运行"
echo "3. 验证Nginx配置和服务状态"
echo "4. 检查环境变量配置"
echo "5. 查看详细的应用日志"

echo ""
echo "========================================"
echo -e "${GREEN}🎉 诊断完成！${NC}"
echo "请根据以上信息进行问题排查和修复。"