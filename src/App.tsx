import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open } from '@tauri-apps/plugin-dialog';
import { detectSensitiveInfo } from './utils/security';
import { addToBlockedKeywords } from './utils/keywordDB';
import { loadApiKey } from './utils/apiKeyStorage';
import { processPastedContent } from './utils/codeDetector';
import { initDataBackup } from './utils/dataBackup';
import { initNetworkMonitor, isNetworkOnline, waitForNetwork } from './utils/networkMonitor';
import { KeywordManager } from './components/KeywordManager';
import { AlertModal } from './components/AlertModal';

// Windows Sticky Notes 파스텔 색상 (정확한 복제)
const STICKY_COLORS = [
  { name: '노랑', bg: 'rgb(255, 251, 149)', text: 'rgb(51, 51, 51)' },
  { name: '핑크', bg: 'rgb(246, 197, 224)', text: 'rgb(51, 51, 51)' },
  { name: '연두', bg: 'rgb(202, 242, 192)', text: 'rgb(51, 51, 51)' },
  { name: '하늘', bg: 'rgb(179, 229, 252)', text: 'rgb(51, 51, 51)' },
  { name: '연보라', bg: 'rgb(217, 202, 255)', text: 'rgb(51, 51, 51)' },
  { name: '회색', bg: 'rgb(224, 224, 224)', text: 'rgb(51, 51, 51)' },
];

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

  useEffect(() => {
    // 📦 데이터 백업 시스템 초기화 (최우선)
    initDataBackup().then(() => {
      console.log('🔄 백업 시스템 활성화 완료');
    }).catch((error) => {
      console.error('❌ 백업 시스템 초기화 실패:', error);
    });
    
    // 🌐 네트워크 모니터링 시작
    const cleanupNetworkMonitor = initNetworkMonitor(
      () => console.log('✅ 네트워크 재연결 - AI 교정 다시 사용 가능'),
      () => console.warn('❌ 네트워크 연결 끊김 - AI 교정 사용 불가')
    );
    
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
    return () => {
      console.log('🗑️ 이벤트 리스너 해제');
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('click', handleCodeBlockButtons);
      cleanupNetworkMonitor();
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
      
      // 투명도 재로드
      const savedOpacity = localStorage.getItem('window_opacity');
      if (savedOpacity) {
        const opacityValue = parseFloat(savedOpacity);
        if (opacityValue !== opacity) {
          setOpacity(opacityValue);
          console.log('💎 투명도 갱신됨 (focus):', Math.round(opacityValue * 100) + '%');
        }
      }
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
      openSettingsWindow(true);  // 설정 모달 자동 열기
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

  const openSettingsWindow = async (openConfigModal = false) => {
    try {
      // 기존 설정 창이 있으면 포커스
      const existingWindow = await WebviewWindow.getByLabel('settings');
      if (existingWindow) {
        await existingWindow.setFocus();
        return;
      }

      // 새 설정 윈도우 생성 (전체 URL 사용)
      const baseUrl = window.location.origin;
      const hash = openConfigModal ? '#settings?config=true' : '#settings';
      const fullUrl = `${baseUrl}/${hash}`;
      
      const settingsWindow = new WebviewWindow('settings', {
        url: fullUrl,
        title: openConfigModal ? 'AI 메모장 설정' : '메모 보관함',
        width: 360,
        height: 560,
        center: true,
        resizable: false,
        alwaysOnTop: true,
        decorations: true,
        transparent: false,
      });

      // 윈도우가 생성되면 데이터 전달
      settingsWindow.once('tauri://created', () => {
        console.log('✅ 설정 윈도우 생성 완료');
      });

      settingsWindow.once('tauri://error', (e: unknown) => {
        console.error('❌ 설정 윈도우 생성 실패:', e);
      });
    } catch (error) {
      console.error('❌ 윈도우 열기 오류:', error);
      await showAlert('설정 창을 열 수 없습니다. 앱을 다시 실행해주세요.');
    }
  };

  const handleMinimize = () => {
    getCurrentWindow().minimize();
    console.log('➖ 윈도우 최소화');
  };

  const handleClose = () => {
    console.log('🚪 종료 시작');
    getCurrentWindow().close();
  };

  // 새 메모 생성
  const handleNewMemo = () => {
    if (text.trim() || correctedText.trim()) {
      setAlertModal({
        isOpen: true,
        type: 'confirm',
        title: '🗒️ 새 메모',
        message: '현재 메모를 지우고 새 메모를 작성하시겠습니까?',
        onConfirm: () => {
          // 기존 메모를 히스토리에 저장
          const contentToSave = correctedText || text;
          if (contentToSave.trim()) {
            try {
              const historyStr = localStorage.getItem('memo_history') || '[]';
              const history = JSON.parse(historyStr);
              
              // 새 메모를 맨 앞에 추가 (최신순)
              history.unshift({
                id: Date.now().toString(),
                content: contentToSave,
                timestamp: Date.now()
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

  // RGB를 RGBA로 변환 (투명도 적용)
  const applyOpacity = (rgb: string, opacity: number) => {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
    return rgb;
  };

  return (
    <div
      className="h-screen flex flex-col relative"
      style={{
        backgroundColor: applyOpacity(currentColor.bg, opacity),
        color: currentColor.text,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        fontFamily: 'Segoe UI, Malgun Gothic, sans-serif',
      }}
    >
      {/* Windows Sticky Notes 헤더 */}
      <div
        className="h-12 flex items-center justify-between px-5 border-b"
        style={{
          borderBottomColor: 'rgba(0,0,0,0.08)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <button
          onClick={handleNewMemo}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-lg"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="새 메모"
        >
          ➕
        </button>

        <div 
          className="flex gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => openSettingsWindow(false)}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-lg"
            title="메모 보관함"
          >
            ⋯
          </button>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-lg"
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 텍스트 입력 영역 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          const target = e.target as HTMLDivElement;
          console.log('⌨️ onInput 이벤트 발생:', target.innerHTML.substring(0, 100));
          setText(target.innerHTML);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pastedText = e.clipboardData.getData('text/plain');
          
          // 대용량 텍스트 경고 (5MB 초과)
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
        className="flex-1 w-full px-6 py-3 resize-none outline-none overflow-auto"
        style={{
          backgroundColor: 'transparent',
          fontSize: `${fontSize}px`,
          lineHeight: '1.6',
          fontFamily: 'inherit',
          color: 'inherit',
          minHeight: '100px',
        }}
        data-placeholder="메모를 작성하세요..."
      />

      {/* 하단 포맷 툴바 */}
      <div 
        className="flex items-center justify-between px-5 py-2 border-t"
        style={{
          borderTopColor: 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex gap-1">
          <button 
            onClick={() => applyFormat('bold')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
            title="굵게"
          >
            <span className="font-bold text-sm">B</span>
          </button>
          <button 
            onClick={() => applyFormat('italic')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
            title="기울임꼴"
          >
            <span className="italic text-sm">I</span>
          </button>
          <button 
            onClick={() => applyFormat('underline')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
            title="밑줄"
          >
            <span className="underline text-sm">U</span>
          </button>
          <button 
            onClick={() => applyFormat('strikethrough')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-sm"
            title="취소선"
          >
            ab̶
          </button>
          <button 
            onClick={() => applyFormat('bullet')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-sm"
            title="글머리 기호"
          >
            ≡
          </button>
          <button 
            onClick={handleInsertImage}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/10 transition-colors text-sm"
            title="이미지"
          >
            🖼️
          </button>
        </div>

        <div className="flex gap-2">
          {/* AI 교정 버튼 */}
          <button
            onClick={handleCorrect}
            disabled={isLoading || !text.trim()}
            className="px-3 py-1.5 rounded text-xs font-semibold transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.85)',
              color: 'white',
            }}
            title="AI 교정"
          >
            {isLoading ? '⏳' : '✨ AI'}
          </button>

          {correctedText && (
            <button
              onClick={handleCopyToClipboard}
              className="px-3 py-1.5 rounded text-xs font-semibold hover:bg-black/10 transition-colors"
              title="복사"
            >
              📋
            </button>
          )}

          <button
            onClick={nextColor}
            className="px-3 py-1.5 rounded text-xs hover:bg-black/10 transition-colors"
            title={`색상: ${currentColor.name}`}
          >
            🎨
          </button>

          <button
            onClick={handleMinimize}
            className="px-3 py-1.5 rounded text-xs hover:bg-black/10 transition-colors"
            title="최소화"
          >
            ➖
          </button>
        </div>
      </div>

      {/* 모달 */}
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
    </div>
  );
}

export default App;
