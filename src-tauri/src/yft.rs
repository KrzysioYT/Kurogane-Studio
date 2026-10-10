//! Non-destructive YFT reader for native, local 3D inspection of GTA V vehicles.
//! The output is intentionally read-only. Re-exporting YFT requires a separate
//! validated serializer and is NOT emulated by writing a glTF file.
use rage_formats::{parse_drawables, DrawableKind, LodLevel};
use serde::Serialize;

const MAX_INPUT: usize = 160 * 1024 * 1024;
const MAX_VERTICES: usize = 450_000;
const MAX_INDICES: usize = 900_000;
const MAX_MESHES: usize = 384;

#[derive(Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct PreviewMesh {
    name:String,
    vertices:Vec<f32>,
    normals:Vec<f32>,
    uv:Vec<f32>,
    indices:Vec<u32>,
    shader_id:u16,
}
fn extract_preview(bytes:&[u8])->Result<Vec<PreviewMesh>,String>{
 if bytes.len()<16 || bytes.len()>MAX_INPUT || !bytes.starts_with(b"RSC7"){
     return Err("YFT musi być prawidłowym plikiem RSC7 (limit 160 MiB).".into());
 }
 let entries=parse_drawables(bytes,DrawableKind::Yft)
     .map_err(|e|format!("Nie udało się sparsować fragmentu YFT: {e}"))?;
 let mut out=Vec::<PreviewMesh>::new();
 let (mut total_vertices,mut total_indices)=(0usize,0usize);
 for entry in entries.iter().take(32){
   let drawable=&entry.drawable;
   let Some(lod)=drawable.lods.iter().find(|lod|lod.level==LodLevel::High)
     .or_else(||drawable.lods.first()) else {continue};
   for (model_i,model) in lod.models.iter().enumerate(){
     for (geometry_i,geometry) in model.geometries.iter().enumerate(){
       let (Some(vb),Some(ib))=(&geometry.vertex_buffer,&geometry.index_buffer) else {continue};
       let Ok(vertices)=vb.to_unified_vertices() else {continue};
       if vertices.is_empty()||vertices.len()>MAX_VERTICES {continue}
       let count=ib.indices.len()-ib.indices.len()%3;
       if count==0 || count>MAX_INDICES || ib.indices[..count].iter().any(|&idx|idx as usize>=vertices.len()) {continue;}
       if total_vertices+vertices.len()>MAX_VERTICES||total_indices+count>MAX_INDICES||out.len()>=MAX_MESHES {break;}
       let mut positions=Vec::with_capacity(vertices.len()*3);
       let mut normals=Vec::with_capacity(vertices.len()*3);
       let mut uv=Vec::with_capacity(vertices.len()*2);
       for vertex in vertices{
         // GTA is Z-up. Three.js uses Y-up; keep handedness by negating GTA Y.
         positions.extend([vertex.position.x,vertex.position.z,-vertex.position.y]);
         normals.extend([vertex.normal.x,vertex.normal.z,-vertex.normal.y]);
         uv.extend([vertex.texcoord0.x,1.0-vertex.texcoord0.y]);
       }
       total_vertices+=positions.len()/3;
       total_indices+=count;
       out.push(PreviewMesh{
         name:format!("{} / model {} / mesh {}",entry.name,model_i+1,geometry_i+1),
         vertices:positions,normals,uv,indices:ib.indices[..count].to_vec(),
         shader_id:geometry.shader_id,
       });
     }
   }
 }
 if out.is_empty(){return Err("W YFT nie znaleziono geometrii obsługiwanej przez parser; być może to model szyfrowany, Gen9 lub inny typ drawable.".into());}
 Ok(out)
}

#[tauri::command]
pub async fn yft_preview(bytes:Vec<u8>)->Result<Vec<PreviewMesh>,String>{
 tauri::async_runtime::spawn_blocking(move||extract_preview(&bytes))
     .await.map_err(|e|format!("Błąd wątku podglądu YFT: {e}"))?
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn rejects_invalid_rsc7(){
   assert!(extract_preview(b"hello").is_err());
   assert!(extract_preview(&vec![0u8;64]).is_err());
 }
}
