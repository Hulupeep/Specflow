const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {DurableStore}=require('../../scripts/improve-worker.cjs');
const credentials=require('../../scripts/improve-backend-credentials.cjs');
const semantics=require('../../scripts/improve-backend-semantics.cjs');
const {expectedSemantic}=require('../../scripts/improve-backend-measure.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function signed(c,extra={}){const now=Math.floor(Date.now()/1000),encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'service_role',aud:'authenticated',iss:'supabase',job:c.jobId,generation:c.generation,iat:now,exp:now+600,...extra});return unsigned+'.'+crypto.createHmac('sha256',c.jwtSecret).update(unsigned).digest('base64url');}
function gateway(c){return {consumers:[{username:'anon',keyauth_credentials:[{key:c.anonKey}]},{username:'server',keyauth_credentials:[{key:signed(c)}]}],services:[{name:'rest',url:'http://127.0.0.1:3001/'}]};}
describe('credential-only backend semantic equivalence (#293)',()=>{
 let root,store,a,b,inputs,state;
 beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-semantics-'));store=new DurableStore({root,sourceRoot:root});a=credentials.read(store,credentials.issue(store,{jobId:'semantic-job',phase:'baseline'}));b=credentials.read(store,credentials.issue(store,{jobId:'semantic-job',phase:'after'}));inputs={jobId:a.jobId,images:{database:'pinned'},migrationRevision:'pinned',migrations:[{name:'migration.sql',sha256:hash('migration')}],...Object.fromEntries(['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile'].map(k=>[k,{sha256:hash(k)}]))};state={schemaSha256:hash('schema'),tablesSha256:hash('rows'),sequencesSha256:hash('sequence'),migrationHistorySha256:hash('history')};});
 afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bound=(inputs,c)=>({...inputs,credentialBinding:{sha256:hash(canonical(c))}});
 test('independently issued credentials compare equal while their raw bindings differ',()=>{
  expect(hash(canonical(a))===hash(canonical(b))).toBe(false);
  expect(expectedSemantic(bound(inputs,a),state,a,a)).toBe(expectedSemantic(bound(inputs,b),state,b,b));
  expect(semantics.environment('auth',['GOTRUE_JWT_SECRET='+a.jwtSecret,'OTHER=exact'],a,a)).toEqual(semantics.environment('auth',['GOTRUE_JWT_SECRET='+b.jwtSecret,'OTHER=exact'],b,b));
  expect(semantics.gateway(gateway(a),a,a)).toEqual(semantics.gateway(gateway(b),b,b));
 });
 test.each(['seed','bootstrap','runtimeLayer','configuration','resourceProfile'])('%s mutation remains a different construction identity',field=>{
  const changed={...inputs,[field]:{sha256:hash('mutation')}};
  expect(expectedSemantic(bound(inputs,a),state,a,a)===expectedSemantic(bound(changed,b),state,b,b)).toBe(false);
 });
 test.each(['schemaSha256','tablesSha256','sequencesSha256','migrationHistorySha256'])('%s mutation remains different',field=>{
  expect(expectedSemantic(bound(inputs,a),state,a,a)===expectedSemantic(bound(inputs,b),{...state,[field]:hash('mutation')},b,b)).toBe(false);
 });
 test('unrelated environment changes are preserved, including JWT-looking names',()=>{
  const one=semantics.environment('rest',['PGRST_JWT_SECRET='+a.jwtSecret,'MY_JWT_SECRET='+a.generation],a,a);
  const two=semantics.environment('rest',['PGRST_JWT_SECRET='+b.jwtSecret,'MY_JWT_SECRET='+b.generation],b,b);
  expect(canonical(one)===canonical(two)).toBe(false);
 });
 test('wrong, missing and duplicate signing secrets fail closed',()=>{
  for(const env of [[],['PGRST_JWT_SECRET=wrong'],['PGRST_JWT_SECRET='+a.jwtSecret,'PGRST_JWT_SECRET='+a.jwtSecret]])expect(()=>semantics.environment('rest',env,a,a)).toThrow('backend_identity_mismatch');
 });
 test('a credential from another phase cannot stand in for its frozen raw binding',()=>{
  expect(()=>expectedSemantic(bound(inputs,a),state,b,b)).toThrow('backend_identity_mismatch');
  expect(()=>semantics.projection(a,b)).toThrow('backend_identity_mismatch');
 });
 test('database secrets are not normalized away',()=>{
  expect(canonical(semantics.projection(a,a))===canonical(semantics.projection({...b,databasePassword:'f'.repeat(64)},b))).toBe(false);
 });
 test('old anon or server token with the next generation fails',()=>{
  for(const index of [0,1]){const raw=gateway(b);raw.consumers[index].keyauth_credentials[0].key=gateway(a).consumers[index].keyauth_credentials[0].key;expect(()=>semantics.gateway(raw,b,b)).toThrow('backend_identity_mismatch');}
 });
 test('even signed extra claims or wrong server roles fail',()=>{
  for(const extra of [{role:'anon'},{extra:'unexpected'},{generation:'other'}]){const raw=gateway(a);raw.consumers[1].keyauth_credentials[0].key=signed(a,extra);expect(()=>semantics.gateway(raw,a,a)).toThrow('backend_identity_mismatch');}
 });
 test('unrelated gateway configuration is retained',()=>{
  const raw=gateway(b);raw.services[0].url='http://127.0.0.1:6666/';
  expect(canonical(semantics.gateway(gateway(a),a,a))===canonical(semantics.gateway(raw,b,b))).toBe(false);
 });
});
