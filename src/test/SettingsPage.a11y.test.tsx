/**
 * SettingsPage - 전문 UI/UX 검사
 * axe-core를 사용한 WCAG 2.1 AA 접근성 자동 검사
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SettingsPage } from '../pages/SettingsPage';

// jest-axe matcher 추가
expect.extend(toHaveNoViolations);

describe('SettingsPage - 전문 접근성 검사 (axe-core)', () => {
  it('WCAG 2.1 Level A 위반 사항이 없어야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      rules: {
        // Level A 규칙만 검사
        'color-contrast': { enabled: false } // Level AA이므로 다음 테스트에서
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('WCAG 2.1 Level AA 위반 사항이 없어야 함 (색상 대비 포함)', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('키보드 접근성 규칙을 준수해야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['keyboard']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('시맨틱 HTML 규칙을 준수해야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['best-practice']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('색상 대비가 4.5:1 이상이어야 함 (일반 텍스트)', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('form 요소에 적절한 레이블이 있어야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'rule',
        values: ['label', 'label-content-name-mismatch']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('이미지/아이콘에 대체 텍스트가 있어야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'rule',
        values: ['image-alt', 'svg-img-alt']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('링크에 식별 가능한 텍스트가 있어야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'rule',
        values: ['link-name']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('버튼에 접근 가능한 이름이 있어야 함', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      runOnly: {
        type: 'rule',
        values: ['button-name']
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('전체 접근성 점수 (모든 규칙)', async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container);
    
    console.log('\n📊 전체 접근성 검사 결과:');
    console.log(`✅ 통과: ${results.passes.length}개 규칙`);
    console.log(`⚠️  경고: ${results.incomplete.length}개 항목`);
    console.log(`❌ 위반: ${results.violations.length}개 항목`);
    
    if (results.violations.length > 0) {
      console.log('\n❌ 위반 사항 상세:');
      results.violations.forEach(violation => {
        console.log(`  - ${violation.id}: ${violation.description}`);
        console.log(`    영향도: ${violation.impact}`);
        console.log(`    발견: ${violation.nodes.length}개 요소`);
      });
    }
    
    expect(results).toHaveNoViolations();
  });
});

describe('SettingsPage - UI 품질 메트릭', () => {
  it('렌더링 성능: 100ms 이내', () => {
    const start = performance.now();
    render(<SettingsPage />);
    const duration = performance.now() - start;
    
    console.log(`⚡ 렌더링 시간: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });

  it('DOM 복잡도: 200개 이하 요소', () => {
    const { container } = render(<SettingsPage />);
    const elementCount = container.querySelectorAll('*').length;
    
    console.log(`📦 DOM 요소 개수: ${elementCount}개`);
    expect(elementCount).toBeLessThan(200);
  });

  it('인터랙티브 요소 비율: 최소 5개', () => {
    const { container } = render(<SettingsPage />);
    const interactive = container.querySelectorAll('button, input, a, select, textarea');
    
    console.log(`🎯 인터랙티브 요소: ${interactive.length}개`);
    expect(interactive.length).toBeGreaterThanOrEqual(5);
  });

  it('Windows 11 디자인 토큰 준수', () => {
    const { container } = render(<SettingsPage />);
    const html = container.innerHTML;
    
    const designTokens = {
      accentColor: '#0067C0',
      backgroundColor: '#F3F3F3',
      textColor: '#1F1F1F',
      borderRadius: 'rounded-sm',
      shadow: 'shadow-'
    };
    
    const score = {
      accentColor: html.includes(designTokens.accentColor) ? 20 : 0,
      backgroundColor: html.includes(designTokens.backgroundColor) ? 20 : 0,
      textColor: html.includes(designTokens.textColor) ? 20 : 0,
      borderRadius: html.includes(designTokens.borderRadius) ? 20 : 0,
      shadow: html.includes(designTokens.shadow) ? 20 : 0
    };
    
    const totalScore = Object.values(score).reduce((a, b) => a + b, 0);
    console.log(`🎨 디자인 토큰 점수: ${totalScore}/100`);
    console.log('  - Accent Color (#0067C0):', score.accentColor === 20 ? '✅' : '❌');
    console.log('  - Background (#F3F3F3):', score.backgroundColor === 20 ? '✅' : '❌');
    console.log('  - Text Color (#1F1F1F):', score.textColor === 20 ? '✅' : '❌');
    console.log('  - Border Radius (rounded-sm):', score.borderRadius === 20 ? '✅' : '❌');
    console.log('  - Shadow:', score.shadow === 20 ? '✅' : '❌');
    
    expect(totalScore).toBeGreaterThanOrEqual(80);
  });

  it('반응형 디자인: max-width 설정 확인', () => {
    const { container } = render(<SettingsPage />);
    const content = container.querySelector('.max-w-\\[680px\\]');
    
    expect(content).toBeInTheDocument();
    console.log('📱 반응형: max-width 680px ✅');
  });

  it('Segoe UI 폰트 사용 확인', () => {
    const { container } = render(<SettingsPage />);
    const mainDiv = container.firstChild as HTMLElement;
    
    const style = mainDiv.getAttribute('style');
    expect(style).toContain('Segoe UI');
    console.log('🔤 타이포그래피: Segoe UI ✅');
  });
});
