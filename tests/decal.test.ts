import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLogoDecal, validateLogoSettings } from '../src/lib/decal';

test('decal projects onto GTA-style car panel and retains separate mesh geometry',()=>{
 const body=new THREE.Mesh(new THREE.BoxGeometry(3,1.5,5));
 body.name='bodyshell';
 const tex=new THREE.Texture();
 const logo=createLogoDecal({
   mesh:body,
   point:new THREE.Vector3(1.5,0,0),
   normal:new THREE.Vector3(1,0,0)
 },tex,{width:.65,rotationDeg:0,opacity:.9});
 assert.equal(logo.userData.kurogane.kind,'decal');
 assert.equal(logo.userData.kurogane.sourcePart,'bodyshell');
 assert.notEqual(body.geometry,logo.geometry);
 assert.ok(logo.geometry.getAttribute('position').count>0);
 assert.equal((logo.material as THREE.MeshStandardMaterial).opacity,.9);
 assert.ok(logo.geometry.getAttribute('uv').count>0);
});
test('decal refuses invalid settings without changing original mesh',()=>{
 const body=new THREE.Mesh(new THREE.BoxGeometry());
 const original=body.geometry;
 assert.throws(()=>validateLogoSettings({width:-1,rotationDeg:0,opacity:1}),/Szerokość/);
 assert.throws(()=>validateLogoSettings({width:1,rotationDeg:Infinity,opacity:1}),/obrót/);
 assert.throws(()=>validateLogoSettings({width:1,rotationDeg:0,opacity:2}),/Przezroczystość/);
 assert.throws(()=>createLogoDecal({mesh:body,point:new THREE.Vector3(),normal:new THREE.Vector3()},new THREE.Texture(),{width:.1,rotationDeg:0,opacity:1}),/normalnej/);
 assert.equal(body.geometry,original);
});
test('transparent decal can be included in a serialized scene project without changing body',()=>{
 const body=new THREE.Mesh(new THREE.BoxGeometry(2,2,2));
 const decal=createLogoDecal({mesh:body,point:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(1,0,0)},
   new THREE.Texture(),{width:.35,rotationDeg:30,opacity:.6});
 const root=new THREE.Group();root.add(body,decal);
 const data=root.toJSON();
 assert.equal(data.object.children?.length,2);
 assert.ok(data.materials?.some((x:{opacity?:number})=>x.opacity===.6));
 assert.ok(decal.geometry.getAttribute('position').count>0);
});
