import * as THREE from 'three';

export type PrimitiveKind='cube'|'sphere'|'cylinder'|'cone'|'plane';
export const PRIMITIVE_KINDS: {key:PrimitiveKind;name:string}[]=[
 {key:'cube',name:'Sześcian'},{key:'sphere',name:'Kula'},
 {key:'cylinder',name:'Walec'},{key:'cone',name:'Stożek'},{key:'plane',name:'Płaszczyzna'}
];
export function createPrimitive(kind:PrimitiveKind):THREE.Mesh {
 const geometry=kind==='cube'?new THREE.BoxGeometry(1,1,1):
   kind==='sphere'?new THREE.SphereGeometry(.6,24,16):
   kind==='cylinder'?new THREE.CylinderGeometry(.45,.45,1.3,24):
   kind==='cone'?new THREE.ConeGeometry(.6,1.2,24):
   new THREE.PlaneGeometry(1.5,1.5,4,4);
 const material=new THREE.MeshStandardMaterial({color:'#549fb1',roughness:.38,metalness:.23,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='Nowy '+(PRIMITIVE_KINDS.find(k=>k.key===kind)?.name??kind);
 mesh.position.y=.7;mesh.castShadow=true;mesh.receiveShadow=true;
 return mesh;
}
export function copyMesh(mesh:THREE.Mesh):THREE.Mesh {
 const copy=mesh.clone(false);
 copy.geometry=mesh.geometry.clone();
 copy.material=Array.isArray(mesh.material)?mesh.material.map(mat=>mat.clone()):mesh.material.clone();
 copy.name=(mesh.name||'Mesh')+' kopia';
 copy.position.x+=.25;copy.position.z+=.25;
 copy.castShadow=mesh.castShadow;copy.receiveShadow=mesh.receiveShadow;
 return copy;
}
export function vertexCount(mesh:THREE.Mesh):number {
 return mesh.geometry.getAttribute('position')?.count??0;
}
export function setVertex(mesh:THREE.Mesh,index:number,axis:'x'|'y'|'z',value:number):void {
 const attr=mesh.geometry.getAttribute('position');
 if(!(attr instanceof THREE.BufferAttribute)||!Number.isInteger(index)||index<0||index>=attr.count)
  throw new Error('Niepoprawny numer wierzchołka.');
 if(!Number.isFinite(value)||Math.abs(value)>1e5)throw new Error('Wartość wierzchołka poza zakresem.');
 const component=axis==='x'?0:axis==='y'?1:2;
 attr.setComponent(index,component,value);
 attr.needsUpdate=true;
 mesh.geometry.computeVertexNormals();
 mesh.geometry.computeBoundingBox();
 mesh.geometry.computeBoundingSphere();
}
export function mirrorGeometry(mesh:THREE.Mesh,axis:'x'|'y'|'z'):void {
 const factors:{[k:string]:[number,number,number]}={x:[-1,1,1],y:[1,-1,1],z:[1,1,-1]};
 const [x,y,z]=factors[axis];
 // Clone before editing so a GLTF mesh never modifies another mesh sharing the same geometry.
 const clone=mesh.geometry.clone();
 mesh.geometry=clone;clone.scale(x,y,z);
 const index=clone.getIndex();
 if(index){
   for(let i=0;i+2<index.count;i+=3){
     const a=index.getX(i);
     index.setX(i,index.getX(i+1));index.setX(i+1,a);
   }
   index.needsUpdate=true;
 }else {
   // Winding changes must permute every attribute, not just positions/UV.
   const count=clone.getAttribute('position').count;
   for(const attr of Object.values(clone.attributes)){
     for(let i=0;i+2<count;i+=3)for(let component=0;component<attr.itemSize;component++){
       const a=attr.getComponent(i,component),b=attr.getComponent(i+1,component);
       attr.setComponent(i,component,b);attr.setComponent(i+1,component,a);
     }
     attr.needsUpdate=true;
   }

 }
 clone.computeVertexNormals();clone.computeBoundingBox();clone.computeBoundingSphere();
}
export function recalcNormals(mesh:THREE.Mesh){
 const clone=mesh.geometry.clone();
 mesh.geometry=clone;clone.computeVertexNormals();clone.computeBoundingSphere();
}

