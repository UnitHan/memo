"""
Gemini API에서 사용 가능한 모델 목록 확인
"""
import google.generativeai as genai
import sys

# API 키를 커맨드라인 인자로 받음
if len(sys.argv) > 1:
    api_key = sys.argv[1]
else:
    print("사용법: python list_models.py <YOUR_API_KEY>")
    sys.exit(1)

genai.configure(api_key=api_key)

print("=" * 60)
print("📋 사용 가능한 Gemini 모델 목록")
print("=" * 60)

for model in genai.list_models():
    # generateContent를 지원하는 모델만 필터링
    if 'generateContent' in model.supported_generation_methods:
        print(f"\n✅ {model.name}")
        print(f"   표시명: {model.display_name}")
        print(f"   설명: {model.description}")
        print(f"   지원 메서드: {', '.join(model.supported_generation_methods)}")

print("\n" + "=" * 60)
print("💡 추천 모델: gemini-pro 또는 gemini-1.5-pro")
print("=" * 60)
