const {compare}=require('../../scripts/typesafe-comparison.cjs');
function fixture(){const trial={caseHash:'case',runtimeHash:'runtime',transport:'simulated',providerCalls:0,providerUnavailable:0,rounds:[{sourceHash:'source',evidenceHash:'capture',oracle:'object',outcome:'accepted'},{sourceHash:'fixed',evidenceHash:'new',oracle:'accept',outcome:'accepted'}]};return{version:1,pairs:[{id:'pair',caseHash:'case',labelReview:{reviewer:'independent-fixture',sourceHash:'labels'},off:trial,advisory:{...structuredClone(trial),providerCalls:2}}]};}
test('paired comparison counts wrong endorsements, unnecessary objections and extra review rounds',()=>{
 const input=fixture();input.pairs[0].advisory.rounds[0].outcome='changes_required';input.pairs[0].advisory.rounds[1].outcome='changes_required';input.pairs[0].advisory.rounds.push({sourceHash:'fixed',evidenceHash:'again',oracle:'accept',outcome:'accepted'});
 const r=compare(input);expect(r.byMode.off.wrongEndorsements).toBe(1);expect(r.byMode.advisory.wrongEndorsements).toBe(0);expect(r.byMode.advisory.unnecessaryObjections).toBe(1);expect(r.pairs[0].extraAdvisoryReviewRounds).toBe(1);
});
test.each(['missing arm','provider unavailable','zero advisory calls','empty rounds'])('missing evidence is retained: %s',kind=>{
 const input=fixture(),pair=input.pairs[0];if(kind==='missing arm')delete pair.advisory;else if(kind==='provider unavailable')pair.advisory.providerUnavailable=1;else if(kind==='zero advisory calls')pair.advisory.providerCalls=0;else pair.advisory.rounds=[];
 const r=compare(input);expect(r.completePairs).toBe(0);expect(r.missingPairs).toBe(1);expect(r.pairs[0].extraAdvisoryReviewRounds).toBeNull();
});
test('missing labels, runtime mismatch and mixed simulated/live arms are rejected',()=>{
 for(const edit of [p=>delete p.labelReview,p=>p.advisory.runtimeHash='changed',p=>p.advisory.transport='live',p=>p.off.providerCalls=1]){const input=fixture();edit(input.pairs[0]);expect(()=>compare(input)).toThrow();}
});
