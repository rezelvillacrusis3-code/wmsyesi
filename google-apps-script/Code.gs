/* Engine.gs is generated from core/engine.mjs. Deploy both files in one Apps Script project. */
var SCHEMA = {
 Users:['id','email','name','role','active'],
 Clients:['id','name','contact','currency','active'],
 Locations:['id','zone','clientId','active'],
 Products:['id','clientId','article','description','barcode','serialized','expiryRequired','active','supplier','model','colour'],
 ProductUnits:['id','clientId','productId','imei1','imei2','serial','outboundImei','tracking','carton'],
 Mappings:['id','clientId','assemblyArticle','productId','units','approved'],
 Receiving:['id','clientId','reference','expected','received','damaged','status','at','by'],
 Movements:['id','stockKey','clientId','productId','article','location','batch','expiry','serial','blocked','qty','type','reference','at','by'],
 Orders:['id','clientId','orderNo','tracking','productId','article','qty','status','at','shipmentId','reason'],
 Picks:['id','orderId','stockKey','clientId','article','qty','pickedQty','packedQty','status','assignedTo','location','at'],
 Scans:['id','pickId','orderId','tracking','code','qty','stage','at','by'],
 Shipments:['id','clientId','reference','carrier','tracking','orderIds','status','at','by','shippedAt'],
 Returns:['id','pickId','clientId','qty','damaged','reason','at','by'],
 Invoices:['id','clientId','direction','invoiceNo','currency','issuedDate','dueDate','items','subtotalMinor','taxMinor','totalMinor','status','at','by'],
 Payments:['id','invoiceId','clientId','amountMinor','currency','direction','reference','method','date','at','by'],
 Documents:['id','clientId','invoiceId','shipmentId','kind','name','fileId','mime','size','at','by'],
 Audit:['id','action','by','role','at','requestId','records'],
 Transactions:['id','status','hash','result','parts','at'],
 TransactionParts:['id','transactionId','content']
};
var JSON_FIELDS=['orderIds','items','result'];
function props_(){return PropertiesService.getScriptProperties();}
function book_(){var id=props_().getProperty('SPREADSHEET_ID');if(!id)throw new Error('SPREADSHEET_ID is not configured.');return SpreadsheetApp.openById(id);}
function table_(name){if(!SCHEMA[name])throw new Error('Unknown sheet.');var s=book_().getSheetByName(name);if(!s)throw new Error('Run setupWms first.');return s;}
function read_(name){var s=table_(name),count=s.getLastRow()-1;if(count<=0)return [];return s.getRange(2,1,count,SCHEMA[name].length).getValues().map(function(values){var row={};SCHEMA[name].forEach(function(k,i){var v=values[i];row[k]=JSON_FIELDS.indexOf(k)>=0&&v!==''?JSON.parse(v):v;});return row;}).filter(function(r){return r.id!=='';});}
function cell_(value){if(value==null)return '';if(typeof value==='object')return JSON.stringify(value);if(typeof value==='string'&&/^[=+\-@]/.test(value))return "'"+value;return value;}
function upsertMany_(name,rows){if(!rows.length)return;var sheet=table_(name),headers=SCHEMA[name],existing=read_(name),indices=Object.create(null);existing.forEach(function(r,i){indices[r.id]=i+2;});var append=[];rows.forEach(function(row){var values=headers.map(function(k){return cell_(row[k]);});if(indices[row.id])sheet.getRange(indices[row.id],1,1,headers.length).setValues([values]);else {indices[row.id]=sheet.getLastRow()+append.length+1;append.push(values);}});if(append.length)sheet.getRange(sheet.getLastRow()+1,1,append.length,headers.length).setValues(append);}
function setupWms(){
 var p=props_();var id=p.getProperty('SPREADSHEET_ID');if(!id){id=SpreadsheetApp.create('YESI Fulfillment WMS').getId();p.setProperty('SPREADSHEET_ID',id);}
 var productSheet=SpreadsheetApp.openById(id).getSheetByName('Products');if(productSheet&&productSheet.getLastRow()>0){var oldHeaders=productSheet.getRange(1,1,1,productSheet.getLastColumn()).getValues()[0];for(var h=0;h<oldHeaders.length;h++)if(oldHeaders[h]!==SCHEMA.Products[h])throw new Error('Products headers do not match the WMS schema. Back up and review the sheet before updating.');if(oldHeaders.length<SCHEMA.Products.length)productSheet.getRange(1,oldHeaders.length+1,1,SCHEMA.Products.length-oldHeaders.length).setValues([SCHEMA.Products.slice(oldHeaders.length)]);}
 var sheet=SpreadsheetApp.openById(id);Object.keys(SCHEMA).forEach(function(name){var s=sheet.getSheetByName(name)||sheet.insertSheet(name);if(s.getLastRow()===0){s.getRange(1,1,1,SCHEMA[name].length).setValues([SCHEMA[name]]);s.setFrozenRows(1);s.getRange(1,1,1,SCHEMA[name].length).setBackground('#112b49').setFontColor('#ffffff').setFontWeight('bold');s.autoResizeColumns(1,SCHEMA[name].length);}});
 if(!p.getProperty('DOCUMENTS_FOLDER_ID'))p.setProperty('DOCUMENTS_FOLDER_ID',DriveApp.createFolder('YESI WMS Documents').getId());
 var email=(p.getProperty('ADMIN_EMAIL')||'').toLowerCase();if(!email)throw new Error('Set ADMIN_EMAIL in Script Properties, then run setupWms again.');
 if(!read_('Users').some(function(u){return u.email===email;}))upsertMany_('Users',[{id:email,email:email,name:'Administrator',role:'ADMIN',active:true}]);
 if(!p.getProperty('GATEWAY_SECRET'))throw new Error('Set a random GATEWAY_SECRET of at least 32 characters.');
 console.log('Spreadsheet URL: '+sheet.getUrl());console.log('Documents folder ID is stored in Script Properties. No example warehouse records were created.');
}
function backupWms(){
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{recover_();var p=props_(),folderId=p.getProperty('BACKUPS_FOLDER_ID');if(!folderId){folderId=DriveApp.createFolder('YESI WMS Sheet Backups').getId();p.setProperty('BACKUPS_FOLDER_ID',folderId);}var timestamp=Utilities.formatDate(new Date(),'Asia/Dubai','yyyy-MM-dd_HH-mm-ss');DriveApp.getFileById(p.getProperty('SPREADSHEET_ID')).makeCopy('YESI WMS '+timestamp,DriveApp.getFolderById(folderId));console.log('Sheets backup created. Uploaded documents require a separate Drive backup policy.');}finally{lock.releaseLock();}
}
function signature_(payload){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload,props_().getProperty('GATEWAY_SECRET'))).replace(/=+$/,'');}
function equal_(a,b){if(a.length!==b.length)return false;var diff=0;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function hash_(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value)).replace(/=+$/,'');}
function finish_(tx){var parts=read_('TransactionParts').filter(function(p){return p.transactionId===tx.id;}).sort(function(a,b){return Number(a.id.split(':').pop())-Number(b.id.split(':').pop());});if(parts.length!==tx.parts)throw new Error('Transaction journal is incomplete. Contact IT.');var plan=JSON.parse(parts.map(function(p){return p.content;}).join(''));var grouped=Object.create(null);plan.ops.forEach(function(op){(grouped[op.table]||(grouped[op.table]=[])).push(op.row);});Object.keys(grouped).forEach(function(name){var last=Object.create(null);grouped[name].forEach(function(r){last[r.id]=r;});upsertMany_(name,Object.keys(last).map(function(id){return last[id];}));});SpreadsheetApp.flush();upsertMany_('Transactions',[Object.assign({},tx,{status:'COMMITTED'})]);SpreadsheetApp.flush();return tx.result;}
function recover_(){read_('Transactions').filter(function(t){return t.status==='PREPARED';}).forEach(finish_);}
function commit_(key,hash,plan){var raw=JSON.stringify(plan);var pieces=[];for(var i=0;i<raw.length;i+=35000)pieces.push({id:key+':'+pieces.length,transactionId:key,content:raw.slice(i,i+35000)});upsertMany_('TransactionParts',pieces);SpreadsheetApp.flush();var tx={id:key,status:'PREPARED',hash:hash,result:plan.result,parts:pieces.length,at:new Date().toISOString()};upsertMany_('Transactions',[tx]);SpreadsheetApp.flush();return finish_(tx);}
function state_(){var s={};TABLES.forEach(function(name){s[name]=read_(name);});return s;}
function doGet(){return ContentService.createTextOutput(JSON.stringify({service:'YESI WMS gateway',access:'Signed server requests only'})).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 var lock;try{
  if(!e.postData||e.postData.contents.length>6500000)throw new Error('Invalid request size.');var envelope=JSON.parse(e.postData.contents);if(typeof envelope.payload!=='string'||!equal_(signature_(envelope.payload),String(envelope.signature||'')))throw new Error('Unauthorized gateway request.');
  var request=JSON.parse(envelope.payload);if(Math.abs(Date.now()-Number(request.timestamp))>120000)throw new Error('Request expired.');if(!/^[a-zA-Z0-9-]{16,100}$/.test(request.requestId||''))throw new Error('Invalid request ID.');
  lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw new Error('Warehouse update is busy. Retry the same request.');recover_();
  var users=read_('Users'),user=users.find(function(u){return u.email===String(request.email||'').toLowerCase()&&u.active===true;});if(!user)throw new Error('Your Google account has not been enabled by the WMS administrator.');
  var action=request.action,input=request.input||{},output;
  if(action==='snapshot'){
   var state=state_();if(state.Movements.length>100000)throw new Error('Movement volume exceeded this Sheets edition. Ask IT to archive historical ledgers or migrate the storage layer.');output=publicState(state,user);
  }else if(action==='document.download'){
   var record=read_('Documents').find(function(d){return d.id===input.documentId;});if(!record||record.kind==='INVOICE'&&['ADMIN','MANAGER','FINANCE'].indexOf(user.role)<0)throw new Error('Document access denied.');var file=DriveApp.getFileById(record.fileId),blob=file.getBlob();if(file.getSize()>4000000)throw new Error('Document too large for this gateway.');output={name:record.name,mime:record.mime,base64:Utilities.base64Encode(blob.getBytes())};
  }else{
   var key=request.requestId,requestHash=hash_(JSON.stringify({action:action,input:input,email:user.email}));var prior=read_('Transactions').find(function(t){return t.id===key;});if(prior){if(prior.hash!==requestHash)throw new Error('Request ID reused with different data.');output=prior.result;}
   else {
    var state=state_(),plan;
    if(action==='document.upload'){
     if(['ADMIN','MANAGER','INBOUND','DISPATCH','FINANCE'].indexOf(user.role)<0)throw new Error('Document upload not allowed.');
     var allowed=['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];if(allowed.indexOf(input.mime)<0)throw new Error('Upload PDF, PNG, JPEG or XLSX.');var bytes=Utilities.base64Decode(input.base64||'');if(!bytes.length||bytes.length>4000000)throw new Error('Document must be between 1 byte and 4 MB.');
     // Validate client ownership and invoice/shipment references before creating the Drive file.
     var metadata=Object.assign({},input,{id:'DOC-'+key,fileId:'pending',size:bytes.length});delete metadata.base64;execute(state,user,'document.record',metadata,key);
     var folder=DriveApp.getFolderById(props_().getProperty('DOCUMENTS_FOLDER_ID'));var filename=key+'__'+String(input.name||'document').replace(/[\/\\]/g,'_');var matches=folder.getFilesByName(filename);var file=matches.hasNext()?matches.next():folder.createFile(Utilities.newBlob(bytes,input.mime,filename));
     plan=execute(state,user,'document.record',Object.assign({},metadata,{fileId:file.getId()}),key);
    }else plan=execute(state,user,action,input,key);
    output=commit_(key,requestHash,plan);
   }
  }
  return ContentService.createTextOutput(JSON.stringify({ok:true,data:output})).setMimeType(ContentService.MimeType.JSON);
 }catch(error){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(error.message||error),code:error.code||'ERROR'})).setMimeType(ContentService.MimeType.JSON);}
 finally{if(lock)lock.releaseLock();}
}
