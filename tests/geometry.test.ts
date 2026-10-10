import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { copyMesh, createPrimitive, mirrorGeometry, recalcNormals, setVertex, vertexCount, PRIMITIVE_KINDS } from '../src/lib/geometry';
import { prepareModel } from '../src/lib/demo';

test('all primitive kinds create independent, renderable BufferGeometries',()=>{
  for(const kind of PRIMITIVE_KINDS){
    const mesh=createPrimitive(kind.key);
    assert.ok(mesh instanceof THREE.Mesh,kind.key);
    assert.ok(vertexCount(mesh)>=3,kind.key);
    assert.ok(mesh.geometry.getAttribute('position'));
    assert.ok(mesh.geometry.getAttribute('normal'));
  }
});
test('editing one vertex does not mutate another mesh copy',()=>{
  const first=createPrimitive('cube');
  const second=copyMesh(first);
  assert.notEqual(first.geometry,second.geometry);
  const a=first.geometry.getAttribute('position') as THREE.BufferAttribute;
  const b=second.geometry.getAttribute('position') as THREE.BufferAttribute;
  const prior=b.getX(0);
  setVertex(first,0,'x',prior+2);
  assert.equal(a.getX(0),prior+2);
  assert.equal(b.getX(0),prior);
  assert.ok(first.geometry.boundingSphere);
});
test('bad vertex indices and invalid numbers are rejected',()=>{
  const mesh=createPrimitive('cube');
  assert.throws(()=>setVertex(mesh,-1,'z',0),/Niepoprawny/);
  assert.throws(()=>setVertex(mesh,999999,'z',0),/Niepoprawny/);
  assert.throws(()=>setVertex(mesh,1,'z',Number.NaN),/poza zakresem/);
});
test('mirror swaps winding and recalculates normals',()=>{
  const mesh=createPrimitive('cube');
  const before=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const firstX=before.getX(0);
  const firstIndex=(mesh.geometry.getIndex() as THREE.BufferAttribute).getX(0);
  const secondIndex=(mesh.geometry.getIndex() as THREE.BufferAttribute).getX(1);
  mirrorGeometry(mesh,'x');
  assert.equal((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0),-firstX);
  assert.equal((mesh.geometry.getIndex() as THREE.BufferAttribute).getX(0),secondIndex);
  assert.equal((mesh.geometry.getIndex() as THREE.BufferAttribute).getX(1),firstIndex);
  recalcNormals(mesh);
  assert.ok(mesh.geometry.getAttribute('normal'));
});
test('model import clones shared mesh geometry and materials',()=>{
  const geom=new THREE.BoxGeometry(1,1,1);
  const mat=new THREE.MeshStandardMaterial();
  const root=new THREE.Group();
  const one=new THREE.Mesh(geom,mat);
  const two=new THREE.Mesh(geom,mat);
  root.add(one,two);
  prepareModel(root);
  assert.notEqual(one.geometry,two.geometry);
  assert.notEqual(one.material,two.material);
  setVertex(one,0,'z',4);
  assert.notEqual((one.geometry.getAttribute('position') as THREE.BufferAttribute).getZ(0),
    (two.geometry.getAttribute('position') as THREE.BufferAttribute).getZ(0));
});
