import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {moveVertex} from '../lib/modeling';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export type ViewPreset='perspective'|'front'|'back'|'left'|'right'|'top'|'bottom';
export type TransformMode = 'translate' | 'rotate' | 'scale';
type Props = {
  root: THREE.Group;
  selectedId: string | null;
  mode: TransformMode;
  focusToken: number;
  onSelect: (id: string | null) => void;
  onChange: () => void;
  faceMode?: boolean;
  selectedFaces?: number[];
  onBeforeChange?:()=>boolean;
  linkedVertices?:boolean;
  symmetry?:boolean;
  softRadius?:number;
  viewPreset?:ViewPreset;
  wireframe?:boolean;
  snap?:boolean;
  localSpace?:boolean;
  onFaceSelect?: (id:string|null,face:number|null,additive:boolean)=>void;
  vertexMode?: boolean;
  selectedVertexIndex?: number | null;
  geometryRevision?: number;
  onVertexSelect?: (id:string|null,index:number|null)=>void;
};
type ThreeContext = { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; controls: OrbitControls; transform: TransformControls; marker: THREE.Mesh; root: THREE.Group; scene: THREE.Scene; fit: () => void; setView:(preset:ViewPreset)=>void };

export default function Viewport({ root, selectedId, mode, focusToken, onSelect, onChange, vertexMode = false, selectedVertexIndex = null, geometryRevision = 0, onVertexSelect, faceMode=false, selectedFaces=[], onFaceSelect, onBeforeChange, linkedVertices=false, symmetry=false, softRadius=0, viewPreset="perspective",wireframe=false,snap=false,localSpace=false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<ThreeContext | null>(null);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);
  const onVertexSelectRef=useRef(onVertexSelect);
  const vertexState=useRef({enabled:vertexMode,selectedId,index:selectedVertexIndex});
  const editing=useRef({onBeforeChange,linkedVertices,symmetry,softRadius});
  editing.current={onBeforeChange,linkedVertices,symmetry,softRadius};
  const faceState=useRef({faceMode,onFaceSelect});
  faceState.current={faceMode,onFaceSelect};
  useEffect(() => { onSelectRef.current = onSelect; onChangeRef.current = onChange; onVertexSelectRef.current=onVertexSelect;vertexState.current={enabled:vertexMode,selectedId,index:selectedVertexIndex}; }, [onSelect, onChange, onVertexSelect, vertexMode, selectedId, selectedVertexIndex]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141d29');
    scene.fog = new THREE.Fog('#141d29', 28, 75);
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    let currentView:ViewPreset="perspective";
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
    transform.addEventListener('mouseDown',()=>{if(editing.current.onBeforeChange?.()===false)transform.enabled=false;});
    transform.addEventListener('mouseUp',()=>{transform.enabled=true;});
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
            moveVertex(object,v.index,local,editing.current.linkedVertices,editing.current.symmetry,editing.current.softRadius);
          }
        }
      }
      onChangeRef.current();
    });

    function fit() {
      const bounds = new THREE.Box3().setFromObject(root);
      const center=bounds.isEmpty()?new THREE.Vector3(0,.8,0):bounds.getCenter(new THREE.Vector3());
      const radius=bounds.isEmpty()?2:bounds.getBoundingSphere(new THREE.Sphere()).radius;
      const distance=Math.max(radius*3.4,3.5);
      const directions:Record<ViewPreset,THREE.Vector3>={perspective:new THREE.Vector3(.78,.46,.78),front:new THREE.Vector3(0,0,-1),back:new THREE.Vector3(0,0,1),left:new THREE.Vector3(-1,0,0),right:new THREE.Vector3(1,0,0),top:new THREE.Vector3(0,1,0),bottom:new THREE.Vector3(0,-1,0)};
      camera.up.set(0,1,0);if(currentView==='top')camera.up.set(0,0,-1);if(currentView==='bottom')camera.up.set(0,0,1);
      camera.position.copy(center).addScaledVector(directions[currentView],distance);
      if(camera instanceof THREE.OrthographicCamera){
        const aspect=Math.max(1,element!.clientWidth)/Math.max(1,element!.clientHeight),extent=Math.max(radius*1.3,1)/Math.min(aspect,1);
        camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.zoom=1;
      }
      controls.target.copy(center);camera.lookAt(center);camera.updateProjectionMatrix();controls.update();
    }
    function setView(preset:ViewPreset){
      currentView=preset;
      const aspect=Math.max(1,element!.clientWidth)/Math.max(1,element!.clientHeight);
      camera=preset==='perspective'?new THREE.PerspectiveCamera(45,aspect,.05,10000):new THREE.OrthographicCamera(-5*aspect,5*aspect,5,-5,.01,10000);
      controls.object=camera;controls.enableRotate=preset==='perspective';transform.camera=camera;
      if(ctxRef.current)ctxRef.current.camera=camera;fit();
    }
    ctxRef.current = { renderer, camera, controls, transform, marker, root, scene, fit, setView };
    fit();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    function onPointerDown(e: PointerEvent) { pointerDown = { x: e.clientX, y: e.clientY }; }
    function onPointerUp(e: PointerEvent) {
      if (e.button!==0 || !pointerDown || Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) return;
      if (transform.axis) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(root.children, true).find(i => {if(!(i.object instanceof THREE.Mesh))return false;let object:THREE.Object3D|null=i.object;while(object){if(!object.visible)return false;object=object.parent;}return true;});
      if(faceState.current.faceMode){
        faceState.current.onFaceSelect?.(hit?.object.uuid??null,hit?.faceIndex??null,e.shiftKey);
        return;
      }
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
      if(camera instanceof THREE.PerspectiveCamera)camera.aspect=width/height;else{camera.left=-camera.top*width/height;camera.right=camera.top*width/height;}
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(element);
    let raf = 0;
    function draw() {
      raf = requestAnimationFrame(draw);
      if(!element!.clientWidth||!element!.clientHeight)return;
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
    if(faceMode || (vertexMode&&selectedVertexIndex===null)){context.marker.visible=false;context.transform.detach();return;}
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
  }, [root, selectedId, vertexMode, selectedVertexIndex, geometryRevision, faceMode]);

  useEffect(() => {
    const object=selectedId?root.getObjectByProperty('uuid',selectedId):null;
    if(!faceMode || !selectedFaces.length || !(object instanceof THREE.Mesh))return;
    const source=object.geometry, position=source.getAttribute('position'), index=source.index;
    if(!position)return;
    const points:number[]=[];
    for(const selectedFace of selectedFaces)for(let corner=0;corner<3;corner++){
      if(selectedFace*3+corner >= (index?.count??position.count))continue;
      const i=index?index.getX(selectedFace*3+corner):selectedFace*3+corner;
      points.push(position.getX(i),position.getY(i),position.getZ(i));
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const material=new THREE.MeshBasicMaterial({color:0xffaa33,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const overlay=new THREE.Mesh(geometry,material); overlay.raycast=()=>{};object.updateWorldMatrix(true,false);overlay.matrixAutoUpdate=false;overlay.matrix.copy(object.matrixWorld);const scene=ctxRef.current?.scene;scene?.add(overlay);
    return()=>{scene?.remove(overlay);geometry.dispose();material.dispose();};
  },[root,selectedId,selectedFaces,faceMode,geometryRevision]);

  useEffect(()=>{ctxRef.current?.setView(viewPreset);},[viewPreset,root]);
  useEffect(()=>{
    const transform=ctxRef.current?.transform;if(!transform)return;
    transform.setTranslationSnap(snap?.1:null);transform.setRotationSnap(snap?Math.PI/12:null);transform.setScaleSnap(snap?.1:null);transform.setSpace(localSpace?'local':'world');
  },[snap,localSpace,root]);
  useEffect(()=>{
    const scene=ctxRef.current?.scene;if(!wireframe||!scene)return;
    const group=new THREE.Group();root.updateWorldMatrix(true,true);
    root.traverseVisible(object=>{if(object instanceof THREE.Mesh){
      const lines=new THREE.LineSegments(new THREE.WireframeGeometry(object.geometry),new THREE.LineBasicMaterial({color:0x82b6cc,transparent:true,opacity:.55,depthWrite:false}));
      lines.matrixAutoUpdate=false;lines.matrix.copy(object.matrixWorld);group.add(lines);
    }});scene.add(group);
    return()=>{scene.remove(group);group.traverse(o=>{if(o instanceof THREE.LineSegments){o.geometry.dispose();(o.material as THREE.Material).dispose();}});};
  },[root,wireframe,geometryRevision]);

  useEffect(() => { ctxRef.current?.transform.setMode(vertexMode?'translate':mode); }, [mode,vertexMode]);
  useEffect(() => { ctxRef.current?.fit(); }, [focusToken]);
  return <div ref={containerRef} className="viewport" aria-label="Edytor sceny 3D"/>;
}

