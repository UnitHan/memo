/**
 * AlertModal.tsx
 * 커스텀 알림/확인 모달 (브라우저 alert/confirm 대체)
 * 블루 헤더 카드 스타일 (ConfigModal/SettingsPage 동일 디자인)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface AlertModalProps {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'warning';
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '확인',
  cancelText = '취소',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      else if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  // 타입별 색상/아이콘
  const config = {
    alert:   { header: '#1565C0', iconBg: '#BBDEFB', confirmBg: '#1565C0', icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#1565C0">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
    )},
    confirm: { header: '#1565C0', iconBg: '#BBDEFB', confirmBg: '#1565C0', icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#1565C0">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
      </svg>
    )},
    warning: { header: '#C62828', iconBg: '#FFCDD2', confirmBg: '#C62828', icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#C62828">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    )},
  }[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
            fontFamily: "'NotoSansKR', 'Malgun Gothic', sans-serif",
          }}
          onClick={type === 'alert' ? onConfirm : undefined}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 300, borderRadius: 18,
              boxShadow: '0 16px 48px rgba(0,0,0,0.32)',
              overflow: 'hidden', background: '#F0F4F8',
            }}
          >
            {/* 파란 헤더 */}
            <div style={{
              background: config.header, height: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                {title ?? (type === 'warning' ? '경고' : type === 'confirm' ? '확인' : '알림')}
              </span>
            </div>

            {/* 카드 본문 */}
            <div style={{ background: '#FFF8F0', margin: 14, borderRadius: 14, padding: '20px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              {/* 아이콘 */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: 15,
                  background: config.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {config.icon}
                </div>
              </div>

              {/* 메시지 */}
              <p style={{
                fontSize: 13, color: '#37474F', textAlign: 'center',
                lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {message}
              </p>
            </div>

            {/* 버튼 영역 */}
            <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
              {(type === 'confirm' || type === 'warning') && onCancel && (
                <button
                  onClick={onCancel}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    background: '#ECEFF1', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: '#546E7A',
                  }}
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={onConfirm}
                style={{
                  flex: type === 'alert' ? undefined : 1,
                  padding: type === 'alert' ? '11px 32px' : '11px 0',
                  margin: type === 'alert' ? '0 auto' : undefined,
                  display: type === 'alert' ? 'block' : undefined,
                  width: type === 'alert' ? '100%' : undefined,
                  borderRadius: 10, background: config.confirmBg,
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, color: '#fff',
                  boxShadow: `0 2px 8px ${config.confirmBg}55`,
                }}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
