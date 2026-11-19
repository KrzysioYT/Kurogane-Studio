import * as THREE from 'three';
export type YftSource={vertices:number[];indices:number[]};
export type YftPatch={meshIndex:number;vertexIndex:number;x:number;y:number;z:number};
/** Preview maps GTA (x,y,z) to editor (x,z,-y). Reverse exactly once here. */
export function collectYftPatches(root:THREE.Group,sources:YftSource[]):YftPatch[]{
 if(root.children.length!==sources.length)throw new Error('Liczba meshów YFT uległa zmianie.');
 const result:YftPatch[]=[];
 sources.forEach((source,meshIndex)=>{
  const mesh=root.children[meshIndex];if(!(mesh instanceof THREE.Mesh))throw new Error('Nieprawidłowy mesh YFT.');
  const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
  if(!p||p.count*3!==source.vertices.length||!index||index.count!==source.indices.length||source.indices.some((v,i)=>index.getX(i)!==v))throw new Error('Zmiana topologii nie jest obsługiwana przez patch YFT.');
  if(mesh.position.lengthSq()>1e-12||Math.abs(mesh.quaternion.x)+Math.abs(mesh.quaternion.y)+Math.abs(mesh.quaternion.z)>1e-8||mesh.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-8)throw new Error('Patch YFT wymaga zmian wierzchołków, nie transformacji obiektu.');
  for(let vertexIndex=0;vertexIndex<p.count;vertexIndex++){
   const i=vertexIndex*3,x=p.getX(vertexIndex),y=p.getY(vertexIndex),z=p.getZ(vertexIndex);
   if(![x,y,z].every(Number.isFinite))throw new Error('Nieskończona pozycja wierzchołka.');
   const dx=x-source.vertices[i],dy=y-source.vertices[i+1],dz=z-source.vertices[i+2];
   if(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))<=1e-5)continue;
   if(Math.hypot(dx,dy,dz)>4)throw new Error('Zmiana punktu przekracza limit 4 jednostek GTA.');
   result.push({meshIndex,vertexIndex,x,y:-z,z:y});if(result.length>20000)throw new Error('Przekroczono limit 20 000 zmienionych punktów.');
  }
 });return result;
}
export class YftPositionHistory{
 private past:Float32Array[][]=[];private future:Float32Array[][]=[];
 private snapshot(root:THREE.Group){return root.children.map(o=>{if(!(o instanceof THREE.Mesh))throw new Error('Nieprawidłowy mesh.');const p=o.geometry.getAttribute('position');return Float32Array.from({length:p.count*3},(_,i)=>p.getComponent(Math.floor(i/3),i%3));});}
 get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
 checkpoint(root:THREE.Group){const snapshot=this.snapshot(root);this.past.push(snapshot);this.future=[];while(this.past.length>20||this.past.reduce((sum,entry)=>sum+entry.reduce((n,a)=>n+a.byteLength,0),0)>64*1024*1024)this.past.shift();}
 restore(root:THREE.Group,redo=false){const from=redo?this.future:this.past,to=redo?this.past:this.future;const entry=from.pop();if(!entry)return;to.push(this.snapshot(root));entry.forEach((values,i)=>{const mesh=root.children[i] as THREE.Mesh,p=mesh.geometry.getAttribute('position');for(let j=0;j<p.count;j++)p.setXYZ(j,values[j*3],values[j*3+1],values[j*3+2]);p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();});}
 clear(){this.past=[];this.future=[];}
}
