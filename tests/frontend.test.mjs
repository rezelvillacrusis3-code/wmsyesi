import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function app(){const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',className:''});return nodes.get(id);};const context=vm.createContext({console,window:{WMS_CONFIG:{}},document:{getElementById:node,querySelector:()=>null},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},Date,Map,Set,TextEncoder});vm.runInContext(fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),context);return {context,run(code){return vm.runInContext(code,context);},nodes};}
test('unconfigured frontend shows setup instructions, never a demo or access bypass',()=>{
 const a=app();const html=a.nodes.get('app').innerHTML;assert.match(html,/Connection setup is required/);assert.doesNotMatch(html,/Open demo|demo workspace/i);assert.match(html,/Google account/);
});
test('CSV parser supports quoted commas, leading zero identifiers and rejects incomplete lines',()=>{
 const a=app();const rows=a.run(`parseCsv('article,qty,location,serial\\n"ARTICLE,ONE",1,R1,000001')`);assert.equal(rows[0].article,'ARTICLE,ONE');assert.equal(rows[0].serial,'000001');assert.throws(()=>a.run(`parseCsv('a,b\\n1')`),/wrong number/);assert.throws(()=>a.run(`parseCsv('a,b\\n"1,2')`),/unclosed/);
});
test('stock and financial tables escape untrusted values',()=>{
 const a=app();const rendered=a.run(`tableHtml([{article:'<script>alert(1)</script>',qty:1}],['article','qty'])`);assert.match(rendered,/&lt;script&gt;/);assert.doesNotMatch(rendered,/<script>/);
});
