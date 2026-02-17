import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeywordManager } from '../components/KeywordManager';
import { addToBlockedKeywords, clearKeywordDB } from '../utils/keywordDB';

describe('KeywordManager Component', () => {
  beforeEach(() => {
    clearKeywordDB();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <KeywordManager isOpen={false} onClose={() => {}} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText(/학습된 민감 키워드/i)).toBeInTheDocument();
  });

  it('should show empty message when no keywords', () => {
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('학습된 키워드가 없습니다.')).toBeInTheDocument();
  });

  it('should display blocked keywords', () => {
    addToBlockedKeywords('SecretProject');
    
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('secretproject')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onCloseMock = vi.fn();
    
    render(<KeywordManager isOpen={true} onClose={onCloseMock} />);
    
    const closeButton = screen.getByText('닫기');
    fireEvent.click(closeButton);
    
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should show confirmation dialog when clearing all', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    addToBlockedKeywords('test');
    
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    const clearButton = screen.getByText('학습 데이터 초기화');
    fireEvent.click(clearButton);
    
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('test')).toBeInTheDocument(); // 취소했으므로 여전히 존재
    confirmSpy.mockRestore();
  });

  it('should clear all keywords when confirmed', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    addToBlockedKeywords('test1');
    addToBlockedKeywords('test2');
    
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('test1')).toBeInTheDocument();
    
    const clearButton = screen.getByText('학습 데이터 초기화');
    fireEvent.click(clearButton);
    
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('학습된 키워드가 없습니다.')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('should remove individual keyword', () => {
    addToBlockedKeywords('removeMe');
    
    render(<KeywordManager isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('removeme')).toBeInTheDocument();
    
    const deleteButton = screen.getByText('삭제');
    fireEvent.click(deleteButton);
    
    expect(screen.queryByText('removeme')).not.toBeInTheDocument();
  });

  it('should close when clicking backdrop', () => {
    const onCloseMock = vi.fn();
    
    render(<KeywordManager isOpen={true} onClose={onCloseMock} />);
    
    const backdrop = screen.getByText(/학습된 민감 키워드/i).closest('.fixed');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onCloseMock).toHaveBeenCalled();
    }
  });
});
