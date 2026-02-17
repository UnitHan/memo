import { describe, it, expect, beforeEach } from 'vitest';
import { saveApiKey, loadApiKey, clearApiKey } from '../utils/apiKeyStorage';

describe('API Key Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and load API key', () => {
    saveApiKey('test-api-key-123');
    const loaded = loadApiKey();
    
    expect(loaded).toBe('test-api-key-123');
  });

  it('should return empty string when no API key stored', () => {
    const loaded = loadApiKey();
    
    expect(loaded).toBe('');
  });

  it('should clear API key', () => {
    saveApiKey('test-key');
    clearApiKey();
    const loaded = loadApiKey();
    
    expect(loaded).toBe('');
  });

  it('should obfuscate API key in storage', () => {
    saveApiKey('plain-text-key');
    const stored = localStorage.getItem('gemini_api_key');
    
    expect(stored).not.toBe('plain-text-key');
    expect(stored).not.toBeNull();
  });
});
