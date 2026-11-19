import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {editFace} from '../src/lib/topology';
function triangle(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));g.addGroup(0,3,2);return new THREE.Mesh(g);}
test('extrusion preserves source, moves cap and creates six side triangles',()=>{
 const mesh=triangle(), original=mesh.geometry;editFace(mesh,0,'extrude',.5);
 assert.equal(mesh.geometry.getAttribute('position').count,21);
 for(let i=0;i<3;i++)assert.equal(mesh.geometry.getAttribute('position').getZ(i),.5);
 assert.equal(original.getAttribute('position').getZ(0),0);
 assert.equal(mesh.geometry.groups[0].materialIndex,2);
 assert.equal(mesh.geometry.groups[0].count,21);
 assert.equal(mesh.geometry.getAttribute('uv').count,21);
 assert.equal(mesh.geometry.boundingBox?.max.z,.5);
});
test('subdivision interpolates UV and preserves surface area',()=>{
 const mesh=triangle();editFace(mesh,0,'subdivide');const p=mesh.geometry.getAttribute('position');let area=0;
 for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}
 assert.equal(area,.5);assert.equal(p.count,12);assert.equal(mesh.geometry.getAttribute('uv').getX(1),.5);
});
test('indexed box keeps material groups when a face is removed',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry());editFace(mesh,0,'delete');assert.equal(mesh.geometry.getAttribute('position').count,33);assert.equal(mesh.geometry.groups.reduce((n,g)=>n+g.count,0),33);assert.equal(mesh.geometry.groups.length,6);
});
test('invalid input and rigs leave geometry unchanged',()=>{
 const mesh=triangle(),source=mesh.geometry;
 assert.throws(()=>editFace(mesh,99,'delete'));assert.throws(()=>editFace(mesh,0,'extrude',NaN));assert.equal(mesh.geometry,source);
 mesh.geometry.morphAttributes.position=[source.getAttribute('position').clone()];assert.throws(()=>editFace(mesh,0,'subdivide'));assert.equal(mesh.geometry,source);
});
