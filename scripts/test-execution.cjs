'use strict';
// Native case accounting, shared by the existing runner, journey hook and CI.
// Parsing proves no execution. Only execute() issues process-local receipts;
// persisted JSON remains historical evidence until an owning verifier checks it.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const outcome=require('./outcome-contract.cjs');
const oracleComparison=require('./oracle-comparison.cjs');
const dataSeams=require('./data-seams.cjs');
const issued=new WeakMap();
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const unique=list=>Array.isArray(list)&&list.every(s=>typeof s==='string'&&s.trim())&&new Set(list).size===list.length;
const levels=['static','unit','process','integration','journey'];
function validate(check) {
 const e=check?.execution,errors=[];
 if(typeof check?.id!=='string'||!check.id.trim())errors.push('stable runtime check id required');
 if(!e||typeof e!=='object'||Array.isArray(e))return{ok:false,errors:['native execution adapter and accepted case inventory required; revise the verification contract']};
 for(const key of Object.keys(e))if(!['adapter','test_files','required_case_ids','optional_case_ids','args','claim_kind','comparison_ids','seam_ids'].includes(key))errors.push(`unknown execution field: ${key}`);
 if(e.seam_ids!==undefined&&!unique(e.seam_ids))errors.push('seam_ids must be unique accepted data seam IDs');
 if(e.claim_kind!==undefined&&!oracleComparison.KINDS.includes(e.claim_kind))errors.push('unsupported native claim_kind');
 if(e.comparison_ids!==undefined&&!unique(e.comparison_ids))errors.push('comparison_ids must be unique IDs');
 if(e.claim_kind==='correctness'&&!e.comparison_ids?.length)errors.push('correctness requires accepted parent comparison_ids');
 if(e.comparison_ids?.length&&e.claim_kind!=='correctness')errors.push('comparison_ids require correctness claim_kind');
 if(!['jest','playwright'].includes(e.adapter))errors.push('unsupported native report adapter');
 if(!unique(e.test_files)||!e.test_files.length||e.test_files.some(p=>!outcome.validLocalPath(p)))errors.push('execution.test_files must name unique repository-relative files');
 for(const key of ['required_case_ids','optional_case_ids'])if(!unique(e[key]))errors.push(`execution.${key} must be a unique case-ID array`);
 if(check.required&&(!e.required_case_ids?.length))errors.push('required check needs required native case IDs');
 if(Array.isArray(e.required_case_ids)&&Array.isArray(e.optional_case_ids)&&e.required_case_ids.some(id=>e.optional_case_ids.includes(id)))errors.push('required and optional native case IDs overlap');
 if(!Array.isArray(e.args)||e.args.some(a=>typeof a!=='string'||/^(?:--(?:json|outputFile|output-file|output|coverageDirectory|cacheDirectory|updateSnapshot|reporter(?:s|-only-failures)?|list(?:Tests)?|showConfig|watch(?:All)?|help|version)|-h|-v|-u)(?:=|$)/.test(a)))errors.push('native args must preserve owning report output and actual execution (no listing/watch/report overrides)');
 if(check.timeout_seconds!==undefined&&(!Number.isFinite(check.timeout_seconds)||check.timeout_seconds<=0))errors.push('timeout_seconds must be a positive finite runtime bound');
 if(!levels.includes(check.verification_level))errors.push('accepted verification_level required');
 if(!unique(check.boundaries)||!check.boundaries.length)errors.push('accepted exercised boundaries required');
 for(const field of ['checker_paths','input_paths','rule_paths'])if(!unique(check[field])||check[field].some(p=>!outcome.validLocalPath(p)))errors.push(`accepted ${field} required`);
 if(Array.isArray(e.test_files)&&Array.isArray(check.checker_paths)&&e.test_files.some(p=>!check.checker_paths.includes(p)))errors.push('every native test file must be bound in checker_paths');
 return{ok:!errors.length,errors};
}
function relativeFile(root,file,reportRoot=root) {
 if(typeof file!=='string'||!file)throw Error('native case has no file identity');
 const absolute=path.isAbsolute(file)?path.resolve(file):path.resolve(reportRoot,file),relative=path.relative(root,absolute).split(path.sep).join('/');
 if(!outcome.validLocalPath(relative))throw Error('native case file is outside the project');
 return relative;
}
function parse(report,adapter,root) {
 const cases=[],errors=[];
 try {
  if(!report||typeof report!=='object'||Array.isArray(report))throw Error('malformed native report');
  if(adapter==='jest') {
   if(!Array.isArray(report.testResults)||!Number.isInteger(report.numTotalTests)||typeof report.success!=='boolean')throw Error('missing native Jest report fields');
   for(const suite of report.testResults) {
    if(!Array.isArray(suite.assertionResults))throw Error('missing Jest case collection');
    const file=relativeFile(root,suite.name);
    for(const item of suite.assertionResults) {
     if(typeof item.fullName!=='string'||!item.fullName)throw Error('missing Jest full case name');
     const status={passed:'passed',failed:'failed',pending:'skipped',todo:'skipped',skipped:'skipped',disabled:'skipped'}[item.status];
     if(!status)throw Error(`unknown native Jest case status: ${String(item.status)}`);
     cases.push({id:`${file}::${item.fullName}`,file,status,native_status:item.status,...(item.invocations!==undefined?{invocations:item.invocations}:{})});
    }
   }
   if(report.numTotalTests!==cases.length||report.numPassedTests!==cases.filter(c=>c.status==='passed').length||report.numFailedTests!==cases.filter(c=>c.status==='failed').length)throw Error('native Jest aggregate/case counts disagree');
   const todo=cases.filter(c=>c.native_status==='todo').length,pending=cases.filter(c=>c.status==='skipped'&&c.native_status!=='todo').length;
   if(report.numPendingTests!==pending||report.numTodoTests!==todo)throw Error('native Jest skipped/todo counts disagree');
   if(!report.success)errors.push('native suite reported unsuccessful');
   if(report.wasInterrupted)errors.push('native execution interrupted');
   if(report.numFailedTestSuites>0)errors.push('native suite failure');
  } else if(adapter==='playwright') {
   if(!Array.isArray(report.suites)||!report.stats||!report.config?.rootDir)throw Error('missing native Playwright report fields');
   const reportRoot=path.resolve(report.config.rootDir);
   const visit=(suites,ancestors=[],fileLevel=true)=>{
    for(const suite of suites) {
     const titles=fileLevel?ancestors:[...ancestors,...(suite.title?[suite.title]:[])];
     for(const spec of suite.specs||[])for(const test of spec.tests||[]) {
      const file=relativeFile(root,spec.file,reportRoot),results=test.results;
      if(!Array.isArray(results)||!results.length)throw Error('Playwright case was collected but not executed');
      if(!['expected','unexpected','flaky','skipped'].includes(test.status)||!['passed','failed','skipped'].includes(test.expectedStatus))throw Error('unknown native Playwright outcome');
      const statuses=results.map(r=>r.status);
      if(statuses.some(s=>!['passed','failed','timedOut','skipped','interrupted'].includes(s)))throw Error('unknown native Playwright case status');
      const status=statuses.every(s=>s==='skipped')?'skipped':statuses.at(-1)==='passed'&&test.expectedStatus==='passed'&&['expected','flaky'].includes(test.status)?'passed':'failed';
      cases.push({id:`${test.projectName||'default'}::${file}::${[...titles,spec.title].join(' > ')}`,file,status,native_status:test.status,attempt_statuses:statuses});
     }
     visit(suite.suites||[],titles,false);
    }
   };visit(report.suites);
   if(report.errors?.length)errors.push('native Playwright suite errors');
   const total=['expected','unexpected','flaky','skipped'].reduce((n,k)=>n+(Number.isInteger(report.stats[k])?report.stats[k]:NaN),0);
   if(total!==cases.length||['expected','unexpected','flaky','skipped'].some(k=>report.stats[k]!==cases.filter(c=>c.native_status===k).length))throw Error('native Playwright aggregate/case counts disagree');
  } else throw Error('unsupported native report adapter');
  if(new Set(cases.map(c=>c.id)).size!==cases.length)throw Error('duplicate/ambiguous native case identity');
 }catch(error){errors.push(error.message);}
 return{cases,errors};
}
function reconcile(parsed,execution) {
 const cases=parsed.cases||[],errors=[...(parsed.errors||[])],required=execution.required_case_ids,optional=execution.optional_case_ids;
 if(!cases.length)errors.push('zero_collected: no native cases executed');
 const index=new Map(cases.map(c=>[c.id,c]));
 for(const id of required) {
  const c=index.get(id);
  if(!c)errors.push(`required_case_missing: ${id}`);
  else if(c.status==='skipped')errors.push(`required_case_skipped: ${id}`);
  else if(c.status==='failed')errors.push(`required_case_failed: ${id}`);
 }
 for(const c of cases)if(!required.includes(c.id)&&!optional.includes(c.id))errors.push(`unmapped_native_case: ${c.id}`);
 const failed=cases.some(c=>c.status==='failed');
 return{result:failed?'fail':errors.length?'blocked':required.length?'pass':cases.every(c=>c.status==='skipped')?'skipped':'pass',cases,errors,
  summary:{collected:cases.length,passed:cases.filter(c=>c.status==='passed').length,failed:cases.filter(c=>c.status==='failed').length,skipped:cases.filter(c=>c.status==='skipped').length,flaky:cases.filter(c=>c.native_status==='flaky').length}};
}
function fileHash(root,relative) {
 if(!outcome.validLocalPath(relative))throw Error('binding requires a repository-relative file');
 let file=root;
 for(const part of relative.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error(`checker/input symlink unsupported: ${relative}`);}
 if(!fs.statSync(file).isFile())throw Error(`binding file missing: ${relative}`);
 return hash(fs.readFileSync(file));
}
function binding(check,contract,options) {
 const root=path.resolve(options.root||process.cwd());
 if(contract.outcome_contract) {
  if(!check.configuration_ids?.includes(options.configurationId))throw Error(`unsupported ${check.execution?.seam_ids?.length?'data seam':'native'} configuration: ${check.id} is not applicable to ${options.configurationId}`);
  const bound=outcome.bind(contract,{...options,root});
  if(bound.status!=='bound')throw Error(bound.errors.join('; '));
  // #132 binds the parent inventory; native test files are also mandatory
  // checker paths and therefore already covered by that binding.
  return bound.binding;
 }
 const files={};
 for(const p of [...check.checker_paths,...check.input_paths,...check.rule_paths])files[p]=fileHash(root,p);
 const configurations=check.configuration_ids;
 if(!unique(configurations)||!configurations.length)throw Error('declared configuration_ids required for native execution');
 const configuration=options.configurationId||(configurations.length===1?configurations[0]:null);
 if(!configurations.includes(configuration))throw Error('select a declared native configuration_id');
 return{version:1,contract_sha256:outcome.hashValue(contract),source_sha256:require('./duo-build.cjs').fingerprint(root),configuration_id:configuration,environment:options.environment||`${process.platform}-${process.arch}-node${process.versions.node}`,files};
}
function freeze(value) {if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
function privateDirectory(root,runDir) {
 const dir=path.resolve(runDir),relative=path.relative(root,dir);
 let cursor=dir;
 for(;cursor!==path.dirname(cursor);cursor=path.dirname(cursor))if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('runtime evidence path must not follow symlinks');
 if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))) {
  const ignored=cp.spawnSync('git',['check-ignore','--quiet','--',(relative?relative+'/':'')+'runtime-evidence/probe.json'],{cwd:root});
  if(ignored.status!==0)throw Error('runtime evidence must be private: ignore .specflow/runs/ before execution');
 }
 const base=path.join(dir,'runtime-evidence');fs.mkdirSync(base,{recursive:true,mode:0o700});return fs.mkdtempSync(path.join(base,'attempt-'));
}
function framework(root,adapter) {
 const name=adapter==='jest'?'jest':'@playwright/test';
 const packageFile=require.resolve(`${name}/package.json`,{paths:[root]}),entry=require.resolve(adapter==='jest'?'jest/bin/jest':'@playwright/test/cli',{paths:[root]}),pkg=JSON.parse(fs.readFileSync(packageFile));
 return{name,version:pkg.version,entry,entry_sha256:hash(fs.readFileSync(entry))};
}
function artifactBytes(file) {
 if(fs.lstatSync(file).isSymbolicLink())throw Error('native artifact symlink unsupported');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size>16*1024*1024)throw Error('invalid native artifact file');return fs.readFileSync(fd);}finally{fs.closeSync(fd);}
}
// A trusted Improve evaluator executes private frozen files outside the product.
// This is the same native execution core; loading a saved receipt never owns it.
function validateFrozen(check) {
 const result=validate(check),errors=[...result.errors],e=check?.execution||{},args=e.args||[];
 if(check?.command!==undefined)errors.push('native frozen oracle command is owned by the adapter');
 if(e.claim_kind&&e.claim_kind!=='behaviour'||e.comparison_ids?.length||e.seam_ids?.length)errors.push('frozen oracle supports behaviour claims only');
 if(args[0]!=='--config'||!check?.checker_paths?.includes(args[1]))errors.push('frozen oracle requires an explicitly bound native config');
 if(args.length!==2&&!(args.length===4&&e.adapter==='jest'&&args[2]==='--testNamePattern'&&args[3]))errors.push('unsupported frozen native args');
 return{ok:!errors.length,errors};
}
function frozenBinding(check,contract,options) {
 const root=path.resolve(options.root),oracle=path.resolve(options.oracleRoot||'');
 if(!options.oracleRoot||oracle===root||oracle.startsWith(root+path.sep)||root.startsWith(oracle+path.sep)||fs.realpathSync(root)!==root)throw Error('frozen oracle must remain outside the product with disjoint real roots');
 for(let cursor=oracle;cursor!==path.dirname(cursor);cursor=path.dirname(cursor))if(fs.lstatSync(cursor).isSymbolicLink())throw Error('frozen oracle root cannot follow symlinks');
 if(!options.env||typeof options.env!=='object'||Array.isArray(options.env))throw Error('explicit scrubbed frozen oracle environment required');
 const files={};
 for(const file of [...check.checker_paths,...check.input_paths,...check.rule_paths]) {
  files[file]=fileHash(oracle,file);
  if(options.frozenFiles?.[file]!==files[file])throw Error('oracle file missing from frozen hash inventory or changed: '+file);
 }
 const configuration=options.configurationId;
 if(!unique(check.configuration_ids)||!check.configuration_ids.includes(configuration))throw Error('select a declared frozen oracle configuration_id');
 return{version:1,mode:'frozen-oracle',contract_sha256:outcome.hashValue(contract),source_sha256:(options.backendSession!==undefined?require('./improve-backend-runtime.cjs').backendNativeSource(options.backendSession,options.backendContext,root,contract.contract?.runtime?.identity):null)||require('./duo-build.cjs').fingerprint(root),oracle_root:oracle,files,
  configuration_id:configuration,environment:options.environment||'unknown',env_sha256:outcome.hashValue(options.env),framework:frozenFramework(check,options)};
}
function frozenFramework(check,options){
 if(options.backendSession!==undefined){if(check.execution.adapter!=='playwright')throw Error('confined backend supports the qualified Playwright adapter only');return require('./improve-backend-runtime.cjs').backendNativeFramework(options.backendSession,options.backendContext);}
 return framework(options.oracleRoot,check.execution.adapter);
}
function execute(check,options={}) {return executeNative(check,options,false);}
function executeFrozen(check,options={}) {return executeNative(check,options,true);}
function executeNative(check,options={},frozenOracle=false) {
 const validation=frozenOracle?validateFrozen(check):validate(check);
 if(!validation.ok)return{executable:false,result:'blocked',reason:validation.errors.join('; ')};
 if(!options.verificationContract)return{executable:false,result:'blocked',reason:'accepted verification contract required for owning execution'};
 const root=path.resolve(options.root||process.cwd()),contract=options.verificationContract,executionRoot=frozenOracle?path.resolve(options.oracleRoot||root):root;
 const bind=()=>frozenOracle?frozenBinding(check,contract,{...options,root}):binding(check,contract,options);
 let dir,before,identity,comparisons,seams;
 try {
  comparisons=frozenOracle?[]:oracleComparison.select(contract,check,options.configurationId);
  const selectedSeams=frozenOracle?[]:dataSeams.selectedForCheck(contract,check,options.configurationId);
  if(selectedSeams.length) {
   seams=dataSeams.inspect(contract,root,{phase:'built',configurationId:options.configurationId});
   const missing=selectedSeams.find(s=>!seams.data_seams.some(current=>current.id===s.id));
   if(missing)throw Error(`unsupported data seam configuration: ${missing.id} is not applicable to ${options.configurationId}`);
   const unproven=seams.data_seams.filter(s=>selectedSeams.some(selected=>selected.id===s.id)&&s.compatibility!=='compatible');
   if(!seams.ok||unproven.length)throw Error(`data seam compatibility blocked: ${[...seams.errors,...unproven.flatMap(s=>s.errors)].join('; ')}`);
  }
  before=bind();identity=frozenOracle?before.framework:framework(executionRoot,check.execution.adapter);
  dir=privateDirectory(root,options.runDir||path.join(root,'.specflow/runs/native'));
 }catch(error){return{executable:false,result:'blocked',reason:`native execution unavailable: ${error.message}`};}
 const reportPath=path.join(dir,'native-report.json'),stdoutPath=path.join(dir,'stdout.txt'),stderrPath=path.join(dir,'stderr.txt'),observationsPath=path.join(dir,'observations.json');
 const args=check.execution.adapter==='jest'?[identity.entry,...check.execution.args,'--ci','--runInBand','--cacheDirectory',path.join(dir,'cache'),'--coverageDirectory',path.join(dir,'coverage'),'--runTestsByPath',...check.execution.test_files,'--json','--outputFile',reportPath]:[identity.entry,'test',...check.execution.test_files,...check.execution.args,'--output',path.join(dir,'artifacts'),'--reporter=json'];
 const nativeEnv={...(frozenOracle?options.env:process.env),PLAYWRIGHT_JSON_OUTPUT_FILE:reportPath,PLAYWRIGHT_JSON_OUTPUT_NAME:'',PLAYWRIGHT_JSON_OUTPUT_DIR:'',PLAYWRIGHT_HTML_OPEN:'never',SPECFLOW_OBSERVATIONS_PATH:comparisons.length?observationsPath:'',SPECFLOW_CONFIGURATION_ID:before.configuration_id,SPECFLOW_ENVIRONMENT:before.environment};
 // A new Playwright CLI is not running inside its caller's Jest worker.
 if(check.execution.adapter==='playwright')delete nativeEnv.JEST_WORKER_ID;
 const startedAt=new Date().toISOString();let res;
 try{res=frozenOracle&&options.backendSession!==undefined?require('./improve-backend-runtime.cjs').backendNativeLaunch(options.backendSession,options.backendContext,{check,options,dir,args,env:nativeEnv}):cp.spawnSync(process.execPath,args,{cwd:executionRoot,env:nativeEnv,encoding:'utf8',timeout:(check.timeout_seconds||120)*1000,maxBuffer:16*1024*1024});}
 catch(error){res={status:null,stdout:'',stderr:'',error:{code:/^backend_[a-z_]+$/.test(error.message)?error.message:'backend_execution_unavailable'}};}
 fs.writeFileSync(stdoutPath,res.stdout||'',{mode:0o600});fs.writeFileSync(stderrPath,res.stderr||'',{mode:0o600});
 let result,reportBytes,after,observationBytes;
 try {
  reportBytes=artifactBytes(reportPath);
  result=reconcile(parse(JSON.parse(reportBytes.toString('utf8')),check.execution.adapter,res.reportRoot||executionRoot),check.execution);
 }catch(error){result={result:'blocked',cases:[],errors:[`native_report_missing_or_corrupt: ${error.code||error.message}`],summary:{collected:0,passed:0,failed:0,skipped:0}};}
 if(comparisons.length) {
  try {
   observationBytes=artifactBytes(observationsPath);fs.chmodSync(observationsPath,0o600);
   const compared=oracleComparison.evaluate(root,comparisons,result.cases,observationBytes);
   result.comparisons=compared.comparisons;result.errors.push(...compared.errors);
   if(compared.result==='fail'||(compared.result==='blocked'&&result.result!=='fail'))result.result=compared.result;
  }catch(error){if(result.result!=='fail')result.result='blocked';result.errors.push(`comparison_unproven: ${error.code||error.message}`);}
 }
 try {
  after=bind();
  const nextFramework=frozenOracle?after.framework:framework(executionRoot,check.execution.adapter);
  if(outcome.hashValue(before)!==outcome.hashValue(after)||identity.entry_sha256!==nextFramework.entry_sha256||identity.version!==nextFramework.version){result.result='blocked';result.errors.push('stale: source, contract, input, checker, environment or framework changed during native execution');}
 }catch(error){result.result='blocked';result.errors.push(`stale: ${error.message}`);}
 if(res.error){result.result='blocked';result.errors.push(`native_process_error: ${res.error.code||'execution unavailable'} (timeout_seconds: ${check.timeout_seconds||120})`);}
 else if(res.status!==0&&result.result==='pass'){result.result='fail';result.errors.push(`native_process_failed: exit ${res.status}`);}
 const receipt={version:1,attempt_id:path.basename(dir),executable:true,...result,reason:result.errors.join('; ')||null,check_id:check.id,verification_level:check.verification_level,boundaries:[...check.boundaries],command:res.command||[process.execPath,...args],root,...(frozenOracle?{oracle_root:executionRoot}:{}),
  started_at:startedAt,finished_at:new Date().toISOString(),exit_code:res.status,process_error:res.error?.code||null,process_signal:res.signal||null,terminated:Boolean(res.error||res.signal),framework:identity,host:{platform:process.platform,arch:process.arch,node:process.version},binding_before:before,binding_after:after||null,
  claim_kind:check.execution.claim_kind||'behaviour',
  ...(seams?{data_seams:seams.data_seams,interface_scope:seams.scope}:{}),
  artifacts:{report:{path:reportPath,sha256:reportBytes?hash(reportBytes):null},stdout:{path:stdoutPath,sha256:hash(res.stdout||'')},stderr:{path:stderrPath,sha256:hash(res.stderr||'')},...(comparisons.length?{observations:{path:observationsPath,sha256:observationBytes?hash(observationBytes):null}}:{})}};
 receipt.evidence_path=path.join(dir,'execution.json');fs.writeFileSync(receipt.evidence_path,JSON.stringify(receipt,null,2),{mode:0o600});
 freeze(receipt);issued.set(receipt,{check:outcome.hashValue(check),contract:outcome.hashValue(contract),root,frozenOracle,token:options.executionToken||null,receipt_sha256:hash(fs.readFileSync(receipt.evidence_path))});return receipt;
}
function owns(receipt,check,contract,options={}) {return ownsNative(receipt,check,contract,options,false);}
function ownsFrozen(receipt,check,contract,options={}) {return ownsNative(receipt,check,contract,options,true);}
function ownsNative(receipt,check,contract,options={},frozenOracle=false) {
 const record=issued.get(receipt);
 if(!record||record.frozenOracle!==frozenOracle||record.token!==(options.executionToken||null)||record.check!==outcome.hashValue(check)||record.contract!==outcome.hashValue(contract)||record.root!==path.resolve(options.root||process.cwd()))return false;
 try{if(hash(artifactBytes(receipt.evidence_path))!==record.receipt_sha256)return false;for(const artifact of Object.values(receipt.artifacts))if(artifact.sha256&&hash(artifactBytes(artifact.path))!==artifact.sha256)return false;return outcome.hashValue(receipt.binding_after)===outcome.hashValue(frozenOracle?frozenBinding(check,contract,options):binding(check,contract,options));}catch{return false;}
}
function journeys(root=process.cwd()) {
 root=path.resolve(root);
 const jsonResult=(status,extra={})=>({scope:'journey hook execution; not parent acceptance',status,...extra});
 const invoke=(exe,args)=>cp.execFileSync(exe,args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 try {
  const recent=invoke('git',['log','-20','--pretty=format:%s %b']);
  const issues=[...new Set((recent.match(/#\d+/g)||[]).map(n=>n.slice(1)))];
  if(!issues.length)return jsonResult('not_required',{reason:'No issues found in recent commits',executed:0});
  const ids=new Set(),errors=[];
  for(const number of issues) {
   try {const issue=JSON.parse(invoke('gh',['issue','view',number,'--json','number,title,body,comments']));
    const text=[issue.title,issue.body,...(issue.comments||[]).map(c=>c.body)].filter(Boolean).join('\n');
    for(const id of text.match(/\bJ-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g)||[])ids.add(id);
   }catch{errors.push(`issue_discovery_failed: #${number}; restore GitHub read access and retry`);}
  }
  if(ids.size>1000)errors.push('journey inventory exceeds bounded hook scope; split the selected work without dropping required IDs');
  const yaml=require('./vendor/js-yaml/js-yaml.cjs'),documents=[];
  for(const directory of ['docs/contracts','contracts','docs']) {
   const full=path.join(root,directory);if(!fs.existsSync(full))continue;
   for(const name of fs.readdirSync(full).filter(f=>/^journey_.*\.ya?ml$/.test(f))) {
    const file=directory+'/'+name;
    try{documents.push({file,document:yaml.load(fs.readFileSync(path.join(root,file),'utf8'))});}catch{errors.push(`journey_contract_invalid: ${file}`);}
   }
  }
  const journal=path.join(root,'.claude/.defer-journal'),deferred=new Set(fs.existsSync(journal)?fs.readFileSync(journal,'utf8').split(/\r?\n/).map(l=>l.trim().split(/\s+/)[0]).filter(l=>/^J-/.test(l)):[]);
  const groups=new Map(),staticChecks=[];
  for(const id of ids) {
   if(deferred.has(id)){errors.push(`required_journey_deferred: ${id}; linked deferral is not passing evidence`);continue;}
   const matches=documents.filter(d=>d.document?.journey_meta?.id===id);
   if(matches.length!==1){errors.push(`journey_contract_missing_or_ambiguous: ${id}`);continue;}
   const {file,document}=matches[0],meta=document.journey_meta,hooks=document.test_hooks||{},testFile=hooks.e2e_test_file;
   if(!outcome.validLocalPath(testFile)||!fs.existsSync(path.join(root,testFile))){errors.push(`journey_test_missing: ${id}; set test_hooks.e2e_test_file to an existing test`);continue;}
   if(!hooks.execution){errors.push(`journey_native_inventory_missing: ${id}; declare test_hooks.execution adapter/required_case_ids/optional_case_ids/args`);continue;}
   const execution={...hooks.execution,test_files:[testFile]};
   if(hooks.execution.test_files&&outcome.hashValue(hooks.execution.test_files)!==outcome.hashValue([testFile])){errors.push(`journey_native_file_mismatch: ${id}`);continue;}
   const check={id,type:execution.adapter==='playwright'?'playwright':'custom-script',required:true,verification_level:meta.verification_level,boundaries:meta.boundaries,
    configuration_ids:['hook'],checker_paths:[...new Set([file,testFile,...(hooks.checker_paths||[])])],input_paths:hooks.input_paths||[],rule_paths:hooks.rule_paths||[],execution};
   const valid=validate(check);if(!valid.ok){errors.push(`${id}: ${valid.errors.join('; ')}`);continue;}
   const text=fs.readFileSync(path.join(root,testFile),'utf8');
   for(const [field,forbidden]of [['required_patterns',false],['forbidden_patterns',true]])for(const pattern of hooks[field]||[]) {
    try {const match=/^\/(.*)\/([gimsuy]*)$/.exec(pattern),regex=match?new RegExp(match[1],match[2]):new RegExp(pattern),found=regex.test(text),passed=forbidden?!found:found;
     staticChecks.push({journey_id:id,kind:'static',pattern,result:passed?'pass':'fail'});if(!passed)errors.push(`static_contract_failed: ${id} ${field}`);
    }catch{errors.push(`invalid_static_contract_pattern: ${id}`);}
   }
   const key=outcome.hashValue({file:testFile,adapter:execution.adapter,args:execution.args});
   if(!groups.has(key))groups.set(key,{check,ids:[id]});
   else {const group=groups.get(key);group.ids.push(id);group.check.checker_paths=[...new Set([...group.check.checker_paths,...check.checker_paths])];
    for(const field of ['input_paths','rule_paths'])group.check[field]=[...new Set([...group.check[field],...check[field]])];
    group.check.execution.required_case_ids=[...new Set([...group.check.execution.required_case_ids,...execution.required_case_ids])];
    group.check.execution.optional_case_ids=[...new Set([...group.check.execution.optional_case_ids,...execution.optional_case_ids])].filter(caseId=>!group.check.execution.required_case_ids.includes(caseId));
    if(group.check.verification_level!==check.verification_level||outcome.hashValue(group.check.boundaries)!==outcome.hashValue(check.boundaries))errors.push(`conflicting_journey_level_or_boundaries: ${group.ids.join(', ')}`);
   }
  }
  if(errors.length)return jsonResult('blocked',{journeys:[...ids],errors,static_checks:staticChecks,executed:0});
  if(!ids.size)return jsonResult('not_required',{reason:'No journey contracts referenced',executed:0});
  const attempts=[];
  for(const {check,ids:groupIds}of groups.values()) {
   check.id=groupIds.sort().join('+');
   const contract={journey_ids:groupIds,runtime_checks:[check],source:'current journey YAML and required native case inventory'};
   const receipt=execute(check,{root,runDir:path.join(root,'.specflow/runs/journeys'),verificationContract:contract,configurationId:'hook',environment:'journey-hook'});
   attempts.push({journey_ids:groupIds,result:receipt.result,reason:receipt.reason||null,cases:receipt.cases||[],summary:receipt.summary||null,evidence_path:receipt.evidence_path||null});
  }
  return jsonResult(attempts.every(a=>a.result==='pass')?'passed':'blocked',{journeys:[...ids],attempts,static_checks:staticChecks,executed:attempts.length});
 }catch(error){return jsonResult('blocked',{errors:[`journey execution unavailable: ${error.message}`],executed:0});}
}
function cli(args=process.argv.slice(2)) {
 if(args[0]==='journeys'){const result=journeys(args[1]||process.cwd());console.log(JSON.stringify(result));return ['passed','not_required'].includes(result.status)?0:2;}
 if(args[0]!=='validate-report'){console.error('Use validate-report <jest|playwright> REPORT [ROOT] [INVENTORY.json]');return 2;}
 try{const [_,adapter,file,root=process.cwd(),inventoryFile]=args,parsed=parse(JSON.parse(fs.readFileSync(file)),adapter,path.resolve(root));
  const inventory=inventoryFile?JSON.parse(fs.readFileSync(inventoryFile)):{required_case_ids:parsed.cases.map(c=>c.id),optional_case_ids:[]};
  if(!unique(inventory.required_case_ids)||!unique(inventory.optional_case_ids))throw Error('invalid accepted CI case inventory');
  const result=reconcile(parsed,inventory);console.log(JSON.stringify({scope:'native report accounting only; owning CI invocation/revision supplies provenance',result:result.result,summary:result.summary,errors:result.errors,required_cases:inventory.required_case_ids.length}));return result.result==='pass'?0:1;
 }catch(error){console.error(`native report invalid: ${error.message}`);return 1;}
}
module.exports={validate,parse,reconcile,binding,execute,owns,executeFrozen,ownsFrozen,validateFrozen,journeys,cli};
if(require.main===module)process.exitCode=cli();
