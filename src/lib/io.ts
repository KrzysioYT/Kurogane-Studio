import * as THREE from 'three';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const MAX_FILE_BYTES = 256 * 1024 * 1024;
export async function importModel(file: File): Promise<THREE.Object3D> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Maksymalny rozmiar importowanego pliku to 256 MiB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'obj') {
    const result = new OBJLoader().parse(await file.text());
    result.name = file.name;
    return result;
  }
  if (extension === 'glb' || extension === 'gltf') {
    const loader = new GLTFLoader();
    const content = extension === 'glb' ? await file.arrayBuffer() : await file.text();
    const gltf = await loader.parseAsync(content, '');
    gltf.scene.name = file.name;
    return gltf.scene;
  }
  throw new Error('Obsługiwane formaty: .glb, .obj i samowystarczalny .gltf.');
}

export async function exportGLB(group: THREE.Group): Promise<ArrayBuffer> {
  if (group.children.length === 0) throw new Error('Najpierw załaduj model.');
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer | object>((resolve, reject) => {
    exporter.parse(group, resolve, reject, { binary: true, onlyVisible: true });
  });
  if (!(result instanceof ArrayBuffer)) throw new Error('Eksporter nie zwrócił binarnego GLB.');
  return result;
}

export async function saveGLB(data: ArrayBuffer, suggestedName: string): Promise<'saved' | 'cancelled'> {
  const name = (suggestedName.replace(/\.[^.]*$/, '') || 'kurogane-model') + '.glb';
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('Eksport przekracza limit 256 MiB.');
  if (isTauri()) {
    const saved = await invoke<boolean>('save_glb', {
      fileName: name,
      bytes: Array.from(new Uint8Array(data)),
    });
    return saved ? 'saved' : 'cancelled';
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
