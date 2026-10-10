import {useMemo,useState} from 'react';
import * as THREE from 'three';
import {analyzeMesh,bakeTransform,centerPivot,mapUV,setVehiclePart,separateFaces,smoothNormals,transformUV,VEHICLE_PARTS,weld} from '../lib/modeling';
import {coplanarFaces,editFaces} from '../lib/topology';
type Props={mesh:THREE.Mesh;revision:number;faces:number[];faceMode:boolean;setFaces:(faces:number[])=>void;edit:(label:string,operation:()=>void)=>void};
export default function ModelingPanel({mesh,revision,faces,faceMode,setFaces,edit}:Props){
 const [distance,setDistance]=useState(.1),[inset,setInset]=useState(.2),[tolerance,setTolerance]=useState(.0001);
 const [uvScale,setUVScale]=useState(1),[uvU,setUVU]=useState(0),[uvV,setUVV]=useState(0),[uvAngle,setUVAngle]=useState(0);
 const [projection,setProjection]=useState<'xy'|'xz'|'yz'|'box'>('box');
 const stats=useMemo(()=>analyzeMesh(mesh),[mesh,revision]);
 const uvLines=useMemo(()=>{
  const uv=mesh.geometry.getAttribute('uv'),index=mesh.geometry.index;if(!uv)return '';
  let path='';for(let i=0;i<Math.min(index?.count??uv.count,6000);i+=3){
   const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(ids.some(n=>n>=uv.count))break;
   path+=ids.map((n,j)=>`${j?'L':'M'}${uv.getX(n)*200},${200-uv.getY(n)*200}`).join('')+'Z';
  }return path;
 },[mesh,revision]);
 const op=(action:'extrude'|'subdivide'|'delete'|'inset')=>edit(action,()=>{editFaces(mesh,faces,action,action==='inset'?inset:distance);setFaces([]);});
 const part=mesh.userData.kurogane??{};
 return <>
  {faceMode&&<div className="property-block">
   <h3>Region powierzchni <span>{faces.length} trójkątów</span></h3>
   <p className="muted">Klik: wybierz. Shift + klik: dodaj/odejmij.</p>
   <div className="geometry-actions"><button disabled={!faces.length} onClick={()=>setFaces(coplanarFaces(mesh,faces[0]))}>Połączona płaska powierzchnia</button><button onClick={()=>setFaces(Array.from({length:stats.triangles},(_,i)=>i))}>Wszystkie ściany</button></div>
   <label className="model-field">Wyciąganie (lokalne m)<input aria-label="Wyciąganie" type="number" step=".05" value={distance} onChange={e=>setDistance(Number(e.target.value))}/></label>
   <div className="geometry-actions"><button disabled={!faces.length} onClick={()=>op('extrude')}>Wyciągnij region</button><button disabled={!faces.length} onClick={()=>op('subdivide')}>Podziel ×4</button><button disabled={!faces.length} onClick={()=>op('delete')}>Usuń region</button><button disabled={!faces.length} onClick={()=>edit('Oddziel część',()=>{separateFaces(mesh,faces,editFaces);setFaces([]);})}>Oddziel jako część</button></div>
   <label className="model-field">Inset trójkąta (0–1)<input type="number" min=".01" max=".99" step=".05" value={inset} onChange={e=>setInset(Number(e.target.value))}/></label>
   <button disabled={faces.length!==1} onClick={()=>op('inset')}>Inset</button>
  </div>}
  <details className="property-block" open><summary>Geometria i pivot</summary>
   <div className="geometry-actions"><button onClick={()=>edit('Gładkie normalne',()=>smoothNormals(mesh))}>Wygładź normalne</button><button onClick={()=>edit('Utrwal transformację',()=>bakeTransform(mesh))}>Utrwal transformację</button><button onClick={()=>edit('Pivot do środka',()=>centerPivot(mesh))}>Pivot do środka</button></div>
   <label className="model-field">Tolerancja spawania<input type="number" min=".0000001" max=".1" step=".0001" value={tolerance} onChange={e=>setTolerance(Number(e.target.value))}/></label>
   <button onClick={()=>edit('Spawanie',()=>{weld(mesh,tolerance);setFaces([]);})}>Spawaj zgodne wierzchołki</button><small>Spawanie zachowuje szwy UV i normalnych.</small>
  </details>
  <details className="property-block"><summary>UV i teksturowanie</summary>
   <select aria-label="Projekcja UV" value={projection} onChange={e=>setProjection(e.target.value as typeof projection)}><option value="box">Box — dopasuj do normalnej</option><option value="xy">Płaszczyzna XY</option><option value="xz">Płaszczyzna XZ</option><option value="yz">Płaszczyzna YZ</option></select>
   <button onClick={()=>edit('Projekcja UV',()=>mapUV(mesh,projection))}>Generuj UV</button>
   <svg viewBox="0 0 200 200" className="uv-preview" aria-label="Podgląd UV"><rect width="200" height="200" fill="#162332"/><path d={uvLines} stroke="#69c5d7" strokeWidth=".5" fill="none"/></svg>
   <small>Podgląd pierwszych 2000 trójkątów w obszarze 0–1. Projekcja box może nakładać wyspy.</small>
   <label className="model-field">Skala UV<input type="number" step=".1" value={uvScale} onChange={e=>setUVScale(Number(e.target.value))}/></label>
   <label className="model-field">Przesunięcie U<input type="number" step=".05" value={uvU} onChange={e=>setUVU(Number(e.target.value))}/></label>
   <label className="model-field">Przesunięcie V<input type="number" step=".05" value={uvV} onChange={e=>setUVV(Number(e.target.value))}/></label>
   <label className="model-field">Obrót °<input type="number" step="15" value={uvAngle} onChange={e=>setUVAngle(Number(e.target.value))}/></label>
   <button onClick={()=>edit('Transformacja UV',()=>transformUV(mesh,uvScale,uvScale,uvU,uvV,THREE.MathUtils.degToRad(uvAngle)))}>Zastosuj UV</button>
  </details>
  <details className="property-block"><summary>Część samochodu</summary>
   <label className="model-field">Rola<select value={part.role??''} onChange={e=>edit('Rola części',()=>setVehiclePart(mesh,e.target.value,part.lod??'high'))}><option value="">Nieprzypisana</option>{VEHICLE_PARTS.map(role=><option key={role}>{role}</option>)}</select></label>
   <label className="model-field">Poziom LOD<select value={part.lod??'high'} onChange={e=>edit('LOD części',()=>setVehiclePart(mesh,part.role??'',e.target.value))}>{['high','medium','low','veryLow'].map(lod=><option key={lod}>{lod}</option>)}</select></label>
   <button disabled={!part.role} onClick={()=>edit('Nazwij część',()=>{mesh.name=part.role;})}>Nazwij według roli</button>
   <small>Metadane projektu/GLB. Przypisanie roli nie tworzy kości ani fizyki YFT.</small>
  </details>
  <details className="property-block"><summary>Kontrola siatki</summary>
   <p>{stats.vertices} wierzchołków · {stats.triangles} trójkątów</p><p>Błędne dane: {stats.invalid} · Zerowa powierzchnia: {stats.degenerate}</p><p>Otwarte krawędzie: {stats.boundaries} · Non-manifold: {stats.nonManifold}</p>
   <small>Otwarte krawędzie są dopuszczalne np. dla blach. To kontrola geometrii, nie zgodności z GTA.</small>
  </details>
 </>;
}
