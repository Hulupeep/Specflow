#!/usr/bin/env node
'use strict';
// Compare matched, independently labelled review trials; never infer a verdict
// from a green final status or silently drop a missing arm/provider response.
const fs=require('fs'),path=require('path');
const client=require('./typesafe-client.cjs');
function compare(input) {
  if(input.version!==1 || !Array.isArray(input.pairs))throw Error('Invalid paired trials');
  const ids=new Set();
  const result={pairs:[],completePairs:0,missingPairs:0,byMode:{},limitations:['Matched observations are exploratory, not causal proof or production calibration. Labels must be established independently of TypeSafe predictions. No automatic promotion.']};
  for(const mode of ['off','advisory'])result.byMode[mode]={trials:0,unavailable:0,judgments:0,wrongEndorsements:0,unnecessaryObjections:0,reviewRounds:0,protocolFailures:0,providerCalls:0,providerUnavailable:0};
  for(const pair of input.pairs) {
    if(!pair.id || ids.has(pair.id)||!pair.caseHash || !pair.labelReview?.sourceHash || !pair.labelReview?.reviewer)throw Error('Missing pair identity or independent label provenance');
    ids.add(pair.id);let complete=true;const counts={};
    for(const mode of ['off','advisory']) {
      const trial=pair[mode],m=result.byMode[mode];m.trials++;
      if(!trial){m.unavailable++;complete=false;continue;}
      if(trial.caseHash!==pair.caseHash || !trial.runtimeHash || !['live','simulated'].includes(trial.transport) || !Array.isArray(trial.rounds))throw Error('Unmatched trial identity');
      if(!Number.isSafeInteger(trial.providerCalls)||trial.providerCalls<0||!Number.isSafeInteger(trial.providerUnavailable)||trial.providerUnavailable<0)throw Error('Invalid provider accounting');
      if(mode==='off' && (trial.providerCalls||trial.providerUnavailable))throw Error('Off arm must make no provider calls');
      if(!trial.rounds.length || (mode==='advisory' && (!trial.providerCalls || trial.providerUnavailable)))complete=false;
      m.providerCalls+=trial.providerCalls;m.providerUnavailable+=trial.providerUnavailable;m.reviewRounds+=trial.rounds.length;counts[mode]=trial.rounds.length;
      for(const round of trial.rounds) {
        if(!round.sourceHash || !round.evidenceHash || !['accept','object','unknown'].includes(round.oracle))throw Error('Missing round oracle/provenance');
        if(!['accepted','changes_required','blocked','invalid','unavailable'].includes(round.outcome))throw Error('Invalid observed outcome');
        if(round.outcome==='invalid'){m.protocolFailures++;continue;}
        if(round.outcome==='unavailable'){m.unavailable++;complete=false;continue;}
        if(round.oracle==='unknown')continue;
        m.judgments++;
        if(round.outcome==='accepted'&&round.oracle==='object')m.wrongEndorsements++;
        if(round.outcome!=='accepted'&&round.oracle==='accept')m.unnecessaryObjections++;
      }
    }
    if(pair.off && pair.advisory && (pair.off.runtimeHash!==pair.advisory.runtimeHash || pair.off.transport!==pair.advisory.transport))throw Error('Comparison requires matched runtime and transport');
    if(complete)result.completePairs++;else result.missingPairs++;
    result.pairs.push({id:pair.id,complete,extraAdvisoryReviewRounds:complete?counts.advisory-counts.off:null});
  }
  return result;
}
function writeReport(inputFile,output) {
  const directory=require('./typesafe-eval.cjs').privateDirectory(output);
  const input=JSON.parse(fs.readFileSync(inputFile));
  const report={at:new Date().toISOString(),inputHash:client.hash(input),...compare(input)};
  const file=path.join(directory,'paired-report.json');client.atomic(file,report);return file;
}
module.exports={compare,writeReport};
if(require.main===module)try{console.log('Private report: '+writeReport(process.argv[2],process.argv[3]));}catch(e){console.error(e.message);process.exitCode=2;}
