/**
 * AlertModal.tsx
 * 커스텀 알림/확인 모달 (브라우저 alert/confirm 대체)
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
  // 키보드 이벤트 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape' && type === 'confirm' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel, type]);

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'confirm':
        return '❓';
      default:
        return 'ℹ️';
    }
  };

  const getGradient = () => {
    switch (type) {
      case 'warning':
        return 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
      case 'confirm':
        return 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
      default:
        return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[100]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={type !== 'confirm' ? onConfirm : undefined}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              padding: '28px',
            }}
          >
            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-4xl"
                style={{
                  background: getGradient(),
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                {getIcon()}
              </div>
            </div>

            {/* 제목 */}
            {title && (
              <h3 className="text-xl font-bold text-gray-800 text-center mb-3">
                {title}
              </h3>
            )}

            {/* 메시지 */}
            <p
              className="text-gray-600 text-center mb-6 leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: '14px' }}
            >
              {message}
            </p>

            {/* 버튼 */}
            <div className={`flex gap-3 ${type === 'confirm' ? '' : 'justify-center'}`}>
              {type === 'confirm' && onCancel && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  className="flex-1 py-2.5 px-4 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {cancelText}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className={`${type === 'confirm' ? 'flex-1' : 'px-8'} py-2.5 rounded-lg font-semibold text-white shadow-md transition-all`}
                style={{
                  background: getGradient(),
                }}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
