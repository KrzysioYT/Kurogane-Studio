//! RPF7 -> loose FiveM assets. Models are copied losslessly as standalone RSC7 files.
//! Intentionally excludes encrypted GTA base game archives (no keys, no crypto bypass).
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rpf_archive::{RpfEncryption, RpfFile, RpfVersion};
use serde::Serialize;
use std::{collections::HashSet, io::Read, path::Path};

const MAX_ARCHIVE: u64 = 256 * 1024 * 1024;
const MAX_EXTRACTED: usize = 160 * 1024 * 1024;
const MAX_ENTRY: usize = 100 * 1024 * 1024;
const MAX_FILES: usize = 500;

const STREAM_EXTENSIONS: &[&str] = &["yft", "ytd", "ydr", "ydd", "ybn", "ytyp", "ymap", "ycd"];
const META_NAMES: &[&str] = &[
    "vehicles.meta",
    "handling.meta",
    "carvariations.meta",
    "carcols.meta",
    "vehiclelayouts.meta",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpfAsset {
    name: String,
    data_base64: String,
    source: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpfImport {
    source_name: String,
    assets: Vec<RpfAsset>,
    ignored: usize,
    warnings: Vec<String>,
}

/// Reject paths with traversal or suspicious characters, and whitelist GTA files.
/// A single-vehicle pack uses flat stream/ and data/ filenames.
fn output_name(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    if normalized.starts_with('/')
        || normalized.split('/').any(|p| p == ".." || p.is_empty())
        || normalized.contains(':')
    {
        return None;
    }
    let leaf = normalized.rsplit('/').next()?;
    if leaf.is_empty() || leaf.len() > 120
        || !leaf.bytes().all(|b| b.is_ascii_alphanumeric() || b"_.-+() ".contains(&b)) {
        return None;
    }
    if META_NAMES.contains(&leaf) {
        return Some(format!("data/{leaf}"));
    }
    let extension = leaf.rsplit_once('.')?.1;
    STREAM_EXTENSIONS.contains(&extension).then(|| format!("stream/{leaf}"))
}

fn read_rpf(path: &Path) -> Result<RpfImport, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Nie można odczytać RPF: {e}"))?;
    if !metadata.is_file() || metadata.len() > MAX_ARCHIVE {
        return Err("Archiwum RPF jest zbyt duże (limit 256 MiB).".into());
    }
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut header = [0_u8; 16];
    file.read_exact(&mut header).map_err(|_| "Uszkodzony lub za krótki nagłówek RPF7.")?;
    if &header[0..4] != b"RPF7" && u32::from_le_bytes(header[0..4].try_into().unwrap()) != 0x52504637 {
        return Err("Ten plik nie jest archiwum GTA V RPF7.".into());
    }
    let encryption = u32::from_le_bytes(header[12..16].try_into().unwrap());
    if encryption != 0 && encryption != 0x4E45504F {
        return Err("RPF jest zaszyfrowany (AES/NG). Ten importer obsługuje wyłącznie otwarte archiwa modów. Nie pobiera kluczy z GTA5.exe.".into());
    }
    let rpf = RpfFile::open(path, None).map_err(|e| format!("Błąd parsowania RPF7: {e}"))?;
    if rpf.archive.version != RpfVersion::V7
        || !matches!(rpf.archive.encryption, RpfEncryption::None | RpfEncryption::Open) {
        return Err("Obsługiwane są wyłącznie otwarte archiwa GTA V RPF7.".into());
    }
    let mut assets = Vec::new();
    let mut ignored = 0_usize;
    let mut sum = 0_usize;
    let mut seen = HashSet::new();
    let mut failure: Option<String> = None;
    let source_name = path.file_name().map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "archive.rpf".to_string());

    rpf.walk(None, &mut |internal_path, bytes| {
        if failure.is_some() { return; }
        let Some(name) = output_name(internal_path) else {
            ignored += 1;
            return;
        };
        if !seen.insert(name.clone()) {
            failure = Some(format!("Powtarza się {name} w RPF. Wielopojazdowe DLC wymagają osobnej konwersji; niczego nie nadpisano."));
            return;
        }
        if assets.len() >= MAX_FILES || bytes.len() > MAX_ENTRY
            || sum.saturating_add(bytes.len()) > MAX_EXTRACTED {
            failure = Some("Przekroczono limit: 500 plików, 100 MiB na plik lub 160 MiB łącznie.".into());
            return;
        }
        if name.ends_with(".yft") || name.ends_with(".ytd") {
            if !bytes.starts_with(b"RSC7") {
                failure = Some(format!("{name} nie zawiera prawidłowego nagłówka RSC7. Przerwano zamiast eksportować uszkodzony model."));
                return;
            }
        }
        sum += bytes.len();
        assets.push(RpfAsset {
            name,
            data_base64: STANDARD.encode(bytes),
            source: format!("{source_name}: {internal_path}"),
        });
    }).map_err(|e| format!("Nie udało się rozpakować RPF: {e}"))?;
    if let Some(message) = failure { return Err(message); }
    if assets.is_empty() {
        return Err("W archiwum nie znaleziono plików pojazdu YFT/YTD ani obsługiwanych .meta.".into());
    }
    let mut warnings = Vec::new();
    if ignored > 0 {
        warnings.push(format!("Pominięto {ignored} plików niedotyczących obsługiwanego addonu. Żaden skrypt z RPF nie został uruchomiony."));
    }
    if !assets.iter().any(|asset| asset.name.ends_with(".yft")) {
        warnings.push("Nie wykryto modelu .yft. Do eksportu addonu pojazdu wymagany jest właściwy model GTA.".into());
    }
    Ok(RpfImport {source_name, assets, ignored, warnings})
}

#[tauri::command]
pub async fn import_rpf() -> Result<Option<RpfImport>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = rfd::FileDialog::new()
            .set_title("Otwórz niezabezpieczony RPF7 (GTA V)")
            .add_filter("Rockstar RPF7", &["rpf"])
            .pick_file();
        path.as_deref().map(read_rpf).transpose()
    }).await.map_err(|e| format!("Nie udało się uruchomić importera: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::output_name;

    #[test]
    fn reads_open_rpf7_written_by_archive_library() {
        use rpf_archive::{RpfBuilder, RpfEncryption};
        let path = std::env::temp_dir().join(format!(
            "kurogane-rpf-roundtrip-{}-{:?}.rpf",
            std::process::id(),
            std::thread::current().id()
        ));
        let mut builder = RpfBuilder::new(RpfEncryption::Open);
        builder.add_file("data/vehicles.meta", b"<CVehicleModelInfo__InitDataList/>".to_vec());
        builder.add_file("unrelated/readme.txt", b"ignored".to_vec());
        let bytes = builder.build(None).expect("RPF7 writer must succeed");
        std::fs::write(&path, bytes).expect("temp RPF can be written");
        let result = super::read_rpf(&path);
        let _ = std::fs::remove_file(&path);
        let imported = result.expect("native RPF7 importer should read a valid archive");
        assert_eq!(imported.assets.len(), 1);
        assert_eq!(imported.assets[0].name, "data/vehicles.meta");
        assert_eq!(imported.ignored, 1);
    }

    #[test]
    fn encrypted_archives_are_rejected_before_extraction() {
        let path = std::env::temp_dir().join(format!(
            "kurogane-encrypted-rpf-{}-{:?}.rpf",
            std::process::id(), std::thread::current().id()
        ));
        let mut header = vec![0_u8; 16];
        header[0..4].copy_from_slice(&0x52504637_u32.to_le_bytes());
        header[12..16].copy_from_slice(&0x0FFFFFF9_u32.to_le_bytes());
        std::fs::write(&path, &header).expect("write test header");
        let result = super::read_rpf(&path);
        let _ = std::fs::remove_file(&path);
        assert!(result.unwrap_err().contains("zaszyfrowany"));
    }

    #[test]
    fn classifies_archive_entries() {
        assert_eq!(output_name("x64/vehicles.rpf/supercar.yft").as_deref(), Some("stream/supercar.yft"));
        assert_eq!(output_name("common/data/handling.meta").as_deref(), Some("data/handling.meta"));
        assert_eq!(output_name("x64/models.rpf/supercar_hi.yft").as_deref(), Some("stream/supercar_hi.yft"));
        assert_eq!(output_name("dlc.rpf/setup2.xml"), None);
        assert_eq!(output_name("dlc.rpf/objects/main.js"), None);
        assert_eq!(output_name("../escape.yft"), None);
        assert_eq!(output_name("C:/escape.yft"), None);
    }
}
