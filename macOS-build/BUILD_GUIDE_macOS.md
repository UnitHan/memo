# macOS 빌드 가이드

이 폴더는 macOS에서 "AI 메모장"을 빌드하기 위한 소스 코드입니다.

## 📋 사전 요구사항

macOS에 다음 프로그램들을 설치해야 합니다:

```bash
# Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node

# Rust 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Python 3.10+ 설치
brew install python@3.10

# Xcode Command Line Tools 설치
xcode-select --install
```

## 🚀 빌드 단계

### 1. Python Sidecar 빌드

```bash
cd python-backend

# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install pyinstaller google-generativeai

# macOS용 실행 파일 빌드
pyinstaller --onefile --distpath ../src-tauri/binaries gemini_corrector.py

# 실행 권한 부여
chmod +x ../src-tauri/binaries/gemini-corrector

deactivate
cd ..
```

### 2. 프론트엔드 의존성 설치

```bash
npm install
```

### 3. Tauri 빌드

#### 개발 모드 실행
```bash
npm run tauri dev
```

#### 프로덕션 빌드 (DMG 생성)
```bash
# tauri.conf.json의 bundle.targets를 ["dmg", "app"]으로 변경 후
npm run tauri build
```

빌드 완료 후 인스톨러는 다음 위치에 생성됩니다:
- `src-tauri/target/release/bundle/dmg/AI 메모장_1.0.0_aarch64.dmg` (Apple Silicon)
- `src-tauri/target/release/bundle/dmg/AI 메모장_1.0.0_x64.dmg` (Intel Mac)

## 📝 macOS 전용 설정

### tauri.conf.json 수정

```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": [
      "../icon.png",
      "../icon.ico",
      "../icon.icns"
    ],
    "externalBin": [
      "binaries/gemini-corrector"
    ],
    "resources": [
      "binaries/*"
    ]
  }
}
```

## 🐛 문제 해결

### Python Sidecar 실행 안 됨
```bash
# 실행 권한 확인
ls -l src-tauri/binaries/gemini-corrector

# 권한이 없으면 부여
chmod +x src-tauri/binaries/gemini-corrector
```

### 빌드 오류 발생 시
```bash
# Cargo 캐시 삭제
cargo clean

# Node 의존성 재설치
rm -rf node_modules
npm install

# 다시 빌드
npm run tauri build
```

## ✅ 체크리스트

빌드 전 확인:
- [ ] Python sidecar가 `src-tauri/binaries/gemini-corrector`에 존재
- [ ] 실행 권한 있음 (`chmod +x`)
- [ ] `npm install` 완료
- [ ] `tauri.conf.json`의 targets가 `["dmg", "app"]`
- [ ] icon.icns 파일 존재

## 📦 최종 결과물

성공적으로 빌드하면 다음 파일들이 생성됩니다:
- **DMG 인스톨러**: 일반 사용자용 배포
- **App 번들**: 직접 실행 가능

## 🌟 참고사항

- **독립 실행**: Python 런타임이 포함되어 Python 미설치 Mac에서도 실행 가능
- **Gemini API 키**: 사용자가 설정에서 직접 입력
- **크로스 플랫폼**: 동일한 소스로 Windows/macOS 모두 빌드 가능

---

**문의**: QA Bulls
**버전**: 1.0.0
