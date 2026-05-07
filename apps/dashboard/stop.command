#!/bin/bash
# ccusage Dashboard 停止脚本

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PORT=5173

echo "🛑 停止 ccusage Dashboard..."

if lsof -ti:$PORT &> /dev/null; then
    PID=$(lsof -ti:$PORT)
    kill -9 $PID 2>/dev/null
    echo -e "${GREEN}✓ 已停止 (PID: $PID)${NC}"
else
    echo -e "${YELLOW}⚠ 服务器未运行${NC}"
fi

sleep 1
