import * as THREE from 'three';
import JSZip from 'jszip';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {cloneScene,disposeScene} from './history';
const MAX=128*1024*1024;
export async function encodeProject(root:THREE.Group,name:string):Promise<Uint8Array>{
  const copy=cloneScene(root);
  try{
    const data=JSON.stringify({format:'kurogane-studio',version:1,name,scene:copy.toJSON()});
    if(new TextEncoder().encode(data).length>MAX)throw new Error('Projekt przekracza 128 MiB.');
    return await new JSZip().file('project.json',data).generateAsync({type:'uint8array',compression:'DEFLATE'});
  }finally{disposeScene(copy);}
}
export async function decodeProject(data:ArrayBuffer):Promise<{root:THREE.Group;name:string}>{
  if(data.byteLength>MAX)throw new Error('Projekt przekracza 128 MiB.');
  const zip=await JSZip.loadAsync(data);
  const file=zip.file('project.json');if(!file)throw new Error('Brak project.json.');
  // Bound decompression during streaming, before collecting a large result.
  let size=0;const chunks:Uint8Array[]=[];
  await new Promise<void>((resolve,reject)=>{
    const stream=(file as unknown as {internalStream:(type:string)=>{on:(event:string,callback:(value:any)=>void)=>void;pause:()=>void;resume:()=>void}}).internalStream('uint8array');
    stream.on('data',(chunk:Uint8Array)=>{size+=chunk.length;if(size>MAX){stream.pause();reject(new Error('Rozpakowany projekt przekracza 128 MiB.'));}else chunks.push(chunk);});
    stream.on('error',reject);stream.on('end',resolve);stream.resume();
  });
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const parsed=JSON.parse(new TextDecoder().decode(bytes));
  if(parsed.format!=='kurogane-studio'||parsed.version!==1||typeof parsed.name!=='string'||parsed.scene?.object?.type!=='Group')throw new Error('Nieobsługiwana wersja projektu.');
  // Projects are self-contained; loading a project must not fetch external images.
  for(const image of parsed.scene.images??[]){
    const urls=Array.isArray(image.url)?image.url:[image.url];
    for(const url of urls)if(typeof url==='string'&&!/^data:image\/(png|jpeg|webp);base64,/.test(url))throw new Error('Projekt zawiera zewnętrzną teksturę.');
  }
  const root=await new THREE.ObjectLoader().parseAsync(parsed.scene);
  let vertices=0;root.traverse(o=>{if(o instanceof THREE.Mesh){vertices+=o.geometry.getAttribute('position')?.count??0;}});
  if(vertices>2000000){disposeScene(root);throw new Error('Projekt przekracza 2 miliony wierzchołków.');}
  return {root:root as THREE.Group,name:parsed.name.slice(0,200)};
}
export async function saveProject(root:THREE.Group,name:string){
  const bytes=await encodeProject(root,name),fileName=(name.replace(/[^\p{L}\p{N}_-]/gu,'_')||'projekt')+'.kurogane';
  if(isTauri())return await invoke<boolean>('save_studio_project',{fileName,bytes:Array.from(bytes)});
  const blob=new Blob([new Uint8Array(bytes)],{type:'application/zip'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
}
