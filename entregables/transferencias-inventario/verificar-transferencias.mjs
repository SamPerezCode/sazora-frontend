import fs from "node:fs"; import path from "node:path"; import ts from "typescript"; import assert from "node:assert/strict"; import {createRequire} from "node:module";
const require=createRequire(path.resolve("package.json"));
const files={};
const cache=new Map();let calls=[],response,locations=[];
class ApiError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
function load(p){
 p=path.resolve(p); if(cache.has(p))return cache.get(p).exports;
 const m={exports:{}};cache.set(p,m);
 const src=files[path.relative(process.cwd(),p).split(path.sep).join("/")]??fs.readFileSync(p,"utf8");
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const local=id=>{
  if(id.endsWith("/http/client"))return{ApiError};
  if(id.endsWith("/organization.service"))return{getLocations:async()=>locations};
  if(id==="./inventory-location.service")return{inventoryRequest:async(s,p,schema,signal,method="GET",body)=>{calls.push({p,method,body});return schema.parse(response)}};
  if(!id.startsWith("."))return require(id);
  const base=path.resolve(path.dirname(p),id);return load(base+(fs.existsSync(base+".ts")||files[path.relative(process.cwd(),base+".ts").split(path.sep).join("/")]?".ts":".tsx"));
 };
 new Function("require","module","exports",js)(local,m,m.exports);return m.exports;
}
const service=load("src/features/inventory/services/inventory-transfer.service.ts");
const bus=load("src/lib/inventory-invalidation.ts");
let passed=0; const check=(name,fn)=>{fn();passed++;console.log("PASS",name)};
const body={sourceLocationId:"2",destinationLocationId:"1",externalReference:"traslado-001",notes:"Abastecimiento",lines:[{inventoryItemId:"3",quantity:"2",notes:null}]};
const balance={inventoryItemId:"3",name:"Croissant",sku:"PP-001",baseUnit:"UNIT",isItemActive:true,location:{id:"2",isActive:true},currentStock:"2.000",averageUnitCost:"911.111111",valuationStatus:"VALUED"};
check("Cantidad decimal exacta",()=>assert.equal(service.previewTransfer(body,[balance])[0].totalCost,"1822.222222"));
check("Stock local insuficiente",()=>assert.throws(()=>service.previewTransfer({...body,lines:[{...body.lines[0],quantity:"3"}]},[balance]),/insuficiente/));
check("Costo null no se transforma en cero",()=>assert.throws(()=>service.previewTransfer(body,[{...balance,averageUnitCost:null}]),/valoración/));
check("Sin valoración",()=>assert.throws(()=>service.previewTransfer(body,[{...balance,valuationStatus:"UNVALUED"}]),/valoración/));
check("Artículo inactivo",()=>assert.throws(()=>service.previewTransfer(body,[{...balance,isItemActive:false}]),/no está disponible/));
check("Ubicación inactiva",()=>assert.throws(()=>service.previewTransfer(body,[{...balance,location:{id:"2",isActive:false}}]),/no está disponible/));
check("No mezcla saldos de otro origen",()=>assert.throws(()=>service.previewTransfer(body,[{...balance,location:{id:"1",isActive:true}}]),/no está disponible/));
for(const q of ["0","-1","","abc","1.0001","1,000","1e3","01"])check("Rechaza cantidad "+JSON.stringify(q),()=>assert.equal(service.transferInput.safeParse({...body,lines:[{...body.lines[0],quantity:q}]}).success,false));
check("Acepta tres decimales",()=>assert.equal(service.transferInput.parse({...body,lines:[{...body.lines[0],quantity:"0.125"}]}).lines[0].quantity,"0.125"));
check("Origen distinto al destino",()=>assert.equal(service.transferInput.safeParse({...body,destinationLocationId:"2"}).success,false));
check("Sin líneas",()=>assert.equal(service.transferInput.safeParse({...body,lines:[]}).success,false));
check("Artículos duplicados",()=>assert.equal(service.transferInput.safeParse({...body,lines:[body.lines[0],body.lines[0]]}).success,false));
check("Límite de 100 líneas",()=>assert.equal(service.transferInput.safeParse({...body,lines:Array.from({length:101},(_,i)=>({...body.lines[0],inventoryItemId:String(i+1)}))}).success,false));
check("Referencia máxima",()=>assert.equal(service.transferInput.safeParse({...body,externalReference:"x".repeat(121)}).success,false));
check("Motivo obligatorio",()=>assert.equal(service.transferInput.safeParse({...body,notes:" "}).success,false));
check("No acepta precio enviado",()=>assert.equal(service.transferInput.safeParse({...body,lines:[{...body.lines[0],unitCost:"1"}]}).success,false));
check("Opcionales vacíos a null",()=>assert.equal(service.transferInput.parse({...body,externalReference:" "}).externalReference,null));
const session={business:{id:"1"},authorization:{roles:["ADMIN"]}};
const success={id:"1",businessId:"1",sourceLocation:{id:"2",code:"PLANT-01",name:"MAIN"},destinationLocation:{id:"1",code:"PS-001",name:"Punto"},sourceMovementId:"146",destinationMovementId:"147",status:"COMPLETED",externalReference:"traslado-001",notes:"Abastecimiento",createdByMembershipId:"1",createdAt:"2026-11-04T14:16:00.000Z",completedAt:"2026-11-04T14:16:00.000Z",lines:[{inventoryItemId:"3",inventoryItemName:"Croissant",baseUnit:"UNIT",quantity:"2.000",unitCost:"911.111111",totalCost:"1822.222222",notes:null}]};
response={transfer:success};let hits=0,other=0;const off=bus.subscribeInventoryInvalidation("1",()=>hits++),offOther=bus.subscribeInventoryInvalidation("2",()=>other++);
await service.createTransfer(session,new AbortController().signal,body);
check("Un POST al endpoint real sin costo en payload",()=>{assert.equal(calls.length,1);assert.equal(calls[0].p,"/inventory-movements/transfers");assert.equal(calls[0].method,"POST");assert.deepEqual(calls[0].body,body)});
check("Invalida solo el negocio actual",()=>{assert.equal(hits,1);assert.equal(other,0)});
await assert.rejects(()=>service.createTransfer({...session,authorization:{roles:["PRODUCTION"]}},new AbortController().signal,body),e=>e.status===403);passed++;console.log("PASS PRODUCTION bloqueado antes del POST");
assert.equal(calls.length,1);
for(const bad of [{businessId:"2"},{sourceMovementId:"147"},{sourceLocation:{id:"9",code:"X",name:"X"}},{lines:[{...success.lines[0],quantity:"1.000"}]}]){
 response={transfer:{...success,...bad}};await assert.rejects(()=>service.createTransfer(session,new AbortController().signal,body),e=>e.code==="INVALID_RESPONSE");passed++;console.log("PASS Rechaza respuesta inconsistente");
}
check("Respuesta inválida no invalida ni anuncia éxito",()=>assert.equal(hits,1));
locations=[{id:"1",businessId:"1",isActive:true,isInventoryLocation:true},{id:"2",businessId:"1",isActive:false,isInventoryLocation:true},{id:"3",businessId:"2",isActive:true,isInventoryLocation:true},{id:"4",businessId:"1",isActive:true,isInventoryLocation:false}];
const available=await service.loadTransferLocations(session,new AbortController().signal);
check("Catálogo filtrado por negocio activo e inventario",()=>assert.deepEqual(available.map(p=>p.id),["1"]));
off();offOther();bus.invalidateInventory("1");check("Desmontaje elimina suscripciones",()=>assert.equal(hits,1));
const audit=load("src/features/inventory/schemas/inventory-audit.schema.ts");
check("Movimiento TRANSFER reconocido por auditoría/Kardex",()=>assert.equal(audit.movementType.parse("TRANSFER"),"TRANSFER"));
check("Tipos anteriores conservados",()=>["PURCHASE","ADJUSTMENT","WASTE","RETURN","PRODUCTION"].forEach(t=>assert.equal(audit.movementType.parse(t),t)));
console.log("TOTAL",passed,"pruebas aprobadas. Sin peticiones a la API real.");
