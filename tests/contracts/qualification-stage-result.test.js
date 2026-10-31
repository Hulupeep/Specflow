// Wrapper regression with explicitly substituted stage execution. This checks
// persistence of real-shaped results, not Docker/provider/product behaviour.
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const worker=require('../../scripts/improve-worker.cjs');
const production=require('../../scripts/improve-production-build.cjs');
const qualification=require('../qualification/improve-managed-core.test.cjs');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'qualification-result-293-'));});
afterEach(()=>{jest.restoreAllMocks();fs.rmSync(root,{recursive:true,force:true});});
test('stage result preserves fractional telemetry without weakening canonical build inputs',async()=>{
 const result={schema:'specflow.improve.decision/v1',decision:'REVERT',binding_errors:[],cost_usd:0.031363999999999996};
 const deadline=Date.now()+60000,admission=path.join(root,'admission.json'),config=path.join(root,'job.json'),state=path.join(root,'qualification.json'),history=path.join(root,'history');
 fs.mkdirSync(history);fs.writeFileSync(admission,JSON.stringify({deadlineAtMs:deadline}));fs.writeFileSync(config,JSON.stringify({deadlineAtMs:deadline}));
 fs.writeFileSync(state,JSON.stringify({configFile:config,runDir:path.join(root,'run'),history,admission:{path:admission,sha256:crypto.createHash('sha256').update(fs.readFileSync(admission)).digest('hex')},scope:'labelled wrapper fixture'}));
 jest.spyOn(worker,'startAuthorizedStage').mockReturnValue({fixture:true});
 jest.spyOn(worker,'awaitStage').mockResolvedValue({status:0,stdout:JSON.stringify(result)+'\n',stderr:''});
 jest.spyOn(console,'log').mockImplementation(()=>{});
 await qualification.phase(state,'evaluate');
 const files=fs.readdirSync(history),saved=files.find(n=>n.endsWith('.result.json'));
 expect(saved).toBeDefined();expect(JSON.parse(fs.readFileSync(path.join(history,saved)))).toEqual(result);
 expect(fs.readFileSync(path.join(history,files.find(n=>n.endsWith('.stdout'))),'utf8')).toBe(JSON.stringify(result)+'\n');
 expect(()=>production.canonical(result)).toThrow('build_input_invalid');
 expect(worker.startAuthorizedStage).toHaveBeenCalledWith(config,'evaluate',[path.join(root,'run')]);
});
