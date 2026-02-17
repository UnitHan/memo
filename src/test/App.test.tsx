import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setOpacity: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({
    listen: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should render textarea with correct placeholder', () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText('메모를 작성하세요...');
    expect(textarea).toBeInTheDocument();
  });

  it('should handle text input changes', () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText('메모를 작성하세요...');
    fireEvent.change(textarea, { target: { value: '테스트 텍스트' } });
    expect(textarea).toHaveValue('테스트 텍스트');
  });

  it('should render format buttons (B, I, U)', () => {
    render(<App />);
    expect(screen.getByTitle('굵게')).toBeInTheDocument();
    expect(screen.getByTitle('기울임꼴')).toBeInTheDocument();
    expect(screen.getByTitle('밑줄')).toBeInTheDocument();
  });

  it('should render AI correction button', () => {
    render(<App />);
    expect(screen.getByTitle('AI 교정')).toBeInTheDocument();
  });

  it('should render color and shield buttons', () => {
    render(<App />);
    expect(screen.getByTitle(/색상/)).toBeInTheDocument();
    expect(screen.getByTitle('학습 관리')).toBeInTheDocument();
  });
});

// ============================================
// 전문 접근성 및 UI/UX 검사 (axe-core)
// ============================================

describe('App - 전문 접근성 검사 (axe-core)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('WCAG 2.1 Level A 위반 사항이 없어야 함', async () => {
    const { container } = render(<App />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false }
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('WCAG 2.1 Level AA 위반 사항이 없어야 함', async () => {
    const { container } = render(<App />);
    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('전체 접근성 점수', async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    
    console.log('\n📊 App 접근성 검사 결과:');
    console.log(`✅ 통과: ${results.passes.length}개`);
    console.log(`⚠️  경고: ${results.incomplete.length}개`);
    console.log(`❌ 위반: ${results.violations.length}개`);
    
    if (results.violations.length > 0) {
      console.log('\n위반 사항:');
      results.violations.forEach((v: any) => {
        console.log(`  - ${v.id}: ${v.description}`);
      });
    }
    
    expect(results).toHaveNoViolations();
  });
});

describe('App - UI 품질 메트릭', () => {
  it('렌더링 성능: 100ms 이내', () => {
    const start = performance.now();
    render(<App />);
    const duration = performance.now() - start;
    
    console.log(`⚡ 렌더링: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });

  it('DOM 복잡도: 300개 이하', () => {
    const { container } = render(<App />);
    const count = container.querySelectorAll('*').length;
    
    console.log(`📦 DOM 요소: ${count}개`);
    expect(count).toBeLessThan(300);
  });

  it('인터랙티브 요소: 최소 10개', () => {
    const { container } = render(<App />);
    const interactive = container.querySelectorAll('button, textarea, input');
    
    console.log(`🎯 인터랙티브: ${interactive.length}개`);
    expect(interactive.length).toBeGreaterThanOrEqual(10);
  });

  it('Sticky Notes 디자인 점수', () => {
    const { container } = render(<App />);
    const html = container.innerHTML;
    
    const checks = {
      font: html.includes('Segoe'),
      colors: html.includes('rgb(255, 251, 149)'),
      placeholder: html.includes('메모를 작성하세요'),
    };
    
    const score = Object.values(checks).filter(Boolean).length * 33.3;
    console.log(`🎨 디자인: ${score.toFixed(0)}/100`);
    console.log(`  - Segoe 폰트: ${checks.font ? '✅' : '❌'}`);
    console.log(`  - 색상 팔레트: ${checks.colors ? '✅' : '❌'}`);
    console.log(`  - Placeholder: ${checks.placeholder ? '✅' : '❌'}`);
    
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('색상 버튼 존재', () => {
    render(<App />);
    const colorButton = screen.getByTitle(/색상/);
    
    console.log(`🌈 색상 버튼: ✅`);
    expect(colorButton).toBeInTheDocument();
  });

  it('포맷 툴바: B, I, U 버튼', () => {
    render(<App />);
    const boldBtn = screen.getByTitle('굵게');
    const italicBtn = screen.getByTitle('기울임꼴');
    const underlineBtn = screen.getByTitle('밑줄');
    
    console.log(`📝 포맷: 3개 (B, I, U) ✅`);
    expect(boldBtn).toBeInTheDocument();
    expect(italicBtn).toBeInTheDocument();
    expect(underlineBtn).toBeInTheDocument();
  });
});
