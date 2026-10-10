import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DEFAULTS } from '../src/fivem/types';
import { createAddonZip, inferConfig, readAssets, validate } from '../src/fivem/builder';
import { escapeLua, escapeXML, fxManifest, handlingXML, vehiclesXML } from '../src/fivem/templates';
import type { VehicleAsset, VehicleConfig } from '../src/fivem/types';

function setup(): { config:VehicleConfig; files:VehicleAsset[] } {
 const config:VehicleConfig = {
   ...DEFAULTS,spawn:'ks_police',resource:'fourseven_ks_police',
   displayName:'LSPD Patrol',texture:'ks_police',handling:'KS_POLICE',
   handlingValues:{...DEFAULTS.handlingValues}
 };
 const files:VehicleAsset[] = [
  {name:'stream/ks_police.yft',source:'test',bytes:new Uint8Array([82,83,67,55])},
  {name:'stream/ks_police_hi.yft',source:'test',bytes:new Uint8Array([82,83,67,55,1])},
  {name:'stream/ks_police.ytd',source:'test',bytes:new Uint8Array([82,83,67,55,2])},
 ];
 return {config,files};
}
test('new resource: valid input gets no blocking errors',()=>{
 const {config,files}=setup();
 assert.deepEqual(validate(files,config).filter(c=>c.level==='error'),[]);
});
test('missing YFT blocks export rather than creating a fake working addon',async()=>{
 const {config,files}=setup();
 files.shift();
 assert.ok(validate(files,config).some(c=>c.level==='error'));
 await assert.rejects(createAddonZip(files,config),/Brakuje stream/);
});
test('wrong spawn / path characters rejected',()=>{
 const {config,files}=setup();
 assert.ok(validate(files,{...config,spawn:'../../oops'}).some(c=>c.level==='error'));
 assert.ok(validate(files,{...config,resource:'[cars]'}).some(c=>c.level==='error'));
});
test('fields are escaped for XML and Lua',()=>{
 assert.equal(escapeXML('A&B<C'), 'A&amp;B&lt;C');
 assert.ok(escapeLua("x'\\y").includes("\\'"));
 const {config}=setup();
 const xml=vehiclesXML({...config,description:'a&b'});
 assert.match(xml,/<modelName>ks_police<\/modelName>/);
 assert.match(xml,/<handlingId>KS_POLICE<\/handlingId>/);
 const handing=handlingXML(config);
 assert.match(handing,/<fMass value="1600\.000000"/);
 assert.match(handing,/<handlingName>KS_POLICE<\/handlingName>/);
});
test('fxmanifest lists only actually included META and uses correct FiveM types',()=>{
 const {config}=setup();
 const manifest=fxManifest(config,['vehicles.meta','handling.meta','carvariations.meta']);
 assert.match(manifest,/data_file 'VEHICLE_METADATA_FILE' 'data\/vehicles\.meta'/);
 assert.match(manifest,/data_file 'HANDLING_FILE' 'data\/handling\.meta'/);
 assert.doesNotMatch(manifest,/CARCOLS_FILE/);
 assert.match(manifest,/client_script 'vehicle_names\.lua'/);
});
test('exported ZIP preserves GTA binaries and generates folder hierarchy',async()=>{
 const {config,files}=setup();
 const bytes=await createAddonZip(files,config);
 const zip=await JSZip.loadAsync(bytes);
 const prefix=config.resource+'/';
 const expected=[
   'fxmanifest.lua','vehicle_names.lua','data/vehicles.meta','data/handling.meta',
   'data/carvariations.meta','stream/ks_police.yft','stream/ks_police_hi.yft',
   'stream/ks_police.ytd','README_KUROGANE.txt','server_cfg_example.txt'
 ];
 for (const name of expected) assert.ok(zip.file(prefix+name),name);
 assert.equal((await zip.file(prefix+'stream/ks_police.yft')!.async('uint8array'))[0],82);
 assert.ok((await zip.file(prefix+'fxmanifest.lua')!.async('string')).includes('VEHICLE_METADATA_FILE'));
 assert.equal(zip.file(prefix+'data/carcols.meta'),null);
});
test('imported ZIP maps nested stream/data files, ignores other scripts',async()=>{
 const zip=new JSZip();
 zip.file('resources/[cars]/mycar/stream/mycar.yft',new Uint8Array([3,4]));
 zip.file('resources/[cars]/mycar/data/handling.meta','<CHandlingDataMgr />');
 zip.file('resources/[cars]/mycar/server.lua','malicious script');
 zip.file('../outside.yft','not allowed');
 const data=await zip.generateAsync({type:'uint8array'});
 const file={name:'mycar.zip',size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer} as File;
 const imported=await readAssets([file]);
 assert.equal(imported.assets.length,2);
 assert.deepEqual(imported.assets.map(a=>a.name).sort(),['data/handling.meta','stream/mycar.yft']);
 assert.equal(imported.ignored,2);
 const c=inferConfig(imported.assets);
 assert.equal(c.spawn,'mycar');
 assert.equal(c.resource,'ks_mycar');
});

test('RPF single car with tuning YFT variants stays a single resource',async()=>{
 const {config,files}=setup();
 files.unshift({name:'stream/ks_police_bumper_1.yft',source:'rpf',bytes:new Uint8Array([82,83,67,55,1])});
 files.push({
   name:'data/vehicles.meta',source:'rpf',
   bytes:new TextEncoder().encode('<CVehicleModelInfo__InitDataList><InitDatas><Item><modelName>ks_police</modelName><txdName>ks_police</txdName><handlingId>KS_POLICE</handlingId></Item></InitDatas></CVehicleModelInfo__InitDataList>')
 });
 assert.equal(inferConfig(files).spawn,'ks_police');
 assert.deepEqual(validate(files,config).filter(check=>check.level==='error'),[]);
 const zip=await JSZip.loadAsync(await createAddonZip(files,config));
 assert.ok(zip.file(config.resource+'/stream/ks_police_bumper_1.yft'));
});
test('RPF including unrelated second car is blocked',()=>{
 const {config,files}=setup();
 files.push({name:'stream/anothercar.yft',source:'rpf',bytes:new Uint8Array([82,83,67,55])});
 assert.ok(validate(files,config).some(c=>c.level==='error'&&c.text.includes('inne pojazdy')));
});
