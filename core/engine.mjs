export const TABLES = ['Users','Clients','Locations','Products','Mappings','Receiving','Movements','Orders','Picks','Scans','Shipments','Returns','Invoices','Payments','Documents','Audit'];
export const ROLES = ['ADMIN','MANAGER','INBOUND','PICKER','PACKER','DISPATCH','FINANCE','VIEWER'];
export class WmsError extends Error { constructor(message,code='VALIDATION'){super(message);this.code=code;} }
const fail=(message,code)=>{throw new WmsError(message,code);};
const num=(v,label)=>{const n=Number(v);if(v===''||v==null||!Number.isFinite(n))fail(`${label} must be a number.`);return n;};
const positive=(v,label)=>{const n=num(v,label);if(n<=0||n>1e8)fail(`${label} must be greater than zero and within the supported range.`);if(Math.abs(n*1000-Math.round(n*1000))>1e-5)fail(`${label} supports at most three decimal places.`);return n;};
const text=(v,label,max=200)=>{const s=String(v??'').trim();if(!s||s.length>max)fail(`${label} is required (maximum ${max} characters).`);return s;};
const optional=v=>String(v??'').trim();
const date=(v,label)=>{const s=text(v,label);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s).toISOString().slice(0,10)!==s)fail(`${label} must be YYYY-MM-DD.`);return s;};
const active=(rows,id,label)=>{const r=rows.find(x=>x.id===id&&x.active!==false);if(!r)fail(`${label} was not found or is inactive: ${id}`);return r;};
const money=v=>{const n=positive(v,'Amount'),minor=Math.round(n*100);if(!minor||Math.abs(n*100-minor)>1e-6)fail('Payment amounts must use at most two decimal places.');return minor;};
export const day=iso=>new Date(new Date(iso).getTime()+4*3600000).toISOString().slice(0,10);
export function stock(state){
 const map=new Map();for(const m of state.Movements||[]){let r=map.get(m.stockKey);if(!r){r={stockKey:m.stockKey,clientId:m.clientId,productId:m.productId,article:m.article,location:m.location,batch:m.batch||'',expiry:m.expiry||'',serial:m.serial||'',blocked:Boolean(m.blocked),qty:0};map.set(m.stockKey,r);}r.qty=Math.round((r.qty+Number(m.qty))*1000)/1000;}
 for(const r of map.values()){r.reserved=(state.Picks||[]).filter(p=>p.stockKey===r.stockKey&&!['SHIPPED','CANCELLED'].includes(p.status)).reduce((s,p)=>s+p.qty,0);r.available=Math.round((r.qty-r.reserved)*1000)/1000;}
 return [...map.values()];
}
export function balances(state){return (state.Invoices||[]).map(i=>{const paid=(state.Payments||[]).filter(p=>p.invoiceId===i.id).reduce((s,p)=>s+p.amountMinor,0);return {...i,paidMinor:paid,balanceMinor:i.totalMinor-paid};});}
export function publicState(state,user){
 const result={};for(const name of TABLES)result[name]=(state[name]||[]).map(r=>({...r}));
 if(!['ADMIN','MANAGER','FINANCE'].includes(user.role)){result.Invoices=[];result.Payments=[];result.Documents=result.Documents.filter(d=>d.kind!=='INVOICE');}
 if(user.role!=='ADMIN')result.Users=[];
 result.staff=(state.Users||[]).filter(u=>u.active!==false&&['ADMIN','MANAGER','PICKER'].includes(u.role)).map(u=>({email:u.email,name:u.name,role:u.role}));
 if(!['ADMIN','MANAGER'].includes(user.role))result.Audit=[];
 result.stock=stock(state);result.balances=balances(result);result.user=user;return result;
}
export function execute(initial,user,action,input,requestId,now=new Date().toISOString()){
 if(!user||user.active===false||!ROLES.includes(user.role))fail('An active staff account is required.','FORBIDDEN');
 const state={};for(const table of TABLES)state[table]=(initial[table]||[]).map(r=>({...r}));
 const ops=[];let seq=0;const today=day(now);
 const id=prefix=>`${prefix}-${requestId}-${++seq}`;
 const allow=roles=>{if(!roles.includes(user.role))fail('Your role does not allow this action.','FORBIDDEN');};
 const put=(table,row)=>{const index=state[table].findIndex(r=>r.id===row.id);if(index>=0)state[table][index]=row;else state[table].push(row);ops.push({table,row});return row;};
 const move=(r,qty,type,reference)=>put('Movements',{id:id('MOV'),...r,qty,type,reference,at:now,by:user.email});
 const get=(table,key)=>{const row=state[table].find(r=>r.id===key);if(!row)fail(`${table} record not found.`);return row;};
 const master=['ADMIN','MANAGER'];let result={};
 if(action==='client.save'){
  allow(master);const key=text(input.id,'Client ID');result=put('Clients',{id:key,name:text(input.name,'Client name'),contact:optional(input.contact),currency:text(input.currency||'AED','Currency',3).toUpperCase(),active:input.active!==false});
 }else if(action==='location.save'){
  allow(master);result=put('Locations',{id:text(input.id,'Location code'),zone:text(input.zone||'GENERAL','Zone'),clientId:optional(input.clientId),active:input.active!==false});if(result.clientId)active(state.Clients,result.clientId,'Client');
 }else if(action==='product.save'){
  allow(master);active(state.Clients,input.clientId,'Client');const article=text(input.article,'Article');const key=input.id||id('PRD');
  const previous=state.Products.find(p=>p.id===key);if(previous&&previous.clientId!==input.clientId)fail('A product cannot be moved to another client. Create a new product instead.');
  if(previous&&previous.serialized!==Boolean(input.serialized)&&stock(state).some(s=>s.productId===key&&s.qty>0))fail('Tracking mode cannot change while this product has stock.');
  if(state.Products.some(p=>p.clientId===input.clientId&&p.article===article&&p.id!==key))fail('This article already exists for this client.');
  result=put('Products',{id:key,clientId:input.clientId,article,description:text(input.description,'Description',500),barcode:optional(input.barcode),serialized:Boolean(input.serialized),expiryRequired:Boolean(input.expiryRequired),active:input.active!==false});
 }else if(action==='mapping.save'){
  allow(master);const p=active(state.Products,input.productId,'Product');const units=positive(input.units,'Component quantity');result=put('Mappings',{id:input.id||id('MAP'),clientId:p.clientId,assemblyArticle:text(input.assemblyArticle,'Assembly article'),productId:p.id,units,approved:input.approved===true});
 }else if(action==='user.save'){
  allow(['ADMIN']);const email=text(input.email,'Email').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!ROLES.includes(input.role))fail('Enter a valid email and role.');
  if(email===user.email&&(input.role!=='ADMIN'||input.active===false))fail('You cannot remove your own administrator access.');
  result=put('Users',{id:email,email,name:text(input.name,'Name'),role:input.role,active:input.active!==false});
 }else if(action==='receiving.save'){
  allow([...master,'INBOUND']);active(state.Clients,input.clientId,'Client');const expected=num(input.expected,'Expected'),received=num(input.received,'Received'),damaged=num(input.damaged||0,'Damaged');if(expected<0||received<0||damaged<0||damaged>received)fail('Invalid receiving quantities.');
  result=put('Receiving',{id:id('RCV'),clientId:input.clientId,reference:text(input.reference,'Reference'),expected,received,damaged,status:damaged?'DAMAGED':received<expected?'SHORT':received>expected?'EXCESS':'PASSED',at:now,by:user.email});
 }else if(action==='inbound.post'){
  allow([...master,'INBOUND']);const client=active(state.Clients,input.clientId,'Client');const rows=input.rows;if(!Array.isArray(rows)||!rows.length||rows.length>200)fail('Post between 1 and 200 rows per batch.');
  if(state.Receiving.some(r=>r.clientId===client.id&&r.reference===input.reference&&r.status==='POSTED'))fail('This inbound reference was already posted. Check stock before importing again.');
  let qtyTotal=0;for(const row of rows){const p=row.productId?active(state.Products,row.productId,'Product'):state.Products.find(p=>p.clientId===client.id&&p.article===optional(row.article)&&p.active!==false);if(!p||p.clientId!==client.id)fail(`Product does not belong to this client: ${row.article||row.productId}`);
   const qty=positive(row.qty,'Quantity');const loc=active(state.Locations,row.location,'Location');if(loc.clientId&&loc.clientId!==client.id)fail(`Location ${loc.id} belongs to another client.`);
   const serial=optional(row.serial),batch=optional(row.batch),expiry=row.expiry?date(row.expiry,'Expiry'):'';
   if(p.serialized&&(!serial||qty!==1))fail(`${p.article} needs a serial/IMEI and quantity 1.`);
   if(p.expiryRequired&&(!batch||!expiry))fail(`${p.article} requires batch and expiry.`);if(expiry&&expiry<=today)fail('Expired stock cannot be received.');
   if(serial&&state.Movements.some(m=>m.clientId===client.id&&m.serial===serial&&m.type==='INBOUND'))fail(`Serial ${serial} was already received. Use Returns for returned goods.`);
   const key=['STK',client.id,p.id,loc.id,batch,expiry,serial].map(encodeURIComponent).join('|');
   move({stockKey:key,clientId:client.id,productId:p.id,article:p.article,location:loc.id,batch,expiry,serial,blocked:false},qty,'INBOUND',text(input.reference,'Reference'));qtyTotal+=qty;
  }
  result=put('Receiving',{id:id('RCV'),clientId:client.id,reference:input.reference,expected:qtyTotal,received:qtyTotal,damaged:0,status:'POSTED',at:now,by:user.email});
 }else if(action==='stock.adjust'){
  allow(master);const s=stock(state).find(r=>r.stockKey===input.stockKey);if(!s)fail('Stock position not found.');const delta=num(input.qty,'Adjustment');if(Math.abs(delta)>1e8||Math.abs(delta*1000-Math.round(delta*1000))>1e-5)fail('Adjustment is outside supported quantity precision or range.');if(!delta||s.available+delta<0)fail('Adjustment cannot reduce stock below reserved quantities.');if(s.serial&&(delta!==-1&&delta!==1))fail('Serialized adjustment must be one unit.');if(s.serial&&(s.qty+delta<0||s.qty+delta>1))fail('Invalid serialized balance.');move(s,delta,'ADJUSTMENT',text(input.reason,'Adjustment reason',500));result={adjusted:delta};
 }else if(action==='stock.transfer'){
  allow([...master,'INBOUND']);const s=stock(state).find(r=>r.stockKey===input.stockKey);if(!s)fail('Stock position not found.');const loc=active(state.Locations,input.location,'Destination location');if(loc.clientId&&loc.clientId!==s.clientId)fail('Destination location belongs to another client.');if(loc.id===s.location)fail('Choose a different destination location.');const qty=positive(input.qty,'Transfer quantity');if(qty>s.available||s.blocked)fail('Only unreserved, non-quarantined stock can be transferred.');if(s.serial&&qty!==1)fail('Transfer a serialized unit individually.');const reference=text(input.reference,'Transfer reference');const destination={...s,location:loc.id,stockKey:['STK',s.clientId,s.productId,loc.id,s.batch,s.expiry,s.serial].map(encodeURIComponent).join('|')};move(s,-qty,'TRANSFER_OUT',reference);move(destination,qty,'TRANSFER_IN',reference);result={transferred:qty};
 }else if(action==='orders.import'){
  allow(master);active(state.Clients,input.clientId,'Client');if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>200)fail('Import between 1 and 200 rows per batch.');let count=0;
  for(const line of input.rows){const orderNo=text(line.orderNo,'Order number'),tracking=text(line.tracking,'Tracking');const quantity=positive(line.qty,'Quantity');const article=text(line.article,'Article');
   const maps=state.Mappings.filter(m=>m.clientId===input.clientId&&m.assemblyArticle===article);if(maps.some(m=>!m.approved))fail(`Assembly ${article} has an unapproved mapping.`);
   const components=maps.length?maps: [{productId:state.Products.find(p=>p.clientId===input.clientId&&p.article===article&&p.active!==false)?.id,units:1}];
   for(const component of components){const p=active(state.Products,component.productId,'Product');const qty=quantity*component.units;if(p.serialized&&!Number.isInteger(qty))fail('Serialized order quantities must be whole units.');
    if(state.Orders.some(o=>o.orderNo===orderNo&&o.productId===p.id&&o.clientId===input.clientId))fail(`Duplicate order line ${orderNo} / ${p.article}.`);
    put('Orders',{id:id('ORD'),clientId:input.clientId,orderNo,tracking,productId:p.id,article:p.article,qty,status:'NEW',at:now});count++;
   }
  }result={imported:count};
 }else if(action==='pick.allocate'){
  allow(master);const order=get('Orders',input.orderId);if(order.status!=='NEW')fail('Only new order lines can be allocated.');let needed=order.qty;
  const choices=stock(state).filter(s=>s.productId===order.productId&&s.clientId===order.clientId&&s.available>0&&!s.blocked&&(!s.expiry||s.expiry>today)).sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999')||a.stockKey.localeCompare(b.stockKey));
  if(choices.reduce((sum,s)=>sum+s.available,0)<needed)fail(`Insufficient available stock for ${order.article}.`);
  if(input.assignedTo&&!state.Users.some(u=>u.email===input.assignedTo&&u.active!==false&&['PICKER','MANAGER','ADMIN'].includes(u.role)))fail('Choose an active picker.');
  for(const s of choices){if(needed<=0)break;const qty=Math.min(needed,s.available);put('Picks',{id:id('PICK'),orderId:order.id,stockKey:s.stockKey,clientId:order.clientId,article:order.article,qty,pickedQty:0,packedQty:0,status:'RESERVED',assignedTo:input.assignedTo||'',location:s.location,at:now});needed-=qty;}
  put('Orders',{...order,status:'ALLOCATED'});result={allocated:order.qty};
 }else if(action==='pick.allocate.batch'){
  allow(master);if(!Array.isArray(input.orderIds)||!input.orderIds.length||input.orderIds.length>200)fail('Allocate 1 to 200 order lines per batch.');let allocated=0;
  for(const [index,orderId] of input.orderIds.entries()){const plan=execute(state,user,'pick.allocate',{orderId,assignedTo:input.assignedTo||''},requestId+'-'+index,now);for(const op of plan.ops)put(op.table,op.row);allocated++;}result={allocated};
 }else if(action==='pick.confirm'||action==='pack.scan'){
  allow(action==='pick.confirm'?[...master,'PICKER']:[...master,'PACKER']);const pick=get('Picks',input.pickId);if(['SHIPPED','CANCELLED'].includes(pick.status))fail('Pick task is closed.');if(action==='pick.confirm'&&pick.assignedTo&&pick.assignedTo!==user.email&&!master.includes(user.role))fail('This task is assigned to another picker.');
  const order=get('Orders',pick.orderId),p=active(state.Products,order.productId,'Product'),s=stock(state).find(s=>s.stockKey===pick.stockKey);if(!s||s.blocked||s.expiry&&s.expiry<=today)fail('This stock position cannot be fulfilled.');
  if(action==='pack.scan'&&input.tracking!==order.tracking)fail('Scanned tracking label does not match this order.');
  const code=text(input.code,'Scanned code');if(!(s.serial?[s.serial]:[p.article,p.barcode].filter(Boolean)).includes(code))fail('Scanned code does not match this stock position.');const qty=positive(input.qty??1,'Scan quantity');
  if(p.serialized&&qty!==1)fail('Scan serialized items individually.');const field=action==='pick.confirm'?'pickedQty':'packedQty';if(pick[field]+qty>pick.qty)fail('Scan exceeds required quantity.');if(field==='packedQty'&&pick.packedQty+qty>pick.pickedQty)fail('Pick the items before packing.');
  const updated={...pick,[field]:pick[field]+qty};updated.status=updated.packedQty===updated.qty?'PACKED':updated.pickedQty===updated.qty?'PICKED':'RESERVED';put('Picks',updated);put('Scans',{id:id('SCAN'),pickId:pick.id,orderId:order.id,tracking:order.tracking,code,qty,stage:field==='pickedQty'?'PICK':'PACK',at:now,by:user.email});
  const all=state.Picks.filter(p=>p.orderId===order.id);if(all.every(p=>p.packedQty===p.qty))put('Orders',{...order,status:'PACKED'});result=updated;
 }else if(action==='order.cancel'){
  allow(master);const order=get('Orders',input.orderId);if(['SHIPPED','CANCELLED','MANIFESTED'].includes(order.status))fail('This order cannot be cancelled.');for(const pick of state.Picks.filter(p=>p.orderId===order.id))put('Picks',{...pick,status:'CANCELLED'});put('Orders',{...order,status:'CANCELLED',reason:text(input.reason,'Reason')});result={cancelled:true};
 }else if(action==='shipment.create'){
  allow([...master,'DISPATCH']);const ids=input.orderIds;if(!Array.isArray(ids)||!ids.length||ids.length>200)fail('Select 1 to 200 order lines per shipment.');const lines=ids.map(key=>get('Orders',key));const client=lines[0].clientId;if(lines.some(o=>o.clientId!==client||o.status!=='PACKED'))fail('All selected lines must be packed and belong to one client.');
  if(state.Shipments.some(s=>s.clientId===client&&s.reference===input.reference))fail('Shipment reference already exists for this client.');
  const shipment=put('Shipments',{id:id('SHP'),clientId:client,reference:text(input.reference,'Shipment reference'),carrier:text(input.carrier,'Carrier'),tracking:optional(input.tracking),orderIds:[...new Set(ids)],status:'READY',at:now,by:user.email});for(const o of lines)put('Orders',{...o,status:'MANIFESTED',shipmentId:shipment.id});result=shipment;
 }else if(action==='shipment.dispatch'){
  allow([...master,'DISPATCH']);const shipment=get('Shipments',input.shipmentId);if(shipment.status!=='READY')fail('Shipment already dispatched or not ready.');
  for(const orderId of shipment.orderIds){const order=get('Orders',orderId);const picks=state.Picks.filter(p=>p.orderId===order.id);if(!picks.length||picks.some(p=>p.packedQty!==p.qty||p.status!=='PACKED'))fail('Every item must be picked and packed before dispatch.');
   for(const pick of picks){const s=stock(state).find(s=>s.stockKey===pick.stockKey);if(!s||s.qty<pick.qty||s.blocked||s.expiry&&s.expiry<=today)fail('Dispatch stock check failed.');move(s,-pick.qty,'OUTBOUND',shipment.id);put('Picks',{...pick,status:'SHIPPED'});}put('Orders',{...order,status:'SHIPPED'});
  }result=put('Shipments',{...shipment,status:'SHIPPED',shippedAt:now});
 }else if(action==='return.receive'){
  allow([...master,'INBOUND']);const pick=get('Picks',input.pickId);if(pick.status!=='SHIPPED')fail('Returns must reference a shipped pick task.');const qty=positive(input.qty,'Return quantity');const previous=state.Returns.filter(r=>r.pickId===pick.id).reduce((s,r)=>s+r.qty,0);if(previous+qty>pick.qty)fail('Returned quantity exceeds shipped quantity.');const s=stock(state).find(s=>s.stockKey===pick.stockKey);const damaged=input.damaged===true;const returned={...s,stockKey:damaged?s.stockKey+'|QUARANTINE':s.stockKey,blocked:damaged};move(returned,qty,'RETURN',pick.id);result=put('Returns',{id:id('RET'),pickId:pick.id,clientId:pick.clientId,qty,damaged,reason:text(input.reason,'Return reason'),at:now,by:user.email});
 }else if(action==='invoice.create'){
  allow([...master,'FINANCE']);active(state.Clients,input.clientId,'Client');const direction=input.direction;if(!['RECEIVABLE','PAYABLE'].includes(direction))fail('Choose receivable or payable.');const invoiceNo=text(input.invoiceNo,'Invoice number');if(state.Invoices.some(i=>i.clientId===input.clientId&&i.invoiceNo===invoiceNo&&i.direction===direction))fail('Invoice number already exists for this client.');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Add between 1 and 100 invoice lines.');let subtotalMinor=0,taxMinor=0;const items=input.items.map(i=>{const qty=positive(i.qty,'Invoice quantity');const price=num(i.unitPrice,'Unit price');const taxRate=num(i.taxRate||0,'Tax rate');if(price<0||price>1e8||taxRate<0||taxRate>100)fail('Invalid price or tax rate.');const lineMinor=Math.round(qty*price*100),lineTax=Math.round(lineMinor*taxRate/100);subtotalMinor+=lineMinor;taxMinor+=lineTax;return {description:text(i.description,'Item description',500),qty,unitPrice:price,taxRate,lineMinor,lineTax};});if(subtotalMinor+taxMinor<=0||!Number.isSafeInteger(subtotalMinor+taxMinor))fail('Invoice total is outside the supported positive monetary range.');
  const issued=date(input.issuedDate,'Invoice date'),due=date(input.dueDate,'Due date');if(due<issued)fail('Due date cannot precede invoice date.');result=put('Invoices',{id:id('INV'),clientId:input.clientId,direction,invoiceNo,currency:text(input.currency||'AED','Currency',3).toUpperCase(),issuedDate:issued,dueDate:due,items,subtotalMinor,taxMinor,totalMinor:subtotalMinor+taxMinor,status:'ISSUED',at:now,by:user.email});
 }else if(action==='payment.record'){
  allow([...master,'FINANCE']);const invoice=get('Invoices',input.invoiceId);const amountMinor=money(input.amount);const reference=text(input.reference,'Payment reference');if(state.Payments.some(p=>p.invoiceId===invoice.id&&p.reference===reference))fail('This payment reference already exists for the invoice.');const balance=balances(state).find(i=>i.id===invoice.id).balanceMinor;if(invoice.status==='VOID'||amountMinor>balance)fail('Payment exceeds the unpaid invoice balance.');result=put('Payments',{id:id('PAY'),invoiceId:invoice.id,clientId:invoice.clientId,amountMinor,currency:invoice.currency,direction:invoice.direction,reference,method:text(input.method,'Payment method'),date:date(input.date,'Payment date'),at:now,by:user.email});
 }else if(action==='document.record'){
  allow([...master,'INBOUND','DISPATCH','FINANCE']);active(state.Clients,input.clientId,'Client');if(input.invoiceId){allow([...master,'FINANCE']);const i=get('Invoices',input.invoiceId);if(i.clientId!==input.clientId)fail('Invoice belongs to another client.');}if(input.shipmentId&&get('Shipments',input.shipmentId).clientId!==input.clientId)fail('Shipment belongs to another client.');
  result=put('Documents',{id:input.id||id('DOC'),clientId:input.clientId,invoiceId:optional(input.invoiceId),shipmentId:optional(input.shipmentId),kind:input.invoiceId?'INVOICE':text(input.kind||'DOCUMENT','Kind'),name:text(input.name,'Filename'),fileId:text(input.fileId,'Drive file ID'),mime:text(input.mime,'MIME type'),size:positive(input.size,'File size'),at:now,by:user.email});
 }else fail('Unknown action.');
 put('Audit',{id:id('AUDIT'),action,by:user.email,role:user.role,at:now,requestId,records:ops.length});return {ops,result};
}
