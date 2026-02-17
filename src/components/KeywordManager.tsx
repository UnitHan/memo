/**
 * KeywordManager.tsx
 * 학습된 민감 키워드 관리 UI 컴포넌트
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadKeywordDB, removeBlockedKeyword, clearKeywordDB } from '../utils/keywordDB';

interface KeywordManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeywordManager: React.FC<KeywordManagerProps> = ({ isOpen, onClose }) => {
  const [db, setDb] = useState(loadKeywordDB());

  const handleRemoveKeyword = (keyword: string) => {
    removeBlockedKeyword(keyword);
    setDb(loadKeywordDB());
  };

  const handleClearAll = () => {
    if (confirm('모든 학습 데이터를 초기화하시겠습니까?')) {
      clearKeywordDB();
      setDb(loadKeywordDB());
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            {/* 그라데이션 헤더 */}
            <div
              className="relative px-8 py-6"
              style={{
                background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
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
                  🛡️
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">학습된 키워드</h2>
                  <p className="text-sm text-white text-opacity-90">
                    차단한 키워드 {db.blockedKeywords.length}개
                  </p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-8">
              {/* 키워드 리스트 */}
              {db.blockedKeywords.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-7xl mb-4 opacity-20">🔍</div>
                  <p className="text-gray-400 font-medium">학습된 키워드가 없습니다</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto mb-6 space-y-2.5 pr-2">
                  {db.blockedKeywords.map((keyword, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex justify-between items-center p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                      style={{
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
                        border: '1px solid #fecaca',
                      }}
                    >
                      <span className="text-gray-800 font-semibold">{keyword}</span>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="text-red-600 hover:text-white hover:bg-red-500 font-bold text-sm px-4 py-1.5 rounded-lg transition-all"
                      >
                        삭제
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearAll}
                  disabled={db.blockedKeywords.length === 0}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: db.blockedKeywords.length === 0
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
                  }}
                >
                  🗑️ 전체 초기화
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
                  닫기
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
