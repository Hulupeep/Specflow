const {settle}=require('../qualification/backend-journey-result.cjs');
const passes=()=>Array.from({length:3},()=>({result:'pass',summary:{collected:2,passed:2,failed:0,skipped:0,flaky:0}}));
const clean=()=>({originalCause:null,terminal:{state:'cleaned',cause:null,credentialEnvelopeRemoved:true},backendTerminal:{phase:'cleaned',cause:null}});
const options=()=>({handle:{},phase:'after',results:passes(),close:jest.fn(async()=>clean())});
describe('qualification terminal verdict (#298)',()=>{
 test('publishes success only after confirmed terminal cleanup and measures shutdown directly',async()=>{
  const o=options(),times=[10,47];const r=await settle({...o,clock:()=>times.shift()});
  expect(r).toMatchObject({status:'passed',cause:null,shutdownMilliseconds:37});expect(o.close).toHaveBeenCalledWith(o.handle,null);
 });
 test('late backend failure cannot leave a passed result',async()=>{
  const o=options();o.close.mockResolvedValue({...clean(),originalCause:'backend_lease_expired'});
  expect(await settle(o)).toMatchObject({status:'failed',cause:'backend_lease_expired'});
 });
 test.each(['state','credentialEnvelopeRemoved'])('incomplete terminal %s cannot pass',async field=>{
  const c=clean();c.terminal[field]=field==='state'?'cleanup_failed':false;
  expect(await settle({...options(),close:async()=>c})).toMatchObject({status:'failed',cause:'backend_cleanup_unconfirmed'});
 });
 test('an open failure retains its cleanup evidence and original failure separately from the observation',async()=>{
  const closed={...clean(),originalCause:'backend_lease_expired'},error=Object.assign(Error('backend_readiness_failed'),{backendGeneration:closed});
  const close=jest.fn();const r=await settle({...options(),handle:undefined,error,close});
  expect(close).not.toHaveBeenCalled();expect(r.closed).toBe(closed);expect(r).toMatchObject({status:'failed',cause:'backend_lease_expired',observedCause:'backend_readiness_failed',shutdownMilliseconds:null});
 });
 test('passes the observed failure into close instead of replacing it with a generic cause',async()=>{
  const o=options(),error=Object.assign(Error('detail'),{code:'backend_service_died'});
  const r=await settle({...o,error});expect(o.close).toHaveBeenCalledWith(o.handle,'backend_service_died');expect(r).toMatchObject({status:'failed',cause:'backend_service_died'});
 });
 test('retains both original failure and cleanup exception',async()=>{
  const r=await settle({...options(),error:Error('backend_service_died'),close:async()=>{throw Error('backend_cleanup_unconfirmed');}});
  expect(r).toMatchObject({status:'failed',cause:'backend_service_died',cleanupCause:'backend_cleanup_unconfirmed'});
 });
 test.each(['missing','skipped','failed','flaky'])('incomplete native inventory %s cannot pass',async kind=>{
  const o=options();if(kind==='missing')o.results.pop();else o.results[0].summary[kind]=1;
  expect(await settle(o)).toMatchObject({status:'failed',cause:'backend_qualification_incomplete'});
 });
});
