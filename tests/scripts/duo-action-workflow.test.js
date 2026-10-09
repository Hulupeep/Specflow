const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');const proof=require('../../scripts/duo-live-action-proof.cjs');
test.each(['claude-code','codex'])('J-DUO-ACTION-LIVE preparation %s uses actual installed native skill and preserves unverified state',host=>{
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'duo-native-prep-'));
 try{const {meta,prompt}=proof.prepare(dest,host);expect(fs.existsSync(path.join(meta.root,meta.installedSkill))).toBe(true);expect(prompt.startsWith(host==='claude-code'?'/duo-build':'$duo-build')).toBe(true);expect(meta.invocation.args).not.toContain('--disable-slash-commands');expect(meta.realModels).toBe(true);const summary=proof.summarize(meta,0);expect(summary.passed).toBe(false);expect(summary.verifiedCorrection).toBe(false);
 const helper=path.join(meta.root,'scripts/duo-build.cjs');try{execFileSync(process.execPath,[helper,'status',meta.runId],{cwd:meta.root,env:{...process.env,SPECFLOW_DUO_REVIEWER:'1'},stdio:'pipe'});throw Error('Recursion escaped');}catch(e){expect(e.status).toBe(2);expect(e.stderr.toString()).toContain('Recursive');}
 }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
test('Stop proof requires an actual interception before review, independently observed output and verified finish',()=>{
 // Explicitly simulated records test the proof checker, not the live CLI behavior.
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'duo-stop-proof-check-'));
 try{
  const {meta}=proof.prepare(dest,'claude-code','stop'),file=path.join(meta.root,'.specflow/duo',meta.runId,'run.json');
  const state=JSON.parse(fs.readFileSync(file));state.goalStatus='complete';state.outcome='accepted';state.history=[{stage:'validated',outcome:'accepted',review:{instruction_assessments:[]}}];for(const c of Object.values(state.criteria))c.status='verified';fs.writeFileSync(file,JSON.stringify(state));fs.writeFileSync(path.join(meta.root,'display.cjs'),"console.log('Total: 42')");
  const hook={subtype:'hook_response',hook_event:'Stop',stdout:JSON.stringify({decision:'block'})};const review={message:{content:[{type:'tool_use',input:{command:'node scripts/duo-build.cjs review run'}}]}};
  const record=events=>fs.writeFileSync(path.join(dest,'builder.stdout.jsonl'),events.map(x=>JSON.stringify(x)).join('\n'));
  record([review]);expect(proof.summarize(meta,0).passed).toBe(false);
  record([review,hook]);expect(proof.summarize(meta,0).passed).toBe(false);
  record([hook,review]);expect(proof.summarize(meta,0)).toMatchObject({passed:true,verifiedCorrection:false,stopInterceptedBeforeReview:true});
  fs.writeFileSync(path.join(meta.root,'display.cjs'),"console.log('Total: 41')");expect(proof.summarize(meta,0).passed).toBe(false);
 }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
test('repeated-ignore proof requires both real hook boundaries and cannot certify completion',()=>{
 // Explicitly simulated event records exercise checker rejection; native proof is separate.
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'duo-ignore-proof-check-'));
 try{
  const {meta,prompt}=proof.prepare(dest,'claude-code','ignore');expect(prompt).toContain('deliberately ignore');
  const file=path.join(dest,'builder.stdout.jsonl'),block={subtype:'hook_response',hook_event:'Stop',stdout:JSON.stringify({decision:'block'})},end={subtype:'hook_response',hook_event:'Stop',stdout:JSON.stringify({continue:false,stopReason:'automatic continuation exhausted'})};
  const record=events=>fs.writeFileSync(file,events.map(x=>JSON.stringify(x)).join('\n'));
  record([block]);expect(proof.summarize(meta,0).passed).toBe(false);
  record([end,block]);expect(proof.summarize(meta,0).passed).toBe(false);
  record([block,end]);expect(proof.summarize(meta,0)).toMatchObject({passed:true,boundedNoncompliance:true,goalStatus:'incomplete'});
  const stateFile=path.join(meta.root,'.specflow/duo',meta.runId,'run.json'),state=JSON.parse(fs.readFileSync(stateFile));state.goalStatus='complete';fs.writeFileSync(stateFile,JSON.stringify(state));expect(proof.summarize(meta,0).passed).toBe(false);
 }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
