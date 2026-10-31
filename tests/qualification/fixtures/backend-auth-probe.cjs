'use strict';
// Executed only inside the owned network-none checker. No signing/server key.
const fs=require('fs'),crypto=require('crypto');
const config=JSON.parse(fs.readFileSync('/inputs/public.json'));
const results=[];let current='checker_inputs',lastResponse;
function need(ok){if(!ok)throw Error('assertion_failed');}
async function check(name,fn){current=name;const detail=await fn();results.push({id:name,result:'pass',...detail});}
async function api(service,route,method='GET',body,token){
 const r=await fetch(`http://127.0.0.1:54321/${service}/v1${route}`,{method,headers:{apikey:config.anonKey,'Content-Type':'application/json',Prefer:'return=representation',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
 const data=await r.json();lastResponse={status:r.status,...(Array.isArray(data)?{rows:data.length}:{}),...(typeof data?.code==='string'&&/^[A-Z0-9]{5}$/.test(data.code)?{code:data.code}:{})};return {status:r.status,data};
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
(async()=>{
 await check('checker_has_only_public_configuration',()=>{need(Object.keys(config).join(',')==='anonKey');need(JSON.parse(Buffer.from(config.anonKey.split('.')[1],'base64url')).role==='anon');need(!fs.existsSync('/inputs/credentials.json')&&!fs.existsSync('/inputs/database-password')&&!fs.existsSync('/var/run/docker.sock'));});
 const users=[];
 for(const role of ['owner','other'])await check('real_auth_password_login_'+role,async()=>{
  const email='backend-proof-'+crypto.randomUUID()+'@example.com',password=crypto.randomBytes(24).toString('hex');
  const created=await api('auth','/signup','POST',{email,password});need(created.status===200);
  const login=await api('auth','/token?grant_type=password','POST',{email,password});need(login.status===200);
  const claims=JSON.parse(Buffer.from(login.data.access_token.split('.')[1],'base64url'));need(claims.role==='authenticated'&&claims.sub===login.data.user.id);
  users.push({id:login.data.user.id,token:login.data.access_token});return {status:login.status,role:claims.role};
 });
 const [owner,other]=users;need(owner.id!==other.id);
 const rows={};
 const inputs={stax:{user_id:owner.id,name:'Owned disposable qualification project',goals:[]}};
 for(const table of ['stax','attention_blocks','next_actions']){
  if(table==='attention_blocks')inputs[table]={user_id:owner.id,stax_id:rows.stax.id,title:'Owned block',priority:'must',source:'manual'};
  if(table==='next_actions')inputs[table]={user_id:owner.id,created_by:owner.id,stax_id:rows.stax.id,attention_block_id:rows.attention_blocks.id,content:'Owned action',position:0};
  await check('owner_insert_'+table,async()=>{const r=await api('rest','/'+table,'POST',inputs[table],owner.token);need(r.status===201&&r.data.length===1);rows[table]=r.data[0];return {status:r.status,rows:r.data.length};});
 }
 for(const table of ['stax','attention_blocks','next_actions']){
  const insertInput={...inputs[table]};if(table==='next_actions')delete insertInput.attention_block_id;
  const route='/'+table+'?id=eq.'+rows[table].id,field=table==='stax'?'name':table==='attention_blocks'?'title':'content';let before;
  await check('owner_update_readback_'+table,async()=>{const r=await api('rest',route,'PATCH',{[field]:'Saved '+table},owner.token);need(r.status===200&&r.data.length===1);const read=await api('rest',route,'GET',undefined,owner.token);need(read.status===200&&read.data.length===1&&read.data[0][field]==='Saved '+table);before=read.data;return {status:read.status,rows:1};});
  await check('foreign_read_denied_'+table,async()=>{const r=await api('rest',route,'GET',undefined,other.token);need(r.status===200&&equal(r.data,[]));return {status:r.status,rows:0};});
  await check('foreign_update_denied_'+table,async()=>{const r=await api('rest',route,'PATCH',{[field]:'Forbidden overwrite'},other.token);need(r.status===200&&equal(r.data,[]));return {status:r.status,rows:0};});
  await check('foreign_insert_denied_'+table,async()=>{const r=await api('rest','/'+table,'POST',insertInput,other.token);need(r.status===403&&r.data.code==='42501');return {status:r.status};});
  await check('anon_read_denied_'+table,async()=>{const r=await api('rest',route,'GET',undefined,config.anonKey);need((r.status===200&&equal(r.data,[]))||r.status===401);return {status:r.status,rows:0};});
  await check('anon_write_denied_'+table,async()=>{const r=await api('rest','/'+table,'POST',insertInput,config.anonKey);need(r.status===401&&r.data.code==='42501');return {status:r.status};});
  // The security-invoker anchor trigger sees no foreign block and raises before INSERT policy evaluation.
  if(table==='next_actions')for(const [actor,token]of [['foreign',other.token],['anon',config.anonKey]])await check(actor+'_linked_action_insert_denied',async()=>{const r=await api('rest','/next_actions','POST',inputs.next_actions,token);need(r.status===400&&r.data.code==='P0001'&&r.data.message==='attention_block_id '+rows.attention_blocks.id+' does not exist');return {status:r.status,code:r.data.code,reason:'anchor_hidden_by_rls'};});
  await check('owner_every_field_unchanged_'+table,async()=>{const r=await api('rest',route,'GET',undefined,owner.token);need(r.status===200&&equal(r.data,before));return {status:r.status,allFieldsUnchanged:true};});
 }
 console.log(JSON.stringify({executed:results.length,failed:0,skipped:0,results}));
})().catch(()=>{results.push({id:current,result:'fail',lastResponse});console.log(JSON.stringify({executed:results.length,failed:1,skipped:0,results}));process.exitCode=1;});
