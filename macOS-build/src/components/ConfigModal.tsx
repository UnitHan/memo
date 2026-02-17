/**
 * ConfigModal.tsx
 * 실제 설정을 관리하는 모달 (API 키, 투명도, 이메일 등)
 * Modern, Minimalist Design
 */

import { useState, useEffect } from 'react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  opacity: number;
  onSave: (apiKey: string, opacity: number) => void;
}

export const ConfigModal = ({ isOpen, onClose, currentApiKey, opacity: initialOpacity, onSave }: ConfigModalProps) => {
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setApiKey(currentApiKey);
    setOpacity(initialOpacity);
  }, [currentApiKey, initialOpacity, isOpen]);

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
      className="absolute inset-0 flex items-center justify-center z-[100] bg-[#F3F3F3]"
      onClick={onClose}
    >
      <div 
        className="bg-white flex flex-col shadow-2xl"
        style={{ 
          width: '360px',
          height: '560px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-[#E8E8E8]">
          <h2 className="text-[15px] font-medium text-[#1F1F1F]">설정</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F5] rounded-full transition-colors text-[#666]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 컨텐츠 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto" style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <style>{`
            .flex-1.overflow-y-auto::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          
          {/* Gemini API 키 */}
          <div className="px-6 py-5 border-b border-[#F0F0F0]">
            <label className="block text-[13px] font-medium text-[#333] mb-2">
              Gemini API 키
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2.5 pr-10 text-[13px] border border-[#D8D8D8] rounded-md bg-white focus:outline-none focus:border-[#0067C0] focus:ring-1 focus:ring-[#0067C0] transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#999] hover:text-[#666] transition-colors"
                aria-label={showKey ? "키 숨기기" : "키 보기"}
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-2 flex items-start gap-1.5">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#999" className="mt-0.5 flex-shrink-0">
                <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/>
                <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0L7.1 4.995z"/>
              </svg>
              <p className="text-[11px] text-[#999] leading-relaxed">
                API 키는 로컬 저장소에만 저장됩니다 · 
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#0067C0] hover:underline ml-1"
                >
                  발급받기
                </a>
              </p>
            </div>
          </div>

          {/* 저장 버튼 (상단 배치) */}
          <div className="px-6 py-4 bg-white border-b border-[#F0F0F0]">
            <button
              onClick={handleSave}
              className="w-full py-2.5 text-[13px] font-semibold bg-[#0067C0] hover:bg-[#005A9E] active:bg-[#004A85] text-white rounded-md transition-all shadow-sm"
            >
              저장
            </button>
          </div>

          {/* 창 투명도 */}
          <div className="px-6 py-5 border-b border-[#F0F0F0]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-[#333]">
                창 투명도
              </label>
              <span className="text-[13px] font-semibold text-[#0067C0] min-w-[38px] text-right">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#E8E8E8] rounded-full appearance-none cursor-pointer slider-modern"
                style={{
                  background: `linear-gradient(to right, #0067C0 0%, #0067C0 ${(opacity - 0.3) / 0.7 * 100}%, #E8E8E8 ${(opacity - 0.3) / 0.7 * 100}%, #E8E8E8 100%)`
                }}
              />
              <style>{`
                .slider-modern::-webkit-slider-thumb {
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  background: white;
                  border: 2px solid #0067C0;
                  border-radius: 50%;
                  cursor: pointer;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  transition: all 0.15s ease;
                }
                .slider-modern::-webkit-slider-thumb:hover {
                  transform: scale(1.1);
                  box-shadow: 0 2px 6px rgba(0,103,192,0.3);
                }
                .slider-modern::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  background: white;
                  border: 2px solid #0067C0;
                  border-radius: 50%;
                  cursor: pointer;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  transition: all 0.15s ease;
                }
                .slider-modern::-moz-range-thumb:hover {
                  transform: scale(1.1);
                  box-shadow: 0 2px 6px rgba(0,103,192,0.3);
                }
              `}</style>
            </div>
          </div>

          {/* 메모 이메일 보내기 */}
          <div className="px-6 py-4 border-b border-[#F0F0F0]">
            <button
              onClick={handleSendEmail}
              className="w-full flex items-center justify-between py-2 hover:bg-[#FAFAFA] -mx-2 px-2 rounded transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" className="flex-shrink-0">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <div className="text-left">
                  <div className="text-[13px] font-medium text-[#333]">메모 이메일 보내기</div>
                  <div className="text-[11px] text-[#999] mt-0.5">Gmail로 메모를 공유하세요</div>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" className="group-hover:stroke-[#999] transition-colors">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

        </div>

        {/* 푸터 (회사 정보) */}
        <div className="flex-shrink-0 px-5 py-3 bg-[#FAFAFA] border-t border-[#E8E8E8]">
          <div className="text-center">
            <p className="text-[9px] text-[#BBB]">
              Powered by <span className="font-medium text-[#999]">QA Bulls</span> © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
