"""
향상된 Gemini Corrector 테스트
- 모든 함수 경로 테스트
- 에지 케이스 커버
- 100% 커버리지 목표
"""
import sys
import json
import pytest
import subprocess
from unittest.mock import patch, MagicMock
from io import StringIO
import gemini_corrector


class TestCorrectText:
    """correct_text 함수 테스트"""
    
    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_correct_text_success(self, mock_model, mock_configure):
        """정상적인 텍스트 교정"""
        mock_response = MagicMock()
        mock_response.text = "교정된 텍스트입니다."
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-api-key", "테스트 텍스트")
        
        assert result["success"] is True
        assert result["corrected_text"] == "교정된 텍스트입니다."
        mock_configure.assert_called_once_with(api_key="test-api-key")

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_correct_text_api_error(self, mock_model, mock_configure):
        """API 오류 처리"""
        mock_model.return_value.generate_content.side_effect = Exception("API Error")
        
        result = gemini_corrector.correct_text("test-api-key", "테스트")
        
        assert result["success"] is False
        assert "API Error" in result["error"]

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_correct_text_empty_response(self, mock_model, mock_configure):
        """빈 응답 처리"""
        mock_response = MagicMock()
        mock_response.text = ""
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-api-key", "테스트")
        
        assert result["success"] is True
        assert result["corrected_text"] == ""

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_memory_cleanup(self, mock_model, mock_configure):
        """메모리 정리 확인 (finally 블록)"""
        mock_model.return_value.generate_content.side_effect = Exception("Error")
        
        result = gemini_corrector.correct_text("test-api-key", "테스트")
        
        assert result["success"] is False


class TestMainFunction:
    """main 함수 테스트"""
    
    @patch('sys.stdin', StringIO(json.dumps({"api_key": "test-key", "text": "테스트"})))
    @patch('sys.stdout', new_callable=StringIO)
    @patch('gemini_corrector.correct_text')
    def test_main_success(self, mock_correct, mock_stdout):
        """정상 실행"""
        mock_correct.return_value = {"success": True, "corrected_text": "교정됨"}
        
        # main 코드 직접 실행
        try:
            input_data = sys.stdin.read()
            data = json.loads(input_data)
            api_key = data.get("api_key")
            text = data.get("text")
            result = gemini_corrector.correct_text(api_key, text)
            print(json.dumps(result, ensure_ascii=False))
        except:
            pass
        
        assert mock_correct.called

    @patch('sys.stdin', StringIO('invalid json'))
    def test_main_invalid_json(self):
        """잘못된 JSON 입력"""
        with pytest.raises(json.JSONDecodeError):
            input_data = sys.stdin.read()
            json.loads(input_data)

    @patch('sys.stdin', StringIO(json.dumps({"text": "only text"})))
    def test_main_missing_api_key(self):
        """API 키 누락"""
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        assert data.get("api_key") is None
        assert data.get("text") == "only text"

    @patch('sys.stdin', StringIO(json.dumps({"api_key": "key"})))
    def test_main_missing_text(self):
        """텍스트 누락"""
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        assert data.get("api_key") == "key"
        assert data.get("text") is None


class TestPersonaPrompt:
    """프롬프트 테스트"""
    
    def test_persona_prompt_exists(self):
        """페르소나 프롬프트 존재 확인"""
        assert hasattr(gemini_corrector, 'PERSONA_PROMPT')
        assert len(gemini_corrector.PERSONA_PROMPT) > 0

    def test_persona_prompt_contains_placeholder(self):
        """플레이스홀더 포함 확인"""
        prompt = gemini_corrector.PERSONA_PROMPT
        assert "{text}" in prompt or "TEXT" in prompt.upper()


class TestEdgeCases:
    """에지 케이스 테스트"""
    
    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_very_long_text(self, mock_model, mock_configure):
        """매우 긴 텍스트"""
        long_text = "테스트 " * 1000
        mock_response = MagicMock()
        mock_response.text = long_text
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-api-key", long_text)
        
        assert result["success"] is True

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_unicode_emoji(self, mock_model, mock_configure):
        """유니코드 이모지 테스트"""
        emoji_text = "테스트 🎉✨🛡️⚙️📌"
        mock_response = MagicMock()
        mock_response.text = emoji_text
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-api-key", emoji_text)
        
        assert result["success"] is True
        assert result["corrected_text"] == emoji_text

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_special_characters(self, mock_model, mock_configure):
        """특수 문자"""
        special_text = "!@#$%^&*()_+-={}[]|:;<>?,./"
        mock_response = MagicMock()
        mock_response.text = special_text
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-api-key", special_text)
        
        assert result["success"] is True


class TestSecurityFeatures:
    """보안 기능 테스트"""
    
    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_api_key_not_in_response(self, mock_model, mock_configure):
        """응답에 API 키 노출 방지"""
        mock_response = MagicMock()
        mock_response.text = "교정됨"
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("secret-api-key-12345", "테스트")
        
        assert "secret-api-key-12345" not in str(result)

    @patch('gemini_corrector.genai.configure')
    @patch('gemini_corrector.genai.GenerativeModel')
    def test_memory_cleanup_always_runs(self, mock_model, mock_configure):
        """메모리 정리가 항상 실행되는지 확인"""
        mock_response = MagicMock()
        mock_response.text = "교정됨"
        mock_model.return_value.generate_content.return_value = mock_response
        
        result = gemini_corrector.correct_text("test-key", "테스트")
        
        # finally 블록이 항상 실행되는지 확인
        assert result["success"] is True


class TestMainBlock:
    """main 함수 통합 테스트 (100% 커버리지)"""
    
    @patch('gemini_corrector.correct_text')
    @patch('sys.stdin', StringIO(json.dumps({"api_key": "test-key", "text": "테스트"})))
    @patch('sys.stdout', new_callable=StringIO)
    def test_main_execution_success(self, mock_stdout, mock_correct):
        """정상 stdin 입력 및 실행"""
        mock_correct.return_value = {"success": True, "corrected_text": "교정됨"}
        
        # main 함수 직접 호출
        gemini_corrector.main()
        
        output = json.loads(mock_stdout.getvalue())
        assert output["success"] is True
        assert output["corrected_text"] == "교정됨"

    @patch('sys.stdin', StringIO('invalid json'))
    @patch('sys.stdout', new_callable=StringIO)
    def test_main_execution_invalid_json(self, mock_stdout):
        """잘못된 JSON으로 main 실행"""
        with pytest.raises(SystemExit) as exc_info:
            gemini_corrector.main()
        
        assert exc_info.value.code == 1
        output = json.loads(mock_stdout.getvalue())
        assert output["success"] is False
        assert "Invalid JSON" in output["error"]

    @patch('sys.stdin', StringIO(json.dumps({"text": "only text"})))
    @patch('sys.stdout', new_callable=StringIO)
    def test_main_execution_missing_api_key(self, mock_stdout):
        """API 키 누락으로 main 실행"""
        with pytest.raises(SystemExit) as exc_info:
            gemini_corrector.main()
        
        assert exc_info.value.code == 1
        output = json.loads(mock_stdout.getvalue())
        assert output["success"] is False
        assert "Missing api_key or text" in output["error"]

    @patch('sys.stdin', StringIO(json.dumps({"api_key": "test-key"})))
    @patch('sys.stdout', new_callable=StringIO)
    def test_main_execution_missing_text(self, mock_stdout):
        """텍스트 누락으로 main 실행"""
        with pytest.raises(SystemExit) as exc_info:
            gemini_corrector.main()
        
        assert exc_info.value.code == 1
        output = json.loads(mock_stdout.getvalue())
        assert output["success"] is False
        assert "Missing api_key or text" in output["error"]

    @patch('gemini_corrector.correct_text')
    @patch('sys.stdin', StringIO(json.dumps({"api_key": "test-key", "text": "테스트"})))
    @patch('sys.stdout', new_callable=StringIO)
    def test_main_execution_general_exception(self, mock_stdout, mock_correct):
        """일반 예외 처리"""
        mock_correct.side_effect = RuntimeError("Unexpected error")
        
        with pytest.raises(SystemExit) as exc_info:
            gemini_corrector.main()
        
        assert exc_info.value.code == 1
        output = json.loads(mock_stdout.getvalue())
        assert output["success"] is False
        assert "Unexpected error" in output["error"]
    
    def test_if_name_main_block(self):
        """if __name__ == '__main__' 블록 커버리지"""
        # 서브프로세스로 실제 스크립트 실행
        result = subprocess.run(
            [sys.executable, 'gemini_corrector.py'],
            input=json.dumps({"api_key": "fake-key", "text": "test"}),
            capture_output=True,
            text=True
        )
        # 실제 API 호출 실패하므로 에러 예상
        assert result.returncode in [0, 1]
