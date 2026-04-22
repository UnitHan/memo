/**
 * SettingsPage.tsx
 * Windows 11 스타일 설정 페이지
 */

import { useState, useEffect, useRef } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { saveApiKey, loadApiKey } from '../utils/apiKeyStorage';
import { ConfigModal } from '../components/ConfigModal';
import { AlertModal } from '../components/AlertModal';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 이용약관 / 개인정보처리방침 모달
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '확인', onConfirm: () => {} });

  // 삭제 취소용 스택 (Ctrl+Z) — ref 사용으로 StrictMode 이중 호출 방지
  const deletedStackRef = useRef<MemoHistory[]>([]);

  useEffect(() => {
    const savedKey = loadApiKey();
    setApiKey(savedKey);
    
    const savedOpacity = localStorage.getItem('window_opacity');
    if (savedOpacity) {
      setOpacity(parseFloat(savedOpacity));
    }

    // 메모 히스토리 로드 (중복 id 제거)
    const savedHistory = localStorage.getItem('memo_history');
    if (savedHistory) {
      try {
        const parsed: MemoHistory[] = JSON.parse(savedHistory);
        const seen = new Set<string>();
        const deduped = parsed.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
        setMemoHistory(deduped);
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
          const parsed: MemoHistory[] = JSON.parse(e.newValue);
          const seen = new Set<string>();
          const deduped = parsed.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
          setMemoHistory(deduped);
          console.log('📋 메모 히스토리 실시간 업데이트:', deduped.length + '개');
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

  // 메모 삭제 (확인 팝업)
  const handleDeleteMemo = (id: string) => {
    const target = memoHistory.find(m => m.id === id);
    if (!target) return;
    setConfirmModal({
      isOpen: true,
      title: '메모 삭제',
      message: '이 메모를 삭제하시겠습니까?\n삭제 후 Ctrl+Z로 복원할 수 있습니다.',
      confirmText: '삭제',
      onConfirm: () => {
        deletedStackRef.current = [...deletedStackRef.current, target];
        setMemoHistory(current => {
          const updated = current.filter(m => m.id !== id);
          localStorage.setItem('memo_history', JSON.stringify(updated));
          return updated;
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 검색어에 매칭되는 메모 인덱스 목록
  const matchedIndices = searchQuery.trim()
    ? memoHistory.reduce<number[]>((acc, memo, idx) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = memo.content;
        const plainText = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();
        if (plainText.includes(searchQuery.trim().toLowerCase())) acc.push(idx);
        return acc;
      }, [])
    : [];

  // 검색창 열기/닫기
  const handleToggleSearch = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchMatchIndex(0);
    } else {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  // 이전/다음 검색 결과 이동
  const handleSearchPrev = () => {
    if (matchedIndices.length === 0) return;
    setSearchMatchIndex(prev => (prev - 1 + matchedIndices.length) % matchedIndices.length);
  };

  const handleSearchNext = () => {
    if (matchedIndices.length === 0) return;
    setSearchMatchIndex(prev => (prev + 1) % matchedIndices.length);
  };

  // Ctrl+Z: 마지막 삭제된 메모 복원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const stack = deletedStackRef.current;
        if (stack.length === 0) return;
        const restored = stack[stack.length - 1];
        deletedStackRef.current = stack.slice(0, -1);
        setMemoHistory(current => {
          const merged = [...current, restored].sort((a, b) => b.timestamp - a.timestamp);
          localStorage.setItem('memo_history', JSON.stringify(merged));
          return merged;
        });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 모든 히스토리 삭제 (확인 팝업)
  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: '전체 삭제',
      message: '저장된 메모를 모두 삭제할까요?\n삭제 후에는 복원할 수 없습니다.',
      confirmText: '삭제',
      onConfirm: () => {
        setMemoHistory([]);
        localStorage.setItem('memo_history', '[]');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
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
      font-family: 'NotoSansKR', 'Malgun Gothic', sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
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
      <div className="relative h-screen bg-[#F3F3F3] flex items-center justify-center">
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF', fontFamily: "'NotoSansKR', 'Malgun Gothic', sans-serif", overflow: 'hidden' }}>

      {/* ── 파란 헤더 ── */}
      <div style={{ background: '#1565C0', flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>메모 보관함</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* 검색 토글 */}
          <button
            onClick={handleToggleSearch}
            title="검색"
            style={{
              width: 36, height: 36, borderRadius: 18, border: 'none', cursor: 'pointer',
              background: isSearchOpen ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.18)',
              color: isSearchOpen ? '#1565C0' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
          </button>
          {/* 설정 */}
          <button
            onClick={() => setShowConfig(true)}
            title="설정"
            style={{
              width: 36, height: 36, borderRadius: 18, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── 검색창 ── */}
      {isSearchOpen && (
        <div style={{ background: '#1565C0', padding: '0 12px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="search-focus-box" style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '7px 10px', gap: 7, border: '1.5px solid transparent' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#90A4AE" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchNext(); if (e.key === 'Escape') handleToggleSearch(); }}
                placeholder="메모 검색..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A' }}
              />
              {searchQuery && (
                <span style={{ fontSize: 11, color: '#1565C0', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {matchedIndices.length > 0 ? `${searchMatchIndex + 1}/${matchedIndices.length}` : '0/0'}
                </span>
              )}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchMatchIndex(0); searchInputRef.current?.focus(); }}
                  title="검색어 지우기"
                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#90A4AE', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, lineHeight: 1 }}
                >✕</button>
              )}
            </div>
            <button onClick={handleSearchPrev} disabled={matchedIndices.length === 0}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff', opacity: matchedIndices.length === 0 ? 0.35 : 1, fontSize: 14 }}>∧</button>
            <button onClick={handleSearchNext} disabled={matchedIndices.length === 0}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff', opacity: matchedIndices.length === 0 ? 0.35 : 1, fontSize: 14 }}>∨</button>
            <button onClick={handleToggleSearch}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 13 }}>✕</button>
          </div>
        </div>
      )}

      {/* ── 스크롤 컨텐츠 ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#F0F4F8', padding: '16px 14px 10px' }}>

        {memoHistory.length > 0 ? (
          <>
            {/* 섹션 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#90A4AE', letterSpacing: 1 }}>저장된 메모</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#1565C0', borderRadius: 20, padding: '1px 8px' }}>{memoHistory.length}</span>
              </div>
              <button
                onClick={handleClearHistory}
                style={{ fontSize: 11, color: '#EF5350', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
              >전체 삭제</button>
            </div>

            {/* 메모 카드 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {memoHistory.map((memo, idx) => {
                const isMatch = matchedIndices.includes(idx);
                const isFocused = isMatch && matchedIndices[searchMatchIndex] === idx;

                // 순수 텍스트 미리보기 추출
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = memo.content
                  .replace(/<img[^>]+>/g, '[이미지]')
                  .replace(/<div class="code-block"[\s\S]*?<\/div><br\s*\/?>/gi, '[코드]');
                const previewText = (tempDiv.textContent || tempDiv.innerText || '').trim().substring(0, 120);

                const cardBg = isFocused ? '#EDE7F6' : isMatch ? '#F3E5F5' : '#FFF8F0';
                const cardBorder = isFocused ? '#7C3AED' : isMatch ? '#CE93D8' : 'transparent';

                return (
                  <div key={`${memo.id}-${idx}`} style={{ background: cardBg, borderRadius: 16, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: `2px solid ${cardBorder}` }}>

                    {/* 검색 일치 태그 */}
                    {isMatch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#6B21A8', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>🍇 검색 일치</span>
                        {isFocused && <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700 }}>({matchedIndices.indexOf(idx) + 1}/{matchedIndices.length})</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* 문서 아이콘 */}
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: '#BBDEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1565C0">
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8z"/>
                        </svg>
                      </div>

                      {/* 텍스트 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                          {previewText || '(내용 없음)'}
                        </div>
                        <div style={{ fontSize: 11, color: '#90A4AE' }}>
                          {new Date(memo.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => handleRestoreMemo(memo)} title="복원"
                          style={{ width: 30, height: 30, borderRadius: 8, background: '#1565C0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleSaveMemo(memo)} title="파일로 저장"
                          style={{ width: 30, height: 30, borderRadius: 8, background: '#10B981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteMemo(memo.id)} title="삭제"
                          style={{ width: 30, height: 30, borderRadius: 8, background: '#FFEBEE', border: '1.5px solid #EF5350', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#EF5350">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#BBDEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#1565C0">
                <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#546E7A', marginBottom: 6 }}>보관된 메모가 없습니다</div>
            <div style={{ fontSize: 12, color: '#90A4AE' }}>새 메모 버튼을 누르면 기존 메모가 자동 저장됩니다</div>
          </div>
        )}
      </div>

      {/* ── 푸터 ── */}
      <div style={{ flexShrink: 0, padding: '11px 16px', background: '#F0F4F8', borderTop: '1px solid #E0E0E0', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#78909C', margin: 0, fontWeight: 500 }}>
          Powered by <span style={{ color: '#455A64', fontWeight: 700 }}>QA Bulls</span> © 2026
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11 }}>
          <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#1565C0', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>이용약관</button>
          <span style={{ color: '#B0BEC5', margin: '0 6px' }}>|</span>
          <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: '#1565C0', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>개인정보처리방침</button>
        </p>
      </div>

      {/* ConfigModal */}
      <ConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        currentApiKey={apiKey}
        opacity={opacity}
        onSave={handleConfigSave}
      />

      {/* 이용약관 모달 */}
      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setShowTerms(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: '100%', maxHeight: '80vh', background: '#fff', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}>
            {/* 헤더 */}
            <div style={{ background: '#1565C0', borderRadius: '20px 20px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>이용약관</span>
              <button onClick={() => setShowTerms(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* 본문 */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1, fontSize: 13, color: '#37474F', lineHeight: 1.7 }}>
              <p><strong>제1조 (목적)</strong><br />본 약관은 QA Bulls(이하 &quot;회사&quot;)가 제공하는 AI 메모장 애플리케이션(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
              <p><strong>제2조 (서비스 내용)</strong><br />서비스는 다음 기능을 제공합니다.<br />• Gemini AI 기반 텍스트 맞춤법·문법 교정<br />• 메모 작성, 저장 및 관리<br />• 음성 녹음 및 받아쓰기<br />• 코드·로그 자동 포맷팅<br />• 민감 정보 자동 감지</p>
              <p><strong>제3조 (이용자의 의무)</strong><br />① 이용자는 서비스 이용 시 관련 법령 및 본 약관을 준수해야 합니다.<br />② 이용자는 타인의 개인정보, 기업 기밀 등 민감한 정보를 AI 교정 기능에 입력하지 않아야 합니다.<br />③ 이용자는 서비스를 불법적인 목적으로 사용해서는 안 됩니다.</p>
              <p><strong>제4조 (API 키 관리)</strong><br />① Gemini API 키는 이용자 본인이 직접 발급받아 사용합니다.<br />② API 키는 기기 내 로컬 저장소에만 저장되며, 회사 서버로 전송되지 않습니다.<br />③ API 키 유출로 인한 피해는 이용자 본인의 책임입니다.</p>
              <p><strong>제5조 (서비스 제한 및 중단)</strong><br />회사는 다음 경우 서비스 제공을 제한하거나 중단할 수 있습니다.<br />• 서비스 설비 점검·보수 시<br />• 외부 API(Google Gemini) 서비스 장애 시<br />• 기타 불가피한 사유 발생 시</p>
              <p><strong>제6조 (면책 조항)</strong><br />① 회사는 이용자가 서비스를 통해 얻은 정보의 정확성에 대해 보증하지 않습니다.<br />② AI 교정 결과는 참고용이며, 최종 판단은 이용자 본인이 해야 합니다.<br />③ 이용자의 귀책 사유로 발생한 손해에 대해 회사는 책임지지 않습니다.</p>
              <p><strong>제7조 (약관 변경)</strong><br />회사는 필요 시 약관을 변경할 수 있으며, 변경 시 앱 업데이트를 통해 공지합니다.</p>
              <p><strong>제8조 (준거법)</strong><br />본 약관은 대한민국 법률에 따라 해석됩니다.</p>
              <p style={{ color: '#90A4AE', fontSize: 12 }}>시행일: 2026년 1월 1일</p>
            </div>
            {/* 확인 버튼 */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <button onClick={() => setShowTerms(false)} style={{ width: '100%', background: '#1565C0', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 개인정보처리방침 모달 */}
      {showPrivacy && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setShowPrivacy(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: '100%', maxHeight: '80vh', background: '#fff', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}>
            {/* 헤더 */}
            <div style={{ background: '#1565C0', borderRadius: '20px 20px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>개인정보처리방침</span>
              <button onClick={() => setShowPrivacy(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* 본문 */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1, fontSize: 13, color: '#37474F', lineHeight: 1.7 }}>
              <p>QA Bulls(이하 &quot;회사&quot;)는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」을 준수합니다.</p>
              <p><strong>1. 수집하는 개인정보 항목</strong><br />본 서비스는 별도의 회원가입 없이 사용 가능하며, 다음 정보만 기기 내에 저장됩니다.<br />• Gemini API 키 (난독화 처리 후 로컬 저장)<br />• 작성한 메모 내용 (로컬 저장소)<br />• 앱 투명도 등 사용자 설정값 (로컬 저장소)<br />• 음성 녹음 파일 (기기 내 Music 폴더)</p>
              <p><strong>2. 개인정보 수집 및 이용 목적</strong><br />수집된 정보는 다음 목적으로만 사용됩니다.<br />• API 키: Gemini AI 텍스트 교정 기능 제공<br />• 메모 데이터: 앱 재실행 시 데이터 복원<br />• 설정값: 사용자 환경 유지</p>
              <p><strong>3. 개인정보 보관 및 파기</strong><br />• 모든 데이터는 이용자의 기기 내에만 저장됩니다.<br />• 회사 서버로 전송되거나 저장되는 데이터는 없습니다.<br />• 앱 삭제 시 로컬 저장 데이터는 자동 삭제됩니다.<br />• 음성 녹음 파일은 이용자가 직접 관리합니다.</p>
              <p><strong>4. 제3자 제공</strong><br />회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, Gemini AI 교정 기능 사용 시 입력한 텍스트는 Google의 Gemini API로 전송됩니다.<br />Google의 개인정보처리방침: <span style={{ color: '#1565C0' }}>https://policies.google.com/privacy</span></p>
              <p><strong>5. 마이크 접근 권한</strong><br />음성 녹음 및 받아쓰기 기능 사용 시 마이크 접근 권한이 필요합니다.<br />• 수집 목적: 음성 녹음 및 텍스트 변환<br />• 저장 위치: 기기 내 Music 폴더 (MP3 파일)<br />• 권한 거부 시: 음성 녹음 기능 사용 불가 (다른 기능은 정상 사용 가능)</p>
              <p><strong>6. 이용자의 권리</strong><br />이용자는 언제든지 다음 권리를 행사할 수 있습니다.<br />• 앱 내 데이터 삭제 (메모 보관함 &gt; 전체 삭제)<br />• 앱 삭제를 통한 모든 로컬 데이터 삭제<br />• 기기 설정에서 마이크 권한 철회</p>
              <p><strong>7. 개인정보 보호책임자</strong><br />• 회사명: QA Bulls<br />• 이메일: qabulls.test@gmail.com</p>
              <p><strong>8. 방침 변경</strong><br />개인정보처리방침 변경 시 앱 업데이트를 통해 공지합니다.</p>
              <p style={{ color: '#90A4AE', fontSize: 12 }}>시행일: 2026년 1월 1일</p>
            </div>
            {/* 확인 버튼 */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <button onClick={() => setShowPrivacy(false)} style={{ width: '100%', background: '#1565C0', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 삭제 확인 모달 */}
      <AlertModal
        isOpen={confirmModal.isOpen}
        type="warning"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="취소"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
