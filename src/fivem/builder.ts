import JSZip from 'jszip';
import { DEFAULTS, HANDLING_DEFINITIONS } from './types';
import type { Check, VehicleAsset, VehicleConfig } from './types';
import { fxManifest, handlingXML, variationsXML, vehicleNamesLua, vehiclesXML } from './templates';

const STREAM_EXT = new Set(['yft','ytd','ydr','ybn','ytyp','ymap']);
const META_NAMES = new Set(['vehicles.meta','handling.meta','carvariations.meta','carcols.meta','vehiclelayouts.meta']);
const MAX_FILE = 150 * 1024 * 1024;
const MAX_TOTAL = 256 * 1024 * 1024;
const MAX_ENTRIES = 600;

function basename(path:string) { return path.replace(/\\/g,'/').split('/').pop()?.toLowerCase() ?? ''; }
function ext(name:string) { return name.split('.').pop()?.toLowerCase() ?? ''; }
function normalizeName(name:string):string | null {
  const normal=name.replace(/\\/g,'/');
  if (normal.startsWith('/') || /^[a-z]:/i.test(normal) || normal.split('/').includes('..')) return null;
  const file=basename(normal);
  if (!file || !/^[a-z0-9_.+() -]{1,120}$/i.test(file)) return null;
  if (META_NAMES.has(file)) return 'data/'+file;
  if (STREAM_EXT.has(ext(file))) return 'stream/'+file;
  return null;
}
function decode(bytes:Uint8Array) { return new TextDecoder('utf-8',{fatal:false}).decode(bytes); }
const originalMeta=(assets:VehicleAsset[],name:string)=>
  assets.find(asset=>asset.name === 'data/'+name);

export type ImportedAssets={assets:VehicleAsset[];ignored:number;warnings:string[]};
export async function readAssets(input: File[]): Promise<ImportedAssets> {
 const result=new Map<string,VehicleAsset>();
 let ignored=0, total=0;
 const warnings:string[]=[];
 async function collect(name:string, bytes:Uint8Array, source:string) {
   const target=normalizeName(name);
   if (!target) { ignored++; return; }
   if (bytes.byteLength > MAX_FILE) throw new Error('Plik zbyt duży: '+name);
   total+=bytes.byteLength;
   if (total>MAX_TOTAL) throw new Error('Łączny limit importu 256 MiB został przekroczony.');
   if (result.has(target)) throw new Error('Dwa pliki o tej samej nazwie: '+target+'. Spakuj pojazdy oddzielnie.');
   result.set(target,{name:target,bytes,source});
 }
 for (const file of input) {
   if (file.size > MAX_FILE) throw new Error('Plik '+file.name+' przekracza 150 MiB.');
   if (file.name.toLowerCase().endsWith('.zip')) {
     // Validate the uncompressed sizes before inflating any ZIP content.
     // checkCRC32=true would eagerly decompress every entry, including ZIP bombs.
     const zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false});
     const entries=Object.values(zip.files).filter(entry=>!entry.dir);
     if (entries.length>MAX_ENTRIES) throw new Error('ZIP ma zbyt dużo wpisów (maks. 600).');
     let declaredTotal=0;
     for(const entry of entries) {
       const declared=(entry as typeof entry & {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
       if(typeof declared!=='number' || !Number.isSafeInteger(declared) || declared<0)
         throw new Error('ZIP nie deklaruje poprawnego rozmiaru: '+entry.name);
       if(declared>MAX_FILE) throw new Error('Za duży plik wewnątrz ZIP: '+entry.name);
       declaredTotal+=declared;
       if(declaredTotal>MAX_TOTAL) throw new Error('ZIP po rozpakowaniu przekracza 256 MiB.');
     }
     for (const entry of entries) {
       const rawName=(entry as typeof entry & {unsafeOriginalName?:string}).unsafeOriginalName ?? entry.name;
       const target=normalizeName(rawName);
       if (!target) {ignored++;continue;}
       // JSZip decompresses a single accepted asset at a time; verify size afterwards.
       const bytes=await entry.async('uint8array');
       await collect(rawName,bytes,file.name);
     }
   } else {
     await collect(file.name,new Uint8Array(await file.arrayBuffer()),file.name);
   }
 }
 if (!result.size) warnings.push('Nie znaleziono plików .yft, .ytd ani obsługiwanych .meta.');
 if (ignored) warnings.push('Pominięto '+ignored+' innych plików (w tym manifesty i skrypty z obcych ZIP-ów).');
 return {assets:[...result.values()],ignored,warnings};
}

function textValue(xml:string,tag:string):string | undefined {
  // Imported values are read-only hints, never treated as executable markup.
  const match=xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([^<]*)<\\/'+tag+'>','i'));
  return match?.[1]?.trim();
}
export function inferConfig(assets:VehicleAsset[],previous:VehicleConfig=DEFAULTS):VehicleConfig {
 const models=assets.filter(a=>a.name.endsWith('.yft')&&!a.name.endsWith('_hi.yft'));
 const firstModel=models[0]?.name.slice('stream/'.length,-4);
 const vm=originalMeta(assets,'vehicles.meta');
 const hm=originalMeta(assets,'handling.meta');
 const xml=vm?decode(vm.bytes):'';
 const handlingXml=hm?decode(hm.bytes):'';
 const spawn=firstModel??textValue(xml,'modelName')??previous.spawn;
 const handling=textValue(xml,'handlingId')??spawn.toUpperCase();
 const texture=textValue(xml,'txdName')??spawn;
 const updatedValues={...previous.handlingValues};
 for(const def of HANDLING_DEFINITIONS) {
   const match=handlingXml.match(new RegExp('<'+def.xml+'\\b[^>]*\\bvalue="([^"]+)"','i'));
   if (match) {
     const n=Number(match[1]);
     if(Number.isFinite(n) && n>=def.min && n<=def.max) updatedValues[def.key]=n;
   }
 }
 return {
   ...previous,spawn,resource:previous.resource||('ks_'+spawn),
   displayName:previous.displayName||spawn.toUpperCase(),texture,handling,
   make:textValue(xml,'vehicleMakeName')??previous.make,
   audio:textValue(xml,'audioNameHash')??previous.audio,
   layout:textValue(xml,'layout')??previous.layout,
   vehicleClass:textValue(xml,'vehicleClass')??previous.vehicleClass,
   vehicleType:textValue(xml,'type')??previous.vehicleType,
   wheelType:textValue(xml,'wheelType')??previous.wheelType,
   plateType:textValue(xml,'plateType')??previous.plateType,
   flags:textValue(xml,'flags')??previous.flags,
   handlingValues:updatedValues,
 };
}
function id(text:string,max=40) {return new RegExp('^[a-z][a-z0-9_]{0,'+(max-1)+'}$').test(text);}
export function validate(assets:VehicleAsset[],c:VehicleConfig):Check[] {
 const checks:Check[]=[];
 const error=(text:string)=>checks.push({level:'error',text});
 const warning=(text:string)=>checks.push({level:'warning',text});
 const ok=(text:string)=>checks.push({level:'ok',text});
 if(!id(c.spawn)) error('Spawn musi zaczynać się od litery i zawierać tylko a-z, 0-9 lub _, do 40 znaków.');
 if(!/^[a-z][a-z0-9_-]{0,63}$/.test(c.resource)) error('Nazwa resource: tylko małe litery, cyfry, _ i -, maksymalnie 64 znaki.');
 if(!/^[A-Z0-9_]{1,40}$/.test(c.handling)) error('Handling ID: 1–40 znaków A-Z, 0-9, _.');
 if(!id(c.texture)) error('TXD: tylko małe litery, cyfry i _.');
 if(!/^[A-Z0-9_]{1,48}$/.test(c.make)) error('Marka: użyj tylko wielkich liter, cyfr i _.');
 if(!/^[A-Z0-9_]{1,64}$/.test(c.audio)) error('Audio: użyj istniejącej nazwy silnika GTA, A-Z 0-9 _.');
 if(!/^LAYOUT_[A-Z0-9_]{1,60}$/.test(c.layout)) error('Nazwa układu foteli musi zaczynać się od LAYOUT_.');
 if(!/^VC_[A-Z0-9_]+$/.test(c.vehicleClass)) error('Niepoprawna klasa pojazdu.');
 if(!/^VEHICLE_TYPE_[A-Z0-9_]+$/.test(c.vehicleType)) error('Niepoprawny typ pojazdu.');
 if(!/^VWT_[A-Z0-9_]+$/.test(c.wheelType)) error('Niepoprawny typ kół.');
 if(!/^VPT_[A-Z0-9_]+$/.test(c.plateType)) error('Niepoprawna tablica.');
 if(c.flags.trim() && !/^(FLAG_[A-Z0-9_]+)( FLAG_[A-Z0-9_]+)*$/.test(c.flags.trim())) error('Flagi: nazwy FLAG_... rozdzielone pojedynczymi spacjami.');
 if(!c.displayName.trim() || c.displayName.length>80) error('Nazwa wyświetlana musi mieć 1–80 znaków.');
 if(!/^\d+\.\d+\.\d+$/.test(c.version)) error('Wersja musi mieć format 1.0.0.');
 for(const def of HANDLING_DEFINITIONS) {
  const value=c.handlingValues[def.key];
  if(!Number.isFinite(value)||value<def.min||value>def.max) error('Poza zakresem: '+def.label);
 }
 if(c.handlingValues.tractionMin>c.handlingValues.tractionMax) error('Przyczepność min nie może być większa od maksymalnej.');
 const base=assets.filter(a=>a.name.endsWith('.yft')&&!a.name.endsWith('_hi.yft'));
 if(!base.some(a=>a.name==='stream/'+c.spawn+'.yft')) error('Brakuje stream/'+c.spawn+'.yft. Bez modelu GTA addon nie może działać.');
 if(base.length>1) error('Wczytano kilka modeli .yft. Eksport jest dla jednego addonu — rozdziel paczkę.');
 if(assets.some(a=>a.name==='stream/'+c.spawn+'.yft')) {
   const file=assets.find(a=>a.name==='stream/'+c.spawn+'.yft')!;
   const signature=new TextDecoder().decode(file.bytes.subarray(0,4));
   if(signature!=='RSC7'&&signature!=='RSC8')
      warning('Nietypowy nagłówek pliku YFT. Sprawdź, czy to faktycznie binarny model GTA V.');
   ok('Nazwa pliku .yft jest dopasowana do spawnu.');
 }
 if(!assets.some(a=>a.name==='stream/'+c.texture+'.ytd')) warning('Brakuje '+c.texture+'.ytd. Część modeli korzysta ze wspólnych tekstur, ale sprawdź pojazd w grze.');
 if(!assets.some(a=>a.name==='stream/'+c.spawn+'_hi.yft')) warning('Brak '+c.spawn+'_hi.yft. Może działać, ale LOD-y wymagają sprawdzenia.');
 if(c.vehicleType !== 'VEHICLE_TYPE_CAR') error('Generator automatyczny obsługuje obecnie samochody. Inne klasy wymagają dedykowanych metadanych.');
 if(c.keepExisting && originalMeta(assets,'carcols.meta')) ok('Istniejący carcols.meta zostanie zachowany — także konfiguracja modkitów i świateł.');
 if(c.keepExisting && originalMeta(assets,'vehicles.meta')) warning('Dane specyficzne dla modelu w importowanym vehicles.meta zostaną zachowane. Zmieniane są tylko pola formularza.');
 else warning('Generowany vehicles.meta to szablon samochodu typu sedan/sport. LOD-y, kości, layout i audio trzeba zweryfikować w GTA V.');
 if(!originalMeta(assets,'carcols.meta')) warning('Bez carcols.meta nie utworzymy nieistniejącego tuningu ani świateł ELS.');
 if(!assets.length) warning('Możesz skonfigurować metadane, ale eksport jest blokowany bez prawdziwego .yft.');
 return checks;
}

function getXML(text:string):Document {
 const doc = new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror')) throw new Error('Błędny XML w importowanym .meta.');
 return doc;
}
function child(item:Element,name:string):Element|undefined {
 return [...item.children].find(el=>el.tagName===name);
}
function findMetaItem(doc:Document,list:string,field:string,key:string):Element {
 const parent=doc.getElementsByTagName(list)[0];
 if(!parent) throw new Error('Brak '+list+' w pliku .meta.');
 const items=[...parent.children].filter(x=>x.tagName==='Item');
 const found=items.find(item=>child(item,field)?.textContent?.trim().toLowerCase()===key.toLowerCase());
 if(found) return found;
 if(items.length===1) return items[0];
 throw new Error('W metadanych jest wiele aut i nie można określić wpisu '+key+'. Eksportuj oddzielny pojazd.');
}
function setText(doc:Document,item:Element,name:string,value:string) {
 let node=child(item,name);
 if(!node) {node=doc.createElement(name);item.appendChild(node);}
 node.textContent=value;
}
function patchVehicles(xml:string,c:VehicleConfig) {
 const doc=getXML(xml);
 const item=findMetaItem(doc,'InitDatas','modelName',c.spawn);
 for (const [name,value] of Object.entries({
    modelName:c.spawn,txdName:c.texture,handlingId:c.handling,gameName:c.spawn.toUpperCase(),
    vehicleMakeName:c.make,audioNameHash:c.audio,layout:c.layout,type:c.vehicleType,
    vehicleClass:c.vehicleClass,wheelType:c.wheelType,plateType:c.plateType,flags:c.flags
 })) setText(doc,item,name,value);
 return new XMLSerializer().serializeToString(doc);
}
function patchHandling(xml:string,c:VehicleConfig) {
 const doc=getXML(xml);
 const item=findMetaItem(doc,'HandlingData','handlingName',c.handling);
 setText(doc,item,'handlingName',c.handling);
 for(const def of HANDLING_DEFINITIONS) {
   let element=child(item,def.xml);
   if(!element){element=doc.createElement(def.xml);item.appendChild(element);}
   element.setAttribute('value',c.handlingValues[def.key].toFixed(6));
 }
 return new XMLSerializer().serializeToString(doc);
}
function patchVariations(xml:string,c:VehicleConfig) {
 const doc=getXML(xml);
 const item=findMetaItem(doc,'variationData','modelName',c.spawn);
 setText(doc,item,'modelName',c.spawn);
 return new XMLSerializer().serializeToString(doc);
}

export function generatedMetas(assets:VehicleAsset[],c:VehicleConfig):Record<string,string> {
 const use=(name:string,fallback:()=>string,patch?:(value:string)=>string)=>{
   const data=c.keepExisting?originalMeta(assets,name):undefined;
   if(data) return patch ? patch(decode(data.bytes)) : decode(data.bytes);
   return fallback();
 };
 const metas:Record<string,string>={
   'vehicles.meta':use('vehicles.meta',()=>vehiclesXML(c),raw=>patchVehicles(raw,c)),
   'handling.meta':use('handling.meta',()=>handlingXML(c),raw=>patchHandling(raw,c)),
   'carvariations.meta':use('carvariations.meta',()=>variationsXML(c),raw=>patchVariations(raw,c))
 };
 for(const name of ['carcols.meta','vehiclelayouts.meta']) {
   if(c.keepExisting) {
     const meta=originalMeta(assets,name);
     if(meta) {
       const raw=decode(meta.bytes);
       getXML(raw);
       metas[name]=raw;
     }
   }
 }
 return metas;
}
export function projectSummary(c:VehicleConfig) {
 return [
  '# Kurogane Studio — '+c.displayName,'',
  'Zawartość: resource FiveM (GTA V).',
  'Model/spawn: '+c.spawn,
  'Handling: '+c.handling,
  'Tekstury: '+c.texture,
  '',
  '## Instalacja',
  '1. Wypakuj folder '+c.resource+' do resources/[cars]/.',
  '2. Dodaj do server.cfg: ensure '+c.resource,
  '3. Uruchom serwer / refresh oraz ensure '+c.resource+'.',
  '4. Spawn pojazdu: /car '+c.spawn+' (jeśli Twój serwer ma taką komendę).',
  '',
  '## Ważne',
  'Pliki .yft/.ytd są kopiowane, NIE modyfikowane i NIE konwertowane.',
  'Manifest i XML nie tworzą brakujących kości, kolizji, LOD-ów, modkitów ani efektów syren.',
  'Przed publikacją przetestuj pojazd na serwerze i upewnij się, że masz prawa do modelu.',
  ''
 ].join('\n');
}
export async function createAddonZip(assets:VehicleAsset[],c:VehicleConfig):Promise<Uint8Array> {
 const checks=validate(assets,c);
 if(checks.some(ch=>ch.level==='error')) throw new Error(checks.filter(ch=>ch.level==='error').map(ch=>ch.text).join(' | '));
 const metas=generatedMetas(assets,c);
 const zip=new JSZip();
 const folder=zip.folder(c.resource)!;
 for (const asset of assets) {
   if(asset.name.startsWith('stream/')) folder.file(asset.name,asset.bytes);
 }
 for(const [name,xml] of Object.entries(metas)) folder.file('data/'+name,xml);
 folder.file('fxmanifest.lua',fxManifest(c,Object.keys(metas)));
 if(c.generateNames) folder.file('vehicle_names.lua',vehicleNamesLua(c));
 folder.file('README_KUROGANE.txt',projectSummary(c));
 folder.file('server_cfg_example.txt','ensure '+c.resource+'\n');
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:4}});
}
export function createConfigJSON(c:VehicleConfig):string { return JSON.stringify(c,null,2); }
export function readConfigJSON(text:string):VehicleConfig {
 const json:unknown=JSON.parse(text);
 if(!json||typeof json!=='object') throw new Error('Niepoprawny plik konfiguracji.');
 const incoming=json as Partial<VehicleConfig>;
 const result:VehicleConfig={...DEFAULTS,...incoming,handlingValues:{...DEFAULTS.handlingValues,...incoming.handlingValues}};
 if(!result.spawn || !result.resource) throw new Error('Konfiguracja bez spawnu lub nazwy resource.');
 return result;
}
