'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{stageInput}=require('../../scripts/improve-operation-inputs.cjs');let root;beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'stage-input-'));});afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
test('REC-RECEIPT unchanged path with changed file bytes cannot reuse its original stage input identity',()=>{
 const input=path.join(root,'candidates.json');fs.writeFileSync(input,'{"candidate":"original"}');const before=stageInput('recordCandidates',[root,input]);expect(stageInput('recordCandidates',[root,input])).toBe(before);fs.writeFileSync(input,'{"candidate":"changed"}');expect(stageInput('recordCandidates',[root,input])).not.toBe(before);
});
test('REC-RECEIPT core ledger and owner configuration bytes bind the actual same-path stage input',()=>{
 const ledger=path.join(root,'ledger.jsonl'),cfg=path.join(root,'job.json');fs.writeFileSync(ledger,'first event');fs.writeFileSync(cfg,'first config');const before=stageInput('build',[root],cfg);fs.appendFileSync(ledger,'second event');const changed=stageInput('build',[root],cfg);expect(changed).not.toBe(before);fs.writeFileSync(cfg,'second config');expect(stageInput('build',[root],cfg)).not.toBe(changed);
});
test('REC-RECEIPT a symlink argument is rejected before protected launch',()=>{
 const file=path.join(root,'input'),alias=path.join(root,'alias');fs.writeFileSync(file,'bytes');fs.symlinkSync(file,alias);expect(()=>stageInput('oracle',[root,{include:[alias]}])).toThrow('stage_input_symlink');
});
