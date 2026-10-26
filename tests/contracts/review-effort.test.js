const continuation = require('../../scripts/review-continuation.cjs');
const crypto = require('crypto');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
function captured(stdout, extra = {}) {
  const text=JSON.stringify({duo_capture:1,command:['node','diagnose.js'],exitCode:0,error:null,
    stdout,stderr:'',sourceBefore:'a'.repeat(64),sourceAfter:'a'.repeat(64),stable:true,
    startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),...extra});
  return {path:'diagnosis.json',sha256:sha(text),text};
}
const summary = records => continuation.evidenceSummary(records);
const request = records => ({kind:'protocol',cause:'Observed missing input',action:'Change the evidenced input',
  evidence:records.map(({path,sha256})=>({path,sha256}))});
function failedRecovery() {
  const state=continuation.create({usageMode:'subscription'});
  for(let i=0;i<3;i++){continuation.beforeCall(state,()=>{});continuation.observe(state,{protocol:true});}
  const first=[captured('missing source A')];
  continuation.recover(state,request(first),()=>summary(first));
  continuation.beforeCall(state,()=>summary(first));
  continuation.observe(state,{protocol:true});
  return {state,first};
}

test('J-EFFORT-RETRY: a second distinct evidenced recovery continues the same subscription run', () => {
  const state = continuation.create({ usageMode: 'subscription' });
  for (let i = 0; i < 3; i++) {
    continuation.beforeCall(state, () => {});
    continuation.observe(state, { protocol: true });
  }
  const input = (id) => ({
    kind: 'protocol', cause: 'Missing native reads: ' + id,
    action: 'Repair the evidenced missing reads: ' + id,
    evidence: [{ path: id, sha256: id.repeat(64) }]
  });
  const observation = (id) => ({ key: id.repeat(64), execution: true, finishedAt: Date.now() });
  continuation.recover(state, input('a'), () => observation('a'));
  continuation.beforeCall(state, () => observation('a'));
  continuation.observe(state, { protocol: true });
  expect(() => continuation.recover(state, input('b'), () => observation('b'))).not.toThrow();
  continuation.beforeCall(state, () => observation('b'));
  expect(state.calls).toBe(5);
  expect(state.recoveries).toHaveLength(2);
  expect(state.achievements).toEqual([]);
  expect(state.policy).toEqual({ usageMode: 'subscription' });
});

test('J-EFFORT-REPLAY: capture names, timestamps and narrative cannot create a new observation', () => {
  const {state,first}=failedRecovery();
  const copy=[captured('missing source A'),{path:'renamed-note',sha256:sha('new wording'),text:'new wording'}];
  copy[0].path='different-capture-name.json';
  expect(summary(first).key).toBe(summary(copy).key);
  expect(()=>continuation.recover(state,{...request(copy),action:'different words'},()=>summary(copy))).toThrow('No new recovery observation');
  expect(state.calls).toBe(4);
  expect(state.recoveries).toHaveLength(1);
});

test('J-EFFORT-REPLAY: regrouping previously used captures is not novelty', () => {
  const {state}=failedRecovery(),second=[captured('missing source B')];
  continuation.recover(state,request(second),()=>summary(second));
  continuation.beforeCall(state,()=>summary(second));
  continuation.observe(state,{protocol:true});
  const regrouped=[captured('missing source B'),captured('missing source A')];
  expect(()=>continuation.recover(state,request(regrouped),()=>summary(regrouped))).toThrow('No new recovery observation');
  expect(state.calls).toBe(5);
  expect(state.achievements).toEqual([]);
});

test('J-EFFORT-FRESHNESS: a different observation from before the previous call is rejected', () => {
  const {state}=failedRecovery(),old=[captured('different but old',{finishedAt:'2000-01-01T00:00:00Z'})];
  expect(()=>continuation.recover(state,request(old),()=>summary(old))).toThrow('predates');
  expect(state.calls).toBe(4);
});

test.each([
  {stable:false},{stable:'true'},{sourceAfter:'b'.repeat(64)},
  {finishedAt:'not-a-date'},{command:[]},{stdout:null},{sourceBefore:'not-a-hash'}
])('J-EFFORT-FRESHNESS: invalid capture is rejected: %j', extra => {
  expect(()=>summary([captured('observation',extra)])).toThrow('malformed or source-unstable');
});

test('J-EFFORT-CAPS: explicit owner ceiling remains a hard boundary after recovery', () => {
  const {state}=failedRecovery();
  state.policy.maxCalls=4; // Explicit policy supplied by this owner fixture.
  const newer=[captured('new observation')];
  expect(continuation.decision(state)).toMatchObject({kind:'checkpoint'});
  expect(()=>continuation.recover(state,request(newer),()=>summary(newer))).toThrow('maxCalls');
  expect(()=>continuation.beforeCall(state,()=>{})).toThrow('maxCalls');
  expect(state.calls).toBe(4);
});

test('J-EFFORT-COMPAT: old captured receipts stay immutable while their keys are reconstructed', () => {
  const {state,first}=failedRecovery();
  for(const field of ['observationKey','observationKeys','executionEvidence'])delete state.recoveries[0][field];
  const before=JSON.stringify(state.recoveries[0]),next=[captured('missing source B')];
  const validate=refs=>summary(refs[0].sha256===first[0].sha256?first:next);
  continuation.recover(state,request(next),validate);
  expect(JSON.stringify(state.recoveries[0])).toBe(before);
  expect(state.calls).toBe(4);
  expect(state.recoveries).toHaveLength(2);
});

test('J-EFFORT-COMPAT: an old captured fact cannot be revived by timestamp-only recapture', () => {
  const {state,first}=failedRecovery();
  for(const field of ['observationKey','observationKeys','executionEvidence'])delete state.recoveries[0][field];
  const copy=[captured('missing source A')];
  const validate=refs=>summary(refs[0].sha256===first[0].sha256?first:copy);
  expect(()=>continuation.recover(state,request(copy),validate)).toThrow('No new recovery observation');
});
