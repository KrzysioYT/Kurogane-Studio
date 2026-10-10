import * as THREE from 'three';
type Corner = { indices: number[]; offset?: THREE.Vector3 };
/** Triangle operations preserve ordinary attributes and material groups; rigs are rejected. */
export function editFace(mesh: THREE.Mesh, face: number, action: 'extrude' | 'delete' | 'subdivide', distance = .1) {
  const original = mesh.geometry;
  if (mesh instanceof THREE.SkinnedMesh || Object.keys(original.morphAttributes).length || original.hasAttribute('skinIndex')) throw new Error('Topologia skórowanej siatki wymaga edytora wag i kości.');
  const source = original.index ? original.toNonIndexed() : original.clone();
  try {
    const position = source.getAttribute('position');
    if (!position || position.count % 3 || position.count > 300000) throw new Error('Wymagana siatka do 100 000 trójkątów.');
    for (const attr of Object.values(source.attributes)) if (!(attr instanceof THREE.BufferAttribute) || attr.count !== position.count) throw new Error('Nieobsługiwany układ atrybutów.');
    const count = position.count / 3;
    if (!Number.isInteger(face) || face < 0 || face >= count) throw new Error('Wybierz ścianę siatki.');
    if (!Number.isFinite(distance) || Math.abs(distance) > 100 || (action === 'extrude' && Math.abs(distance) < 1e-6)) throw new Error('Niepoprawna odległość wyciągania.');
    const triangles: {corners: Corner[]; material: number}[] = [];
    for (let i = 0; i < count; i++) {
      const a = i * 3, b = a + 1, c = a + 2;
      const material = source.groups.find(g => a >= g.start && a < g.start + g.count)?.materialIndex ?? 0;
      const push = (...corners: Corner[]) => triangles.push({ corners, material });
      const v = (index: number): Corner => ({ indices: [index] });
      if (i !== face) { push(v(a), v(b), v(c)); continue; }
      if (action === 'delete') continue;
      if (action === 'subdivide') {
        const ab = {indices:[a,b]}, bc = {indices:[b,c]}, ca = {indices:[c,a]};
        push(v(a),ab,ca); push(ab,v(b),bc); push(ca,bc,v(c)); push(ab,bc,ca);
      } else {
        const p = (index: number) => new THREE.Vector3().fromBufferAttribute(position,index);
        const normal = p(b).sub(p(a)).cross(p(c).sub(p(a)));
        if (normal.lengthSq() < 1e-20) throw new Error('Ściana ma zerową powierzchnię.');
        const offset = normal.normalize().multiplyScalar(distance);
        const top = (index:number): Corner => ({indices:[index],offset});
        push(top(a),top(b),top(c));
        for (const [start,end] of [[a,b],[b,c],[c,a]]) { push(v(start),v(end),top(end)); push(v(start),top(end),top(start)); }
      }
    }
    const result = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const attr = attribute as THREE.BufferAttribute;
      if (name === 'normal' || name === 'tangent') continue;
      const values: number[] = [];
      for (const triangle of triangles) for (const corner of triangle.corners) for (let component = 0; component < attr.itemSize; component++) {
        let value = corner.indices.reduce((sum,index) => sum + attr.getComponent(index,component),0) / corner.indices.length;
        if (name === 'position' && component < 3) value += corner.offset?.getComponent(component) ?? 0;
        values.push(value);
      }
      result.setAttribute(name,new THREE.Float32BufferAttribute(values,attr.itemSize));
    }
    triangles.forEach((triangle,i) => {
      const last = result.groups[result.groups.length-1];
      if (last && last.materialIndex === triangle.material) last.count += 3;
      else result.addGroup(i*3,3,triangle.material);
    });
    result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
    mesh.geometry = result;
  } finally { source.dispose(); }
}
