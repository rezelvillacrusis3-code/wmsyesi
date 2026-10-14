import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign,createHmac} from 'node:crypto';
import {verifyGoogleToken,signGateway,handler} from '../netlify/functions/wms.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'test-key'};
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(overrides={}){const head=encode({alg:'RS256',kid:'test-key'}),body=encode({iss:'https://accounts.google.com',aud:'client-123',exp:Math.floor(Date.now()/1000)+3600,email:'staff@example.test',email_verified:true,...overrides});return head+'.'+body+'.'+sign('RSA-SHA256',Buffer.from(head+'.'+body),privateKey).toString('base64url');}
test('Google tokens require valid signature, audience, issuer, expiry and verified email',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({keys:[jwk]})});assert.equal(await verifyGoogleToken(jwt(),'client-123',fetcher),'staff@example.test');
 for(const change of [{aud:'other'},{iss:'attacker'},{exp:1},{email_verified:false}])await assert.rejects(verifyGoogleToken(jwt(change),'client-123',fetcher));
 const token=jwt().split('.');token[1]=encode({aud:'client-123',email:'attacker@example.test'});await assert.rejects(verifyGoogleToken(token.join('.'),'client-123',fetcher));
});
test('gateway signatures match standard HMAC and reject wrong origin',async()=>{
 assert.equal(signGateway('{"a":1}','secret'),createHmac('sha256','secret').update('{"a":1}').digest('base64url'));
 process.env.APP_ORIGIN='https://company.example';const result=await handler({httpMethod:'POST',headers:{origin:'https://attacker.example'},body:'{}'});assert.equal(result.statusCode,403);
});
