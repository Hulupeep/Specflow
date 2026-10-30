'use strict';
// Trusted, closed local recipe. Never accepts Docker flags, commands, environment
// or mount destinations from a repository. This is not a core success receipt.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {RECIPE,PROFILE,validateInputs,validateRequest,readBoundFile}=require('./improve-backend.cjs');
const {canonical}=require('./improve-production-build.cjs');
const {directory}=require('./improve-offline-cache.cjs');
const identity=require('./improve-process-identity.cjs');
const {BackendJournal,monitorJournal,fingerprint}=require('./improve-backend-supervisor.cjs');
const {measureSnapshot,expectedSemantic}=require('./improve-backend-measure.cjs');
const semantics=require('./improve-backend-semantics.cjs');
const need=(x,c='backend_input_invalid')=>{if(!x)throw Error(c);};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins={bootstrap:'3a9f39fb79d67d4fb2f5e54638dca1d06894a3e1a57419bc188e4ee09c72556f',supabaseCli:'3132b218461bf90d4cd5983b27b44031cd9b6c797c259a431b2e2520b5f7bdce'};
const dockerEnv={PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sessionData=new WeakMap();
// IPC is an observation channel, not the cleanup owner's lifetime. A dead
// controller must not turn a late reply into an unhandled IPC error.
function reply(message){if(process.connected)process.send(message,()=>{});}
function strict(bytes){return require('./improve-worker.cjs').strictJSON(bytes.toString());}
function credential(bytes,request){return require('./improve-backend-credentials.cjs').validate(strict(bytes),request);}
function readInputsInternal(root,request,raw){
 need(typeof root==='string'&&path.isAbsolute(root)&&!/[,\r\n\0]/.test(root));
 const r=validateRequest(request),m=validateInputs(raw);need(m.jobId===r.jobId,'backend_input_changed');
 need(hash(readBoundFile(root,r.inputManifest))===hash(Buffer.from(canonical(m))),'backend_input_changed');
 for(const k of Object.keys(pins))need(m[k].sha256===pins[k],'backend_input_changed');
 const files={};for(const k of ['bootstrap','supabaseCli','seed','credentialBinding','runtimeLayer','configuration','resourceProfile'])files[k]=readBoundFile(root,m[k],k==='supabaseCli'?128*1024*1024:PROFILE.output.maxFileBytes);
 need(canonical(strict(files.resourceProfile))===canonical(PROFILE),'backend_input_changed');
 need(canonical(strict(files.configuration))===canonical({recipeId:RECIPE.id}),'backend_input_changed');
 const c=credential(files.credentialBinding,r);const migrations=[];
 // Enumerate through an anchored no-follow descriptor, including hidden extras.
 let fd=directory(root);try{for(const part of m.migrationRoot.split('/')){const next=fs.openSync(`/proc/self/fd/${fd}/${part}`,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);fs.closeSync(fd);fd=next;}
  need(canonical(fs.readdirSync(`/proc/self/fd/${fd}`).sort())===canonical(RECIPE.migrations.map(x=>x.name).sort()),'backend_input_changed');
 }finally{fs.closeSync(fd);}
 for(const f of m.migrations)migrations.push({name:f.name,bytes:readBoundFile(root,{path:m.migrationRoot+'/'+f.name,sha256:f.sha256})});
 return {request:r,manifest:m,files,migrations,credentials:c};
}
function readInputs(root,request,raw){try{return readInputsInternal(root,request,raw);}catch(e){throw Error(e.message==='backend_input_changed'?'backend_input_changed':'backend_input_invalid');}}
function write(root,name,bytes,mode=0o444){fs.writeFileSync(path.join(root,name),bytes,{mode,flag:'wx'});}
function issueServer(c,r){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const unsigned=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role:'service_role',aud:'authenticated',iss:'supabase',job:r.jobId,generation:r.generation,iat:now,exp:now+600});
 return unsigned+'.'+crypto.createHmac('sha256',c.jwtSecret).update(unsigned).digest('base64url');}
function gateway(anonKey,serviceKey){return {_format_version:'1.1',consumers:[{username:'anon',keyauth_credentials:[{key:anonKey}]},{username:'server',keyauth_credentials:[{key:serviceKey}]}],services:[['auth',9999],['rest',3001]].map(([name,port])=>({name:name+'-v1',url:'http://127.0.0.1:'+port+'/',routes:[{name:name+'-v1',paths:['/'+name+'/v1/'],strip_path:true}],plugins:[{name:'cors',config:{origins:['http://127.0.0.1:3000'],headers:['Authorization','apikey','Content-Type','x-client-info','x-supabase-api-version','Prefer','Accept-Profile','Content-Profile','Range','Range-Unit'],methods:['GET','POST','PATCH','DELETE','OPTIONS'],credentials:true}},{name:'key-auth',config:{key_names:['apikey'],hide_credentials:false,run_on_preflight:false}}]}))};}
const databaseCommand=`set -eu
password=$(cat /inputs/database-password)
printf '%s\\n' "$password" >/work/password; chmod 600 /work/password
initdb -D /work/data -U supabase_admin --pwfile=/work/password --auth-local=trust --auth-host=scram-sha-256 >/work/init.log
trap 'pg_ctl -D /work/data -m immediate stop >/dev/null 2>&1 || true' EXIT
pg_ctl -D /work/data -l /work/server.log -o "-c config_file=/etc/postgresql/postgresql.conf -c data_directory=/work/data -c hba_file=/work/data/pg_hba.conf -c ident_file=/work/data/pg_ident.conf -c logging_collector=off -c log_directory=/work -c external_pid_file=/work/postgres.pid -c max_connections=20 -k /work -c listen_addresses='127.0.0.1' -c shared_buffers=32MB" -w -t 20 start >/work/start.log 2>&1
POSTGRES_HOST=/work POSTGRES_PASSWORD="$password" /bin/sh /docker-entrypoint-initdb.d/migrate.sh >/work/bootstrap.log 2>&1
PGPASSWORD="$password" JWT_SECRET="$password" JWT_EXP=3600 psql -h /work -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /inputs/bootstrap.sql >/work/local-schema.log 2>&1
touch /work/db-ready
while [ ! -f /work/auth-done ]; do sleep 0.1; done
mkdir -p /work/project/supabase /work/home
printf 'project_id = "specflow-confined"\\n[db]\\nport = 5432\\nmajor_version = 15\\n' >/work/project/supabase/config.toml
ln -s /inputs/migrations /work/project/supabase/migrations
PGPASSWORD="$password" HOME=/work/home XDG_CONFIG_HOME=/work/home XDG_CACHE_HOME=/work/home /inputs/supabase migration up --db-url 'postgresql://postgres@127.0.0.1:5432/postgres?sslmode=disable' --workdir /work/project --yes >/work/cli.log 2>&1
count=$(psql -h /work -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'select count(*) from supabase_migrations.schema_migrations')
test "$count" -eq 156
touch /work/replay-ready
echo MIGRATIONS_APPLIED:156
while :; do sleep 1; done`;
function stageInputs(root,admitted){
 const {request:r,credentials:c,files,migrations}=admitted;
 const stage=fs.mkdtempSync(path.join(root,'backend-stage-'));fs.chmodSync(stage,0o700);
 try{
  fs.mkdirSync(path.join(stage,'migrations'),{mode:0o755});for(const f of migrations)write(stage,'migrations/'+f.name,f.bytes);
  write(stage,'bootstrap.sql',files.bootstrap);write(stage,'supabase',files.supabaseCli,0o555);write(stage,'seed.sql',files.seed);
  write(stage,'sodium',c.sodium+'\n');write(stage,'database-password',c.databasePassword+'\n');
  write(stage,'database.sh',databaseCommand);const serverKey=issueServer(c,r);
  const env=(name,values)=>write(stage,name,Object.entries(values).map(([k,v])=>k+'='+v).join('\n')+'\n',0o600);
  const common={GOTRUE_DB_DRIVER:'postgres',DB_NAMESPACE:'auth',GOTRUE_DB_DATABASE_URL:'postgres://supabase_auth_admin:'+c.databasePassword+'@127.0.0.1:5432/postgres?sslmode=disable',GOTRUE_JWT_SECRET:c.jwtSecret,GOTRUE_SITE_URL:'http://127.0.0.1:3000',API_EXTERNAL_URL:'http://127.0.0.1:9999',GOTRUE_LOG_LEVEL:'info'};
  env('auth.env',{...common,GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:9999,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_EXTERNAL_EMAIL_ENABLED:true,GOTRUE_MAILER_AUTOCONFIRM:true});
  env('rest.env',{PGRST_DB_URI:'postgres://authenticator:'+c.databasePassword+'@127.0.0.1:5432/postgres?sslmode=disable',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:c.jwtSecret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:3001,PGRST_DB_POOL:4});
  write(stage,'gateway.json',canonical(gateway(c.anonKey,serverKey)));
  env('gateway.env',{KONG_DATABASE:'off',KONG_DECLARATIVE_CONFIG:'/inputs/gateway.json',KONG_PROXY_LISTEN:'127.0.0.1:54321',KONG_ADMIN_LISTEN:'off',KONG_STATUS_LISTEN:'off',KONG_PREFIX:'/work',KONG_NGINX_WORKER_PROCESSES:1,KONG_NGINX_DAEMON:'off',KONG_PROXY_ACCESS_LOG:'off',KONG_PROXY_ERROR_LOG:'/dev/stderr',KONG_PLUGINS:'cors,key-auth',KONG_ANONYMOUS_REPORTS:'off'});
  return {stage,serverKey};
 }catch(e){fs.rmSync(stage,{recursive:true,force:true});throw e;}
}
// All Docker argv below are constructed here from pinned roles and coordinator-
// owned stage files. Neither this function nor a generic call is exported.
function argsFor(slot,state,anchor,stage){
 const p=PROFILE.slots[slot.role],args=['create','--name',slot.name,'--network','container:'+anchor.Id,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory',String(p.memoryBytes),'--memory-swap',String(p.memorySwapBytes),'--cpus',String(p.cpus),'--pids-limit',String(p.pids),'--log-driver','local','--log-opt','max-size=1m','--log-opt','max-file=1','--log-opt','compress=false'];
 for(const [k,v]of Object.entries({job:state.jobId,generation:state.generation,reservation:slot.reservation,role:slot.role}))args.push('--label','specflow.backend.'+k+'='+v);
 const mount=(name,destination)=>args.push('--mount','type=bind,src='+path.join(stage,name)+',dst='+destination+',readonly');
 let entry,command=[],user;
 if(slot.role==='database'){
  user='postgres';entry='/bin/sh';command=['/inputs/database.sh'];
  for(const [name,dst]of [['migrations','/inputs/migrations'],['bootstrap.sql','/inputs/bootstrap.sql'],['supabase','/inputs/supabase'],['sodium','/etc/postgresql-custom/pgsodium_root.key'],['database-password','/inputs/database-password'],['database.sh','/inputs/database.sh'],['seed.sql','/inputs/seed.sql']])mount(name,dst);
  args.push('--tmpfs','/work:rw,noexec,nosuid,nodev,size=268435456,uid=105,gid=106,mode=0700');
 }else if(['authMigration','auth'].includes(slot.role)){user='supabase';entry='auth';command=[slot.role==='authMigration'?'migrate':'serve'];args.push('--env-file',path.join(stage,'auth.env'));
 }else if(slot.role==='rest'){user='1000';entry='/bin/postgrest';args.push('--env-file',path.join(stage,'rest.env'));
 }else if(slot.role==='gateway'){user='kong';entry='/docker-entrypoint.sh';command=['kong','docker-start'];args.push('--env-file',path.join(stage,'gateway.env'));mount('gateway.json','/inputs/gateway.json');args.push('--tmpfs','/work:rw,noexec,nosuid,nodev,size=33554432,mode=1777','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777');
 }else throw Error('backend_input_invalid');
 return [...args,'--user',user,'--entrypoint',entry,slot.image,...command];
}
function active(j){const s=j.check();need(!s.cause,s.cause||'backend_lease_expired');return s;}
async function runSupervisor(descriptor){
 const {root,stage,request,anchor,controller,inputs,inputRoot}=descriptor;
 const credentialMaterial=readInputs(inputRoot,request,inputs).credentials;
 const journal=new BackendJournal({root,jobId:request.jobId,generation:request.generation,controller});
 const streams=new Set(),pending=new Set();
 const monitoring=monitorJournal(journal,{beforeCleanup:()=>Promise.allSettled([...pending])});let terminal,operation='admission';
 let measuredManifest=null;
 const stageHashes=()=>{const files={};function visit(rel){const p=path.join(stage,rel),stat=fs.lstatSync(p);need(!stat.isSymbolicLink(),'backend_input_changed');if(stat.isDirectory())for(const name of fs.readdirSync(p).sort())visit(rel?rel+'/'+name:name);else{need(stat.isFile()&&stat.nlink===1,'backend_input_changed');files[rel]=hash(fs.readFileSync(p));}}visit('');return files;};
 const initialStage=stageHashes();
 const diagnostic=event=>fs.appendFileSync(path.join(root,'operations.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});
 async function call(args,{allowFailure=false}={}){
  const s=active(journal),timeout=Math.max(1,Math.min(10000,s.phaseDeadlineEpochMs-Date.now()));
  const promise=new Promise((resolve,reject)=>{
   const child=cp.spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{env:dockerEnv,stdio:['ignore','pipe','pipe']});let out='',err='',size=0,failed=false;
   const t=setTimeout(()=>{failed=true;child.kill('SIGKILL');},timeout);
   for(const [stream,isOut]of [[child.stdout,true],[child.stderr,false]])stream.on('data',b=>{size+=b.length;if(size>262144){failed=true;child.kill('SIGKILL');return;}if(isOut)out+=b;else err+=b;});
   child.on('error',()=>{failed=true;});child.on('close',code=>{clearTimeout(t);if(failed||(!allowFailure&&code!==0))return reject(Error('backend_readiness_failed'));resolve({code,out});});
  });
  pending.add(promise);try{return await promise;}finally{pending.delete(promise);}
 }
 const inspect=async id=>JSON.parse((await call(['inspect',id])).out)[0];
 async function start(role){
  active(journal);operation='create_'+role;const slot=journal.reserve(role);
  const image=JSON.parse((await call(['image','inspect',slot.image])).out)[0];need(image.Id===slot.image&&!Object.keys(image.Config.Volumes||{}).length,'backend_input_changed');
  const id=(await call(argsFor(slot,journal.snapshot(),anchor,stage))).out.trim();need(/^[a-f0-9]{64}$/.test(id),'backend_input_changed');
  journal.created(role,await inspect(id),await inspect(anchor.Id));active(journal);
  const child=cp.spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock','start','--attach',id],{env:dockerEnv,stdio:['ignore','pipe','pipe']});streams.add(child);
  const done=new Promise(resolve=>{child.on('error',()=>{if(!journal.snapshot().cause)journal.fail('backend_readiness_failed');});child.on('close',code=>{streams.delete(child);resolve(code);});});
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{try{journal.output(role,b.length);}catch{/* Terminal journal cannot regain authority. */}});
  for(;;){active(journal);const c=await inspect(id);if(c.State.Running||(role==='authMigration'&&c.State.Status==='exited')){journal.started(role,c);break;}await sleep(25);}
  if(role==='authMigration'){const code=await done;need(code===0,'backend_readiness_failed');const c=await inspect(id);if(journal.snapshot().resources.find(r=>r.role===role).status==='running')journal.observe(role,c);}
  return id;
 }
 async function marker(id,name){
  operation='wait_'+name;for(;;){active(journal);const r=await call(['exec',id,'test','-f','/work/'+name],{allowFailure:true});if(r.code===0)return;await sleep(100);}
 }
 try{
  journal.phase('bootstrap');const db=await start('database');await marker(db,'db-ready');await start('authMigration');
  await call(['exec',db,'touch','/work/auth-done']);await marker(db,'replay-ready');
  journal.phase('readiness');await start('auth');await start('rest');await start('gateway');
  // All requests originate in the owned network namespace. No host fetches.
  const probe='for u in http://127.0.0.1:9999/health http://127.0.0.1:3001/ http://127.0.0.1:54321/auth/v1/health; do curl --max-time 2 --silent --output /dev/null --write-out "%{http_code}\\n" "$u" || exit 1; done';
  operation='http_readiness';let previous;for(;;){active(journal);const r=await call(['exec',db,'/bin/sh','-c',probe],{allowFailure:true});const status={operation,exitCode:r.code,statuses:r.out.split('\n').filter(x=>/^[0-9]{3}$/.test(x))};if(JSON.stringify(status)!==previous){diagnostic(status);previous=JSON.stringify(status);}if(r.code===0&&r.out.trim()==='200\n200\n401')break;await sleep(100);}
  operation='seed_restore';
  await call(['exec',db,'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-1','-c','SET LOCAL session_replication_role=replica','-c',"DO $$ DECLARE q text; BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO q FROM pg_tables WHERE schemaname IN ('public','auth'); EXECUTE 'TRUNCATE '||q||' RESTART IDENTITY CASCADE'; END $$;",'-f','/inputs/seed.sql']);
  reply({type:'ready',roles:journal.snapshot().resources.map(x=>({role:x.role,status:x.status}))});
  async function continuity(){
   active(journal);need(canonical(stageHashes())===canonical(initialStage),'backend_input_changed');
   const services=[];
   for(const slot of journal.snapshot().resources){const c=await inspect(slot.id);
    need(fingerprint(c)===slot.runningFingerprint,'backend_input_changed');
    need(slot.role==='authMigration'?c.State.Status==='exited'&&c.State.ExitCode===0&&!c.State.OOMKilled:c.State.Running&&!c.State.Paused,'backend_service_died');
    const config=JSON.parse(JSON.stringify(c.Config)),host=JSON.parse(JSON.stringify(c.HostConfig));
    need(config.Hostname===anchor.Config.Hostname&&host.NetworkMode==='container:'+anchor.Id,'backend_input_changed');
    config.Hostname='owned-job-anchor';for(const key of ['specflow.backend.generation','specflow.backend.reservation'])delete config.Labels[key];
    config.Env=semantics.environment(slot.role,config.Env,credentialMaterial,request);host.NetworkMode='owned-job-anchor';
    for(const mount of host.Mounts||[]){need(mount.Type==='bind'&&mount.ReadOnly&&mount.Source.startsWith(stage+'/'),'backend_input_changed');mount.Source='private-stage/'+path.relative(stage,mount.Source);}
    const mounts=c.Mounts.map(m=>{need(m.Type==='bind'&&!m.RW&&m.Source.startsWith(stage+'/'),'backend_input_changed');return {...m,Source:'private-stage/'+path.relative(stage,m.Source)};}).sort((a,b)=>a.Destination.localeCompare(b.Destination));
    services.push({role:slot.role,id:slot.id,rawInspectionSha256:fingerprint(c),semantic:{image:c.Image,config,host,mounts}});
   }
   return services;
  }
  await new Promise(resolve=>{
   let busy=false;
   const timer=setInterval(()=>{if(['cleaned','cleanup_failed'].includes(journal.snapshot().phase)){clearInterval(timer);resolve();}},100);
   process.on('message',async message=>{
    try{need(message&&Object.keys(message).length===1&&['measure','execution','continuity','fail_identity','close'].includes(message.type));need(!busy,'backend_restart_invalid');busy=true;
     if(message.type==='measure'){
      need(!measuredManifest,'backend_restart_invalid');journal.phase('measured');operation='phase_measurement';const services=await continuity();
      const measured=await measureSnapshot({journal,root});
      const rawGateway=semantics.gateway(JSON.parse(fs.readFileSync(path.join(stage,'gateway.json'))),credentialMaterial,request);
      const configSemantic={services:services.map(x=>({role:x.role,...x.semantic})),gateway:rawGateway};
      const semanticSha256=hash(canonical({construction:expectedSemantic(inputs,measured.state,credentialMaterial,request),configuration:configSemantic}));
      measuredManifest={schema:'specflow.backend-entry/v1',jobId:request.jobId,phase:request.phase,generation:request.generation,expectedBackendIdentity:request.expectedBackendIdentity,measuredBackendIdentity:semanticSha256,inputManifestSha256:request.inputManifest.sha256,state:measured.state,counts:measured.counts,snapshotProtocol:measured.snapshotProtocol,schemaArtifact:measured.schema,services,configuration:configSemantic,stageHashes:initialStage};
      fs.writeFileSync(path.join(root,'entry-manifest.json'),canonical(measuredManifest),{mode:0o600,flag:'wx'});reply({type:'measurement',manifest:measuredManifest});
     }else if(message.type==='execution'){need(measuredManifest,'backend_restart_invalid');journal.phase('execution');reply({type:'execution'});}
     else if(message.type==='continuity'){await continuity();reply({type:'continuity'});}
     else if(message.type==='fail_identity')journal.fail('backend_identity_mismatch');
     else{if(journal.snapshot().phase==='readiness')journal.phase('measured');if(journal.snapshot().phase==='measured')journal.phase('execution');journal.phase('quiescing');}
    }catch(e){diagnostic({operation,event:message?.type,cause:/^backend_[a-z_]+$/.test(e.message)?e.message:'backend_restart_invalid'});if(!['cleaned','cleanup_failed'].includes(journal.snapshot().phase))journal.fail(require('./improve-backend.cjs').FAILURE_CAUSES.includes(e.message)?e.message:'backend_restart_invalid');}
    finally{busy=false;}
   });
  });
 }catch(e){diagnostic({operation,cause:/^backend_[a-z_]+$/.test(e.message)?e.message:'backend_readiness_failed'});if(!['cleaned','cleanup_failed'].includes(journal.snapshot().phase))journal.fail(require('./improve-backend.cjs').FAILURE_CAUSES.includes(e.message)?e.message:'backend_readiness_failed');}
 finally{
  terminal=await monitoring;for(const s of streams)s.kill('SIGKILL');
  // Cleanup must also work without closeBackend in the controller.
  if(terminal.phase==='cleaned')try{fs.rmSync(stage,{recursive:true,force:true});}catch{terminal=journal.cleanupFailed();}
  fs.writeFileSync(path.join(root,'terminal.json'),canonical(terminal),{mode:0o600,flag:'wx'});
  journal.close();reply({type:'terminal',phase:terminal.phase,cause:terminal.cause,successReceipt:false});if(process.connected)process.disconnect();
 }
 return terminal;
}
async function startBackend({worker,anchorId,root,request,inputs,credentials,productInput}){
 need(worker instanceof require('./improve-worker.cjs').DockerWorker&&worker.jobId===request.jobId,'backend_input_changed');
 const admitted=readInputs(root,request,inputs);worker.inspectProduction(anchorId);
 const credentialAuthority=require('./improve-backend-credentials.cjs');
 need(credentials&&credentials.store instanceof require('./improve-worker.cjs').DurableStore&&fs.realpathSync(credentials.store.root)===fs.realpathSync(worker.stateRoot),'backend_input_invalid');
 const issued=credentialAuthority.read(credentials.store,credentials.reference);
 need(canonical(issued)===canonical(admitted.credentials),'backend_input_changed');
 const production=require('./improve-production-build.cjs'),ownedInputs=worker.receipts.get(anchorId).expected.productionInputs;
 const productReceipt=strict(readBoundFile(root,request.productBuildReceipt));
 need(productInput?.environment?.NEXT_PUBLIC_SUPABASE_ANON_KEY===issued.anonKey&&productInput.environment.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:54321','backend_input_changed');
 production.verifyProductionOutput(worker,productInput,productReceipt,ownedInputs[2].target);
 need(canonical(productInput.source)===canonical(ownedInputs[0])&&canonical(productInput.dependencies)===canonical(ownedInputs[1])&&canonical(productReceipt.output)===canonical(ownedInputs[2].receipt),'backend_input_changed');
 // Consume before service creation. Failures retain this append-only reservation.
 const consumption=credentialAuthority.consume(credentials.store,credentials.reference,request);
 const anchor=JSON.parse(worker.call(['inspect',anchorId]).stdout)[0];need(anchor.HostConfig.NetworkMode==='none'&&!Object.keys(anchor.HostConfig.PortBindings||{}).length,'backend_input_changed');
 const {stage,serverKey}=stageInputs(root,admitted);const journalRoot=fs.mkdtempSync(path.join(root,'backend-journal-'));fs.chmodSync(journalRoot,0o700);
 const descriptor={root:journalRoot,inputRoot:root,stage,request:admitted.request,inputs:admitted.manifest,anchor,controller:identity.identity()};
 fs.writeFileSync(path.join(journalRoot,'credential-consumption.json'),canonical(consumption),{mode:0o600,flag:'wx'});
 // Secrets remain in private stage files; child descriptor carries no key.
 // A controller group kill must leave the identity-fenced cleanup owner alive.
 const child=cp.fork(__filename,[],{env:dockerEnv,detached:true,stdio:['ignore','ignore','ignore','ipc']});
 const capability=Object.freeze({});const data={child,journalRoot,stage,serverKey,request:admitted.request,admitted,root,worker,anchorId,ready:false,terminal:null,measurement:null,coreBinding:null};sessionData.set(capability,data);
 const readiness=new Promise((resolve,reject)=>{child.on('message',m=>{if(m?.type==='ready'){data.ready=true;resolve(capability);}if(m?.type==='terminal'){data.terminal=m;if(!data.ready)reject(Error(m.cause||'backend_readiness_failed'));}});child.on('error',()=>reject(Error('backend_readiness_failed')));child.on('exit',()=>{if(!data.ready)reject(Error('backend_readiness_failed'));});});
 child.send(descriptor);try{return await readiness;}catch(e){if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('exit',resolve));
  if(fs.existsSync(path.join(journalRoot,'terminal.json'))&&strict(fs.readFileSync(path.join(journalRoot,'terminal.json'))).phase==='cleaned')fs.rmSync(stage,{recursive:true,force:true});data.serverKey='';sessionData.delete(capability);throw e;}
}

function exchange(s,type,reply=type){
 need(s.ready&&!s.terminal&&s.child.connected,s.terminal?.cause||'backend_service_died');
 return new Promise((resolve,reject)=>{const finish=(error,value)=>{s.child.off('message',receive);s.child.off('exit',exit);if(error)reject(error);else resolve(value);};
  const receive=m=>{if(m?.type===reply)finish(null,m);else if(m?.type==='terminal')finish(Error(m.cause||'backend_service_died'));};
  const exit=()=>finish(Error('backend_service_died'));s.child.on('message',receive);s.child.once('exit',exit);s.child.send({type},e=>{if(e)finish(Error('backend_service_died'));});
 });
}
async function observeBackend(capability){
 const s=sessionData.get(capability);need(s&&s.ready&&!s.measurement,'backend_input_invalid');
 // This returns an observation for preparation. It never admits deciding checks.
 readInputs(s.root,s.request,s.admitted.manifest);s.worker.inspectProduction(s.anchorId);
 const response=await exchange(s,'measure','measurement');s.measurement=response.manifest;need(hash(fs.readFileSync(path.join(s.journalRoot,'entry-manifest.json')))===hash(canonical(s.measurement)),'backend_input_changed');
 return JSON.parse(JSON.stringify(s.measurement));
}
async function admitBackend(capability,context){
 const s=sessionData.get(capability);need(s&&s.ready&&!s.coreBinding,'backend_input_invalid');
 try{
  need(context&&Object.keys(context).sort().join(',')==='expectedBackendIdentity,inputManifestSha256,phase,runId'&&typeof context.runId==='string'&&context.runId.length>0,'backend_input_invalid');
  need(context.phase===s.request.phase&&context.expectedBackendIdentity===s.request.expectedBackendIdentity&&context.inputManifestSha256===s.request.inputManifest.sha256,'backend_identity_mismatch');
  const m=s.measurement||await observeBackend(capability);
  need(hash(fs.readFileSync(path.join(s.journalRoot,'entry-manifest.json')))===hash(canonical(m)),'backend_input_changed');
  need(canonical(m.state)===canonical(s.admitted.manifest.expectedState)&&m.measuredBackendIdentity===context.expectedBackendIdentity,'backend_identity_mismatch');
  await exchange(s,'execution');s.coreBinding=Object.freeze({...context});
  return {manifest:JSON.parse(JSON.stringify(m)),path:path.join(s.journalRoot,'entry-manifest.json'),sha256:hash(fs.readFileSync(path.join(s.journalRoot,'entry-manifest.json')))};
 }catch(e){if(s.child.connected&&!s.terminal)s.child.send({type:'fail_identity'});throw e;}
}
async function backendContinuity(capability,context){
 const s=sessionData.get(capability);need(s&&s.coreBinding&&canonical(s.coreBinding)===canonical(context),'backend_input_invalid');
 readInputs(s.root,s.request,s.admitted.manifest);need(hash(fs.readFileSync(path.join(s.journalRoot,'entry-manifest.json')))===hash(canonical(s.measurement)),'backend_input_changed');s.worker.inspectProduction(s.anchorId);await exchange(s,'continuity');
 return {entryManifestSha256:hash(fs.readFileSync(path.join(s.journalRoot,'entry-manifest.json')))};
}

// Native execution stays owned by test-execution.cjs. These functions provide
// only the confined transport for its frozen Playwright inventory.
function executionSession(capability,context){
 const s=sessionData.get(capability);need(s&&s.coreBinding&&canonical(s.coreBinding)===canonical(context),'backend_input_invalid');
 const j=strict(fs.readFileSync(path.join(s.journalRoot,'journal.json')));
 need(j.phase==='execution'&&!j.cause&&Date.now()<j.phaseDeadlineEpochMs,j.cause||'backend_lease_expired');
 s.worker.inspectProduction(s.anchorId);return s;
}
function bindBackendProduct(capability,context,workspace){
 const s=executionSession(capability,context),inputs=s.worker.receipts.get(s.anchorId).expected.productionInputs;
 const receipt=strict(readBoundFile(s.root,s.request.productBuildReceipt));
 need(receipt.jobId===s.request.jobId&&canonical(receipt.output)===canonical(inputs[2].receipt),'backend_input_changed');
 const manifest=strict(fs.readFileSync(path.join(inputs[0].target,'manifest.json')));
 need(hash(fs.readFileSync(path.join(inputs[0].target,'manifest.json')))===inputs[0].receipt.manifestSha256,'backend_input_changed');
 const consumed=e=>!['node_modules','.next'].some(p=>e.path===p||e.path.startsWith(p+'/'))&&e.kind!=='directory'&&e.kind!=='mutable-output';
 const normalize=e=>({path:e.path,kind:e.kind,sha256:e.kind==='symlink'?hash(e.target):e.sha256,executable:e.kind==='file'&&Boolean(e.mode&0o111)});
 const actual=workspace.entries.filter(consumed).map(e=>({path:e.path,kind:e.kind,sha256:e.sha256,executable:e.kind==='file'&&Boolean(Number(e.token[2])&0o111)})).sort((a,b)=>a.path.localeCompare(b.path));
 const expected=manifest.entries.filter(consumed).map(normalize).sort((a,b)=>a.path.localeCompare(b.path));
 need(canonical(actual)===canonical(expected),'backend_product_mismatch');
 return {source:{path:path.join(inputs[0].target,'manifest.json'),sha256:inputs[0].receipt.manifestSha256},build:{path:path.join(s.root,s.request.productBuildReceipt.path),sha256:s.request.productBuildReceipt.sha256},output:{path:path.join(inputs[2].target,'manifest.json'),sha256:inputs[2].receipt.manifestSha256}};
}

function backendNativeFramework(capability,context){
 const s=executionSession(capability,context); // inspectProduction already verifies the entire software layer.
 const layer=s.worker.layer.directories.find(x=>x.destination==='/deps/node_modules/@playwright/test'&&x.roles.includes('checker'));
 need(layer,'backend_input_invalid');const pkg=strict(fs.readFileSync(path.join(layer.source,'package.json')));
 need(pkg.name==='@playwright/test'&&pkg.bin?.playwright==='cli.js','backend_input_invalid');
 return {name:pkg.name,version:pkg.version,entry:'/deps/node_modules/@playwright/test/cli.js',entry_sha256:hash(fs.readFileSync(path.join(layer.source,'cli.js')))};
}
function prepareBackendChecks(capability,context,{oracleRoot,frozenFiles,checks}){
 const s=executionSession(capability,context);need(!s.checker&&Array.isArray(checks)&&checks.length>0,'backend_input_invalid');
 const native=require('./test-execution.cjs');
 for(const c of checks)need(native.validateFrozen(c).ok&&c.execution.adapter==='playwright','backend_input_invalid');
 const files=[...new Set(checks.flatMap(c=>[...c.checker_paths,...c.input_paths,...c.rule_paths]))];
 const stage=fs.mkdtempSync(path.join(s.root,'backend-oracle-'));fs.chmodSync(stage,0o700);
 try{
  let bytes=0;for(const file of files){const data=readBoundFile(oracleRoot,{path:file,sha256:frozenFiles[file]},PROFILE.output.maxFileBytes);bytes+=data.length;need(bytes<=PROFILE.output.captureBytes,'backend_output_limit');const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,data,{mode:0o400,flag:'wx'});}
  s.checker=s.worker.create({role:'checker',network:'container:'+s.anchorId,mounts:[{source:stage,destination:'/oracle'}],tmpfs:[{path:'/output',bytes:64*1024*1024}]});
  s.oracle={stage,root:oracleRoot,frozenFiles:{...frozenFiles},checks:checks.map(c=>hash(canonical(c)))};
  backendNativeFramework(capability,context);
 }catch(e){if(s.checker)s.worker.destroy(s.checker);s.checker=null;fs.rmSync(stage,{recursive:true,force:true});throw e;}
}
function backendNativeLaunch(capability,context,{check,options,dir,args,env}){
 const s=executionSession(capability,context);need(s.checker&&s.oracle&&s.oracle.root===options.oracleRoot&&s.oracle.checks.includes(hash(canonical(check))),'backend_input_invalid');
 need(canonical(options.frozenFiles)===canonical(s.oracle.frozenFiles),'backend_input_changed');
 for(const file of [...check.checker_paths,...check.input_paths,...check.rule_paths]){
  readBoundFile(s.oracle.root,{path:file,sha256:s.oracle.frozenFiles[file]});
  need(hash(fs.readFileSync(path.join(s.oracle.stage,file)))===s.oracle.frozenFiles[file],'backend_input_changed');
 }
 const id=path.basename(dir);need(/^attempt-[A-Za-z0-9]+$/.test(id),'backend_input_invalid');const output='/output/'+id;
 // The adapter constructs argv; only its owned output root is translated.
 const rewrite=x=>x===dir?output:x.startsWith(dir+'/')?output+x.slice(dir.length):x;
 const actualArgs=args.map(rewrite),actualEnv={NODE_PATH:'/deps/node_modules',PATH:'/node/bin:/usr/bin:/bin',HOME:'/tmp',SPECFLOW_BROWSER_EXECUTABLE:s.worker.layer.browserExecutable};
 for(const k of ['BASE_URL','IMPROVE_PHASE','IMPROVE_CRITERION','IMPROVE_SET','SPECFLOW_CONFIGURATION_ID','SPECFLOW_ENVIRONMENT','PLAYWRIGHT_JSON_OUTPUT_FILE','PLAYWRIGHT_JSON_OUTPUT_NAME','PLAYWRIGHT_JSON_OUTPUT_DIR','PLAYWRIGHT_HTML_OPEN'])if(typeof env[k]==='string')actualEnv[k]=rewrite(env[k]);
 actualEnv.IMPROVE_EVIDENCE_DIR=output;
 s.worker.exec(s.checker,['/node/bin/node','-e',"require('fs').mkdirSync(process.argv[1],{mode:448})",output],{cwd:'/tmp',timeout:5000});
 let result;
 try{
  result=s.worker.exec(s.checker,['/node/bin/node',...actualArgs],{cwd:'/oracle',env:actualEnv,timeout:Math.max(1,Math.min((check.timeout_seconds||120)*1000,strict(fs.readFileSync(path.join(s.journalRoot,'journal.json'))).phaseDeadlineEpochMs-Date.now())),allowFailure:true,maxBuffer:16*1024*1024});
  s.worker.pause(s.checker);s.worker.capture(s.checker,output,dir,{maxBytes:64*1024*1024});
 }finally{if(s.worker.containers.has(s.checker))s.worker.call(['unpause',s.checker],{allowFailure:true});}
 executionSession(capability,context);return {...result,command:['/node/bin/node',...actualArgs],reportRoot:'/oracle'};
}

async function closeBackend(capability){
 const s=sessionData.get(capability);need(s,'backend_input_invalid');
 if(s.checker){s.worker.destroy(s.checker);s.checker=null;}
 if(s.oracle)fs.rmSync(s.oracle.stage,{recursive:true,force:true});
 if(!s.terminal&&s.child.connected)s.child.send({type:'close'});
 if(s.child.exitCode===null&&s.child.signalCode===null)await new Promise(resolve=>s.child.once('exit',resolve));
 const terminal=strict(fs.readFileSync(path.join(s.journalRoot,'terminal.json')));need(terminal.phase==='cleaned','backend_cleanup_failed');
 fs.rmSync(s.stage,{recursive:true,force:true});s.serverKey='';sessionData.delete(capability);return terminal;
}
module.exports={readInputs,startBackend,closeBackend,observeBackend,admitBackend,backendContinuity,prepareBackendChecks,bindBackendProduct,backendNativeFramework,backendNativeLaunch};
if(require.main===module){process.once('message',d=>runSupervisor(d).catch(()=>{process.exitCode=1;if(process.connected)process.disconnect();}));}
