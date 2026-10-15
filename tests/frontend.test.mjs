import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function app(){const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',className:''});return nodes.get(id);};const context=vm.createContext({console,window:{WMS_CONFIG:{}},document:{getElementById:node,querySelector:()=>null},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},Date,Map,Set,TextEncoder});vm.runInContext(fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),context);return {context,run(code){return vm.runInContext(code,context);},nodes};}
test('real Excel workbook selects worksheet and preserves text identifiers',async()=>{
 const sandbox=vm.createContext({console,Uint8Array,ArrayBuffer});vm.runInContext(fs.readFileSync(new URL('../web/vendor/xlsx.full.min.js',import.meta.url),'utf8'),sandbox);const XLSX=sandbox.XLSX;const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Notes'],['Not stock']]),'Notes');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['PART NO','SERIALS'],['00042','000007']]),'Stock');
 const data=XLSX.write(book,{type:'buffer',bookType:'xlsx'});const a=app();a.context.window.XLSX=XLSX;a.context.file={name:'stock.xlsx',size:data.length,arrayBuffer:async()=>data};
 const rows=await a.run("readInboundFile(file,'Stock')");assert.equal(rows[0]['PART NO'],'00042');assert.equal(rows[0].SERIALS,'000007');
 await assert.rejects(a.run("readInboundFile(file,'Missing')"),/Worksheet not found/);
});
test('PDF stock columns are reconstructed and image-only PDFs fail clearly',()=>{
 const a=app();const rows=a.run(`matrixStockRows(pdfStockMatrix([[{str:'PART NO',width:45,transform:[1,0,0,1,10,100]},{str:'SERIALS',width:45,transform:[1,0,0,1,130,100]},{str:'00042',width:30,transform:[1,0,0,1,10,80]},{str:'000007',width:40,transform:[1,0,0,1,130,80]}]]))`);
 assert.equal(rows[0]['PART NO'],'00042');assert.equal(rows[0].SERIALS,'000007');assert.throws(()=>a.run('pdfStockMatrix([[]])'),/Scanned PDFs need OCR/);
});
test('extracted stock preview round-trips quoted identifiers and rejects duplicate columns',()=>{
 const a=app();const result=a.run(`parseCsv(stockRowsCsv([{article:'A,"B',qty:'1',location:'R1',serial:'0001'}]))`);assert.equal(result[0].article,'A,"B');assert.equal(result[0].serial,'0001');
 assert.throws(()=>a.run(`matrixStockRows([['PART NO','part_no'],['A','B']])`),/duplicate headers/);
});
test('unconfigured frontend shows setup instructions, never a demo or access bypass',()=>{
 const a=app();const html=a.nodes.get('app').innerHTML;assert.match(html,/Connection setup is required/);assert.doesNotMatch(html,/Open demo|demo workspace/i);assert.match(html,/Google account/);
});
test('CSV parser supports quoted commas, leading zero identifiers and rejects incomplete lines',()=>{
 const a=app();const rows=a.run(`parseCsv('article,qty,location,serial\\n"ARTICLE,ONE",1,R1,000001')`);assert.equal(rows[0].article,'ARTICLE,ONE');assert.equal(rows[0].serial,'000001');assert.throws(()=>a.run(`parseCsv('a,b\\n1')`),/wrong number/);assert.throws(()=>a.run(`parseCsv('a,b\\n"1,2')`),/unclosed/);
});
test('stock and financial tables escape untrusted values',()=>{
 const a=app();const rendered=a.run(`tableHtml([{article:'<script>alert(1)</script>',qty:1}],['article','qty'])`);assert.match(rendered,/&lt;script&gt;/);assert.doesNotMatch(rendered,/<script>/);
});
test('product columns match the supplied Google Sheet and preserve all device fields',()=>{
 const a=app();const row=a.run(`normalizeProductRows([{'supplier':'V','DESCRIPTION':'Phone','IMEI 1':'0001','IMEI 2':'0002','SERIALS':'000S','PART NO':'000P','UPC':'000U','MODEL':'M','COLOUR':'Blue','IMEI 1-OUT 01':'000O','KING NUMBER / TRACKING NUMBER':'000T','CARTON NUMBER':'000C'}])[0]`);
 assert.equal(row.article,'000P');assert.equal(row.imei1,'0001');assert.equal(row.imei2,'0002');assert.equal(row.serial,'000S');assert.equal(row.barcode,'000U');assert.equal(row.outboundImei,'000O');assert.equal(row.tracking,'000T');assert.equal(row.carton,'000C');assert.equal(row.supplier,'V');
 a.context.row=row;assert.equal(a.run('normalizeProductRows(parseCsv(productRowsCsv([row])))[0].serial'),'000S');
 a.run(`state={Products:[{id:'P',article:'000P',description:'Phone'}],ProductUnits:[{id:'U1',productId:'P',imei1:'0001'},{id:'U2',productId:'P',imei1:'0002'}]};view='products'`);const rows=a.run('tableData().rows');assert.equal(rows.length,2);assert.equal(rows[1].unitId,'U2');
});

test('Google Sheet inbound headers map identifiers and require a warehouse location',()=>{
 const a=app();const rows=a.run(`normalizeInboundRows([{'PART NO':'00042','SERIALS':'000007','IMEI 1':'001234','DESCRIPTION':'Phone'}],'R1')`);
 assert.equal(rows[0].article,'00042');assert.equal(rows[0].serial,'000007');assert.equal(rows[0].qty,'1');assert.equal(rows[0].location,'R1');
 assert.equal(a.run(`normalizeInboundRows([{'PART NO':'A','IMEI 1':'001234'}],'R1')[0].serial`),'001234');
 assert.equal(a.run(`normalizeInboundRows([{'PART NO':'A','SERIALS':'S','IMEI 1':'001234'}],'R1','imei1')[0].serial`),'001234');
 assert.throws(()=>a.run(`normalizeInboundRows([{'PART NO':'A','SERIALS':'S'}])`),/warehouse location/);
 assert.throws(()=>a.run(`normalizeInboundRows([{'PART NO':'A'}],'R1')`),/positive quantity/);
 const standard=a.run(`normalizeInboundRows([{article:'A',qty:'5',location:'R2'}],'R1')[0]`);assert.equal(standard.qty,'5');assert.equal(standard.location,'R2');
});
