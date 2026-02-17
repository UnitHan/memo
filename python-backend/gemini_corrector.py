"""
Gemini API를 사용한 텍스트 교정 스크립트
30년 경력 QA 전문가 + 전문 작가 페르소나로 한국어/영어 맞춤법 및 문장 교정
보안: stdin을 통한 입력으로 커맨드라인 노출 방지
"""
import sys
import json
import io
import google.generativeai as genai

# UTF-8 인코딩 강제 설정 (Windows에서 한글 출력 문제 해결)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='strict', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

PERSONA_PROMPT = """당신은 30년 경력의 베테랑 QA 전문가이자 전문 작가입니다.

다음 텍스트를 검토하고 개선해주세요:
1. 맞춤법 및 문법 오류 수정
2. 더 명확하고 전문적인 문장 구성
3. 적절한 어휘 선택과 표현 개선
4. 버그 리포트, 컨플루언스 문서, 이메일에 적합한 톤 유지

원본:
{text}

개선된 버전만 출력해주세요. 설명이나 주석은 불필요합니다."""


def sanitize_error_message(error_str: str) -> str:
    """에러 메시지를 사용자 친화적으로 변환 (보안 정보 제거)"""
    error_lower = error_str.lower()
    
    # API 키 관련 오류
    if 'api_key_invalid' in error_lower or 'api key expired' in error_lower:
        return "API 키가 만료되었거나 유효하지 않습니다.\n설정(⚙️)에서 새 API 키를 입력해주세요.\n\n💡 API 키 발급: https://ai.google.dev/gemini-api/docs/api-key"
    
    # 할당량 초과
    if '429' in error_str or 'quota' in error_lower or 'rate limit' in error_lower:
        return "API 사용량이 초과되었습니다.\n잠시 후 다시 시도하거나 유료 플랜을 확인해주세요."
    
    # 네트워크 오류
    if 'connection' in error_lower or 'network' in error_lower or 'timeout' in error_lower:
        return "네트워크 연결을 확인해주세요.\n인터넷 연결 상태를 확인하거나 방화벽 설정을 점검해주세요."
    
    # 권한 오류
    if '403' in error_str or 'permission' in error_lower or 'forbidden' in error_lower:
        return "API 키에 필요한 권한이 없습니다.\nAPI 키 설정을 확인하거나 새 키를 발급받아주세요."
    
    # 서버 오류
    if '500' in error_str or '502' in error_str or '503' in error_str:
        return "Gemini 서비스에 일시적인 문제가 발생했습니다.\n잠시 후 다시 시도해주세요."
    
    # 입력 크기 오류
    if 'too large' in error_lower or 'max' in error_lower and 'token' in error_lower:
        return "입력 텍스트가 너무 큽니다.\n텍스트를 나누어서 교정해주세요."
    
    # 기타 오류 (기술 정보 제거)
    # googleapis.com, generativelanguage 등 도메인/서비스명 제거
    sanitized = error_str
    sensitive_terms = [
        'googleapis.com',
        'generativelanguage.googleapis.com',
        'generativelanguage',
        'metadata',
        'domain:',
        'locale:',
        '[reason:',
    ]
    
    for term in sensitive_terms:
        if term in sanitized:
            # 기술 정보가 포함된 경우 일반 메시지로 교체
            return "텍스트 교정 중 오류가 발생했습니다.\n입력 내용을 확인하거나 잠시 후 다시 시도해주세요."
    
    # 짧고 명확한 오류는 그대로 반환 (단, 100자 제한)
    if len(sanitized) > 100:
        return "텍스트 교정 중 오류가 발생했습니다.\n설정을 확인하거나 잠시 후 다시 시도해주세요."
    
    return sanitized


def correct_text(api_key: str, text: str) -> dict:
    """텍스트를 Gemini API로 교정"""
    try:
        print("🔐 Gemini API 연결 중...", file=sys.stderr, flush=True)
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        print(f"✍️ 텍스트 분석 중 ({len(text)} 글자)...", file=sys.stderr, flush=True)
        prompt = PERSONA_PROMPT.format(text=text)
        response = model.generate_content(prompt)
        
        # 응답 상태 체크 (finish_reason 확인)
        if not response.candidates:
            print("⚠️ Gemini 응답 없음 (candidates 비어있음)", file=sys.stderr, flush=True)
            return {
                "success": False,
                "error": "Gemini API가 응답을 생성하지 않았습니다. 입력 내용을 확인해주세요."
            }
        
        candidate = response.candidates[0]
        finish_reason = candidate.finish_reason
        
        # finish_reason 체크
        if finish_reason != 1:  # 1 = STOP (정상 종료)
            finish_reason_map = {
                2: "MAX_TOKENS (최대 토큰 초과)",
                3: "SAFETY (안전 필터 차단)",
                4: "RECITATION (저작권 위반 가능성)",
                5: "OTHER (기타 오류)"
            }
            reason_name = finish_reason_map.get(finish_reason, f"알 수 없음 ({finish_reason})")
            
            print(f"⚠️ Gemini 비정상 종료: {reason_name}", file=sys.stderr, flush=True)
            
            # 안전 필터 상세 로그
            if finish_reason == 3 and candidate.safety_ratings:
                print("🛡️ 안전 필터 세부 정보:", file=sys.stderr, flush=True)
                for rating in candidate.safety_ratings:
                    print(f"  - {rating.category}: {rating.probability}", file=sys.stderr, flush=True)
            
            return {
                "success": False,
                "error": f"Gemini API 응답 생성 실패: {reason_name}. 입력 텍스트를 수정해주세요."
            }
        
        # 정상 응답 텍스트 추출
        if hasattr(candidate.content, 'parts') and candidate.content.parts:
            corrected = candidate.content.parts[0].text.strip()
            print("✅ Gemini 교정 완료!", file=sys.stderr, flush=True)
            return {
                "success": True,
                "corrected_text": corrected
            }
        else:
            print("⚠️ 응답에 텍스트 없음", file=sys.stderr, flush=True)
            return {
                "success": False,
                "error": "Gemini API 응답에 텍스트가 포함되지 않았습니다."
            }
            
    except Exception as e:
        error_str = str(e)
        print(f"❌ 오류 발생: {error_str}", file=sys.stderr, flush=True)
        
        # 사용자 친화적 에러 메시지 변환 (보안 정보 숨김)
        user_message = sanitize_error_message(error_str)
        
        return {
            "success": False,
            "error": user_message
        }
    finally:
        # 보안: 메모리에서 민감 데이터 제거
        api_key = None
        text = None


def main():
    """메인 진입점 (테스트 가능하도록 함수화)"""
    try:
        # stdin으로부터 JSON 입력 받기 (커맨드라인 인자보다 안전)
        input_data = sys.stdin.read()
        
        # Surrogate 문자 제거 (Windows 인코딩 문제 해결)
        input_data = input_data.encode('utf-8', errors='ignore').decode('utf-8')
        
        data = json.loads(input_data)
        
        api_key = data.get("api_key")
        text = data.get("text")
        
        if not api_key or not text:
            result = json.dumps({"success": False, "error": "Missing api_key or text"}, ensure_ascii=False)
            sys.stdout.write(result)
            sys.stdout.flush()
            sys.exit(1)
        
        result = correct_text(api_key, text)
        
        # stderr 완전히 flush (stdout과 섞이지 않도록)
        sys.stderr.flush()
        
        # 순수 JSON만 stdout으로 출력 (로그는 stderr로만)
        output = json.dumps(result, ensure_ascii=False)
        sys.stdout.write(output)
        sys.stdout.flush()
        
    except json.JSONDecodeError as e:
        result = json.dumps({"success": False, "error": f"Invalid JSON: {e}"}, ensure_ascii=False)
        sys.stdout.write(result)
        sys.stdout.flush()
        sys.exit(1)
    except Exception as e:
        result = json.dumps({"success": False, "error": f"Unexpected error: {e}"}, ensure_ascii=False)
        sys.stdout.write(result)
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
