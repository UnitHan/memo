# Gemini 메모장 - AI Coding Agent Instructions

## 프로젝트 아키텍처

이 프로젝트는 **Tauri (Rust) + React (TypeScript) + Python Sidecar** 의 3-Layer 구조를 사용합니다:

1. **프론트엔드**: React + Tailwind CSS + Framer Motion
2. **백엔드**: Rust (Tauri 프레임워크)
3. **AI 로직**: Python 독립 실행 파일 (PyInstaller로 빌드)

### 핵심 설계 원칙

- **Python Sidecar**: Python 코드는 PyInstaller로 빌드되어 `src-tauri/binaries/gemini-corrector.exe`로 번들링됩니다. Python 미설치 PC에서도 실행 가능합니다.
- **보안 통신**: Rust → Python 간 stdin을 통한 JSON 전송 (커맨드라인 인자 노출 방지)
- **API 키 보호**: Base64 + 역순 난독화로 localStorage 평문 저장 방지
- **3단계 보안 검사**: 
  1. 정규식 빠른 검사
  2. Validator.js 정밀 검증
  3. 로컬 DB 학습 패턴 검사 (사용자가 차단한 패턴 자동 누적)
- **AI 학습 알고리즘**: 사용자가 "취소" 누른 패턴을 localStorage DB에 저장하여 점점 똑똑해짐
- **투명 윈도우**: `transparent: true` 설정으로 반투명 UI 구현
- **Always on Top**: 메모장을 항상 최상위에 고정

## 핵심 개발 워크플로우

### 개발 모드
```bash
npm run dev  # Vite + Tauri 개발 모드 (핫 리로드)
```

### Python Sidecar 수정 시
```bash
cd python-backend
.\build.bat  # PyInstaller로 재빌드
```

### 프로덕션 빌드
```bash
npm run dist  # TypeScript 컴파일 + Vite 빌드 + Tauri 번들링
```

## 주요 파일 및 책임

### 프론트엔드
- `src/App.tsx`: 메인 UI 컴포넌트
  - `invoke('correct_text', { apiKey, text })` 로 Rust 호출
  - localStorage로 Gemini API 키 관리 (난독화)
  - **3단계 보안 검사** (Google 전송 전):
    1. **정규식 검사**: IP, 전화번호, 회사명, 금액 패턴
    2. **Validator.js 검증**: 이메일, IP, 신용카드, URL 정밀 검증
    3. **로컬 DB 학습**: 사용자가 차단한 키워드/패턴 자동 학습 및 재검출
  - 감지 시 confirm 다이얼로그 → 취소하면 패턴 학습 및 Google 전송 안 함
  - 학습된 키워드 관리 UI (🛡️ 버튼)
  - 투명도 슬라이더, 항상 위 토글 버튼

- `src/index.css`: Tailwind CSS 임포트
  - `@tailwind base; @tailwind components; @tailwind utilities;`

### 백엔드 (Rust)
- `src-tauri/src/lib.rs`: Tauri 커맨드 정의
  - `correct_text` 함수: Python Sidecar 실행 및 JSON 파싱
  - `Command::new("binaries/gemini-corrector.exe")` 로 Python 호출

- `src-tauri/tauri.conf.json`: Tauri 설정
  - `transparent: true` : 투명 윈도우
  - `alwaysOnTop: true` : 항상 위
  - `externalBin: ["binaries/gemini-corrector"]` : Python 번들링
  - `decorations: true` : 윈도우 테두리 표시

### Python AI 로직 페르소나
  - JSON 응답: `{"success": true, "corrected_text": "..."}`
  - **주의**: 민감 정보 감지는 React에서 Google 전송 전에 수행
    - 민감 정보 자동 감지 (IP, 이메일, 회사명, 금액 등)
    - 감지 시 경고 및 익명화 제안
  - JSON 응답: `{"success": true, "corrected_text": "..."}`

- `python-backend/build.bat`: PyInstaller 빌드 스크립트
  - `--onefile`: 단일 실행 파일
  - `--distpath ../src-tauri/binaries`: Tauri 번들 경로

## 중요 패턴 및 컨벤션

### Tauri Command 패턴
```typescript
// React → Rust 호출
const result = await invoke('correct_text', {
  apiKey: apiKey,
  text: text
});
```

```rust
// Rust 커맨드 정의
#[tauri::command]
async fn correct_text(api_key: String, text: String) -> Result<String, String> {
    // Python Sidecar 실행
    let output = Command::new("binaries/gemini-corrector.exe")
        .arg(api_key)
        .arg(text)
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;
    
    // JSON 파싱
    let result: serde_json::Value = serde_json::from_str(&stdout)?;
    Ok(result["corrected_text"].as_str().unwrap().to_string())
}
```

### Python Sidecar JSON 통신
```python
# gemini_corrector.py
import sys
import json

result = {
    "success": True,
    "corrected_text": "교정된 텍스트"
}
print(json.dumps(result, ensure_ascii=False))
```

### 윈도우 드래그 영역
```tsx
<div data-tauri-drag-region>
  {/* 이 영역을 드래그하면 윈도우 이동 */}
</div>
```

## 빌드 및 배포

### Windows 인스톨러 생성
1. Python Sidecar 빌드: `cd python-backend && .\build.bat`
2. 프론트엔드 빌드 + Tauri 번들: `npm run dist`
3. 결과물: `src-tauri/target/release/bundle/msi/` 또는 `nsis/`

### 배포 체크리스트
- [ ] `src-tauri/binaries/gemini-corrector.exe` 존재 확인
- [ ] `tauri.conf.json`의 `externalBin` 설정 확인
- [ ] Gemini API 키 테스트 (유효성 확인)
- [보안 기능

### 구현된 보안 조치
1. **stdin 입력**: 커맨드라인 인자 대신 stdin 사용 (프로세스 모니터링 방지)
2. **API 키 난독화**: Base64 + 역순 변환으로 브라우저 저장소 보호
3. **민감 정보 자동 감지**: Gemini가 다음 정보 탐지 시 경고
3. **로컬 민감 정보 감지** (Google 전송 전):
   - IP 주소 (정규식: `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}`)
   - 이메일 주소 (정규식: `[\w.-]+@[\w.-]+\.\w{2,}`)
   - 전화번호 (한국: `0\d{1,2}-?\d{3,4}-?\d{4}`)
   - 회사명 (삼성, LG, SK, 네이버, 카카오 등)
   - 금액 정보 (억원, 만원 패턴)
   - 감지 시 confirm 다이얼로그 표시 → 사용자 취소하면 전송 안 함
### 사용 시 주의사항
- ✅ 안전: 일반 업무 문서 맞춤법 교정
- ⚠️ 주의: 업무 내용은 익명화 후 사용 (A사, 담당자 등)
- ❌ 금지: 비밀번호, 신용카드, 주민번호 등 절대 입력 금지

##  ] 투명도/항상 위 기능 테스트

## 문제 해결

### Python Sidecar 실행 오류
- 원인: `binaries/gemini-corrector.exe` 파일 누락
- 해결: `cd python-backend && .\build.bat` 실행

### Gemini API 오류
- 원인: API 키 미설정 또는 잘못된 키
- 해결: 설정 버튼(⚙️) → API 키 입력 → 저장
- API 키 발급: https://makersuite.google.com/app/apikey

### 투명도 미작동
- 원인: Windows 투명 효과 비활성화
- 해결: 설정 > 개인설정 > 색 > 투명 효과 활성화

## 의존성 버전

### 핵심 라이브러리
- Python: **3.10.11** (venv 사용)
- Node.js: 18+
- Rust: 1.70+
- Tauri: ^2
- React: ^19.1.0
- google-generativeai: 0.8.3
- pyinstaller: 6.11.1

### 스타일 및 애니메이션
- tailwindcss: ^4.1.18
- framer-motion: ^12.31.0

## 프로젝트 특화 가이드

### UI 수정 시
- `src/App.tsx` 수정
- Tailwind CSS 클래스 사용 (`bg-gray-800`, `text-white` 등)
- 투명도는 inline style로 설정: `backgroundColor: rgba(30, 30, 46, ${opacity})`

##재빌드 필수: `cd python-backend && .\build.bat`

### 민감 정보 감지 패턴 추가 시
- `src/App.tsx`의 `detectSensitiveInfo()` 함수 수정
- 1단계 검사: 정규표현식 추가
- 2단계 검사: validator 메서드 활용
- 3단계 검사: 자동으로 사용자가 학습시킴
- 빌드: `npm run build` (Python 재빌드 불필요)

### 학습 DB 관리
- localStorage 키: `sensitive_keywords_db`
- 구조: `{ blockedKeywords: string[], blockedPatterns: string[], lastUpdated: number }`
- UI: 🛡️ 버튼 → 학습된 키워드 확인/삭제
- 초기화: "학습 데이터 초기화" 버튼
  - IP 주소, 이메일, 회사명, 금액 등 자동 탐지
- 재빌드 필수: `cd python-backend && .\build.bat`

### 윈도우 설정 변경 시
- `src-tauri/tauri.conf.json` 수정
  - `width`, `height`: 윈도우 크기
  - `transparent`: 투명 여부
  - `alwaysOnTop`: 항상 위 여부

## 버전 정보

- **프로젝트 버전**: 1.0.0
- **개발 환경**: Windows 11
- **Python 버전**: 3.10.11 (venv)
