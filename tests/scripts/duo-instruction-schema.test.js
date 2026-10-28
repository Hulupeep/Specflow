'use strict';
const duo=require('../../scripts/duo-build.cjs');
const z=require('../../scripts/vendor/zod/index.cjs');
const row=inspected=>({instructionId:'I-R1-S1',outcome:'satisfied',reason:'Observed current evidence',snapshotHash:'a'.repeat(64),inspected,evidence:['.specflow/evidence/check.json'],dependencyOwner:null,missingDependency:null,replacementId:null});
describe.each(['claude','codex'])('%s emitted native instruction schema',provider=>{
 const emitted=duo.providerSchema(duo.schema,provider).properties.instruction_assessments;
 const parse=value=>z.fromJSONSchema(emitted).safeParse(value);
 test('excludes bare repository and host paths before response generation',()=>{
  for(const path of ['scripts/verify.cjs','.specflow/evidence/check.json','/tmp/host','../tree/source.cjs'])expect(parse([row([path])]).success).toBe(false);
 });
 test('supports exact snapshot namespace and allowed root artifact names',()=>{
  for(const path of ['tree/scripts/verify.cjs','tree/.specflow/evidence/check.json','diff.patch','index.patch','commits.txt','manifest.json'])expect(parse([row([path])]).success).toBe(true);
 });
 test('retains empty receipt-derived inspection and repository-relative evidence',()=>{
  const result=parse([row([])]);expect(result.success).toBe(true);expect(result.data[0].inspected).toEqual([]);expect(result.data[0].evidence).toEqual(['.specflow/evidence/check.json']);
 });
});
