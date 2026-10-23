'use strict';
// Exercise only the unchanged frozen digest guard on private temporary JSON.
// No backend, browser, model, original setup, or consumed holdout is executed.
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const state=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Private proof state required');
const run=path.join(state,'runs',path.basename(fs.readFileSync(path.join(state,'run-path.txt'),'utf8').trim()));
const contract=JSON.parse(fs.readFileSync(path.join(run,'improvement-contract.v1.json'))),file=path.join(run,'dev/practice.cjs'),bytes=fs.readFileSync(file);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),contract.artifact_sha256['dev/practice.cjs']);
const guard=bytes.toString().split('\n').find(line=>line.includes("throw Error('backend_state_mismatch')"));assert(guard);
const expected=/\.digest!=='([a-f0-9]{64})'/.exec(guard)?.[1];assert(expected);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'proof-seed-guard-'));
try{
 fs.writeFileSync(path.join(dir,'initial-state.json'),JSON.stringify({digest:expected}));vm.runInNewContext(guard,{fs,path,fixtureRoot:dir});
 fs.writeFileSync(path.join(dir,'initial-state.json'),JSON.stringify({digest:'0'.repeat(64)}));assert.throws(()=>vm.runInNewContext(guard,{fs,path,fixtureRoot:dir}),/backend_state_mismatch/);
 console.log(JSON.stringify({executed:2,failed:0,skipped:0,scope:'unchanged frozen digest comparison only; no backend reset/browser/model/holdout rerun',expectedDigest:expected,matchingDigestAccepted:true,mismatchingDigestRefused:'backend_state_mismatch',sourceArtifactSha256:contract.artifact_sha256['dev/practice.cjs'],guard}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
