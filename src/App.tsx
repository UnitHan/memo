import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { detectSensitiveInfo } from './utils/security';
import { addToBlockedKeywords } from './utils/keywordDB';
import { loadApiKey } from './utils/apiKeyStorage';
import { processPastedContent } from './utils/codeDetector';
import { initDataBackup } from './utils/dataBackup';
import { initNetworkMonitor, isNetworkOnline, waitForNetwork } from './utils/networkMonitor';
import { KeywordManager } from './components/KeywordManager';
import { AlertModal } from './components/AlertModal';
import { VoiceRecorder } from './utils/voiceRecorder';

// Windows Sticky Notes 파스텔 색상 (정확한 복제)
const STICKY_COLORS = [
  { name: '노랑', bg: 'rgb(255, 251, 149)', text: 'rgb(51, 51, 51)' },
  { name: '핑크', bg: 'rgb(246, 197, 224)', text: 'rgb(51, 51, 51)' },
  { name: '연두', bg: 'rgb(202, 242, 192)', text: 'rgb(51, 51, 51)' },
  { name: '하늘', bg: 'rgb(179, 229, 252)', text: 'rgb(51, 51, 51)' },
  { name: '연보라', bg: 'rgb(217, 202, 255)', text: 'rgb(51, 51, 51)' },
  { name: '회색', bg: 'rgb(224, 224, 224)', text: 'rgb(51, 51, 51)' },
];

interface LinkPreviewMeta {
  title: string;
  description: string;
  image: string;
  domain: string;
  url: string;
  favicon: string;
}

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rust에서 HTML 파싱 시 한국어가 &#xBA54; 같은 엔티티로 올 수 있으므로 디코딩
function decodeHtmlEntities(s: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

const isUrl = (s: string) => /^https?:\/\/[^\s]{4,}$/.test(s);

function buildLinkCardHtml(meta: LinkPreviewMeta): string {
  const title = escHtml(decodeHtmlEntities(meta.title || meta.domain || meta.url));
  const desc  = meta.description ? escHtml(decodeHtmlEntities(meta.description)) : '';
  const img   = meta.image?.startsWith('http')
    ? `<img src="${escHtml(meta.image)}" style="width:72px;height:52px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
    : '';
  const copyBtn =
    `<button data-action="copy-link" data-url="${escHtml(meta.url)}" title="URL 복사"` +
    ` style="flex-shrink:0;border:none;background:rgba(0,0,0,0.07);border-radius:6px;width:28px;height:28px;` +
    `cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
    `</svg></button>`;
  return (
    `<div contenteditable="false" data-type="link-card" data-url="${escHtml(meta.url)}"` +
    ` style="border-radius:10px;border:1px solid rgba(0,0,0,0.13);padding:10px 12px;margin:4px 0;` +
    `display:flex;align-items:center;gap:10px;cursor:pointer;background:rgba(255,255,255,0.5);` +
    `backdrop-filter:blur(8px);max-width:100%;box-shadow:0 1px 4px rgba(0,0,0,0.08);" data-action="open-link">` +
    `<img src="${escHtml(meta.favicon)}" width="14" height="14" style="border-radius:2px;flex-shrink:0;margin-top:2px;" onerror="this.style.display='none'">` +
    `<div style="flex:1;min-width:0;overflow:hidden;">` +
    `<div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</div>` +
    (desc ? `<div style="font-size:11px;opacity:0.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;">${desc}</div>` : '') +
    `<div style="font-size:10px;opacity:0.38;margin-top:3px;">${escHtml(meta.domain)}</div>` +
    `</div>${img}${copyBtn}</div><br>`
  );
}

function App() {
  const [text, setText] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [opacity, setOpacity] = useState(0.95);
  const [fontSize, setFontSize] = useState(15);
  const [showKeywordManager, setShowKeywordManager] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isCollapsedRef = useRef(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const preCollapseHeight = useRef<number>(500);
  const [isDragOver, setIsDragOver] = useState(false);

  // 음성 녹음 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);

  // 알림 모달 상태
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'warning';
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    message: '',
    onConfirm: () => {},
  });

  // 최대화 상태 추적 (커스텀 타이틀바 아이콘 전환용)
  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized).catch(() => {});
    let unlisten: (() => void) | undefined;
    win.onResized(async () => {
      const max = await win.isMaximized().catch(() => false);
      setIsMaximized(max);
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    // 📦 데이터 백업 시스템 초기화 (최우선)
    initDataBackup().then((restored) => {
      console.log('🔄 백업 시스템 활성화 완료');
      if (restored) {
        // 조용히 복원 (재시작마다 팝업 방지)
        console.log('✅ 이전 메모 데이터 자동 복원 완료');
      }
    }).catch((error) => {
      console.error('❌ 백업 시스템 초기화 실패:', error);
    });
    
    // 🌐 네트워크 모니터링 시작
    const cleanupNetworkMonitor = initNetworkMonitor(
      () => console.log('✅ 네트워크 재연결 - AI 교정 다시 사용 가능'),
      () => console.warn('❌ 네트워크 연결 끊김 - AI 교정 사용 불가')
    );

    // 🎨 투명도 실시간 미리보기 이벤트 수신 (설정 창에서 슬라이더 드래그 시)
    let unlistenOpacity: (() => void) | undefined;
    listen<number>('opacity-preview', (e) => {
      setOpacity(e.payload);
      // localStorage도 즉시 동기화 → focus 이벤트 시 구값으로 되돌아가는 버그 방지
      localStorage.setItem('window_opacity', e.payload.toString());
    }).then(fn => { unlistenOpacity = fn; });
    
    const savedKey = loadApiKey();
    console.log('🔑 localStorage에서 API 키 로드:', savedKey ? `***${savedKey.slice(-8)}` : '비어있음');
    setApiKey(savedKey);
    
    // 투명도 로드
    const savedOpacity = localStorage.getItem('window_opacity');
    if (savedOpacity) {
      const opacityValue = parseFloat(savedOpacity);
      setOpacity(opacityValue);
      console.log('💎 투명도 로드:', Math.round(opacityValue * 100) + '%');
    }

    // 자동 저장된 메모 불러오기
    const autoSavedMemo = localStorage.getItem('auto_saved_memo');
    if (autoSavedMemo) {
      setText(autoSavedMemo);
      if (editorRef.current) {
        editorRef.current.innerHTML = autoSavedMemo;
      }
      console.log('💾 자동 저장된 메모 복원:', autoSavedMemo.substring(0, 50) + '...');
    }

    // 복원할 메모 확인 (메모 보관함에서 복원)
    const restoreMemo = localStorage.getItem('restore_memo');
    if (restoreMemo) {
      setText(restoreMemo);
      if (editorRef.current) {
        editorRef.current.innerHTML = restoreMemo;
      }
      localStorage.removeItem('restore_memo');
      console.log('📋 메모 복원됨');
    }
    
    // 윈도우 즉시 표시 (빠른 시작)
    getCurrentWindow().show().then(() => {
      console.log('✅ 앱 준비 완료');
    });
    
    // Gemini API 연결 테스트 (백그라운드)
    if (savedKey) {
      console.log('🔑 Gemini API 키 발견 - 백그라운드에서 연결 테스트 중...');
      setTimeout(() => testApiConnection(savedKey), 500);
    } else {
      console.warn('⚠️ Gemini API 키가 설정되지 않았습니다.');
      console.log('💡 설정(⚙️) 버튼을 눌러 API 키를 등록하세요.');
    }

    // 코드 블록 버튼 이벤트 위임 (동적 생성되는 버튼 처리)
    const handleCodeBlockButtons = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 링크 카드 복사 버튼 클릭
      const copyLinkBtn = target.closest('[data-action="copy-link"]') as HTMLElement | null;
      if (copyLinkBtn) {
        e.preventDefault();
        e.stopPropagation();
        const url = copyLinkBtn.dataset.url || '';
        if (url) {
          writeText(url).then(() => {
            const svg = copyLinkBtn.querySelector('svg');
            if (svg) {
              copyLinkBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
              setTimeout(() => {
                copyLinkBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
              }, 1500);
            }
          }).catch(console.error);
        }
        return;
      }

      // 링크 카드 클릭 처리
      const card = target.closest('[data-type="link-card"]') as HTMLElement | null;
      if (card?.dataset?.url) {
        e.preventDefault();
        e.stopPropagation();
        const url = card.dataset.url;
        if (/^https?:\/\//.test(url)) {
          openUrl(url).catch(console.error);
        }
        return;
      }

      const button = target.closest('button');
      
      console.log('🔍 Click event:', {
        target: target.tagName,
        button: button?.tagName,
        action: button?.dataset?.action,
        blockId: button?.dataset?.blockId
      });
      
      if (!button) return;
      
      // 코드 블록 버튼인 경우 기본 동작 차단
      if (button.dataset.action === 'delete' || button.dataset.action === 'copy') {
        e.preventDefault();
        e.stopPropagation();
      }
      
      // 삭제 버튼 (삭제는 mousedown 단계에서 처리됨)
      if (button.dataset.action === 'delete') {
        return;
      }
      
      // 복사 버튼
      if (button.dataset.action === 'copy') {
        console.log('📋 복사 버튼 클릭 감지');
        
        const blockId = button.dataset.blockId;
        const block = document.getElementById(blockId!);
        const code = block ? block.querySelector('code')?.textContent || '' : '';
        
        navigator.clipboard.writeText(code).then(() => {
          const original = button.textContent;
          button.textContent = '✓ 복사됨';
          button.style.color = '#10b981';
          setTimeout(() => {
            button.textContent = original!;
            button.style.color = '#9cdcfe';
          }, 2000);
        });
      }
    };

    // mousedown도 차단 (contenteditable과의 충돌 방지)
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      
      if (!button) return;

      if (button.dataset.action === 'delete' || button.dataset.action === 'copy') {
        console.log('🖱️ mousedown 차단');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      if (button.dataset.action === 'delete') {
        console.log('🗑️ 삭제 버튼 mousedown 감지');

        void (async () => {
          console.log('⚠️ Confirm 모달 표시 전');
          const confirmed = await showAlert('이 코드 블록을 삭제하시겠습니까?', 'confirm');
          console.log('✅ Confirm 결과:', confirmed);

          if (!confirmed) {
            console.log('❌ 사용자가 취소함');
            return;
          }

          const blockId = button.dataset.blockId;
          console.log('🔍 삭제할 블록 ID:', blockId);

          const block = document.getElementById(blockId!);
          if (block) {
            console.log('📦 블록 찾음, 삭제 시작');
            const br = block.nextElementSibling;
            block.remove();
            if (br && br.tagName === 'BR') {
              br.remove();
            }
            console.log('✅ DOM 삭제 완료');

            // React state 업데이트
            if (editorRef.current) {
              const newHtml = editorRef.current.innerHTML;
              console.log('📝 React state 업데이트:', newHtml.substring(0, 100));
              setText(newHtml);
              console.log('💾 setText 호출 완료');
            }
          } else {
            console.error('❌ 블록을 찾을 수 없음:', blockId);
          }
        })();
      }
    };

    console.log('🎯 이벤트 리스너 등록');
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('click', handleCodeBlockButtons);

    // ESC 키로 접기/펼치기 토글
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        const win = getCurrentWindow();
        if (isCollapsedRef.current) {
          await win.setSize(new LogicalSize(320, preCollapseHeight.current));
          isCollapsedRef.current = false;
          setIsCollapsed(false);
        } else {
          try {
            const sz = await win.innerSize();
            const sf = await win.scaleFactor();
            const logicalH = Math.round(sz.height / sf);
            if (logicalH > 44) preCollapseHeight.current = logicalH;
          } catch { /* 기본값 유지 */ }
          isCollapsedRef.current = true;
          setIsCollapsed(true);
          await win.setSize(new LogicalSize(320, 32));
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      console.log('🗑️ 이벤트 리스너 해제');
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('click', handleCodeBlockButtons);
      document.removeEventListener('keydown', handleKeyDown);
      cleanupNetworkMonitor();
      unlistenOpacity?.();
    };
  }, []);

  // window focus 이벤트로 복원 메모 실시간 체크 + API 키 재로드
  useEffect(() => {
    const handleFocus = () => {
      // 메모 복원 체크
      const restoreMemo = localStorage.getItem('restore_memo');
      if (restoreMemo) {
        setText(restoreMemo);
        if (editorRef.current) {
          editorRef.current.innerHTML = restoreMemo;
        }
        setCorrectedText(''); // 교정된 텍스트 초기화
        localStorage.removeItem('restore_memo');
        console.log('📋 메모 복원됨 (focus):', restoreMemo.substring(0, 50) + '...');
      }
      
      // API 키 재로드 (설정 창에서 변경된 경우)
      const currentKey = loadApiKey();
      if (currentKey && currentKey !== apiKey) {
        setApiKey(currentKey);
        console.log('🔑 API 키 갱신됨 (focus):', `***${currentKey.slice(-8)}`);
      }
      
      // 💡 투명도는 focus 시 재로드하지 않음
      // (설정 창 슬라이더 이벤트 & 저장 버튼으로만 변경 가능)
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [apiKey, opacity]);

  // 텍스트 변경 시 자동 저장 (debounce)
  useEffect(() => {
    console.log('📝 text state 변경됨:', text.length, '글자');
    const timeoutId = setTimeout(() => {
      if (text.trim()) {
        // localStorage 용량 체크 (5MB 제한)
        if (text.length > 5 * 1024 * 1024) {
          const sizeMB = (text.length / 1024 / 1024).toFixed(2);
          console.warn(`⚠️ 메모 크기가 너무 큽니다 (${sizeMB}MB). 자동 저장을 건너뜁니다.`);
          return;
        }
        
        try {
          localStorage.setItem('auto_saved_memo', text);
          console.log('💾 자동 저장 완료:', text.substring(0, 100) + '...');
          console.log('💾 localStorage 크기:', text.length, '글자');
        } catch (error) {
          console.error('❌ 자동 저장 실패:', error);
          console.warn('⚠️ localStorage 용량 초과. 파일로 저장하세요.');
        }
      }
    }, 1000); // 1초 후 저장

    return () => clearTimeout(timeoutId);
  }, [text]);

  // API 연결 테스트
  const testApiConnection = async (key: string) => {
    try {
      await invoke('correct_text', {
        apiKey: key,
        text: 'test'
      });
      console.log('✅ Gemini API 연결 성공! (모델: gemini-2.5-flash)');
      console.log('📝 텍스트 교정 준비 완료');
    } catch (error) {
      console.error('❌ Gemini API 연결 실패:', error);
      console.log('💡 설정에서 올바른 API 키를 입력하세요.');
    }
  };

  // 커스텀 알림 함수
  const showAlert = (message: string, type: 'alert' | 'confirm' | 'warning' = 'alert') => {
    return new Promise<boolean>((resolve) => {
      setAlertModal({
        isOpen: true,
        type,
        message,
        onConfirm: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  };

  const handleCorrect = async () => {
    if (!apiKey) {
      setAlertModal({
        isOpen: true,
        type: 'alert',
        title: 'API Key 미등록',
        message: '[보관함 > 설정] 에서 Gemini API Key 등록하세요.',
        confirmText: '확인',
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    if (!text.trim()) {
      await showAlert('텍스트를 입력해주세요.');
      return;
    }

    // 민감 정보 감지 (3단계 검사)
    const warnings = detectSensitiveInfo(text);
    if (warnings.length > 0) {
      const warningMessage = warnings
        .map(w => `🔴 ${w.type}: ${w.pattern}\n→ 제안: ${w.suggestion} (출처: ${w.source})`)
        .join('\n\n');

      setAlertModal({
        isOpen: true,
        type: 'confirm',
        title: '민감 정보 감지',
        message: `${warningMessage}\n\n계속 진행하시겠습니까?\n(취소하면 이 패턴을 학습하여 다음부터 자동 차단)`,
        onConfirm: async () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          // 계속 진행
          await executeCorrection();
        },
        onCancel: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          // 사용자가 취소 → 학습 DB에 추가
          warnings.forEach(w => {
            if (w.pattern && w.pattern !== '****' && w.pattern !== '금액 표현') {
              addToBlockedKeywords(w.pattern);
            }
          });
          showAlert('✅ 패턴을 학습했습니다. 다음부터 자동으로 차단됩니다.');
        },
      });
      return;
    }

    await executeCorrection();
  };

  const executeCorrection = async (retryCount = 0) => {
    // 1. 네트워크 연결 체크
    if (!isNetworkOnline()) {
      console.warn('📡 오프라인 상태 감지');
      
      const shouldWait = await showAlert(
        '네트워크 연결이 끊어진 상태입니다.\n\n연결을 기다리시겠습니까? (최대 10초)',
        'confirm'
      );
      
      if (shouldWait) {
        setIsLoading(true);
        const connected = await waitForNetwork(10000);
        setIsLoading(false);
        
        if (!connected) {
          await showAlert('네트워크 연결 시간 초과.\n인터넷 연결을 확인해주세요.');
          return;
        }
      } else {
        return;
      }
    }
    
    // 2. 재시도 시 API Key 재로드 (절전 모드 복구 대응)
    if (retryCount > 0) {
      const freshApiKey = loadApiKey();
      if (freshApiKey && freshApiKey !== apiKey) {
        console.log('🔑 API 키 재로드됨 (절전 모드 복구)');
        setApiKey(freshApiKey);
      }
    }
    
    // 3. API Key 유효성 체크
    const currentApiKey = retryCount > 0 ? loadApiKey() : apiKey;
    if (!currentApiKey) {
      await showAlert('API 키가 설정되지 않았습니다.\n설정(⚙️)에서 API 키를 등록해주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await invoke<string>('correct_text', {
        apiKey: currentApiKey,
        text: text
      });

      // Rust가 이미 corrected_text 문자열만 반환함 (JSON 파싱 불필요)
      setCorrectedText(result);
      // 교정된 텍스트를 메모에 반영
      setText(result);
      console.log('✅ 텍스트가 교정되어 메모에 반영되었습니다');
    } catch (error) {
      // 기술 정보 필터링 (추가 보안)
      const errorMsg = String(error);
      console.error('🔴 Gemini API 오류:', errorMsg);
      
      // 사용자에게는 정제된 메시지만 표시
      let userMsg = errorMsg;
      
      // 네트워크 연결 오류 감지 (타임아웃, 연결 실패)
      const isNetworkError = 
        errorMsg.toLowerCase().includes('timeout') ||
        errorMsg.toLowerCase().includes('connection') ||
        errorMsg.toLowerCase().includes('network') ||
        errorMsg.toLowerCase().includes('failed to execute');
      
      if (isNetworkError && retryCount < 1) {
        console.log('🔄 네트워크 오류 감지 - 재시도 시도');
        setIsLoading(false);
        
        const shouldRetry = await showAlert(
          '네트워크 연결이 불안정합니다.\n\n다시 시도하시겠습니까?',
          'confirm'
        );
        
        if (shouldRetry) {
          console.log('♻️ 재시도 중...');
          await executeCorrection(retryCount + 1);
          return;
        }
      }
      
      // 혹시 Python 필터링을 우회한 기술 정보 제거
      if (userMsg.includes('googleapis.com') || userMsg.includes('generativelanguage')) {
        userMsg = '텍스트 교정 중 오류가 발생했습니다.\n설정을 확인하거나 잠시 후 다시 시도해주세요.';
      }
      
      // 네트워크 오류인 경우 친화적 메시지로 변경
      if (isNetworkError) {
        userMsg = '네트워크 연결이 불안정합니다.\n\n인터넷 연결을 확인하거나\n절전 모드 해제 후 다시 시도해주세요.';
      }
      
      await showAlert(`${userMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await writeText(correctedText);
      await showAlert('✅ 클립보드에 복사되었습니다!');
    } catch (error) {
      await showAlert(`❌ 복사 실패: ${error}`);
    }
  };

  const openSettingsWindow = async (_openConfigModal = false) => {
    try {
      await invoke('open_settings_window');
    } catch (error) {
      console.error('❌ 윈도우 열기 오류:', error);
      await showAlert('설정 창을 열 수 없습니다. 앱을 다시 실행해주세요.');
    }
  };

  // 파일 드래그 드롭
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const textExts = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.log', '.yaml', '.yml', '.toml', '.ini', '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.css', '.scss'];

    const setup = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
        const type = event.payload.type;
        if (type === 'enter' || type === 'over') {
          setIsDragOver(true);
        } else if (type === 'leave') {
          setIsDragOver(false);
        } else if (type === 'drop') {
          setIsDragOver(false);
          const paths: string[] = (event.payload as { paths?: string[] }).paths ?? [];
          for (const p of paths) {
            const lower = p.toLowerCase();
            if (!textExts.some(ext => lower.endsWith(ext))) continue;
            try {
              const content = await readTextFile(p);
              if (editorRef.current) {
                editorRef.current.focus();
                const escaped = content
                  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br>');
                document.execCommand('insertHTML', false, escaped);
              }
            } catch { /* 읽기 실패 시 무시 */ }
          }
        }
      });
    };
    setup();
    return () => { unlisten?.(); };
  }, []);

  const handleCollapse = async () => {
    const win = getCurrentWindow();
    if (isCollapsedRef.current) {
      await win.setSize(new LogicalSize(320, preCollapseHeight.current));
      isCollapsedRef.current = false;
      setIsCollapsed(false);
    } else {
      try {
        const sz = await win.innerSize();
        const sf = await win.scaleFactor();
        const logicalH = Math.round(sz.height / sf);
        if (logicalH > 44) preCollapseHeight.current = logicalH;
      } catch { /* 기본값 500 유지 */ }
      isCollapsedRef.current = true;
      setIsCollapsed(true);
      await win.setSize(new LogicalSize(320, 32));
    }
  };

  // 음성 녹음 시작
  const handleStartRecording = async () => {
    try {
      const recorder = new VoiceRecorder();
      voiceRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      setInterimTranscript('');

      await recorder.start(
        // 수신 부분 텍스트: 최종 결과인 경우 메모에 삽입, 중간 결과는 상태로만
        (text, isFinal) => {
          if (isFinal) {
            setInterimTranscript('');
            if (editorRef.current) {
              editorRef.current.focus();
              document.execCommand('insertText', false, text + ' ');
              setText(editorRef.current.innerHTML);
            }
          } else {
            setInterimTranscript(text);
          }
        },
        (seconds) => setRecordingSeconds(seconds),
      );
    } catch (err) {
      setIsRecording(false);
      console.error('마이크 접근 실패:', err);
      await showAlert('마이크에 접근할 수 없습니다.\nWindows 설정 > 개인 정보 > 마이크 마이크 접수를 확인해주세요.');
    }
  };

  // 녹음 중지 + MP3 저장
  const handleStopRecording = async () => {
    setIsRecording(false);
    setInterimTranscript('');
    const recorder = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    if (!recorder) return;

    try {
      const savedPath = await recorder.stop();
      await showAlert(`🎵 저장 완료!\n${savedPath}`);
    } catch (err) {
      await showAlert(`❌ 녹음 저장 실패\n${err}`);
    }
  };
  // 새 메모 생성
  const handleNewMemo = () => {
    if (text.trim() || correctedText.trim()) {
      setAlertModal({
        isOpen: true,
        type: 'confirm',
        title: '새 메모',
        message: '현재 메모를 지우고 새 메모를 작성하시겠습니까?',
        confirmText: '확인',
        cancelText: '취소',
        onConfirm: () => {
          // 기존 메모를 히스토리에 저장
          const contentToSave = correctedText || text;
          if (contentToSave.trim()) {
            try {
              const historyStr = localStorage.getItem('memo_history') || '[]';
              const history = JSON.parse(historyStr);
              
              // 새 메모를 맨 앞에 추가 (최신순)
              const now = Date.now();
              history.unshift({
                id: `${now}-${crypto.randomUUID()}`,
                content: contentToSave,
                timestamp: now
              });
              
              // 최대 50개까지만 저장
              if (history.length > 50) {
                history.pop();
              }
              
              localStorage.setItem('memo_history', JSON.stringify(history));
              console.log('💾 메모 히스토리에 저장:', contentToSave.substring(0, 30) + '...');
            } catch (e) {
              console.error('메모 저장 실패:', e);
            }
          }
          
          setText('');
          setCorrectedText('');
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
          localStorage.removeItem('auto_saved_memo');
          setAlertModal({ ...alertModal, isOpen: false });
          console.log('📝 새 메모 생성');
        },
        onCancel: () => {
          setAlertModal({ ...alertModal, isOpen: false });
        },
      });
    } else {
      setText('');
      setCorrectedText('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      localStorage.removeItem('auto_saved_memo');
    }
  };

  // 텍스트 포맷 적용 (HTML execCommand 사용)
  const applyFormat = (formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'bullet') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      showAlert('포맷을 적용할 텍스트를 선택해주세요.');
      return;
    }

    switch (formatType) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'strikethrough':
        document.execCommand('strikeThrough', false);
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList', false);
        break;
    }

    console.log(`✏️ ${formatType} 포맷 적용`);
  };

  // Ctrl + 마우스 휠로 텍스트 크기 조절
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      
      setFontSize(prevSize => {
        let newSize = prevSize;
        
        // 휠 위로 = 확대, 휠 아래로 = 축소
        if (e.deltaY < 0) {
          newSize = Math.min(prevSize + 1, 32); // 최대 32px
        } else {
          newSize = Math.max(prevSize - 1, 10); // 최소 10px
        }
        
        console.log(`🔍 텍스트 크기: ${newSize}px`);
        return newSize;
      });
    }
  };

  // 이미지 삽입 (Tauri 파일 다이얼로그)
  const handleInsertImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{
          name: '이미지',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        }]
      });
      
      if (selected && editorRef.current) {
        const imagePath = Array.isArray(selected) ? selected[0] : selected;
        
        // 파일을 base64로 변환
        const base64Image = await invoke<string>('read_image_as_base64', { path: imagePath });
        
        // 파일 확장자로 MIME 타입 결정
        const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'bmp': 'image/bmp',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        
        // 에디터에 포커스
        editorRef.current.focus();
        
        // 이미지 HTML 생성
        const imgHtml = `<img src="data:${mimeType};base64,${base64Image}" alt="이미지" style="max-width: 100%; height: auto; display: block; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" /><br />`;
        
        // document.execCommand로 이미지 삽입
        document.execCommand('insertHTML', false, imgHtml);
        
        // text 상태 업데이트
        setText(editorRef.current.innerHTML);
        
        console.log('🖼️ 이미지 삽입 완료');
      }
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      await showAlert(`❌ 이미지 삽입 실패: ${error}`);
    }
  };

  const currentColor = STICKY_COLORS[colorIndex];
  const nextColor = () => setColorIndex((colorIndex + 1) % STICKY_COLORS.length);

  // 투명도 < 45% 시 텍스트를 흰색으로 → 어두운 배경에서도 읽힘
  const isDimmed = opacity < 0.45;
  const textColor = isDimmed ? '#fff' : currentColor.text;
  const textShadowStr = isDimmed ? '0 1px 3px rgba(0,0,0,0.85)' : 'none';

  return (
    <>
    <div
      className="h-screen flex flex-col relative"
      style={{
        /* CSS opacity 로 헤더·에디터·툴바·버튼 전체가 균일하게 투명해짐 */
        opacity: opacity,
        backgroundColor: currentColor.bg,
        color: textColor,
        textShadow: textShadowStr,
        boxShadow: opacity > 0.05 ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
        fontFamily: "'NotoSansKR', 'Malgun Gothic', sans-serif",
        transition: 'opacity 0.1s, color 0.3s, text-shadow 0.3s',
      }}
    >
      {/* ── 커스텀 타이틀바 (Windows 11 네이티브 스타일) ── */}
      <div
        className="flex items-center select-none"
        style={{
          height: 32,
          flexShrink: 0,
          WebkitAppRegion: 'drag',
          background: 'rgba(0,0,0,0.07)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        } as React.CSSProperties}
      >
        {/* 앱 아이콘 + 제목 / 접힌 상태면 펼치기 플로팅 버튼 */}
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10,
            WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
        >
          {isCollapsed ? (
            /* 접힌 상태: 중앙 펼치기 버튼 */
            <button
              onClick={handleCollapse}
              title="펼치기"
              style={{
                WebkitAppRegion: 'no-drag',
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, padding: '2px 6px',
                borderRadius: 6, color: 'inherit', opacity: 0.55,
                transition: 'opacity 0.15s, background 0.15s',
                fontSize: 11, fontWeight: 500,
              } as React.CSSProperties}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 1.5H12.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 12.5H1.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5 1.5L8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M1.5 12.5L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>AI 메모장</span>
            </button>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.9, flexShrink: 0 }}>
                <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="3.5" y1="4.5" x2="10.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="3.5" y1="7" x2="8.5" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="3.5" y1="9.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, letterSpacing: 0.1 }}>AI 메모장</span>
            </>
          )}
        </div>

        {/* Windows 11 스타일 창 컨트롤 버튼 */}
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* 최소화 */}
          <button
            onClick={() => getCurrentWindow().minimize()}
            title="최소화"
            style={{ width: 44, height: 32, border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              color: 'inherit', opacity: 0.75, transition: 'background 0.12s, opacity 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.75'; }}
          >
            <svg width="11" height="1" viewBox="0 0 11 1" fill="none">
              <line x1="0.5" y1="0.5" x2="10.5" y2="0.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* 최대화 / 복원 */}
          <button
            onClick={async () => {
              await getCurrentWindow().toggleMaximize();
              const max = await getCurrentWindow().isMaximized().catch(() => false);
              setIsMaximized(max);
            }}
            title={isMaximized ? '복원' : '최대화'}
            style={{ width: 44, height: 32, border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              color: 'inherit', opacity: 0.75, transition: 'background 0.12s, opacity 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.75'; }}
          >
            {isMaximized ? (
              /* 복원 아이콘 (두 겹 사각형) */
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="3" y="0.5" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M0.5 3.5V10H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              /* 최대화 아이콘 (단순 사각형) */
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="0.5" y="0.5" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.1"/>
              </svg>
            )}
          </button>

          {/* 닫기 */}
          <button
            onClick={() => getCurrentWindow().close()}
            title="닫기"
            style={{ width: 44, height: 32, border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              color: 'inherit', opacity: 0.75, transition: 'background 0.12s, opacity 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,43,28,0.85)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'inherit'; e.currentTarget.style.opacity = '0.75'; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="0.7" y1="0.7" x2="9.3" y2="9.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="9.3" y1="0.7" x2="0.7" y2="9.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── 서브헤더: 투명도 슬라이더 + 접기 + 보관함 ── */}
      <div
        className="flex items-center select-none"
        style={{
          height: 44,
          flexShrink: 0,
          WebkitAppRegion: 'drag',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        } as React.CSSProperties}
      >
        {/* 슬라이더 — 왼쪽 여백 포함 full stretch */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <input
            type="range" min="0" max="1" step="0.05"
            value={opacity}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setOpacity(v);
              localStorage.setItem('window_opacity', v.toString());
            }}
            style={{ width: '100%', height: 3, cursor: 'pointer', accentColor: 'rgba(0,0,0,0.45)' }}
            title={`투명도: ${Math.round(opacity * 100)}%`}
          />
        </div>

        {/* 오른쪽 버튼 그룹 */}
        <div
          className="flex items-center gap-1 pr-4"
          style={{ WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 10 } as React.CSSProperties}
        >
          {/* 접기/펼치기 */}
          <button
            onClick={handleCollapse}
            title={isCollapsed ? '펼치기' : '접기'}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.55)', cursor: 'pointer' }}
          >
            {isCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 1.5H12.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 12.5H1.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5 1.5L8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M1.5 12.5L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 5.5V1.5H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5 8.5V12.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1.5 1.5L6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12.5 12.5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          {/* 메모 보관함 */}
          <button
            onClick={() => openSettingsWindow(false)}
            title="메모 보관함"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.55)', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1.2" fill="currentColor"/>
              <rect x="8"   y="1.5" width="4.5" height="4.5" rx="1.2" fill="currentColor"/>
              <rect x="1.5" y="8"   width="4.5" height="4.5" rx="1.2" fill="currentColor"/>
              <rect x="8"   y="8"   width="4.5" height="4.5" rx="1.2" fill="currentColor"/>
            </svg>
          </button>

          {/* 종료 버튼 → 커스텀 타이틀바로 이전됨 */}
        </div>
      </div>

      {/* 텍스트 입력 영역 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: isCollapsed ? 'none' : undefined }}>
        {/* 파일 드롭 오버레이 */}
        {isDragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(99,102,241,0.12)',
            border: '2px dashed rgba(99,102,241,0.55)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="6" width="24" height="20" rx="3" stroke="rgba(99,102,241,0.7)" strokeWidth="1.8"/>
              <path d="M10 6V4a2 2 0 012-2h8a2 2 0 012 2v2" stroke="rgba(99,102,241,0.7)" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M16 13v8M12 17l4-4 4 4" stroke="rgba(99,102,241,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 12, color: 'rgba(99,102,241,0.85)', fontWeight: 600 }}>파일을 놓으세요</span>
          </div>
        )}
        {/* 플로팅 새 메모 버튼 */}
        <button
          onClick={handleNewMemo}
          className="flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontSize: 24,
            fontWeight: 300,
            lineHeight: 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 10,
            border: 'none',
            cursor: 'pointer',
          } as React.CSSProperties}
          title="새 메모"
        >
          +
        </button>
        <div
          ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          const target = e.target as HTMLDivElement;
          console.log('⌨️ onInput 이벤트 발생:', target.innerHTML.substring(0, 100));
          setText(target.innerHTML);
        }}
        onPaste={async (e) => {
          e.preventDefault();
          const pastedText = e.clipboardData.getData('text/plain').trim();

          // URL 감지 → 링크 카드
          if (isUrl(pastedText)) {
            const pid = `lp-${Date.now()}`;
            document.execCommand('insertHTML', false,
              `<span id="${pid}" contenteditable="false" style="display:inline-block;padding:5px 10px;border-radius:6px;background:rgba(0,0,0,0.07);font-size:12px;opacity:0.65;">` +
              `🔗 링크 불러오는 중...</span>`
            );
            try {
              const meta = await invoke<LinkPreviewMeta>('fetch_link_preview', { url: pastedText });
              const ph = document.getElementById(pid);
              if (ph) ph.outerHTML = buildLinkCardHtml(meta);
            } catch {
              const ph = document.getElementById(pid);
              if (ph) ph.outerHTML = `<a href="${escHtml(pastedText)}" style="color:inherit;word-break:break-all;">${escHtml(pastedText)}</a>`;
            }
            if (editorRef.current) setText(editorRef.current.innerHTML);
            return;
          }

          // 기존 코드/대용량 처리
          if (pastedText.length > 5 * 1024 * 1024) {
            const sizeMB = (pastedText.length / 1024 / 1024).toFixed(2);
            showAlert(`⚠️ 붙여넣기한 내용이 너무 큽니다 (${sizeMB}MB).\n\n파일로 저장하거나 분할해서 붙여넣기해주세요.`);
            return;
          }
          
          // 코드/로그 자동 감지 및 포맷팅
          const processed = processPastedContent(pastedText);
          
          // HTML 태그가 포함되어 있으면 코드 블록 → insertHTML 사용
          // 일반 텍스트면 → insertText 사용 (배경색 등 서식 제거)
          if (processed.includes('<')) {
            document.execCommand('insertHTML', false, processed);
          } else {
            document.execCommand('insertText', false, processed);
          }
          
          // 대용량 안내 메시지 (1MB 초과)
          if (pastedText.length > 1024 * 1024) {
            const sizeMB = (pastedText.length / 1024 / 1024).toFixed(2);
            console.log(`📊 대용량 텍스트 붙여넣기: ${sizeMB}MB`);
          }
        }}
        onCopy={(e) => {
          // 복사 시 순수 텍스트만 클립보드에 저장 (배경색 등 서식 제거)
          e.preventDefault();
          const selection = window.getSelection();
          if (selection) {
            const plainText = selection.toString();
            e.clipboardData.setData('text/plain', plainText);
            console.log('📋 순수 텍스트 복사:', plainText.substring(0, 50) + '...');
          }
        }}
        onWheel={handleWheel}
        className="w-full px-6 py-3 resize-none outline-none overflow-auto"
        style={{
          backgroundColor: 'transparent',
          fontSize: `${fontSize}px`,
          lineHeight: '1.6',
          fontFamily: 'inherit',
          color: 'inherit',
          minHeight: '100px',
          height: '100%',
        }}
        data-placeholder="메모를 작성하세요..."
      />
      {/* 받아쓰기 중간 결과 오버레이 */}
      {interimTranscript && (
        <div style={{
          position: 'absolute', bottom: 8, left: 12, right: 12,
          background: 'rgba(239,68,68,0.85)', color: '#fff',
          borderRadius: 8, padding: '4px 10px', fontSize: 12,
          pointerEvents: 'none', backdropFilter: 'blur(4px)',
        }}>
          🎤 {interimTranscript}
        </div>
      )}
      </div>

      {/* 하단 포맷 툴바 */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-t"
        style={{
          borderTopColor: 'rgba(0,0,0,0.08)',
          display: isCollapsed ? 'none' : undefined,
        }}
      >
        {/* 서식 버튼 그룹 — macOS 스타일 라운드 pill */}
        <div
          className="flex items-center gap-0.5 px-2 py-1.5"
          style={{
            background: 'rgba(0,0,0,0.06)',
            borderRadius: 12,
          }}
        >
          {[
            { cmd: 'bold'          as const, label: <span style={{ fontWeight: 800, fontSize: 14, fontFamily: 'system-ui' }}>B</span>,                                                  title: '굵게' },
            { cmd: 'italic'        as const, label: <span style={{ fontStyle: 'italic', fontSize: 15, fontFamily: 'Georgia,serif', fontWeight: 700, letterSpacing: '-0.5px' }}>I</span>, title: '기울임꼴' },
            { cmd: 'underline'     as const, label: <span style={{ textDecoration: 'underline', fontSize: 14, fontWeight: 700 }}>U</span>,                                               title: '밑줄' },
            { cmd: 'strikethrough' as const, label: <span style={{ textDecoration: 'line-through', fontSize: 14, fontWeight: 700 }}>S</span>,                                            title: '취소선' },
          ].map(({ cmd, label, title }) => (
            <button
              key={cmd}
              onClick={() => applyFormat(cmd)}
              title={title}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-black/10 active:scale-95"
              style={{ color: 'rgba(0,0,0,0.65)' }}
            >
              {label}
            </button>
          ))}

          {/* 구분선 */}
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />

          {/* 글머리 기호 */}
          <button
            onClick={() => applyFormat('bullet')}
            title="글머리 기호"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-black/10 active:scale-95"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="1.8" cy="3"   r="1.5" fill="currentColor"/>
              <rect   x="5"   y="2"    width="9" height="2" rx="1" fill="currentColor"/>
              <circle cx="1.8" cy="7.5" r="1.5" fill="currentColor"/>
              <rect   x="5"   y="6.5"  width="9" height="2" rx="1" fill="currentColor"/>
              <circle cx="1.8" cy="12" r="1.5" fill="currentColor"/>
              <rect   x="5"   y="11"  width="9" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          {/* 이미지 삽입 */}
          <button
            onClick={handleInsertImage}
            title="이미지 삽입"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-black/10 active:scale-95"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="2.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="4.8" cy="6" r="1.3" fill="currentColor"/>
              <path d="M1.5 11.5L5 8L7.5 10.5L10 8L13.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* 기능 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 음성 녹음 버튼 */}
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              title="음성 녹음 시작"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 2px 10px rgba(239,68,68,0.35)',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="4.5" y="1" width="6" height="8.5" rx="3" fill="white"/>
                <path d="M2.5 8C2.5 11.04 4.7 13 7.5 13C10.3 13 12.5 11.04 12.5 8" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="7.5" y1="13" x2="7.5" y2="14.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="5.2" y1="14.5" x2="9.8" y2="14.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              title="녹음 중지 + MP3 저장"
              className="flex items-center gap-1 rounded-full transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 2px 12px rgba(239,68,68,0.5)',
                animation: 'pulse 1.2s ease-in-out infinite',
                height: 36, minWidth: 64, paddingInline: 10,
                justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                <rect width="10" height="10" rx="2"/>
              </svg>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
              </span>
            </button>
          )}

          {/* AI 교정 버튼 */}
          <button
            onClick={handleCorrect}
            disabled={isLoading || !text.trim()}
            className="flex items-center gap-1.5 h-9 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              paddingInline: 14,
              background: isLoading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              boxShadow: '0 2px 10px rgba(99,102,241,0.32)',
              letterSpacing: '0.03em',
              fontSize: 13,
            }}
            title="AI 맞춤법 교정"
          >
            {isLoading ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5" strokeDasharray="15 7" opacity="0.9"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 0.5L7.2 4.2H11.2L7.9 6.5L9.1 10.2L6 8L2.9 10.2L4.1 6.5L0.8 4.2H4.8L6 0.5Z" fill="white"/>
              </svg>
            )}
            <span>AI</span>
          </button>

          {/* 복사 버튼 */}
          {correctedText && (
            <button
              onClick={handleCopyToClipboard}
              title="교정 결과 복사"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.55)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 1H13V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
              </svg>
            </button>
          )}

          {/* 색상 변경 버튼 */}
          <button
            onClick={nextColor}
            title={`색상 변경 · ${currentColor.name}`}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.55)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.1" opacity="0.4"/>
              <circle cx="4.5" cy="5"   r="1.7" fill="#ef4444"/>
              <circle cx="10" cy="4.5"  r="1.7" fill="#22c55e"/>
              <circle cx="10.5" cy="10" r="1.7" fill="#3b82f6"/>
              <circle cx="4.5" cy="10.5" r="1.7" fill="#a855f7"/>
            </svg>
          </button>

        </div>
      </div>

    </div>
    {/* 모달: opacity div 바깥 → 항상 완전 불투명 */}
    <KeywordManager
      isOpen={showKeywordManager}
      onClose={() => setShowKeywordManager(false)}
    />
    <AlertModal
      isOpen={alertModal.isOpen}
      type={alertModal.type}
      title={alertModal.title}
      message={alertModal.message}
      confirmText={alertModal.confirmText}
      cancelText={alertModal.cancelText}
      onConfirm={alertModal.onConfirm}
      onCancel={alertModal.onCancel}
    />
    </>
  );
}

export default App;
