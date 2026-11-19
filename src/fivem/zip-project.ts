import JSZip from 'jszip';
import type { VehicleAsset } from './types';

/** Files not owned by the built-in vehicle editor, preserved during a ZIP roundtrip. */
export type ExtraFile = VehicleAsset;
export type ZipProject = {
  assets: VehicleAsset[];
  extraFiles: ExtraFile[];
  ignored: number;
  warnings: string[];
  originalResource?: string;
};

const STREAM = new Set(['yft','ytd','ydr','ydd','ybn','ytyp','ymap','ycd']);
const META = new Set(['vehicles.meta','handling.meta','carvariations.meta','carcols.meta','vehiclelayouts.meta']);
const FORBIDDEN = new Set(['exe','dll','bat','cmd','ps1','vbs','scr','lnk','msi','com']);
const ENTRY_LIMIT = 650;
const FILE_LIMIT = 150 * 1024 * 1024;
const UNPACKED_LIMIT = 256 * 1024 * 1024;
const SHELL_DIRS = new Set(['stream','data','audio','html','client','server','shared','assets','ui','web']);

function safePath(raw: string): string | null {
  // Check JSZip's UNSANITIZED original path; never trust the normalized entry.name.
  const normalized=raw.replace(/\\/g,'/');
  if(normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.includes('\0'))return null;
  const parts=normalized.split('/');
  if(parts.length>20 || parts.some(part=>!part || part==='.' || part==='..' || part.length>128
    || !/^[\p{L}\p{N}_ .+@()[\]-]+$/u.test(part)
    || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part)))return null;
  return normalized;
}
function filename(path:string){return path.split('/').pop()!.toLowerCase();}
function ext(path:string){return filename(path).split('.').pop()??'';}
function classify(path:string):string|null{
  const file=filename(path);
  if(META.has(file))return 'data/'+file;
  if(STREAM.has(ext(path)))return 'stream/'+file;
  return null;
}
function commonRoot(paths:string[]):string{
  const manifests=paths.filter(p=>filename(p)==='fxmanifest.lua');
  if(manifests.length>1)throw new Error('ZIP zawiera wiele fxmanifest.lua — wybierz jeden resource zamiast paczki kilku skryptów.');
  if(manifests.length===1)return manifests[0].split('/').slice(0,-1).join('/');
  const dirs=paths.map(p=>p.split('/').slice(0,-1));
  const common=[...(dirs[0]??[])];
  while(common.length&&!dirs.every(parts=>common.every((p,i)=>parts[i]===p)))common.pop();
  // A single stream/ or data/ directory is a component, not the resource root.
  while(common.length&&SHELL_DIRS.has(common[common.length-1].toLowerCase()))common.pop();
  return common.join('/');
}
function assertValidZIPEntry(entry:JSZip.JSZipObject){
  const declared=(entry as typeof entry & {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
  if(typeof declared!=='number'||!Number.isSafeInteger(declared)||declared<0)
    throw new Error('Archiwum ZIP nie zawiera poprawnego rozmiaru: '+entry.name);
  if(declared>FILE_LIMIT)throw new Error('Plik ZIP przekracza 150 MiB: '+entry.name);
  return declared;
}

export async function loadAddonProjectZip(file:File):Promise<ZipProject>{
  if(file.size>FILE_LIMIT)throw new Error('ZIP przekracza dopuszczalne 150 MiB.');
  // Avoid eager CRC validation, which expands the entire archive before checking limits.
  const zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false});
  const entries=Object.values(zip.files).filter(item=>!item.dir);
  if(entries.length>ENTRY_LIMIT)throw new Error('ZIP zawiera za dużo plików (limit 650).');
  let declaredTotal=0;
  const candidate:{entry:JSZip.JSZipObject;path:string}[]=[];
  let ignored=0;
  const warnings:string[]=[];
  for(const entry of entries){
    declaredTotal+=assertValidZIPEntry(entry);
    if(declaredTotal>UNPACKED_LIMIT)throw new Error('ZIP po rozpakowaniu przekracza limit 256 MiB.');
    const original=(entry as typeof entry & {unsafeOriginalName?:string}).unsafeOriginalName??entry.name;
    const path=safePath(original);
    const symlink=((entry.unixPermissions??0) as number)&0o170000;
    if(!path||symlink===0o120000){ignored++;warnings.push('Pominięto niebezpieczny wpis ZIP: '+entry.name);continue;}
    candidate.push({entry,path});
  }
  if(!candidate.length)throw new Error('Archiwum nie zawiera poprawnych plików.');
  const root=commonRoot(candidate.map(e=>e.path));
  const prefix=root?root+'/':'';
  const canonical=new Map<string,VehicleAsset>();
  const other=new Map<string,VehicleAsset>();
  for(const {entry,path} of candidate){
    if(prefix&&!path.startsWith(prefix)){ignored++;warnings.push('Pominięto plik spoza resource: '+path);continue;}
    const relative=prefix?path.slice(prefix.length):path;
    if(!relative){ignored++;continue;}
    if(FORBIDDEN.has(ext(relative))){ignored++;warnings.push('Pominięto niebezpieczny plik wykonywalny: '+relative);continue;}
    if(relative.toLowerCase()==='__resource.lua'){
      ignored++;warnings.push('Pominięto stary __resource.lua — generator tworzy fxmanifest.lua.');
      continue;
    }
    const destination=classify(relative);
    const name=destination??relative;
    const key=name.toLowerCase();
    if(canonical.has(key)||other.has(key))throw new Error('Duplikat ścieżki po imporcie: '+name+'. Sprawdź nazwy plików w ZIP.');
    const bytes=await entry.async('uint8array');
    if(bytes.length>FILE_LIMIT)throw new Error('Plik przekracza limit: '+relative);
    if(destination)canonical.set(key,{name:destination,bytes,source:file.name+': '+path});
    else other.set(key,{name:relative,bytes,source:file.name+': '+path});
  }
  const assets=[...canonical.values()],extraFiles=[...other.values()];
  if(!assets.some(a=>a.name.endsWith('.yft')))warnings.push('Brak pojazdu YFT — archiwum może nie być gotowym add-onem FiveM.');
  const codeFiles=extraFiles.filter(f=>/\.(lua|js|ts|mjs|cjs)$/i.test(f.name));
  if(codeFiles.length)warnings.push('ZIP zawiera '+codeFiles.length+' plików skryptów. Są zachowane, ale przed instalacją na serwerze sprawdź ich bezpieczeństwo.');
  if(extraFiles.some(f=>f.name.toLowerCase().endsWith('.rpf')))
    warnings.push('ZIP zawiera zagnieżdżony .rpf: do jego rozpakowania użyj osobno modułu Otwórz RPF7.');
  if(ignored)warnings.push('Pominięto '+ignored+' wpisów niezgodnych z bezpieczeństwem lub strukturą pojedynczego resource.');
  return {assets,extraFiles,ignored,warnings,originalResource:root.split('/').pop()||undefined};
}

export function textEditable(name:string):boolean{
 return /\.(lua|js|json|xml|meta|txt|md|html|css|cfg|ini|yml|yaml|toml|csv)$/i.test(name) || name==='fxmanifest.lua';
}
export function readText(file:VehicleAsset):string{
 if(!textEditable(file.name)||file.bytes.length>1024*1024)throw new Error('Ten plik nie obsługuje edycji tekstowej (limit 1 MiB).');
 if(file.bytes.includes(0))throw new Error('Plik zawiera bajty binarne, nie można edytować go jako tekst.');
 return new TextDecoder('utf-8',{fatal:true}).decode(file.bytes);
}
export function updateFileText(files:VehicleAsset[],name:string,text:string):VehicleAsset[]{
 const index=files.findIndex(file=>file.name===name);
 if(index<0)throw new Error('Pliku nie ma w projekcie.');
 if(!textEditable(name)||new TextEncoder().encode(text).length>1024*1024)
   throw new Error('Nie można zapisać: nieobsługiwany format lub plik większy niż 1 MiB.');
 return files.map((file,i)=>i===index?{...file,bytes:new TextEncoder().encode(text),source:'Edytowany w Kurogane Studio'}:file);
}
