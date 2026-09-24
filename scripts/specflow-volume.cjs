'use strict';
const fs = require('fs'), path = require('path');
const policy = require('./specflow-tier.cjs');
const ID = /\b(?:REQ|AC)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
function definitions(text) {
  const found = new Map();
  for (const line of text.split('\n')) {
    if (!/^\s*(?:[-*]\s*(?:\[[ xX]\]\s*)?|#{1,6}\s*)?(?:REQ|AC)-/.test(line)) continue;
    const id = line.match(ID)?.[0];
    if (id) { const body = line.replace(/^\s*[-*]\s*(?:\[[ xX]\]\s*)?/, '').trim(); (found.get(id) || found.set(id, []).get(id)).push(body); }
  }
  return found;
}
function linkedPaths(text) {
  const links=[...text.matchAll(/\[[^\]]*\]\(([^ )]+)(?: [^)]*)?\)/g)].map(m=>m[1]).filter(s=>!s.includes('://')&&!s.startsWith('#'));
  return [...new Set([...links,...(text.replace(/https?:\/\/[^\s)]+/g,'').match(/(?:docs|PRDs|QA)\/[A-Za-z0-9_.\/-]+\.(?:md|ya?ml|json|csv)\b/g)||[])])].filter(s=>!/[<>{}*]/.test(s)).map(s=>s.split('#')[0]);
}
function remoteSpecifications(text) { return [...new Set([...text.matchAll(/https?:\/\/[^\s)<>]+\.(?:md|ya?ml|json|csv)(?:[?#][^\s)<>]*)?/g)].map(m=>m[0]))]; }
function report(root, record, baseline, authorizedDecisions = []) {
  const body = record.issue.body || '', errors = [], warnings = [], artifacts = [], documents = [{path:'issue',text:body}], content = new Map(), paths = new Set();
  const counts = { bodyCharacters: body.length, linkedMaintainedCharacters: 0, historicalCharacters: 0, uniqueMaintainedCharacters: body.length, shared:0, reused:0, new:0, deferred:0, inapplicable:0 };
  if (body.length > 30000) errors.push('Issue body exceeds the 30000-character maximum');
  else if (body.length > 20000) warnings.push('Issue body exceeds the 20000-character target');
  const remote=remoteSpecifications(body);
  for(const url of remote)if(!(record.profile?.artifacts||[]).some(a=>a.sourceUrl===url&&a.path&&a.sha256))errors.push(`Unmeasured remote specification: ${url}; bind a current local artifact before claiming total volume`);
  const inventory=[...(record.profile?.artifacts||[])],declared=new Set(inventory.map(a=>a.path));
  for(const link of linkedPaths(body))if(!declared.has(link)){
    try{const bytes=fs.readFileSync(policy.localFile(root,link));inventory.push({id:link,path:link,sha256:policy.sha(bytes),role:'linked-specification',justification:'Linked directly from authoritative scope'});declared.add(link);}catch{errors.push(`Broken linked reference: ${link}`);}
  }
  for (const item of inventory) {
    if (item.applicable === false || item.deferred === true) {
      counts[item.deferred ? 'deferred' : 'inapplicable']++;
      if (!item.reason?.trim()) errors.push(`${item.id}: deferral or N/A needs a reason`);
      continue;
    }
    const invalid = policy.referenceErrors(root,item,item.id); errors.push(...invalid); if (invalid.length) continue;
    const text = fs.readFileSync(policy.localFile(root,item.path),'utf8');
    for(const relative of linkedPaths(text)){const link=/^(docs|PRDs|QA)\//.test(relative)?relative:path.posix.normalize(path.posix.join(path.posix.dirname(item.path),relative));if(!declared.has(link) && item.maintenance!=='historical'){
      if(inventory.length>=200){errors.push('Linked specification inventory exceeds bounded inspection; declare narrower canonical references');break;}
      try{const bytes=fs.readFileSync(policy.localFile(root,link));inventory.push({id:link,path:link,sha256:policy.sha(bytes),role:'linked-specification',justification:'Linked maintained specification'});declared.add(link);}catch{errors.push(`Broken linked reference: ${link}`);declared.add(link);}
    }
    }
    for(const url of remoteSpecifications(text))if(!(record.profile?.artifacts||[]).some(a=>a.sourceUrl===url&&a.path&&a.sha256))errors.push(`Unmeasured remote specification: ${url}; bind a current local artifact`);
    const historical = item.maintenance === 'historical';
    counts[item.shared ? 'shared' : item.reuse ? 'reused' : 'new']++;
    if (!historical && !item.reuse && !item.justification?.trim()) warnings.push(`${item.id}: new artifact has no recorded scope justification; semantic review required`);
    if (!paths.has(item.path)) { counts[historical?'historicalCharacters':'linkedMaintainedCharacters'] += text.length; paths.add(item.path); }
    if (!historical) {
      documents.push({path:item.path,text});
      if (!content.has(item.sha256)) { counts.uniqueMaintainedCharacters += text.length; content.set(item.sha256,item.path); }
      else if(content.get(item.sha256)!==item.path) warnings.push(`Duplicated specification: ${item.path} duplicates ${content.get(item.sha256)}; this is not a reduction`);
    }
    artifacts.push({id:item.id,path:item.path,characters:text.length,historical,shared:!!item.shared,reused:!!item.reuse});
  }
  const ids = new Map();
  for (const doc of documents) for (const [id,defs] of definitions(doc.text)) for (const definition of defs) (ids.get(id) || ids.set(id,[]).get(id)).push({path:doc.path,definition});
  counts.requirements = [...ids.keys()].filter(id=>id.startsWith('REQ-')).length;
  if(counts.requirements>=40) warnings.push('40-plus requirements: review scope; do not generate speculative child specifications');
  for(const [id,defs] of ids) if(new Set(defs.map(d=>d.definition)).size>1) errors.push(`Conflicting definitions for ${id}`);
  if(baseline) for(const [id,prior] of Object.entries(baseline.identifiers || {})) {
    const current=ids.get(id), decision=authorizedDecisions.find(d=>d.id===id && d.ownerVerified && d.reason?.trim() && !policy.referenceErrors(root,d.evidence).length);
    if(!current && !decision) errors.push(`Lost identifier ${id}; preserve a canonical reference or obtain an explicit owner decision`);
    else if(current && !current.some(d=>prior.some(p=>p.definition===d.definition)) && !decision) errors.push(`Changed meaning of ${id} requires an explicit recorded decision`);
  }
  return {status:errors.length?'blocked':'reported',counts,artifacts,identifiers:Object.fromEntries(ids),errors,warnings,judgments:'Counts are mechanical signals. Applicability, scope and meaning require scoped review; length does not prove readiness.'};
}
function portfolio(root, records) {
  const reports=records.map(r=>report(root,r)),bodies=records.reduce((n,r)=>n+(r.issue.body||'').length,0),maintained=new Map(),historical=new Map(),warnings=[];
  for(const [i,r]of reports.entries())for(const a of r.artifacts){const bytes=fs.readFileSync(policy.localFile(root,a.path)),hash=policy.sha(bytes),map=a.historical?historical:maintained;if(map.has(hash)&&map.get(hash).path!==a.path)warnings.push(`Duplicated across ticket specifications: ${a.path} and ${map.get(hash).path}; not a reduction`);if(!map.has(hash))map.set(hash,{path:a.path,characters:a.characters});}
  return {bodyCharacters:bodies,linkedMaintainedCharacters:reports.reduce((n,r)=>n+r.counts.linkedMaintainedCharacters,0),uniqueLinkedMaintainedCharacters:[...maintained.values()].reduce((n,a)=>n+a.characters,0),historicalCharacters:[...historical.values()].reduce((n,a)=>n+a.characters,0),maintainedTotalCharacters:bodies+[...maintained.values()].reduce((n,a)=>n+a.characters,0),warnings,errors:reports.flatMap(r=>r.errors),note:'Shared content is counted once in the unique total; repeated body text and copied files remain visible. Smaller bodies alone do not prove reduced specification.'};
}
module.exports={report,portfolio,definitions,linkedPaths};
