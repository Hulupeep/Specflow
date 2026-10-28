'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),tier=require('./specflow-tier.cjs');
const SECTIONS={summary:['summary'],contracts:['contract / journey ids','contracts / journeys','contracts and journeys'],changes:['what changed','changes'],tests:['test plan','tests'],gate:['gate c','gate c status'],risk:['risk / rollout','risk and rollout','risk / rollout notes'],visuals:['screenshots / recordings','screenshots','screenshots or recordings']};
function inspect(body,issue){
 const errors=[],sections={};let active,level=0,fence=null;const visible=[];
 if(/<!--[\s\S]*?-->/.test(body))errors.push('Remove placeholder HTML comments');
 for(const line of body.split(/\r?\n/)){const token=/^\s{0,3}(`{3,}|~{3,})/.exec(line);if(token){if(!fence)fence=token[1];else if(token[1][0]===fence[0]&&token[1].length>=fence.length)fence=null;if(active)sections[active].push(line);continue;}if(fence){if(active)sections[active].push(line);continue;}visible.push(line);const heading=/^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);if(heading){const name=heading[1].toLowerCase().trim(),depth=line.match(/^#+/)[0].length;if(Object.values(SECTIONS).flat().includes(name)){active=name;level=depth;sections[active]||=[];}else if(depth<=level)active=null;}else if(active)sections[active].push(line);}
 for(const [name,aliases]of Object.entries(SECTIONS)){const key=aliases.find(a=>Object.hasOwn(sections,a)),text=key?sections[key].join('\n').replace(/^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:[\w.-]+\/[\w.-]+)?#\d+.*$/gim,'').trim():'';if(!text||(name!=='visuals'&&/^(?:N\/A|None)$/i.test(text))||/^(?:[-*]\s*)?(?:todo|tbd|placeholder|fill (?:this )?in|\.\.\.)[.!]?$/i.test(text))errors.push(`Missing or placeholder ${name} section`);}
 if(!new RegExp('\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+(?:[\\w.-]+\\/[\\w.-]+)?#'+issue+'\\b','i').test(visible.join('\n')))errors.push(`Reference the bound issue with a closing keyword: Closes #${issue}`);
 return errors;
}
function check(root,contract,options={}){
 let issue,bodyPath;const errors=[];
 try{
  if(!contract.tier_record)throw Error('Missing bound ticket record; do not guess the closing issue');
  const record=JSON.parse(fs.readFileSync(path.resolve(root,contract.tier_record),'utf8'));issue=record.issue?.number;
  if(!Number.isSafeInteger(issue)||issue<1)throw Error('Missing bound issue identity');
  if(options.issue!==undefined&&Number(options.issue)!==issue)throw Error('Requested issue differs from bound ticket');
  bodyPath=contract.pr_description?.path||(Array.isArray(contract.durable_evidence)?null:contract.durable_evidence?.pr_description)||`evidence/pr-description-${issue}.md`;
  const body=fs.readFileSync(tier.localFile(root,bodyPath),'utf8');errors.push(...inspect(body,issue));
  return {status:errors.length?'required':'draft_present',path:bodyPath,issue,sha256:crypto.createHash('sha256').update(body).digest('hex'),errors,authority:'Draft structure only; no CI, review, privacy or release approval'};
 }catch(e){return {status:'required',path:bodyPath||null,issue:issue||null,errors:[e.message],authority:'No handoff readiness'};}
}
module.exports={SECTIONS,inspect,check};
