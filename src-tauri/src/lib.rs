use std::process::{Command, Stdio};
use std::io::Write;
use std::fs;
use base64::{engine::general_purpose, Engine as _};
use serde_json::json;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Python Sidecar로 텍스트 교정 요청 (보안 개선: stdin 사용)
#[tauri::command]
async fn correct_text(api_key: String, text: String) -> Result<String, String> {
    println!("🚀 텍스트 교정 요청 - 길이: {} 글자", text.len());
    
    #[cfg(target_os = "windows")]
    let sidecar_path = "binaries/gemini-corrector.exe";
    
    #[cfg(not(target_os = "windows"))]
    let sidecar_path = "binaries/gemini-corrector";

    println!("🐍 Python Sidecar 실행: {}", sidecar_path);

    // stdin으로 데이터 전송 (커맨드라인 인자보다 안전)
    let mut command = Command::new(sidecar_path);
    command
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // JSON 데이터를 stdin으로 전송
    if let Some(mut stdin) = child.stdin.take() {
        let input_data = json!({
            "api_key": api_key,
            "text": text
        });
        
        stdin.write_all(input_data.to_string().as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to read output: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8(output.stderr.clone())
            .unwrap_or_else(|_| String::from_utf8_lossy(&output.stderr).to_string());
        eprintln!("❌ Python Sidecar 오류: {}", stderr);
        return Err(format!("Sidecar failed: {}", stderr));
    }

    // UTF-8로 변환 (strict mode)
    let stdout = String::from_utf8(output.stdout.clone())
        .map_err(|e| format!("UTF-8 decode error: {}", e))?;
    
    // stdout 내용 디버깅
    println!("📦 Python 응답 수신 - {} bytes", stdout.len());
    
    // JSON 앞뒤 공백 제거
    let stdout_trimmed = stdout.trim();
    
    // JSON 파싱 전 내용 확인 (UTF-8 안전하게 자르기)
    if stdout_trimmed.chars().count() > 100 {
        let preview: String = stdout_trimmed.chars().take(100).collect();
        println!("📄 JSON 시작: {}...", preview);
    } else {
        println!("📄 JSON 전체: {}", stdout_trimmed);
    }
    
    let result: serde_json::Value = serde_json::from_str(stdout_trimmed)
        .map_err(|e| format!("Failed to parse JSON: {} | Raw output: {}", e, stdout_trimmed))?;

    if result["success"].as_bool().unwrap_or(false) {
        println!("✅ 텍스트 교정 완료!");
        Ok(result["corrected_text"].as_str().unwrap_or("").to_string())
    } else {
        let error_msg = result["error"].as_str().unwrap_or("Unknown error");
        eprintln!("❌ 교정 실패: {}", error_msg);
        Err(error_msg.to_string())
    }
}

// 이미지 파일을 base64로 읽기
#[tauri::command]
async fn read_image_as_base64(path: String) -> Result<String, String> {
    println!("🖼️ 이미지 읽기: {}", path);
    
    let image_data = fs::read(&path)
        .map_err(|e| format!("Failed to read image: {}", e))?;
    
    let base64_string = general_purpose::STANDARD.encode(&image_data);
    println!("✅ 이미지 변환 완료: {} bytes → {} base64 chars", image_data.len(), base64_string.len());
    
    Ok(base64_string)
}

// 음성 녹음을 Music 폴더에 저장
#[tauri::command]
async fn save_audio_to_music(data_base64: String, filename: String) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    let data = general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("base64 decode error: {}", e))?;

    // 파일명 보안 처리 (경로 탐색 방지)
    let safe_name: String = filename
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect();

    // Music 폴더 경로
    #[cfg(target_os = "windows")]
    let music_dir = {
        let userprofile = std::env::var("USERPROFILE")
            .map_err(|_| "USERPROFILE 환경 변수를 찾을 수 없습니다".to_string())?;
        std::path::PathBuf::from(userprofile).join("Music")
    };

    #[cfg(not(target_os = "windows"))]
    let music_dir = {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME 환경 변수를 찾을 수 없습니다".to_string())?;
        std::path::PathBuf::from(home).join("Music")
    };

    if !music_dir.exists() {
        std::fs::create_dir_all(&music_dir)
            .map_err(|e| format!("Music 폴더 생성 실패: {}", e))?;
    }

    let save_path = music_dir.join(&safe_name);
    std::fs::write(&save_path, &data)
        .map_err(|e| format!("파일 저장 실패: {}", e))?;

    println!("🎵 녹음 저장 완료: {}", save_path.display());
    Ok(save_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![correct_text, read_image_as_base64, save_audio_to_music])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
