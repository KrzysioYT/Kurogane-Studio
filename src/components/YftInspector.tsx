import { invoke, isTauri } from '@tauri-apps/api/core';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import Viewport from './Viewport';
import { clearModel } from '../lib/demo';
import { exportGLB, saveGLB } from '../lib/io';
import type { VehicleAsset } from '../fivem/types';
import './YftInspector.css';

type MeshData={name:string;vertices:number[];normals:number[];uv:number[];indices:number[];shaderId:number};
type Props={files:VehicleAsset[]};
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
   mesh.castShadow=true;mesh.receiveShadow=true;
   root.add(mesh);
 }
}
export default function YftInspector({files}:Props){
 const [filename,setFilename]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Wybierz plik YFT z importowanego addonu.');
 const [stats,setStats]=useState({meshCount:0,triangles:0});
 const [focus,setFocus]=useState(0);
 const [shaderIds,setShaderIds]=useState<number[]>([]);
 const [shader,setShader]=useState<number|null>(null);
 const [textureFile,setTextureFile]=useState('');
 const [textureName,setTextureName]=useState('');
 const [textureEntries,setTextureEntries]=useState<TextureEntry[]>([]);
 const root=useMemo(()=>new THREE.Group(),[]);
 const choices=files.filter(f=>f.name.toLowerCase().endsWith('.yft')&&!f.name.toLowerCase().endsWith('_hi.yft'));
 const ytdFiles=files.filter(f=>f.name.toLowerCase().endsWith('.ytd'));
 const load=async(name:string)=>{
   setFilename(name);clearModel(root);setStats({meshCount:0,triangles:0});setShaderIds([]);setShader(null);
   if(!name)return;
   if(!isTauri()){setMessage('Podgląd YFT wymaga aplikacji Windows Tauri.');return;}
   const file=files.find(f=>f.name===name);
   if(!file)return;
   setBusy(true);setMessage('Odczytuję geometrię, UV i LOD modelu GTA V...');
   try{
     const parts=await invoke<MeshData[]>('yft_preview',{bytes:Array.from(file.bytes)});
     fromMeshes(parts,root);
     const shaders=[...new Set(parts.map(part=>part.shaderId))].sort((a,b)=>a-b);
     setShaderIds(shaders);setShader(shaders[0]??null);
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
     setTextureName(textures[0]?.name??'');
     setMessage('Wybierz teksturę oraz shader z modelu, by zobaczyć mapowanie UV.');
   }catch(error){setMessage('Nie można załadować tekstur YTD: '+String(error));}
   finally{setBusy(false);}
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
     <button className="button secondary" disabled={busy||!root.children.length} onClick={()=>void exportModel()}>⇩ Eksportuj GLB z podglądu</button>
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
   </div>
   <div className="yft-uv-controls">
     <label>Grupa materiału (shader ID)
       <select value={shader??''} onChange={event=>setShader(Number(event.target.value))} disabled={!shaderIds.length||busy}>
         {shaderIds.map(id=><option key={id} value={id}>Shader {id} ({root.children.filter(o=>o.userData.shaderId===id).length} meshów)</option>)}
       </select>
     </label>
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
     <button className="button primary" disabled={busy||shader===null||!textureName} onClick={()=>void applyTexture()}>Zobacz teksturę na modelu</button>
     <button className="button secondary" disabled={!root.children.length||busy} onClick={resetTexturePreview}>Przywróć materiały</button>
   </div>
   <div className="yft-preview"><Viewport root={root} selectedId={null} mode="translate" focusToken={focus}
     onSelect={id=>{const mesh=id?root.getObjectByProperty('uuid',id):undefined;
       if(mesh instanceof THREE.Mesh && typeof mesh.userData.shaderId==='number')setShader(mesh.userData.shaderId);
     }} onChange={()=>{}}/></div>
   <div className="addon-message" role="status">{busy?'Trwa przetwarzanie modelu…':message}</div>
   <p className="texture-warning">Kliknij część samochodu w podglądzie, aby ustawić jej shader, a następnie wybierz teksturę YTD. To ręczna wizualizacja UV: nie odtwarza automatycznie powiązań materiałów GTA i może wyglądać inaczej niż w FiveM. Nie edytuje YFT ani nie zastępuje pełnego eksportera pojazdów.</p>
 </section>;
}
