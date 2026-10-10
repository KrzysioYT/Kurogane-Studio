//! Native GTA V texture pipeline: inspect/decode/edit/serialize RSC7 YTD dictionaries.
//! No third-party code is executed; textures remain on the user's Windows machine.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rage_formats::{
    encode_texture, parse_ytd, serialize_ytd, texture_utils::{encode_image, to_rgba_image, ImageFormat},
    EncodeFormat, TextureFormat, YtdTexture,
};
use serde::Serialize;

const MAX_YTD_BYTES: usize = 128 * 1024 * 1024;
const MAX_PNG_BYTES: usize = 32 * 1024 * 1024;
const MAX_SIDE: u32 = 8192;
const MAX_TEXTURES: usize = 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YtdEntry {
    name: String,
    width: u16,
    height: u16,
    format: String,
    levels: u8,
}

fn textures_from_bytes(bytes: &[u8]) -> Result<Vec<YtdTexture>, String> {
    if bytes.len() < 16 || bytes.len() > MAX_YTD_BYTES || !bytes.starts_with(b"RSC7") {
        return Err("Niepoprawny lub zbyt duży plik .ytd (wymagane RSC7, do 128 MiB).".into());
    }
    let textures = parse_ytd(bytes).map_err(|e| format!("Nie udało się odczytać YTD: {e}"))?;
    if textures.is_empty() || textures.len() > MAX_TEXTURES {
        return Err("YTD jest pusty lub zawiera za dużo tekstur (limit 1024).".into());
    }
    Ok(textures)
}

fn format_for(original: TextureFormat) -> EncodeFormat {
    match original {
        TextureFormat::DXT1 => EncodeFormat::Bc1,
        TextureFormat::DXT3 | TextureFormat::DXT5 => EncodeFormat::Bc3,
        TextureFormat::ATI1 => EncodeFormat::Bc4,
        TextureFormat::ATI2 => EncodeFormat::Bc5,
        TextureFormat::BC7 => EncodeFormat::Bc7,
        _ => EncodeFormat::Rgba8,
    }
}
fn find_texture<'a>(textures: &'a [YtdTexture], name: &str) -> Result<&'a YtdTexture, String> {
    textures.iter().find(|t| t.name.eq_ignore_ascii_case(name))
        .ok_or_else(|| format!("Brak tekstury '{name}' wewnątrz YTD."))
}
fn png_for(tex: &YtdTexture) -> Result<Vec<u8>, String> {
    if tex.width as u32 > MAX_SIDE || tex.height as u32 > MAX_SIDE {
        return Err("Tekstura przekracza 8192 px na bok.".into());
    }
    let image = to_rgba_image(tex).map_err(|e| format!("Błąd dekodowania tekstury: {e}"))?;
    let png = encode_image(&image, ImageFormat::Png, 100)
        .map_err(|e| format!("Błąd zapisu podglądu PNG: {e}"))?;
    if png.len() > MAX_PNG_BYTES { return Err("Podgląd przekracza limit pamięci 32 MiB.".into()); }
    Ok(png)
}

#[tauri::command]
pub async fn ytd_list(bytes: Vec<u8>) -> Result<Vec<YtdEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let textures = textures_from_bytes(&bytes)?;
        Ok(textures.into_iter().map(|t| YtdEntry {
            name:t.name, width:t.width, height:t.height,
            format:format!("{:?}",t.format), levels:t.levels
        }).collect())
    }).await.map_err(|e| format!("Błąd wątku odczytu YTD: {e}"))?
}

#[tauri::command]
pub async fn ytd_png(bytes: Vec<u8>, texture_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let textures = textures_from_bytes(&bytes)?;
        let tex = find_texture(&textures, &texture_name)?;
        let png=png_for(tex)?;
        Ok(STANDARD.encode(png))
    }).await.map_err(|e| format!("Błąd wątku PNG: {e}"))?
}

fn replace_texture(bytes: &[u8], texture_name: &str, png_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if png_bytes.is_empty() || png_bytes.len()>MAX_PNG_BYTES {
        return Err("Plik PNG jest pusty lub ma więcej niż 32 MiB.".into());
    }
    let mut textures = textures_from_bytes(bytes)?;
    let index=textures.iter().position(|t| t.name.eq_ignore_ascii_case(texture_name))
        .ok_or_else(|| format!("Brak tekstury: {texture_name}"))?;
    let source=&textures[index];
    if source.depth > 1 {return Err("Tekstury 3D/array wymagają osobnego kodera.".into());}
    let png=rage_formats::image::load_from_memory_with_format(png_bytes,rage_formats::image::ImageFormat::Png)
        .map_err(|e| format!("Nieprawidłowy plik PNG: {e}"))?;
    let rgba=png.to_rgba8();
    let (width,height)=rgba.dimensions();
    if width!=source.width as u32 || height!=source.height as u32 {
        return Err(format!("Rozmiar PNG musi odpowiadać oryginalnej teksturze: {}x{} px.",source.width,source.height));
    }
    if width>MAX_SIDE || height>MAX_SIDE {return Err("Zbyt duża tekstura (maks. 8192 px).".into());}
    let format=format_for(source.format);
    let replaced=encode_texture(&source.name,rgba.as_raw(),width,height,format,Some(source.levels))
        .map_err(|e| format!("Nie można zakodować mipmap YTD: {e}"))?;
    textures[index]=replaced;
    let result=serialize_ytd(&textures).map_err(|e| format!("Błąd serializacji YTD: {e}"))?;
    if result.len()>MAX_YTD_BYTES {return Err("Wynikowy YTD przekracza 128 MiB.".into());}
    let check=parse_ytd(&result).map_err(|e| format!("Zapisane YTD nie przechodzi walidacji: {e}"))?;
    if check.len()!=textures.len() || !check.iter().any(|t| t.name.eq_ignore_ascii_case(texture_name)) {
        return Err("Walidacja po zapisie nie potwierdziła wszystkich tekstur.".into());
    }
    Ok(result)
}

#[tauri::command]
pub async fn ytd_replace_png(bytes: Vec<u8>, texture_name: String, png_bytes: Vec<u8>) -> Result<Vec<u8>,String> {
    tauri::async_runtime::spawn_blocking(move || replace_texture(&bytes,&texture_name,&png_bytes))
        .await.map_err(|e| format!("Błąd wątku kodowania YTD: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn png_edit_roundtrips_through_real_ytd_serialization() {
        let old_rgba=vec![255u8;16*16*4];
        let old=encode_texture("livery", &old_rgba,16,16,EncodeFormat::Rgba8,None).unwrap();
        let old_bytes=serialize_ytd(&[old]).unwrap();
        let png=encode_image(
            &rage_formats::image::RgbaImage::from_pixel(16,16,rage_formats::image::Rgba([3,8,255,255])),
            ImageFormat::Png,100).unwrap();
        let modified=replace_texture(&old_bytes,"livery",&png).unwrap();
        let textures=parse_ytd(&modified).unwrap();
        assert_eq!(textures.len(),1);
        assert_eq!(textures[0].name,"livery");
        let rgba=to_rgba_image(&textures[0]).unwrap();
        assert_eq!(rgba.get_pixel(0,0).0,[3,8,255,255]);
    }
    #[test]
    fn wrong_size_cannot_corrupt_dictionary(){
        let old=encode_texture("car", &vec![255u8;16*16*4],16,16,EncodeFormat::Rgba8,None).unwrap();
        let bytes=serialize_ytd(&[old]).unwrap();
        let png=encode_image(
            &rage_formats::image::RgbaImage::new(4,4),
            ImageFormat::Png,100).unwrap();
        assert!(replace_texture(&bytes,"car",&png).unwrap_err().contains("16x16"));
    }
}
