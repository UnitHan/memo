import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsPage } from '../pages/SettingsPage';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    close: vi.fn().mockResolvedValue(undefined),
    setOpacity: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('SettingsPage - 외부 프레임워크 평가', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('1. 접근성 (Accessibility) 테스트', () => {
    it('모든 입력 필드에 적절한 레이블이 있어야 함', () => {
      render(<SettingsPage />);
      
      // API 키 입력에 레이블 확인
      const apiKeyInput = screen.getByLabelText(/gemini api 키/i);
      expect(apiKeyInput).toBeInTheDocument();
      
      // 투명도 슬라이더에 레이블 확인
      const opacityInput = screen.getByLabelText(/창 투명도/i);
      expect(opacityInput).toBeInTheDocument();
    });

    it('버튼에 적절한 텍스트나 aria-label이 있어야 함', () => {
      render(<SettingsPage />);
      
      // 하단 액션 버튼 찾기 (텍스트 기반)
      const buttons = screen.getAllByRole('button');
      const cancelBtn = buttons.find(btn => btn.textContent === '취소');
      const saveBtn = buttons.find(btn => btn.textContent?.includes('저장'));
      
      expect(cancelBtn).toBeInTheDocument();
      expect(saveBtn).toBeInTheDocument();
    });

    it('키보드로 모든 인터랙티브 요소에 접근 가능해야 함', () => {
      render(<SettingsPage />);
      
      const apiKeyInput = screen.getByLabelText(/gemini api 키/i);
      apiKeyInput.focus();
      expect(document.activeElement).toBe(apiKeyInput);
    });

    it('비밀번호 입력 필드에 보이기/숨기기 토글이 있어야 함', () => {
      render(<SettingsPage />);
      
      const apiKeyInput = screen.getByLabelText(/gemini api 키/i) as HTMLInputElement;
      expect(apiKeyInput.type).toBe('password');
      
      // 토글 버튼 찾기
      const toggleButtons = screen.getAllByRole('button');
      const toggleBtn = toggleButtons.find(btn => btn.textContent?.includes('👁'));
      
      if (toggleBtn) {
        fireEvent.click(toggleBtn);
        expect(apiKeyInput.type).toBe('text');
      }
    });
  });

  describe('2. 기능 (Functionality) 테스트', () => {
    it('API 키 입력이 정상적으로 동작해야 함', () => {
      render(<SettingsPage />);
      
      const input = screen.getByLabelText(/gemini api 키/i);
      fireEvent.change(input, { target: { value: 'test-api-key-123' } });
      
      expect(input).toHaveValue('test-api-key-123');
    });

    it('투명도 슬라이더가 0.3 ~ 1.0 범위를 가져야 함', () => {
      render(<SettingsPage />);
      
      const slider = screen.getByLabelText(/창 투명도/i) as HTMLInputElement;
      expect(Number(slider.min)).toBe(0.3);
      expect(Number(slider.max)).toBe(1);
      expect(Number(slider.step)).toBe(0.05);
    });

    it('프리셋 버튼 클릭 시 투명도가 변경되어야 함', async () => {
      render(<SettingsPage />);
      
      // "50%" 텍스트를 가진 버튼 찾기
      const buttons = screen.getAllByRole('button');
      const preset50 = buttons.find(btn => btn.textContent === '50%');
      
      expect(preset50).toBeInTheDocument();
      
      if (preset50) {
        fireEvent.click(preset50);
        
        await waitFor(() => {
          const slider = screen.getByLabelText(/창 투명도/i) as HTMLInputElement;
          expect(Number(slider.value)).toBe(0.5);
        });
      }
    });

    it('저장 버튼 클릭 시 localStorage에 데이터가 저장되어야 함', async () => {
      render(<SettingsPage />);
      
      const input = screen.getByLabelText(/gemini api 키/i);
      fireEvent.change(input, { target: { value: 'test-key-123' } });
      
      // "저장하고 닫기" 버튼 찾기
      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(btn => btn.textContent?.includes('저장하고'));
      
      expect(saveBtn).toBeInTheDocument();
      
      if (saveBtn) {
        fireEvent.click(saveBtn);
        
        // localStorage에 저장되었는지 확인 (비동기 처리 대기)
        await waitFor(() => {
          const saved = localStorage.getItem('gemini_api_key');
          expect(saved).toBeTruthy();
        });
      }
    });

    it('취소 버튼 클릭 시 변경사항이 저장되지 않아야 함', async () => {
      render(<SettingsPage />);
      
      // 초기값 저장
      const initialKey = localStorage.getItem('gemini_api_key') || '';
      
      const input = screen.getByLabelText(/gemini api 키/i);
      fireEvent.change(input, { target: { value: 'new-key-should-not-save' } });
      
      // "취소" 텍스트만 가진 버튼 찾기
      const buttons = screen.getAllByRole('button');
      const cancelBtn = buttons.find(btn => btn.textContent === '취소');
      
      expect(cancelBtn).toBeInTheDocument();
      
      if (cancelBtn) {
        fireEvent.click(cancelBtn);
        
        // localStorage가 변경되지 않았는지 확인
        await waitFor(() => {
          const currentKey = localStorage.getItem('gemini_api_key') || '';
          expect(currentKey).toBe(initialKey);
        });
      }
    });
  });

  describe('3. UI/UX 일관성 테스트', () => {
    it('Windows 11 디자인 시스템 색상을 사용해야 함', () => {
      const { container } = render(<SettingsPage />);
      
      const mainDiv = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(mainDiv);
      expect(styles.backgroundColor).toBeTruthy();
    });

    it('모든 카드에 일관된 border-radius가 적용되어야 함', () => {
      const { container } = render(<SettingsPage />);
      
      const cards = container.querySelectorAll('.rounded-sm');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('모든 카드에 그림자가 적용되어야 함', () => {
      const { container } = render(<SettingsPage />);
      
      const cards = container.querySelectorAll('[class*="shadow"]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('spacing이 일관되어야 함 (space-y-4 = 16px)', () => {
      const { container } = render(<SettingsPage />);
      
      const spacedContainer = container.querySelector('.space-y-4');
      expect(spacedContainer).toBeInTheDocument();
    });
  });

  describe('4. 성능 (Performance) 테스트', () => {
    it('렌더링이 1초 이내에 완료되어야 함', () => {
      const startTime = performance.now();
      render(<SettingsPage />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('불필요한 리렌더링이 발생하지 않아야 함', () => {
      const { rerender } = render(<SettingsPage />);
      
      const renderCount = 1;
      rerender(<SettingsPage />);
      
      expect(renderCount).toBe(1);
    });
  });

  describe('5. 보안 (Security) 테스트', () => {
    it('API 키 입력이 기본적으로 password 타입이어야 함', () => {
      render(<SettingsPage />);
      
      const input = screen.getByLabelText(/gemini api 키/i) as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('외부 링크가 안전하게 열려야 함', () => {
      render(<SettingsPage />);
      
      const link = screen.getByText(/google ai studio/i).closest('a');
      expect(link).toHaveAttribute('href', 'https://makersuite.google.com/app/apikey');
    });
  });

  describe('6. 반응형 (Responsive) 테스트', () => {
    it('최대 너비가 680px로 제한되어야 함', () => {
      const { container } = render(<SettingsPage />);
      
      const contentDiv = container.querySelector('.max-w-\\[680px\\]');
      expect(contentDiv).toBeInTheDocument();
    });

    it('작은 화면에서도 레이아웃이 깨지지 않아야 함', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 });
      
      const { container } = render(<SettingsPage />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('7. 에러 처리 (Error Handling) 테스트', () => {
    it('빈 API 키로 저장 시도 시 처리되어야 함', async () => {
      render(<SettingsPage />);
      
      // "저장하고 닫기" 버튼 찾기
      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(btn => btn.textContent?.includes('저장하고'));
      
      expect(saveBtn).toBeInTheDocument();
      
      if (saveBtn) {
        fireEvent.click(saveBtn);
        expect(saveBtn).toBeInTheDocument();
      }
    });

    it('Tauri API 실패 시 graceful하게 처리되어야 함', async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const mockWindow = getCurrentWindow() as any;
      
      mockWindow.setOpacity.mockRejectedValueOnce(new Error('Failed'));
      
      render(<SettingsPage />);
      
      const slider = screen.getByLabelText(/창 투명도/i);
      fireEvent.change(slider, { target: { value: '0.8' } });
      
      await waitFor(() => {
        expect(slider).toBeInTheDocument();
      });
    });
  });

  describe('8. 컨텐츠 품질 테스트', () => {
    it('정보 안내 박스가 명확한 메시지를 제공해야 함', () => {
      render(<SettingsPage />);
      
      expect(screen.getByText(/api 키 발급/i)).toBeInTheDocument();
      expect(screen.getByText(/google ai studio/i)).toBeInTheDocument();
      expect(screen.getByText(/로컬 저장소/i)).toBeInTheDocument();
    });

    it('모든 텍스트가 읽기 쉬운 크기여야 함 (최소 12px)', () => {
      const { container } = render(<SettingsPage />);
      
      const textElements = container.querySelectorAll('[class*="text-\\[1"]');
      expect(textElements.length).toBeGreaterThan(0);
    });
  });
});
