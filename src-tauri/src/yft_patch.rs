//! EXPERIMENTAL: in-place YFT vertex displacement without changing topology.
//! The original fragment's skeleton, collision, LOD pointers and page layout remain unchanged.
//! Deliberately rejects unknown vertex layouts, new meshes, vertex count changes and large moves.
use rage_formats::{
  build_rsc7_with_flags, parse_drawables, prepare_rsc7,
  DrawableKind, LodLevel, VertexComponentType, VertexSemantic,
  GRAPHICS_BASE, SYSTEM_BASE,
};
use serde::Deserialize;
use std::collections::HashMap;

const MAX_PATCHES:usize=20_000;
const MAX_EXPANDED:usize=512*1024*1024;
const MAX_INPUT:usize=160*1024*1024;
const MAX_VERTICES:usize=450_000;
const MAX_INDICES:usize=900_000;
const MAX_MESHES:usize=384;
const MAX_DELTA:f32=4.0;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct VertexPatch {
  mesh_index:usize,
  vertex_index:usize,
  x:f32, y:f32, z:f32,
}
#[derive(Debug, Clone)]
struct BufferBinding {
  virtual_address:u64,
  vertex_stride:usize,
  position_offset:usize,
  positions:Vec<[f32;3]>,
}

fn mesh_bindings(bytes:&[u8])->Result<Vec<BufferBinding>,String>{
  let entries=parse_drawables(bytes,DrawableKind::Yft)
    .map_err(|e|format!("Błąd YFT podczas sprawdzania geometrii: {e}"))?;
  let mut out=Vec::new();
  let (mut total_vertices,mut total_indices)=(0usize,0usize);
  for entry in entries.iter().take(32){
    let drawable=&entry.drawable;
    let Some(lod)=drawable.lods.iter().find(|lod|lod.level==LodLevel::High)
      .or_else(||drawable.lods.first()) else {continue};
    for model in &lod.models{
      for geometry in &model.geometries{
        let (Some(vb),Some(ib))=(&geometry.vertex_buffer,&geometry.index_buffer) else {continue};
        let Ok(vertices)=vb.to_unified_vertices() else {continue};
        if vertices.is_empty()||vertices.len()>MAX_VERTICES{continue}
        let count=ib.indices.len()-ib.indices.len()%3;
        if count==0||count>MAX_INDICES||ib.indices[..count].iter().any(|&n|n as usize>=vertices.len()){continue;}
        if total_vertices+vertices.len()>MAX_VERTICES||
           total_indices+count>MAX_INDICES||out.len()>=MAX_MESHES {break;}
        total_vertices+=vertices.len();
        total_indices+=count;

        let position_component=vb.declaration.as_ref()
          .and_then(|decl|decl.components.iter()
            .find(|c|c.semantic==VertexSemantic::Position));
        // A valid visible mesh might use quantized/unsupported vertex data.
        // Keep its slot in the same order and refuse to patch it later.
        let position_offset=match position_component{
          Some(c) if c.component_type==VertexComponentType::Float3=>c.offset as usize,
          None if vb.declaration.is_none()=>0,
          _=>usize::MAX,
        };
        out.push(BufferBinding{
          virtual_address:vb.data_pointer,
          vertex_stride:vb.vertex_stride as usize,
          position_offset,
          positions:vertices.iter().map(|v|
            [v.position.x,v.position.y,v.position.z]).collect(),
        });
      }
    }
  }
  Ok(out)
}

fn patch_section(section:&mut [u8],offset:usize, coords:[f32;3])->Result<(),String>{
  if !coords.iter().all(|n|n.is_finite()&&n.abs()<=1e5){
    return Err("Koordynaty wierzchołka są nieprawidłowe.".into());
  }
  let slot=section.get_mut(offset..offset.checked_add(12)
    .ok_or("Przepełnienie adresu wierzchołka.")?)
    .ok_or("Adres wierzchołka poza sekcją RSC7.")?;
  for(i,val) in coords.into_iter().enumerate(){
    slot[i*4..i*4+4].copy_from_slice(&val.to_le_bytes());
  }
  Ok(())
}

fn repack_preserving_header(original:&[u8],system:&[u8],graphics:&[u8])->Result<Vec<u8>,String>{
 if original.len()<16 || !original.starts_with(b"RSC7"){return Err("Oryginalny nagłówek RSC7 jest niepoprawny.".into());}
 let sys_flags=u32::from_le_bytes(original[8..12].try_into().unwrap());
 let gfx_flags=u32::from_le_bytes(original[12..16].try_into().unwrap());
 let version=rage_formats::resource_version_from_flags(sys_flags,gfx_flags);
 let mut output=build_rsc7_with_flags(version,sys_flags,system,gfx_flags,graphics);
 // The second header word can hold a different value from the version nibbles.
 // It is not part of deflate input: keep the complete original 16-byte header.
 output[..16].copy_from_slice(&original[..16]);
 if output[..16]!=original[..16] {
   return Err("Nagłówek RSC7 zmienił się podczas zapisu.".into());
 }
 Ok(output)
}
pub fn patch_yft(bytes:&[u8],patches:&[VertexPatch])->Result<Vec<u8>,String>{
 if !bytes.starts_with(b"RSC7")||bytes.len()<16||bytes.len()>MAX_INPUT{
   return Err("Nieobsługiwany lub zbyt duży YFT (tylko RSC7 do 160 MiB).".into());
 }
 let sys_flags=u32::from_le_bytes(bytes[8..12].try_into().unwrap());
 let gfx_flags=u32::from_le_bytes(bytes[12..16].try_into().unwrap());
 let max_decompressed=rage_formats::resource::resource_size_from_flags(sys_flags)
     .checked_add(rage_formats::resource::resource_size_from_flags(gfx_flags))
     .ok_or("Przepełnienie rozmiaru sekcji RSC7.")?;
 if max_decompressed>MAX_EXPANDED {return Err("Rozpakowany YFT przekroczyłby bezpieczny limit 512 MiB.".into());}
 if patches.is_empty()||patches.len()>MAX_PATCHES{
   return Err("Liczba zmian wierzchołków musi wynosić 1–20000.".into());
 }
 let bindings=mesh_bindings(bytes)?;
 let (mut system,mut graphics)=prepare_rsc7(bytes)
   .map_err(|e|format!("Nie można rozpakować YFT: {e}"))?;
 let original_system=system.clone();
 let original_graphics=graphics.clone();
 let mut seen=HashMap::<(u8,usize),[f32;3]>::new();
 for patch in patches{
   let bind=bindings.get(patch.mesh_index)
     .ok_or("Indeks mesha nie istnieje w źródłowym YFT.")?;
   let old=*bind.positions.get(patch.vertex_index)
     .ok_or("Indeks wierzchołka nie istnieje w YFT.")?;
   let coords=[patch.x,patch.y,patch.z];
   let dist=((coords[0]-old[0]).powi(2)+(coords[1]-old[1]).powi(2)
     +(coords[2]-old[2]).powi(2)).sqrt();
   if !dist.is_finite()||dist>MAX_DELTA{
     return Err("Zmiana punktu przekracza 4 jednostki GTA. Wykonuj mniejsze kroki.".into());
   }
   if bind.position_offset==usize::MAX||bind.virtual_address==0||
      bind.vertex_stride<bind.position_offset+12{
     return Err("Ten mesh ma nieobsługiwany/kwantyzowany bufor wierzchołków. Nie zapisano YFT.".into());
   }
   let va=bind.virtual_address;
   let local=patch.vertex_index.checked_mul(bind.vertex_stride)
     .and_then(|x|x.checked_add(bind.position_offset))
     .ok_or("Adres punktu poza zakresem pamięci.")?;
   let (section_id,base)=if va & GRAPHICS_BASE==GRAPHICS_BASE{
     (1u8,GRAPHICS_BASE)
   } else if va & SYSTEM_BASE==SYSTEM_BASE{
     (0u8,SYSTEM_BASE)
   } else {return Err("Nieznany adres wirtualny bufora YFT.".into());};
   let offset=usize::try_from(va-base).ok()
     .and_then(|n|n.checked_add(local)).ok_or("Przepełnienie offsetu bufora YFT.")?;
   if let Some(prior)=seen.insert((section_id,offset),coords){
     if prior!=coords{
       return Err("Dwa widoczne meshe współdzielą bufor wierzchołków z różnymi zmianami. Zapis zablokowany.".into());
     }
   }
   if section_id==1{patch_section(&mut graphics,offset,coords)?;}
   else {patch_section(&mut system,offset,coords)?;}
 }
 // Refuse overlapping vertex ranges: they might address shared or malformed buffers.
 let mut intervals:Vec<(u8,usize)>=seen.keys().copied().collect();
 intervals.sort_unstable();
 for pair in intervals.windows(2){
   if pair[0].0==pair[1].0 && pair[0].1.checked_add(12)
      .is_some_and(|end|end>pair[1].1){
     return Err("Nakładające się bufory wierzchołków YFT. Nie można bezpiecznie zapisać.".into());
   }
 }
 let intended=|section_id:u8,position:usize| -> bool {
   let n=intervals.partition_point(|&(id,start)|id<section_id || (id==section_id&&start<=position));
   n>0 && intervals[n-1].0==section_id && position-intervals[n-1].1<12
 };
 if system.iter().zip(original_system.iter()).enumerate().any(|(i,(a,b))|a!=b&&!intended(0,i)) ||
    graphics.iter().zip(original_graphics.iter()).enumerate().any(|(i,(a,b))|a!=b&&!intended(1,i)){
   return Err("Weryfikacja bezpieczeństwa wykryła modyfikację poza buforami wierzchołków.".into());
 }
 // Rebuild using the SAME RSC7 flags, exact pages, offsets, section sizes and version.
 // We have not changed a pointer, triangle count, bone or collision struct.
 let result=repack_preserving_header(bytes,&system,&graphics)?;
 // Required post-serialization check: reparse the complete fragment and compare edited points.
 let (sys_check,gfx_check)=prepare_rsc7(&result)
   .map_err(|e|format!("Nie można odczytać zapisanego YFT: {e}"))?;
 if sys_check!=system || gfx_check!=graphics {
   return Err("Ponowne pakowanie RSC7 zmieniło dane inne niż bufory pozycji.".into());
 }
 let check=mesh_bindings(&result)?;
 if check.len()!=bindings.len(){
   return Err("Po ponownym zapisie zmieniła się liczba meshów YFT. Zapis zablokowany.".into());
 }
 for patch in patches{
   let actual=check.get(patch.mesh_index)
     .and_then(|b|b.positions.get(patch.vertex_index))
     .ok_or("Po zapisie zniknął zmieniony wierzchołek.")?;
   for(i,target) in [patch.x,patch.y,patch.z].into_iter().enumerate(){
     if (actual[i]-target).abs()>1e-4{
       return Err("Zmiana współrzędnych nie przeszła walidacji YFT po zapisie.".into());
     }
   }
 }
 for (mesh_index,(before,after)) in bindings.iter().zip(check.iter()).enumerate(){
   if before.positions.len()!=after.positions.len(){
     return Err(format!("Po zapisie mesh {mesh_index} zmienił liczbę wierzchołków."));
   }
   for (i,(old,new)) in before.positions.iter().zip(after.positions.iter()).enumerate(){
     let changed=patches.iter().find(|p|p.mesh_index==mesh_index&&p.vertex_index==i);
     let expected=changed.map(|p|[p.x,p.y,p.z]).unwrap_or(*old);
     if !new.iter().zip(expected.iter()).all(|(a,b)|a.to_bits()==b.to_bits()){
       return Err(format!("Niezgodny wierzchołek: mesh {mesh_index}, punkt {i}."));
     }
   }
 }
 if result.len()>MAX_INPUT{return Err("Plik YFT po zapisie jest zbyt duży.".into());}
 Ok(result)
}

#[tauri::command]
pub async fn yft_patch_vertices(bytes:Vec<u8>,patches:Vec<VertexPatch>)
 ->Result<Vec<u8>,String>{
 tauri::async_runtime::spawn_blocking(move||patch_yft(&bytes,&patches))
    .await.map_err(|e|format!("Błąd eksperymentalnego zapisu YFT: {e}"))?
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn writes_single_float3_without_touching_adjacent_bytes(){
   let mut section=vec![42u8;64];
   patch_section(&mut section,16,[1.0,-2.0,3.25]).unwrap();
   assert_eq!(&section[0..16],&vec![42u8;16][..]);
   assert_eq!(&section[28..],&vec![42u8;36][..]);
   assert_eq!(f32::from_le_bytes(section[16..20].try_into().unwrap()),1.0);
   assert_eq!(f32::from_le_bytes(section[20..24].try_into().unwrap()),-2.0);
 }
 #[test]fn refuses_invalid_offsets_and_nonfinite_values(){
   let mut section=vec![0u8;32];
   assert!(patch_section(&mut section,30,[0.0,0.0,0.0]).is_err());
   assert!(patch_section(&mut section,0,[f32::NAN,0.0,0.0]).is_err());
   assert!(patch_yft(b"not yft",&[]).is_err());
 }
 #[test]fn reuses_exact_rsc7_page_flags_and_version(){
   let system=vec![0x11u8;8192];
   let graphics=vec![0x22u8;8192];
   let original=rage_formats::build_rsc7(162,&system,&graphics);
   let f1=u32::from_le_bytes(original[8..12].try_into().unwrap());
   let f2=u32::from_le_bytes(original[12..16].try_into().unwrap());
   let (mut sys,mut gfx)=prepare_rsc7(&original).unwrap();
   patch_section(&mut gfx,12,[2.0,3.0,4.0]).unwrap();
   let result=repack_preserving_header(&original,&sys,&gfx).unwrap();
   let (sys2,gfx2)=prepare_rsc7(&result).unwrap();
   assert_eq!(sys,sys2);
   assert_eq!(gfx,gfx2);
   assert_eq!(original[0..16],result[0..16]);
   let mut alternate=original.clone();
   alternate[4..8].copy_from_slice(&0xEFAB_1234u32.to_le_bytes());
   let preserved=repack_preserving_header(&alternate,&sys2,&gfx2).unwrap();
   assert_eq!(preserved[0..16],alternate[0..16]);
   sys[0]=99;
   assert_ne!(sys,sys2);
 }
}
