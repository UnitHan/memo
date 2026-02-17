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
- � **자동 백업**: 업데이트/재설치 시에도 메모 안전하게 보존 (5분 간격)- 🌐 **절전 모드 대응**: 네트워크 재연결 자동 감지 및 재시도- �🚀 **독립 실행**: Python 미설치 PC에서도 실행 가능
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

## 데이터 보존 및 백업

앱은 **자동 백업 시스템**으로 업데이트 및 재설치 시에도 모든 데이터를 안전하게 보호합니다:

### 백업 대상
- 📝 작성 중인 메모 (`auto_saved_memo`)
- 📚 저장된 메모 목록 (`memo_history`)
- 🛡️ 학습된 민감 키워드 (`sensitive_keywords_db`)
- 🔑 Gemini API 키 (난독화된 상태)
- ⚙️ 투명도 등 설정 값

### 백업 메커니즘
1. **앱 시작 시**: 백업 파일이 있으면 자동 복원
2. **5분 간격**: localStorage → 파일 자동 백업
3. **앱 종료 시**: 최종 백업 수행

### 백업 파일 위치
- **Windows**: `C:\Users\{username}\AppData\Roaming\com.qabulls.ai-memo\memo_backup.json`
- **macOS**: `~/Library/Application Support/com.qabulls.ai-memo/memo_backup.json`

### 수동 복구 방법
백업 파일이 있으면 앱을 삭제 후 재설치해도 데이터가 자동으로 복원됩니다.

## 절전 모드 및 네트워크 복구

앱은 **네트워크 연결 상태를 실시간 모니터링**하여 절전 모드나 네트워크 단절 시에도 안정적으로 동작합니다:

### 지원 시나리오
- 💤 **노트북 절전 모드**: 깨어난 후 자동으로 네트워크 재연결 감지
- 📡 **Wi-Fi 재연결**: 네트워크 연결 끊김 자동 감지 및 복구
- 🔄 **자동 재시도**: 네트워크 오류 발생 시 사용자 확인 후 재시도

### 에러 핸들링
1. **오프라인 감지**: AI 교정 버튼 클릭 시 오프라인이면 대기 여부 확인
2. **타임아웃 처리**: 네트워크 불안정 시 재시도 제안
3. **친화적 메시지**: 기술적 에러 대신 "절전 모드 해제 후 다시 시도" 등 명확한 안내

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
