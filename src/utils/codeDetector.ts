/**
 * codeDetector.ts
 * 코드, JSON, 로그 자동 감지 및 포맷팅 유틸리티
 */

export type ContentType = 'json' | 'log' | 'code' | 'text';

interface DetectionResult {
  type: ContentType;
  language?: string;
  confidence: number;
}

/**
 * 텍스트 내용 분석하여 타입 감지 (단순화 버전)
 */
export function detectContentType(text: string): DetectionResult {
  const trimmed = text.trim();
  
  // JSON 감지 (최우선)
  if (isJSON(trimmed)) {
    return { type: 'json', language: 'json', confidence: 1.0 };
  }
  
  // 안드로이드 로그 감지
  if (isAndroidLog(trimmed)) {
    return { type: 'log', language: 'log', confidence: 0.9 };
  }
  
  // 일반 로그 감지 (더 엄격하게)
  if (isGeneralLog(trimmed)) {
    return { type: 'log', language: 'log', confidence: 0.8 };
  }
  
  // 코드 감지 (단순화 - 언어 구분 없이 "code"로 통일)
  if (isCode(trimmed)) {
    return { type: 'code', language: 'code', confidence: 0.8 };
  }
  
  // 일반 텍스트
  return { type: 'text', confidence: 1.0 };
}

/**
 * 코드 여부 확인 (단순화 - 언어 구분 없이 기본 패턴만 체크)
 */
function isCode(text: string): boolean {
  // 기본 코드 패턴들
  const codePatterns = [
    /\bfunction\s+\w+\s*\(/,           // 함수 선언
    /\bconst\s+\w+\s*=/,               // 변수 선언
    /\blet\s+\w+\s*=/,                 // 변수 선언
    /\bvar\s+\w+\s*=/,                 // 변수 선언
    /\bclass\s+\w+/,                   // 클래스
    /\bdef\s+\w+\s*\(/,                // Python 함수
    /\bimport\s+/,                     // import 문
    /\bfrom\s+\w+\s+import\b/,         // Python import
    /\bexport\s+(default\s+)?(function|class|const)/,  // export
    /\breturn\s+\w+/,                  // return 문
    /=>\s*[{(]/,                       // 화살표 함수
    /\w+\s*\([^)]*\)\s*\{/,            // 함수 호출 + 블록
    /{[\s\S]*}/,                       // 중괄호 블록
    /^\s*\/\//m,                       // 주석 //
    /^\s*#\s*\w+/m,                    // 주석 # 또는 전처리기
    /;\s*$/m,                          // 세미콜론 끝
  ];
  
  // 3개 이상 패턴 매칭 시 코드로 판단
  const matchCount = codePatterns.filter(pattern => pattern.test(text)).length;
  return matchCount >= 3;
}

/**
 * JSON 여부 확인
 */
function isJSON(text: string): boolean {
  if (!text.startsWith('{') && !text.startsWith('[')) return false;
  
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 안드로이드 로그 패턴 감지
 */
function isAndroidLog(text: string): boolean {
  // Android Logcat 패턴
  const logcatPattern = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+[VDIWEF]/m;
  if (logcatPattern.test(text)) return true;
  
  // 다른 Android 로그 패턴
  const androidPatterns = [
    /at\s+[\w.]+\([\w.]+:\d+\)/m, // Stack trace
    /\b(ActivityManager|WindowManager|PackageManager|System\.err):/m,
    /^[VDIWEF]\/[\w.]+\(/m, // V/TAG( PID): message
  ];
  
  return androidPatterns.some(pattern => pattern.test(text));
}

/**
 * 일반 로그 패턴 감지
 */
function isGeneralLog(text: string): boolean {
  const logPatterns = [
    /^\[\d{4}-\d{2}-\d{2}/m, // [2024-01-01
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m, // ISO timestamp
    /^\[\w+\]\s*\d{4}-\d{2}-\d{2}/m, // [INFO] 2024-01-01
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/m, // 2024-01-01 14:23:45
  ];
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return false;
  
  const logLikeLines = lines.filter(line => 
    logPatterns.some(pattern => pattern.test(line))
  );
  
  // 50% 이상이 로그 패턴이어야 로그로 판단 (더 엄격)
  return logLikeLines.length / lines.length > 0.5;
}

/**
 * 코드/로그를 HTML로 포맷팅
 */
export function formatAsCode(text: string, type: ContentType): string {
  let formattedText = text;
  
  // 고유 ID 생성
  const blockId = `code-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // JSON은 예쁘게 포맷팅
  if (type === 'json') {
    try {
      const parsed = JSON.parse(text);
      formattedText = JSON.stringify(parsed, null, 2);
    } catch {
      // 파싱 실패해도 그대로 표시
    }
  }
  
  // HTML 이스케이프
  formattedText = formattedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // 로그 레벨 색상 적용 (로그인 경우) - 라인별로 전체 색상 적용
  if (type === 'log') {
    const lines = formattedText.split('\n');
    formattedText = lines.map(line => {
      // Android Logcat 패턴 감지 (전체 라인 색상)
      const logcatMatch = line.match(/\b([VDIWEF])\//);
      if (logcatMatch) {
        const level = logcatMatch[1];
        const colors: Record<string, string> = {
          'E': '#ef4444', // ERROR - 빨강
          'F': '#ef4444', // FATAL - 빨강
          'W': '#f59e0b', // WARN - 주황
          'I': '#3b82f6', // INFO - 파랑
          'D': '#9ca3af', // DEBUG - 회색
          'V': '#6b7280', // VERBOSE - 어두운 회색
        };
        return `<span style="color: ${colors[level] || '#d4d4d4'};">${line}</span>`;
      }
      
      // 일반 로그 레벨 (전체 라인 색상)
      if (/\b(ERROR|FATAL)\b/.test(line)) {
        return `<span style="color: #ef4444;">${line}</span>`;
      }
      if (/\b(WARN|WARNING)\b/.test(line)) {
        return `<span style="color: #f59e0b;">${line}</span>`;
      }
      if (/\b(INFO)\b/.test(line)) {
        return `<span style="color: #3b82f6;">${line}</span>`;
      }
      if (/\b(DEBUG|TRACE)\b/.test(line)) {
        return `<span style="color: #9ca3af;">${line}</span>`;
      }
      if (/\b(SUCCESS|OK)\b/.test(line)) {
        return `<span style="color: #10b981;">${line}</span>`;
      }
      
      return line;
    }).join('\n');
  }
  
  return `<div class="code-block" id="${blockId}" contenteditable="false" style="
    position: relative;
    margin: 10px 0;
    background: #1e1e1e;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #2d2d2d;
      border-bottom: 1px solid #3e3e3e;
      font-family: 'NotoSansKR', 'Malgun Gothic', sans-serif;
      font-size: 11px;
    ">
      <span style="color: #9cdcfe; font-weight: 600; text-transform: uppercase;">CODE</span>
      <div style="display: flex; gap: 6px;">
        <button contenteditable="false" data-action="delete" data-block-id="${blockId}" style="
          background: transparent;
          border: 1px solid #4e4e4e;
          color: #ef4444;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
        " onmouseover="this.style.background='#3e3e3e'" onmouseout="this.style.background='transparent'">
          🗑️ 삭제
        </button>
        <button contenteditable="false" data-action="copy" data-block-id="${blockId}" style="
          background: transparent;
          border: 1px solid #4e4e4e;
          color: #9cdcfe;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
        " onmouseover="this.style.background='#3e3e3e'" onmouseout="this.style.background='transparent'">
          📋 복사
        </button>
      </div>
    </div>
    <pre style="
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    "><code>${formattedText}</code></pre>
  </div><br/>`;
}

/**
 * 붙여넣기 처리 (자동 감지 및 포맷팅)
 */
export function processPastedContent(text: string): string {
  // 내용이 너무 짧으면 일반 텍스트로 처리
  if (text.length < 50) {
    return text;
  }
  
  const detection = detectContentType(text);
  
  // JSON, 로그, 코드로 감지되면 포맷팅 적용 (임계값 0.2로 낮춤)
  if (detection.type !== 'text' && detection.confidence > 0.2) {
    return formatAsCode(text, detection.type);
  }
  
  return text;
}
