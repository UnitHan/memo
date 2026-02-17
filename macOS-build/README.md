# Gemini 메모장 프로젝트

**Tauri + React + Python + Gemini API 기반 텍스트 교정 메모장**

## 프로젝트 개요

이 프로젝트는 Gemini AI를 활용하여 버그 리포트, 컨플루언스 문서, 이메일 등의 텍스트를 자동으로 교정하는 데스크톱 메모장 애플리케이션입니다. 30년 경력의 QA 전문가와 전문 작가 페르소나를 가진 AI가 맞춤법, 문법, 문장 구성을 개선합니다.

## 주요 기능

- ✨ **Gemini AI 텍스트 교정**: 맞춤법, 문법, 문장 구성 자동 개선
- 💻 **코드/로그 자동 포맷팅**: JSON, Android Logcat, 서버 로그, 코드 자동 인식 및 하이라이팅
- 🛡️ **3단계 보안 시스템**: 민감 정보 자동 감지 + AI 학습
- 🎨 **반투명 UI**: 투명도 조절 가능한 미려한 인터페이스
- 📌 **항상 위 고정**: 다른 창 위에 메모장 고정
- 💾 **파일 저장**: 텍스트는 .txt, 이미지/코드는 .html로 자동 저장
- 🚀 **독립 실행**: Python 미설치 PC에서도 실행 가능
- 📊 **대용량 지원**: 최대 5MB 텍스트 처리

### 코드/로그 포맷팅 지원 형식
- 📱 Android Logcat
- 🖥️ 서버 로그 (Syslog, Application logs)
- 📄 JSON (자동 들여쓰기)
- 💻 JavaScript, TypeScript, Python, Java, Kotlin, SQL 등
- 🔴 Stack Traces
- ⚠️ 로그 레벨 색상 강조 (ERROR/WARN/INFO/DEBUG)

> 자세한 테스트 예제는 [CODE_FORMAT_TEST.md](CODE_FORMAT_TEST.md) 참고

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# Python 가상환경 생성
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Python Sidecar 빌드
cd python-backend
.\build.bat
```

## 개발 워크플로우

```bash
# 개발 모드 실행
npm run dev

# 프로덕션 빌드 (Windows 인스톨러)
npm run dist
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
