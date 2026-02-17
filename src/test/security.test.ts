import { describe, it, expect, beforeEach } from 'vitest';
import {
  obfuscateKey,
  deobfuscateKey,
  detectSensitiveInfo
} from '../utils/security';
import {
  loadKeywordDB,
  saveKeywordDB,
  addToBlockedKeywords,
  clearKeywordDB,
  type SensitiveKeywordDB
} from '../utils/keywordDB';

describe('Security Utils', () => {
  describe('API Key Obfuscation', () => {
    it('should obfuscate and deobfuscate correctly', () => {
      const original = 'test-api-key-12345';
      const obfuscated = obfuscateKey(original);
      const restored = deobfuscateKey(obfuscated);
      
      expect(obfuscated).not.toBe(original);
      expect(restored).toBe(original);
    });

    it('should handle empty string', () => {
      expect(deobfuscateKey(obfuscateKey(''))).toBe('');
    });

    it('should handle invalid obfuscated string', () => {
      expect(deobfuscateKey('invalid!')).toBe('');
    });
  });

  describe('Sensitive Information Detection', () => {
    beforeEach(() => {
      clearKeywordDB();
    });

    it('should detect IP address', () => {
      const warnings = detectSensitiveInfo('서버 10.52.30.15에서 오류');
      const ipWarnings = warnings.filter(w => w.type === 'IP 주소');
      
      expect(ipWarnings.length).toBeGreaterThan(0);
      expect(ipWarnings[0].pattern).toBe('10.52.30.15');
    });

    it('should detect phone number', () => {
      const warnings = detectSensitiveInfo('연락처: 010-1234-5678');
      const phoneWarnings = warnings.filter(w => w.type === '전화번호');
      
      expect(phoneWarnings.length).toBeGreaterThan(0);
    });

    it('should detect amount in Korean', () => {
      const warnings = detectSensitiveInfo('계약금 5억원 지급');
      const amountWarnings = warnings.filter(w => w.type === '금액 정보');
      
      expect(amountWarnings.length).toBeGreaterThan(0);
    });

    it('should detect company names', () => {
      const warnings = detectSensitiveInfo('삼성전자와 계약 체결');
      const companyWarnings = warnings.filter(w => w.type === '회사명');
      
      expect(companyWarnings.length).toBeGreaterThan(0);
      expect(companyWarnings[0].pattern).toBe('삼성');
    });

    it('should detect email via regex', () => {
      const warnings = detectSensitiveInfo('Contact admin@company.com please');
      const emailWarnings = warnings.filter(w => w.type === '이메일 주소');
      
      expect(emailWarnings.length).toBeGreaterThan(0);
      expect(emailWarnings[0].source).toBe('regex');
    });

    it('should detect learned keywords', () => {
      addToBlockedKeywords('SecretProject');
      const warnings = detectSensitiveInfo('SecretProject 관련 문서');
      const learnedWarnings = warnings.filter(w => w.source === 'learned');
      
      expect(learnedWarnings.length).toBeGreaterThan(0);
    });

    it('should detect learned patterns', () => {
      const db = loadKeywordDB();
      db.blockedPatterns.push('프로젝트\\d+');
      saveKeywordDB(db);
      
      const warnings = detectSensitiveInfo('프로젝트123 진행중');
      const patternWarnings = warnings.filter(w => w.type === '학습된 패턴');
      
      expect(patternWarnings.length).toBeGreaterThan(0);
    });

    it('should ignore invalid regex patterns', () => {
      const db = loadKeywordDB();
      db.blockedPatterns.push('[invalid(regex'); // 잘못된 정규식
      saveKeywordDB(db);
      
      // 오류 없이 처리되어야 함
      const warnings = detectSensitiveInfo('Some text');
      expect(warnings).toBeDefined();
    });
  });
});

describe('Keyword DB', () => {
  beforeEach(() => {
    clearKeywordDB();
  });

  it('should initialize empty DB', () => {
    const db = loadKeywordDB();
    expect(db.blockedKeywords).toEqual([]);
    expect(db.blockedPatterns).toEqual([]);
  });

  it('should save and load DB', () => {
    const db: SensitiveKeywordDB = {
      blockedKeywords: ['test1'],
      blockedPatterns: [],
      lastUpdated: Date.now()
    };
    
    saveKeywordDB(db);
    const loaded = loadKeywordDB();
    
    expect(loaded.blockedKeywords).toEqual(['test1']);
  });

  it('should add keyword in lowercase', () => {
    addToBlockedKeywords('Samsung');
    const db = loadKeywordDB();
    
    expect(db.blockedKeywords).toContain('samsung');
  });

  it('should not add duplicates', () => {
    addToBlockedKeywords('test');
    addToBlockedKeywords('TEST');
    addToBlockedKeywords('test');
    
    const db = loadKeywordDB();
    expect(db.blockedKeywords.filter(k => k === 'test').length).toBe(1);
  });
});
