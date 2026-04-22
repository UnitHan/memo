use std::process::{Command, Stdio};
use std::io::Write;
use std::fs;
use base64::{engine::general_purpose, Engine as _};
use serde_json::json;
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Python Sidecar로 텍스트 교정 요청 (보안 개선: stdin 사용)
#[tauri::command]
async fn correct_text(api_key: String, text: String) -> Result<String, String> {
    println!("🚀 텍스트 교정 요청 - 길이: {} 글자", text.len());

    // ── Sidecar 경로 결정 (MSIX / NSIS / 개발 환경 공통 대응) ──
    //
    // MSIX 환경에서 current_exe()는 실제 패키지 경로 대신
    // App Execution Alias 경로(AppData\Local\Microsoft\WindowsApps\...)를
    // 반환할 수 있음. 해당 경로에는 binaries\ 폴더가 없어 os error 3 발생.
    //
    // MSIX는 APPX_PACKAGE_PATH 환경변수를 실제 패키지 경로로 자동 설정하므로
    // 이를 우선 사용하고, 없을 경우 current_exe() 기반 경로로 폴백.
    let base_dir: std::path::PathBuf = {
        #[cfg(target_os = "windows")]
        {
            if let Ok(pkg_path) = std::env::var("APPX_PACKAGE_PATH") {
                println!("📦 MSIX 패키지 경로 사용: {}", pkg_path);
                std::path::PathBuf::from(pkg_path.trim_end_matches(['\\', '/']))
            } else {
                let exe = std::env::current_exe()
                    .map_err(|e| format!("Cannot get exe path: {}", e))?;
                exe.parent()
                    .ok_or_else(|| "Cannot get exe directory".to_string())?
                    .to_path_buf()
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let exe = std::env::current_exe()
                .map_err(|e| format!("Cannot get exe path: {}", e))?;
            exe.parent()
                .ok_or_else(|| "Cannot get exe directory".to_string())?
                .to_path_buf()
        }
    };

    #[cfg(target_os = "windows")]
    let sidecar_path = base_dir.join("binaries").join("gemini-corrector.exe");

    #[cfg(not(target_os = "windows"))]
    let sidecar_path = base_dir.join("binaries").join("gemini-corrector");

    println!("🐍 Python Sidecar 경로: {}", sidecar_path.display());
    println!("🔍 파일 존재 여부: {}", sidecar_path.exists());

    // 파일 없으면 진단 정보 포함한 에러 반환
    if !sidecar_path.exists() {
        let appx_env = std::env::var("APPX_PACKAGE_PATH").unwrap_or_else(|_| "(없음)".to_string());
        let exe_path = std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_else(|_| "(알 수 없음)".to_string());
        return Err(format!(
            "Sidecar not found: {}\n(base_dir={}, APPX_PACKAGE_PATH={}, current_exe={})",
            sidecar_path.display(),
            base_dir.display(),
            appx_env,
            exe_path
        ));
    }

    // stdin으로 데이터 전송 (커맨드라인 인자보다 안전)
    let mut command = Command::new(&sidecar_path);
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

// 링크 미리보기 메타데이터 추출
fn extract_og(html: &str, property: &str) -> Option<String> {
    // og:xxx → property="og:xxx" content="..."
    // twitter:xxx → name="twitter:xxx" content="..."
    let patterns = [
        format!("property=\"{}\" content=\"", property),
        format!("property='{}' content='", property),
        format!("content=\"", ),  // fallback: 순서 바뀐 경우
    ];

    // property="og:title" content="..." 형태
    let search1 = format!("property=\"{}\"", property);
    let search2 = format!("name=\"{}\"", property);

    for search in &[search1, search2] {
        if let Some(idx) = html.find(search.as_str()) {
            let after = &html[idx..];
            if let Some(c_idx) = after.find("content=\"") {
                let content_start = c_idx + 9;
                let after2 = &after[content_start..];
                if let Some(end) = after2.find('"') {
                    let val = after2[..end].trim().to_string();
                    if !val.is_empty() { return Some(val); }
                }
            }
            if let Some(c_idx) = after.find("content='") {
                let content_start = c_idx + 9;
                let after2 = &after[content_start..];
                if let Some(end) = after2.find('\'') {
                    let val = after2[..end].trim().to_string();
                    if !val.is_empty() { return Some(val); }
                }
            }
        }
    }
    let _ = patterns; // suppress warning
    None
}

fn extract_title(html: &str) -> Option<String> {
    let start = html.find("<title")?;
    let after = &html[start..];
    let content_start = after.find('>')? + 1;
    let after2 = &after[content_start..];
    let end = after2.find("</title")?;
    let val = after2[..end].trim().to_string();
    if val.is_empty() { None } else { Some(val) }
}

fn extract_domain(url: &str) -> String {
    let stripped = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    stripped.split('/').next().unwrap_or("").to_string()
}

#[tauri::command]
async fn fetch_link_preview(url: String) -> Result<serde_json::Value, String> {
    // URL 보안 검증
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("유효하지 않은 URL입니다".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("요청 실패: {}", e))?;

    let html = response
        .text()
        .await
        .map_err(|e| format!("응답 읽기 실패: {}", e))?;

    let title = extract_og(&html, "og:title")
        .or_else(|| extract_og(&html, "twitter:title"))
        .or_else(|| extract_title(&html))
        .unwrap_or_default();

    let description = extract_og(&html, "og:description")
        .or_else(|| extract_og(&html, "twitter:description"))
        .or_else(|| extract_og(&html, "description"))
        .unwrap_or_default();

    let image = extract_og(&html, "og:image")
        .or_else(|| extract_og(&html, "twitter:image"))
        .unwrap_or_default();

    let domain = extract_domain(&url);
    let favicon = format!("https://www.google.com/s2/favicons?domain={}&sz=32", domain);

    Ok(serde_json::json!({
        "title": title,
        "description": description,
        "image": image,
        "domain": domain,
        "url": url,
        "favicon": favicon,
    }))
}


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

// settings 창을 Rust에서 생성 (additional_browser_args 동일 적용)
#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    // 기존 settings 창이 있으면 포커스
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App(std::path::PathBuf::from("/")),
    )
    .title("AI 메모장")
    .inner_size(400.0, 640.0)
    .center()
    .resizable(false)
    .always_on_top(true)
    .decorations(true)
    .transparent(false)
    .visible(true);

    #[cfg(target_os = "windows")]
    let builder = builder.additional_browser_args(
        "--unsafely-treat-insecure-origin-as-secure=tauri://localhost http://tauri.localhost"
    );

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 메인 윈도우를 Rust에서 직접 생성:
            // Windows WebView2에서 SpeechRecognition은 보안 컨텍스트(HTTPS/localhost)에서만 동작.
            // additional_browser_args로 tauri://localhost를 안전한 오리진으로 등록.
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App(std::path::PathBuf::from("/")),
            )
            .title("AI 메모장")
            .inner_size(320.0, 500.0)
            .position(100.0, 100.0)
            .resizable(true)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .visible(false);

            #[cfg(target_os = "windows")]
            let builder = builder.additional_browser_args(
                "--unsafely-treat-insecure-origin-as-secure=tauri://localhost http://tauri.localhost"
            );

            builder.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![correct_text, read_image_as_base64, save_audio_to_music, fetch_link_preview, open_settings_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
