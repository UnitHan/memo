/**
 * KeywordManagerPage.tsx
 * 독립 윈도우용 학습된 키워드 관리 페이지 - 모던 UI
 */

import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion, AnimatePresence } from 'framer-motion';

interface KeywordDB {
  blockedKeywords: string[];
  blockedPatterns: string[];
  lastUpdated: number;
}

export const KeywordManagerPage = () => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = () => {
    const dbStr = localStorage.getItem('sensitive_keywords_db');
    if (dbStr) {
      const db: KeywordDB = JSON.parse(dbStr);
      setKeywords(db.blockedKeywords || []);
      setPatterns(db.blockedPatterns || []);
    }
  };

  const handleDelete = (keyword: string) => {
    const dbStr = localStorage.getItem('sensitive_keywords_db');
    if (!dbStr) return;

    const db: KeywordDB = JSON.parse(dbStr);
    db.blockedKeywords = db.blockedKeywords.filter(k => k !== keyword);
    db.blockedPatterns = db.blockedPatterns.filter(p => p !== keyword);
    db.lastUpdated = Date.now();

    localStorage.setItem('sensitive_keywords_db', JSON.stringify(db));
    loadKeywords();
    
    // 선택 목록에서도 제거
    const newSelected = new Set(selectedItems);
    newSelected.delete(keyword);
    setSelectedItems(newSelected);
  };

  const handleClearAll = () => {
    if (confirm('🗑️ 모든 학습 데이터를 삭제하시겠습니까?\n\n삭제된 데이터는 복구할 수 없습니다.')) {
      localStorage.removeItem('sensitive_keywords_db');
      setKeywords([]);
      setPatterns([]);
      setSelectedItems(new Set());
    }
  };

  const toggleSelect = (item: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item)) {
      newSelected.delete(item);
    } else {
      newSelected.add(item);
    }
    setSelectedItems(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) return;
    
    if (confirm(`선택한 ${selectedItems.size}개 항목을 삭제하시겠습니까?`)) {
      const dbStr = localStorage.getItem('sensitive_keywords_db');
      if (!dbStr) return;

      const db: KeywordDB = JSON.parse(dbStr);
      selectedItems.forEach(item => {
        db.blockedKeywords = db.blockedKeywords.filter(k => k !== item);
        db.blockedPatterns = db.blockedPatterns.filter(p => p !== item);
      });
      db.lastUpdated = Date.now();

      localStorage.setItem('sensitive_keywords_db', JSON.stringify(db));
      loadKeywords();
      setSelectedItems(new Set());
    }
  };

  const handleClose = async () => {
    await getCurrentWindow().close();
  };

  const allItems = [...new Set([...keywords, ...patterns])];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-red-100 p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto"
      >
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <motion.div 
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="relative"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl">
                  <span className="text-6xl">🛡️</span>
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-xl font-black text-white">{allItems.length}</span>
                </div>
              </motion.div>
              
              <div>
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 mb-2">
                  학습된 키워드
                </h1>
                <p className="text-xl text-pink-700 font-semibold">AI가 자동 차단하는 민감 정보 패턴</p>
              </div>
            </div>
            
            <button
              onClick={handleClose}
              className="w-14 h-14 rounded-2xl bg-white/90 hover:bg-red-50 flex items-center justify-center text-3xl text-gray-600 hover:text-red-600 transition-all shadow-xl hover:shadow-2xl hover:scale-110"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 통계 대시보드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-4 gap-5 mb-8"
        >
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border-2 border-blue-100 hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">📝</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">키워드</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {keywords.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border-2 border-purple-100 hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">🔍</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">패턴</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-fuchsia-600">
                  {patterns.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border-2 border-emerald-100 hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">🎯</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">총합</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                  {allItems.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border-2 border-orange-100 hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">✅</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">선택됨</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">
                  {selectedItems.size}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 안내 박스 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl p-7 border-3 border-amber-300 mb-8 shadow-xl"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-4xl">🧠</span>
            </div>
            <div className="flex-1">
              <p className="text-xl font-black text-amber-900 mb-3">학습 알고리즘 동작 원리</p>
              <p className="text-base text-gray-700 leading-relaxed">
                민감 정보 감지 시 <strong className="text-amber-800 font-black">"취소"</strong>를 누르면 해당 키워드/패턴이 자동으로 학습됩니다.
                다음부터는 Google AI에 전송하기 <strong className="text-red-700 font-black">전에</strong> 자동으로 차단됩니다.
              </p>
            </div>
          </div>
        </motion.div>

        {/* 메인 콘텐츠 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-pink-100 overflow-hidden"
        >
          {allItems.length === 0 ? (
            <div className="text-center py-24 px-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.6 }}
              >
                <span className="text-9xl mb-8 block">🎉</span>
              </motion.div>
              <p className="text-3xl text-gray-700 font-black mb-3">학습된 키워드가 없습니다</p>
              <p className="text-lg text-gray-500">민감 정보 감지 시 차단하면 여기에 표시됩니다</p>
            </div>
          ) : (
            <>
              {/* 툴바 */}
              <div className="bg-gradient-to-r from-pink-100 to-rose-100 px-8 py-6 border-b-2 border-pink-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                    <span>🔒</span>
                    <span>차단 목록</span>
                    <span className="px-4 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl text-xl shadow-lg">
                      {allItems.length}개
                    </span>
                  </h3>
                  
                  <div className="flex gap-3">
                    {selectedItems.size > 0 && (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={handleDeleteSelected}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                      >
                        <span>🗑️</span>
                        <span>선택 삭제 ({selectedItems.size})</span>
                      </motion.button>
                    )}
                    
                    <button
                      onClick={handleClearAll}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                    >
                      <span>💥</span>
                      <span>전체 삭제</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 키워드 목록 */}
              <div className="p-6 max-h-[550px] overflow-y-auto">
                <div className="grid grid-cols-1 gap-4">
                  <AnimatePresence>
                    {allItems.map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30, height: 0, marginBottom: 0 }}
                        transition={{ delay: index * 0.04, type: "spring", stiffness: 300 }}
                        className={`group relative flex items-center gap-5 p-6 rounded-2xl border-3 transition-all cursor-pointer ${
                          selectedItems.has(item)
                            ? 'bg-gradient-to-r from-pink-100 to-rose-100 border-pink-400 shadow-xl scale-105'
                            : 'bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-pink-200 hover:border-pink-400 hover:shadow-lg'
                        }`}
                        onClick={() => toggleSelect(item)}
                      >
                        {/* 선택 체크박스 */}
                        <div className={`w-8 h-8 rounded-xl border-3 flex items-center justify-center transition-all ${
                          selectedItems.has(item)
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 border-pink-600 shadow-lg'
                            : 'bg-white border-gray-300 group-hover:border-pink-400'
                        }`}>
                          {selectedItems.has(item) && <span className="text-white text-xl font-black">✓</span>}
                        </div>

                        {/* 아이콘 */}
                        <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-3xl">🔒</span>
                        </div>
                        
                        {/* 내용 */}
                        <div className="flex-1">
                          <p className="font-mono text-xl text-gray-800 font-bold mb-1">
                            {item}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            <span>차단됨 · Google AI 전송 차단</span>
                          </p>
                        </div>
                        
                        {/* 삭제 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          className="px-5 py-3 rounded-xl bg-white hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-500 text-red-600 hover:text-white font-bold transition-all shadow-md hover:shadow-xl opacity-0 group-hover:opacity-100"
                        >
                          삭제
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}

          {/* 하단 버튼 */}
          <div className="bg-gradient-to-r from-pink-100 to-rose-100 px-8 py-6 border-t-2 border-pink-200">
            <button
              onClick={handleClose}
              className="w-full px-8 py-5 rounded-2xl font-black text-white text-xl transition-all hover:shadow-2xl hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%)',
              }}
            >
              닫기
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
