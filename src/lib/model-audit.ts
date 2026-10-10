import * as THREE from 'three';

export type DiagnosticSeverity='error'|'warning'|'info';
export type GeometryDiagnostic={
 severity:DiagnosticSeverity;
 code:string;
 meshId:string;
 meshName:string;
 message:string;
};
export type AuditReport={
 parts:number;
 vertices:number;
 triangles:number;
 scannedTriangles:number;
 issues:GeometryDiagnostic[];
 errors:number;
 warnings:number;
 skippedTriangles:number;
};
const SCAN_BUDGET=150_000;
const TOL=1e-7;
/**
 * Read-only geometry inspection. This is a GLB/scene health audit, NOT FiveM
 * collision, bone, vehicle-layout or YFT serializer validation.
 */
export function auditScene(root:THREE.Object3D):AuditReport{
 root.updateWorldMatrix(true,true);
 const report:AuditReport={parts:0,vertices:0,triangles:0,scannedTriangles:0,issues:[],errors:0,warnings:0,skippedTriangles:0};
 const seenRoles=new Map<string,string>();
 const issue=(severity:DiagnosticSeverity,code:string,mesh:THREE.Mesh,message:string)=>{
   if(report.issues.length<250)report.issues.push({severity,code,meshId:mesh.uuid,meshName:mesh.name||'Mesh',message});
   if(severity==='error')report.errors++;
   if(severity==='warning')report.warnings++;
 };
 root.traverse(object=>{
   if(!(object instanceof THREE.Mesh))return;
   report.parts++;
   const mesh=object,geometry=mesh.geometry,position=geometry.getAttribute('position');
   const index=geometry.index;
   const vertexCount=position?.count??0, indexCount=index?.count??vertexCount;
   const tris=Math.floor(indexCount/3);
   report.vertices+=vertexCount;report.triangles+=tris;
   if(!position||position.itemSize<3||vertexCount<3){
     issue('error','missing-positions',mesh,'Brak poprawnego bufora pozycji (min. 3 wierzchołki).');return;
   }
   if(indexCount%3!==0)issue('error','triangle-count',mesh,'Liczba indeksów nie jest wielokrotnością 3.');
   const uv=geometry.getAttribute('uv');
   if((!uv||uv.count!==vertexCount)&&!mesh.userData.kurogane?.kind?.includes('decal')){
     issue('warning','missing-uv',mesh,'Brak UV albo niezgodna liczba współrzędnych tekstury.');
   }
   if(!geometry.getAttribute('normal')||geometry.getAttribute('normal').count!==vertexCount){
     issue('warning','missing-normals',mesh,'Brak normalnych lub niepoprawna liczba normalnych.');
   }
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   if(mats.some(mat=>mat instanceof THREE.MeshStandardMaterial&&mat.map)&&!uv)
     issue('error','textured-no-uv',mesh,'Teksturowany materiał nie posiada UV.');
   let invalid=0;
   for(let i=0;i<vertexCount;i++){
     if(!Number.isFinite(position.getX(i))||!Number.isFinite(position.getY(i))||!Number.isFinite(position.getZ(i)))invalid++;
   }
   if(invalid){issue('error','nan-position',mesh,invalid+' wierzchołków ma nieskończone/NaN współrzędne.');return;}
   if(!object.visible)issue('info','hidden',mesh,'Element ukryty w podglądzie; sprawdź, czy ma być w eksporcie.');
   if(Math.abs(mesh.matrixWorld.determinant())<1e-10)
     issue('error','degenerate-transform',mesh,'Transformacja obiektu spłaszcza lub zeruje jedną z osi.');
   const role=mesh.userData.kurogane?.role;
   if(typeof role==='string' && role){
     const prior=seenRoles.get(role);
     if(prior&&/^(wheel_|door_)/i.test(role))
       issue('warning','duplicate-role',mesh,'Rolę '+role+' ma też element '+prior+'. Sprawdź nazwy części.');
     else seenRoles.set(role,mesh.name||'Mesh');
   }
   if(!object.visible)return;
   const allowance=Math.max(0,SCAN_BUDGET-report.scannedTriangles);
   const toScan=Math.min(tris,allowance);
   report.scannedTriangles+=toScan;report.skippedTriangles+=tris-toScan;
   if(!toScan)return;
   const edges=new Map<string,number>();
   let invalidIndices=0,degenerate=0;
   const vertex=(id:number)=>new THREE.Vector3().fromBufferAttribute(position,id);
   const key=(v:THREE.Vector3)=>[v.x,v.y,v.z].map(n=>Math.round(n*100000)).join(',');
   const countEdge=(a:string,b:string)=>{
     const id=a<b?a+'|'+b:b+'|'+a;edges.set(id,(edges.get(id)??0)+1);
   };
   for(let t=0;t<toScan;t++){
     const a=index?index.getX(t*3):t*3,b=index?index.getX(t*3+1):t*3+1,c=index?index.getX(t*3+2):t*3+2;
     if(!Number.isInteger(a)||!Number.isInteger(b)||!Number.isInteger(c)||
        a<0||b<0||c<0||a>=vertexCount||b>=vertexCount||c>=vertexCount){invalidIndices++;continue;}
     const va=vertex(a),vb=vertex(b),vc=vertex(c);
     if(vb.clone().sub(va).cross(vc.clone().sub(va)).lengthSq()<TOL*TOL){
       degenerate++;continue;
     }
     const ak=key(va),bk=key(vb),ck=key(vc);
     countEdge(ak,bk);countEdge(bk,ck);countEdge(ck,ak);
   }
   if(invalidIndices)issue('error','invalid-indices',mesh,invalidIndices+' trójkątów odwołuje się poza bufor wierzchołków.');
   if(degenerate)issue('warning','degenerate-faces',mesh,degenerate+' trójkątów ma zerowe pole.');
   if(mesh.userData.kurogane?.kind!=='decal'){
     let nonmanifold=0,open=0;
     for(const count of edges.values()){if(count>2)nonmanifold++;if(count===1)open++;}
     if(nonmanifold)issue('warning','nonmanifold',mesh,nonmanifold+' krawędzi ma więcej niż dwie sąsiadujące ściany.');
     if(open && !report.skippedTriangles)
       issue('info','open-border',mesh,open+' krawędzi brzegowych (otwarta siatka może być zamierzona).');
   }
 });
 if(report.skippedTriangles){
   report.issues.push({severity:'warning',code:'scan-limit',meshId:'',meshName:'Cała scena',
     message:'Ze względów wydajności nie przeanalizowano '+report.skippedTriangles+' trójkątów (limit 150 000 na audyt).'});
   report.warnings++;
 }
 return report;
}
