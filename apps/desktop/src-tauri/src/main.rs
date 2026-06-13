use tauri::{Emitter, Manager};
use active_win_pos_rs::get_active_window;
use std::sync::Mutex;
use serde::Serialize;
use std::time::Duration;
use std::thread;
use base64::{engine::general_purpose, Engine as _};
use xcap::Monitor;


//#[tauri::command]
//fn chat_send(app: tauri::AppHandle, message: String) -> Result<(), String> {
//    let _ = app.emit("chat:message", serde_json::json!({
//        "role": "user",
//        "content": message
//    }));

//    let reply = format!("Echo fixed: {}", message);

//    let _ = app.emit("chat:message", serde_json::json!({
//        "role": "assistant",
//        "content": reply
//    }));

//    Ok(())
//}


use tauri::WebviewWindowBuilder;

#[derive(Default)]
struct AppState {
    attached_window: Mutex<Option<String>>,
}

#[derive(Clone, Serialize)]
struct WindowInfo {
    app: String,
    title: String,
}

#[derive(Clone, Serialize)]
struct ActiveContext {
    app: String,
    title: String,
    attached_mode: bool,
}

/* =========================
   🧠 WINDOW ATTACH LOGIC
========================= */

#[tauri::command]
fn attach_window(
    state: tauri::State<'_, AppState>,
    app_name: String,
) {
    let mut attached = state.attached_window.lock().unwrap();

    *attached = if app_name.trim().is_empty() {
        None
    } else {
        Some(app_name.to_lowercase())
    };

    println!("🧠 ATTACH UPDATED => {:?}", *attached);
}

/* =========================
   DEBUG: ACTIVE WINDOW
========================= */

#[tauri::command]
fn get_open_windows() -> Vec<WindowInfo> {
    if let Ok(window) = get_active_window() {
        return vec![WindowInfo {
            app: window.app_name,
            title: window.title,
        }];
    }
    vec![]
}

/* =========================
   SCREENSHOT
========================= */

// Captures the primary monitor and returns a base64-encoded PNG string.
// Called from the float window after it has already hidden itself, so
// the float never appears in the image.
#[tauri::command]
fn capture_screen() -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.into_iter().next().ok_or("No monitor found")?;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    // Encode raw RGBA image to PNG bytes, then base64
    let mut png_bytes: Vec<u8> = Vec::new();
    image
        .write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(general_purpose::STANDARD.encode(&png_bytes))
}

/* =========================
   FLOAT WINDOW
========================= */

#[tauri::command]
async fn float_chat(app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("sam-float").is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "sam-float",
        tauri::WebviewUrl::App("/chat-float".into()),
    )
    .title("Sam (AI)")
    .inner_size(380.0, 600.0)
    .decorations(false)
    .always_on_top(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_float(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("sam-float") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_float_always_on_top(
    app: tauri::AppHandle,
    on_top: bool,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("sam-float") {
        win.set_always_on_top(on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_float_content_protection(
    app: tauri::AppHandle,
    protected: bool,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("sam-float") {
        win.set_content_protected(protected).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn minimize_float(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("sam-float") {
        win.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/* =========================
   MAIN
========================= */

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            attached_window: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            attach_window,
            get_open_windows,
            capture_screen,
            float_chat,
            close_float,
            set_float_always_on_top,
            set_float_content_protection,
            minimize_float,
            //chat_send
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            println!("🚀 Sammy OS running");

            tauri::async_runtime::spawn(async move {
                loop {
                    let state: tauri::State<AppState> = handle.state();

                    if let Ok(window) = get_active_window() {
                        let app_name = window.app_name.clone();
                        let title = window.title.clone();

                        let attached = state.attached_window.lock().unwrap();

                        let attached_mode = attached
                            .as_ref()
                            .map(|target| {
                                let t = target.to_lowercase();
                                app_name.to_lowercase().contains(&t)
                                    || title.to_lowercase().contains(&t)
                            })
                            .unwrap_or(false);

                        let context = ActiveContext {
                            app: app_name,
                            title,
                            attached_mode,
                        };

                        let _ = handle.emit("active-window", &context);
                    }

                    thread::sleep(Duration::from_millis(800));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}