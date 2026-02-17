/**
 * SettingsPage.tsx
 * Windows 11 스타일 설정 페이지
 */

import { useState, useEffect } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { saveApiKey, loadApiKey } from '../utils/apiKeyStorage';
import { ConfigModal } from '../components/ConfigModal';

interface MemoHistory {
  id: string;
  content: string;
  timestamp: number;
}

export const SettingsPage = () => {
  const [apiKey, setApiKey] = useState('');
  const [opacity, setOpacity] = useState(0.95);
  const [memoHistory, setMemoHistory] = useState<MemoHistory[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isConfigMode, setIsConfigMode] = useState(false); // 설정 전용 모드

  useEffect(() => {
    const savedKey = loadApiKey();
    setApiKey(savedKey);
    
    const savedOpacity = localStorage.getItem('window_opacity');
    if (savedOpacity) {
      setOpacity(parseFloat(savedOpacity));
    }

    // 메모 히스토리 로드
    const savedHistory = localStorage.getItem('memo_history');
    if (savedHistory) {
      try {
        setMemoHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('메모 히스토리 로드 실패:', e);
      }
    }

    // URL에 config=true 파라미터가 있으면 설정 모달 자동 열기
    // 해시 URL에서 쿼리 파라미터 추출: #settings?config=true
    const hash = window.location.hash; // #settings?config=true
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);
    const shouldOpenConfig = urlParams.get('config') === 'true';
    
    if (shouldOpenConfig) {
      console.log('⚙️ 설정 전용 모드 활성화');
      setIsConfigMode(true);
      setShowConfig(true);
    }
  }, []);

  // localStorage 변화 실시간 감지 (다른 윈도우에서 메모 저장 시)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'memo_history' && e.newValue) {
        try {
          const newHistory = JSON.parse(e.newValue);
          setMemoHistory(newHistory);
          console.log('📋 메모 히스토리 실시간 업데이트:', newHistory.length + '개');
        } catch (err) {
          console.error('메모 히스토리 파싱 실패:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 메모 복원
  const handleRestoreMemo = async (memo: MemoHistory) => {
    localStorage.setItem('restore_memo', memo.content);
    console.log('📋 메모 복원됨:', memo.content.substring(0, 50) + '...');
    
    // 메인 윈도우로 포커스 이동
    try {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (mainWindow) {
        await mainWindow.setFocus();
        console.log('✅ 메인 윈도우로 포커스 이동');
      }
    } catch (e) {
      console.error('메인 윈도우 포커스 실패:', e);
    }
  };

  // 메모 삭제
  const handleDeleteMemo = (id: string) => {
    const updated = memoHistory.filter(m => m.id !== id);
    setMemoHistory(updated);
    localStorage.setItem('memo_history', JSON.stringify(updated));
  };

  // 모든 히스토리 삭제
  const handleClearHistory = () => {
    setMemoHistory([]);
    localStorage.setItem('memo_history', '[]');
  };

  // 메모 파일로 저장
  const handleSaveMemo = async (memo: MemoHistory) => {
    try {
      // 이미지 또는 코드 블록 포함 여부 확인
      const hasImage = memo.content.includes('<img');
      const hasCodeBlock = memo.content.includes('class="code-block"');
      
      // 코드 블록 타입 감지 (단순화 - JSON/LOG만 구분)
      let fileExtension = 'txt';
      let filterName = '텍스트 파일';
      
      if (hasCodeBlock) {
        // 코드 블록에서 언어 레이블 추출
        const langMatch = memo.content.match(/<span[^>]*color:\s*#9cdcfe[^>]*>([^<]+)<\/span>/);
        const language = langMatch ? langMatch[1].toLowerCase().trim() : '';
        
        // JSON과 LOG만 구분, 나머지는 TXT
        if (language === 'json') {
          fileExtension = 'json';
          filterName = 'JSON 파일';
        } else if (language === 'log') {
          fileExtension = 'log';
          filterName = '로그 파일';
        } else {
          // CODE 또는 기타 언어는 모두 TXT
          fileExtension = 'txt';
          filterName = '텍스트 파일';
        }
      } else if (hasImage) {
        fileExtension = 'html';
        filterName = 'HTML 파일';
      }
      
      const timestamp = new Date(memo.timestamp).toLocaleString('ko-KR');
      
      // 파일 저장 경로 선택
      const filePath = await save({
        defaultPath: `메모_${new Date(memo.timestamp).toLocaleDateString('ko-KR').replace(/\./g, '-').replace(/ /g, '')}.${fileExtension}`,
        filters: [
          { name: filterName, extensions: [fileExtension] },
          { name: '모든 파일', extensions: ['*'] }
        ]
      });

      if (!filePath) return; // 취소한 경우

      let content: string;
      
      if (hasCodeBlock && fileExtension !== 'html') {
        // 코드 파일로 저장 (py, js, ts, java, json, log 등): 순수 텍스트 추출
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = memo.content;
        const codeBlock = tempDiv.querySelector('.code-block pre');
        if (codeBlock) {
          // HTML 엔티티 디코딩 및 span 태그 제거
          const decoded = codeBlock.innerHTML
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/<span[^>]*>/g, '') // span 태그 제거 (색상 코드)
            .replace(/<\/span>/g, '');
          content = decoded;
        } else {
          content = tempDiv.textContent || tempDiv.innerText || '';
        }
      } else if (fileExtension === 'html' || hasImage) {
        // HTML 파일로 저장 (이미지 포함 시)
        content = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>메모 - ${timestamp}</title>
  <style>
    body {
      font-family: 'Segoe UI', 'Malgun Gothic', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
      background: #f9f9f9;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 2px solid #0067C0;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .timestamp {
      color: #999;
      font-size: 14px;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 10px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    /* 코드 블록 스타일 */
    .code-block {
      position: relative;
      margin: 10px 0;
      background: #1e1e1e;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .code-block pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 AI 메모장</h1>
      <p class="timestamp">작성 시간: ${timestamp}</p>
    </div>
    <div class="content">
      ${memo.content}
    </div>
    <div class="footer">
      <p>Powered by QA Bulls © 2026</p>
    </div>
  </div>
</body>
</html>`;
      } else {
        // 순수 텍스트 파일로 저장
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = memo.content;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        content = `AI 메모장
작성 시간: ${timestamp}
${'='.repeat(50)}\n\n${plainText}\n\n${'='.repeat(50)}\nPowered by QA Bulls © 2026`;
      }

      await writeTextFile(filePath, content);
      alert(`✅ 메모가 저장되었습니다!\n\n${filePath}`);
      console.log('💾 메모 저장 완료:', filePath);
    } catch (error) {
      console.error('메모 저장 실패:', error);
      alert(`❌ 저장 실패: ${error}`);
    }
  };

  const handleConfigSave = async (newApiKey: string, newOpacity: number) => {
    setApiKey(newApiKey);
    setOpacity(newOpacity);
    saveApiKey(newApiKey);
    localStorage.setItem('window_opacity', newOpacity.toString());
    console.log('💾 설정 저장:', { apiKeyLength: newApiKey.length, opacity: newOpacity });
    
    // 설정 전용 모드일 때만 윈도우 닫기 및 메인 윈도우로 이동
    if (isConfigMode) {
      // localStorage 동기화를 위해 약간 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        // 메인 윈도우로 포커스 이동
        const mainWindow = await WebviewWindow.getByLabel('main');
        if (mainWindow) {
          await mainWindow.setFocus();
        }
        
        // 설정 윈도우 닫기
        const currentWindow = await WebviewWindow.getCurrent();
        await currentWindow.close();
      } catch (error) {
        console.error('윈도우 전환 실패:', error);
      }
    }
  };

  // 설정 전용 모드일 때는 ConfigModal만 전체 화면으로 표시
  if (isConfigMode) {
    return (
      <div className="relative h-screen bg-[#F3F3F3] flex items-center justify-center" style={{ fontFamily: '"Segoe UI", -apple-system, sans-serif' }}>
        <ConfigModal
          isOpen={showConfig}
          onClose={async () => {
            // 취소 시 윈도우 닫기
            const currentWindow = await WebviewWindow.getCurrent();
            await currentWindow.close();
          }}
          currentApiKey={apiKey}
          opacity={opacity}
          onSave={handleConfigSave}
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#F3F3F3] flex flex-col overflow-x-hidden" style={{ fontFamily: '"Segoe UI", -apple-system, sans-serif' }}>
      {/* 상단 헤더 */}
      <div className="bg-white h-12 flex items-center justify-between px-6 border-b border-[#E0E0E0] flex-shrink-0">
        <h1 className="text-[14px] text-[#1F1F1F] font-semibold">메모 보관함</h1>
        <button
          onClick={() => setShowConfig(true)}
          className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F5] rounded-full transition-colors text-lg"
          title="설정"
        >
          ⚙️
        </button>
      </div>

      {/* 메인 컨텐츠 (스크롤 영역) */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2">
        
        {/* 메모 히스토리 카드 */}
        {memoHistory.length > 0 ? (
          <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#0067C0" aria-hidden="true">
                  <path d="M13 3h-2V1H5v2H3c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 2h4v1H6V2zm7 12H3V5h10v9z"/>
                  <path d="M5 7h6v1H5zM5 9h6v1H5zM5 11h4v1H5z"/>
                </svg>
                <h2 className="text-[13px] font-semibold text-[#1F1F1F]">저장된 메모</h2>
                <span className="text-[11px] text-[#616161] bg-[#F3F3F3] px-2 py-0.5 rounded-full">
                  {memoHistory.length}개
                </span>
              </div>
              <button
                onClick={handleClearHistory}
                className="text-[11px] text-[#D32F2F] hover:bg-[#FFEBEE] px-2 py-1 rounded transition-colors"
              >
                전체 삭제
              </button>
            </div>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {memoHistory.map((memo) => (
                <div
                  key={memo.id}
                  className="group bg-[#F9F9F9] hover:bg-[#F3F3F3] border border-[#E0E0E0] rounded p-3 transition-colors"
                >
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <div 
                        className="text-[12px] text-[#333] line-clamp-3 break-words mb-2"
                        style={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-word'
                        }}
                        dangerouslySetInnerHTML={{ 
                          __html: memo.content
                            // 이미지를 아이콘으로 대체
                            .replace(
                              /<img[^>]+>/g, 
                              '<span style="color: #0067C0; font-weight: 600;">🖼️ [이미지]</span>'
                            )
                            // 코드 블록을 축약 레이블로 대체 (언어명 단순화)
                            .replace(
                              /<div class="code-block"[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/div><br\s*\/?>/gi,
                              '<span style="display: inline-block; background: #1e1e1e; color: #9cdcfe; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 4px 0;">💻 [코드]</span> '
                            )
                        }}
                      />
                      <p className="text-[10px] text-[#999]">
                        {new Date(memo.timestamp).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleRestoreMemo(memo)}
                        className="w-7 h-7 flex items-center justify-center bg-[#0067C0] hover:bg-[#005A9E] text-white rounded text-[11px] transition-colors"
                        title="복원"
                      >
                        ↩️
                      </button>
                      <button
                        onClick={() => handleSaveMemo(memo)}
                        className="w-7 h-7 flex items-center justify-center bg-[#10B981] hover:bg-[#059669] text-white rounded text-[11px] transition-colors"
                        title="파일로 저장"
                      >
                        💾
                      </button>
                      <button
                        onClick={() => handleDeleteMemo(memo.id)}
                        className="w-7 h-7 flex items-center justify-center bg-[#F5F5F5] hover:bg-[#E0E0E0] text-[#D32F2F] rounded text-[11px] transition-colors"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-[#666] mb-2">보관된 메모가 없습니다</h3>
            <p className="text-sm text-[#999]">새 메모 버튼을 누르면 기존 메모가 자동 저장됩니다</p>
          </div>
        )}
        
      </div>

      {/* 하단 고정 영역 - Footer */}
      <div className="bg-white border-t border-[#E0E0E0] px-6 py-3 flex-shrink-0">
        <div className="text-center py-2">
          <p className="text-[11px] text-[#999]">
            Powered by <span className="font-semibold text-[#666]">QA Bulls</span>
          </p>
          <p className="text-[10px] text-[#BBB] mt-1">
            © 2026 All rights reserved
          </p>
        </div>
      </div>

      {/* ConfigModal */}
      <ConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        currentApiKey={apiKey}
        opacity={opacity}
        onSave={handleConfigSave}
      />
    </div>
  );
};
