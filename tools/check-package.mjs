import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const must=['README.md','START_HERE_FOR_IT.txt','core/engine.mjs','web/app.js','web/styles.css','google-apps-script/Code.gs','google-apps-script/Engine.gs','google-apps-script/appsscript.json','netlify/functions/wms.mjs','netlify.toml','dist/index.html','dist/config.js','docs/IT_SETUP.md','docs/ACCEPTANCE_TESTS.md','docs/SHEET_SCHEMA.md'];
for(const name of must)await fs.access(path.join(root,name));
const publicConfig=await fs.readFile(path.join(root,'dist/config.js'),'utf8');if(publicConfig.includes('GATEWAY_SECRET')||publicConfig.includes('APPS_SCRIPT_URL'))throw Error('Server settings leaked into frontend config');
const engine=await fs.readFile(path.join(root,'core/engine.mjs'),'utf8'),generated=await fs.readFile(path.join(root,'google-apps-script/Engine.gs'),'utf8');if(!generated.endsWith(engine.replace(/^export /gm,'')))throw Error('Generated Apps Script engine is stale');
const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="\/([^\"]+)"/g))await fs.access(path.join(root,'dist',m[1]));
JSON.parse(await fs.readFile(path.join(root,'google-apps-script/appsscript.json'),'utf8'));
console.log('Package checked: required sources, generated engine, frontend references and secret separation.');
