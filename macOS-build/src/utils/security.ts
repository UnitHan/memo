/**
 * security.ts
 * 보안 관련 유틸리티 함수
 * - API 키 난독화/복호화
 * - 민감 정보 자동 감지 (3단계 검사)
 */

import validator from 'validator';
import { loadKeywordDB } from './keywordDB';

// API 키 난독화 (Base64 + 역순)
export const obfuscateKey = (key: string): string => {
  return btoa(key.split('').reverse().join(''));
};

export const deobfuscateKey = (obfuscated: string): string => {
  try {
    return atob(obfuscated).split('').reverse().join('');
  } catch {
    return '';
  }
};

// 보안 경고 인터페이스
export interface SecurityWarning {
  level: number; // 1: 낮음, 2: 중간, 3: 높음
  type: string;
  pattern: string;
  suggestion: string;
  source: 'regex' | 'validator' | 'learned';
}

// 민감 정보 감지 (3단계 검사)
export const detectSensitiveInfo = (text: string): SecurityWarning[] => {
  const warnings: SecurityWarning[] = [];
  
  // === 1단계: 정규식 기반 빠른 검사 ===
  
  // 이메일 주소 감지
  const emailRegex = /[\w.-]+@[\w.-]+\.\w{2,}/g;
  const emailMatches = text.match(emailRegex);
  if (emailMatches) {
    emailMatches.forEach(email => {
      warnings.push({
        level: 3,
        type: '이메일 주소',
        pattern: email,
        suggestion: '[이메일]',
        source: 'regex'
      });
    });
  }
  
  // IP 주소 감지
  const ipMatch = text.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  if (ipMatch) {
    warnings.push({
      level: 3,
      type: 'IP 주소',
      pattern: ipMatch[0],
      suggestion: '[서버주소]',
      source: 'regex'
    });
  }
  
  // 전화번호 감지 (한국)
  const phoneMatch = text.match(/0\d{1,2}-?\d{3,4}-?\d{4}/);
  if (phoneMatch) {
    warnings.push({
      level: 3,
      type: '전화번호',
      pattern: phoneMatch[0],
      suggestion: '[연락처]',
      source: 'regex'
    });
  }
  
  // 금액 정보 감지
  if (/\d+억|억\s*원|\d+만\s*원/.test(text)) {
    warnings.push({
      level: 2,
      type: '금액 정보',
      pattern: '금액 표현',
      suggestion: '[금액]',
      source: 'regex'
    });
  }
  
  // 대표적인 회사명 감지
  const companies = ['삼성', '현대', 'LG', 'SK', '네이버', '카카오', '쿠팡', 
                     'Samsung', 'Hyundai', 'Naver', 'Kakao', 'Coupang'];
  companies.forEach(company => {
    if (text.includes(company)) {
      warnings.push({
        level: 2,
        type: '회사명',
        pattern: company,
        suggestion: 'A사',
        source: 'regex'
      });
    }
  });
  
  // === 2단계: validator.js 정밀 검사 ===
  
  const words = text.split(/[\s,;.!?()]+/);
  words.forEach(word => {
    // 이메일 검증
    if (validator.isEmail(word)) {
      warnings.push({
        level: 3,
        type: '이메일 주소',
        pattern: word,
        suggestion: '[이메일]',
        source: 'validator'
      });
    }
    
    // IP 검증 (정규식 보완)
    if (validator.isIP(word)) {
      if (!warnings.some(w => w.pattern === word && w.type === 'IP 주소')) {
        warnings.push({
          level: 3,
          type: 'IP 주소',
          pattern: word,
          suggestion: '[IP주소]',
          source: 'validator'
        });
      }
    }
    
    // 신용카드 번호
    const cardNumber = word.replace(/[-\s]/g, '');
    if (validator.isCreditCard(cardNumber)) {
      warnings.push({
        level: 3,
        type: '신용카드 번호',
        pattern: '****',
        suggestion: '⛔ 절대 입력 금지',
        source: 'validator'
      });
    }
    
    // URL (내부 서버 URL 등)
    if (validator.isURL(word)) {
      warnings.push({
        level: 2,
        type: 'URL',
        pattern: word,
        suggestion: '[링크]',
        source: 'validator'
      });
    }
  });
  
  // === 3단계: 로컬 DB 학습된 키워드 검사 ===
  
  const db = loadKeywordDB();
  
  // 차단된 키워드 검사
  db.blockedKeywords.forEach(keyword => {
    if (text.toLowerCase().includes(keyword)) {
      warnings.push({
        level: 3,
        type: '학습된 민감 키워드',
        pattern: keyword,
        suggestion: '[차단됨]',
        source: 'learned'
      });
    }
  });
  
  // 차단된 패턴 검사 (정규식)
  db.blockedPatterns.forEach(pattern => {
    try {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(text)) {
        warnings.push({
          level: 3,
          type: '학습된 패턴',
          pattern: pattern,
          suggestion: '[차단됨]',
          source: 'learned'
        });
      }
    } catch {
      // 잘못된 정규식 패턴 무시
    }
  });
  
  return warnings;
};
