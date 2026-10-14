import test from 'node:test';import assert from 'node:assert/strict';
import {execute,stock,balances,TABLES,publicState} from '../core/engine.mjs';
const admin={email:'admin@example.test',role:'ADMIN',active:true};const now='2026-10-13T08:00:00Z';
function workspace(){const state=Object.fromEntries(TABLES.map(t=>[t,[]]));let counter=0;return {get state(){return state;},run(action,input,user=admin){const plan=execute(state,user,action,input,'testrequest'+(++counter),now);for(const {table,row} of plan.ops){const i=state[table].findIndex(r=>r.id===row.id);if(i>=0)state[table][i]=row;else state[table].push(row);}return plan.result;}};}
function ready(){const w=workspace();w.run('client.save',{id:'C1',name:'Client One',currency:'AED'});w.run('client.save',{id:'C2',name:'Other client',currency:'AED'});w.run('location.save',{id:'R1',zone:'A'});w.run('product.save',{id:'P1',clientId:'C1',article:'A1',description:'Quantity item',barcode:'00123'});w.run('product.save',{id:'P2',clientId:'C1',article:'A2',description:'Serialized item',serialized:true});return w;}
test('complete receive → allocate → pick → pack → shipment → return workflow',()=>{
 const w=ready();w.run('inbound.post',{clientId:'C1',reference:'IN-1',rows:[{article:'A1',qty:10,location:'R1'}]});assert.equal(stock(w.state)[0].qty,10);
 w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'A1',qty:3}]});const order=w.state.Orders[0];w.run('pick.allocate',{orderId:order.id});const pick=w.state.Picks[0];assert.equal(stock(w.state)[0].available,7);assert.equal(stock(w.state)[0].qty,10);
 assert.throws(()=>w.run('pack.scan',{pickId:pick.id,tracking:'T1',code:'00123',qty:3}),/Pick the items/);
 w.run('pick.confirm',{pickId:pick.id,code:'00123',qty:3});assert.throws(()=>w.run('pack.scan',{pickId:pick.id,tracking:'WRONG',code:'00123',qty:3}),/tracking label/);w.run('pack.scan',{pickId:pick.id,tracking:'T1',code:'00123',qty:3});
 const shipment=w.run('shipment.create',{orderIds:[order.id],reference:'CONTAINER-1',carrier:'Carrier'});assert.equal(stock(w.state)[0].qty,10);
 w.run('shipment.dispatch',{shipmentId:shipment.id});assert.equal(stock(w.state)[0].qty,7);assert.equal(stock(w.state)[0].reserved,0);assert.equal(w.state.Orders[0].status,'SHIPPED');
 assert.throws(()=>w.run('shipment.dispatch',{shipmentId:shipment.id}),/already dispatched/);
 w.run('return.receive',{pickId:pick.id,qty:1,reason:'Customer return'});assert.equal(stock(w.state)[0].qty,8);assert.throws(()=>w.run('return.receive',{pickId:pick.id,qty:3,reason:'Duplicate return'}),/exceeds shipped/);
});
test('serialized validation, duplicate prevention, wrong scans and quarantined returns',()=>{
 const w=ready();assert.throws(()=>w.run('inbound.post',{clientId:'C1',reference:'S0',rows:[{article:'A2',qty:2,location:'R1',serial:'SER1'}]}),/quantity 1/);
 w.run('inbound.post',{clientId:'C1',reference:'S1',rows:[{article:'A2',qty:1,location:'R1',serial:'SER1'}]});
 assert.throws(()=>w.run('inbound.post',{clientId:'C1',reference:'S2',rows:[{article:'A2',qty:1,location:'R1',serial:'SER1'}]}),/already received/);
 w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'A2',qty:1}]});w.run('pick.allocate',{orderId:w.state.Orders[0].id});const p=w.state.Picks[0];assert.throws(()=>w.run('pick.confirm',{pickId:p.id,code:'A2'}),/does not match/);w.run('pick.confirm',{pickId:p.id,code:'SER1'});w.run('pack.scan',{pickId:p.id,tracking:'T1',code:'SER1'});const s=w.run('shipment.create',{orderIds:[w.state.Orders[0].id],reference:'S',carrier:'C'});w.run('shipment.dispatch',{shipmentId:s.id});w.run('return.receive',{pickId:p.id,qty:1,damaged:true,reason:'Damaged'});assert.equal(stock(w.state).find(s=>s.blocked).qty,1);
});
test('FEFO, expired stock, shortages and reservations',()=>{
 const w=ready();w.run('product.save',{id:'P1',clientId:'C1',article:'A1',description:'Expiry item',expiryRequired:true});
 assert.throws(()=>w.run('inbound.post',{clientId:'C1',reference:'X',rows:[{article:'A1',qty:1,location:'R1',batch:'B',expiry:'2025-01-01'}]}),/Expired/);
 w.run('inbound.post',{clientId:'C1',reference:'R',rows:[{article:'A1',qty:5,location:'R1',batch:'LATE',expiry:'2028-01-01'},{article:'A1',qty:2,location:'R1',batch:'EARLY',expiry:'2027-01-01'}]});
 w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'A1',qty:3},{orderNo:'O2',tracking:'T2',article:'A1',qty:5}]});w.run('pick.allocate',{orderId:w.state.Orders[0].id});assert.ok(w.state.Picks[0].stockKey.includes('EARLY'));assert.equal(w.state.Picks[0].qty,2);assert.throws(()=>w.run('pick.allocate',{orderId:w.state.Orders[1].id}),/Insufficient/);assert.throws(()=>w.run('stock.adjust',{stockKey:w.state.Picks[0].stockKey,qty:-1,reason:'count'}),/reserved/);
});
test('client isolation, roles, approved mappings and cancellation',()=>{
 const w=ready();assert.throws(()=>w.run('inbound.post',{clientId:'C2',reference:'X',rows:[{productId:'P1',qty:1,location:'R1'}]}),/does not belong/);
 assert.throws(()=>w.run('client.save',{id:'X',name:'X'},{email:'viewer@example.test',role:'VIEWER',active:true}),/role/);
 w.run('mapping.save',{assemblyArticle:'MULTI',productId:'P1',units:2,approved:false});assert.throws(()=>w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'MULTI',qty:1}]}),/unapproved/);
 w.run('mapping.save',{...w.state.Mappings[0],approved:true});w.run('inbound.post',{clientId:'C1',reference:'R',rows:[{article:'A1',qty:5,location:'R1'}]});w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'MULTI',qty:1}]});assert.equal(w.state.Orders[0].qty,2);w.run('pick.allocate',{orderId:w.state.Orders[0].id});w.run('order.cancel',{orderId:w.state.Orders[0].id,reason:'Customer cancelled'});assert.equal(stock(w.state)[0].available,5);
});
test('invoices use minor currency units and reject overpayments',()=>{
 const w=ready();const i=w.run('invoice.create',{clientId:'C1',direction:'RECEIVABLE',invoiceNo:'INV1',currency:'AED',issuedDate:'2026-10-13',dueDate:'2026-11-13',items:[{description:'Handling',qty:3,unitPrice:12.50,taxRate:5}]});assert.equal(i.totalMinor,3938);
 w.run('payment.record',{invoiceId:i.id,amount:20,reference:'BANK1',method:'BANK',date:'2026-10-13'});assert.equal(balances(w.state)[0].balanceMinor,1938);
 assert.throws(()=>w.run('payment.record',{invoiceId:i.id,amount:1,reference:'BANK1',method:'BANK',date:'2026-10-13'}),/already exists/);
 assert.throws(()=>w.run('payment.record',{invoiceId:i.id,amount:20,reference:'BANK2',method:'BANK',date:'2026-10-13'}),/exceeds/);
 assert.throws(()=>w.run('payment.record',{invoiceId:i.id,amount:0.001,reference:'B',method:'BANK',date:'2026-10-13'}),/two decimal/);
 const visible=publicState(w.state,{role:'PICKER'});assert.deepEqual(visible.Invoices,[]);assert.deepEqual(visible.Payments,[]);
});
test('200-line manifest dispatch and zero scan quantity rejection',()=>{
 const w=ready();w.run('inbound.post',{clientId:'C1',reference:'CONTAINER-IN',rows:[{article:'A1',qty:250,location:'R1'}]});
 w.run('orders.import',{clientId:'C1',rows:Array.from({length:200},(_,i)=>({orderNo:'ORDER'+i,tracking:'TRACK'+i,article:'A1',qty:1}))});w.run('pick.allocate.batch',{orderIds:w.state.Orders.map(o=>o.id)});
 assert.throws(()=>w.run('pick.confirm',{pickId:w.state.Picks[0].id,code:'A1',qty:0}),/greater than zero/);
 for(const p of [...w.state.Picks]){w.run('pick.confirm',{pickId:p.id,code:'A1',qty:1});w.run('pack.scan',{pickId:p.id,tracking:w.state.Orders.find(o=>o.id===p.orderId).tracking,code:'A1',qty:1});}
 const shipment=w.run('shipment.create',{orderIds:w.state.Orders.map(o=>o.id),reference:'CONTAINER-PART-1',carrier:'Freight'});w.run('shipment.dispatch',{shipmentId:shipment.id});assert.equal(stock(w.state)[0].qty,50);assert.equal(w.state.Movements.filter(m=>m.type==='OUTBOUND').length,200);assert.ok(w.state.Orders.every(o=>o.status==='SHIPPED'));
});
test('all-or-nothing validation, same deterministic request plan, and duplicate import references',()=>{
 const w=ready(),payload={clientId:'C1',reference:'R1',rows:[{article:'A1',qty:2,location:'R1'}]};const a=execute(w.state,admin,'inbound.post',payload,'stable-request',now),b=execute(w.state,admin,'inbound.post',payload,'stable-request',now);assert.deepEqual(a,b);
 assert.throws(()=>w.run('inbound.post',{...payload,rows:[...payload.rows,{article:'MISSING',qty:2,location:'R1'}]}),/does not belong/);assert.equal(w.state.Movements.length,0);
 w.run('inbound.post',payload);assert.throws(()=>w.run('inbound.post',payload),/already posted/);
});
test('bulk batch supports 200 rows and rejects oversized requests',()=>{
 const w=ready();w.run('inbound.post',{clientId:'C1',reference:'BULK',rows:Array.from({length:200},()=>({article:'A1',qty:1,location:'R1'}))});assert.equal(stock(w.state)[0].qty,200);
 assert.throws(()=>w.run('inbound.post',{clientId:'C1',reference:'BIG',rows:Array.from({length:201},()=>({article:'A1',qty:1,location:'R1'}))}),/200/);
});
test('bulk allocation is atomic and respects quantities reserved within the same batch',()=>{
 const w=ready();w.run('inbound.post',{clientId:'C1',reference:'R',rows:[{article:'A1',qty:3,location:'R1'}]});w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O1',tracking:'T1',article:'A1',qty:2},{orderNo:'O2',tracking:'T2',article:'A1',qty:2}]});const ids=w.state.Orders.map(o=>o.id);assert.throws(()=>w.run('pick.allocate.batch',{orderIds:ids}),/Insufficient/);assert.equal(w.state.Picks.length,0);
 w.run('stock.adjust',{stockKey:stock(w.state)[0].stockKey,qty:1,reason:'Count corrected'});w.run('pick.allocate.batch',{orderIds:ids});assert.equal(stock(w.state)[0].available,0);assert.equal(w.state.Picks.length,2);
});
test('location transfers preserve total stock and reject cross-client or reserved quantities',()=>{
 const w=ready();w.run('location.save',{id:'R2',zone:'B'});w.run('location.save',{id:'OTHER',zone:'C',clientId:'C2'});w.run('inbound.post',{clientId:'C1',reference:'IN',rows:[{article:'A1',qty:10,location:'R1'}]});const key=stock(w.state)[0].stockKey;
 assert.throws(()=>w.run('stock.transfer',{stockKey:key,location:'OTHER',qty:1,reference:'TR1'}),/another client/);w.run('stock.transfer',{stockKey:key,location:'R2',qty:4,reference:'TR2'});assert.equal(stock(w.state).reduce((s,r)=>s+r.qty,0),10);assert.equal(stock(w.state).find(r=>r.location==='R2').qty,4);
 w.run('orders.import',{clientId:'C1',rows:[{orderNo:'O',tracking:'T',article:'A1',qty:10}]});w.run('pick.allocate',{orderId:w.state.Orders[0].id});assert.throws(()=>w.run('stock.transfer',{stockKey:key,location:'R2',qty:1,reference:'TR3'}),/unreserved/);
});
