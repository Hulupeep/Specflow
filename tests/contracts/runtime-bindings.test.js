const fs = require('fs'), os = require('os'), path = require('path');
const yaml = require('js-yaml');
const routing = require('../../scripts/runtime-routing.cjs');
const runner = require('../../scripts/specflow-runner.cjs');
const duo = require('../../scripts/duo-build.cjs');
const scoped = require('../../scripts/specflow-reviews.cjs');
const assignment = require('../../scripts/review-assignment.cjs');
const transcript = require('../helpers/duo-direction.js');
const {execFileSync}=require('child_process');
const {spawnSync}=require('child_process');
const SOURCE = path.resolve(__dirname, '../..');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-bindings-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function profile(runtime) { return yaml.load(fs.readFileSync(path.join(SOURCE, 'templates/adapter-policies', routing.RUNTIMES[runtime]), 'utf8')); }
function installed(runtime) { routing.installRuntimeRouting({ sourceRoot: SOURCE, targetRoot: root, runtime, interactive: false }); }

describe('J-RUNTIME-CODEX-ONLY / J-RUNTIME-CLAUDE-ONLY', () => {
  test.each(['codex','claude-code'])('%s traverses actual routed command construction and owning gate re-entry with the opposite executable absent', runtime => {
    installed(runtime);const bin=path.join(root,'bin');fs.mkdirSync(bin);
    const host=runtime==='codex'?'codex':'claude';
    for(const tool of ['node','sh'])fs.symlinkSync(tool==='node'?process.execPath:'/bin/sh',path.join(bin,tool));
    fs.writeFileSync(path.join(bin,host),`#!${process.execPath}\nconst fs=require('fs');fs.appendFileSync('argv.jsonl',JSON.stringify({host:${JSON.stringify(host)},argv:process.argv.slice(2),simulated:true})+'\\n');if(process.env.PROTOCOL_FAIL)process.exit(23);fs.writeFileSync(process.env.PROTOCOL_ARTIFACT,JSON.stringify({stage:process.env.PROTOCOL_STAGE,value:42,simulated:true}));console.log(JSON.stringify(${host==='claude'?"{type:'assistant',message:{model:'claude-fable-5',content:[{type:'text',text:'Simulated role artifact persisted'}]}}":"{type:'item.completed',item:{type:'agent_message',text:'Simulated role artifact persisted'}}"}));\n`);fs.chmodSync(path.join(bin,host),0o755);
    const env={...process.env,PATH:bin};
    expect(spawnSync(host==='codex'?'claude':'codex',['--version'],{env}).error.code).toBe('ENOENT');
    const r=spawnSync(process.execPath,[path.join(SOURCE,'tests/helpers/runtime-path-protocol.cjs'),SOURCE,runtime],{cwd:root,env,encoding:'utf8',timeout:30000});
    if(r.status!==0)throw Error(r.stdout+r.stderr);
    const result=JSON.parse(r.stdout);expect(result).toMatchObject({simulated:true,productionReady:false,handoff:'human_ci_handoff_required',scoped:'scoped_review_required'});
    expect(result.rows).toHaveLength(9);
    const argv=fs.readFileSync(path.join(root,'argv.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    expect(argv.every(x=>x.host===host)).toBe(true);
  });
  test.each([['codex','codex-exec','codex'],['claude-code','claude-print','claude']])('%s covers every real generative role using only its host', (runtime, provider, command) => {
    const p = profile(runtime);
    expect(routing.validateRoleRoutes(p, SOURCE)).toEqual({ ok: true });
    for (const routes of Object.values(p.routes)) for (const r of Object.values(routes)) {
      const a = p.policies[r.policy].adapter_policy;
      expect(a.provider).toBe(provider); expect(a.command).toBe(command);
    }
    expect(p.routes['feature-build'].review).toBeUndefined();
    const critic = p.policies[p.routing_profile.normal_review.policy].adapter_policy;
    expect(p.routing_profile.normal_review.method).toBe('fresh-native');
    const argv = runner.buildAdapterCommand(critic).args;
    expect(argv).not.toEqual(expect.arrayContaining(['--resume']));
    if (runtime === 'codex') expect(argv).toEqual(expect.arrayContaining(['--sandbox','read-only','--ephemeral']));
    else expect(critic.allowed_tools).toEqual(['Read','Grep','Glob']);
    const author = p.policies[p.routes['spec-build'].draft.policy].adapter_policy;
    if (runtime === 'claude-code') expect(author.allowed_tools).toEqual(expect.arrayContaining(['Write','Edit']));
  });
});
describe('J-RUNTIME-ORPHAN-REJECTED', () => {
  test.each(['codex','claude-code'])('%s rejects an orphan and missing required role before invocation', runtime => {
    const p = profile(runtime); p.routes['feature-build'].nonexistent = { policy: Object.keys(p.policies)[0] };
    expect(() => routing.validateRoleRoutes(p, SOURCE)).toThrow(/orphan.*feature-build.nonexistent/i);
    delete p.routes['feature-build'].nonexistent; delete p.routes['spec-build'].draft;
    expect(() => routing.validateRoleRoutes(p, SOURCE)).toThrow(/missing.*spec-build.draft/i);
  });
  test('a caller cannot turn a gate into a new generative route', () => {
    const p = profile('codex'); p.routes['spec-build'].GATE_B = { policy: Object.keys(p.policies)[0] };
    expect(() => routing.validateRoleRoutes(p, SOURCE)).toThrow(/mechanical|orphan/i);
  });
  test('the copied project runner validates its installed QA path rather than requiring the source layout',()=>{
    fs.mkdirSync(path.join(root,'QA/loops'),{recursive:true});for(const loop of ['spec-build','feature-build'])fs.copyFileSync(path.join(SOURCE,'templates/loops',loop+'.yaml'),path.join(root,'QA/loops',loop+'.yaml'));
    expect(routing.validateRoleRoutes(profile('codex'),root)).toEqual({ok:true});
  });
});
describe('trusted native review assignment', () => {
  test.each(['codex','claude-code'])('%s resolves the actual managed profile, not caller identity claims', runtime => {
    installed(runtime);
    const a = require('../../scripts/review-assignment.cjs');
    const record = { profile: {} };
    const selected = a.resolve(root, record, SOURCE);
    expect(selected).toMatchObject({ method:'fresh-native', runtime, purpose:'preparation' });
    expect(a.trusted(selected)).toBe(true);
    expect(a.trusted(JSON.parse(JSON.stringify(selected)))).toBe(false);
    expect(() => a.resolve(root, { profile: { requiredReviewMethod:'duo' } }, SOURCE)).toThrow(/Duo|duo/);
    fs.appendFileSync(path.join(root,'.specflow/adapter-routing.yml'),'\n# drift\n');
    expect(() => a.resolve(root, record, SOURCE)).toThrow(/stale|differs/i);
    expect(() => a.validate(root,selected)).toThrow(/changed|differs|stale/i);
  });
  test('custom routing cannot impersonate an approved native assignment', () => {
    installed('codex');
    const file=path.join(root,'.specflow/install-state.yml'), s=yaml.load(fs.readFileSync(file,'utf8'));
    s.routing.managed=false;fs.writeFileSync(file,yaml.dump(s));
    expect(() => require('../../scripts/review-assignment.cjs').resolve(root,{profile:{}},SOURCE)).toThrow(/custom|managed/i);
  });
  test('binding is idempotent for the same current assignment and preserves existing readiness',()=>{
    installed('codex');const issue={number:56,body:'AC-1: isolated binding',labels:['spec:thin']};fs.writeFileSync(path.join(root,'issue.json'),JSON.stringify(issue));
    const a=require('../../scripts/review-assignment.cjs'),record={issue,source:{kind:'file',path:'issue.json'},profile:{}};fs.writeFileSync(path.join(root,'record.json'),JSON.stringify(record));
    expect(a.bind(root,'record.json',SOURCE).status).toBe('bound');
    const bound=JSON.parse(fs.readFileSync(path.join(root,'record.json')));bound.readiness={id:'explicitly-simulated-idempotence-only'};fs.writeFileSync(path.join(root,'record.json'),JSON.stringify(bound));
    expect(a.bind(root,'record.json',SOURCE)).toMatchObject({status:'unchanged',readinessPreserved:true});
    expect(JSON.parse(fs.readFileSync(path.join(root,'record.json'))).readiness).toEqual(bound.readiness);
  });
});

describe('owning native method and purpose, without relaxing explicit Duo', () => {
  function fixture(runtime, scopedTier=false){
    installed(runtime);
    const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
    git('init','-q');git('config','user.email','fixture@example.invalid');git('config','user.name','Runtime fixture');
    for(const [f,s] of Object.entries({'.gitignore':'.specflow/\n','goal.md':'Verify the explicit isolated fixture','task.md':'AC-1: observed value equals 42','raw.txt':'Observed value: 42'}))fs.writeFileSync(path.join(root,f),s);
    const record={issue:{number:56,body:'AC-1: observed value equals 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
    const a=assignment.resolve(root,record,SOURCE);record.profile.reviewAssignment=a;
    fs.writeFileSync(path.join(root,'record.json'),JSON.stringify(record));git('add','.');git('commit','-qm','test: isolated runtime fixture (#56)');
    const c={workKind:'preparation',goal:'goal.md',task:'task.md',objective:'Verify a labelled synthetic fixture',finish:'AC-1 verified',specification:{record:'record.json',...(scopedTier?{targetTier:'contracted'}:{})},criteria:[{id:'AC-1',source:'task.md',anchor:'AC-1:',kind:'acceptance'}]};
    return {a,c,record};
  }
  function simulated(calls){return (exe,args,options)=>{
    calls.push({exe,args});
    if(args[0]==='--version')return 'explicitly-simulated';
    if(args[0]==='auth')return '{"loggedIn":true}';
    if(args[0]==='login')return 'Logged in using ChatGPT';
    const request=JSON.parse(fs.readFileSync(path.join(options.cwd,'request.json')));
    const result={outcome:'accepted',summary:'Explicitly simulated protocol fixture, not live qualification',inspected:request.requiredReads,findings:[],unrelated:[],index_complete:true,assessments:request.batch.criteria.map(id=>({id,status:'verified',evidence:['raw.txt'],reason:'Fixture 42 observed'})),resolutions:[],diagnostics:[]};
    if(request.specification_review){result.specification_findings=[];result.specification_nonblocking=[];}
    transcript.feedback(request,result);return transcript.transport(result,exe,options.cwd);
  };}
  test.each(['codex','claude-code'])('%s constructs a fresh same-host readonly call; status and facade cannot call it Duo',runtime=>{
    const {a,c}=fixture(runtime),run=duo.start(root,'#56',runtime,c,null,a),calls=[];
    const batch={id:'fixture',scope:'isolated protocol only',criteria:['AC-1'],claims:['fixture passes'],assumptions:[],evidence:['raw.txt'],resolutions:[]};
    const reviewed=duo.review(root,run.id,batch,simulated(calls),run.owner.session);
    expect(reviewed.outcome).toBe('accepted');
    const call=calls.at(-1);expect(call.exe).toBe(runtime==='codex'?'codex':'claude');
    expect(call.args).not.toEqual(expect.arrayContaining(['--resume','--continue']));
    expect(duo.status(reviewed)).toContain('not Duo-verified');
    expect(()=>duo.resume(root,run.id,runtime==='codex'?'claude-code':'codex',{takeover:true,reason:'cannot change host'})).toThrow(/pinned/);
    const error=jest.spyOn(console,'error').mockImplementation(()=>{});
    try{expect(duo.cli(['status',run.id],root)).toBe(2);expect(error.mock.calls.flat().join(' ')).toMatch(/use specflow review/);}finally{error.mockRestore();}
    expect(duo.load(root,run.id).state.reviewMethod).toBe('fresh-native');
  });
  test.each(['codex','claude-code'])('%s simulated content transcripts cannot grant scoped readiness',runtime=>{
    const {a,c,record}=fixture(runtime,true),run=duo.start(root,'#56',runtime,c,null,a);
    const result=duo.review(root,run.id,{id:'simulated',scope:'not native',criteria:['AC-1'],claims:['simulated'],assumptions:[],evidence:['raw.txt'],resolutions:[]},simulated([]),run.owner.session);
    expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/owning native content execution/);
    expect(scoped.status(root,record,'contracted').passed).toBe(false);
  });
  test('unbranded assignment and raw family/method fields cannot authorise same-host mode',()=>{
    const {a,c}=fixture('codex');
    expect(()=>duo.start(root,'#56','codex',c,null,JSON.parse(JSON.stringify(a)))).toThrow(/trusted/);
    const ordinary=duo.start(root,'#56','codex',{...c,reviewMethod:'fresh-native'});
    expect(ordinary.reviewMethod).toBeUndefined();
    expect(duo.invocation('codex',root).exe).toBe('claude');
    expect(()=>assignment.executed({id:'forged'},a,{},[],root,{})).toThrow(/native transport/);
  });
  test('Codex strict schema translation preserves the canonical rules and reference enums',()=>{
    const original={type:'object',properties:{rows:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',enum:['real-evidence']}}}};
    const codex=duo.providerSchema(original,'codex');
    expect(codex.properties.rows).toEqual({type:'array',minItems:1,items:{type:'string',enum:['real-evidence']}});
    expect(original.properties.rows.uniqueItems).toBe(true);
    expect(duo.providerSchema(original,'claude')).toEqual(original);
  });
  test('a resumed native run rechecks a newly strengthened project Duo requirement before invoking a provider',()=>{
    const {a,c,record}=fixture('codex'),run=duo.start(root,'#56','codex',c,null,a);
    record.profile.requiredReviewMethod='duo';fs.writeFileSync(path.join(root,'record.json'),JSON.stringify(record));
    expect(()=>duo.inspect(root,run.id,run.owner.session)).toThrow(/requires Duo/);
  });
  test('a version command cannot issue a native review transport capability',()=>{
    const {a}=fixture('codex');fs.writeFileSync(path.join(root,'request.json'),JSON.stringify({review_method:'fresh-native',review_purpose:'preparation',github:null}));
    const child=require('child_process'),spawn=jest.spyOn(child,'spawnSync').mockReturnValue({status:0,stdout:'explicitly simulated version response',stderr:''});
    try{expect(()=>assignment.invoke(a,'codex',['--version'],{cwd:root,env:{SPECFLOW_DUO_REVIEWER:'1'}})).toThrow(/canonical.*read-only|owning review invocation/);expect(spawn).not.toHaveBeenCalled();}finally{spawn.mockRestore();}
  });
  test('accidentally tracked managed adapter transcripts are excluded from snapshots/diffs and cannot be explicit review evidence',()=>{
    const {a,c}=fixture('codex');const file='.specflow/runs/build/adapter/codex-sol-implementer.jsonl';fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'Explicitly simulated private builder reasoning');execFileSync('git',['add','-f',file],{cwd:root});
    expect(Object.hasOwn(duo.manifest(root),file)).toBe(false);
    expect(()=>duo.manifest(root,[file])).toThrow(/Sensitive|private/);
    const run=duo.start(root,'#56','codex',c,null,a),peer=simulated([]);let inspected=false;
    const actual=duo.review(root,run.id,{id:'private-inputs',scope:'explicitly simulated snapshot isolation',criteria:['AC-1'],claims:['fixture only'],assumptions:[],evidence:['raw.txt'],resolutions:[]},(exe,args,options)=>{
      if(options?.cwd){for(const name of ['diff.patch','index.patch'])expect(fs.readFileSync(path.join(options.cwd,name),'utf8')).not.toContain('private builder reasoning');inspected=true;}return peer(exe,args,options);
    },run.owner.session);
    expect(inspected).toBe(true);expect(actual.outcome).toBe('accepted');
  });
});
