'use strict';
// Trusted supervisor bridge. It adds the five fixed backend services to the
// same signed attempt as worker containers; it grants no execution authority.
const crypto=require('crypto');
const {BackendJournal,fingerprint}=require('./improve-backend-supervisor.cjs');
const attempts=require('./improve-backend-attempt.cjs');
const identity=require('./improve-process-identity.cjs');
const {canonical}=require('./improve-production-build.cjs');
const need=(ok,code='backend_cleanup_unconfirmed')=>{if(!ok)throw Error(code);};
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
class ManagedBackendJournal extends BackendJournal {
 #store; #ref; #controller;
 constructor({store,attempt,...options}) {
  const active=attempts.read(store,attempt);
  need(active.jobId===options.jobId&&canonical(active.owner)===canonical(options.controller),'backend_input_changed');
  super({...options,attemptId:active.attemptId,deadlineAtMs:active.deadlineAtMs});
  this.#store=store;this.#ref=attempt;this.#controller=options.controller;
 }
 #events(role){return attempts.resourceEvents(this.#store,this.#ref,role);}
 #event(role,state,id=null,inspectionSha256=null){return attempts.resourceEvent(this.#store,this.#ref,role,{state,id,inspectionSha256});}
 reserve(role,planForSlot){
  need(typeof planForSlot==='function','backend_input_invalid');
  const slot=super.reserve(role),plan=planForSlot(slot);
  need(Array.isArray(plan)&&plan.length>0&&plan.length<1024&&plan.every(v=>typeof v==='string'),'backend_input_invalid');
  const intent=attempts.intent(this.#store,this.#ref,{slot:role,
   expectedConfigSha256:hash(plan),creator:this.#controller,supervisor:identity.identity()});
  need(intent.name===slot.name,'backend_input_changed');return slot;
 }
 dispatch(role,plan){const state=this.check();need(!state.cause,state.cause||'backend_lease_expired');
  const intent=attempts.intents(this.#store,this.#ref).find(i=>i.value.slot===role);need(intent&&intent.value.expectedConfigSha256===hash(plan),'backend_input_changed');
  this.#event(role,'dispatching');}
 created(role,c,anchor){
  super.created(role,c,anchor);
  const slot=this.snapshot().resources.find(r=>r.role===role);
  this.#event(role,'created',c.Id,slot.createdFingerprint);
 }
 started(role,c){
  super.started(role,c);
  const created=this.#events(role).find(e=>e.state==='created');
  need(created);this.#event(role,'started',c.Id,created.inspectionSha256);
 }
 cleanupTarget(role,c){
  const events=this.#events(role),created=events.find(e=>e.state==='created');
  need(created&&!events.some(e=>['foreign','unconfirmed','not_dispatched'].includes(e.state)));
  const slot=this.snapshot().resources.find(r=>r.role===role);
  // Only the acknowledged object with the recorded complete configuration can
  // be removed. A name match or a currently absent delayed create is insufficient.
  need(c&&c.Id===created.id&&created.inspectionSha256===slot.createdFingerprint&&
   fingerprint(c)===(slot.status==='created'?slot.createdFingerprint:slot.runningFingerprint));
  return super.cleanupTarget(role,c);
 }
 removed(role,observedAbsent){
  need(observedAbsent===true);
  const events=this.#events(role),created=events.find(e=>e.state==='created');
  need(!events.some(e=>['foreign','unconfirmed'].includes(e.state)));
  if(created){need(events.some(e=>e.state==='dispatching'));this.#event(role,'removed',created.id,created.inspectionSha256);}
  else {need(!events.some(e=>e.state==='dispatching'));this.#event(role,'not_dispatched');}
  return super.removed(role,true);
 }
 finishCleanup(){
  const terminal=super.finishCleanup();
  if(terminal.phase!=='cleaned')attempts.operatorRequired(this.#store,this.#ref);
  return terminal;
 }
 cleanupFailed(){const terminal=super.cleanupFailed();attempts.operatorRequired(this.#store,this.#ref);return terminal;}
}
module.exports={ManagedBackendJournal};
