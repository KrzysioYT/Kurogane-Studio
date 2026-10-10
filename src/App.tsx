import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import * as THREE from 'three';
import Viewport from './components/Viewport';
import FiveMWorkshop from './components/FiveMWorkshop';
import type { ViewPreset } from './components/Viewport';
import type { TransformMode } from './components/Viewport';
import { tools, sections } from './catalog';
import { clearModel, createDemoCar, prepareModel } from './lib/demo';
import { exportGLB, importModel, saveGLB } from './lib/io';
import { createPrimitive, copyMesh, mirrorGeometry, recalcNormals, vertexCount, PRIMITIVE_KINDS } from './lib/geometry';
import ModelingPanel from './components/ModelingPanel';
import {SceneHistory} from './lib/history';
import {decodeProject,saveProject} from './lib/project';
import {moveVertex} from './lib/modeling';
import {createLogoDecal,loadLogoImage,createTextLogoTexture} from './lib/decal';
import {auditScene} from './lib/model-audit';
import type {AuditReport} from './lib/model-audit';
import type { PrimitiveKind } from './lib/geometry';

type Axis = 'x' | 'y' | 'z';
type TransformProp = 'position' | 'rotation' | 'scale';
const axes: Axis[] = ['x', 'y', 'z'];
const modeNames: Record<TransformMode, string> = { translate: 'Przesuwanie', rotate: 'Obracanie', scale: 'Skalowanie' };

function countMeshes(root: THREE.Group) {
  let count = 0;
  root.traverse(object => { if (object instanceof THREE.Mesh) count++; });
  return count;
}

function allParts(root: THREE.Group): { object: THREE.Object3D; depth: number }[] {
  const parts: { object: THREE.Object3D; depth: number }[] = [];
  function traverse(object: THREE.Object3D, depth: number) {
    if (object instanceof THREE.Mesh) parts.push({ object, depth });
    object.children.forEach(child => traverse(child, depth + 1));
  }
  root.children.forEach(child => traverse(child, 0));
  return parts;
}

function getMaterial(mesh:THREE.Mesh|null,index=0):THREE.MeshStandardMaterial|null{
  if(!mesh)return null;const mat=Array.isArray(mesh.material)?mesh.material[index]:mesh.material;
  return mat instanceof THREE.MeshStandardMaterial?mat:null;
}

function Brand() {
  return <div className="brand"><div className="brand-icon">K</div><div className="brand-words"><strong>KUROGANE</strong><span>STUDIO <i>DESKTOP</i></span></div></div>;
}

export default function App() {
  const root = useMemo(() => {
    const group = new THREE.Group();
    group.name = 'Kurogane Workspace';
    group.add(createDemoCar());
    return group;
  }, []);
  const appendImport=useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const logoRef=useRef<HTMLInputElement>(null);
  const [logoTexture,setLogoTexture]=useState<THREE.CanvasTexture|null>(null);
  const [logoMode,setLogoMode]=useState(false);
  const [logoSize,setLogoSize]=useState(.65);
  const [logoRotation,setLogoRotation]=useState(0);
  const [logoOpacity,setLogoOpacity]=useState(1);
  const [logoText,setLogoText]=useState('LSPD');
  const [textColor,setTextColor]=useState('#ffffff');
  const [auditResult,setAuditResult]=useState<{report:AuditReport;revision:number}|null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [faceMode,setFaceMode]=useState(false);
  const [faces,setFaces]=useState<number[]>([]);
  const history=useRef(new SceneHistory());
  const [linked,setLinked]=useState(true),[symmetric,setSymmetric]=useState(false),[softRadius,setSoftRadius]=useState(0);
  const [view,setView]=useState<ViewPreset>('perspective');
  const [wireframe,setWireframe]=useState(false),[snap,setSnap]=useState(false),[localSpace,setLocalSpace]=useState(false);
  const projectRef=useRef<HTMLInputElement>(null);
  const [vertexMode, setVertexMode] = useState(false);
  const [vertexIndex, setVertexIndex] = useState<number | null>(null);
  const [primitiveKind, setPrimitiveKind] = useState<PrimitiveKind>('cube');
  const [activeToolId, setActiveToolId] = useState('vehicle-editor-v2');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<TransformMode>('translate');
  const [focusToken, setFocusToken] = useState(0);
  const [modelName, setModelName] = useState('Kurogane Concept');
  const [status, setStatus] = useState('Gotowy do pracy. Model demonstracyjny jest otwarty.');
  const [busy, setBusy] = useState(false);
  const [fiveMMode, setFiveMMode] = useState(false);
  const [workshopOpened,setWorkshopOpened]=useState(false);
  const [leftTab, setLeftTab] = useState<'tools' | 'hierarchy'>('tools');
  const [dragActive, setDragActive] = useState(false);

  const selected = selectedId ? root.getObjectByProperty('uuid', selectedId) ?? null : null;
  const selectedMesh = selected instanceof THREE.Mesh ? selected : null;
  const [materialSlot,setMaterialSlot]=useState(0);
  const mat = getMaterial(selectedMesh,materialSlot);
  useEffect(()=>setMaterialSlot(0),[selectedId]);
  const activeTool = tools.find(tool => tool.id === activeToolId) ?? tools[0];
  const parts = useMemo(() => allParts(root), [root, revision]);
  const meshes = useMemo(() => countMeshes(root), [root, revision]);
  const touch = useCallback(() => setRevision(n => n + 1), []);
  const select = useCallback((id: string | null) => {setSelectedId(id);setVertexIndex(null);setFaces([]);}, []);
  const onVertexSelect = useCallback((id:string|null,index:number|null)=>{setSelectedId(id);setVertexIndex(index);},[]);

  const checkpoint=(label:string)=>{try{history.current.checkpoint(root,modelName,label);return true;}catch(error){setStatus(String(error));return false;}};
  const edit=(label:string,operation:()=>void)=>{
    try{if(!checkpoint(label))return;operation();setVertexIndex(null);touch();setStatus(label+' — gotowe.');}
    catch(error){setStatus(String(error));touch();}
  };
  const restore=(redo=false)=>{
    const name=history.current.restore(root,modelName,redo);
    if(name===null)return;
    setModelName(name);setSelectedId(null);setFaces([]);setVertexIndex(null);touch();setStatus(redo?'Ponowiono zmianę.':'Cofnięto zmianę.');
  };
  const saveWorkspace=async()=>{
    if(busy)return;setBusy(true);
    try{setStatus(await saveProject(root,modelName)?'Zapisano projekt .kurogane z geometrią, materiałami i ukrytymi częściami.':'Anulowano zapis.');}
    catch(error){setStatus(String(error));}finally{setBusy(false);}
  };
  const openWorkspace=async(file:File)=>{
    if(busy)return;setBusy(true);
    try{
      const project=await decodeProject(await file.arrayBuffer());if(!checkpoint('Otwórz projekt'))return;
      clearModel(root);for(const child of [...project.root.children])root.add(child);root.userData=project.root.userData;
      setModelName(project.name);setSelectedId(null);setFaces([]);setVertexIndex(null);setFocusToken(n=>n+1);touch();setStatus('Projekt otwarty.');
    }catch(error){setStatus(String(error));}finally{setBusy(false);}
  };
  const newWorkspace=()=>edit('Nowa scena',()=>{clearModel(root);root.userData={};setModelName('Nowy samochód');setSelectedId(null);setFaces([]);});

  const openFile = useCallback(async (file: File,append=false) => {
    setBusy(true);
    setStatus(`Importuję: ${file.name}…`);
    try {
      const object = await importModel(file);
      prepareModel(object);
      setSelectedId(null);setVertexIndex(null);setVertexMode(false);
      if(!checkpoint('Wczytaj scenę'))return;setFaceMode(false);setFaces([]);
      if(!append)clearModel(root);
      root.add(object);
      if(!append)setModelName(file.name.replace(/\.[^.]*$/, ''));
      setActiveToolId('vehicle-editor-v2');
      setFocusToken(t => t + 1);
      touch();
      setStatus(`Zaimportowano ${file.name}. Pamiętaj: GLB ≠ gotowy YFT do FiveM.`);
    } catch (error) {
      setStatus(`Błąd importu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, [root, touch, modelName]);

  const fileChanged = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) await openFile(file,appendImport.current);
  };

  const loadDemo = () => {
    setSelectedId(null);setVertexIndex(null);setVertexMode(false);
    if(!checkpoint('Wczytaj scenę'))return;setFaceMode(false);setFaces([]);
    clearModel(root);
    root.add(createDemoCar());
    setModelName('Kurogane Concept');
    setFocusToken(t => t + 1);
    touch();
    setStatus('Model demonstracyjny utworzony. Wszystkie jego części możesz modyfikować.');
  };

  const exportModel = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Przygotowuję plik GLB…');
    try {
      const buffer = await exportGLB(root);
      const result = await saveGLB(buffer, modelName);
      setStatus(result === 'saved' ? `Wyeksportowano ${(buffer.byteLength / 1024).toFixed(0)} KiB jako GLB.` : 'Anulowano zapis.');
    } catch (error) {
      setStatus(`Błąd eksportu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const updateTransform = (prop: TransformProp, axis: Axis, value: number) => {
    if (!selected || !Number.isFinite(value)) return;
    if(!checkpoint('Transformacja'))return;
    selected[prop][axis] = prop === 'rotation' ? THREE.MathUtils.degToRad(value) : value;
    touch();
  };

  const updateMaterial = (key:'color'|'metalness'|'roughness',value:string|number)=>{
    if(!selectedMesh)return;if(!checkpoint('Materiał'))return;
    const old=Array.isArray(selectedMesh.material)?selectedMesh.material[materialSlot]:selectedMesh.material;
    if(!old)return;
    const material=old instanceof THREE.MeshStandardMaterial?old:new THREE.MeshStandardMaterial({color:'color' in old&&old.color instanceof THREE.Color?old.color:0xffffff});
    if(Array.isArray(selectedMesh.material))selectedMesh.material[materialSlot]=material;else selectedMesh.material=material;
    if(key==='color'&&typeof value==='string')material.color.set(value);
    if(key==='metalness'&&typeof value==='number')material.metalness=value;
    if(key==='roughness'&&typeof value==='number')material.roughness=value;
    material.needsUpdate=true;touch();
  };

  const applyTexture = async (file: File) => {
    if (!selectedMesh) {
      setStatus('Zaznacz pojedynczy mesh, aby przypisać teksturę.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 32 * 1024 * 1024) {
      setStatus('Tekstura musi być PNG/JPG/WebP i mieć maksymalnie 32 MiB.');
      return;
    }
    if (!selectedMesh.geometry.hasAttribute('uv')) {
      setStatus('Wybrana część nie ma współrzędnych UV. Tekstura wymaga UV.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      if(!checkpoint('Tekstura'))return;
      const old=Array.isArray(selectedMesh.material)?selectedMesh.material[materialSlot]:selectedMesh.material;
      const material=old instanceof THREE.MeshStandardMaterial?old:new THREE.MeshStandardMaterial({color:'#ffffff'});
      if(Array.isArray(selectedMesh.material))selectedMesh.material[materialSlot]=material;else selectedMesh.material=material;
      material.map = texture;
      material.color.set('#ffffff');
      material.needsUpdate = true;
      touch();
      setStatus(`Tekstura ${file.name} została przypisana do: ${selectedMesh.name || 'mesh'}.`);
    } catch (error) {
      setStatus(`Błąd wczytywania tekstury: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const importLogo=async(file:File)=>{
    if(busy)return;
    setBusy(true);setStatus('Wczytuję logo i przygotowuję jego teksturę...');
    try{
      const texture=await loadLogoImage(file);
      setLogoTexture(texture);setLogoMode(true);
      setFaceMode(false);setVertexMode(false);setFaces([]);setVertexIndex(null);
      setStatus('Logo '+file.name+' gotowe. Kliknij część karoserii w widoku 3D.');
    }catch(error){setStatus('Nie można wczytać logo: '+String(error));}
    finally{setBusy(false);}
  };
  const makeTextMarking=()=>{
    try{
      const texture=createTextLogoTexture(logoText,textColor);
      setLogoTexture(texture);setLogoMode(true);
      setFaceMode(false);setVertexMode(false);setFaces([]);setVertexIndex(null);
      setStatus('Napis gotowy. Kliknij część karoserii w 3D, aby umieścić oznaczenie.');
    }catch(error){setStatus('Błąd oznaczenia: '+String(error));}
  };
  const placeLogo=(mesh:THREE.Mesh,point:THREE.Vector3,normal:THREE.Vector3)=>{
    if(!logoTexture){setStatus('Najpierw wczytaj logo PNG/JPG.');return;}
    if(!checkpoint('Dodano logo 3D'))return;
    try{
      const decal=createLogoDecal({mesh,point,normal},logoTexture,{
        width:logoSize,rotationDeg:logoRotation,opacity:logoOpacity
      });
      root.add(decal);
      setSelectedId(decal.uuid);
      setLogoMode(false);setFaces([]);setVertexIndex(null);touch();
      setStatus('Logo 3D dodane jako edytowalna część. Projekt/GLB zachowuje grafikę; to nie jest zapis YTD.');
    }catch(error){setStatus('Nie udało się umieścić logo: '+String(error));}
  };
  const checkGeometry=()=>{
    try{
      const report=auditScene(root);
      setAuditResult({report,revision});
      setStatus('Model Doctor: '+report.errors+' błędów krytycznych, '+report.warnings+' ostrzeżeń i '+report.triangles.toLocaleString('pl-PL')+' trójkątów.');
    }catch(error){setStatus('Nie udało się sprawdzić modelu: '+String(error));}
  };
  const addPrimitive = () => {
    if(!checkpoint('Dodaj bryłę'))return;
    const mesh=createPrimitive(primitiveKind);
    root.add(mesh);setVertexMode(false);setVertexIndex(null);setSelectedId(mesh.uuid);setFaces([]);setFaceMode(false);
    touch();setStatus('Dodano bryłę do sceny. Możesz teraz zmienić jej geometrię w trybie wierzchołków.');
  };
  const duplicateSelected = () => {
    if(!selectedMesh)return;
    if(!checkpoint('Duplikuj część'))return;
    const clone=copyMesh(selectedMesh);
    selectedMesh.parent?.add(clone);
    setSelectedId(clone.uuid);setFaces([]);setFaceMode(false);setVertexIndex(null);setVertexMode(false);touch();
    setStatus('Utworzono niezależną kopię wybranej części.');
  };
  const modifyGeometry = (action:'mirrorX'|'mirrorY'|'mirrorZ'|'normals') => {
    if(!selectedMesh)return;
    if(!checkpoint('Geometria'))return;
    if(action==='normals')recalcNormals(selectedMesh);
    else mirrorGeometry(selectedMesh,action==='mirrorX'?'x':action==='mirrorY'?'y':'z');
    touch();setStatus('Zaktualizowano geometrię. Zapisuj jako GLB, nie YFT.');
  };
  const updateVertex = (axis:Axis,value:number) => {
    if(!selectedMesh||vertexIndex===null)return;
    try {if(!checkpoint('Wierzchołek'))return;const target=new THREE.Vector3().fromBufferAttribute(selectedMesh.geometry.getAttribute('position'),vertexIndex);target[axis]=value;moveVertex(selectedMesh,vertexIndex,target,linked,symmetric,softRadius);touch();}
    catch(error){setStatus('Błąd wierzchołka: '+String(error));}
  };
  const renameSelected = (name: string) => {
    if (!selected) return;
    if(!checkpoint('Nazwa części'))return;
    selected.name = name;
    touch();
  };

  const removeSelected = () => {
    if (!selected?.parent) return;
    if(!checkpoint('Usuń część'))return;
    selected.parent.remove(selected);
    selected.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      }
    });
    setSelectedId(null);setVertexIndex(null);
    touch();
    setStatus('Usunięto zaznaczony element ze sceny.');
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if(file)void (file.name.endsWith('.kurogane')?openWorkspace(file):openFile(file));
  };

  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(target.closest('input,textarea,select,[contenteditable="true"]')||busy||fiveMMode)return;
      const key=event.key.toLowerCase(),command=event.ctrlKey||event.metaKey;
      if(command&&key==='z'){event.preventDefault();restore(event.shiftKey);return;}
      if(command&&key==='y'){event.preventDefault();restore(true);return;}
      if(command&&key==='s'){event.preventDefault();void saveWorkspace();return;}
      if(command&&key==='d'){event.preventDefault();duplicateSelected();return;}
      if(command||event.altKey)return;
      if(key==='w')setMode('translate');if(key==='e')setMode('rotate');if(key==='r')setMode('scale');
      if(key==='f')setFocusToken(n=>n+1);
      if(key==='delete'){event.preventDefault();removeSelected();}
      if(key==='escape'){setSelectedId(null);setVertexIndex(null);setFaces([]);setLogoMode(false);}
    };window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  });

  const toolList = tools.filter(tool => (tool.name + ' ' + tool.description).toLowerCase().includes(search.toLowerCase()));

  return <div className="shell" onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={onDrop}>
    <header className={fiveMMode ? "topbar fivem-topbar" : "topbar"}>
      <Brand />
      <div className="top-crumbs"><span>WORKSPACE</span><b>/</b><strong>{fiveMMode ? 'FiveM Add-on Builder' : activeTool.name}</strong><span className="edition">ALPHA 0.15.0</span></div>
      <div className="header-actions">
        <button className={"button workspace-toggle " + (fiveMMode ? "current" : "")} onClick={() => {setWorkshopOpened(true);setFiveMMode(current => !current);}}>{fiveMMode ? "← Edytor 3D" : "🚘 FiveM Add-on"}</button>
        <button className="button ghost" onClick={newWorkspace} disabled={busy}>Nowa scena</button>
        <button className="button secondary" onClick={()=>projectRef.current?.click()} disabled={busy}>Otwórz projekt</button>
        <button className="button secondary" onClick={()=>void saveWorkspace()} disabled={busy}>Zapisz projekt</button>
        <input type="file" hidden ref={projectRef} accept=".kurogane" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void openWorkspace(file);}}/>
        <span className="local-pill"><span className="online-dot" /> LOCAL / WINDOWS</span>
        <button className="button ghost" onClick={()=>{try{loadDemo();}catch(e){setStatus(String(e));}}} disabled={busy}>↺ <span>Auto demonstracyjne</span></button>
        <button className="button secondary" onClick={() => {appendImport.current=false;fileRef.current?.click();}} disabled={busy}>↥ <span>Importuj model</span></button>
        <button className="button secondary" disabled={busy} onClick={()=>{appendImport.current=true;fileRef.current?.click();}}>Dodaj model/część</button>
        <button className="button primary" onClick={() => void exportModel()} disabled={busy || meshes === 0}>⇩ <span>{busy ? 'Przetwarzanie…' : 'Eksportuj GLB'}</span></button>
        <input type="file" hidden ref={fileRef} accept=".glb,.gltf,.obj" onChange={event => void fileChanged(event)} />
      </div>
    </header>
    <div className={fiveMMode ? "main-grid addon-mode" : "main-grid"}>
      <aside className="sidebar">
        <div className="sidebar-tabs">
          <button className={leftTab === 'tools' ? 'tab active' : 'tab'} onClick={() => setLeftTab('tools')}>Narzędzia</button>
          <button className={leftTab === 'hierarchy' ? 'tab active' : 'tab'} onClick={() => setLeftTab('hierarchy')}>Hierarchia <small>{meshes}</small></button>
        </div>
        {leftTab === 'tools' ? <>
          <div className="search-wrap"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Szukaj narzędzi…" /></div>
          <div className="scroll-panel">
            {sections.map(section => {
              const sectionTools = toolList.filter(tool => tool.section === section);
              if (!sectionTools.length) return null;
              return <section key={section} className="tool-section"><div className="section-title">{section} <span>{sectionTools.length}</span></div>
                {sectionTools.map(tool => <button key={tool.id} className={'tool-row ' + (activeToolId === tool.id ? 'chosen' : '')} onClick={() => setActiveToolId(tool.id)}>
                  <span className="tool-icon">{tool.icon}</span><span className="tool-name">{tool.name}</span>
                  {tool.stage === 'mvp' ? <span className="tiny-badge">MVP</span> : <span className="soon-mark">·</span>}
                </button>)}
              </section>;
            })}
            {toolList.length === 0 && <p className="empty-hint">Brak wyników.</p>}
          </div>
          <footer className="sidebar-footer"><span>29 modułów na roadmapie</span><span>01 MVP</span></footer>
        </> : <div className="scroll-panel hierarchy-panel">
          <div className="section-title">ELEMENTY MODELU</div>
          {parts.map(({ object, depth }) => <div className={'hierarchy-row ' + (selectedId === object.uuid ? 'selected' : '')} key={object.uuid} style={{ paddingLeft: Math.min(12 + depth * 8, 48) }}>
            <button className="eye" title={object.visible ? 'Ukryj' : 'Pokaż'} onClick={() => edit('Widoczność',()=>{object.visible=!object.visible;})}>{object.visible ? '◉' : '○'}</button>
            <button className="hier-name" title={object.name} onClick={() => select(object.uuid)}>▱ {object.name || 'Mesh'}</button>
          </div>)}
          {!parts.length && <p className="empty-hint">Zaimportuj model, by zobaczyć jego części.</p>}
        </div>}
      </aside>
      <main className={fiveMMode ? "addon-workspace" : "workspace"}>
        {workshopOpened&&<div style={{display:fiveMMode?'contents':'none'}}><FiveMWorkshop /></div>}
        {!fiveMMode && (activeTool.stage === 'mvp' ? <>
          <div className="workspace-header">
            <div><div className="eyebrow">EDYTOR PRZESTRZENI 3D / BETA</div><h1>{modelName}</h1><p>Wybierz część pojazdu i edytuj geometrię, położenie lub materiał.</p></div>
            <div className="viewport-options"><select aria-label="Widok kamery" value={view} onChange={e=>setView(e.target.value as ViewPreset)}>{[['perspective','Perspektywa'],['front','Przód'],['back','Tył'],['left','Lewy'],['right','Prawy'],['top','Góra'],['bottom','Dół']].map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>
              <button className="small-button" onClick={()=>setWireframe(v=>!v)}>{wireframe?'Siatka ON':'Siatka'}</button>
              <button className="small-button" onClick={()=>setSnap(v=>!v)}>{snap?'Snap 0.1 m / 15°':'Snap OFF'}</button>
              <button className="small-button" onClick={()=>setLocalSpace(v=>!v)}>{localSpace?'Lokalne':'Świat'}</button><button className="small-button" onClick={() => setFocusToken(t => t + 1)} title="Dopasuj widok (F)">⊡ Dopasuj</button></div>
          </div>
          <div className="modeler-toolbar">
            <label>Nowa bryła <select aria-label="Rodzaj bryły" value={primitiveKind} onChange={event=>setPrimitiveKind(event.target.value as PrimitiveKind)}>
              {PRIMITIVE_KINDS.map(kind=><option key={kind.key} value={kind.key}>{kind.name}</option>)}
            </select></label>
            <button onClick={addPrimitive}>＋ Dodaj bryłę</button>
            <button disabled={!selectedMesh} onClick={duplicateSelected}>▣ Duplikuj część</button>
            <button className={logoMode?'is-active':''} disabled={!logoTexture} onClick={()=>{setLogoMode(v=>!v);setFaceMode(false);setVertexMode(false);setFaces([]);}}>◎ {logoMode?'Kliknij karoserię':'Logo na karoserii'}</button>
            <button className={vertexMode?'is-active':''} onClick={()=>{setFaceMode(false);setFaces([]);setVertexMode(v=>!v);setVertexIndex(null);setMode('translate')}} disabled={!selectedMesh}>
              {vertexMode?'● Wierzchołki ON':'○ Edycja wierzchołków'}
            </button>
            <button className={faceMode?'is-active':''} onClick={()=>{setFaceMode(v=>!v);setVertexMode(false);setFaces([]);setVertexIndex(null)}}>Ściany</button>
            <button onClick={checkGeometry}>⚕ Model Doctor</button>
            <button disabled={!history.current.canUndo} onClick={()=>restore()}>Cofnij</button>
            <button disabled={!history.current.canRedo} onClick={()=>restore(true)}>Ponów</button>
            <span>Projekt .kurogane / eksport GLB</span>
          </div>
          {auditResult&&<section className="model-doctor" aria-label="Wynik audytu geometrii">
            <div className="model-doctor-head">
              <strong>Model Doctor · kontrola siatki</strong>
              <span>{auditResult.report.parts} części · {auditResult.report.vertices.toLocaleString('pl-PL')} punktów · {auditResult.report.triangles.toLocaleString('pl-PL')} trójkątów</span>
              <span className={auditResult.report.errors?'model-doctor-danger':'model-doctor-ok'}>{auditResult.report.errors} błędów</span>
              <span>{auditResult.report.warnings} ostrzeżeń</span>
              <button onClick={()=>setAuditResult(null)}>Zamknij</button>
            </div>
            {auditResult.revision!==revision&&<p className="model-doctor-stale">Model zmienił się od ostatniego audytu. Kliknij Model Doctor ponownie, aby odświeżyć wyniki.</p>}
            <div className="model-doctor-list">
              {auditResult.report.issues.length===0&&<p>Nie wykryto problemów w zakresie kontrolowanych danych siatki.</p>}
              {auditResult.report.issues.map((diagnostic,i)=><button className={'model-doctor-issue '+diagnostic.severity} key={diagnostic.code+'-'+i}
                disabled={!diagnostic.meshId} onClick={()=>select(diagnostic.meshId)}>
                <strong>{diagnostic.severity==='error'?'BŁĄD':diagnostic.severity==='warning'?'UWAGA':'INFO'}</strong>
                <span>{diagnostic.meshName}: {diagnostic.message}</span>
              </button>)}
            </div>
            <small>To audyt geometrii GLB. Nie sprawdza działania w FiveM, riggingu, kolizji i poprawności natywnego YFT.</small>
          </section>}
          <div className="decal-toolbar">
            <button onClick={()=>logoRef.current?.click()}>↥ Wczytaj logo PNG / JPG</button>
            <input hidden type="file" ref={logoRef} accept="image/png,image/jpeg,image/webp" onChange={e=>{
              const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void importLogo(file);
            }}/>
            <label>Oznaczenie <input type="text" aria-label="Tekst oznaczenia" maxLength={100} value={logoText} onChange={e=>setLogoText(e.target.value)} placeholder="LSPD / 108"/></label>
            <label>Kolor <input type="color" aria-label="Kolor napisu" value={textColor} onChange={e=>setTextColor(e.target.value)}/></label>
            <button onClick={makeTextMarking}>Tłoczony napis 3D</button>
            <label>Szerokość (m) <input type="number" min=".025" max="10" step=".05" value={logoSize} onChange={e=>setLogoSize(Number(e.target.value))}/></label>
            <label>Obrót (°) <input type="number" min="-3600" max="3600" step="15" value={logoRotation} onChange={e=>setLogoRotation(Number(e.target.value))}/></label>
            <label>Krycie (%) <input type="range" min="5" max="100" step="5" value={logoOpacity*100} onChange={e=>setLogoOpacity(Number(e.target.value)/100)}/></label>
            <span>{logoTexture?'Logo gotowe: kliknij przycisk „Logo na karoserii”':'Importuj logo, aby zacząć.'}</span>
          </div>
          <div className="viewport-wrap">
            <Viewport root={root} selectedId={selectedId} mode={mode} focusToken={focusToken}
              surfaceMode={logoMode} onSurfaceHit={placeLogo}
              onSelect={select} onChange={touch} vertexMode={vertexMode} selectedVertexIndex={vertexIndex}
              geometryRevision={revision} onVertexSelect={onVertexSelect} faceMode={faceMode} selectedFaces={faces}
              onFaceSelect={(id,face,additive)=>{setSelectedId(id);setFaces(current=>face===null?[]:additive&&id===selectedId?(current.includes(face)?current.filter(f=>f!==face):[...current,face]):[face])}}
              onBeforeChange={()=>checkpoint('Manipulator')}
              linkedVertices={linked} symmetry={symmetric} softRadius={softRadius} viewPreset={view} wireframe={wireframe} snap={snap} localSpace={localSpace}/>
            <div className="viewport-label">SCENE VIEWPORT <span>● REALTIME</span></div>
            <div className="gizmo-buttons">
              {!vertexMode&&!faceMode&&([['translate', '↔', 'W'], ['rotate', '⟳', 'E'], ['scale', '⤢', 'R']] as const).map(([value, symbol, shortcut]) =>
                <button title={modeNames[value] + ' (' + shortcut + ')'} className={mode === value ? 'selected' : ''} key={value} onClick={() => setMode(value)}>{symbol}<small>{shortcut}</small></button>)}
            </div>
            <div className="viewport-bottom"><span>◌ Orbit: LPM poza modelem / ŚPM</span><span>⤢ Pan: PPM</span><span>⊕ Zoom: scroll</span></div>
            {dragActive && <div className="drop-overlay">Upuść plik GLB / OBJ / GLTF</div>}
          </div>
          <div className="help-row"><div><strong>⌘</strong> Skróty: <kbd>W</kbd> przesuwanie <kbd>E</kbd> obrót <kbd>R</kbd> skalowanie <kbd>F</kbd> dopasuj</div><span>GLB / OBJ / GLTF • bez eksportu YFT w tej wersji</span></div>
        </> : <div className="module-placeholder">
          <div className="placeholder-art">{activeTool.icon}</div><div className="eyebrow">ZAPLANOWANE / NIEZAIMPLEMENTOWANE</div>
          <h1>{activeTool.name}</h1><p>{activeTool.description}</p>
          <p className="muted">Moduł jest na roadmapie, ale nie ma jeszcze działającego silnika. Nie pokazujemy atrap przycisków jako gotowych funkcji.</p>
          <button className="button primary" onClick={() => setActiveToolId('vehicle-editor-v2')}>← Wróć do edytora 3D</button>
        </div>)}
      </main>
      <aside className="inspector">
        <div className="inspector-heading"><span>INSPEKTOR</span><span className="header-marker">PROPERTIES</span></div>
        {activeTool.stage === 'mvp' && selected ? <>
          <div className="property-block"><div className="eyebrow">ZAZNACZONY ELEMENT</div>
            <input className="name-field" value={selected.name} onChange={event => renameSelected(event.target.value)} aria-label="Nazwa elementu"/>
            <div className="object-class">◈ {selected.type} <span>{selected.visible ? 'Widoczny' : 'Ukryty'}</span></div>
          </div>
          {(['position', 'rotation', 'scale'] as TransformProp[]).map(prop => <div className="property-block" key={prop}>
            <h3>{prop === 'position' ? 'Pozycja' : prop === 'rotation' ? 'Obrót' : 'Skala'} <span>{prop === 'rotation' ? '°' : prop === 'position' ? 'm' : '×'}</span></h3>
            <div className="axis-row">{axes.map(axis => <label key={axis} className={'axis axis-' + axis}><span>{axis.toUpperCase()}</span><input type="number" step={prop === 'rotation' ? 1 : 0.1}
              value={Number((prop === 'rotation' ? THREE.MathUtils.radToDeg(selected.rotation[axis]) : selected[prop][axis]).toFixed(3))}
              onChange={event => updateTransform(prop, axis, Number(event.target.value))}/></label>)}</div>
          </div>)}
          <div className="property-block">
            <h3>Materiał</h3>
            {selectedMesh&&Array.isArray(selectedMesh.material)&&<select aria-label="Slot materiału" value={materialSlot} onChange={e=>setMaterialSlot(Number(e.target.value))}>{selectedMesh.material.map((m,i)=><option value={i} key={i}>{i}: {m.name||m.type}</option>)}</select>}
            {mat ? <><div className="color-row"><label>Kolor bazowy</label><input aria-label="Kolor bazowy" type="color" value={'#' + mat.color.getHexString()} onChange={event => updateMaterial('color', event.target.value)}/><code>#{mat.color.getHexString()}</code></div>
              <input hidden ref={textureRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void applyTexture(file);
              }}/>
              <button className="texture-button" onClick={() => textureRef.current?.click()}>↥ Wczytaj teksturę PNG / JPG</button>
              {mat.map && <div className="texture-hint">✓ Tekstura przypisana do elementu</div>}
              <label className="range-field"><span>Metaliczność <strong>{Math.round(mat.metalness * 100)}%</strong></span><input type="range" min="0" max="1" step="0.01" value={mat.metalness} onChange={event => updateMaterial('metalness', Number(event.target.value))}/></label>
              <label className="range-field"><span>Szorstkość <strong>{Math.round(mat.roughness * 100)}%</strong></span><input type="range" min="0" max="1" step="0.01" value={mat.roughness} onChange={event => updateMaterial('roughness', Number(event.target.value))}/></label>
            </> : <button onClick={()=>updateMaterial('color','#ffffff')}>Konwertuj wybrany materiał do PBR</button>}
          </div>
          {selectedMesh && <div className="property-block vertex-properties">
            <h3>Geometria 3D <span>{vertexCount(selectedMesh)} wierzchołków</span></h3>
            <label className="vertex-checkbox"><input type="checkbox" checked={linked} onChange={e=>setLinked(e.target.checked)}/>Łącz punkty w tym samym miejscu</label>
            <label className="vertex-checkbox"><input type="checkbox" checked={symmetric} onChange={e=>setSymmetric(e.target.checked)}/>Symetria lokalna X</label>
            <label className="model-field">Miękki promień<input type="number" min="0" max="100" step=".1" value={softRadius} onChange={e=>setSoftRadius(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
            <label className="vertex-checkbox">
              <input type="checkbox" checked={vertexMode} onChange={event=>{setFaceMode(false);setFaces([]);setVertexMode(event.target.checked);setVertexIndex(null);setMode('translate')}}/>
              Wybieraj wierzchołki myszką
            </label>
            {vertexMode && vertexIndex!==null && vertexIndex<vertexCount(selectedMesh) && <div className="vertex-editor">
              <div>Wierzchołek #{vertexIndex}</div>
              <div className="axis-row">{axes.map(axis=><label key={axis} className={'axis axis-'+axis}><span>{axis.toUpperCase()}</span>
                <input type="number" step="0.05" value={Number((selectedMesh.geometry.getAttribute('position') as THREE.BufferAttribute).getComponent(vertexIndex,axis==='x'?0:axis==='y'?1:2).toFixed(4))}
                  onChange={event=>updateVertex(axis,Number(event.target.value))}/></label>)}</div>
              <small>Przeciągnij pomarańczowy manipulator lub podaj współrzędne.</small>
            </div>}
            <div className="geometry-actions">
              <button onClick={()=>modifyGeometry('normals')}>Przelicz normalne</button>
              <button onClick={()=>modifyGeometry('mirrorX')}>Lustrzane X</button>
              <button onClick={()=>modifyGeometry('mirrorY')}>Lustrzane Y</button>
              <button onClick={()=>modifyGeometry('mirrorZ')}>Lustrzane Z</button>
            </div>
            <p className="muted">Edycja wierzchołków i brył zmienia model 3D. Eksport do GLB nie tworzy kompletnego pliku YFT do FiveM.</p>
          </div>}
          {selectedMesh&&<ModelingPanel key={selectedMesh.uuid} mesh={selectedMesh} revision={revision} faces={faces} setFaces={setFaces} faceMode={faceMode} edit={edit}/>}
          <div className="property-block"><button className="danger-button" onClick={removeSelected}>✕ Usuń wybrany element</button></div>
        </> : <div className="inspector-empty"><div className="orbit-illustration">◇</div><h3>Brak zaznaczenia</h3><p>Kliknij element modelu w widoku 3D lub wybierz go w zakładce Hierarchia.</p></div>}
        <div className="inspector-note"><div className="section-title">INFORMACJE</div><div className="stat-row"><span>Elementy 3D</span><strong>{meshes}</strong></div><div className="stat-row"><span>Format wyjścia</span><strong>GLB</strong></div><div className="stat-row"><span>Format GTA V</span><strong className="warning">W planie</strong></div></div>
      </aside>
    </div>
    <footer className="statusbar"><span className="status-left"><b>●</b> {status}</span><span className="status-right">KUROGANE STUDIO · 0.15.0 ALPHA <span>•</span> LOCAL-FIRST</span></footer>
  </div>;
}

