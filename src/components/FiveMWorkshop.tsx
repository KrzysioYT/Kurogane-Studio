import { useMemo, useRef, useState } from 'react';
import './FiveMWorkshop.css';
import type { ChangeEvent, DragEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { CLASSES, DEFAULTS, HANDLING_DEFINITIONS, PLATES, WHEELS } from '../fivem/types';
import type { Check, VehicleConfig } from '../fivem/types';
import { createAddonZip, generatedMetas, inferConfig, readAssets, validate } from '../fivem/builder';
import type { ImportedAssets } from '../fivem/builder';
import { vehicleNamesLua } from '../fivem/templates';
import { mergeVehicleManifest } from '../fivem/manifest';
import { readText, textEditable, updateFileText } from '../fivem/zip-project';
import type { VehicleAsset } from '../fivem/types';
import { pickRpfArchive } from '../fivem/rpf';
import TextureStudio from './TextureStudio';
import YftInspector from './YftInspector';

type Page = 'identity'|'physics'|'textures'|'model'|'files'|'code';
const pages: {id:Page;label:string}[] = [
 {id:'identity',label:'01 · Pojazd'},
 {id:'physics',label:'02 · Handling'},
 {id:'textures',label:'03 · Retexture / Loga'},
 {id:'model',label:'04 · Podgląd YFT 3D'},
 {id:'files',label:'05 · Zasoby'},
 {id:'code',label:'06 · Wygenerowane pliki'},
];
const empty:ImportedAssets={assets:[],warnings:[],ignored:0};
const toNumber = (value:string)=>Number(value);
function Field({label,value,onChange,hint,placeholder}:{
 label:string; value:string; onChange:(value:string)=>void;hint?:string;placeholder?:string;
}) {
 return <label className="addon-field"><span>{label}</span>
   <input value={value} placeholder={placeholder} onChange={event=>onChange(event.target.value)} />
   {hint&&<small>{hint}</small>}
 </label>;
}
function Option({label,value,options,onChange}:{
 label:string;value:string;options:string[];onChange:(v:string)=>void;
}) {
 return <label className="addon-field"><span>{label}</span>
   <select value={value} onChange={event=>onChange(event.target.value)}>
     {!options.includes(value)&&<option value={value}>{value} (import)</option>}
     {options.map(value=><option key={value} value={value}>{value}</option>)}
   </select>
 </label>;
}
function CheckLine({check}: {check:Check}) {
 return <div className={'addon-check addon-'+check.level}>
   <span>{check.level==='error'?'✕':check.level==='warning'?'!':'✓'}</span>{check.text}
 </div>;
}
export default function FiveMWorkshop(){
 const [page,setPage]=useState<Page>('identity');
 const [data,setData]=useState<ImportedAssets>(empty);
 const [config,setConfig]=useState<VehicleConfig>({...DEFAULTS,handlingValues:{...DEFAULTS.handlingValues}});
 const [working,setWorking]=useState(false);
 const [message,setMessage]=useState('');
 const [drop,setDrop]=useState(false);
 const [codeFile,setCodeFile]=useState('fxmanifest.lua');
 const [previewError,setPreviewError]=useState('');
 const [activeFile,setActiveFile]=useState<string|null>(null);
 const [editorText,setEditorText]=useState('');
 const [savedText,setSavedText]=useState('');
 const [editingError,setEditingError]=useState('');
 const [textureDirty,setTextureDirty]=useState(false);
 const [projectRevision,setProjectRevision]=useState(0);
 const replaceRef=useRef<HTMLInputElement>(null);
 const fileRef=useRef<HTMLInputElement>(null);
 const checks=useMemo(()=>validate(data.assets,config),[data.assets,config]);
 const blockers=checks.filter(c=>c.level==='error').length;
 const warnings=checks.filter(c=>c.level==='warning').length;
 const models=data.assets.filter(f=>f.name.endsWith('.yft')&&!f.name.endsWith('_hi.yft'));
 const sourceMetas=data.assets.filter(f=>f.name.endsWith('.meta'));
 const streamFiles=data.assets.filter(f=>f.name.startsWith('stream/'));
 const extraFiles=data.extraFiles??[];
 const allProjectFiles=[...data.assets,...extraFiles];
 const change=(key:keyof VehicleConfig,value:string|boolean)=>{
   setConfig(previous=>({...previous,[key]:value}));
 };
 const loadImported=(imported:ImportedAssets)=>{
   setData(imported);setTextureDirty(false);setProjectRevision(n=>n+1);
   setActiveFile(null);setEditorText('');setSavedText('');setEditingError('');
   setConfig(previous=>inferConfig(imported.assets,{
     ...DEFAULTS,author:previous.author,description:previous.description,version:previous.version,
     keepExisting:previous.keepExisting,generateNames:previous.generateNames,
     resource:imported.originalResource&&/^[a-z][a-z0-9_-]{0,63}$/i.test(imported.originalResource)
       ? imported.originalResource.toLowerCase():'',
     handlingValues:{...DEFAULTS.handlingValues}
   }));
   setPage('identity');
   setMessage('Otworzono projekt: '+imported.assets.length+' plików GTA i '+(imported.extraFiles?.length??0)+' dodatkowych plików. Zmiany pozostają lokalne do eksportu ZIP.');
 };
 const choose=async(files:File[])=>{
   if(working||files.length===0)return;
   if((textureDirty||editorText!==savedText) && !window.confirm('Masz niezapisane zmiany w projekcie. Otworzyć nowy ZIP i je utracić?'))return;
   setWorking(true);setMessage('Wczytywanie zasobów pojazdu…');
   try {
     // RPF must go through Rust so resource headers (RSC7) are rebuilt correctly.
     if(files.some(file=>file.name.toLowerCase().endsWith('.rpf'))){
       setMessage('Użyj przycisku Otwórz RPF7. Dialog Windows pozwala odczytać archiwum natywnie.');
       return;
     }
     loadImported(await readAssets(files));
   } catch(error){
     setMessage('Błąd importu: '+String(error instanceof Error?error.message:error));
   } finally{setWorking(false);}
 };
 const importRpf=async()=>{
   if(working)return;
   if((textureDirty||editorText!==savedText) && !window.confirm('Masz niezapisane zmiany w projekcie. Otworzyć nowy RPF i je utracić?'))return;
   setWorking(true);setMessage('Analizuję RPF7 i wyodrębniam pliki GTA...');
   try{
     const imported=await pickRpfArchive();
     if(imported)loadImported(imported);
     else setMessage('Anulowano wybór archiwum RPF.');
   }catch(error){
     setMessage('Błąd RPF: '+String(error instanceof Error?error.message:error));
   }finally{setWorking(false);}
 };
 const selectProjectFile=(file:VehicleAsset)=>{
   if(activeFile!==file.name && editorText!==savedText){
     setEditingError('Najpierw zapisz zmiany aktualnego pliku, aby ich nie utracić.');return;
   }
   setActiveFile(file.name);setEditingError('');
   if(!textEditable(file.name)){setEditorText('');setSavedText('');return;}
   try { const text=readText(file);setEditorText(text);setSavedText(text); }
   catch(error){setEditorText('');setSavedText('');setEditingError(String(error instanceof Error?error.message:error));}
 };
 const saveProjectFile=()=>{
   if(!activeFile || editorText===savedText)return;
   try{
     if(data.assets.some(file=>file.name===activeFile)){
       const updated=updateFileText(data.assets,activeFile,editorText);
       setData(prev=>({...prev,assets:updated}));
       if(activeFile.endsWith('.meta'))
         setConfig(previous=>inferConfig(updated,previous));
     } else {
       const updated=updateFileText(data.extraFiles??[],activeFile,editorText);
       setData(prev=>({...prev,extraFiles:updated}));
     }
     setSavedText(editorText);setEditingError('');
     setMessage('Zapisano zmiany '+activeFile+' w projekcie. Użyj Eksportuj addon ZIP, by utworzyć plik.');
   }catch(error){setEditingError(String(error instanceof Error?error.message:error));}
 };
 const replaceSelected=async(event:ChangeEvent<HTMLInputElement>)=>{
   const file=event.currentTarget.files?.[0];event.currentTarget.value='';
   if(!file || !activeFile)return;
   if(file.size>150*1024*1024){setEditingError('Plik większy niż 150 MiB.');return;}
   const target=allProjectFiles.find(item=>item.name===activeFile);
   if(!target)return;
   const oldExtension=target.name.split('.').pop()?.toLowerCase();
   const newExtension=file.name.split('.').pop()?.toLowerCase();
   if(oldExtension!==newExtension){setEditingError('Podmieniany plik musi mieć to samo rozszerzenie.');return;}
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(['yft','ytd'].includes(oldExtension??'')&&!['RSC7','RSC8'].includes(new TextDecoder().decode(bytes.subarray(0,4)))){
     setEditingError('Odmówiono podmiany: to nie wygląda na prawidłowy model/teksturę GTA (RSC7/RSC8).');return;
   }
   const updated:{name:string;bytes:Uint8Array;source:string}={...target,bytes,source:'Podmieniony: '+file.name};
   if(data.assets.some(item=>item.name===activeFile))
     setData(prev=>({...prev,assets:prev.assets.map(x=>x.name===activeFile?updated:x)}));
   else setData(prev=>({...prev,extraFiles:(prev.extraFiles??[]).map(x=>x.name===activeFile?updated:x)}));
   setEditingError('');selectProjectFile(updated);
   setMessage('Podmieniono '+activeFile+'. Wyeksportuj ZIP, aby otrzymać zmodyfikowany addon.');
 };
 const onPick=(event:ChangeEvent<HTMLInputElement>)=>{
   const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';
   void choose(files);
 };
 const onDrop=(event:DragEvent<HTMLElement>)=>{
   event.preventDefault();event.stopPropagation();setDrop(false);
   void choose(Array.from(event.dataTransfer.files));
 };
 const onDrag=(event:DragEvent<HTMLElement>)=>{event.preventDefault();event.stopPropagation();setDrop(true);};
 const exportZip=async()=>{
   if(working||blockers)return;
   if(textureDirty){setMessage('Najpierw zapisz teksturę w YTD w zakładce Retexture / Loga.');return;}
   if(editorText!==savedText){
     setMessage('Najpierw kliknij Zapisz w projekcie przy edytowanym pliku, potem eksportuj ZIP.');return;
   }
   setWorking(true);setMessage('Generuję addon FiveM...');
   try{
     const bytes=await createAddonZip(data.assets,config,data.extraFiles??[]);
     if(bytes.length>256*1024*1024)throw new Error('ZIP przekracza 256 MiB limit zapisu. Podziel resource na mniejsze części.');
     let saved=true;
     const name=config.resource+'.zip';
     if(isTauri()){
       saved=await invoke<boolean>('save_vehicle_zip',{fileName:name,bytes:Array.from(bytes)});
     }else{
       const blob=new Blob([Uint8Array.from(bytes)],{type:'application/zip'});
       const url=URL.createObjectURL(blob);
       const link=document.createElement('a');link.href=url;link.download=name;
       document.body.append(link);link.click();link.remove();
       window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
     }
     setMessage(saved?'Zapisano '+name+' ('+(bytes.length/1024/1024).toFixed(1)+' MiB). Możesz wgrać resource na serwer.':'Zapis anulowany.');
   }catch(error){setMessage('Błąd eksportu: '+String(error instanceof Error?error.message:error));}
   finally{setWorking(false);}
 };
 const updateYtd=(name:string,bytes:Uint8Array)=>{
   setData(previous=>({...previous,assets:previous.assets.map(file=>file.name===name?{...file,bytes,source:'YTD edytowany w Kurogane Studio'}:file)}));
   setMessage('Tekstura YTD zaktualizowana w pamięci projektu. Eksportuj ZIP, aby zapisać całe auto.');
 };
 const preview=useMemo(()=>{
   try{
     const metas=generatedMetas(data.assets,config);
     const original=(data.extraFiles??[]).find(file=>file.name.toLowerCase()==='fxmanifest.lua');
     const originalText=original?readText(original):undefined;
     const makeNames=config.generateNames && !(data.extraFiles??[]).some(file=>file.name.toLowerCase()==='vehicle_names.lua');
     return {
       files:{'fxmanifest.lua':mergeVehicleManifest(originalText,config,Object.keys(metas),makeNames),
         ...Object.fromEntries(Object.entries(metas).map(([k,v])=>['data/'+k,v])),
         ...(makeNames?{'vehicle_names.lua':vehicleNamesLua(config)}:{})},
       error:''
     };
   } catch(err){
     return {files:{} as Record<string,string>,error:String(err instanceof Error?err.message:err)};
   }
 },[data.assets,data.extraFiles,config]);
 const previewNames=Object.keys(preview.files);
 return <section className="addon-studio" onDrop={onDrop} onDragOver={onDrag} onDragLeave={(event)=>{event.preventDefault();event.stopPropagation();setDrop(false);}}>
  <div className="addon-head">
    <div><span className="eyebrow">KUROGANE STUDIO / FIVE M TOOLCHAIN</span>
      <h1>FiveM Vehicle Workshop <span>0.8 ALPHA</span></h1>
      <p>Import auta z ZIP lub RPF7, edycja handlingu i tekstur YTD, logotypy oraz eksport addonu.</p></div>
    <button className="button primary" disabled={working||blockers>0||editorText!==savedText||textureDirty} onClick={()=>void exportZip()}>
      {working?'Przetwarzanie…':'⇩ Eksportuj addon ZIP'}
    </button>
  </div>
  <div className="addon-summary">
    <div><strong>{data.assets.length}</strong><span>pliki GTA</span></div>
    <div><strong>{models.length}</strong><span>modele YFT</span></div>
    <div><strong>{sourceMetas.length}</strong><span>istniejące META</span></div>
    <div><strong className={blockers?'addon-danger':'addon-good'}>{blockers}</strong><span>błędy krytyczne</span></div>
    <div><strong className="addon-warn">{warnings}</strong><span>ostrzeżenia</span></div>
  </div>
  <div className="addon-columns">
    <div className="addon-primary">
      <div className={'addon-dropzone '+(drop?'dragging':'')}>
        <div className="drop-mark">⇧</div>
        <div><strong>Importuj pojazd GTA V</strong><p>Wrzuć ZIP gotowego resource, zachowaj jego dodatkowe pliki i skrypty, zmień ustawienia lub podmień zasoby, a następnie eksportuj. Możesz też otworzyć RPF7.</p></div>
        <div className="rpf-actions">
          <button className="button primary" disabled={working} onClick={()=>void importRpf()}>▣ Otwórz RPF7</button>
          <button className="button secondary" disabled={working} onClick={()=>fileRef.current?.click()}>Otwórz ZIP / pliki</button>
        </div>
        <input ref={fileRef} type="file" hidden multiple accept=".zip,.yft,.ytd,.ydr,.ydd,.ybn,.ytyp,.ymap,.ycd,.meta" onChange={onPick}/>
      </div>
      {message&&<div className="addon-message" role="status">{message}</div>}
      <div className="addon-tabs">{pages.map(p=><button key={p.id} className={page===p.id?'active':''} onClick={()=>setPage(p.id)}>{p.label}</button>)}</div>
      {page==='identity'&&<div className="addon-panel">
        <h2>Tożsamość pojazdu</h2><p className="addon-help">Model musi mieć nazwę identyczną ze spawnem. Nie zmieniaj spawnu na losowy, jeśli posiadasz już .yft.</p>
        <div className="addon-form-grid">
          <Field label="Spawn name" value={config.spawn} onChange={v=>change('spawn',v.toLowerCase())} hint="Identyczna nazwa jak plik .yft"/>
          <Field label="Nazwa resource" value={config.resource} onChange={v=>change('resource',v.toLowerCase())} hint="Folder addonu do resources/[cars]"/>
          <Field label="Nazwa pojazdu" value={config.displayName} onChange={v=>change('displayName',v)} />
          <Field label="Marka (GXT)" value={config.make} onChange={v=>change('make',v.toUpperCase())}/>
          <Field label="Handling ID" value={config.handling} onChange={v=>change('handling',v.toUpperCase())}/>
          <Field label="Texture dictionary (TXD)" value={config.texture} onChange={v=>change('texture',v.toLowerCase())}/>
          <Field label="Dźwięk silnika GTA" value={config.audio} onChange={v=>change('audio',v.toUpperCase())} hint="Nazwa istniejącego zestawu audio GTA V"/>
          <Field label="Układ foteli" value={config.layout} onChange={v=>change('layout',v.toUpperCase())} hint="Np. LAYOUT_STANDARD"/>
          <Option label="Klasa pojazdu" value={config.vehicleClass} options={CLASSES} onChange={v=>change('vehicleClass',v)}/>
          <Option label="Rodzaj felg" value={config.wheelType} options={WHEELS} onChange={v=>change('wheelType',v)}/>
          <Option label="Tablice rejestracyjne" value={config.plateType} options={PLATES} onChange={v=>change('plateType',v)}/>
          <Option label="Typ pojazdu" value={config.vehicleType} options={['VEHICLE_TYPE_CAR']} onChange={v=>change('vehicleType',v)}/>
          <Field label="Flagi pojazdu" value={config.flags} onChange={v=>change('flags',v.toUpperCase())} hint="Np. FLAG_SPORTS FLAG_HAS_LIVERY"/>
          <Field label="Wersja resource" value={config.version} onChange={v=>change('version',v)}/>
          <Field label="Autor" value={config.author} onChange={v=>change('author',v)}/>
          <Field label="Opis" value={config.description} onChange={v=>change('description',v)}/>
        </div>
        <div className="addon-toggles">
          <label><input type="checkbox" checked={config.keepExisting} onChange={e=>change('keepExisting',e.target.checked)}/> Zachowuj zaawansowane właściwości istniejących plików META (tuning, syreny, układ).</label>
          <label><input type="checkbox" checked={config.generateNames} onChange={e=>change('generateNames',e.target.checked)}/> Generuj vehicle_names.lua (nazwy wyświetlane w GTA).</label>
        </div>
      </div>}
      {page==='physics'&&<div className="addon-panel">
        <h2>Handling — fizyka pojazdu</h2>
        <p className="addon-help">Zmiany zapisują się do handling.meta w ZIP. Wartości silnika GTA nie zawsze oznaczają rzeczywistą prędkość w km/h. Unikaj skrajnych parametrów.</p>
        <div className="addon-form-grid">
          {HANDLING_DEFINITIONS.map(def=><label className="addon-field" key={def.key}>
            <span>{def.label}</span>
            <input type="number" min={def.min} max={def.max} step={def.step} value={config.handlingValues[def.key]}
             onChange={event=>{
               const value=toNumber(event.target.value);
               setConfig(previous=>({...previous,handlingValues:{...previous.handlingValues,[def.key]:value}}));
             }}/>
            <small>Dozwolony zakres: {def.min} – {def.max}</small>
          </label>)}
        </div>
        <button className="button secondary" onClick={()=>setConfig(p=>({...p,handlingValues:{...DEFAULTS.handlingValues}}))}>Przywróć bazowy handling</button>
      </div>}
      <div style={{display:page==='textures'?'block':'none'}}>
        <TextureStudio key={projectRevision} files={data.assets} onUpdate={updateYtd} onDirtyChange={setTextureDirty}/>
      </div>
      <div style={{display:page==='model'?'block':'none'}}><YftInspector key={projectRevision} files={data.assets}/></div>
      {page==='files'&&<div className="addon-panel">
        <h2>Pliki projektu addonu</h2><p className="addon-help">Otwarty ZIP nie jest nadpisywany. Możesz zmieniać pliki tekstowe, podmieniać binaria i eksportować nowy ZIP. Oryginalnych plików modelu YFT nie modyfikujemy geometrycznie.</p>
        <div className="addon-message">Załadowano {allProjectFiles.length} plików, w tym {extraFiles.length} plików dodatkowych. {extraFiles.some(f=>/\\.(lua|js)$/i.test(f.name))?'Uwaga: paczka zawiera skrypty — sprawdź ich bezpieczeństwo przed instalacją na serwerze.':''}</div>
        {!data.assets.length&&<div className="addon-empty">Brak zasobów — importuj ZIP lub pliki pojazdu.</div>}
        {streamFiles.length>0&&<><h3>stream/</h3>{streamFiles.map(file=><button className={'addon-file addon-file-button '+(activeFile===file.name?'file-active':'')} onClick={()=>selectProjectFile(file)} key={file.name}><span>◈ {file.name}</span><small>{(file.bytes.length/1024/1024).toFixed(2)} MiB</small></button>)}</>}
        {sourceMetas.length>0&&<><h3>Importowane metadane</h3>{sourceMetas.map(file=><button className={'addon-file addon-file-button '+(activeFile===file.name?'file-active':'')} onClick={()=>selectProjectFile(file)} key={file.name}><span>≡ {file.name}</span><small>{(file.bytes.length/1024).toFixed(1)} KiB</small></button>)}</>}
        {extraFiles.length>0&&<><h3>Dodatkowe pliki oryginalnego addonu ({extraFiles.length})</h3>
           {extraFiles.map(file=><button className={'addon-file addon-file-button '+(activeFile===file.name?'file-active':'')} onClick={()=>selectProjectFile(file)} key={file.name}>
             <span>▤ {file.name}</span><small>{(file.bytes.length/1024).toFixed(1)} KiB</small></button>)}</>}
        {activeFile&&<div className="addon-editor">
          <h3>Edytor pliku: {activeFile}</h3>
          <div className="addon-editor-toolbar">
            <button className="button secondary" onClick={()=>replaceRef.current?.click()}>↥ Podmień plik</button>
            <input type="file" ref={replaceRef} hidden onChange={event=>void replaceSelected(event)}/>
            {textEditable(activeFile)&&<button className="button primary" disabled={editorText===savedText} onClick={saveProjectFile}>Zapisz w projekcie</button>}
          </div>
          {editingError&&<div className="addon-check addon-error">{editingError}</div>}
          {textEditable(activeFile) && !editingError &&
            <textarea className="addon-text-editor" spellCheck={false} value={editorText} onChange={event=>setEditorText(event.target.value)} rows={14} />}
          {!textEditable(activeFile)&&<p className="addon-help">Plik binarny: można go podmienić, ale nie edytować tekstowo.</p>}
          {editorText!==savedText&&<p className="addon-unsaved">Masz niezapisane zmiany tego pliku. Kliknij „Zapisz w projekcie”.</p>}
        </div>}
        {data.warnings.map(text=><div className="addon-message" key={text}>{text}</div>)}
      </div>}
      {page==='code'&&<div className="addon-panel">
        <h2>Podgląd generowanych plików</h2>
        <p className="addon-help">Metadane generowane na bieżąco z formularza. Jeśli importowałeś własne META, zachowamy ich nieedytowane sekcje (gdy aktywna jest opcja zachowania).</p>
        {preview.error||previewError?<div className="addon-check addon-error">{preview.error||previewError}</div>:null}
        <div className="addon-code-tabs">{previewNames.map(name=><button className={codeFile===name?'active':''} key={name} onClick={()=>{setCodeFile(name);setPreviewError('');}}>{name}</button>)}</div>
        <pre className="addon-code">{preview.files[codeFile]??preview.files[previewNames[0]]??'Nie ma dostępnego podglądu.'}</pre>
      </div>}
    </div>
    <aside className="addon-secondary">
      <div className="addon-card">
        <div className="addon-card-title">Walidacja addonu <span>{blockers===0?'● GOTOWOŚĆ WARUNKOWA':'● WYMAGA POPRAWEK'}</span></div>
        <div className="addon-checks">{checks.map((check,i)=><CheckLine key={i} check={check}/>)}</div>
      </div>
      <div className="addon-card"><div className="addon-card-title">Co otrzymasz?</div>
        <div className="addon-tree">
          <b>📦 {config.resource||'resource'}/</b>
          <span>├─ fxmanifest.lua</span>
          {config.generateNames&&<span>├─ vehicle_names.lua</span>}
          <span>├─ data/</span>
          <span>│　├─ vehicles.meta</span><span>│　├─ handling.meta</span>
          <span>│　├─ carvariations.meta</span>
          {config.keepExisting&&sourceMetas.some(f=>f.name==='data/carcols.meta')&&<span>│　└─ carcols.meta</span>}
          <span>├─ stream/ ({streamFiles.length} plików)</span>
          {extraFiles.length>0&&<span>└─ + {extraFiles.length} zachowanych plików i folderów</span>}
        </div>
        <div className="addon-command">server.cfg: <code>ensure {config.resource||'resource'}</code></div>
      </div>
      <div className="addon-card addon-caution">
        <b>Istotne ograniczenie</b>
        <p>Walidacja sprawdza pliki, spójność nazw i podstawowe metadane, ale nie zastępuje testu w FiveM. Nie tworzymy kości, kolizji, LOD-ów, skryptów ELS ani działających modkitów z powietrza.</p>
      </div>
      <button className="button primary addon-export-bottom" disabled={working||blockers>0} onClick={()=>void exportZip()}>⇩ Eksportuj gotowy resource .zip</button>
    </aside>
  </div>
 </section>;
}
