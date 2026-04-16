use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

// 注: ChatRequest/ChatResponse 结构体将在后续版本中用于类型安全的序列化

/// Tauri command: 发送消息到后端
#[tauri::command]
async fn send_message(message: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let api_url = "http://localhost:8888/api/v1/chat/send";

    let body = serde_json::json!({
        "message": message,
        "core_count": 1
    });

    match client.post(api_url).json(&body).send().await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(json) => {
                // 提取回复文本
                if let Some(data) = json.get("data") {
                    if let Some(reply) = data.get("reply").and_then(|r| r.as_str()) {
                        return Ok(reply.to_string());
                    }
                    if let Some(resp) = data.get("response").and_then(|r| r.as_str()) {
                        return Ok(resp.to_string());
                    }
                }
                Ok(json.to_string())
            }
            Err(e) => Err(format!("解析响应失败: {}", e)),
        },
        Err(e) => Err(format!("连接后端失败: {}. 请确保 OpenAGI 后端运行在 localhost:8888", e)),
    }
}

/// Tauri command: 获取问候语
#[tauri::command]
async fn get_greeting() -> Result<String, String> {
    let hour = chrono_hour();
    let greeting = match hour {
        5..=11 => "早上好陛下! 新的一天开始了，今天要完成什么目标呢？",
        12..=13 => "陛下该休息了! 中午好好吃饭，下午继续加油!",
        14..=17 => "下午好陛下! 保持专注，你做得很棒!",
        18..=21 => "晚上好陛下! 辛苦了一天，要注意休息哦!",
        22..=23 | 0..=4 => "夜深了陛下，要注意身体! 早点休息吧!",
        _ => "陛下好!",
    };
    Ok(greeting.to_string())
}

/// 获取当前小时 (0-23)
fn chrono_hour() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // UTC+8 北京时间
    ((secs + 8 * 3600) % 86400 / 3600) as u32
}

/// Tauri command: 检查后端健康状态
#[tauri::command]
async fn check_backend() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get("http://localhost:8888/health").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 创建系统托盘菜单
            let show_i = MenuItem::with_id(app, "show", "显示小灵", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("OpenAGI Companion - 小灵")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_message,
            get_greeting,
            check_backend,
        ])
        .run(tauri::generate_context!())
        .expect("启动 OpenAGI Companion 失败");
}
