#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const client = require('./typesafe-client.cjs');
const prompts = require('./typesafe-questions.cjs');
const instructionQuestions = require('./typesafe-actions.cjs').questions;
const questionsFor = row => row.kind === 'instruction' ? instructionQuestions() : row.kind === 'repair' ? prompts.repairQuestions() : prompts.questions();
function privateDirectory(destination) {
  const full = client.noLinks(destination); let ancestor = full;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (spawnSync('git', ['-C', ancestor, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).status === 0) throw Error('Evaluation output must be outside a Git worktree');
  fs.mkdirSync(full, { recursive: true, mode: 0o700 }); fs.chmodSync(full, 0o700); return full;
}
function validateCorpus(corpus) {
  if (!corpus.version || !Array.isArray(corpus.cases)) throw Error('Invalid corpus');
  const ids = new Set(), families = new Map();
  for (const row of corpus.cases) {
    if (!/^[a-z0-9-]+$/.test(row.id) || ids.has(row.id) || !['development','heldout'].includes(row.split) || !['evidence','repair','instruction'].includes(row.kind) || !row.rationale || !row.source || !['seeded','historical'].includes(row.origin)) throw Error('Invalid labelled case');
    ids.add(row.id);
    if (families.has(row.family) && families.get(row.family) !== row.split) throw Error('Family leakage across splits');
    families.set(row.family,row.split);
    const q = questionsFor(row);
    if (Object.keys(row.labels).length !== Object.keys(q).length || Object.entries(q).some(([id,v]) => !Object.hasOwn(v.criteria,row.labels[id]))) throw Error('Invalid labels');
  }
}
function baseline(row) {
  // Deliberately only mechanical evidence presence/execution markers, not a semantic oracle.
  if (!row.state.evidence || (Array.isArray(row.state.evidence) && !row.state.evidence.length)) return { support: 'insufficient', reason: 'empty evidence' };
  if (/skipped; executed 0|journey skipped|not attempted|never reached/i.test(row.state.evidence)) return { support: 'insufficient', reason: 'explicit nonexecution' };
  return { support: null, reason: 'mechanical checks cannot establish semantic support' };
}
function metrics(rows) {
  const output = { cases: rows.length, unavailable: rows.filter(r=>r.result.status!=='completed').length, actualCalls: rows.reduce((s,r)=>s+(r.result.networkCalls||0),0), tokens: {input:0,output:0}, questions:0, questionsByKind:{}, baseline:{mechanicalDecisions:0,reviewerAvailable:0,reviewerMissing:0}, judgments:{} };
  const times=[];
  for (const row of rows) {
    output.questions += Object.keys(row.labels).length; output.questionsByKind[row.kind]=(output.questionsByKind[row.kind]||0)+Object.keys(row.labels).length;
    if(row.baseline.support!==null)output.baseline.mechanicalDecisions++;
    if(row.reviewerBaseline)output.baseline.reviewerAvailable++;else output.baseline.reviewerMissing++;
    if(row.result.origin==='live'){output.tokens.input+=row.result.usage?.input_tokens||0;output.tokens.output+=row.result.usage?.output_tokens||0;times.push(row.result.elapsedMs||0);}
    for(const [id,label] of Object.entries(row.labels)) {
      const a=row.result.response?.answers[id];const m=output.judgments[id] ||= {total:0,available:0,correct:0,insufficient:0,uncertain:0,confusion:{},brierSum:0,reliability:Array.from({length:5},()=>({count:0,probabilitySum:0,correct:0})),thresholds:[0,.5,.8,.95].map(t=>({threshold:t,count:0,errors:0})),unsupported:0,detected:0,supported:0,falseAlarms:0};
      m.total++;const prediction=a?.choice||'unavailable';m.confusion[label] ||= {};m.confusion[label][prediction]=(m.confusion[label][prediction]||0)+1;
      if(id==='support'){if(label!=='supports'){m.unsupported++;if(a&&a.choice!=='supports')m.detected++;}else{m.supported++;if(a&&a.choice!=='supports')m.falseAlarms++;}}
      if(!a)continue;m.available++;if(a.choice===label)m.correct++;if(a.choice==='insufficient')m.insufficient++;if(a.confidence<.8)m.uncertain++;
      m.brierSum+=Object.entries(a.probabilities).reduce((s,[k,p])=>s+(p-(k===label?1:0))**2,0);
      const p=a.probabilities[a.choice],bin=m.reliability[Math.min(4,Math.floor(p*5))];bin.count++;bin.probabilitySum+=p;bin.correct+=Number(a.choice===label);
      for(const t of m.thresholds)if(a.confidence>=t.threshold){t.count++;t.errors+=Number(a.choice!==label);}
    }
  }
  for(const m of Object.values(output.judgments)){m.accuracy=m.total?m.correct/m.total:null;m.brier=m.available?m.brierSum/m.available:null;m.unsupportedRecall=m.unsupported?m.detected/m.unsupported:null;m.falseAlarmRate=m.supported?m.falseAlarms/m.supported:null;}
  times.sort((a,b)=>a-b);const percentile=p=>times.length?times[Math.max(0,Math.ceil(times.length*p)-1)]:null;
  output.latencyMs={p50:percentile(.5),p95:percentile(.95),samples:times.length};return output;
}
async function evaluateCorpus(corpus, options={}) {
  if(process.env.SPECFLOW_DUO_REVIEWER)throw Error('Recursive TypeSafe evaluation forbidden');
  validateCorpus(corpus);
  if(!/^jev-\d+\.\d+\.\d+$/.test(options.model||''))throw Error('Evaluation requires a concrete pinned model');
  if(!['live','replay'].includes(options.mode))throw Error('Choose live or replay explicitly');
  const directory=privateDirectory(options.output || path.join(os.homedir(),'.local/share/specflow/typesafe-evals',String(Date.now())));
  const datasetHash=client.hash(corpus),questionHash=client.hash({evidence:prompts.questions(),repair:prompts.repairQuestions(),instruction:instructionQuestions()});
  const identity={datasetHash,questionHash,model:options.model,questionVersion:prompts.VERSION};
  const manifestFile=path.join(directory,'manifest.json');
  const prior=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):null;
  if(prior&&JSON.stringify(prior.identity)!==JSON.stringify(identity))throw Error('Changed evaluation identity requires new output directory and qualification');
  if(options.mode==='replay'&&!prior)throw Error('Replay requires an existing evaluation');
  // Transport describes the original execution boundary, independently of live/replay
  // mode. Never upgrade historical records without provenance or mix cached mocks
  // into a provider run. Actual calls/completion remain separate measured fields.
  const requestedTransport=options.fetchImpl?'simulated':'live';
  const transport=prior?(prior.transport||'unknown'):requestedTransport;
  if(options.mode==='live'&&transport!==requestedTransport)throw Error('Changed or unknown evaluation transport requires new output directory');
  if(!prior)client.atomic(manifestFile,{identity,at:new Date().toISOString(),corpusVersion:corpus.version,mode:options.mode,transport});
  const rows=[];
  for(const row of corpus.cases) {
    const file=path.join(directory,row.id+'.json');
    if(options.mode==='replay'&&!fs.existsSync(file))throw Error('Replay missing case record');
    const q=questionsFor(row);
    const result=row.kind==='instruction' && !row.state.evidence?.length ? {status:'unavailable',reason:'insufficient_input',origin:'mechanical',networkCalls:0} : await client.evaluate({state:row.state,questions:q,model:options.model,snapshotHash:datasetHash,questionSetId:row.kind==='instruction'?'specflow-instruction-evidence':prompts.SET,questionVersion:prompts.VERSION},{file,envFile:options.envFile,...(options.fetchImpl?{fetchImpl:options.fetchImpl}:{}),...(options.env?{env:options.env}:{})});
    if (result.origin==='mechanical') client.atomic(file,result);
    rows.push({id:row.id,family:row.family,selection:row.selection,kind:row.kind,split:row.split,control:Boolean(row.control),labels:row.labels,baseline:baseline(row),reviewerBaseline:row.reviewerBaseline,result});
  }
  const repetitions=[];
  for(const row of corpus.cases.filter(r=>r.split==='development' && (r.kind!=='instruction'||r.state.evidence?.length)).slice(0,3)) {
    const file=path.join(directory,row.id+'-repeat.json');if(options.mode==='replay'&&!fs.existsSync(file))throw Error('Replay missing repeat record');
    const result=await client.evaluate({state:row.state,questions:questionsFor(row),model:options.model,snapshotHash:datasetHash,questionSetId:row.kind==='instruction'?'specflow-instruction-evidence':prompts.SET,questionVersion:prompts.VERSION},{file,envFile:options.envFile,...(options.fetchImpl?{fetchImpl:options.fetchImpl}:{}),...(options.env?{env:options.env}:{})});
    const original=rows.find(r=>r.id===row.id).result;
    repetitions.push({id:row.id,result,comparable:result.status==='completed'&&original.status==='completed',sameChoices:result.status==='completed'&&original.status==='completed'?Object.keys(row.labels).every(k=>result.response.answers[k].choice===original.response.answers[k].choice):null});
  }
  const byControl = selected => Object.fromEntries([true,false].map(value => [value ? 'control' : 'edge', metrics(selected.filter(r => r.control === value))]));
  const report={version:1,identity,mode:options.mode,transport,at:new Date().toISOString(),recommendation:'shadow',limitations:[...(corpus.limitations||[]),'Transport labels the original evaluation boundary, not success: live uses the default provider transport; simulated uses an injected fetch; unknown means legacy provenance was absent. Replay preserves that label and makes no new calls.','Confidence concentration is not correctness probability. No automatic promotion or acceptance. Missing peer baselines are not agreement.','Metrics are private; publication requires applicable permission.'],rows,repetitions,summary:metrics(rows),bySplit:Object.fromEntries(['development','heldout'].map(s=>[s,metrics(rows.filter(r=>r.split===s))])),byControl:byControl(rows),heldoutByControl:byControl(rows.filter(r=>r.split==='heldout')),repeatCalls:repetitions.reduce((s,r)=>s+(r.result.networkCalls||0),0)};
  report.selectionComparison=Object.fromEntries(['broad','instruction'].map(selection=>[selection,metrics(rows.filter(r=>r.split==='heldout'&&r.selection===selection))]));
  const paidResults=[...rows,...repetitions].map(r=>r.result);
  report.cost={networkCallsIncludingRepeats:paidResults.reduce((n,r)=>n+(r.networkCalls||0),0),tokensIncludingRepeats:{input:paidResults.reduce((n,r)=>n+(r.origin==='live'?r.usage?.input_tokens||0:0),0),output:paidResults.reduce((n,r)=>n+(r.origin==='live'?r.usage?.output_tokens||0:0),0)},currencyAmount:null,reason:'Provider response supplies token usage, not a billed currency amount; see actualCalls/tokens/latencyMs. No price estimate is invented.'};
  client.atomic(path.join(directory,options.mode+'-report.json'),report);return {file:path.join(directory,options.mode+'-report.json'),report};
}
function qualify(reportFile,mode,reason) {
  if(!['shadow','advisory','off'].includes(mode)||!reason?.trim())throw Error('Explicit mode and promotion rationale required');
  const dir=privateDirectory(path.dirname(reportFile)),report=JSON.parse(fs.readFileSync(reportFile));
  if(!report.identity||!report.rows?.length)throw Error('Invalid evaluation report');
  const file=path.join(dir,'qualification-'+Date.now()+'.json');client.atomic(file,{at:new Date().toISOString(),identity:report.identity,mode,reason,reportHash:client.hash(report),actor:'operator-explicit',limitations:report.limitations});return file;
}
async function cli(args){
 const opt=n=>{const i=args.indexOf('--'+n);return i<0?undefined:args[i+1];};
 if(args[0]==='qualify'){console.log(qualify(args[1],opt('mode'),opt('reason')));return;}
 const corpus=JSON.parse(fs.readFileSync(opt('corpus'),'utf8'));
 const result=await evaluateCorpus(corpus,{mode:args[0],model:opt('model'),output:opt('output'),envFile:opt('env-file')});console.log('Private report: '+result.file);
}
module.exports={privateDirectory,validateCorpus,baseline,metrics,evaluateCorpus,qualify,cli};
if(require.main===module)cli(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=2;});
