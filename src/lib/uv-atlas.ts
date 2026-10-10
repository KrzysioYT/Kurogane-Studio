import * as THREE from 'three';

type UVAxis='x'|'y'|'z';
type Chart={faces:number[];firstNormal:THREE.Vector3;mat:number};
const MAX_FACES=80_000;
const MAX_CHARTS=4_096;
const ANGLE_COS=Math.cos(THREE.MathUtils.degToRad(12));

/**
 * Separate approximately coplanar triangle regions into non-overlapping UV tiles.
 * Works on GLB/OBJ scene geometry; does NOT re-encode a GTA YTD or YFT.
 * Indexed geometry is expanded so charts can have independent UV seams.
 */
export function packUVIslands(mesh:THREE.Mesh):number{
 const src=mesh.geometry;
 if(mesh instanceof THREE.SkinnedMesh||src.hasAttribute('skinIndex')||Object.keys(src.morphAttributes).length)
   throw new Error('Atlas UV dla skinned meshes wymaga zachowania wag i kości; operacja zablokowana.');
 const source=src.index?src.toNonIndexed():src.clone();
 try{
   const pos=source.getAttribute('position');
   if(!pos||pos.itemSize<3||pos.count%3!==0||pos.count/3>MAX_FACES||!pos.count)
     throw new Error('Atlas UV obsługuje tylko poprawne siatki do 80 000 trójkątów.');
   const faces=pos.count/3;
   const normals:THREE.Vector3[]=[];
   const edgeMap=new Map<string,number[]>();
   const material=new Int32Array(faces);
   for(const group of source.groups){
     const end=Math.min(pos.count,group.start+group.count);
     for(let i=group.start;i<end;i+=3)material[Math.floor(i/3)]=group.materialIndex??0;
   }
   const coords=(i:number)=>new THREE.Vector3().fromBufferAttribute(pos,i);
   const hash=(v:THREE.Vector3)=>[v.x,v.y,v.z].map(x=>Math.round(x*1e5)).join(',');
   const edge=(a:string,b:string)=>a<b?a+'|'+b:b+'|'+a;
   for(let face=0;face<faces;face++){
     const a=coords(face*3),b=coords(face*3+1),c=coords(face*3+2);
     const normal=b.clone().sub(a).cross(c.clone().sub(a));
     if(normal.lengthSq()>1e-20)normal.normalize();
     else normal.set(0,0,1);
     normals.push(normal);
     const keys=[hash(a),hash(b),hash(c)];
     for(let i=0;i<3;i++){
       const e=edge(keys[i],keys[(i+1)%3]);
       let entry=edgeMap.get(e);
       if(!entry){entry=[];edgeMap.set(e,entry);}
       entry.push(face);
     }
   }
   const adj:Array<Set<number>>=Array.from({length:faces},()=>new Set<number>());
   for(const linked of edgeMap.values()){
     if(linked.length<2||linked.length>8)continue;
     for(let i=0;i<linked.length;i++)for(let j=i+1;j<linked.length;j++){
       const a=linked[i],b=linked[j];
       if(material[a]===material[b]&&normals[a].dot(normals[b])>=ANGLE_COS){
         adj[a].add(b);adj[b].add(a);
       }
     }
   }
   const assigned=new Int32Array(faces).fill(-1);
   const charts:Chart[]=[];
   for(let seed=0;seed<faces;seed++){
     if(assigned[seed]!==-1)continue;
     if(charts.length>=MAX_CHARTS)throw new Error('Za dużo wysp UV (maks. 4096).');
     const chart:Chart={faces:[],firstNormal:normals[seed],mat:material[seed]};
     const id=charts.length;
     const pending=[seed];assigned[seed]=id;
     for(let pointer=0;pointer<pending.length;pointer++){
       const face=pending[pointer];chart.faces.push(face);
       for(const neighbor of adj[face]){
         if(assigned[neighbor]!==-1||normals[neighbor].dot(chart.firstNormal)<ANGLE_COS)continue;
         assigned[neighbor]=id;pending.push(neighbor);
       }
     }
     charts.push(chart);
   }

   const cols=Math.ceil(Math.sqrt(charts.length));
   const rows=Math.ceil(charts.length/cols);
   const cellW=1/cols,cellH=1/rows;
   const uv=new Float32Array(pos.count*2);
   for(let chartId=0;chartId<charts.length;chartId++){
     const chart=charts[chartId];
     const normal=chart.firstNormal;
     const absX=Math.abs(normal.x),absY=Math.abs(normal.y),absZ=Math.abs(normal.z);
     const axes:[UVAxis,UVAxis]=absX>=absY&&absX>=absZ?['y','z']:absY>=absZ?['x','z']:['x','y'];
     const samples:{index:number;u:number;v:number}[]=[];
     let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
     for(const face of chart.faces)for(let vertex=face*3;vertex<face*3+3;vertex++){
       const p=coords(vertex);
       const u=p[axes[0]],v=p[axes[1]];
       samples.push({index:vertex,u,v});
       minU=Math.min(minU,u);maxU=Math.max(maxU,u);
       minV=Math.min(minV,v);maxV=Math.max(maxV,v);
     }
     const spanU=Math.max(1e-6,maxU-minU),spanV=Math.max(1e-6,maxV-minV);
     const scale=Math.min(cellW*.86/spanU,cellH*.86/spanV);
     const column=chartId%cols,row=Math.floor(chartId/cols);
     const startU=column*cellW+(cellW-spanU*scale)/2;
     const startV=(rows-1-row)*cellH+(cellH-spanV*scale)/2;
     for(const sample of samples){
       uv[sample.index*2]=startU+(sample.u-minU)*scale;
       uv[sample.index*2+1]=startV+(sample.v-minV)*scale;
     }
   }
   source.setAttribute('uv',new THREE.BufferAttribute(uv,2));
   source.deleteAttribute('tangent');
   source.computeBoundingBox();source.computeBoundingSphere();
   mesh.geometry=source;
   return charts.length;
 }catch(error){source.dispose();throw error;}
}
