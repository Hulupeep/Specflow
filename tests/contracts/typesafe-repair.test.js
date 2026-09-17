const {repairQuestions}=require('../../scripts/typesafe-questions.cjs');
const corpus=require('../fixtures/typesafe/corpus.json');
const {metrics}=require('../../scripts/typesafe-eval.cjs');
test('J-TSAFE-REPAIR: repair corpus covers divergent histories with explicit frozen labels',()=>{
 const cases=corpus.cases.filter(c=>c.kind==='repair');expect(cases).toHaveLength(20);expect(Object.keys(repairQuestions())).toEqual(['alignment','novelty','relation']);
 for(const label of ['repetition','new_observation','contradiction','insufficient'])expect(cases.some(c=>c.labels.novelty===label)).toBe(true);
 for(const label of ['hypothesis','observed','confirmed_cause','insufficient'])expect(cases.some(c=>c.labels.relation===label)).toBe(true);
 expect(cases.find(c=>c.id==='repair-cross-host-edge').labels.novelty).toBe('repetition');
 expect(cases.find(c=>c.id==='repair-timestamp-edge').labels.novelty).toBe('repetition');
});
test('repair failures stay in all three denominators',()=>{
 const rows=corpus.cases.filter(c=>c.kind==='repair').map(c=>({...c,baseline:{support:null},result:{status:'unavailable'}}));
 const report=metrics(rows);expect(report.unavailable).toBe(20);expect(report.questions).toBe(60);for(const m of Object.values(report.judgments))expect(m.total).toBe(20);
});
