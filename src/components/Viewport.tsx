import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export type TransformMode = 'translate' | 'rotate' | 'scale';
type Props = {
  root: THREE.Group;
  selectedId: string | null;
  mode: TransformMode;
  focusToken: number;
  onSelect: (id: string | null) => void;
  onChange: () => void;
  vertexMode?: boolean;
  selectedVertexIndex?: number | null;
  geometryRevision?: number;
  onVertexSelect?: (id:string|null,index:number|null)=>void;
};
type ThreeContext = { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; controls: OrbitControls; transform: TransformControls; marker: THREE.Mesh; root: THREE.Group; scene: THREE.Scene; fit: () => void };

export default function Viewport({ root, selectedId, mode, focusToken, onSelect, onChange, vertexMode = false, selectedVertexIndex = null, geometryRevision = 0, onVertexSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<ThreeContext | null>(null);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);
  const onVertexSelectRef=useRef(onVertexSelect);
  const vertexState=useRef({enabled:vertexMode,selectedId,index:selectedVertexIndex});
  useEffect(() => { onSelectRef.current = onSelect; onChangeRef.current = onChange; onVertexSelectRef.current=onVertexSelect;vertexState.current={enabled:vertexMode,selectedId,index:selectedVertexIndex}; }, [onSelect, onChange, onVertexSelect, vertexMode, selectedId, selectedVertexIndex]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141d29');
    scene.fog = new THREE.Fog('#141d29', 28, 75);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    camera.position.set(6, 4, 7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.48;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xcee7ff, 0x273344, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 3.6);
    key.position.set(6, 13, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 20;
    key.shadow.camera.bottom = -20;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x82c9db, 1.3);
    fill.position.set(-8, 4, -6);
    scene.add(fill);
    const grid = new THREE.GridHelper(80, 80, 0x395368, 0x293a4d);
    grid.position.y = -0.025;
    scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(root);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 140;
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.85);
    scene.add(transform.getHelper());
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),new THREE.MeshBasicMaterial({color:0xffae52,depthTest:false}));
    marker.visible=false;marker.renderOrder=1000;scene.add(marker);
    transform.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
    });
    transform.addEventListener('objectChange', () => {
      const v=vertexState.current;
      if(v.enabled && v.selectedId && v.index!==null && marker.visible){
        const object=root.getObjectByProperty('uuid',v.selectedId);
        if(object instanceof THREE.Mesh){
          const pos=object.geometry.getAttribute('position');
          if(pos instanceof THREE.BufferAttribute && v.index>=0 && v.index<pos.count){
            object.updateWorldMatrix(true,false);
            const local=object.worldToLocal(marker.position.clone());
            pos.setXYZ(v.index,local.x,local.y,local.z);
            pos.needsUpdate=true;
            object.geometry.computeVertexNormals();
            object.geometry.computeBoundingBox();
            object.geometry.computeBoundingSphere();
          }
        }
      }
      onChangeRef.current();
    });

    function fit() {
      const bounds = new THREE.Box3().setFromObject(root);
      if (bounds.isEmpty()) {
        camera.position.set(6, 4, 7);
        controls.target.set(0, 0.8, 0);
      } else {
        const center = bounds.getCenter(new THREE.Vector3());
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const distance = Math.max(sphere.radius * 3.4, 3.5);
        camera.position.copy(center).add(new THREE.Vector3(distance * 0.78, distance * 0.46, distance * 0.78));
        controls.target.copy(center);
      }
      camera.updateProjectionMatrix();
      controls.update();
    }
    ctxRef.current = { renderer, camera, controls, transform, marker, root, scene, fit };
    fit();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    function onPointerDown(e: PointerEvent) { pointerDown = { x: e.clientX, y: e.clientY }; }
    function onPointerUp(e: PointerEvent) {
      if (!pointerDown || Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) return;
      if (transform.axis) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(root.children, true).find(i => i.object.visible && i.object instanceof THREE.Mesh);
      if(vertexState.current.enabled){
        if(hit?.face && hit.object instanceof THREE.Mesh){
          const mesh=hit.object;
          const position=mesh.geometry.getAttribute('position');
          mesh.updateWorldMatrix(true,false);
          if(position){
            let bestIndex:number|null=null, bestDistance=Infinity;
            for(const index of [hit.face.a,hit.face.b,hit.face.c]){
              if(index<0||index>=position.count)continue;
              const p=new THREE.Vector3().fromBufferAttribute(position,index);
              mesh.localToWorld(p);
              const distance=p.distanceToSquared(hit.point);
              if(distance<bestDistance){bestDistance=distance;bestIndex=index;}
            }
            onVertexSelectRef.current?.(mesh.uuid,bestIndex);
            return;
          }
        }
        onVertexSelectRef.current?.(null,null);
      }else onSelectRef.current(hit?.object.uuid ?? null);
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(element);
    let raf = 0;
    function draw() {
      raf = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      transform.detach();
      transform.dispose();
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      scene.remove(marker);
      controls.dispose();
      scene.remove(root);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctxRef.current = null;
    };
  }, [root]);

  useEffect(() => {
    const context = ctxRef.current;
    if (!context) return;
    const object = selectedId ? root.getObjectByProperty('uuid', selectedId) : undefined;
    if(vertexMode && object instanceof THREE.Mesh && selectedVertexIndex!==null){
      const pos=object.geometry.getAttribute('position');
      if(pos && selectedVertexIndex>=0 && selectedVertexIndex<pos.count){
        object.updateWorldMatrix(true,false);
        context.marker.position.copy(object.localToWorld(new THREE.Vector3().fromBufferAttribute(pos,selectedVertexIndex)));
        context.marker.visible=true;
        context.transform.setMode('translate');
        context.transform.attach(context.marker);
      }else{context.marker.visible=false;context.transform.detach();}
    }else{
      context.marker.visible=false;
      if(object)context.transform.attach(object);
      else context.transform.detach();
    }
  }, [root, selectedId, vertexMode, selectedVertexIndex, geometryRevision]);

  useEffect(() => { ctxRef.current?.transform.setMode(vertexMode?'translate':mode); }, [mode,vertexMode]);
  useEffect(() => { ctxRef.current?.fit(); }, [focusToken]);
  return <div ref={containerRef} className="viewport" aria-label="Edytor sceny 3D"/>;
}
