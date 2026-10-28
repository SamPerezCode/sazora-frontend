const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
let calls = [], responder, balanceCalls = 0;
class ApiError extends Error {
  constructor(status, code, message, errors = []) { super(message); Object.assign(this, {status,code,errors}); }
}
const admin = { business:{id:'1'}, user:{fullName:'Admin'}, authorization:{ roles:['ADMIN'], locationAccess:{defaultLocationId:null,locations:[]} } };
const operator = { business:{id:'1'}, user:{fullName:'Operario'}, authorization:{ roles:['PRODUCTION'], locationAccess:{defaultLocationId:'3',locations:[{id:'3',name:'Planta',code:'PL',isActive:true,locationType:'PRODUCTION_WAREHOUSE'}]} } };
function load(filename) {
  filename=path.resolve(filename);
  const relative=path.relative(root,filename).replaceAll('\\','/');
  if(relative==='src/lib/http/client.ts')return {ApiError,request:async(url,schema,options)=>{calls.push({url,options});return schema.parse(await responder(url,options));}};
  if(relative==='src/features/business/services/organization.service.ts')return {getLocations:async()=>[]};
  if(relative==='src/features/inventory/services/inventory-location.service.ts')return {loadBalances:async()=>{balanceCalls++;return [];}};
  if(relative==='src/app/layout/shell-context.ts')return {useAppShell:()=>({session:operator})};
  if(relative==='src/features/inventory/hooks/useInventoryQuery.ts')return {useInventoryQuery:()=>({pending:false,error:null,data:null})};
  if(relative==='src/features/inventory/components/InventoryLocationUI.tsx')return {
    Modal:({children,footer})=>React.createElement('div',null,children,footer),
    Notice:({children})=>React.createElement('div',null,children),
    Field:({label})=>React.createElement('label',null,label),
    Choice:({label})=>React.createElement('label',null,label),
  };
  if(cache.has(filename))return cache.get(filename).exports;
  const staged=path.join(__dirname,relative);
  const text=fs.readFileSync(fs.existsSync(staged)?staged:filename,'utf8');
  const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};cache.set(filename,module);
  function resolve(name){
    if(!name.startsWith('.'))return require(name);
    const base=path.resolve(path.dirname(filename),name);
    const target=['.ts','.tsx','.js'].map(ext=>base+ext).find(p=>fs.existsSync(p)||fs.existsSync(path.join(__dirname,path.relative(root,p))));
    if(!target)throw Error('No se resuelve '+name+' desde '+filename);
    return load(target);
  }
  new Function('require','module','exports',js)(resolve,module,module.exports);
  return module.exports;
}
const feature='src/features/inventory/production/';
const access=load(path.join(root,feature,'production.access.ts'));
const contracts=load(path.join(root,feature,'production.contracts.ts'));
const api=load(path.join(root,feature,'production.api.ts'));
const format=load(path.join(root,feature,'production.format.ts'));
const line=(id,amount)=>({id,inventoryItemId:id,inventoryItemName:'Artículo '+id,inventoryItemSku:null,baseUnit:'KILOGRAM',plannedQuantity:amount,actualQuantity:null});
const order={id:'1',businessId:'1',recipe:{id:'1',code:'REC-1',name:'Receta'},location:{id:'3',name:'Planta',code:'PL'},status:'IN_PROGRESS',batchQuantity:'1.000',plannedFor:null,notes:null,inventoryMovementId:null,version:4,createdByMembershipId:'1',createdByName:'Admin',updatedByMembershipId:'1',updatedByName:'Admin',startedByMembershipId:'2',startedByName:'Operario',completedByMembershipId:null,completedByName:null,cancelledByMembershipId:null,cancelledByName:null,createdAt:'2026-10-27T12:00:00Z',updatedAt:'2026-10-27T12:00:00Z',startedAt:'2026-10-27T12:00:00Z',completedAt:null,cancelledAt:null,cancellationReason:null,inputs:[line('10','1.000')],outputs:[{...line('20','3.000'),costAllocationPercentage:'100.000000'}]};
const summary={expectedInputCostAtActualRate:null,actualInputCost:null,inputCostDifference:null,inputCostVariationPercentage:null,declaredWasteCost:'0.000000',totalResourceCost:null,producedInventoryValue:null};
const pLine=l=>({...l,differenceQuantity:null,variationPercentage:null,actualUnitCost:null,actualCost:null,declaredWasteQuantity:'0.000',declaredWasteCost:'0.000000'});
const performance={productionOrderId:'1',businessId:'1',locationId:'3',status:'IN_PROGRESS',inventoryMovementId:null,inputs:order.inputs.map(l=>({...pLine(l),expectedCostAtActualRate:null,costDifference:null,costVariationPercentage:null})),outputs:order.outputs.map(l=>({...pLine(l),yieldPercentage:null})),summary};
const signal=()=>new AbortController().signal;

test('Acciones por rol y estado; planta ajena y rol ajeno bloqueados',()=>{
  for(const status of ['DRAFT','PLANNED','IN_PROGRESS','COMPLETED','CANCELLED']){
    const row={...order,status,inventoryMovementId:status==='COMPLETED'?'19':null};
    const operatorActions=access.allowedActions(operator,row);
    for(const denied of ['edit','plan','cancel'])assert(!operatorActions.includes(denied));
    assert.deepEqual(access.allowedActions(operator,{...row,location:{id:'9'}}),[]);
    assert.deepEqual(access.allowedActions({...operator,authorization:{...operator.authorization,roles:['WAITER']}},row),[]);
  }
  assert.deepEqual(access.allowedActions(admin,{...order,status:'DRAFT'}),['detail','edit','plan','cancel']);
  assert.deepEqual(access.allowedActions(operator,{...order,status:'IN_PROGRESS'}),['detail','waste','complete','performance']);
  assert.equal(access.plantScope(operator,''),'3');
  assert.throws(()=>access.plantScope(operator,'9'),e=>e.status===403);
});
test('Plantas ADMIN: activas, inventario y producción habilitados',()=>{
  const plant={isActive:true,isInventoryLocation:true,isProductionLocation:true,locationType:'PRODUCTION_WAREHOUSE'};
  assert(access.usablePlant(plant));
  for(const flag of ['isActive','isInventoryLocation','isProductionLocation'])assert(!access.usablePlant({...plant,[flag]:false}));
});
test('Cantidades y payload: no coma, cero, negativos, >3 decimales ni porcentajes al completar',()=>{
  for(const value of ['0','-1','1,5','0.0001'])assert(!contracts.positiveQuantity.safeParse(value).success);
  assert(contracts.positiveQuantity.safeParse('1.125').success);
  assert(!contracts.completeOrderSchema.safeParse({version:4,inputs:[{inventoryItemId:'10',quantity:'1'}],outputs:[{inventoryItemId:'20',quantity:'3',costAllocationPercentage:'100'}]}).success);
  assert(!contracts.wasteInputSchema.safeParse({version:4,reason:'Derrame',lines:[{inventoryItemId:'10',quantity:'1',notes:null},{inventoryItemId:'10',quantity:'1',notes:null}]}).success);
});
test('Conversión de fecha en zona empresarial y conservación del instante original',()=>{
  assert.equal(format.plannedISO('2026-10-27','America/Bogota',null),'2026-10-27T05:00:00.000Z');
  assert.equal(format.plannedISO('2026-10-27','Asia/Kolkata',null),'2026-10-26T18:30:00.000Z');
  assert.equal(format.plannedISO('2026-10-27','America/Bogota','2026-10-27T15:17:35Z'),'2026-10-27T15:17:35Z');
});
test('Estimación exacta, asignación total y valoración desconocida',()=>{
  const balances=[{inventoryItemId:'10',valuationStatus:'VALUED',averageUnitCost:'0.100000'}];
  const result=format.estimate(order,balances,{'10':'3','20':'3'});
  assert.equal(result.total,'0.300000');assert.equal(result.outputs[0].value,'0.300000');
  assert.equal(result.outputs[0].unitCost,'0.100000');
  assert.equal(format.estimate(order,null,{'10':'3','20':'3'}).total,null);
  assert.equal(format.cash(null,'COP'),'Sin valoración');
});
test('PRODUCTION consulta su planta y nunca consulta existencias ADMIN',async()=>{
  calls=[];balanceCalls=0;
  responder=async(url)=>({status:'success',data:url.endsWith('/performance')?{performance}:url.endsWith('/waste')?{wasteRecords:[]}:{productionOrder:order}});
  const resources=await api.orderResources(operator,signal(),'1');
  assert.equal(resources.balances,null);assert.equal(balanceCalls,0);
  responder=async()=>({status:'success',data:{productionOrders:[]}});
  await api.listOrders(operator,signal(),'');
  assert(calls.at(-1).url.includes('locationId=3'));
});
test('Respuesta completa y versión del servidor; no incluir porcentaje en completar',async()=>{
  calls=[];
  const returned={...order,status:'COMPLETED',version:9,inventoryMovementId:'19'};
  responder=async()=>({status:'success',data:{productionOrder:returned}});
  const result=await api.saveOrder(operator,signal(),order,{action:'complete',payload:{version:4,inputs:[{inventoryItemId:'10',quantity:'1.125'}],outputs:[{inventoryItemId:'20',quantity:'3.000'}]}});
  assert.equal(result.version,9);assert.equal(result.status,'COMPLETED');
  assert.equal(calls.length,1);assert(!('costAllocationPercentage' in calls[0].options.body.outputs[0]));
  assert.equal(calls[0].options.body.inputs[0].quantity,'1.125');
});
test('Bloquea cambios de artículos y mutaciones administrativas del operario antes del HTTP',async()=>{
  calls=[];
  await assert.rejects(()=>api.saveOrder(operator,signal(),order,{action:'complete',payload:{version:4,inputs:[{inventoryItemId:'99',quantity:'1'}],outputs:[{inventoryItemId:'20',quantity:'3'}]}}),/coincidir/);
  await assert.rejects(()=>api.saveOrder(operator,signal(),{...order,status:'DRAFT'},{action:'plan',payload:{version:4}}),e=>e.status===403);
  assert.equal(calls.length,0);
});
test('Conflicto mantiene mensaje original y no reintenta automáticamente',async()=>{
  calls=[];responder=async()=>{throw new ApiError(409,'VERSION_CONFLICT','La orden fue modificada por otra persona');};
  await assert.rejects(()=>api.saveOrder(operator,signal(),{...order,status:'PLANNED'},{action:'start',payload:{version:4}}),/modificada por otra persona/);
  assert.equal(calls.length,1);
});
test('Formulario de desperdicio vacío y finalización renderizan sin datos inventados',()=>{
  const {ExecutionForm}=load(path.join(root,feature,'ProductionOrderForms.tsx'));
  const context={data:{order,performance,waste:[],balances:null},currency:'COP',zone:'America/Bogota',busy:false,locked:false,error:'',onClose(){},async commit(){}};
  const waste=renderToStaticMarkup(React.createElement(ExecutionForm,{context,action:'waste'}));
  assert(waste.includes('Motivo obligatorio'));
  const complete=renderToStaticMarkup(React.createElement(ExecutionForm,{context,action:'complete'}));
  assert(complete.includes('Se validará al confirmar'));assert(complete.includes('Existencia actual'));
});
