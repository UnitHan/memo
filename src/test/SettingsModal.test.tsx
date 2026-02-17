import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../components/SettingsModal';

describe('SettingsModal Component', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <SettingsModal 
        isOpen={false} 
        onClose={() => {}} 
        currentApiKey="" 
        onSave={() => {}}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(
      <SettingsModal 
        isOpen={true} 
        onClose={() => {}} 
        currentApiKey="" 
        onSave={() => {}}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    expect(screen.getByText('Gemini API 키')).toBeInTheDocument();
  });

  it('should display current API key', () => {
    render(
      <SettingsModal 
        isOpen={true} 
        onClose={() => {}} 
        currentApiKey="test-key-12345" 
        onSave={() => {}}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    const input = screen.getByPlaceholderText('API 키를 입력하세요') as HTMLInputElement;
    expect(input.value).toBe('test-key-12345');
  });

  it('should update API key input', () => {
    render(
      <SettingsModal 
        isOpen={true} 
        onClose={() => {}} 
        currentApiKey="" 
        onSave={() => {}}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    const input = screen.getByPlaceholderText('API 키를 입력하세요');
    fireEvent.change(input, { target: { value: 'new-api-key' } });
    
    expect(input).toHaveValue('new-api-key');
  });

  it('should call onSave with new API key', () => {
    const onSaveMock = vi.fn();
    
    render(
      <SettingsModal 
        isOpen={true} 
        onClose={() => {}} 
        currentApiKey="" 
        onSave={onSaveMock}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    const input = screen.getByPlaceholderText('API 키를 입력하세요');
    fireEvent.change(input, { target: { value: 'new-key' } });
    
    const saveButton = screen.getByText('저장');
    fireEvent.click(saveButton);
    
    expect(onSaveMock).toHaveBeenCalledWith('new-key');
  });

  it('should call onClose when cancel button clicked', () => {
    const onCloseMock = vi.fn();
    
    render(
      <SettingsModal 
        isOpen={true} 
        onClose={onCloseMock} 
        currentApiKey="" 
        onSave={() => {}}
        opacity={0.95}
        onOpacityChange={() => {}}
      />
    );
    
    const cancelButton = screen.getByText('취소');
    fireEvent.click(cancelButton);
    
    expect(onCloseMock).toHaveBeenCalled();
  });
});
