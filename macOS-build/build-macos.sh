#!/bin/bash

# AI 메모장 macOS 빌드 스크립트
# QA Bulls

set -e  # 에러 발생 시 중단

echo "🚀 AI 메모장 macOS 빌드 시작"
echo "================================"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Python Sidecar 빌드
echo -e "\n${YELLOW}[1/4]${NC} Python Sidecar 빌드 중..."
cd python-backend

if [ ! -d "venv" ]; then
    echo "   → 가상환경 생성..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "   → 의존성 설치..."
pip install -q pyinstaller google-generativeai

echo "   → PyInstaller 빌드..."
pyinstaller --onefile --distpath ../src-tauri/binaries gemini_corrector.py

chmod +x ../src-tauri/binaries/gemini-corrector
deactivate

echo -e "${GREEN}✓${NC} Python Sidecar 빌드 완료"
cd ..

# 2. Node 의존성 설치
echo -e "\n${YELLOW}[2/4]${NC} Node.js 의존성 설치 중..."
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓${NC} 의존성 설치 완료"
else
    echo "   → node_modules 이미 존재 (스킵)"
fi

# 3. Tauri 빌드 확인
echo -e "\n${YELLOW}[3/4]${NC} Tauri 설정 확인..."
if grep -q '"dmg"' src-tauri/tauri.conf.json; then
    echo -e "${GREEN}✓${NC} DMG 타겟 설정 확인"
else
    echo -e "${RED}⚠${NC} tauri.conf.json의 targets를 [\"dmg\", \"app\"]으로 변경하세요"
    exit 1
fi

# 4. 빌드 실행
echo -e "\n${YELLOW}[4/4]${NC} Tauri 앱 빌드 중..."
echo "   (이 과정은 5-10분 소요될 수 있습니다)"
npm run tauri build

# 결과 확인
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ 빌드 완료!${NC}"
echo -e "\n📦 인스톨러 위치:"
find src-tauri/target/release/bundle -name "*.dmg" -o -name "*.app" | while read file; do
    echo "   → $file"
done

echo -e "\n${GREEN}성공적으로 빌드되었습니다! 🎉${NC}"
