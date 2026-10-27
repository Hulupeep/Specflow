'use strict';
// Owner-private bearer registry. Authentication is immutable per request and rechecked per operation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{readPrivate}=require('./improve-controller-cli.cjs'),{ServiceError}=require('./improve-service-schema.cjs');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex'),denied=()=>{throw new ServiceError('not_authorised',403);};
function load(file){const d=readPrivate(file);if(d.version!==1||!Array.isArray(d.credentials)||!Array.isArray(d.assignments))throw new ServiceError('auth_registry_unavailable',503);return d;}
function authenticator(file){
 function identify(header){
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(header))return denied();
  const hash=Buffer.from(digest(header.slice(7)),'hex'),registry=load(file);let credential=null;
  for(const c of registry.credentials){if(typeof c.token_sha256!=='string'||!/^[a-f0-9]{64}$/.test(c.token_sha256))throw new ServiceError('auth_registry_unavailable',503);if(crypto.timingSafeEqual(hash,Buffer.from(c.token_sha256,'hex')))credential=c;}
  if(!credential||credential.revoked)return denied();
  const current=registry.assignments.find(a=>a.role_id===credential.role_id);
  if(!current||current.revoked||['principal','role_id','holder','assignment_revision'].some(k=>typeof credential[k]!=='string'||credential[k]!==current[k]))return denied();
  if(!Array.isArray(credential.repos)||!Array.isArray(credential.actions))throw new ServiceError('auth_registry_unavailable',503);
  return {actor:Object.freeze({principal:credential.principal,credential_id:credential.id,role_id:credential.role_id,holder:credential.holder,assignment_revision:credential.assignment_revision}),credential};
 }
 function authenticate(header){return identify(header).actor;}
 function authorize(header,actor,repo,action){const {actor:current,credential}=identify(header);if(JSON.stringify(current)!==JSON.stringify(actor)||!credential.repos.includes(repo)||!credential.actions.includes(action))return denied();return current;}
 return {authenticate,authorize};
}
// Provisioning is owner-host administration, never an MCP tool. Write bearer only to a new private client file.
function createCredentialFile(file){if(typeof file!=='string'||!path.isAbsolute(file))throw new ServiceError('owner_private_host_required',503);require('./improve-operation-receipts.cjs').privatePath(path.dirname(file),true);const token=crypto.randomBytes(32).toString('base64url');const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({version:1,token})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return {token_sha256:digest(token)};}
module.exports={authenticator,createCredentialFile};
