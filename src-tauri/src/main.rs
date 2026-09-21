#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager, WebviewWindowBuilder, WebviewUrl,
};

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
fn create_editor_window<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("editor-{id}");

    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("無題 — Ediput")
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 620.0)
        .resizable(true)
        .build()?;

    Ok(())
}

#[tauri::command]
fn print_webview(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| format!("print failed: {error}"))
}

fn emit_to_focused<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: &str) {
    for window in app.webview_windows().values() {
        if window.is_focused().unwrap_or(false) {
            let _ = window.emit(event, ());
            return;
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .menu(|handle| {
            let new_window = MenuItemBuilder::with_id("new_window", "新規ウィンドウ")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?;
            let open = MenuItemBuilder::with_id("open", "開く")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?;
            let save = MenuItemBuilder::with_id("save", "保存")
                .accelerator("CmdOrCtrl+S")
                .build(handle)?;
            let export_pdf = MenuItemBuilder::with_id("export_pdf", "PDFを書き出す")
                .accelerator("CmdOrCtrl+P")
                .build(handle)?;

            let file = SubmenuBuilder::new(handle, "ファイル")
                .item(&new_window)
                .item(&open)
                .item(&save)
                .separator()
                .item(&export_pdf)
                .separator()
                .close_window()
                .build()?;

            let edit = SubmenuBuilder::new(handle, "編集")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            let view = SubmenuBuilder::new(handle, "表示")
                .text("toggle_sidebar", "サイドバー")
                .text("toggle_theme", "外観を切り替える")
                .build()?;

            let window = SubmenuBuilder::new(handle, "ウィンドウ")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            MenuBuilder::new(handle)
                .item(&file)
                .item(&edit)
                .item(&view)
                .item(&window)
                .build()
        })
        .invoke_handler(tauri::generate_handler![create_editor_window, print_webview])
        .on_menu_event(|app, event| {
            match event.id().0.as_str() {
                "new_window" => {
                    let _ = create_editor_window(app);
                }
                "open" => emit_to_focused(app, "ediput-menu-open"),
                "save" => emit_to_focused(app, "ediput-menu-save"),
                "export_pdf" => emit_to_focused(app, "ediput-menu-pdf"),
                "toggle_sidebar" => emit_to_focused(app, "ediput-menu-sidebar"),
                "toggle_theme" => emit_to_focused(app, "ediput-menu-theme"),
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Ediput");
}
