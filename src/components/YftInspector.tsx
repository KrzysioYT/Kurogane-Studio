import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import Viewport from './Viewport';
import { clearModel } from '../lib/demo';
import { exportGLB, saveGLB } from '../lib/io';
import type { VehicleAsset } from '../fivem/types';
import './YftInspector.css';

type MeshData={name:string;vertices:number[];normals:number[];uv:number[];indices:number[];shaderId:number;suggestedTexture?:string|null};
type Props={files:VehicleAsset[];onUpdateYft?:(name:string,bytes:Uint8Array)=>void;onDirtyChange?:(dirty:boolean)=>void};
type Patch={meshIndex:number;vertexIndex:number;x:number;y:number;z:number};
type TextureEntry={name:string;width:number;height:number;format:string;levels:number};
function fromMeshes(data:MeshData[],root:THREE.Group){
 clearModel(root);
 for(const part of data){
   if(part.indices.length<3||part.vertices.length<9)continue;
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices,3));
   if(part.normals.length===part.vertices.length)
     geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));
   geometry.setIndex(part.indices);
   if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
   const color=new THREE.Color().setHSL(((part.shaderId*53)%360)/360,.25,.55);
   const material=new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.18,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(geometry,material);
   mesh.name=part.name;
   mesh.userData.shaderId=part.shaderId;
   mesh.userData.suggestedTexture=part.suggestedTexture??null;
   mesh.castShadow=true;mesh.receiveShadow=true;
   root.add(mesh);
 }
}
export default function YftInspector({files,onUpdateYft,onDirtyChange}:Props){
 const [filename,setFilename]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Wybierz plik YFT z importowanego addonu.');
 const [stats,setStats]=useState({meshCount:0,triangles:0});
 const [focus,setFocus]=useState(0);
 const [shaderIds,setShaderIds]=useState<number[]>([]);
 const [shader,setShader]=useState<number|null>(null);
 const [vertexMode,setVertexMode]=useState(false);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [selectedVertex,setSelectedVertex]=useState<number|null>(null);
 const [edited,setEdited]=useState(false);
 const [geometryRevision,setGeometryRevision]=useState(0);
 const originalMeshes=useRef<MeshData[]>([]);
 const [textureSuggestions,setTextureSuggestions]=useState<Record<number,string>>({});
 const [textureFile,setTextureFile]=useState('');
 const [textureName,setTextureName]=useState('');
 const [textureEntries,setTextureEntries]=useState<TextureEntry[]>([]);
 const root=useMemo(()=>new THREE.Group(),[]);
 const choices=files.filter(f=>f.name.toLowerCase().endsWith('.yft')&&!f.name.toLowerCase().endsWith('_hi.yft'));
 const ytdFiles=files.filter(f=>f.name.toLowerCase().endsWith('.ytd'));
 useEffect(()=>{onDirtyChange?.(edited);},[edited,onDirtyChange]);
 const load=async(name:string)=>{
   if(edited&&!window.confirm('Masz niezapisane zmiany geometrii YFT. Porzucić je?'))return;
   const oldTextures=new Set<THREE.Texture>();
   for(const object of root.children){
     if(object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.map)
       oldTextures.add(object.material.map);
   }
   for(const texture of oldTextures)texture.dispose();
   setFilename(name);clearModel(root);setStats({meshCount:0,triangles:0});setShaderIds([]);setShader(null);setTextureSuggestions({});
   setVertexMode(false);setSelectedId(null);setSelectedVertex(null);setEdited(false);originalMeshes.current=[];
   if(!name)return;
   if(!isTauri()){setMessage('Podgląd YFT wymaga aplikacji Windows Tauri.');return;}
   const file=files.find(f=>f.name===name);
   if(!file)return;
   setBusy(true);setMessage('Odczytuję geometrię, UV i LOD modelu GTA V...');
   try{
     const parts=await invoke<MeshData[]>('yft_preview',{bytes:Array.from(file.bytes)});
     fromMeshes(parts,root);
     if(root.children.length!==parts.length)throw new Error('Niepełne odczytanie geometrii YFT; zapis zmian jest niedostępny.');
     originalMeshes.current=parts;
     const shaders=[...new Set(parts.map(part=>part.shaderId))].sort((a,b)=>a-b);
     setShaderIds(shaders);setShader(shaders[0]??null);
     const suggestions:Record<number,string>={};
     for(const part of parts){
       if(part.suggestedTexture && !suggestions[part.shaderId])suggestions[part.shaderId]=part.suggestedTexture;
     }
     setTextureSuggestions(suggestions);
     const triangles=parts.reduce((s,x)=>s+Math.floor(x.indices.length/3),0);
     setStats({meshCount:parts.length,triangles});
     setFocus(n=>n+1);
     setMessage('Wczytano '+parts.length+' meshów i '+triangles.toLocaleString('pl-PL')+' trójkątów. Podgląd jest tylko do odczytu.');
   }catch(error){setMessage('Błąd parsowania YFT: '+String(error));}
   finally{setBusy(false);}
 };
 const pickTextureFile=async(name:string)=>{
   setTextureFile(name);setTextureEntries([]);setTextureName('');
   const item=files.find(f=>f.name===name);
   if(!item || !isTauri())return;
   setBusy(true);
   try{
     const textures=await invoke<TextureEntry[]>('ytd_list',{bytes:Array.from(item.bytes)});
     setTextureEntries(textures);
     const suggested=shader!==null?textureSuggestions[shader]:undefined;
     const match=textures.find(t=>t.name.toLowerCase()===suggested?.toLowerCase());
     setTextureName(match?.name??textures[0]?.name??'');
     setMessage('Wybierz teksturę oraz shader z modelu, by zobaczyć mapowanie UV.');
   }catch(error){setMessage('Nie można załadować tekstur YTD: '+String(error));}
   finally{setBusy(false);}
 };
 const selectShader=(id:number)=>{
   setShader(id);
   const suggested=textureSuggestions[id];
   const match=textureEntries.find(t=>t.name.toLowerCase()===suggested?.toLowerCase());
   if(match)setTextureName(match.name);
 };
 const suggestTexture=()=>{
   if(shader===null)return;
   const suggested=textureSuggestions[shader];
   if(!suggested){setMessage('YFT nie podaje nazwy tekstury dla tej grupy shadera — wybierz ją ręcznie.');return;}
   const match=textureEntries.find(t=>t.name.toLowerCase()===suggested.toLowerCase());
   if(!match){setMessage('Shader YFT sugeruje '+suggested+', ale nie ma tej tekstury w wybranym YTD. Spróbuj innego słownika.');return;}
   setTextureName(match.name);
   setMessage('Znaleziono automatyczne dopasowanie shader → '+match.name+'. Możesz teraz nałożyć tę teksturę.');
 };
 const resetTexturePreview=()=>{
   const handled=new Set<THREE.Texture>();
   for(const object of root.children){
     if(!(object instanceof THREE.Mesh))continue;
     const mat=object.material;
     if(!(mat instanceof THREE.MeshStandardMaterial))continue;
     if(mat.map && !handled.has(mat.map)){mat.map.dispose();handled.add(mat.map);}
     mat.map=null;
     mat.color.setHSL((((object.userData.shaderId as number)*53)%360)/360,.25,.55);
     mat.needsUpdate=true;
   }
   setMessage('Przywrócono diagnostyczne materiały YFT.');
 };
 const applyTexture=async()=>{
   if(shader===null||!textureFile||!textureName||busy)return;
   const file=files.find(f=>f.name===textureFile);if(!file)return;
   setBusy(true);setMessage('Dekoduję YTD i nakładam teksturę na shader '+shader+'...');
   try{
     const base64=await invoke<string>('ytd_png',{bytes:Array.from(file.bytes),textureName});
     const img=new Image();
     const loaded=new Promise<void>((resolve,reject)=>{
       img.onload=()=>resolve();img.onerror=()=>reject(new Error('PNG podglądu jest uszkodzony'));
     });
     img.src='data:image/png;base64,'+base64;
     await loaded;
     const texture=new THREE.Texture(img);
     texture.colorSpace=THREE.SRGBColorSpace;
     texture.flipY=true;
     texture.needsUpdate=true;
     let count=0;
     const replacedTextures=new Set<THREE.Texture>();
     for(const object of root.children){
       if(!(object instanceof THREE.Mesh) || object.userData.shaderId!==shader)continue;
       const mat=object.material;
       if(!(mat instanceof THREE.MeshStandardMaterial))continue;
       if(mat.map)replacedTextures.add(mat.map);
       mat.map=texture;mat.color.set('#ffffff');mat.needsUpdate=true;count++;
     }
     if(!count){texture.dispose();throw new Error('Wybrany shader nie ma meshów do podglądu.');}
     for(const old of replacedTextures)old.dispose();
     setMessage('Nałożono '+textureName+' na '+count+' meshów shadera '+shader+'. To ręczny podgląd UV, nie zapis zmian w YFT.');
   }catch(error){setMessage('Błąd podglądu UV: '+String(error));}
   finally{setBusy(false);}
 };
 const collectPatches=():Patch[]=>{
   const patches:Patch[]=[];
   for(const [meshIndex,original] of originalMeshes.current.entries()){
     const mesh=root.children[meshIndex];
     if(!(mesh instanceof THREE.Mesh))throw new Error('Zmieniła się kolejność meshów podglądu.');
     const position=mesh.geometry.getAttribute('position');
     if(!position || position.count*3!==original.vertices.length)
       throw new Error('Zmieniła się topologia lub liczba wierzchołków — nie można zapisać YFT.');
     for(let vertexIndex=0;vertexIndex<position.count;vertexIndex++){
       const index=vertexIndex*3;
       const x=position.getX(vertexIndex);
       const y=position.getY(vertexIndex);
       const z=position.getZ(vertexIndex);
       if(Math.abs(x-original.vertices[index])>1e-5 ||
          Math.abs(y-original.vertices[index+1])>1e-5 ||
          Math.abs(z-original.vertices[index+2])>1e-5){
          patches.push({meshIndex,vertexIndex,x,y:-z,z:y});
          if(patches.length>20000)throw new Error('Przekroczono limit 20000 zmienionych wierzchołków.');
       }
     }
   }
   return patches;
 };
 const saveNativeYft=async()=>{
   if(!onUpdateYft||!filename||busy)return;
   const source=files.find(f=>f.name===filename);if(!source)return;
   setBusy(true);setMessage('Próbuję zapisać zmiany w oryginalnym RSC7 YFT bez zmiany układu kości, kolizji i LOD...');
   try{
     const patches=collectPatches();
     if(!patches.length){setEdited(false);setMessage('Brak zmienionych wierzchołków do zapisania.');return;}
     const bytes=await invoke<number[]>('yft_patch_vertices',{bytes:Array.from(source.bytes),patches});
     const updated=Uint8Array.from(bytes);
     const verified=await invoke<MeshData[]>('yft_preview',{bytes:Array.from(updated)});
     if(verified.length!==originalMeshes.current.length)throw new Error('Zmiana YFT nie przechodzi walidacji geometrii.');
     onUpdateYft(filename,updated);
     originalMeshes.current=verified;setEdited(false);
     setMessage('Eksperymentalny YFT zapisany do projektu ('+patches.length+' zmian). Obowiązkowy test na serwerze FiveM przed wdrożeniem.');
   }catch(e){setMessage('Eksport YFT zablokowany: '+String(e));}
   finally{setBusy(false);}
 };
 const exportModel=async()=>{
   if(busy||!root.children.length)return;
   setBusy(true);setMessage('Eksportuję podgląd geometrii do GLB...');
   try{
     const buffer=await exportGLB(root);
     const result=await saveGLB(buffer,(filename.replace(/\.yft$/i,'')||'kurogane-yft-preview')+'-preview');
     setMessage(result==='saved'?'Zapisano GLB do dalszej obróbki (to NIE jest gotowy YFT do GTA).':'Anulowano eksport GLB.');
   }catch(error){setMessage('Błąd eksportu GLB: '+String(error));}
   finally{setBusy(false);}
 };
 return <section className="yft-inspector">
   <div className="yft-heading"><div><h2>YFT Vehicle Inspector <small>PODGLĄD 3D</small></h2>
     <p>Rzeczywista geometria wyodrębniona z pliku GTA V, bez ręcznego konwertowania modelu w Blenderze.</p></div>
     <div className="yft-export-buttons"><button className="button secondary" disabled={busy||!root.children.length} onClick={()=>void exportModel()}>⇩ Eksportuj GLB</button>
       <button className="button primary" disabled={busy||!edited||!onUpdateYft} onClick={()=>void saveNativeYft()}>Zapisz YFT (eksperymentalne)</button></div>
   </div>
   <div className="yft-toolbar">
     <label>Model samochodu:
       <select value={filename} disabled={busy} onChange={event=>void load(event.target.value)}>
         <option value="">— wybierz plik .yft —</option>
         {choices.map(f=><option key={f.name} value={f.name}>{f.name}</option>)}
       </select>
     </label>
     <span>Obiekty: <strong>{stats.meshCount}</strong></span>
     <span>Trójkąty: <strong>{stats.triangles.toLocaleString('pl-PL')}</strong></span>
     <button onClick={()=>setFocus(n=>n+1)} className="button secondary">Dopasuj widok</button>
     <label className="yft-vertex-toggle"><input type="checkbox" checked={vertexMode} onChange={event=>{setVertexMode(event.target.checked);setSelectedId(null);setSelectedVertex(null);}}/> Przesuwaj wierzchołki YFT</label>
   </div>
   <div className="yft-uv-controls">
     <label>Grupa materiału (shader ID)
       <select value={shader??''} onChange={event=>selectShader(Number(event.target.value))} disabled={!shaderIds.length||busy}>
         {shaderIds.map(id=><option key={id} value={id}>Shader {id} ({root.children.filter(o=>o.userData.shaderId===id).length} meshów)</option>)}
       </select>
     </label>
     {shader!==null&&textureSuggestions[shader]&&<span className="yft-shader-hint">YFT sugeruje: {textureSuggestions[shader]}</span>}
     <label>YTD projektu
       <select value={textureFile} onChange={event=>void pickTextureFile(event.target.value)} disabled={busy}>
         <option value="">— wybierz plik tekstur —</option>
         {ytdFiles.map(f=><option key={f.name} value={f.name}>{f.name}</option>)}
       </select>
     </label>
     <label>Tekstura
       <select value={textureName} onChange={event=>setTextureName(event.target.value)} disabled={busy||!textureEntries.length}>
         {textureEntries.map(tex=><option key={tex.name} value={tex.name}>{tex.name}</option>)}
       </select>
     </label>
     <button className="button secondary" disabled={busy||shader===null||!textureSuggestions[shader]} onClick={suggestTexture}>Dobierz z YFT</button>
     <button className="button primary" disabled={busy||shader===null||!textureName} onClick={()=>void applyTexture()}>Zobacz teksturę na modelu</button>
     <button className="button secondary" disabled={!root.children.length||busy} onClick={resetTexturePreview}>Przywróć materiały</button>
   </div>
   <div className="yft-preview"><Viewport root={root} selectedId={selectedId} vertexMode={vertexMode} selectedVertexIndex={selectedVertex} geometryRevision={geometryRevision} mode="translate" focusToken={focus}
     onSelect={id=>{const mesh=id?root.getObjectByProperty('uuid',id):undefined;
       if(mesh instanceof THREE.Mesh && typeof mesh.userData.shaderId==='number')selectShader(mesh.userData.shaderId);
     }}
     onVertexSelect={(id,index)=>{setSelectedId(id);setSelectedVertex(index);}}
     onChange={()=>{if(vertexMode){setEdited(true);setGeometryRevision(n=>n+1);}}}/></div>
   {vertexMode&&<div className="yft-edit-banner">Zaznacz wierzchołek trójkąta i przeciągnij manipulator. Zmieniasz TYLKO współrzędne punktów, bez dodawania części ani zmiany topologii. {selectedVertex!==null?'Wierzchołek #'+selectedVertex:''}{edited?' · Niezapisane zmiany':''}</div>}
   <div className="addon-message" role="status">{busy?'Trwa przetwarzanie modelu…':message}</div>
   <p className="texture-warning">Kliknij część samochodu w podglądzie, aby ustawić jej shader, a następnie wybierz teksturę YTD. To ręczna wizualizacja UV: nie odtwarza automatycznie powiązań materiałów GTA i może wyglądać inaczej niż w FiveM. Zapis współrzędnych YFT jest eksperymentalny i ograniczony do istniejących wierzchołków Float3; nie obsługuje przebudowy fragmentów, zmian szkieletu, kolizji ani dodawania części. Testuj w FiveM przed instalacją na produkcji.</p>
 </section>;
}
