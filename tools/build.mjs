import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const enginePath=path.join(root,'core/engine.mjs');const code=await fs.readFile(enginePath,'utf8');
await fs.writeFile(path.join(root,'google-apps-script/Engine.gs'),'// GENERATED from core/engine.mjs. Edit the source file and rebuild.\n'+code.replace(/^export /gm,''));
await fs.mkdir(path.join(root,'dist'),{recursive:true});await fs.cp(path.join(root,'web'),path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/config.js'),'window.WMS_CONFIG = '+JSON.stringify({googleClientId:process.env.GOOGLE_CLIENT_ID||'',companyName:'YESI Fulfillment'})+';\n');
await fs.writeFile(path.join(root,'dist/_redirects'),'/api/wms /.netlify/functions/wms 200\n/* /index.html 200\n');
for(const file of ['core/engine.mjs','web/app.js','netlify/functions/wms.mjs']){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);}
const {Script}=await import('node:vm');new Script(await fs.readFile(path.join(root,'google-apps-script/Code.gs'),'utf8')+'\n'+code.replace(/^export /gm,''));
console.log('Built frontend and Apps Script engine. No live configuration was applied.');
