/**
 * apiKeyStorage.ts
 * Gemini API 키 로컬 저장소 관리
 * - 난독화된 형태로 localStorage 저장
 */

import { obfuscateKey, deobfuscateKey } from './security';

const API_KEY_STORAGE = 'gemini_api_key';

export const saveApiKey = (apiKey: string): void => {
  try {
    const obfuscated = obfuscateKey(apiKey);
    localStorage.setItem(API_KEY_STORAGE, obfuscated);
    console.log('💾 localStorage 저장 완료:', API_KEY_STORAGE);
  } catch (error) {
    console.error('❌ localStorage 저장 실패:', error);
  }
};

export const loadApiKey = (): string => {
  try {
    const obfuscated = localStorage.getItem(API_KEY_STORAGE);
    console.log('📂 localStorage 읽기:', obfuscated ? '데이터 있음' : '데이터 없음');
    if (obfuscated) {
      return deobfuscateKey(obfuscated);
    }
    return '';
  } catch (error) {
    console.error('❌ localStorage 읽기 실패:', error);
    return '';
  }
};

export const clearApiKey = (): void => {
  localStorage.removeItem(API_KEY_STORAGE);
};
