const prompts=require('../../scripts/typesafe-questions.cjs'),legacy=require('../../scripts/typesafe-questions-v1.cjs');
const evidence=require('../../scripts/typesafe-evidence.cjs'),ev=require('../../scripts/typesafe-eval.cjs');
test('v2 distinguishes assertion coverage, execution and claim support while preserving v1',()=>{
 expect(prompts.VERSION).toBe('2');expect(Object.keys(prompts.questions())).toEqual(['support','coverage','execution']);
 expect(Object.keys(legacy.questions())).toEqual(['support','coverage']);
 expect(prompts.questions().coverage.instructions).toContain('Ignore run success/failure');
 expect(prompts.questions().coverage.criteria.insufficient).toContain('No assertion supplied');
 expect(()=>ev.validateCorpus(require('../fixtures/typesafe/corpus.json'))).not.toThrow();
});
test('structured execution preserves actual failures, stale successes and contradictory stdout/stderr',()=>{
 const capture=(sourceAfter,exitCode,stdout,stderr='')=>({path:'raw.json',text:JSON.stringify({duo_capture:1,stable:true,sourceBefore:sourceAfter,sourceAfter,exitCode,stdout,stderr,command:['node','check.cjs']})});
 const result=evidence.execution([capture('new',1,'expected 42 actual 41','assertion failed'),capture('old',0,'passed'),{path:'unscoped.txt',text:'green job'}],'new');
 expect(result[0]).toMatchObject({freshness:'current',exitCode:1,stderr:'assertion failed',command:['node','check.cjs']});expect(result[1].freshness).toBe('stale');expect(result[2].freshness).toBe('unknown');expect(result).toHaveLength(3);
});
test('new evaluation rubric rejects missing execution label and unknown versions',()=>{
 const old=require('../fixtures/typesafe/corpus.json');expect(()=>ev.validateCorpus({...old,questionVersion:'2'})).toThrow(/labels/);
 expect(()=>ev.validateCorpus({...old,questionVersion:'typo'})).toThrow(/corpus/);
});
test('historical corpus/questions stay byte-identical and fresh v2 fixtures carry blind label provenance',()=>{
 const fs=require('fs'),path=require('path'),crypto=require('crypto'),expected=require('../fixtures/typesafe/legacy-file-identity.json');
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,file))).digest('hex');
 expect(sha('../fixtures/typesafe/corpus.json')).toBe(expected.corpusFileSha256);
 expect(sha('../../scripts/typesafe-questions-v1.cjs')).toBe(expected.legacyQuestionsFileSha256);
 const fresh=require('../fixtures/typesafe/corpus-v2.json');expect(()=>ev.validateCorpus(fresh)).not.toThrow();
 for(const row of fresh.cases){expect(row.labelReview.sourceHash).toMatch(/^[a-f0-9]{64}$/);expect(row.labelReview.reviewer).toContain('blind');expect(row.labelReview.ambiguous).toBe(false);}
 expect(require('../fixtures/typesafe/label-review-v2.json').cases.some(c=>c.ambiguous)).toBe(true);
});
