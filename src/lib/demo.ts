import * as THREE from 'three';

/** Deliberately synthetic model for exercising the editor — not a GTA vehicle. */
export function createDemoCar(): THREE.Group {
  const car = new THREE.Group();
  car.name = 'Kurogane Concept — demonstracja';
  const material = (color: string, metalness = 0.15, roughness = 0.38) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const bodyPaint = material('#3a9bab', 0.68, 0.24);
  const glass = material('#213447', 0.14, 0.12);
  const dark = material('#161d25', 0.18, 0.58);
  const trim = material('#b7c5ce', 0.8, 0.28);
  const lamps = material('#ffdc92', 0.05, 0.2);
  const red = material('#a12542', 0.2, 0.28);
  function box(name: string, dimensions: [number, number, number], position: [number, number, number], mat: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), mat.clone());
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    return mesh;
  }
  box('Karoseria', [2.16, 0.74, 4.7], [0, 0.95, 0], bodyPaint);
  box('Dach', [1.8, 0.21, 2.14], [0, 1.79, -0.07], bodyPaint);
  box('Przednia szyba', [1.73, 0.54, 0.12], [0, 1.49, -1.08], glass);
  box('Tylna szyba', [1.73, 0.54, 0.12], [0, 1.49, 0.99], glass);
  box('Szyba lewa', [0.08, 0.5, 1.9], [-0.91, 1.5, -0.07], glass);
  box('Szyba prawa', [0.08, 0.5, 1.9], [0.91, 1.5, -0.07], glass);
  box('Przedni zderzak', [2.04, 0.24, 0.26], [0, 0.69, -2.4], trim);
  box('Tylny zderzak', [2.04, 0.24, 0.26], [0, 0.69, 2.4], dark);
  for (const side of [-1, 1]) {
    for (const axle of [-1.52, 1.52]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.28, 40), dark.clone());
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(side * 1.05, 0.54, axle);
      tyre.name = `Opona ${side < 0 ? 'lewa' : 'prawa'} ${axle < 0 ? 'przód' : 'tył'}`;
      tyre.castShadow = true;
      car.add(tyre);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.286, 32), trim.clone());
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(tyre.position);
      rim.name = `Felga ${side < 0 ? 'lewa' : 'prawa'} ${axle < 0 ? 'przód' : 'tył'}`;
      car.add(rim);
    }
    box(`Reflektor ${side < 0 ? 'lewy' : 'prawy'}`, [0.46, 0.17, 0.04], [side * 0.77, 1.03, -2.36], lamps);
    box(`Lampa tylna ${side < 0 ? 'lewa' : 'prawa'}`, [0.44, 0.2, 0.04], [side * 0.78, 1.06, 2.36], red);
  }
  [bodyPaint, glass, dark, trim, lamps, red].forEach(mat => mat.dispose());
  return car;
}

export function clearModel(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(mat => mat.dispose());
      }
    });
  }
}

export function prepareModel(object: THREE.Object3D) {
  // Materials must not be shared between parts; inspector edits only the selected part.
  object.traverse(part => {
    if (part instanceof THREE.Mesh) {
      part.geometry=part.geometry.clone();
      part.material = Array.isArray(part.material)
        ? part.material.map(mat => mat.clone())
        : part.material.clone();
    }
  });
}
