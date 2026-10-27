'use strict';
// Actual core baseline/holdout ledger events, AI protocol double labelled by existing fixture.
const {coreFixture,executeCycle}=require('../helpers/improve-memory-core.cjs'),{configureRecovery}=require('../helpers/improve-recovery-core.cjs'),core=require('../../scripts/specflow-improve.cjs'),{progress}=require('../../evidence/improve-service/native-plan-driver.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
test('SERVICE-RECOVER actual baseline_recorded resumes without requiring a nonexistent baseline verification_completed event',async()=>{
 f=coreFixture({configure:x=>configureRecovery(x)});f.claimRecovery();const run=await executeCycle(f,{steps:2}),events=core.events(run.runDir);expect(events.some(e=>e.event==='baseline_recorded')).toBe(true);expect(events.some(e=>e.event==='verification_completed'&&e.phase==='baseline')).toBe(false);expect(progress(events)).toEqual({baseline:true,after:true});expect(events.filter(e=>e.event==='holdout_consumed')).toHaveLength(1);expect(core.status(run.runDir).ledger.ok).toBe(true);
 // A later frozen version must not inherit an earlier version's completed checks.
 const version=events.filter(e=>e.event==='contract_frozen').at(-1).version;expect(progress([...events,{event:'contract_frozen',version:version+1}])).toEqual({baseline:false,after:false});
},30000);
