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
 const root=useMemo(()=>new THREE.Group(),[]);
 const choices=files.filter(f=>f.name.toLowerCase().endsWith('.yft')&&!f.name.toLowerCase().endsWith('_hi.yft'));
 const load=async(name:string)=>{
   setFilename(name);clearModel(root);setStats({meshCount:0,triangles:0});
   if(!name)return;
   if(!isTauri()){setMessage('Podgląd YFT wymaga aplikacji Windows Tauri.');return;}
   const file=files.find(f=>f.name===name);
   if(!file)return;
   setBusy(true);setMessage('Odczytuję geometrię, UV i LOD modelu GTA V...');
   try{
     const parts=await invoke<MeshData[]>('yft_preview',{bytes:Array.from(file.bytes)});
     fromMeshes(parts,root);
     const triangles=parts.reduce((s,x)=>s+Math.floor(x.indices.length/3),0);
     setStats({meshCount:parts.length,triangles});
     setFocus(n=>n+1);
     setMessage('Wczytano '+parts.length+' meshów i '+triangles.toLocaleString('pl-PL')+' trójkątów. Podgląd jest tylko do odczytu.');
   }catch(error){setMessage('Błąd parsowania YFT: '+String(error));}
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
   <div className="yft-preview"><Viewport root={root} selectedId={null} mode="translate" focusToken={focus} onSelect={()=>{}} onChange={()=>{}}/></div>
   <div className="addon-message" role="status">{busy?'Trwa przetwarzanie modelu…':message}</div>
   <p className="texture-warning">Podgląd YFT nie odtwarza na razie materiałów, animowanych kości, deformacji, kolizji ani wszystkich LOD-ów. Kolory meshów są diagnostyczne. Wygenerowany GLB nie zastępuje pliku YFT i nie może być wgrany bezpośrednio jako gotowy samochód FiveM.</p>
 </section>;
}
