#!/bin/bash
# ccusage Dashboard 仅刷新数据 (无需重启服务器)

cd "$(dirname "$0")"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔄 刷新 ccusage 数据...${NC}"
node scripts/generate-data.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据已更新${NC}"
    echo -e "${BLUE}→ 浏览器中点击「刷新数据」按钮即可看到最新数据${NC}"
else
    echo -e "${RED}❌ 刷新失败${NC}"
fi

sleep 2
