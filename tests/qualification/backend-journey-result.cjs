'use strict';
// Resolve terminal evidence before a qualification result can be published.
// An observed failure and its cleanup failure are distinct, retained facts.
const reason=e=>e?.code||e?.message;
async function settle({handle,error,close,phase,results,clock=Date.now}){
 let closed=error?.backendGeneration||null,shutdownMilliseconds=null,cleanupCause=error?.cleanupCause||null;
 const observedCause=reason(error)||null;
 if(handle){
  const started=clock();
  try{closed=await close(handle,observedCause);}
  catch(e){cleanupCause=reason(e);if(!error)error=e;}
  finally{shutdownMilliseconds=clock()-started;}
 }
 const terminalCause=closed?.originalCause||closed?.terminal?.cause||closed?.backendTerminal?.cause||null;
 if(!error&&terminalCause)error=Error(terminalCause);
 if(!error&&(!closed||closed.terminal?.state!=='cleaned'||closed.terminal?.cause!==null||closed.backendTerminal?.phase!=='cleaned'||closed.backendTerminal?.cause!==null||closed.terminal?.credentialEnvelopeRemoved!==true))error=Error('backend_cleanup_unconfirmed');
 const expected=phase==='baseline'?4:phase==='after'?3:0;
 if(!error&&(!expected||results.length!==expected||results.some(r=>r.result!=='pass'||r.summary?.collected!==2||r.summary?.passed!==2||r.summary?.skipped!==0||r.summary?.failed!==0||r.summary?.flaky!==0)))error=Error('backend_qualification_incomplete');
 return {closed,error,status:error?'failed':'passed',cause:terminalCause||reason(error)||null,observedCause,cleanupCause,shutdownMilliseconds};
}
module.exports={settle};
