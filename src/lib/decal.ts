import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export type SurfaceHit={mesh:THREE.Mesh;point:THREE.Vector3;normal:THREE.Vector3};
export type LogoSettings={width:number;rotationDeg:number;opacity:number};

export function validateLogoSettings(input:LogoSettings){
 if(!Number.isFinite(input.width)||input.width<.025||input.width>10)throw new Error('Szerokość logo musi mieć 0.025–10 m.');
 if(!Number.isFinite(input.rotationDeg)||Math.abs(input.rotationDeg)>3600)throw new Error('Niepoprawny obrót logo.');
 if(!Number.isFinite(input.opacity)||input.opacity<.05||input.opacity>1)throw new Error('Przezroczystość logo musi wynosić 5–100%.');
}

/** Load image into a canvas so .kurogane/GLB export embeds bytes, not a blob: URL. */
export async function loadLogoImage(file:File):Promise<THREE.CanvasTexture>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024||file.size===0)
   throw new Error('Logo: PNG, JPEG lub WebP, maksymalnie 8 MiB.');
 const blobURL=URL.createObjectURL(file);
 try{
   const image=await new THREE.ImageLoader().loadAsync(blobURL);
   if(!image.width||!image.height||image.width>4096||image.height>4096)
     throw new Error('Logo ma niepoprawne wymiary (maksymalnie 4096×4096 px).');
   const canvas=document.createElement('canvas');
   canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw new Error('Nie można utworzyć powierzchni obrazu.');
   ctx.drawImage(image,0,0);
   const texture=new THREE.CanvasTexture(canvas);
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.flipY=false;
   texture.needsUpdate=true;
   return texture;
 }finally{URL.revokeObjectURL(blobURL);}
}

/** Project a decal mesh onto an existing mesh, retaining editable geometry in the GLB scene. */
export function createLogoDecal(hit:SurfaceHit,texture:THREE.Texture,settings:LogoSettings):THREE.Mesh{
 validateLogoSettings(settings);
 if(!hit.point.toArray().every(Number.isFinite)||!hit.normal.toArray().every(Number.isFinite))
   throw new Error('Punkt projekcji logo jest niepoprawny.');
 if(hit.normal.lengthSq()<.1)throw new Error('Brak normalnej powierzchni.');
 const normal=hit.normal.clone().normalize();
 const orient=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
 const aroundNormal=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),THREE.MathUtils.degToRad(settings.rotationDeg));
 orient.multiply(aroundNormal);
 const image=texture.image as {width?:number;height?:number}|undefined;
 const ratio=(image?.width&&image?.height)?image.height/image.width:1;
 const size=new THREE.Vector3(settings.width,settings.width*ratio,Math.max(.1,settings.width*.75));
 const geometry=new DecalGeometry(hit.mesh,hit.point.clone().addScaledVector(normal,.005),new THREE.Euler().setFromQuaternion(orient),size);
 if(!geometry.getAttribute('position')?.count){
   geometry.dispose();throw new Error('Powierzchnia nie przecina projekcji logo. Wybierz inne miejsce.');
 }
 const material=new THREE.MeshStandardMaterial({
   color:0xffffff,map:texture,transparent:true,opacity:settings.opacity,
   depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
   metalness:0,roughness:1,side:THREE.DoubleSide,
 });
 const decal=new THREE.Mesh(geometry,material);
 decal.name='Logo 3D · '+(hit.mesh.name||'karoseria');
 decal.userData.kurogane={kind:'decal',sourcePart:hit.mesh.name,sourceId:hit.mesh.uuid};
 decal.renderOrder=2;
 return decal;
}
