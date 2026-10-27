'use strict';
const P=require('../../scripts/improve-publisher.cjs'),{fixture}=require('../helpers/improve-publication.cjs'),{createLedger}=require('../../scripts/improve-delivery-ledger.cjs');let q;afterEach(()=>{q?.cleanup();q=null;});
test('INTEGRATION-02/07/12 exact authenticated retained object exports once from fresh bare; core keeps no push credential',async()=>{q=await fixture();q.grant.revoked=true;const push=q.intent('push');expect((await q.ledger.execute(push.id)).reason_code).toBe('delivery_permission_revoked');expect(q.counts()).toEqual({push:0,pr:0});q.grant.revoked=false;expect((await q.ledger.execute(push.id)).state).toBe('confirmed');expect(q.oid('refs/heads/'+q.binding.branch)).toBe(q.result.retained_commit);const pr=q.intent('draft_pr');expect((await q.ledger.execute(pr.id)).state).toBe('confirmed');expect((await q.ledger.execute(pr.id)).remote_id).toContain('/pull/1');expect(q.counts()).toEqual({push:1,pr:1});expect(q.gateInputs.some(t=>t.includes('diff --git')&&t.includes('journey.json'))).toBe(true);expect(q.f.service().report(q.f.req).code_results[0].decision).toBe('KEEP');const env=P.environment();expect(env.GH_TOKEN).toBeUndefined();expect(env.GITHUB_TOKEN).toBeUndefined();expect(q.ioCalls.filter(c=>c.exe==='/usr/bin/gh'&&c.args[c.args.indexOf('--method')+1]==='POST').map(c=>c.args.find(a=>a.startsWith('repos/')))).toEqual(['repos/example/controller-fixture/pulls']);expect(q.ioCalls.every(c=>!c.args.includes('--force')&&!c.args.includes('merge')&&!c.args.includes('deploy'))).toBe(true);},30000);
test('INTEGRATION-03 stale actual remote base blocks before a publication write',async()=>{q=await fixture();q.createOther('main');const push=q.intent('push');expect((await q.ledger.execute(push.id)).reason_code).toBe('publication_stale_base');expect(q.counts()).toEqual({push:0,pr:0});expect(q.oid('refs/heads/'+q.binding.branch)).toBeNull();},30000);
test('INTEGRATION-03/07 unexpected remote branch is never overwritten',async()=>{q=await fixture();const other=q.createOther(q.binding.branch),push=q.intent('push');expect((await q.ledger.execute(push.id)).reason_code).toBe('publication_unexpected_branch');expect(q.counts().push).toBe(0);expect(q.oid('refs/heads/'+q.binding.branch)).toBe(other);},30000);
test('INTEGRATION-12 revocation and cancel between push and draft creation stop fresh publication',async()=>{q=await fixture();await q.ledger.execute(q.intent('push').id);q.grant.revoked=true;const pr=q.intent('draft_pr');expect((await q.ledger.execute(pr.id)).state).toBe('blocked');q.grant.revoked=false;q.f.service().cancel(q.f.req);expect((await q.ledger.execute(pr.id)).reason_code).toBe('operator_cancelled');expect(q.counts()).toEqual({push:1,pr:0});expect(q.f.service().report(q.f.req).code_results[0].decision).toBe('KEEP');},30000);
test('INTEGRATION-03/11/13 lost draft acknowledgement reconciles original PR across holder replacement without another write',async()=>{q=await fixture();await q.ledger.execute(q.intent('push').id);q.loseAck();const pr=q.intent('draft_pr');expect((await q.ledger.execute(pr.id)).state).toBe('unknown');q.actor.holder='publisher-B';q.actor.assignment_revision='assignment-B';const next=createLedger(q.options),settled=await next.reconcile(pr.id);expect(settled.state).toBe('confirmed');expect(settled.remote_id).toContain('/pull/1');expect(settled.actor.holder).toBe('publisher-A');expect(q.counts()).toEqual({push:1,pr:1});expect((await next.execute(pr.id)).remote_id).toBe(settled.remote_id);expect(q.counts().pr).toBe(1);},30000);
test('INTEGRATION-05 a canary in exact outgoing text blocks the delivery intent; no remote write',async()=>{q=await fixture();expect(()=>q.ledger.intent('draft_pr',{...q.expectedPayloads.draft_pr,body:'PUBLICATION_CANARY_219'})).toThrow('publication_privacy_blocked');expect(q.counts()).toEqual({push:0,pr:0});},30000);

test('INTEGRATION-03 actual create-only ref race rejects without rewriting unexpected contents',async()=>{q=await fixture();let other;q.setRace(()=>{other=q.createOther(q.binding.branch);});const out=await q.ledger.execute(q.intent('push').id);expect(out.state).toBe('unknown');expect(out.reason_code).toBe('publication_push_unconfirmed');expect(q.oid('refs/heads/'+q.binding.branch)).toBe(other);expect(q.counts()).toEqual({push:1,pr:0});},30000);


test('INTEGRATION-06/16 lifecycle reads bind the exact PR, append chained provenance and never change KEEP',async()=>{
 q=await fixture();await q.ledger.execute(q.intent('push').id);await q.ledger.execute(q.intent('draft_pr').id);
 expect(q.f.service().selectMemory(q.f.command({selection:q.f.selection()})).reason_code).toBe('memory_proposal_reconciliation_required');
 const first=await q.ledger.observeProposal();expect(first).toMatchObject({state:'open',availability:'confirmed',head_sha:q.result.retained_commit,source:'authenticated_owner_host_github'});
 expect(q.f.service().selectMemory(q.f.command({selection:q.f.selection()})).reason_code).toBe('pending_review');
 expect(q.f.service().selectMemory(q.f.command({selection:q.f.selection()})).reason_code).toBe('memory_proposal_reconciliation_required');
 q.setPR({state:'closed',merged_at:null,updated_at:'2026-10-27T00:01:00Z'});expect((await q.ledger.observeProposal()).state).toBe('closed_unmerged');
 q.setPR({state:'closed',merged_at:'2026-10-27T00:02:00Z',updated_at:'2026-10-27T00:02:00Z'});const merged=await q.ledger.observeProposal();expect(merged.state).toBe('merged');
 q.setPR({state:'open',merged_at:null,updated_at:'2026-10-27T00:01:00Z'});expect((await q.ledger.observeProposal()).state).toBe('merged');
 const normalLookup=q.adapters.proposal_observation.lookup;let release;let lookupNumber=0;q.adapters.proposal_observation.lookup=op=>lookupNumber++===0?new Promise(resolve=>release=resolve):normalLookup(op);const delayed=q.ledger.observeProposal();q.setPR({state:'closed',merged_at:'2026-10-27T00:02:00Z',updated_at:'2026-10-27T00:02:00Z'});expect((await q.ledger.observeProposal()).availability).toBe('confirmed');release([]);expect(await delayed).toMatchObject({state:'merged',availability:'confirmed'});q.adapters.proposal_observation.lookup=normalLookup;
 q.failLookup(true);const unknown=await q.ledger.observeProposal();expect(unknown).toMatchObject({state:'merged',availability:'unknown',fresh_for_selection:false});
 const report=q.f.service().report(q.f.req);expect(report.code_results[0].decision).toBe('KEEP');expect(report.delivery.proposal.state).toBe('merged');
 const events=q.f.service().decisionPack({repo_id:'fixture'}).events;expect(events.filter(e=>e.kind==='proposal_observation')).toHaveLength(4);expect(q.counts()).toEqual({push:1,pr:1});
},30000);

test('INTEGRATION-16 forged observation cannot change lifecycle or memory',async()=>{
 q=await fixture();await q.ledger.execute(q.intent('push').id);await q.ledger.execute(q.intent('draft_pr').id);
 q.adapters.proposal_observation.lookup=async()=>[{remote_id:'https://github.com/other/repo/pull/1',destination:'github:other/repo:x',payload_sha256:'a'.repeat(64),capture_sha256:'b'.repeat(64),updated_at:'2026-10-27T01:00:00Z',state:'closed',merged_at:'2026-10-27T01:00:00Z'}];
 expect(await q.ledger.observeProposal()).toMatchObject({state:'unknown',availability:'unknown',fresh_for_selection:false});expect(q.f.service().decisionPack({repo_id:'fixture'}).events.some(e=>e.kind==='proposal_observation')).toBe(false);
},30000);


test('INTEGRATION-07 foreign repository, base or branch binding cannot reach Git or GitHub writes',async()=>{
 q=await fixture();const create=require('../../scripts/improve-github-publisher.cjs').createAdapters;
 for(const [patch,code]of [[{repository:'injected/foreign'},'publication_destination_mismatch'],[{base_ref:'unapproved-base'},'publication_policy_denied'],[{branch:'outside/allowed-prefix'},'publication_policy_denied']]){
 expect(()=>create({binding:{...q.binding,...patch},result:q.result,refreshResult:()=>q.result,profile:q.f.profile,privateRoot:q.f.root,privacy:q.privacy,expectedPayloads:q.expectedPayloads,authorizeWrite:()=>{throw Error('must not execute');},spawn:q.transportSpawn})).toThrow(code);
 }expect(q.counts()).toEqual({push:0,pr:0});expect(q.ioCalls).toHaveLength(0);
},30000);

test('INTEGRATION-05 canary in actual authenticated retained patch blocks before any remote I/O',async()=>{
 q=await fixture({implementationData:{private_canary:'PUBLICATION_CANARY_219'}});const op=q.intent('push'),result=await q.ledger.execute(op.id);expect(result).toMatchObject({state:'blocked',reason_code:'publication_privacy_blocked'});expect(q.gateInputs.some(t=>t.includes('diff --git')&&t.includes('PUBLICATION_CANARY_219'))).toBe(true);expect(q.counts()).toEqual({push:0,pr:0});expect(q.f.service().report(q.f.req).code_results[0].decision).toBe('KEEP');
},30000);
