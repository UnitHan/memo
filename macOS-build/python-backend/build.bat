@echo off
REM Python 스크립트를 독립 실행 파일로 빌드
call ..\venv\Scripts\activate.bat
pyinstaller --onefile --noconsole --name gemini-corrector --distpath ../src-tauri/binaries gemini_corrector.py
deactivate
