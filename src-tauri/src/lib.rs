/// Zapisuje gotowy GLB wyłącznie po wybraniu miejsca przez użytkownika.
/// Modelu nie przesyłamy przez sieć; ograniczenie wielkości chroni pamięć procesu.
#[tauri::command]
fn save_glb(file_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    const MAX_BYTES: usize = 256 * 1024 * 1024;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("Nieprawidłowy rozmiar pliku (maks. 256 MiB).".into());
    }
    if !bytes.starts_with(b"glTF") {
        return Err("Dane nie zawierają nagłówka binarnego glTF.".into());
    }

    let suggested: String = file_name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | ' '))
        .take(100)
        .collect();
    let suggested = if suggested.to_ascii_lowercase().ends_with(".glb") {
        suggested
    } else {
        format!("{}.glb", suggested.trim_end_matches('.'))
    };

    let target = rfd::FileDialog::new()
        .set_title("Eksport modelu GLB — Kurogane Studio")
        .set_file_name(&suggested)
        .add_filter("Binary glTF", &["glb"])
        .save_file();

    if let Some(path) = target {
        std::fs::write(path, bytes).map_err(|error| format!("Nie udało się zapisać pliku: {error}"))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_glb])
        .run(tauri::generate_context!())
        .expect("Nie można uruchomić Kurogane Studio");
}
