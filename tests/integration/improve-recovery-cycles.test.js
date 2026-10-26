'use strict';
// Real core/Git/checks/authenticated archives; AI is an explicit protocol double.
const fs=require('fs'),path=require('path'),cp=require('child_process'),proc=require('../../scripts/improve-process-identity.cjs'),{coreFixture,executeCycle}=require('../helpers/improve-memory-core.cjs'),{configureRecovery}=require('../helpers/improve-recovery-core.cjs');
let f,holder;afterEach(async()=>{if(holder?.exitCode===null&&holder?.signalCode===null){const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;}f?.cleanup();f=null;holder=null;});
test('REC-CYCLE actual two-cycle core recovery preserves one terminal memory result and immutable history after holder SIGKILL and duplicate ack',async()=>{
 holder=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});f=coreFixture({configure:x=>configureRecovery(x,{initialProcess:proc.identity(holder.pid)})});expect(f.claimRecovery().generation).toBe(1);
 const initial=f.service().status(f.req).runs[0],first=await executeCycle(f,{steps:3});f.service().completeCycle({...f.req,cycle_id:first.cycle.id},first.archive);
 const before=f.service().decisionPack({repo_id:'fixture'}),outcome=before.events.find(e=>e.kind==='outcome');expect(outcome.data.decision).toBe('REVERT');const manifest=first.receipt.manifest_sha256;
 const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;expect(f.replaceExecutor().generation).toBe(2);f.holder='replacement-researcher';
 const duplicate=f.service().completeCycle({...f.req,cycle_id:first.cycle.id},first.archive);expect(duplicate.terminal_cycles).toBe(1);expect(f.service().decisionPack({repo_id:'fixture'}).revision).toBe(before.revision);expect(duplicate.cycles[0].manifest_sha256).toBe(manifest);
 const second=await executeCycle(f,{number:2,steps:2,id:'B',consumed:[outcome.hash],retry:{reason:'The actual first candidate measured three steps; remove both redundant confirmations.',evidence:[first.evidence]}});f.service().completeCycle({...f.req,cycle_id:second.cycle.id},second.archive);const beforeDuplicate=f.service().decisionPack({repo_id:'fixture'}),revision=beforeDuplicate.revision;
 f.service().completeCycle({...f.req,cycle_id:second.cycle.id},second.archive);const final=f.service().status(f.req).runs[0],memory=f.service().decisionPack({repo_id:'fixture'});
 expect(memory.revision).toBe(revision);expect(memory.events.filter(e=>e.kind==='outcome').map(e=>e.data.decision)).toEqual(['REVERT','KEEP']);expect(final.cycles).toHaveLength(2);expect(final.consumed_cycles).toBe(2);expect(final.terminal_cycles).toBe(2);expect(final.deadline_ms).toBe(initial.deadline_ms);expect(final.limits).toEqual(initial.limits);expect(final.cycles.map(c=>c.manifest_sha256)).toEqual([manifest,second.receipt.manifest_sha256]);
 for(const run of [first,second])expect(require('../../scripts/specflow-improve.cjs').events(run.runDir).filter(e=>e.event==='holdout_consumed')).toHaveLength(1);
},45000);
