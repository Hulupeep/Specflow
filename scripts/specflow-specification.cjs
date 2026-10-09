#!/usr/bin/env node
'use strict';
// Local evidence journal and narrow CLI adapters. No scheduler or agent service.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const policy=require('./specflow-tier.cjs'),reviews=require('./specflow-reviews.cjs'),volume=require('./specflow-volume.cjs');
const read=(root,file)=>JSON.parse(fs.readFileSync(policy.localFile(root,file),'utf8'));
const nonempty=s=>typeof s==='string'&&s.trim().length>0;
function write(root,file,data) {
  const absolute=path.resolve(root,file); if(!absolute.startsWith(path.resolve(root)+path.sep)) throw Error('Output escapes repository');
  for(let p=absolute;p!==path.dirname(p);p=path.dirname(p)) if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw Error('Output cannot follow symlinks');
  fs.mkdirSync(path.dirname(absolute),{recursive:true});const tmp=absolute+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,absolute);
  return {path:file,sha256:policy.sha(fs.readFileSync(absolute))};
}
function gh(root,args,options={}) {
  const r=(options.run||spawnSync)('gh',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  if(r.status!==0) throw Error('Required GitHub source is unavailable; check authentication and permissions');
  return JSON.parse(r.stdout||'null');
}
function current(root,record,options={}) {
  const s=record?.source;let issue;
  if(s?.kind==='github' && /^[\w.-]+\/[\w.-]+$/.test(s.repo||'') && Number.isSafeInteger(s.number)) issue=gh(root,['issue','view',String(s.number),'--repo',s.repo,'--json','number,title,body,labels,comments'],options);
  else if(s?.kind==='file') issue=read(root,s.path);
  else throw Error('A current issue source (github or local file) is required; a supplied freshness flag is not a source');
  if(issue.number!==record.issue.number) throw Error('Issue source identity changed');
  if(policy.issueHash(issue)!==policy.issueHash(record.issue)) throw Error('Current acceptance changed; reconcile the record without overwriting intervening edits');
  const remoteDiscoveries=(issue.comments||[]).flatMap(c=>{const m=/^<!-- specflow-discovery:(\d+):([A-Za-z0-9._-]+) -->\n/.exec(c.body||'');return m?[{producer:Number(m[1]),id:m[2]}]:[];});
  return {...record,issue,remoteDiscoveries,freshness:{status:'current',scope:policy.issueHash(issue)}};
}
function known(root) {
  const dir=path.join(root,'.specflow/specification'); if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>/^\d+\.json$/.test(f)).map(f=>reviews.load(root,Number(f.slice(0,-5))));
}
function register(root,file) {
  const record=read(root,file); reviews.change(root,record.issue.number,state=>{state.record=file;state.volumeBaseline ||= volume.report(root,record);});return record;
}
function impacts(record,discovery) {
  return (discovery.tickets||[]).includes(record.issue.number) || (discovery.references||[]).some(id=>(record.profile?.artifacts||[]).some(a=>a.id===id||a.path===id)||(record.assumptions||[]).includes(id));
}
function discoveries(root,record) {
  return known(root).flatMap(state=>(state.discoveries||[]).filter(d=>impacts(record,d)).map(d=>({...d,producer:state.issue,resolution:d.resolutions?.[record.issue.number]})));
}
function discoveryFingerprint(root,record) { return policy.digest(discoveries(root,record).map(d=>({producer:d.producer,id:d.id,contentHash:d.contentHash,resolution:d.resolution||null}))); }
function pending(root,record) {
  const own=reviews.load(root,record.issue.number);
  return {batches:Object.values(own.batches||{}).filter(b=>b.collection!=='reported'),discoveries:discoveries(root,record).filter(d=>!d.resolution||d.resolution.scope!==policy.inputHash(record))};
}
function boundary(root,record,options={}) {
  const operation=options.operation||'inspect', required=['promote','build','finish'].includes(operation)||(operation==='resume'&&policy.BUILD_ROUTES.includes(options.route));
  let fresh=record;const errors=[];
  if(record?.freshness?.status && record.freshness.status!=='current') errors.push('Recorded freshness is stale or unavailable; reconcile it explicitly');
  if(policy.tierOf(record?.issue).errors.length) errors.push(...policy.tierOf(record?.issue).errors);
  if(record?.source || required) {try{fresh=current(root,record,options);}catch(e){errors.push(e.message);}}
  const waiting=record?.issue?.number?pending(root,record):{batches:[],discoveries:[]};
  if(required) {
    for(const remote of fresh?.remoteDiscoveries||[]) if(!discoveries(root,record).some(d=>d.producer===remote.producer&&d.id===remote.id)) errors.push(`Required discovery journal unavailable for #${remote.producer}/${remote.id}; reconcile the remote proposal before proceeding`);
    for(const number of record?.readiness?.discoverySources||[]) if(!fs.existsSync(reviews.statePath(root,number))) errors.push(`Required discovery source #${number} is unavailable; restore the journal before proceeding`);
    for(const b of waiting.batches) errors.push(`Batch ${b.id}: discovery collection missing (${b.outcome}); explicitly report observations or none`);
    for(const d of waiting.discoveries) errors.push(`Discovery ${d.id}: affected specification stale; reconcile and revalidate (${d.publication?.status||'pending'} publication)`);
  }
  const decision=policy.evaluate(fresh,{root,...options});
  if(required && operation!=='promote' && fresh?.readiness && fresh.readiness.discoveryHash!==discoveryFingerprint(root,fresh)) errors.push('Discovery history changed since promotion; revalidation is required');
  if(['build','resume','finish'].includes(operation) && policy.BUILD_ROUTES.includes(options.route||'duo-build') && fresh?.readiness) {
    const transition=reviews.load(root,fresh.issue.number).transitions?.find(t=>t.id===fresh.readiness.id);
    if(!transition || policy.digest(transition)!==policy.digest(fresh.readiness)) errors.push('Readiness has no matching durable promotion transaction');
    const deps=dependencyCheck(root,fresh,options);errors.push(...deps.errors);
    if(fresh.readiness.dependenciesHash!==deps.hash) errors.push('Dependency capability evidence changed since promotion');
  }
  decision.errors.push(...errors); if(decision.errors.length){decision.status='blocked';decision.next_action=decision.errors[0];}
  return {...decision,discoveries:waiting.discoveries.map(d=>({id:d.id,producer:d.producer,status:'stale',publication:d.publication})),uncollected:waiting.batches.map(b=>b.id)};
}
function dependencyCheck(root,record,options={},stack=[]) {
  const errors=[],details=[];if(stack.includes(record.issue.number)) return {errors:[`Circular required dependency at #${record.issue.number}`],hash:null,details};
  for(const dep of record.dependencies||[]) {
    if(!nonempty(dep.reason)||!dep.evidence?.length||!dep.record) {errors.push(`Dependency #${dep.issue||'?'} lacks reason, record or evidence`);continue;}
    errors.push(...dep.evidence.flatMap(ref=>policy.referenceErrors(root,ref,'Dependency')));
    try {
      const d=current(root,read(root,dep.record),options);if(d.issue.number!==dep.issue) throw Error('Dependency record identity mismatch');
      const p=pending(root,d);if(p.discoveries.length||p.batches.length) throw Error(`Dependency #${dep.issue} has unresolved discoveries or uncollected work`);
      const nested=dependencyCheck(root,d,options,[...stack,record.issue.number]);errors.push(...nested.errors);
      if(dep.requiresBuilt===false && (options.targetTier==='build-ready'||['build','resume','finish'].includes(options.operation)) && dep.kind!=='shared-decision') errors.push(`Dependency #${dep.issue}: an unbuilt implementation dependency cannot be reclassified as planned to grant build readiness`);
      if(dep.requiresBuilt!==false) {
        if(!d.capability || !['tested','customer-validated'].includes(d.capability.status)||!d.capability.evidence?.length) throw Error(`Dependency #${dep.issue}: planned interface or ready/closed label does not prove an implemented capability`);
        if(d.capability.scope!==policy.inputHash(d)) throw Error(`Dependency #${dep.issue}: capability scope changed`);
        for(const ref of d.capability.evidence) {errors.push(...policy.referenceErrors(root,ref,'Capability'));const raw=read(root,ref.path);if(raw.exitCode!==0||raw.executed<1||raw.failed!==0||raw.skipped!==0) errors.push(`Dependency #${dep.issue}: capability execution is absent, failed or skipped`);}
      }
      details.push({issue:dep.issue,tier:policy.tierOf(d.issue).tier,scope:policy.inputHash(d),capability:d.capability||null,nested:nested.hash,reason:dep.reason,evidence:dep.evidence,plannedOnly:dep.requiresBuilt===false});
    }catch(e){errors.push(e.message);}
  }
  return {errors,details,hash:policy.digest(details)};
}
function frontier(root,files,selected,options={}) {
  return files.map(file=>{try {
    const r=current(root,read(root,file),options),d=boundary(root,r,{...options,route:'spec-build',operation:'inspect'}),deps=dependencyCheck(root,r,options),v=volume.report(root,r);
    const chosen=selected.includes(r.issue.number),scope=chosen?'selected':selected.some(n=>files.some(f=>{const s=read(root,f);return s.issue.number===n&&(s.dependencies||[]).some(x=>x.issue===r.issue.number);}))?'direct-seam':'future';
    return {issue:r.issue.number,tier:d.tier,scope,capability:r.capability?.status||'planned',gaps:[...d.errors,...deps.errors],stale:d.discoveries.length>0||d.uncollected.length>0,openDiscoveries:d.discoveries,pendingPublications:d.discoveries.filter(x=>x.publication?.status!=='published'),overdetail:scope==='future'&&d.tier!=='thin',volume:v.counts,next_action:d.next_action};
  }catch(e){return {file,status:'blocked',gaps:[e.message]};}});
}
function gate(root,record,id,options={}) {
  const definition=record.profile?.gates?.find(g=>g.id===id);
  if(!definition?.command?.length) throw Error('Gate must be declared in the reviewed profile with an argv command');
  const before=policy.inputHash(current(root,record,options)),start=new Date().toISOString();
  const result=(options.execute||spawnSync)(definition.command[0],definition.command.slice(1),{cwd:root,encoding:'utf8',timeout:definition.timeoutMs||120000,maxBuffer:4*1024*1024});
  let report;try{report=JSON.parse(result.stdout);}catch{report={};}
  if(Number.isInteger(report.numTotalTests)) report={executed:report.numTotalTests-(report.numPendingTests||0)-(report.numTodoTests||0),skipped:(report.numPendingTests||0)+(report.numTodoTests||0),failed:report.numFailedTests+(report.numFailedTestSuites||0)+(report.success===false?1:0)};
  const evidence=write(root,`.specflow/specification/evidence/gate-${record.issue.number}-${crypto.randomUUID()}.json`,{kind:'specification-gate',id,scope:before,command:definition.command,startedAt:start,exitCode:result.status,error:result.error?.code||null,stdout:result.stdout||'',stderr:result.stderr||'',executed:report.executed,skipped:report.skipped,failed:report.failed});
  const passed=result.status===0&&report.executed>0&&report.skipped===0&&report.failed===0;
  if(policy.inputHash(current(root,record,options))!==before) throw Error('Acceptance changed while gate executed');
  reviews.change(root,record.issue.number,s=>{s.gates||={};s.gates[id]={id,scope:before,status:passed?'passed':'blocked',executed:report.executed>0,skipped:report.skipped!==0,evidence};});
  return {status:passed?'passed':'blocked',evidence,next_action:passed?'Request scoped independent review':'Inspect raw execution; missing, failed or skipped tests cannot pass'};
}
function ownerException(root,record,commentId,options={}) {
  if(record.source?.kind!=='github'||!/^\d+$/.test(String(commentId))) throw Error('Owner authority requires a verifiable GitHub comment, not a CLI reason');
  const c=gh(root,['api',`repos/${record.source.repo}/issues/comments/${commentId}`],options),login=c.user?.login;
  const scope=policy.inputHash(record),prefix=`override:${login}:`;
  if(c.author_association!=='OWNER'||!c.body?.startsWith(prefix)||!c.body.includes(`scope:${scope}`)||!c.body.includes('risks:')) throw Error('No owner-authored scope-bound exception with unresolved risks');
  // An agent using the owner's gh token can also create an owner-authored
  // comment. Require detached owner authorization, never a boolean/CLI reason.
  if(!options.signatureFile) throw Error('Owner exception needs detached owner authorization; a model-written GitHub comment is insufficient');
  const authority=read(root,'.specflow/owner-authorization.json'),signed=read(root,options.signatureFile),payload=signed.payload;
  if(authority.owner!==login||payload?.scope!==scope||payload?.who!==login||payload?.commentId!==String(commentId)||payload?.body!==c.body||!crypto.verify(null,Buffer.from(JSON.stringify(payload)),authority.publicKey,Buffer.from(signed.signature||'','base64'))) throw Error('Invalid detached owner authorization');
  const out={status:c.body.split('\n')[0],who:login,scope,reason:c.body,source:c.html_url,unresolvedRisks:true};
  reviews.change(root,record.issue.number,s=>s.events.push({kind:'owner-exception',...out}));return out;
}
function verifiedDecisions(root,record,options={}) {
  return (record.identifierDecisions||[]).map(d=>{const proof=ownerException(root,record,d.commentId,{...options,signatureFile:d.signatureFile});if(!proof.reason.includes(`identifier:${d.id}`))throw Error('Owner decision does not name the changed identifier');return {...d,ownerVerified:true};});
}
function promote(root,file,tier,why,options={}) {
  if(!['contracted','build-ready'].includes(tier)||!nonempty(why)) throw Error('Promotion requires a target depth and why it is needed now');
  const original=fs.readFileSync(policy.localFile(root,file),'utf8'),r=current(root,JSON.parse(original),options),decision=boundary(root,r,{...options,route:'spec-build',operation:'promote',targetTier:tier});
  const deps=dependencyCheck(root,r,{...options,targetTier:tier}),state=reviews.load(root,r.issue.number),v=volume.report(root,r,state.volumeBaseline,verifiedDecisions(root,r,options));
  const errors=[...decision.errors,...deps.errors,...v.errors];
  const review=reviews.latest(root,r,tier);
  if(!reviews.status(root,r,tier).passed) errors.push('The scoped status is not a live independent pass; overrides do not grant readiness');
  if(review.identity?.mode!=='live') errors.push('Simulated peer review cannot establish production specification readiness');
  const required=r.profile?.gates||[];if(!required.length) errors.push('Declare applicable required gates; absence does not prove acceptance');
  const gates=required.map(g=>state.gates?.[g.id]);
  for(const [i,g]of gates.entries()) if(!g||g.scope!==policy.inputHash(r)||g.status!=='passed'||!g.executed||g.skipped||policy.referenceErrors(root,g.evidence).length) errors.push(`Required gate ${required[i].id} has no current passing execution`);
  for(const g of gates.filter(Boolean)) if(!review.gates?.some(reviewed=>reviewed.id===g.id&&reviewed.evidence?.some(ref=>ref.path===g.evidence.path&&ref.sha256===g.evidence.sha256))) errors.push(`Required gate ${g.id} was not part of the accepted native review`);
  if(errors.length) return {status:'blocked',errors,next_action:errors[0]};
  // Re-read everything after peer/gate validation, before the only local write.
  const final=current(root,r,options),again=dependencyCheck(root,final,{...options,targetTier:tier});
  if(fs.readFileSync(policy.localFile(root,file),'utf8')!==original||again.hash!==deps.hash||again.errors.length) throw Error('Concurrent source/dependency change invalidated promotion');
  const receipt={id:crypto.randomUUID(),producer:'specflow-specification/v1',tier,inputHash:policy.inputHash(r),dependenciesHash:deps.hash,discoveryHash:discoveryFingerprint(root,r),discoverySources:[...new Set([r.issue.number,...(r.dependencies||[]).map(d=>d.issue),...discoveries(root,r).map(d=>d.producer)])],why,selected:r.issue.number,gates,review:{outcome:review.outcome,evidence:review.evidence[0],identity:review.identity},at:new Date().toISOString()};
  // Source labels remain authoritative. Publish only the depth label, never body edits.
  if(r.source.kind==='github') {
    const args=['issue','edit',String(r.issue.number),'--repo',r.source.repo,'--add-label',`spec:${tier}`];for(const old of policy.TIERS.filter(t=>t!==tier))args.push('--remove-label',`spec:${old}`);
    const result=(options.run||spawnSync)('gh',args,{cwd:root,encoding:'utf8',timeout:30000});if(result.status!==0)throw Error('Promotion label publication failed; readiness was not saved');
    current(root,r,options); // Scope must still match after remote label write.
  }else {const issue=read(root,r.source.path);issue.labels=(issue.labels||[]).filter(l=>!String(l.name||l).startsWith('spec:'));issue.labels.push(`spec:${tier}`);write(root,r.source.path,issue);}
  r.issue.labels=(r.issue.labels||[]).filter(l=>!String(l.name||l).startsWith('spec:'));r.issue.labels.push(`spec:${tier}`);r.readiness=receipt;
  write(root,file,r);reviews.change(root,r.issue.number,s=>{s.transitions||=[];s.transitions.push(receipt);s.volumeBaseline=v;s.record=file;});
  return {status:'promoted',tier,selected:r.issue.number,dependencies:deps.details,implementation_status:'not_established',next_action:tier==='build-ready'?'Build only this selected slice, retaining implementation and release gates':'Keep future slices thin; prepare only this slice’s next justified decision'};
}
function beginBatch(root,record,id,kind='implementation') {
  if(!nonempty(id))throw Error('Batch identity required');
  return reviews.change(root,record.issue.number,s=>{if(s.batches[id])return s.batches[id];return s.batches[id]={id,kind,scope:policy.inputHash(record),outcome:'interrupted_or_running',collection:'missing',startedAt:new Date().toISOString()};});
}
function collect(root,record,id,report) {
  if(!['success','failed','blocked','interrupted'].includes(report.outcome)||!Array.isArray(report.discoveries))throw Error('Explicit outcome and discoveries array required; [] means none');
  return reviews.change(root,record.issue.number,s=>{
    const b=s.batches[id];if(!b)throw Error('Unknown work batch');const key=policy.digest(report);
    if(b.reportHash){if(b.reportHash===key)return b;throw Error('Collection is immutable; record a new observation instead of overwriting it');}
    for(const d of report.discoveries){
      if(!/^[A-Za-z0-9._-]+$/.test(d.id||'')||!nonempty(d.observation)||!['observation','hypothesis','confirmed-cause'].includes(d.kind)||!nonempty(d.proposedEdit)||!d.evidence?.length||!(d.tickets?.length||d.references?.length))throw Error('Discovery requires ID, observation kind, proposed edit, impact and evidence');
      const errors=d.evidence.flatMap(ref=>policy.referenceErrors(root,ref));if(errors.length)throw Error(errors.join('; '));
      if(d.kind==='confirmed-cause'&&!d.causeEvidence?.length)throw Error('Confirmed cause requires discriminating evidence; otherwise record a hypothesis');
      for(const ref of d.causeEvidence||[])if(policy.referenceErrors(root,ref).length)throw Error('Invalid cause evidence');
      const existing=s.discoveries.find(x=>x.id===d.id);if(existing&&existing.contentHash!==policy.digest(d))throw Error('Discovery ID conflict; retain contradictory evidence under a new ID');
      if(!existing)s.discoveries.push({...d,contentHash:policy.digest(d),batch:id,sourceScope:b.scope,publication:{status:'pending',targets:{}},resolutions:{}});
    }
    Object.assign(b,{outcome:report.outcome,collection:'reported',reportHash:key,atEnd:new Date().toISOString(),discoveryIds:report.discoveries.map(d=>d.id)});return b;
  });
}
function reconcile(root,record,producer,id,resolution,options={}) {
  current(root,record,options);
  if(!['accepted','nonimpact'].includes(resolution.kind)||!nonempty(resolution.reason)||!resolution.evidence?.length)throw Error('Reconciliation needs acceptance or evidenced non-impact rationale');
  const errors=resolution.evidence.flatMap(ref=>policy.referenceErrors(root,ref));if(errors.length)throw Error(errors.join('; '));
  if(resolution.kind==='accepted') {
    // Revalidation will follow; never restore the prior readiness receipt.
    if(!nonempty(resolution.changedReference) || !(record.profile?.artifacts||[]).some(a=>(a.id===resolution.changedReference||a.path===resolution.changedReference)&&!policy.referenceErrors(root,a).length) || record.readiness?.inputHash===policy.inputHash(record))throw Error('Accepting discovery requires the affected changed reference and new validation');
  }
  return reviews.change(root,producer,s=>{const d=s.discoveries.find(d=>d.id===id);if(!d||!impacts(record,d))throw Error('Discovery does not affect this record');d.resolutions[record.issue.number]={...resolution,scope:policy.inputHash(record),at:new Date().toISOString()};return {status:'reconciled_ungraded',next_action:'Re-run affected gates and scoped review; acknowledgment alone is not readiness'};});
}
const {privacy}=require('./specflow-publication.cjs');
function publicationStatus(root,discovery) {
  const targets=new Set([...(discovery.tickets||[]),...known(root).filter(s=>s.record).flatMap(s=>{try{return impacts(read(root,s.record),discovery)?[s.issue]:[];}catch{return [];}})]);
  return targets.size && [...targets].every(n=>discovery.publication.targets[n]==='published')?'published':'pending';
}
function publish(root,record,producer,id,options={}) {
  const state=reviews.load(root,producer),d=state.discoveries.find(x=>x.id===id);if(!d||!impacts(record,d))throw Error('No applicable discovery');
  if(record.source?.kind!=='github')throw Error('Publication requires GitHub source');
  const fresh=current(root,record,options),marker=`<!-- specflow-discovery:${producer}:${id} -->`;
  // Only the approved public summary is shared; local evidence paths and raw results stay local.
  if(!nonempty(d.publicSummary))throw Error('Sanitized public summary required');
  const publicText=options.publicFile?fs.readFileSync(policy.localFile(root,options.publicFile),'utf8'):`Discovery (${d.kind}): ${d.publicSummary}\n\nProposed edit: ${d.proposedEdit}`;
  const body=`${marker}\n${publicText}\n\nThis is a proposal. Reconcile against current acceptance; readiness remains stale until revalidated.`;
  privacy(root,record,body,options);
  if(fresh.issue.comments?.some(c=>c.body?.includes(marker))){reviews.change(root,producer,s=>{const item=s.discoveries.find(x=>x.id===id);item.publication.targets[record.issue.number]='published';item.publication.status=publicationStatus(root,item);});return {status:'already_published'};}
  const result=(options.run||spawnSync)('gh',['issue','comment',String(record.issue.number),'--repo',record.source.repo,'--body-file','-'],{cwd:root,encoding:'utf8',input:body,timeout:30000});
  reviews.change(root,producer,s=>{const p=s.discoveries.find(x=>x.id===id).publication;p.targets[record.issue.number]=result.status===0?'published':'pending';p.status=publicationStatus(root,s.discoveries.find(x=>x.id===id));});
  return {status:result.status===0?'published':'blocked',next_action:result.status===0?'Reconcile proposed edit without replacing concurrent work':'Retry the pending publication; local invalidation remains active'};
}
function experiment(root,file,plan,options={}) {
  const record=register(root,file);current(root,record,options);
  if(!nonempty(plan.id)||!nonempty(plan.question)||!nonempty(plan.expectedObservation)||!plan.permissionEvidence?.length||!plan.inputs?.length||!plan.code?.length||!plan.command?.length||!Number.isInteger(plan.timeoutMs)||plan.timeoutMs<1||plan.timeoutMs>300000||!Number.isInteger(plan.maxOutputBytes)||plan.maxOutputBytes<1||plan.maxOutputBytes>4*1024*1024)throw Error('Bounded experiment requires question, approved input/code references, permissions, expected observation, command and bounded time/output');
  const config=read(root,'.specflow/experiment-policy.json'),adapter=config.adapters?.[plan.adapter];
  if(!adapter || !adapter.sandboxed || !adapter.probeCommand?.length || JSON.stringify(adapter.command)!==JSON.stringify(plan.command) || !adapter.permissionEvidence?.length) throw Error('An approved project sandbox adapter is required; no unsandboxed fallback');
  if(plan.timeoutMs>adapter.maxTimeoutMs || plan.maxOutputBytes>adapter.maxOutputBytes) throw Error('Experiment exceeds project resource policy');
  for(const ref of adapter.permissionEvidence) if(policy.referenceErrors(root,ref).length) throw Error('Experiment permission policy changed');
  const key=policy.digest({question:plan.question,expectedObservation:plan.expectedObservation,inputs:plan.inputs,code:plan.code,permissions:plan.permissionEvidence,timeoutMs:plan.timeoutMs,maxOutputBytes:plan.maxOutputBytes,adapter}),existing=reviews.load(root,record.issue.number).experiments;
  const previous=existing.filter(e=>e.planHash===key).at(-1);
  if(previous && previous.outcome!=='blocked')throw Error('No new experiment input or evidence; repeated plan cannot trigger another automatic cycle');
  if(pending(root,record).batches.length)throw Error('Collect discoveries or explicit none from the preceding batch before another experiment');
  const errors=[...plan.permissionEvidence,...plan.inputs,...plan.code].flatMap(ref=>policy.referenceErrors(root,ref));
  // Existing project sandbox is the executable boundary; no fallback or weakened mode.
  let probe={status:null,stdout:''};if(!errors.length)probe=(options.probeExecute||spawnSync)(adapter.probeCommand[0],adapter.probeCommand.slice(1),{cwd:root,encoding:'utf8',timeout:Math.min(plan.timeoutMs,30000),maxBuffer:plan.maxOutputBytes});
  let probeResult;try{probeResult=JSON.parse(probe.stdout);}catch{probeResult={};}
  const sandboxReady=probe.status===0&&probeResult.success===true&&probeResult.sandboxReady===true;
  if(previous && (errors.length||!sandboxReady))return {status:'blocked',evidence:previous.evidence,batch:previous.id,productionAccepted:false,next_action:'No new availability evidence; restore the approved input or sandbox before retrying'};
  const id=`experiment:${plan.id}:${crypto.randomUUID()}`;beginBatch(root,record,id,'experiment');
  reviews.change(root,record.issue.number,s=>s.experiments.push({id,planHash:key,question:plan.question,expectedObservation:plan.expectedObservation,outcome:'interrupted_or_running',retryOf:previous?.id||null}));
  const result=errors.length||!sandboxReady?{status:null,error:{code:errors.length?'INPUT_OR_PERMISSION_UNAVAILABLE':'SANDBOX_UNAVAILABLE'},stdout:'',stderr:''}:(options.execute||spawnSync)(plan.command[0],plan.command.slice(1),{cwd:root,encoding:'utf8',timeout:plan.timeoutMs,maxBuffer:plan.maxOutputBytes});
  const changedReferences=[...plan.permissionEvidence,...plan.inputs,...plan.code].flatMap(ref=>policy.referenceErrors(root,ref));
  const outcome=errors.length||!sandboxReady||changedReferences.length?'blocked':result.error?.code==='ETIMEDOUT'||result.error?.code==='ENOBUFS'?'budget_exhausted':result.status===0?'observed':'failed';
  const evidence=write(root,`.specflow/specification/evidence/experiment-${crypto.randomUUID()}.json`,{kind:'experiment',question:plan.question,expectedObservation:plan.expectedObservation,scope:policy.inputHash(record),planHash:key,exitCode:result.status,error:result.error?.code||null,stdout:result.stdout||'',stderr:result.stderr||'',outcome,limitations:plan.limitations||[],sandboxProbe:{exitCode:probe.status,stdout:probe.stdout||'',passed:sandboxReady},productionAccepted:false,changedReferences});
  reviews.change(root,record.issue.number,s=>{const e=s.experiments.find(e=>e.id===id);Object.assign(e,{outcome,evidence});s.batches[id].outcome=outcome;});
  return {status:outcome,evidence,batch:id,productionAccepted:false,next_action:'Collect discoveries (or explicit none); reconcile affected assumptions before promotion'};
}
function cli(args=process.argv.slice(2),root=process.cwd()) {
  try{
    const [cmd,file,...rest]=args;let result;
    if(cmd==='import'){
      const repo=file,number=Number(rest[0]),output=rest[1];if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!Number.isSafeInteger(number)||number<1||!output)throw Error('Usage: specification import <owner/repo> <issue-number> <record.json>');
      const issue=gh(root,['issue','view',String(number),'--repo',repo,'--json','number,title,body,labels,comments']);
      let previous={};try{previous=read(root,output);}catch{}
      write(root,output,{...previous,issue,source:{kind:'github',repo,number},freshness:{status:'current'}});register(root,output);result={status:'imported',record:output,tier:policy.tierOf(issue).tier,next_action:'Assess applicable seams and select only the next useful depth; import does not grant readiness'};
    }
    else if(cmd==='frontier'){const config=read(root,file);result={tickets:frontier(root,config.records,config.selected||[]),volume:volume.portfolio(root,config.records.map(f=>read(root,f)))};}
    else {
      const record=register(root,file);
      if(cmd==='status')result=boundary(root,record,{route:'spec-build',operation:'inspect'});
      else if(cmd==='promote')result=promote(root,file,rest[0],rest.slice(1).join(' '));
      else if(cmd==='review-failed'){const round=reviews.load(root,record.issue.number).reviews[rest[0]]?.at(-1);if(!round)throw Error('No reserved review');result=reviews.fail(root,{number:record.issue.number,tier:rest[0],id:round.id},rest.slice(1).join(' ')||'Interrupted review; no acceptance');}
      else if(cmd==='gate')result=gate(root,record,rest[0]);
      else if(cmd==='volume')result=volume.report(root,record,reviews.load(root,record.issue.number).volumeBaseline,verifiedDecisions(root,record));
      else if(cmd==='begin')result=beginBatch(root,record,rest[0]);
      else if(cmd==='collect')result=collect(root,record,rest[0],read(root,rest[1]));
      else if(cmd==='reconcile')result=reconcile(root,record,Number(rest[0]),rest[1],read(root,rest[2]));
      else if(cmd==='publish')result=publish(root,record,Number(rest[0]),rest[1],{publicFile:rest[2]});
      else if(cmd==='exception')result=ownerException(root,record,rest[0],{signatureFile:rest[1]});
      else if(cmd==='experiment')result=experiment(root,file,read(root,rest[0]));
      else throw Error('Usage: specification <status|frontier|promote|gate|volume|begin|collect|reconcile|publish|exception|experiment> <record.json> [arguments]');
    }
    console.log(JSON.stringify(result,null,2));return ['blocked','failed','budget_exhausted'].includes(result.status)?2:0;
  }catch(e){console.error(e.message);return 2;}
}
module.exports={read,write,current,register,boundary,dependencyCheck,frontier,gate,promote,beginBatch,collect,reconcile,discoveries,pending,privacy,publish,experiment,ownerException,cli};
if(require.main===module)process.exitCode=cli();
