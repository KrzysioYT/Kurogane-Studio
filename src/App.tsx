import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import * as THREE from 'three';
import Viewport from './components/Viewport';
import FiveMWorkshop from './components/FiveMWorkshop';
import type { TransformMode } from './components/Viewport';
import { tools, sections } from './catalog';
import { clearModel, createDemoCar, prepareModel } from './lib/demo';
import { exportGLB, importModel, saveGLB } from './lib/io';

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

function getMaterial(mesh: THREE.Mesh | null): THREE.MeshStandardMaterial | null {
  if (!mesh || Array.isArray(mesh.material)) return null;
  return mesh.material instanceof THREE.MeshStandardMaterial ? mesh.material : null;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeToolId, setActiveToolId] = useState('vehicle-editor-v2');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<TransformMode>('translate');
  const [focusToken, setFocusToken] = useState(0);
  const [modelName, setModelName] = useState('Kurogane Concept');
  const [status, setStatus] = useState('Gotowy do pracy. Model demonstracyjny jest otwarty.');
  const [busy, setBusy] = useState(false);
  const [fiveMMode, setFiveMMode] = useState(false);
  const [leftTab, setLeftTab] = useState<'tools' | 'hierarchy'>('tools');
  const [dragActive, setDragActive] = useState(false);

  const selected = selectedId ? root.getObjectByProperty('uuid', selectedId) ?? null : null;
  const selectedMesh = selected instanceof THREE.Mesh ? selected : null;
  const mat = getMaterial(selectedMesh);
  const activeTool = tools.find(tool => tool.id === activeToolId) ?? tools[0];
  const parts = useMemo(() => allParts(root), [root, revision]);
  const meshes = useMemo(() => countMeshes(root), [root, revision]);
  const touch = useCallback(() => setRevision(n => n + 1), []);
  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const openFile = useCallback(async (file: File) => {
    setBusy(true);
    setStatus(`Importuję: ${file.name}…`);
    try {
      const object = await importModel(file);
      prepareModel(object);
      setSelectedId(null);
      clearModel(root);
      root.add(object);
      setModelName(file.name.replace(/\.[^.]*$/, ''));
      setActiveToolId('vehicle-editor-v2');
      setFocusToken(t => t + 1);
      touch();
      setStatus(`Zaimportowano ${file.name}. Pamiętaj: GLB ≠ gotowy YFT do FiveM.`);
    } catch (error) {
      setStatus(`Błąd importu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, [root, touch]);

  const fileChanged = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) await openFile(file);
  };

  const loadDemo = () => {
    setSelectedId(null);
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
    selected[prop][axis] = prop === 'rotation' ? THREE.MathUtils.degToRad(value) : value;
    touch();
  };

  const updateMaterial = (key: 'color' | 'metalness' | 'roughness', value: string | number) => {
    if (!selectedMesh || Array.isArray(selectedMesh.material)) return;
    // OBJ can have a non-PBR material; convert it on first edit.
    if (!(selectedMesh.material instanceof THREE.MeshStandardMaterial)) {
      const old = selectedMesh.material;
      const color = 'color' in old && old.color instanceof THREE.Color ? old.color.clone() : new THREE.Color('#7dbac6');
      selectedMesh.material = new THREE.MeshStandardMaterial({ color });
    }
    const material = selectedMesh.material as THREE.MeshStandardMaterial;
    if (key === 'color' && typeof value === 'string') material.color.set(value);
    if (key === 'metalness' && typeof value === 'number') material.metalness = value;
    if (key === 'roughness' && typeof value === 'number') material.roughness = value;
    material.needsUpdate = true;
    touch();
  };

  const applyTexture = async (file: File) => {
    if (!selectedMesh || Array.isArray(selectedMesh.material)) {
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
      if (!(selectedMesh.material instanceof THREE.MeshStandardMaterial)) {
        selectedMesh.material = new THREE.MeshStandardMaterial({ color: '#ffffff' });
      }
      const material = selectedMesh.material as THREE.MeshStandardMaterial;
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

  const renameSelected = (name: string) => {
    if (!selected) return;
    selected.name = name;
    touch();
  };

  const removeSelected = () => {
    if (!selected?.parent) return;
    selected.parent.remove(selected);
    selected.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      }
    });
    setSelectedId(null);
    touch();
    setStatus('Usunięto zaznaczony element ze sceny.');
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void openFile(file);
  };

  const toolList = tools.filter(tool => (tool.name + ' ' + tool.description).toLowerCase().includes(search.toLowerCase()));

  return <div className="shell" onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={onDrop}>
    <header className={fiveMMode ? "topbar fivem-topbar" : "topbar"}>
      <Brand />
      <div className="top-crumbs"><span>WORKSPACE</span><b>/</b><strong>{fiveMMode ? 'FiveM Add-on Builder' : activeTool.name}</strong><span className="edition">ALPHA 0.4.0</span></div>
      <div className="header-actions">
        <button className={"button workspace-toggle " + (fiveMMode ? "current" : "")} onClick={() => setFiveMMode(current => !current)}>{fiveMMode ? "← Edytor 3D" : "🚘 FiveM Add-on"}</button>
        <span className="local-pill"><span className="online-dot" /> LOCAL / WINDOWS</span>
        <button className="button ghost" onClick={loadDemo} disabled={busy}>↺ <span>Auto demonstracyjne</span></button>
        <button className="button secondary" onClick={() => fileRef.current?.click()} disabled={busy}>↥ <span>Importuj model</span></button>
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
            <button className="eye" title={object.visible ? 'Ukryj' : 'Pokaż'} onClick={() => { object.visible = !object.visible; touch(); }}>{object.visible ? '◉' : '○'}</button>
            <button className="hier-name" title={object.name} onClick={() => setSelectedId(object.uuid)}>▱ {object.name || 'Mesh'}</button>
          </div>)}
          {!parts.length && <p className="empty-hint">Zaimportuj model, by zobaczyć jego części.</p>}
        </div>}
      </aside>
      <main className={fiveMMode ? "addon-workspace" : "workspace"}>
        {fiveMMode ? <FiveMWorkshop /> : activeTool.stage === 'mvp' ? <>
          <div className="workspace-header">
            <div><div className="eyebrow">EDYTOR PRZESTRZENI 3D / BETA</div><h1>{modelName}</h1><p>Wybierz część pojazdu i edytuj geometrię, położenie lub materiał.</p></div>
            <div className="viewport-options"><span className="chip">◈ Perspektywa</span><button className="small-button" onClick={() => setFocusToken(t => t + 1)} title="Dopasuj widok (F)">⊡ Dopasuj</button></div>
          </div>
          <div className="viewport-wrap">
            <Viewport root={root} selectedId={selectedId} mode={mode} focusToken={focusToken} onSelect={select} onChange={touch} />
            <div className="viewport-label">SCENE VIEWPORT <span>● REALTIME</span></div>
            <div className="gizmo-buttons">
              {([['translate', '↔', 'W'], ['rotate', '⟳', 'E'], ['scale', '⤢', 'R']] as const).map(([value, symbol, shortcut]) =>
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
        </div>}
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
            </> : <p className="muted">Materiał typu PBR niedostępny. Wybierz pojedynczy mesh.</p>}
          </div>
          <div className="property-block"><button className="danger-button" onClick={removeSelected}>✕ Usuń wybrany element</button></div>
        </> : <div className="inspector-empty"><div className="orbit-illustration">◇</div><h3>Brak zaznaczenia</h3><p>Kliknij element modelu w widoku 3D lub wybierz go w zakładce Hierarchia.</p></div>}
        <div className="inspector-note"><div className="section-title">INFORMACJE</div><div className="stat-row"><span>Elementy 3D</span><strong>{meshes}</strong></div><div className="stat-row"><span>Format wyjścia</span><strong>GLB</strong></div><div className="stat-row"><span>Format GTA V</span><strong className="warning">W planie</strong></div></div>
      </aside>
    </div>
    <footer className="statusbar"><span className="status-left"><b>●</b> {status}</span><span className="status-right">KUROGANE STUDIO · 0.4.0 ALPHA <span>•</span> LOCAL-FIRST</span></footer>
  </div>;
}
