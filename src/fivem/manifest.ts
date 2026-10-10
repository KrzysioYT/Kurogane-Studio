import type { VehicleConfig } from './types';
import { escapeLua, fxManifest } from './templates';

const TYPES:[string,string][]=[
 ['vehicles.meta','VEHICLE_METADATA_FILE'],
 ['handling.meta','HANDLING_FILE'],
 ['carvariations.meta','VEHICLE_VARIATION_FILE'],
 ['carcols.meta','CARCOLS_FILE'],
 ['vehiclelayouts.meta','VEHICLE_LAYOUTS_FILE'],
];
function upsertLine(source:string,key:string,value:string){
 const updated=source.replace(new RegExp('^\\s*'+key+'\\s+[^\\r\\n]*','mi'),key+" '"+escapeLua(value)+"'");
 return updated===source?updated.trimEnd()+"\n"+key+" '"+escapeLua(value)+"'":updated;
}
/**
 * Keep existing scripts and custom data_file registrations.
 * Vehicle META declarations are canonicalized to data/*.meta.
 * The imported Lua is never executed in Kurogane Studio.
 */
export function mergeVehicleManifest(original:string|undefined,c:VehicleConfig,metas:string[],generatedNames:boolean):string{
 if(!original||!c.keepExisting)return fxManifest({...c,generateNames:generatedNames},metas);
 if(original.includes('\0')||original.length>1024*1024)throw new Error('Niepoprawny manifest w ZIP.');
 let text=original.replace(/\r\n/g,'\n');
 for(const [name] of TYPES){
   const escaped=name.replace(/\./g,'\\.');
   const needle=new RegExp("(['\"])[^'\"\\r\\n]*?"+escaped+"\\1",'gi');
   text=text.replace(needle,"'data/"+name+"'");
 }
 const vehicleTypes=new Set(TYPES.map(([,type])=>type));
 text=text.split('\n').filter(line=>{
   const data=line.match(/^\s*data_file\s+['"]([^'"]+)['"]/i);
   return !data||!vehicleTypes.has(data[1].toUpperCase());
 }).join('\n');
 const standard=metas.filter(name=>TYPES.some(([n])=>n===name))
   .map(name=>"    'data/"+name+"',").join('\n');
 const bindings=TYPES.filter(([name])=>metas.includes(name))
   .map(([name,type])=>"data_file '"+type+"' 'data/"+name+"'").join('\n');
 text=text.trimEnd()+"\n\n-- Kurogane Studio: synchronized vehicle metadata\nfiles {\n"+standard+"\n}\n"+bindings+"\n";
 if(generatedNames && !/\b(?:client_script|client_scripts)\b[\s\S]*?['"]vehicle_names\.lua['"]/i.test(text))
   text+="client_script 'vehicle_names.lua'\n";
 text=upsertLine(text,'author',c.author);
 text=upsertLine(text,'description',c.description);
 text=upsertLine(text,'version',c.version);
 return text.trimEnd()+"\n";
}
