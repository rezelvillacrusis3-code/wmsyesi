import {createHmac,createPublicKey,verify} from 'node:crypto';
let keyCache={expires:0,keys:[]};
export async function verifyGoogleToken(token,clientId,fetcher=fetch){
 const parts=String(token||'').split('.');if(parts.length!==3)throw Error('Google sign-in required.');const decode=s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));
 const header=decode(parts[0]),claims=decode(parts[1]);if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Unsupported sign-in token.');
 if(Date.now()>keyCache.expires||!keyCache.keys.some(k=>k.kid===header.kid)){const r=await fetcher('https://www.googleapis.com/oauth2/v3/certs');if(!r.ok)throw Error('Unable to verify Google sign-in.');const body=await r.json();keyCache={keys:body.keys||[],expires:Date.now()+3600000};}
 const jwk=keyCache.keys.find(k=>k.kid===header.kid);if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('Invalid sign-in signature.');
 if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||typeof claims.exp!=='number'||claims.exp*1000<=Date.now()||claims.email_verified!==true||typeof claims.email!=='string')throw Error('Sign-in token is expired or invalid.');return claims.email.toLowerCase();
}
export function signGateway(payload,secret){return createHmac('sha256',secret).update(payload).digest('base64url');}
export const handler=async event=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 try{
  if(event.httpMethod!=='POST')return {statusCode:405,headers,body:JSON.stringify({error:'POST required'})};
  const origin=process.env.APP_ORIGIN;const requested=event.headers.origin||event.headers.Origin;if(!origin||requested!==origin)return {statusCode:403,headers,body:JSON.stringify({error:'Origin not allowed.'})};
  const secret=process.env.GATEWAY_SECRET,clientId=process.env.GOOGLE_CLIENT_ID,url=process.env.APPS_SCRIPT_URL;
  if(!secret||secret.length<32||!clientId||!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url||''))throw Error('Server connection is not configured. Contact IT.');
  if(!event.body||event.body.length>5700000)throw Error('Request exceeds supported size.');
  const email=await verifyGoogleToken((event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer /,''),clientId);
  const body=JSON.parse(event.body);if(!/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId||''))throw Error('Invalid request ID.');
  const payload=JSON.stringify({action:body.action,input:body.input||{},requestId:body.requestId,email,timestamp:Date.now()});
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature:signGateway(payload,secret)}),redirect:'follow',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Google Sheets gateway is unavailable. Retry the same request.');const result=await response.json();
  return {statusCode:result.ok?200:400,headers,body:JSON.stringify(result)};
 }catch(error){return {statusCode:400,headers,body:JSON.stringify({ok:false,error:error.name==='TimeoutError'?'Request timed out. Retry the same request to confirm its outcome.':error.message})};}
};
