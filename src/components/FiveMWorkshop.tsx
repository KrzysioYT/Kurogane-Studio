import { useMemo, useRef, useState } from 'react';
import './FiveMWorkshop.css';
import type { ChangeEvent, DragEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { CLASSES, DEFAULTS, HANDLING_DEFINITIONS, PLATES, WHEELS } from '../fivem/types';
import type { Check, VehicleConfig } from '../fivem/types';
import { createAddonZip, generatedMetas, inferConfig, readAssets, validate } from '../fivem/builder';
import type { ImportedAssets } from '../fivem/builder';
import { fxManifest, vehicleNamesLua } from '../fivem/templates';

type Page = 'identity'|'physics'|'files'|'code';
const pages: {id:Page;label:string}[] = [
 {id:'identity',label:'01 · Pojazd'},
 {id:'physics',label:'02 · Handling'},
 {id:'files',label:'03 · Zasoby'},
 {id:'code',label:'04 · Wygenerowane pliki'},
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
 const fileRef=useRef<HTMLInputElement>(null);
 const checks=useMemo(()=>validate(data.assets,config),[data.assets,config]);
 const blockers=checks.filter(c=>c.level==='error').length;
 const warnings=checks.filter(c=>c.level==='warning').length;
 const models=data.assets.filter(f=>f.name.endsWith('.yft')&&!f.name.endsWith('_hi.yft'));
 const sourceMetas=data.assets.filter(f=>f.name.endsWith('.meta'));
 const streamFiles=data.assets.filter(f=>f.name.startsWith('stream/'));
 const change=(key:keyof VehicleConfig,value:string|boolean)=>{
   setConfig(previous=>({...previous,[key]:value}));
 };
 const choose=async(files:File[])=>{
   if(working||files.length===0)return;
   setWorking(true);setMessage('Wczytywanie zasobów pojazdu…');
   try {
     const imported=await readAssets(files);
     setData(imported);
     setConfig(previous=>inferConfig(imported.assets,{
       ...DEFAULTS,author:previous.author,description:previous.description,version:previous.version,
       keepExisting:previous.keepExisting,generateNames:previous.generateNames,handlingValues:{...DEFAULTS.handlingValues}
     }));
     setPage('identity');
     setMessage('Zaimportowano '+imported.assets.length+' plików. Sprawdź walidację przed eksportem.');
   } catch(error){
     setMessage('Błąd importu: '+String(error instanceof Error?error.message:error));
   } finally{setWorking(false);}
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
   if(working||blockers) return;
   setWorking(true);setMessage('Generuję addon FiveM...');
   try{
     const bytes=await createAddonZip(data.assets,config);
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
 const preview=useMemo(()=>{
   try{
     const metas=generatedMetas(data.assets,config);
     return {
       files:{'fxmanifest.lua':fxManifest(config,Object.keys(metas)),
         ...Object.fromEntries(Object.entries(metas).map(([k,v])=>['data/'+k,v])),
         ...(config.generateNames?{'vehicle_names.lua':vehicleNamesLua(config)}:{})},
       error:''
     };
   } catch(err){
     return {files:{} as Record<string,string>,error:String(err instanceof Error?err.message:err)};
   }
 },[data.assets,config]);
 const previewNames=Object.keys(preview.files);
 return <section className="addon-studio" onDrop={onDrop} onDragOver={onDrag} onDragLeave={(event)=>{event.preventDefault();event.stopPropagation();setDrop(false);}}>
  <div className="addon-head">
    <div><span className="eyebrow">KUROGANE STUDIO / FIVE M TOOLCHAIN</span>
      <h1>FiveM Vehicle Workshop <span>0.2 ALPHA</span></h1>
      <p>Od plików GTA do resource ZIP. Metadane, fizyka, manifest i walidacja — bez ręcznego XML.</p></div>
    <button className="button primary" disabled={working||blockers>0} onClick={()=>void exportZip()}>
      {working?'Przetwarzanie…':'⇩ Eksportuj addon ZIP'}
    </button>
  </div>
  <div className="addon-summary">
    <div><strong>{data.assets.length}</strong><span>zaimportowane pliki</span></div>
    <div><strong>{models.length}</strong><span>modele YFT</span></div>
    <div><strong>{sourceMetas.length}</strong><span>istniejące META</span></div>
    <div><strong className={blockers?'addon-danger':'addon-good'}>{blockers}</strong><span>błędy krytyczne</span></div>
    <div><strong className="addon-warn">{warnings}</strong><span>ostrzeżenia</span></div>
  </div>
  <div className="addon-columns">
    <div className="addon-primary">
      <div className={'addon-dropzone '+(drop?'dragging':'')}>
        <div className="drop-mark">⇧</div>
        <div><strong>Dodaj pliki pojazdu GTA V</strong><p>Wybierz ZIP addonu lub zaznacz razem .yft / .ytd / .meta. Możesz też przeciągnąć pliki tutaj.</p></div>
        <button className="button secondary" disabled={working} onClick={()=>fileRef.current?.click()}>Wybierz pliki</button>
        <input ref={fileRef} type="file" hidden multiple accept=".zip,.yft,.ytd,.ydr,.ybn,.ytyp,.ymap,.meta" onChange={onPick}/>
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
      {page==='files'&&<div className="addon-panel">
        <h2>Wczytane pliki</h2><p className="addon-help">Kurogane kopiuje oryginalne binaria GTA bez modyfikacji. Nie próbuje konwertować GLB do YFT.</p>
        {!data.assets.length&&<div className="addon-empty">Brak zasobów — importuj ZIP lub pliki pojazdu.</div>}
        {streamFiles.length>0&&<><h3>stream/</h3>{streamFiles.map(file=><div className="addon-file" key={file.name}><span>◈ {file.name}</span><small>{(file.bytes.length/1024/1024).toFixed(2)} MiB · {file.source}</small></div>)}</>}
        {sourceMetas.length>0&&<><h3>Importowane metadane</h3>{sourceMetas.map(file=><div className="addon-file" key={file.name}><span>≡ {file.name}</span><small>{(file.bytes.length/1024).toFixed(1)} KiB</small></div>)}</>}
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
          <span>└─ stream/ ({streamFiles.length} plików)</span>
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
