import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SceneHistory} from '../src/lib/history';
import {encodeProject,decodeProject} from '../src/lib/project';
import {coplanarFaces,editFaces} from '../src/lib/topology';
import {analyzeMesh,bakeTransform,centerPivot,mapUV,moveVertex,smoothNormals,transformUV,weld} from '../src/lib/modeling';
import JSZip from 'jszip';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('connected coplanar face selection stops at box corners',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry());assert.equal(coplanarFaces(mesh,0).length,2);
});
test('extruding a two-triangle region only creates the outer boundary',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2));editFaces(mesh,[0,1],'extrude',.5);
 const stats=analyzeMesh(mesh);assert.equal(stats.triangles,10);assert.equal(stats.degenerate,0);assert.equal(stats.nonManifold,0);assert.equal(stats.boundaries,4);
 const p=mesh.geometry.getAttribute('position');for(let i=0;i<6;i++)near(p.getZ(i),.5);
});
test('inset keeps triangle in plane and keeps total area',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry());editFaces(mesh,[0],'inset',.2);assert.equal(analyzeMesh(mesh).triangles,8);assert.equal(analyzeMesh(mesh).degenerate,0);
 const p=mesh.geometry.getAttribute('position');let area=0;for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}near(area,1);
});
test('whole-mesh subdivision keeps geometric box closed',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry());editFaces(mesh,Array.from({length:12},(_,i)=>i),'subdivide');const stats=analyzeMesh(mesh);assert.equal(stats.triangles,48);assert.equal(stats.boundaries,0);assert.equal(stats.nonManifold,0);
});
test('scene history restores deleted objects, geometry, materials, name and branching',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'red'}));root.add(mesh);const id=mesh.uuid,h=new SceneHistory();
 h.checkpoint(root,'Car','Edit');mesh.geometry.getAttribute('position').setX(0,8);mesh.material.color.set('blue');mesh.visible=false;
 h.checkpoint(root,'Car','Delete');root.remove(mesh);
 assert.equal(h.restore(root,'Car'),'Car');let restored=root.getObjectByProperty('uuid',id) as THREE.Mesh;assert.equal(restored.visible,false);assert.equal(restored.geometry.getAttribute('position').getX(0),8);
 h.restore(root,'Car');restored=root.getObjectByProperty('uuid',id) as THREE.Mesh;assert.equal(restored.visible,true);assert.equal((restored.material as THREE.MeshStandardMaterial).color.getHexString(),'ff0000');
 h.restore(root,'Car',true);assert.equal((root.children[0] as THREE.Mesh).geometry.getAttribute('position').getX(0),8);
 h.checkpoint(root,'Car','Branch');assert.equal(h.canRedo,false);
});
test('project roundtrip preserves edited procedural vertices, hidden parts, materials and roles',async()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'#abcdef'}));root.add(mesh);
 mesh.geometry.getAttribute('position').setX(0,7.25);mesh.visible=false;mesh.name='door';mesh.userData.kurogane={role:'door_dside_f',lod:'high'};
 const bytes=await encodeProject(root,'Test Car'),project=await decodeProject(bytes.buffer as ArrayBuffer);const restored=project.root.children[0] as THREE.Mesh;
 assert.equal(restored.geometry.getAttribute('position').getX(0),7.25);assert.equal(restored.visible,false);assert.equal(restored.userData.kurogane.role,'door_dside_f');assert.equal(project.name,'Test Car');assert.equal((restored.material as THREE.MeshStandardMaterial).color.getHexString(),'abcdef');
});
test('project rejects unknown version and external texture URLs before loading',async()=>{
 for(const content of [{format:'other',version:1},{format:'kurogane-studio',version:1,name:'X',scene:{object:{type:'Group'},images:[{url:'https://example.org/texture.png'}]}}]){
 const buffer=await new JSZip().file('project.json',JSON.stringify(content)).generateAsync({type:'arraybuffer'});await assert.rejects(()=>decodeProject(buffer));
 }
});
test('UV projection produces finite values and rotates/scales around center',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry());mapUV(mesh,'box');const uv=mesh.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1);assert.ok(uv.getY(i)>=0&&uv.getY(i)<=1);}
 const u=uv.getX(0),v=uv.getY(0);transformUV(mesh,1,1,0,0,Math.PI);near(mesh.geometry.getAttribute('uv').getX(0),1-u);near(mesh.geometry.getAttribute('uv').getY(0),1-v);
});
test('pivot center and baking preserve world-space geometry under transformed parents',()=>{
 for(const operation of [centerPivot,bakeTransform]){
 const root=new THREE.Group();root.position.set(1,2,3);root.rotation.z=.5;const mesh=new THREE.Mesh(new THREE.BoxGeometry().translate(1,2,3));root.add(mesh);mesh.position.set(3,4,5);mesh.scale.set(2,3,4);mesh.rotation.y=.8;root.updateMatrixWorld(true);
 const before=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),0).applyMatrix4(mesh.matrixWorld);operation(mesh);root.updateMatrixWorld(true);const after=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),0).applyMatrix4(mesh.matrixWorld);near(before.distanceTo(after),0);
 }
});
test('linked movement closes UV seams and symmetry mirrors opposite point',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([1,0,0,1,0,0,-1,0,0,0,1,0],3));const mesh=new THREE.Mesh(g);
 moveVertex(mesh,0,new THREE.Vector3(2,.5,0),true,true,0);const p=g.getAttribute('position');near(p.getX(1),2);near(p.getY(1),.5);near(p.getX(2),-2);near(p.getY(2),.5);near(p.getX(3),0);
});
test('soft selection has compact support and leaves distant points unchanged',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.5,0,0,2,0,0],3));const mesh=new THREE.Mesh(g);moveVertex(mesh,0,new THREE.Vector3(0,1,0),false,false,1);near(g.getAttribute('position').getY(1),.5);near(g.getAttribute('position').getY(2),0);
});
test('normal smoothing works across UV splits and seam-preserving welding retains UV',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry());smoothNormals(mesh);const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');
 for(let i=0;i<p.count;i++)near(new THREE.Vector3().fromBufferAttribute(n,i).length(),1);
 weld(mesh,.0001);assert.ok(mesh.geometry.hasAttribute('uv'));assert.equal(analyzeMesh(mesh).triangles,12);
});

test('YFT patches reverse editor coordinates, reject topology edits and undo multiple points',async()=>{
 const {collectYftPatches,YftPositionHistory}=await import('../src/lib/yft-edit');
 const root=new THREE.Group(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setIndex([0,1,2]);const mesh=new THREE.Mesh(g);root.add(mesh);
 const sources=[{vertices:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]}],history=new YftPositionHistory();
 history.checkpoint(root);g.getAttribute('position').setXYZ(0,1,2,3);
 assert.deepEqual(collectYftPatches(root,sources),[{meshIndex:0,vertexIndex:0,x:1,y:-3,z:2}]);
 history.restore(root);assert.equal(collectYftPatches(root,sources).length,0);history.restore(root,true);assert.equal(collectYftPatches(root,sources).length,1);
 g.setIndex([0,2,1]);assert.throws(()=>collectYftPatches(root,sources));
});

test('project embeds data textures and multi-material slots',async()=>{
 const root=new THREE.Group(),texture=new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1);texture.needsUpdate=true;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),[new THREE.MeshStandardMaterial({map:texture}),new THREE.MeshStandardMaterial({color:'blue'})]);root.add(mesh);
 const bytes=await encodeProject(root,'Textures'),project=await decodeProject(bytes.buffer as ArrayBuffer),restored=project.root.children[0] as THREE.Mesh;
 assert.ok(Array.isArray(restored.material));const materials=restored.material as THREE.MeshStandardMaterial[];assert.equal(materials.length,2);assert.equal(materials[0].map?.image.width,1);assert.equal(materials[1].color.getHexString(),'0000ff');
});

test('separating a body panel preserves world transform and source material',async()=>{
 const {separateFaces}=await import('../src/lib/modeling');
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'red'}));root.add(mesh);mesh.position.set(1,2,3);
 const part=separateFaces(mesh,coplanarFaces(mesh,0),editFaces);
 assert.equal(root.children.length,2);assert.equal(analyzeMesh(mesh).triangles,10);assert.equal(analyzeMesh(part).triangles,2);assert.deepEqual(part.position.toArray(),[1,2,3]);assert.notEqual(mesh.material,part.material);
});
