import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
export type Axis='x'|'y'|'z';
export function assertStatic(mesh:THREE.Mesh){
 if(mesh instanceof THREE.SkinnedMesh||Object.keys(mesh.geometry.morphAttributes).length||mesh.geometry.hasAttribute('skinIndex'))throw new Error('Ta operacja nie obsługuje skórowania ani morph targets.');
}
export function finish(geometry:THREE.BufferGeometry){geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}
export function mapUV(mesh:THREE.Mesh,kind:'xy'|'xz'|'yz'|'box'){
 assertStatic(mesh);
 const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
 g.computeBoundingBox();const box=g.boundingBox!,size=box.getSize(new THREE.Vector3()),p=g.getAttribute('position');
 const uv=new Float32Array(p.count*2);
 const component=(i:number,axis:Axis)=>(p.getComponent(i,axis==='x'?0:axis==='y'?1:2)-box.min[axis])/(size[axis]||1);
 for(let i=0;i<p.count;i+=3){
  let projection=kind;
  if(kind==='box'){
   const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
   const n=b.sub(a).cross(c.sub(a));const x=Math.abs(n.x),y=Math.abs(n.y),z=Math.abs(n.z);
   projection=x>=y&&x>=z?'yz':y>=z?'xz':'xy';
  }
  for(let j=i;j<Math.min(i+3,p.count);j++){uv[j*2]=component(j,projection[0] as Axis);uv[j*2+1]=component(j,projection[1] as Axis);}
 }
 g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.deleteAttribute('tangent');mesh.geometry=g;
}
export function transformUV(mesh:THREE.Mesh,scaleU:number,scaleV:number,offsetU:number,offsetV:number,angle:number){
 if(![scaleU,scaleV,offsetU,offsetV,angle].every(Number.isFinite))throw new Error('UV wymaga skończonych wartości.');
 const g=mesh.geometry.clone(),uv=g.getAttribute('uv');if(!uv){g.dispose();throw new Error('Najpierw wygeneruj UV.');}
 const c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<uv.count;i++){const u=(uv.getX(i)-.5)*scaleU,v=(uv.getY(i)-.5)*scaleV;uv.setXY(i,u*c-v*s+.5+offsetU,u*s+v*c+.5+offsetV);}
 uv.needsUpdate=true;g.deleteAttribute('tangent');mesh.geometry=g;
}
export function weld(mesh:THREE.Mesh,tolerance:number){
 assertStatic(mesh);if(!Number.isFinite(tolerance)||tolerance<1e-7||tolerance>.1)throw new Error('Tolerancja spawania: 0.0000001–0.1.');
 // Preserve UV/normal/color seams. Only identical full vertices are welded.
 mesh.geometry=finish(mergeVertices(mesh.geometry,tolerance));
}
export function smoothNormals(mesh:THREE.Mesh){
 assertStatic(mesh);const g=mesh.geometry.clone(),p=g.getAttribute('position');g.computeVertexNormals();
 const normals=g.getAttribute('normal'),sums=new Map<string,THREE.Vector3>();
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
 for(let i=0;i<p.count;i++){const k=key(i),v=sums.get(k)??new THREE.Vector3();v.add(new THREE.Vector3().fromBufferAttribute(normals,i));sums.set(k,v);}
 for(let i=0;i<p.count;i++){const n=sums.get(key(i))!.clone().normalize();normals.setXYZ(i,n.x,n.y,n.z);}
 g.deleteAttribute('tangent');mesh.geometry=g;
}
export function bakeTransform(mesh:THREE.Mesh){
 assertStatic(mesh);if(mesh.children.length)throw new Error('Najpierw odłącz dzieci części.');
 if(mesh.scale.x*mesh.scale.y*mesh.scale.z<=0)throw new Error('Zastosuj dodatnią skalę przed utrwaleniem transformacji.');
 mesh.updateMatrix();mesh.geometry=mesh.geometry.clone().applyMatrix4(mesh.matrix);
 mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.updateMatrix();
 mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
}
export function centerPivot(mesh:THREE.Mesh){
 assertStatic(mesh);if(mesh.children.length)throw new Error('Najpierw odłącz dzieci części.');
 mesh.geometry.computeBoundingBox();const center=mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
 mesh.updateMatrix();const parentCenter=center.clone().applyMatrix4(mesh.matrix);
 mesh.geometry=mesh.geometry.clone().translate(-center.x,-center.y,-center.z);mesh.position.copy(parentCenter);mesh.updateMatrix();
}
export function moveVertex(mesh:THREE.Mesh,index:number,target:THREE.Vector3,linked:boolean,symmetric:boolean,radius:number){
 const p=mesh.geometry.getAttribute('position');if(!p||index<0||index>=p.count||!Number.isInteger(index))throw new Error('Niepoprawny wierzchołek.');
 if(![target.x,target.y,target.z,radius].every(Number.isFinite)||radius<0||radius>100)throw new Error('Niepoprawne współrzędne.');
 const origin=new THREE.Vector3().fromBufferAttribute(p,index),delta=target.clone().sub(origin),mirror=origin.clone();mirror.x*=-1;
 for(let i=0;i<p.count;i++){
  const v=new THREE.Vector3().fromBufferAttribute(p,i),d=v.distanceTo(origin),dm=v.distanceTo(mirror);
  const weight=(distance:number,primary:boolean)=>primary?1:linked&&distance<1e-6?1:radius>0&&distance<radius?Math.pow(1-distance/radius,2)*(1+2*distance/radius):0;
  const w=weight(d,i===index),mw=symmetric?weight(dm,false):0;
  if(w===0&&mw===0)continue;
  if(mw>w)v.add(new THREE.Vector3(-delta.x,delta.y,delta.z).multiplyScalar(mw));else v.addScaledVector(delta,w);
  if(symmetric&&Math.abs(origin.x)<1e-6&&Math.abs(v.x-delta.x*w)<1e-6)v.x=0;
  p.setXYZ(i,v.x,v.y,v.z);
 }
 p.needsUpdate=true;finish(mesh.geometry);
}
export const VEHICLE_PARTS=['chassis','bodyshell','bonnet','boot','door_dside_f','door_pside_f','door_dside_r','door_pside_r','wheel_lf','wheel_rf','wheel_lr','wheel_rr','bumper_f','bumper_r','windscreen','exhaust'];
export function setVehiclePart(mesh:THREE.Mesh,role:string,lod:string){mesh.userData.kurogane={...mesh.userData.kurogane,role,lod};}
export function analyzeMesh(mesh:THREE.Mesh){
 const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index;let invalid=0,degenerate=0;const edges=new Map<string,number>();
 if(!p)return {vertices:0,triangles:0,invalid:0,degenerate:0,boundaries:0,nonManifold:0};
 for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))invalid++;
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
 const count=idx?.count??p.count;
 for(let i=0;i+2<count;i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);if(ids.some(n=>n<0||n>=p.count)){invalid++;continue;}
 const [a,b,c]=ids.map(n=>new THREE.Vector3().fromBufferAttribute(p,n));if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)degenerate++;
 for(const [u,v] of [[0,1],[1,2],[2,0]]){const k=[key(ids[u]),key(ids[v])].sort().join('|');edges.set(k,(edges.get(k)??0)+1);}}
 return {vertices:p.count,triangles:Math.floor(count/3),invalid,degenerate,boundaries:[...edges.values()].filter(n=>n===1).length,nonManifold:[...edges.values()].filter(n=>n>2).length};
}

/** Detach selected triangles as an independently editable part at the same transform. */
export function separateFaces(mesh:THREE.Mesh,faces:number[],edit:(mesh:THREE.Mesh,faces:number[],action:'delete')=>void){
 assertStatic(mesh);if(!mesh.parent||mesh.children.length)throw new Error('Oddzielanie wymaga części bez dzieci.');
 const count=Math.floor((mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3),chosen=new Set(faces);
 if(!chosen.size||chosen.size===count)throw new Error('Wybierz część powierzchni; całą część możesz duplikować.');
 const copy=mesh.clone(false);copy.geometry=mesh.geometry.clone();copy.material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
 const remainder=mesh.clone(false);remainder.geometry=mesh.geometry.clone();
 try{
  edit(copy,Array.from({length:count},(_,i)=>i).filter(i=>!chosen.has(i)),'delete');
  edit(remainder,faces,'delete');
  mesh.geometry=remainder.geometry;copy.name=(mesh.name||'Część')+' — oddzielona';mesh.parent.add(copy);return copy;
 }catch(error){copy.geometry.dispose();remainder.geometry.dispose();throw error;}
}
