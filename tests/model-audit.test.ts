import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { auditScene } from '../src/lib/model-audit';

test('a normal textured box gets no critical geometry errors',()=>{
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));
 const report=auditScene(root);
 assert.equal(report.errors,0);
 assert.equal(report.parts,1);
 assert.equal(report.triangles,12);
 assert.equal(report.vertices,24);
});
test('audit identifies missing UV and degenerate triangles without mutating original geometry',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,2,0,0],3));
 const original=g.attributes.position.array.slice();
 const root=new THREE.Group();root.add(new THREE.Mesh(g));
 const report=auditScene(root);
 assert.ok(report.issues.some(x=>x.code==='missing-uv'));
 assert.ok(report.issues.some(x=>x.code==='degenerate-faces'));
 assert.deepEqual(g.attributes.position.array,original);
});
test('audit identifies out-of-range indices, missing normals and non-finite positions',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 g.setIndex([0,1,99]);
 const root=new THREE.Group();root.add(new THREE.Mesh(g));
 const report=auditScene(root);
 assert.ok(report.issues.some(x=>x.code==='invalid-indices'));
 assert.ok(report.issues.some(x=>x.code==='missing-normals'));
 (g.getAttribute('position') as THREE.BufferAttribute).setX(0,Number.NaN);
 assert.ok(auditScene(root).issues.some(x=>x.code==='nan-position'));
});
test('audit warns when two wheel components share an assigned role',()=>{
 const root=new THREE.Group();
 for(let i=0;i<2;i++){
   const m=new THREE.Mesh(new THREE.BoxGeometry());
   m.name='wheel-'+i;m.userData.kurogane={role:'wheel_lf',lod:'high'};
   root.add(m);
 }
 assert.ok(auditScene(root).issues.some(x=>x.code==='duplicate-role'));
});
test('audit exempts open borders of projected decal meshes',()=>{
 const root=new THREE.Group();
 const g=new THREE.PlaneGeometry(1,1);
 const mesh=new THREE.Mesh(g);
 mesh.userData.kurogane={kind:'decal'};
 root.add(mesh);
 const report=auditScene(root);
 assert.ok(!report.issues.some(x=>x.code==='open-border'));
});
