import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
function gateway(){
 const sheets=new Map(),props=new Map([['SPREADSHEET_ID','sheet-1'],['GATEWAY_SECRET','a'.repeat(32)]]);let failTable='';
 function sheet(name){
  if(!sheets.has(name))sheets.set(name,[]);const data=sheets.get(name);
  return {
   getLastRow:()=>data.length,
   getRange(row,col,height,width){
    return {
     getValues(){return Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>data[row-1+r]?.[col-1+c]??''));},
     setValues(values){if(failTable===name){failTable='';throw Error('Simulated write interruption');}values.forEach((v,r)=>{data[row-1+r]||=[];v.forEach((x,c)=>data[row-1+r][col-1+c]=typeof x==='string'&&x.startsWith("'")?x.slice(1):x);});return this;}
    };
   }
  };
 }
 const context=vm.createContext({console,encodeURIComponent,Date,Map,Set,ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},SpreadsheetApp:{openById:()=>({getSheetByName:sheet}),flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{computeHmacSha256Signature:(s,key)=>[...crypto.createHmac('sha256',key).update(s).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],DigestAlgorithm:{SHA_256:'sha256'}}});
 vm.runInContext(fs.readFileSync(new URL('../core/engine.mjs',import.meta.url),'utf8').replace(/^export /gm,'')+'\n'+fs.readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
 vm.runInContext("Object.keys(SCHEMA).forEach(name=>{table_(name).getRange(1,1,1,SCHEMA[name].length).setValues([SCHEMA[name]]);});",context);
 vm.runInContext("upsertMany_('Users',[{id:'staff@example.test',email:'staff@example.test',name:'Staff',role:'ADMIN',active:true}]);upsertMany_('Clients',[{id:'C1',name:'Client',currency:'AED',active:true}]);upsertMany_('Products',[{id:'P1',clientId:'C1',article:'A1',description:'Item',serialized:false,expiryRequired:false,active:true}]);upsertMany_('Locations',[{id:'R1',zone:'A',active:true}]);",context);
 return {request(action,input,requestId='idempotent-request-1234'){const payload=JSON.stringify({action,input,requestId,email:'staff@example.test',timestamp:Date.now()});context.envelope={postData:{contents:JSON.stringify({payload,signature:crypto.createHmac('sha256','a'.repeat(32)).update(payload).digest('base64url')})}};return vm.runInContext('doPost(envelope)',context);},fail(name){failTable=name;},read(name){return vm.runInContext(`read_('${name}')`,context);}};
}
test('journal recovers an interrupted multi-sheet inbound write without duplicating stock',()=>{
 const g=gateway();const input={clientId:'C1',reference:'RECEIPT-1',rows:[{article:'A1',qty:2,location:'R1'}]};g.fail('Receiving');const first=g.request('inbound.post',input);assert.equal(first.ok,false);assert.equal(g.read('Transactions')[0].status,'PREPARED');assert.equal(g.read('Movements').length,1);
 const retried=g.request('inbound.post',input);assert.equal(retried.ok,true);assert.equal(g.read('Movements').length,1);assert.equal(g.read('Transactions')[0].status,'COMMITTED');const snapshot=g.request('snapshot',{},'snapshot-request-9876');assert.equal(snapshot.data.stock[0].qty,2);
 const third=g.request('inbound.post',input);assert.equal(third.ok,true);assert.equal(g.read('Movements').length,1);
 const changed=g.request('inbound.post',{...input,rows:[{article:'A1',qty:3,location:'R1'}]});assert.equal(changed.ok,false);assert.match(changed.error,/different data/);
});
test('product imports persist device columns and retry without duplicate devices',()=>{
 const g=gateway();const input={clientId:'C1',rows:[{article:'PHONE',description:'Phone',supplier:'V',model:'M',colour:'Blue',imei1:'000001',imei2:'000002',serial:'000S',barcode:'000UPC',outboundImei:'000OUT',tracking:'000TRACK',carton:'000BOX'},{article:'PHONE',description:'Phone',supplier:'V',imei1:'000003',serial:'000S2'}]};
 const result=g.request('products.import',input);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(g.read('Products').filter(p=>p.article==='PHONE').length,1);assert.equal(g.read('ProductUnits').length,2);assert.equal(g.read('ProductUnits')[0].imei1,'000001');assert.equal(g.read('ProductUnits')[0].carton,'000BOX');assert.equal(g.read('Products').find(p=>p.article==='PHONE').supplier,'V');assert.equal(g.request('products.import',input).ok,true);assert.equal(g.read('ProductUnits').length,2);
});
