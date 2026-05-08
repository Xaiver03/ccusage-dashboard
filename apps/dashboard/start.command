#!/bin/bash
# ccusage Dashboard 快速启动脚本 (macOS)
# 双击运行即可启动仪表盘

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ccusage Dashboard 启动器             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Node.js,请先安装: https://nodejs.org/${NC}"
    read -p "按任意键退出..."
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未检测到 npm${NC}"
    read -p "按任意键退出..."
    exit 1
fi
echo -e "${GREEN}✓${NC} npm: $(npm -v)"

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚙  首次运行,正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依赖安装失败${NC}"
        read -p "按任意键退出..."
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} 依赖已就绪"

# 检查端口占用
PORT=5173
if lsof -ti:$PORT &> /dev/null; then
    EXISTING_PID=$(lsof -ti:$PORT)
    echo -e "${YELLOW}⚠  端口 $PORT 已被占用 (PID: $EXISTING_PID)${NC}"
    echo -e "${YELLOW}   是否关闭旧进程并重启? [Y/n]${NC}"
    read -t 5 -n 1 REPLY
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        kill -9 $EXISTING_PID 2>/dev/null
        sleep 1
        echo -e "${GREEN}✓${NC} 旧进程已关闭"
    else
        echo -e "${BLUE}→${NC} 直接打开浏览器访问现有服务"
        open "http://localhost:$PORT/"
        exit 0
    fi
fi

# 生成最新数据
echo -e "${BLUE}📊 生成最新数据...${NC}"
node scripts/generate-data.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 数据生成失败,请确认 ccusage 已构建${NC}"
    echo -e "${YELLOW}   尝试: cd /Users/rocalight/Desktop/All\\ in\\ one\\ Data/01_PROJECTS/ccusage && pnpm run build${NC}"
    read -p "按任意键退出..."
    exit 1
fi

# 启动 API 服务器（后台，用于刷新数据）
echo -e "${BLUE}🔌 启动 API 服务器 (端口 5174)...${NC}"
OLD_API_PIDS=$(lsof -ti :5174 2>/dev/null || true)
if [ -n "$OLD_API_PIDS" ]; then
    kill -9 $OLD_API_PIDS 2>/dev/null || true
    sleep 0.5
fi
nohup node scripts/api-server.js > /tmp/ccusage-api.log 2>&1 &
API_PID=$!
sleep 1
if lsof -ti :5174 &>/dev/null; then
    echo -e "${GREEN}✓ API 服务器已启动 (PID: $API_PID)${NC}"
else
    echo -e "${YELLOW}⚠ API 服务器启动失败，刷新功能将不可用${NC}"
fi

# 后台启动 vite dev server
echo -e "${BLUE}🚀 启动开发服务器...${NC}"
npx vite --port $PORT > /tmp/ccusage-dashboard.log 2>&1 &
DEV_PID=$!

# 等待服务器就绪
echo -e "${BLUE}⏳ 等待服务器就绪...${NC}"
for i in {1..15}; do
    if lsof -ti:$PORT &> /dev/null; then
        break
    fi
    sleep 0.5
done

if ! lsof -ti:$PORT &> /dev/null; then
    echo -e "${RED}❌ 服务器启动失败,查看日志: /tmp/ccusage-dashboard.log${NC}"
    read -p "按任意键退出..."
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ 仪表盘启动成功!                   ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   📍 访问: http://localhost:$PORT      ║${NC}"
echo -e "${GREEN}║   📋 日志: /tmp/ccusage-dashboard.log  ║${NC}"
echo -e "${GREEN}║   🔌 API:  /tmp/ccusage-api.log        ║${NC}"
echo -e "${GREEN}║   🛑 停止: 按 Ctrl+C 或关闭此窗口      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# 自动打开浏览器
sleep 1
open "http://localhost:$PORT/"

# 监听 Ctrl+C 来优雅退出
trap "echo ''; echo -e '${YELLOW}🛑 正在停止服务器...${NC}'; kill $DEV_PID 2>/dev/null; echo -e '${GREEN}✓ 已退出${NC}'; exit 0" INT TERM

# 实时显示日志
echo -e "${BLUE}📋 实时日志 (Ctrl+C 停止):${NC}"
echo "─────────────────────────────────────────"
tail -f /tmp/ccusage-dashboard.log
