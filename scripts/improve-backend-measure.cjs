'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {BackendJournal}=require('./improve-backend-supervisor.cjs');
const {PROFILE,RECIPE}=require('./improve-backend.cjs');
const {directory}=require('./improve-offline-cache.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(x,c='backend_identity_mismatch')=>{if(!x)throw Error(c);};
const env={PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'};
function expectedSemantic(inputs,state,credentials,request){
 const {canonical}=require('./improve-production-build.cjs');
 // No physical path, process, generation or token byte becomes cross-phase identity.
 // Retain every construction hash except the validated generation credential projection.
 const credentialProjection=require('./improve-backend-semantics.cjs').projection(credentials,request);
 need(inputs.jobId===request.jobId&&inputs.credentialBinding.sha256===hash(canonical(credentials)));
 const refs=['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile'];
 const fields={recipeId:RECIPE.id,jobId:inputs.jobId,images:inputs.images,migrationRevision:inputs.migrationRevision,migrations:inputs.migrations,
  inputs:Object.fromEntries(refs.map(k=>[k,inputs[k].sha256])),credentialProjection,state};
 return hash(canonical(fields));
}
async function measureSnapshot({journal,root}){
 need(journal instanceof BackendJournal,'backend_input_invalid');const s=journal.check();
 need(s.phase==='measured'&&!s.cause,'backend_restart_invalid');const db=s.resources.find(x=>x.role==='database');
 need(db?.status==='running'&&/^[a-f0-9]{64}$/.test(db.id),'backend_service_died');
 const fd=directory(root),children=new Set();let timer;
 const file=(name,bytes)=>{const p=`/proc/self/fd/${fd}/${name}`;fs.writeFileSync(p,bytes,{mode:0o600,flag:'wx'});return {path:name,sha256:hash(bytes)};};
 const launch=args=>{const child=cp.spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{env,stdio:['pipe','pipe','pipe']});children.add(child);child.once('close',()=>children.delete(child));return child;};
 try{
  return await new Promise((resolve,reject)=>{
   let ended=false,buffer='',state,snapshot,queryDone=false,step='query_start';
   const fail=code=>{if(ended)return;try{file('measurement-failure.json',JSON.stringify({code,step,queryDone,snapshotReceived:!!snapshot,stateReceived:!!state}));}catch{}ended=true;for(const c of children)c.kill('SIGKILL');reject(Error(code));};
   timer=setTimeout(()=>fail('backend_lease_expired'),Math.max(1,Math.min(PROFILE.time.measurementMilliseconds,s.phaseDeadlineEpochMs-Date.now())));
   const query=launch(['exec','-i',db.id,'psql','-X','-h','/work','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1']);
   query.stdin.on('error',()=>fail('backend_readiness_failed'));
   query.on('error',()=>fail('backend_readiness_failed'));let queryError='';query.stderr.on('data',b=>{if(Buffer.byteLength(queryError)<65536)queryError+=b;});
   query.on('close',code=>{queryDone=true;if(queryError)try{file('measurement-psql.private.stderr',queryError);}catch{}if(code!==0)fail('backend_readiness_failed');});
   let startedDump=false;
   async function complete(){
    if(!snapshot||!state||startedDump||ended)return;startedDump=true;step='schema_dump';
    const dump=launch(['exec',db.id,'pg_dump','-h','/work','-U','supabase_admin','--schema-only','--no-owner','--schema=public','--schema=auth','--snapshot='+snapshot,'postgres']);
    dump.stdin.end();let chunks=[],bytes=0;
    dump.stdout.on('data',b=>{bytes+=b.length;if(bytes>PROFILE.output.maxFileBytes)return fail('backend_output_limit');chunks.push(b);});
    let dumpError='';dump.stderr.on('data',b=>{if(Buffer.byteLength(dumpError)<65536)dumpError+=b;});dump.on('error',()=>fail('backend_readiness_failed'));
    dump.on('close',code=>{
     if(ended)return;if(dumpError)try{file('measurement-dump.private.stderr',dumpError);}catch{}if(code!==0||queryDone)return fail('backend_readiness_failed');
     const schema=Buffer.concat(chunks);if(!schema.length)return fail('backend_identity_mismatch');
     const stateFields={schemaSha256:hash(schema),tablesSha256:state.tablesSha256,sequencesSha256:state.sequencesSha256,migrationHistorySha256:state.migrationHistorySha256};
     if(!Object.values(stateFields).every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||state.migrationCount!==156||!Number.isSafeInteger(state.tableCount)||state.tableCount<=0||!Number.isSafeInteger(state.totalRows)||state.totalRows<0)return fail('backend_identity_mismatch');
     const schemaRef=file('phase-schema.private.sql',schema);
     query.once('close',exit=>{if(ended)return;if(exit!==0)return fail('backend_readiness_failed');ended=true;resolve({state:stateFields,counts:{tables:state.tableCount,sequences:state.sequenceCount,rows:state.totalRows,migrations:state.migrationCount},schema:schemaRef,snapshotProtocol:'repeatable-read-read-only-exported-snapshot'});});
     step='commit';query.stdin.end('COMMIT;\n');
    });
   }
   query.stdout.on('data',b=>{
    if(ended)return;buffer+=b;if(Buffer.byteLength(buffer)>65536)return fail('backend_output_limit');
    while(buffer.includes('\n')){const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);
     try{if(line.startsWith('SNAPSHOT:')){need(!snapshot);snapshot=line.slice(9);need(/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}-[0-9]+$/.test(snapshot));}
      else if(line.startsWith('STATE:')){need(!state);state=JSON.parse(line.slice(6));}
      else need(line==='');
     }catch{return fail('backend_identity_mismatch');}
    }
    complete().catch(()=>fail('backend_readiness_failed'));
   });
   query.stdin.write(fs.readFileSync(path.join(__dirname,'improve-backend-measure.sql')));
  });
 }finally{clearTimeout(timer);for(const c of children)c.kill('SIGKILL');fs.closeSync(fd);}
}
module.exports={measureSnapshot,expectedSemantic};
