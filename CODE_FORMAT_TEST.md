## 📋 코드/로그 자동 포맷팅 테스트 예제

### 1️⃣ Android Logcat 로그
```
02-07 14:23:45.123  1234  5678 E ActivityManager: Error in app process
02-07 14:23:45.124  1234  5678 W PackageManager: Package not found: com.example.app
02-07 14:23:45.125  1234  5678 I WindowManager: Window added successfully
02-07 14:23:45.126  1234  5678 D DEBUG: Debug message here
02-07 14:23:45.127  1234  5678 V VERBOSE: Verbose logging
```

### 2️⃣ JSON 데이터
```json
{
  "userId": 12345,
  "username": "test_user",
  "profile": {
    "name": "John Doe",
    "email": "john@example.com",
    "settings": {
      "notifications": true,
      "theme": "dark"
    }
  },
  "posts": [
    {"id": 1, "title": "First Post", "likes": 42},
    {"id": 2, "title": "Second Post", "likes": 128}
  ]
}
```

### 3️⃣ JavaScript/TypeScript 코드
```javascript
const fetchData = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('ERROR: Failed to fetch', error);
    throw error;
  }
};

// Usage
fetchData('https://api.example.com/data')
  .then(data => console.log('SUCCESS:', data))
  .catch(err => console.error('FATAL:', err));
```

### 4️⃣ Stack Trace
```
java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference
    at com.example.app.MainActivity.onCreate(MainActivity.java:42)
    at android.app.Activity.performCreate(Activity.java:7183)
    at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:3085)
    at android.app.ActivityThread.access$1100(ActivityThread.java:205)
```

### 5️⃣ 서버 로그
```
[2026-02-07 14:23:45] INFO Server started on port 8080
[2026-02-07 14:23:46] DEBUG Database connection established
[2026-02-07 14:23:47] WARN High memory usage: 85%
[2026-02-07 14:23:48] ERROR Failed to process request: timeout
[2026-02-07 14:23:49] FATAL Database connection lost
```

### 6️⃣ Python 코드
```python
def calculate_factorial(n):
    """재귀적으로 팩토리얼 계산"""
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

# 사용 예제
result = calculate_factorial(5)
print(f"Result: {result}")  # 120
```

## 🎯 테스트 방법

1. 위 예제 중 하나를 복사
2. AI 메모장에 붙여넣기 (Ctrl+V)
3. 자동으로 코드 블록으로 변환되는지 확인
4. 언어 라벨과 복사 버튼이 표시되는지 확인
5. 로그의 경우 ERROR/WARN/INFO가 색상으로 강조되는지 확인

## ⚠️ 대용량 텍스트 제한

- **경고 임계값**: 1MB (복사 시 콘솔에 로그)
- **차단 임계값**: 5MB (붙여넣기 거부 및 경고)
- **localStorage 한계**: 약 5-10MB
- **권장사항**: 대용량 로그는 파일로 저장 후 필요한 부분만 복사
