import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import type { VehicleAsset } from '../fivem/types';
import './TextureStudio.css';

type Entry = { name:string;width:number;height:number;format:string;levels:number };
type PaintTool = 'brush'|'eraser'|'text'|'logo';
type Props = { files:VehicleAsset[];onUpdate:(filename:string,bytes:Uint8Array)=>void;onDirtyChange:(dirty:boolean)=>void };
const dataURI = (base64:string)=>'data:image/png;base64,'+base64;
const bytesOf=(buffer:Uint8Array)=>Array.from(buffer);
const canvasPNG=(canvas:HTMLCanvasElement)=>new Promise<Uint8Array>((resolve,reject)=>{
 canvas.toBlob(async blob=>{
   if(!blob){reject(new Error('Canvas nie wygenerował PNG.'));return;}
   resolve(new Uint8Array(await blob.arrayBuffer()));
 },'image/png');
});
const imageFrom=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
 const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Nie można wczytać obrazu PNG'));image.src=src;
});
export default function TextureStudio({files,onUpdate,onDirtyChange}:Props){
 const [filename,setFilename]=useState('');
 const [textures,setTextures]=useState<Entry[]>([]);
 const [selected,setSelected]=useState('');
 const [tool,setTool]=useState<PaintTool>('brush');
 const [color,setColor]=useState('#ffffff');
 const [size,setSize]=useState(12);
 const [label,setLabel]=useState('LSPD');
 const [font,setFont]=useState(58);
 const [zoom,setZoom]=useState(100);
 const [status,setStatus]=useState('Wybierz plik YTD, aby odczytać tekstury GTA V.');
 const [loading,setLoading]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [undo,setUndo]=useState<ImageData[]>([]);
 const [redo,setRedo]=useState<ImageData[]>([]);
 const [logo,setLogo]=useState<HTMLImageElement|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 const drawing=useRef(false);
 const logoRef=useRef<HTMLInputElement>(null);
 const lastSelection=useRef(0);
 const entries=files.filter(f=>f.name.toLowerCase().endsWith('.ytd'));

 const clearPaint=()=>{
   setUndo([]);setRedo([]);setDirty(false);drawing.current=false;
 };
 const openYtd=async(name:string)=>{
   if(dirty&&!window.confirm('Masz niezapisane zmiany tekstury. Porzucić je?'))return;
   setFilename(name);setSelected('');setTextures([]);clearPaint();
   if(!name)return;
   const file=files.find(f=>f.name===name);
   if(!file)return;
   if(!isTauri()){setStatus('Natywny edytor YTD wymaga aplikacji Windows Tauri.');return;}
   setLoading(true);setStatus('Odczytuję słownik tekstur GTA V...');
   try{
     const list=await invoke<Entry[]>('ytd_list',{bytes:bytesOf(file.bytes)});
     setTextures(list);setStatus('Odczytano '+list.length+' tekstur. Wybierz element do malowania.');
     if(list.length)await selectTexture(name,list[0].name);
   }catch(e){setStatus('Błąd odczytu YTD: '+String(e));}
   finally{setLoading(false);}
 };
 const selectTexture=async(fileName:string,name:string)=>{
   if(dirty&&!window.confirm('Masz niezapisane zmiany. Porzucić je?'))return;
   const file=files.find(f=>f.name===fileName);
   if(!file||!isTauri())return;
   const ticket=++lastSelection.current;
   setSelected(name);setLoading(true);clearPaint();
   setStatus('Dekoduję '+name+' z YTD...');
   try{
     const base64=await invoke<string>('ytd_png',{bytes:bytesOf(file.bytes),textureName:name});
     const image=await imageFrom(dataURI(base64));
     if(ticket!==lastSelection.current)return;
     const target=canvas.current;
     if(!target)throw new Error('Brak powierzchni Canvas');
     target.width=image.naturalWidth;target.height=image.naturalHeight;
     const ctx=target.getContext('2d',{willReadFrequently:true});
     if(!ctx)throw new Error('Nie można zainicjalizować edytora 2D.');
     ctx.clearRect(0,0,target.width,target.height);
     ctx.drawImage(image,0,0);
     setStatus('Edytujesz '+name+' — '+target.width+'×'+target.height+' px. Zapis zastąpi tylko tę teksturę w YTD.');
   }catch(e){setStatus('Błąd dekodowania: '+String(e));}
   finally{if(ticket===lastSelection.current)setLoading(false);}
 };
 const context=()=>canvas.current?.getContext('2d',{willReadFrequently:true})??null;
 const checkpoint=()=>{
   const cv=canvas.current,ctx=context();if(!cv||!ctx)return;
   const copy=ctx.getImageData(0,0,cv.width,cv.height);
   setUndo(old=>[...old.slice(-((cv.width*cv.height>2048*2048)?1:7)),copy]);
   setRedo([]);setDirty(true);
 };
 const history=(direction:'undo'|'redo')=>{
   const cv=canvas.current,ctx=context();if(!cv||!ctx)return;
   if(direction==='undo'){
     const previous=undo[undo.length-1];if(!previous)return;
     setRedo(list=>[...list,ctx.getImageData(0,0,cv.width,cv.height)]);
     setUndo(list=>list.slice(0,-1));ctx.putImageData(previous,0,0);
   }else{
     const next=redo[redo.length-1];if(!next)return;
     setUndo(list=>[...list,ctx.getImageData(0,0,cv.width,cv.height)]);
     setRedo(list=>list.slice(0,-1));ctx.putImageData(next,0,0);
   }setDirty(true);
 };
 const coords=(event:PointerEvent<HTMLCanvasElement>)=>{
   const rect=event.currentTarget.getBoundingClientRect();
   return {x:(event.clientX-rect.left)*event.currentTarget.width/rect.width,
     y:(event.clientY-rect.top)*event.currentTarget.height/rect.height};
 };
 const stamp=(x:number,y:number,move:boolean)=>{
   const ctx=context();if(!ctx)return;
   if(tool==='eraser')ctx.globalCompositeOperation='destination-out';
   else ctx.globalCompositeOperation='source-over';
   ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;
   if(!move){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.02,y+.02);ctx.stroke();}
   else {ctx.lineTo(x,y);ctx.stroke();}
   ctx.globalCompositeOperation='source-over';
 };
 const pointerDown=(event:PointerEvent<HTMLCanvasElement>)=>{
   if(loading||!selected)return;
   const {x,y}=coords(event),ctx=context();
   if(!ctx)return;
   checkpoint();
   if(tool==='text'){
     ctx.globalCompositeOperation='source-over';ctx.fillStyle=color;ctx.font='bold '+font+'px Arial, sans-serif';
     ctx.textBaseline='top';ctx.fillText(label,x,y);return;
   }
   if(tool==='logo'){
     if(!logo){setStatus('Najpierw wybierz PNG logo przyciskiem Importuj logo.');return;}
     const width=Math.max(8,size*12);
     const height=width*logo.naturalHeight/logo.naturalWidth;
     ctx.globalCompositeOperation='source-over';ctx.drawImage(logo,x,y,width,height);return;
   }
   drawing.current=true;event.currentTarget.setPointerCapture(event.pointerId);stamp(x,y,false);
 };
 const pointerMove=(event:PointerEvent<HTMLCanvasElement>)=>{
   if(!drawing.current||!(tool==='brush'||tool==='eraser'))return;
   const {x,y}=coords(event);stamp(x,y,true);
 };
 const pointerStop=()=>{drawing.current=false;context()?.closePath();};
 const readLogo=async(event:ChangeEvent<HTMLInputElement>)=>{
   const file=event.currentTarget.files?.[0];event.currentTarget.value='';
   if(!file)return;
   if(file.size>8*1024*1024){setStatus('Logo przekracza 8 MiB.');return;}
   const url=URL.createObjectURL(file);
   try{setLogo(await imageFrom(url));setTool('logo');setStatus('Logo gotowe. Kliknij miejsce na teksturze.');}
   catch(e){setStatus('Błąd logo: '+String(e));}
   finally{URL.revokeObjectURL(url);}
 };
 const save=async()=>{
   if(!filename||!selected||!canvas.current||loading)return;
   const source=files.find(f=>f.name===filename);
   if(!source)return;
   setLoading(true);setStatus('Koduję PNG do GTA YTD, aktualizuję mipmapy i sprawdzam zapis...');
   try{
     const png=await canvasPNG(canvas.current);
     const result=await invoke<number[]>('ytd_replace_png',{
       bytes:bytesOf(source.bytes),textureName:selected,pngBytes:bytesOf(png)
     });
     onUpdate(filename,Uint8Array.from(result));
     setDirty(false);setUndo([]);setRedo([]);
     setStatus('Zapisano YTD do projektu. Kliknij Eksportuj addon ZIP w głównym warsztacie.');
   }catch(e){setStatus('Błąd zapisu YTD: '+String(e));}
   finally{setLoading(false);}
 };
 // Clearing stale paint state on unmount. The source ZIP stays untouched until export.
 useEffect(()=>()=>{lastSelection.current++;},[]);
 useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
 const current=textures.find(t=>t.name===selected);
 return <section className="texture-studio">
   <div className="texture-heading"><div><h2>Retexture & Logo Studio <small>NATYWNE YTD</small></h2>
     <p>Maluj po teksturze GTA V, dodawaj napisy i grafiki. Program zapisuje zmienione YTD bez usuwania innych tekstur.</p></div>
     <button className="button primary" disabled={!dirty||loading} onClick={()=>void save()}>
       {loading?'Przetwarzanie…':'Zapisz teksturę w YTD'}
     </button>
   </div>
   <div className="texture-picker">
     <label>Plik tekstur GTA V
       <select value={filename} onChange={e=>void openYtd(e.target.value)} disabled={loading}>
         <option value="">— wybierz plik .ytd z projektu —</option>
         {entries.map(f=><option key={f.name} value={f.name}>{f.name}</option>)}
       </select>
     </label>
     <label>Tekstura wewnątrz YTD
       <select value={selected} onChange={e=>void selectTexture(filename,e.target.value)} disabled={loading||!textures.length}>
         {textures.map(t=><option key={t.name} value={t.name}>{t.name} ({t.width}×{t.height})</option>)}
       </select>
     </label>
   </div>
   {!entries.length&&<p className="texture-notice">Najpierw wczytaj ZIP pojazdu zawierający <code>.ytd</code>. Możesz też zaimportować samą teksturę YTD w FiveM Add-on.</p>}
   <div className="texture-tools">
     {([['brush','Pędzel'],['eraser','Gumka'],['text','Tekst'],['logo','Logo PNG']] as const).map(([key,title])=>
       <button key={key} className={tool===key?'active':''} onClick={()=>setTool(key)}>{title}</button>)}
     <label>Kolor <input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
     <label>Rozmiar <input type="range" min="1" max="160" value={size} onChange={e=>setSize(Number(e.target.value))}/><b>{size}</b></label>
     {tool==='text'&&<><input className="texture-text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Napis"/>
       <label>Font <input type="number" min="8" max="300" value={font} onChange={e=>setFont(Math.max(8,Math.min(300,Number(e.target.value))))}/></label></>}
     {tool==='logo'&&<><button onClick={()=>logoRef.current?.click()}>Importuj logo</button><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={logoRef} onChange={e=>void readLogo(e)}/></>}
     <button onClick={()=>history('undo')} disabled={!undo.length}>↶ Cofnij</button>
     <button onClick={()=>history('redo')} disabled={!redo.length}>↷ Ponów</button>
     <label>Zoom <input type="range" min="25" max="200" step="25" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><b>{zoom}%</b></label>
   </div>
   <div className="texture-canvas-frame"><div className="texture-canvas-scroll">
     <canvas ref={canvas} className="texture-canvas" style={{width:current?current.width*zoom/100:400,height:current?current.height*zoom/100:270,
       cursor:tool==='text'||tool==='logo'?'crosshair':'cell'}}
       onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerStop}
       onPointerCancel={pointerStop} onLostPointerCapture={pointerStop}/>
     {!selected&&<div className="texture-canvas-placeholder">Wybierz teksturę, aby rozpocząć malowanie</div>}
   </div></div>
   <div className="texture-info">
     <span>{current?current.name+' · '+current.width+'×'+current.height+' · '+current.format+' · mipmapy '+current.levels:'Brak wybranej tekstury'}</span>
     {dirty&&<strong>● Niezapisane zmiany</strong>}
   </div>
   <div className="addon-message" role="status">{status}</div>
   <p className="texture-warning">Uwaga: obraz 2D to UV/tekstura modelu, a nie widok karoserii. Pozycja logo na pojeździe zależy od UV w YFT. Zapis YTD zostanie skompresowany ponownie, dlatego zawsze testuj wygląd w FiveM.</p>
 </section>;
}
