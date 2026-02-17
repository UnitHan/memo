/**
 * InputModal.tsx
 * 텍스트 입력 모달
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  title,
  placeholder,
  defaultValue = '',
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  // 키보드 이벤트
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        onConfirm(inputValue.trim());
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inputValue, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 pt-6 pb-4 border-b border-[#E0E0E0]">
              <h3 className="text-lg font-semibold text-[#1F1F1F]">{title}</h3>
            </div>

            {/* 컨텐츠 */}
            <div className="px-6 py-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-[#D1D1D1] rounded focus:outline-none focus:border-[#0067C0] focus:ring-1 focus:ring-[#0067C0]"
              />
            </div>

            {/* 액션 버튼 */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 text-sm font-medium border border-[#CCCCCC] bg-white hover:bg-[#F5F5F5] text-[#1F1F1F] rounded-lg transition-all"
              >
                취소
              </button>
              <button
                onClick={() => inputValue.trim() && onConfirm(inputValue.trim())}
                disabled={!inputValue.trim()}
                className="flex-1 py-2.5 text-sm font-semibold bg-[#0067C0] hover:bg-[#005A9E] text-white rounded-lg transition-all disabled:bg-[#CCCCCC] disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
