import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => {
    return (globalThis as any).__localStorage__?.[key] || null
  },
  setItem: (key: string, value: string) => {
    if (!(globalThis as any).__localStorage__) {
      (globalThis as any).__localStorage__ = {}
    }
    (globalThis as any).__localStorage__[key] = value
  },
  removeItem: (key: string) => {
    if ((globalThis as any).__localStorage__) {
      delete (globalThis as any).__localStorage__[key]
    }
  },
  clear: () => {
    (globalThis as any).__localStorage__ = {}
  }
}

globalThis.localStorage = localStorageMock as Storage

// Mock Tauri API
(globalThis as any).window = (globalThis as any).window || {}
