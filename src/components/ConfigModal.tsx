/**
 * ConfigModal.tsx
 * 설정 화면 - 카드 섹션 스타일
 */

import { useState, useEffect } from 'react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  opacity: number;
  onSave: (apiKey: string, opacity: number) => void;
}

export const ConfigModal = ({ isOpen, onClose, currentApiKey, opacity, onSave }: ConfigModalProps) => {
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setApiKey(currentApiKey);
  }, [currentApiKey, isOpen]);

  const handleSave = () => {
    onSave(apiKey, opacity);
    onClose();
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('메모장에서 보낸 메모');
    const body = encodeURIComponent(`안녕하세요,\n\n메모 내용을 공유합니다.\n\n---\n작성 시간: ${new Date().toLocaleString('ko-KR')}\n\n`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  if (!isOpen) return null;


  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column',
        background: '#FFFFFF', fontFamily: "'NotoSansKR', 'Malgun Gothic', sans-serif",
      }}
    >
      {/* ── 파란 헤더 ── */}
      <div style={{
        background: '#1565C0', flexShrink: 0,
        height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
      }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>설정</h2>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(255,255,255,0.18)', border: 'none',
            color: '#fff', cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* ── 스크롤 컨텐츠 ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#F0F4F8', padding: '20px 16px 16px' }}>

        {/* 섹션: AI 설정 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: '#90A4AE', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>AI 설정</p>

        {/* API 키 카드 */}
        <div style={{ background: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: '#BBDEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#1565C0">
                <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Gemini API 키</div>
              <div style={{ fontSize: 12, color: '#78909C', marginTop: 2 }}>AI 교정 기능에 필요합니다</div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{
                width: '100%', padding: '11px 40px 11px 13px',
                border: '1.5px solid #E0E0E0', borderRadius: 10,
                fontSize: 13, outline: 'none', fontFamily: 'monospace',
                background: '#FFFFFF', boxSizing: 'border-box', color: '#1A1A1A',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#90A4AE', padding: 4,
              }}
              aria-label={showKey ? '키 숨기기' : '키 보기'}
            >
              {showKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          </div>

          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="#90A4AE">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/>
              <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0L7.1 4.995z"/>
            </svg>
            <span style={{ fontSize: 11, color: '#90A4AE' }}>로컬에만 저장 ·</span>
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#1565C0', textDecoration: 'none' }}>발급받기 ↗</a>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '14px', background: '#1565C0', color: '#fff',
            border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 22, marginTop: 4,
            boxShadow: '0 2px 8px rgba(21,101,192,0.35)',
          }}
        >저장</button>

        {/* 섹션: 정보 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: '#90A4AE', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>오픈소스 라이선스</p>

        {/* 라이선스 카드 */}
        <div style={{ background: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: '#BBDEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#1565C0">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>오픈소스 고지</div>
              <div style={{ fontSize: 12, color: '#78909C', marginTop: 2 }}>사용된 오픈소스 라이브러리</div>
            </div>
          </div>
          {[
            { name: 'React 19.2.x', license: 'MIT License', url: 'https://reactjs.org' },
            { name: 'Tauri 2.x', license: 'MIT / Apache 2.0', url: 'https://tauri.app' },
            { name: 'Framer Motion 12.x', license: 'MIT License', url: 'https://framer.com/motion' },
            { name: 'Tailwind CSS 4.x', license: 'MIT License', url: 'https://tailwindcss.com' },
            { name: 'Validator.js 13.x', license: 'MIT License', url: 'https://github.com/validatorjs/validator.js' },
            { name: 'lamejs 1.2.x', license: 'LGPL-3.0', url: 'https://github.com/zhuker/lamejs', note: 'Web Worker(importScripts) 방식으로 동적 로드' },
            { name: 'Vite 7.x', license: 'MIT License', url: 'https://vitejs.dev' },
          ].map((item) => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: '1px solid #F0EDE8' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#37474F' }}>{item.name}</span>
                <span style={{ fontSize: 11, color: '#90A4AE', marginLeft: 8 }}>{item.license}</span>
                {'note' in item && item.note && (
                  <div style={{ fontSize: 10, color: '#B0BEC5', marginTop: 1 }}>{item.note}</div>
                )}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#1565C0', textDecoration: 'none' }}
              >
                보기 ↗
              </a>
            </div>
          ))}
        </div>

        {/* 섹션: 공유 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: '#90A4AE', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>공유</p>

        {/* 이메일 카드 */}
        <button
          onClick={handleSendEmail}
          style={{
            width: '100%', background: '#FFF8F0', borderRadius: 16, padding: 16,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 12, textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 13, background: '#BBDEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1565C0">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>메모 이메일 보내기</div>
            <div style={{ fontSize: 12, color: '#78909C', marginTop: 2 }}>Gmail로 메모를 공유하세요</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

      </div>

      {/* ── 푸터 ── */}
      <div style={{ flexShrink: 0, padding: '11px 16px', background: '#F0F4F8', borderTop: '1px solid #E0E0E0', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#78909C', margin: 0, fontWeight: 500 }}>
          Powered by <span style={{ color: '#455A64', fontWeight: 700 }}>QA Bulls</span> © 2026
        </p>
      </div>
    </div>
  );
};
