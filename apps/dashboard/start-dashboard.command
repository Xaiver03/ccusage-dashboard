#!/bin/bash

# ccusage Dashboard 启动器
# 自动关闭旧进程、生成数据、启动服务、打开浏览器

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 查找 dashboard 目录（脚本可在任意位置）
find_dashboard_dir() {
    local script_dir="$(cd "$(dirname "$0")" && pwd)"

    # 情况1: 脚本就在 dashboard 目录内
    if [ -f "$script_dir/package.json" ] && grep -q "ccusage-dashboard" "$script_dir/package.json" 2>/dev/null; then
        echo "$script_dir"
        return
    fi

    # 情况2: 脚本在 dashboard/scripts/ 目录
    if [ -d "$script_dir/../src" ] && [ -f "$script_dir/../package.json" ]; then
        local parent="$(cd "$script_dir/.." && pwd)"
        if grep -q "ccusage-dashboard" "$parent/package.json" 2>/dev/null; then
            echo "$parent"
            return
        fi
    fi

    # 情况3: 脚本在 monorepo 根目录
    if [ -d "$script_dir/apps/dashboard" ]; then
        echo "$script_dir/apps/dashboard"
        return
    fi

    # 情况4: 通过已知路径查找（fallback）
    local known_paths=(
        "$HOME/Desktop/ccusage/apps/dashboard"
        "$HOME/Projects/ccusage/apps/dashboard"
        "$HOME/ccusage/apps/dashboard"
        "/Users/$USER/Desktop/All in one Data/01_PROJECTS/ccusage/apps/dashboard"
    )
    for p in "${known_paths[@]}"; do
        if [ -f "$p/package.json" ] && grep -q "ccusage-dashboard" "$p/package.json" 2>/dev/null; then
            echo "$p"
            return
        fi
    done

    echo ""
    echo -e "${RED}错误: 无法找到 dashboard 目录${NC}"
    echo "请将脚本放在以下位置之一:"
    echo "  - dashboard/ 目录内"
    echo "  - dashboard/scripts/ 目录内"
    echo "  - ccusage monorepo 根目录内"
    exit 1
}

DASHBOARD_DIR="$(find_dashboard_dir)"
MONOREPO_DIR="$(cd "$DASHBOARD_DIR/../.." && pwd)"
CCUSAGE_BIN="$MONOREPO_DIR/apps/ccusage/dist/index.js"
PORT=5173

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ccusage Dashboard 启动器             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js: $(node --version)"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠ 未找到 pnpm，尝试安装...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓${NC} pnpm: $(pnpm --version)"

# 首次启动：构建 ccusage
if [ ! -f "$CCUSAGE_BIN" ]; then
    echo ""
    echo -e "${YELLOW}📦 首次启动 - 正在构建 ccusage CLI...${NC}"
    echo ""
    cd "$MONOREPO_DIR"

    echo "安装 monorepo 依赖..."
    pnpm install

    echo "构建 ccusage..."
    cd "$MONOREPO_DIR/apps/ccusage"
    pnpm run build

    if [ ! -f "$CCUSAGE_BIN" ]; then
        echo -e "${RED}构建失败!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ ccusage 构建完成${NC}"
fi

# 检查端口占用并自动关闭
echo ""
echo -e "${BLUE}🔍 检查端口 $PORT...${NC}"
OLD_PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$OLD_PIDS" ]; then
    echo -e "${YELLOW}⚠ 端口 $PORT 已被占用 (PID: $OLD_PIDS)${NC}"
    echo -n "   正在关闭旧进程..."
    kill -9 $OLD_PIDS 2>/dev/null || true
    sleep 1
    # 确认已关闭
    if lsof -ti :$PORT &> /dev/null; then
        echo -e "${RED}失败${NC}"
        echo "请手动关闭占用 $PORT 端口的进程"
        exit 1
    fi
    echo -e "${GREEN}已关闭${NC}"
else
    echo -e "${GREEN}✓ 端口 $PORT 可用${NC}"
fi

# 生成数据
echo ""
echo -e "${BLUE}📊 生成最新数据...${NC}"
cd "$DASHBOARD_DIR"
node scripts/generate-data.js

# 安装 dashboard 依赖（如果需要）
if [ ! -d "$DASHBOARD_DIR/node_modules" ]; then
    echo -e "${BLUE}📦 安装 dashboard 依赖...${NC}"
    cd "$DASHBOARD_DIR"
    pnpm install
fi

# 启动 API 服务器（后台，用于刷新数据）
echo ""
echo -e "${BLUE}🔌 启动 API 服务器 (端口 5174)...${NC}"
cd "$DASHBOARD_DIR"
OLD_API_PIDS=$(lsof -ti :5174 2>/dev/null || true)
if [ -n "$OLD_API_PIDS" ]; then
    kill -9 $OLD_API_PIDS 2>/dev/null || true
    sleep 0.5
fi
nohup node scripts/api-server.js > /tmp/dashboard-api.log 2>&1 &
API_PID=$!
sleep 1
if lsof -ti :5174 &>/dev/null; then
    echo -e "${GREEN}✓ API 服务器已启动 (PID: $API_PID)${NC}"
else
    echo -e "${YELLOW}⚠ API 服务器启动失败，刷新功能将不可用${NC}"
fi

# 启动 dev server
echo ""
echo -e "${BLUE}🚀 启动 dev server...${NC}"
cd "$DASHBOARD_DIR"
nohup pnpm run dev > /tmp/dashboard-dev.log 2>&1 &
SERVER_PID=$!

# 等待服务器就绪
echo -n "   等待服务器启动"
for i in {1..60}; do
    if curl -s http://localhost:$PORT > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}✓ 服务器已启动 (PID: $SERVER_PID)${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 60 ]; then
        echo ""
        echo -e "${RED}启动超时!${NC}"
        echo "日志: tail -f /tmp/dashboard-dev.log"
        exit 1
    fi
done

# 打开浏览器
echo ""
echo -e "${BLUE}🌐 打开浏览器...${NC}"
open "http://localhost:$PORT"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  仪表盘已启动!${NC}"
echo -e "${GREEN}  URL: http://localhost:$PORT${NC}"
echo -e "${GREEN}  日志: tail -f /tmp/dashboard-dev.log${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
