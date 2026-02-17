import { describe, it, expect } from 'vitest'
import validator from 'validator'

describe('Validator.js Integration', () => {
  describe('Email Detection', () => {
    it('should detect valid email', () => {
      expect(validator.isEmail('test@example.com')).toBe(true)
      expect(validator.isEmail('user.name@company.co.kr')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(validator.isEmail('not-an-email')).toBe(false)
      expect(validator.isEmail('@example.com')).toBe(false)
      expect(validator.isEmail('test@')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validator.isEmail('')).toBe(false)
      expect(validator.isEmail('test @example.com')).toBe(false) // 공백
    })
  })

  describe('IP Address Detection', () => {
    it('should detect valid IPv4', () => {
      expect(validator.isIP('192.168.1.1')).toBe(true)
      expect(validator.isIP('10.52.30.15')).toBe(true)
      expect(validator.isIP('8.8.8.8')).toBe(true)
    })

    it('should detect valid IPv6', () => {
      expect(validator.isIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
      expect(validator.isIP('::1')).toBe(true)
    })

    it('should reject invalid IP', () => {
      expect(validator.isIP('999.999.999.999')).toBe(false)
      expect(validator.isIP('2.0.1')).toBe(false) // 버전 번호
      expect(validator.isIP('not-an-ip')).toBe(false)
    })
  })

  describe('Credit Card Detection', () => {
    it('should detect valid credit card', () => {
      expect(validator.isCreditCard('4532015112830366')).toBe(true) // Visa
      expect(validator.isCreditCard('5425233430109903')).toBe(true) // Mastercard
    })

    it('should handle card with dashes', () => {
      const card = '4532-0151-1283-0366'.replace(/-/g, '')
      expect(validator.isCreditCard(card)).toBe(true)
    })

    it('should reject invalid card', () => {
      expect(validator.isCreditCard('1234567890123456')).toBe(false)
      expect(validator.isCreditCard('not-a-card')).toBe(false)
    })
  })

  describe('URL Detection', () => {
    it('should detect valid URL', () => {
      expect(validator.isURL('https://example.com')).toBe(true)
      expect(validator.isURL('http://internal-server.local')).toBe(true)
    })

    it('should detect URL with port', () => {
      // validator.js는 localhost를 유효한 도메인으로 인정 안 함
      expect(validator.isURL('https://example.com:8080')).toBe(true)
      expect(validator.isURL('https://192.168.1.1:3000/api')).toBe(true)
    })

    it('should reject invalid URL', () => {
      expect(validator.isURL('not-a-url')).toBe(false)
      expect(validator.isURL('ftp://invalid')).toBe(false) // ftp는 기본적으로 false
    })
  })

  describe('Multiple Field Detection', () => {
    it('should detect multiple sensitive info types', () => {
      const text = 'Contact: admin@company.com Server: 10.52.30.15 Card: 4532015112830366'
      // split 결과: ['Contact:', 'admin@company', 'com', 'Server:', ...]
      // 이메일이 .com으로 분리됨 → 파싱 전략 변경 필요
      
      // 실제 detectSensitiveInfo() 로직과 유사하게 검증
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/)
      const ipMatch = text.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
      
      expect(emailMatch).not.toBeNull()
      expect(ipMatch).not.toBeNull()
      expect(validator.isEmail(emailMatch![0])).toBe(true)
      expect(validator.isIP(ipMatch![0])).toBe(true)
    })
  })
})

describe('Text Parsing for Validation', () => {
  it('should split text correctly', () => {
    const text = 'Email: test@example.com, IP: 192.168.1.1'
    const words = text.split(/[\s,;!?()]+/)  // .을 구분자에서 제외
    
    expect(words).toContain('test@example.com')
    expect(words).toContain('192.168.1.1')
  })

  it('should handle multiple delimiters', () => {
    const text = 'a,b;c.d!e?f(g)h'
    const words = text.split(/[\s,;.!?()]+/)
    
    expect(words).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
  })

  it('should filter empty strings', () => {
    const text = 'a  b   c'
    const words = text.split(/[\s,;.!?()]+/).filter(w => w.length > 0)
    
    expect(words).toEqual(['a', 'b', 'c'])
  })
})
