import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadKeywordDB,
  saveKeywordDB,
  addToBlockedKeywords,
  addToBlockedPatterns,
  removeBlockedKeyword,
  removeBlockedPattern,
  clearKeywordDB,
  type SensitiveKeywordDB
} from '../utils/keywordDB';

describe('Keyword DB - Extended Tests', () => {
  beforeEach(() => {
    clearKeywordDB();
  });

  describe('Blocked Patterns', () => {
    it('should add pattern to DB', () => {
      addToBlockedPatterns('\\d{3}-\\d{4}');
      const db = loadKeywordDB();
      
      expect(db.blockedPatterns).toContain('\\d{3}-\\d{4}');
    });

    it('should not add duplicate patterns', () => {
      addToBlockedPatterns('test-pattern');
      addToBlockedPatterns('test-pattern');
      
      const db = loadKeywordDB();
      expect(db.blockedPatterns.filter(p => p === 'test-pattern').length).toBe(1);
    });

    it('should remove blocked pattern', () => {
      addToBlockedPatterns('pattern1');
      addToBlockedPatterns('pattern2');
      removeBlockedPattern('pattern1');
      
      const db = loadKeywordDB();
      expect(db.blockedPatterns).not.toContain('pattern1');
      expect(db.blockedPatterns).toContain('pattern2');
    });
  });

  describe('Keyword Removal', () => {
    it('should remove blocked keyword', () => {
      addToBlockedKeywords('test1');
      addToBlockedKeywords('test2');
      removeBlockedKeyword('test1');
      
      const db = loadKeywordDB();
      expect(db.blockedKeywords).not.toContain('test1');
      expect(db.blockedKeywords).toContain('test2');
    });

    it('should handle case-insensitive removal', () => {
      addToBlockedKeywords('TestKeyword');
      removeBlockedKeyword('TESTKEYWORD');
      
      const db = loadKeywordDB();
      expect(db.blockedKeywords).toHaveLength(0);
    });
  });

  describe('Database Persistence', () => {
    it('should update lastUpdated timestamp on save', () => {
      const before = Date.now();
      
      const db: SensitiveKeywordDB = {
        blockedKeywords: ['test'],
        blockedPatterns: [],
        lastUpdated: 0
      };
      
      saveKeywordDB(db);
      const loaded = loadKeywordDB();
      
      expect(loaded.lastUpdated).toBeGreaterThanOrEqual(before);
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('sensitive_keywords_db', '{invalid json');
      const db = loadKeywordDB();
      
      expect(db.blockedKeywords).toEqual([]);
      expect(db.blockedPatterns).toEqual([]);
    });
  });

  describe('Clear All Data', () => {
    it('should clear all keywords and patterns', () => {
      addToBlockedKeywords('keyword1');
      addToBlockedKeywords('keyword2');
      addToBlockedPatterns('pattern1');
      
      clearKeywordDB();
      const db = loadKeywordDB();
      
      expect(db.blockedKeywords).toHaveLength(0);
      expect(db.blockedPatterns).toHaveLength(0);
    });
  });
});
