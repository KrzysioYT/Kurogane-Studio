import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

/** Geometry/materials are independent; immutable image textures can be shared. */
export function cloneScene(root: THREE.Group): THREE.Group {
  const result=clone(root) as THREE.Group;
  const originals:THREE.Object3D[]=[];root.traverse(o=>originals.push(o));let index=0;
  result.traverse(object=>{
    object.uuid=originals[index++].uuid;
    if(object instanceof THREE.Mesh){
      // Convert procedural geometry to plain buffers: ObjectLoader otherwise regenerates
      // its constructor parameters and silently discards edited vertices.
      object.geometry=new THREE.BufferGeometry().copy(object.geometry);
      object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
    }
  });
  return result;
}
export function disposeScene(root:THREE.Object3D){
  root.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());}});
}
function sceneBytes(root:THREE.Group){
  let bytes=0;root.traverse(o=>{if(o instanceof THREE.Mesh){for(const a of Object.values(o.geometry.attributes) as THREE.BufferAttribute[])bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}});return bytes;
}
type Snapshot={root:THREE.Group;label:string;bytes:number;name:string};
export class SceneHistory {
  private past:Snapshot[]=[];private future:Snapshot[]=[];
  constructor(private maxEntries=30,private maxBytes=128*1024*1024){}
  get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  get undoLabel(){return this.past.at(-1)?.label??'';}
  checkpoint(root:THREE.Group,name:string,label:string){
    const bytes=sceneBytes(root);
    if(bytes>this.maxBytes)throw new Error('Scena jest za duża na bezpieczną historię (128 MiB geometrii). Podziel projekt.');
    const snapshot={root:cloneScene(root),name,label,bytes};
    this.future.forEach(s=>disposeScene(s.root));this.future=[];
    this.past.push(snapshot);
    while(this.past.length>this.maxEntries||this.past.reduce((n,s)=>n+s.bytes,0)>this.maxBytes){disposeScene(this.past.shift()!.root);}
  }
  restore(root:THREE.Group,name:string,redo=false):string|null{
    const from=redo?this.future:this.past,to=redo?this.past:this.future;
    const entry=from.pop();if(!entry)return null;
    to.push({root:cloneScene(root),name,label:entry.label,bytes:sceneBytes(root)});
    disposeScene(root);root.clear();
    for(const child of [...entry.root.children])root.add(child);
    root.userData=structuredClone(entry.root.userData);
    return entry.name;
  }
  clear(){for(const s of [...this.past,...this.future])disposeScene(s.root);this.past=[];this.future=[];}
}
