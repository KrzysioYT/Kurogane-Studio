import * as THREE from 'three';
type Corner = { indices: number[]; offset?: THREE.Vector3 };
/** Triangle operations preserve ordinary attributes and material groups; rigs are rejected. */
export function editFace(mesh: THREE.Mesh, face: number, action: 'extrude' | 'delete' | 'subdivide', distance = .1) { return editFaces(mesh,[face],action,distance); }
export function editFaces(mesh: THREE.Mesh, faces: number[], action: 'extrude' | 'delete' | 'subdivide' | 'inset', distance = .1) {
  const original = mesh.geometry;
  if (mesh instanceof THREE.SkinnedMesh || Object.keys(original.morphAttributes).length || original.hasAttribute('skinIndex')) throw new Error('Topologia skórowanej siatki wymaga edytora wag i kości.');
  const source = original.index ? original.toNonIndexed() : original.clone();
  try {
    const position = source.getAttribute('position');
    if (!position || position.count % 3 || position.count > 300000) throw new Error('Wymagana siatka do 100 000 trójkątów.');
    for (const attr of Object.values(source.attributes)) if (!(attr instanceof THREE.BufferAttribute) || attr.count !== position.count) throw new Error('Nieobsługiwany układ atrybutów.');
    const count = position.count / 3;
    const selected=new Set(faces);
    if(!selected.size||faces.some(face=>!Number.isInteger(face)||face<0||face>=count))throw new Error('Wybierz ściany siatki.');
    if (!Number.isFinite(distance) || Math.abs(distance) > 100 || (action === 'extrude' && Math.abs(distance) < 1e-6)) throw new Error('Niepoprawna odległość wyciągania.');
    if(action==='inset' && (selected.size!==1||distance<=0||distance>=1))throw new Error('Inset: wybierz jeden trójkąt i wartość 0–1.');
    const key=(i:number)=>[position.getX(i),position.getY(i),position.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
    const edges=new Map<string,{a:number;b:number;count:number;material:number}>();
    const direction=new THREE.Vector3();
    for(const face of selected){
      const a=face*3,b=a+1,c=a+2;
      const p=(index:number)=>new THREE.Vector3().fromBufferAttribute(position,index);
      direction.add(p(b).sub(p(a)).cross(p(c).sub(p(a))));
      for(const [start,end] of [[a,b],[b,c],[c,a]]){
        const k=[key(start),key(end)].sort().join('|');const edge=edges.get(k);
        if(edge){edge.count++;if(edge.count>2||(key(edge.a)===key(start)))throw new Error('Niespójny region: sprawdź normalne i krawędzie non-manifold.');}
        else edges.set(k,{a:start,b:end,count:1,material:source.groups.find(g=>start>=g.start&&start<g.start+g.count)?.materialIndex??0});
      }
    }
    if(action==='extrude'&&(direction.lengthSq()<1e-20||![...edges.values()].some(e=>e.count===1)))throw new Error('Wybierz otwarty region o jednoznacznym kierunku wyciągania.');
    direction.normalize().multiplyScalar(distance);
    const triangles: {corners: Corner[]; material: number}[] = [];
    for (let i = 0; i < count; i++) {
      const a = i * 3, b = a + 1, c = a + 2;
      const material = source.groups.find(g => a >= g.start && a < g.start + g.count)?.materialIndex ?? 0;
      const push = (...corners: Corner[]) => triangles.push({ corners, material });
      const v = (index: number): Corner => ({ indices: [index] });
      if (!selected.has(i)) { push(v(a), v(b), v(c)); continue; }
      if (action === 'delete') continue;
      if (action === 'subdivide') {
        const ab = {indices:[a,b]}, bc = {indices:[b,c]}, ca = {indices:[c,a]};
        push(v(a),ab,ca); push(ab,v(b),bc); push(ca,bc,v(c)); push(ab,bc,ca);
      } else if(action==='inset') {
        const center=new THREE.Vector3();for(const index of [a,b,c])center.add(new THREE.Vector3().fromBufferAttribute(position,index));center.divideScalar(3);
        const top=(index:number):Corner=>({indices:[index],offset:center.clone().sub(new THREE.Vector3().fromBufferAttribute(position,index)).multiplyScalar(distance)});
        push(top(a),top(b),top(c));
        for(const [start,end] of [[a,b],[b,c],[c,a]]){push(v(start),v(end),top(end));push(v(start),top(end),top(start));}
      } else {
        const top=(index:number):Corner=>({indices:[index],offset:direction});
        push(top(a),top(b),top(c));
      }
    }
    if(action==='extrude')for(const edge of edges.values())if(edge.count===1){
      const v=(i:number):Corner=>({indices:[i]}),top=(i:number):Corner=>({indices:[i],offset:direction});
      triangles.push({corners:[v(edge.a),v(edge.b),top(edge.b)],material:edge.material},{corners:[v(edge.a),top(edge.b),top(edge.a)],material:edge.material});
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

/** Connected coplanar region, respecting geometric edges even at UV seams. */
export function coplanarFaces(mesh:THREE.Mesh,seed:number):number[]{
 const g=mesh.geometry,p=g.getAttribute('position'),idx=g.index,count=Math.floor((idx?.count??p.count)/3);
 if(seed<0||seed>=count)return [];
 const vertex=(face:number,corner:number)=>idx?idx.getX(face*3+corner):face*3+corner;
 const point=(i:number)=>new THREE.Vector3().fromBufferAttribute(p,i);
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
 const edges=new Map<string,number[]>(),faceEdges:string[][]=[],normals:THREE.Vector3[]=[];
 for(let face=0;face<count;face++){
  const ids=[0,1,2].map(c=>vertex(face,c));const [a,b,c]=ids.map(point);normals.push(b.sub(a).cross(c.sub(a)).normalize());
  const keys=[[0,1],[1,2],[2,0]].map(([u,v])=>[key(ids[u]),key(ids[v])].sort().join('|'));faceEdges.push(keys);
  for(const k of keys){const list=edges.get(k)??[];list.push(face);edges.set(k,list);}
 }
 const result=new Set([seed]),queue=[seed],normal=normals[seed],origin=point(vertex(seed,0));
 while(queue.length){const face=queue.pop()!;for(const edge of faceEdges[face])for(const neighbor of edges.get(edge)??[]){
  if(result.has(neighbor)||normals[neighbor].dot(normal)<.9999)continue;
  if(Math.abs(point(vertex(neighbor,0)).sub(origin).dot(normal))>1e-5)continue;
  result.add(neighbor);queue.push(neighbor);
 }}
 return [...result];
}
