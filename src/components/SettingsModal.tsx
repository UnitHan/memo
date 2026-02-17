/**
 * SettingsModal.tsx
 * 설정 모달 컴포넌트 (API 키 입력)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSave: (apiKey: string) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentApiKey,
  onSave,
  opacity,
  onOpacityChange
}) => {
  const [apiKey, setApiKey] = useState(currentApiKey);

  const handleSave = () => {
    onSave(apiKey);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              width: '480px',
              maxHeight: '90vh',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* 그라데이션 헤더 */}
            <div
              className="relative px-8 py-6"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white hover:bg-opacity-20 transition-all"
              >
                ✕
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl">
                  ⚙️
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">설정</h2>
                  <p className="text-sm text-white text-opacity-90">Gemini API 연결</p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3 text-gray-700">
                  Gemini API 키
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API 키를 입력하세요"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors text-gray-800 font-medium"
                  style={{ fontSize: '15px' }}
                />
              </div>

              {/* 투명도 조절 */}
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3 text-gray-700 flex items-center gap-2">
                  💎 투명도
                  <span className="text-xs font-normal text-gray-500">
                    ({Math.round(opacity * 100)}%)
                  </span>
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  className="w-full h-2 cursor-pointer rounded-lg"
                  style={{
                    accentColor: '#667eea',
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>30%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* 안내 박스 */}
              <div
                className="mb-6 p-4 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  border: '1px solid #d1d5db',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">🔐</span>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <p className="font-semibold mb-1">보안 안내</p>
                    <p className="text-xs">
                      API 키는 난독화되어 로컬 저장소에만 저장됩니다.
                      <br />
                      <span className="font-semibold text-purple-600">
                        발급 ↗{' '}
                      </span>
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-700 underline font-semibold"
                      >
                        Google AI Studio
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  저장
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="px-8 py-3.5 rounded-xl font-bold text-gray-600 transition-all"
                  style={{
                    backgroundColor: '#f3f4f6',
                  }}
                >
                  취소
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
