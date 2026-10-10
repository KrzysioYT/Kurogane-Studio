mod rpf;
mod ytd;
mod yft;
mod yft_patch;

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

/// Otwiera natywny dialog zapisu kompletnego addonu FiveM w ZIP.
/// Nie rozpakowujemy ZIP ani nie wykonujemy zawartych w nim skryptów.
#[tauri::command]
fn save_vehicle_zip(file_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    const MAX_BYTES: usize = 256 * 1024 * 1024;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("ZIP ma nieprawidłowy rozmiar (maks. 256 MiB).".into());
    }
    if !bytes.starts_with(b"PK\x03\x04") {
        return Err("Nieprawidłowy nagłówek archiwum ZIP.".into());
    }
    let stem: String = file_name
        .trim_end_matches(".zip")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(64)
        .collect();
    if stem.is_empty() {
        return Err("Niepoprawna nazwa resource.".into());
    }
    let path = rfd::FileDialog::new()
        .set_title("Eksport addonu FiveM - Kurogane Studio")
        .set_file_name(format!("{stem}.zip"))
        .add_filter("FiveM ZIP", &["zip"])
        .save_file();
    if let Some(path) = path {
        std::fs::write(path, bytes).map_err(|e| format!("Błąd zapisu ZIP: {e}"))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_glb, save_vehicle_zip, rpf::import_rpf, ytd::ytd_list, ytd::ytd_png, ytd::ytd_replace_png, yft::yft_preview, yft_patch::yft_patch_vertices])
        .run(tauri::generate_context!())
        .expect("Nie można uruchomić Kurogane Studio");
}
