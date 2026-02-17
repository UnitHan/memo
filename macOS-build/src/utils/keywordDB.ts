/**
 * keywordDB.ts
 * 로컬 민감 키워드 데이터베이스 관리
 * - localStorage 기반 학습 데이터 저장
 * - 사용자가 차단한 키워드/패턴 누적
 */

export interface SensitiveKeywordDB {
  blockedKeywords: string[];
  blockedPatterns: string[];
  lastUpdated: number;
}

const DB_KEY = 'sensitive_keywords_db';

export const loadKeywordDB = (): SensitiveKeywordDB => {
  const stored = localStorage.getItem(DB_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { blockedKeywords: [], blockedPatterns: [], lastUpdated: Date.now() };
    }
  }
  return { blockedKeywords: [], blockedPatterns: [], lastUpdated: Date.now() };
};

export const saveKeywordDB = (db: SensitiveKeywordDB): void => {
  db.lastUpdated = Date.now();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const addToBlockedKeywords = (keyword: string): void => {
  const db = loadKeywordDB();
  const normalized = keyword.toLowerCase();
  if (!db.blockedKeywords.includes(normalized)) {
    db.blockedKeywords.push(normalized);
    saveKeywordDB(db);
  }
};

export const addToBlockedPatterns = (pattern: string): void => {
  const db = loadKeywordDB();
  if (!db.blockedPatterns.includes(pattern)) {
    db.blockedPatterns.push(pattern);
    saveKeywordDB(db);
  }
};

export const removeBlockedKeyword = (keyword: string): void => {
  const db = loadKeywordDB();
  db.blockedKeywords = db.blockedKeywords.filter(k => k !== keyword.toLowerCase());
  saveKeywordDB(db);
};

export const removeBlockedPattern = (pattern: string): void => {
  const db = loadKeywordDB();
  db.blockedPatterns = db.blockedPatterns.filter(p => p !== pattern);
  saveKeywordDB(db);
};

export const clearKeywordDB = (): void => {
  const db: SensitiveKeywordDB = {
    blockedKeywords: [],
    blockedPatterns: [],
    lastUpdated: Date.now()
  };
  saveKeywordDB(db);
};
