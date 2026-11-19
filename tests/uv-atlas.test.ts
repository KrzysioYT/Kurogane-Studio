import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {packUVIslands} from '../src/lib/uv-atlas';

test('box UV atlas puts six independent sides into the 0..1 area',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,3,4));
 const source=mesh.geometry;
 const charts=packUVIslands(mesh);
 assert.equal(charts,6);
 assert.notEqual(mesh.geometry,source);
 const uv=mesh.geometry.getAttribute('uv');
 assert.equal(uv.count,36);
 for(let i=0;i<uv.count;i++){
   assert.ok(uv.getX(i)>=0 && uv.getX(i)<=1);
   assert.ok(uv.getY(i)>=0 && uv.getY(i)<=1);
 }
});
test('detached triangles never overlap their packed tile coordinates',()=>{
 const mesh=new THREE.Mesh(new THREE.BufferGeometry());
 mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute([
   0,0,0,1,0,0,0,1,0,
   2,0,0,3,0,0,2,1,0
 ],3));
 assert.equal(packUVIslands(mesh),2);
 const uv=mesh.geometry.getAttribute('uv');
 let maxFirst=0,minSecond=1;
 for(let i=0;i<3;i++)maxFirst=Math.max(maxFirst,uv.getX(i));
 for(let i=3;i<6;i++)minSecond=Math.min(minSecond,uv.getX(i));
 assert.ok(maxFirst<minSecond);
});
test('atlas preserves extra vertex attributes and original mesh geometries',()=>{
 const geometry=new THREE.BoxGeometry();
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(geometry.getAttribute('position').count*3).fill(1),3));
 const before=geometry.getAttribute('uv').array.slice();
 const mesh=new THREE.Mesh(geometry);
 packUVIslands(mesh);
 assert.equal(mesh.geometry.getAttribute('color').count,36);
 assert.deepEqual(geometry.getAttribute('uv').array,before);
});
test('atlas rejects invalid topology or skinned vertices',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0],3));
 const mesh=new THREE.Mesh(g);
 assert.throws(()=>packUVIslands(mesh),/poprawne siatki/);
 assert.equal(mesh.geometry,g);
});
