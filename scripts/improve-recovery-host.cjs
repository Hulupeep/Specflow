'use strict';
// Compile owner-private configuration into callbacks. Never invoke from request data.
const fs=require('fs'),path=require('path'),m=require('./improve-memory.cjs'),proc=require('./improve-process-identity.cjs'),{RecoveryError}=require('./improve-recovery-controller.cjs');
function fromConfig(raw,{principal,store,registry,routing={},requested_models={}}){
 if(!raw)return undefined;
 const clone=v=>structuredClone(v),fail=code=>{throw new RecoveryError(code);};
 const tickets=raw.ticketRoot?require('./improve-execution-tickets.cjs'):null;
 if(tickets&&(raw.assignment!==undefined||raw.generation!==undefined||!raw.scope))fail('execution_ticket_configuration_invalid');
 const ticket=()=>tickets.resolve({root:raw.ticketRoot,registry,scope:raw.scope});
 const current=()=>tickets?ticket().assignment:{...clone(raw.assignment),principal};
 return {format:raw.format,registry,scope:clone(raw.scope),ticketRoot:raw.ticketRoot||raw.issueTicketsTo,lockTool:clone(raw.lockTool),migration:clone(raw.migration),resolveAssignment:current,
  resolveExecution:()=>tickets?{...ticket().assignment,generation:ticket().generation}:raw.generation===undefined?null:{...current(),generation:raw.generation},
  resolveSuccessor:key=>{const value=(raw.successors||[]).find(a=>a.principal===key.principal&&a.holder===key.holder&&a.revision===key.revision);return value?clone(value):fail('recovery_successor_unavailable');},
  resolveProcess:proc.state,
  resolveRoute:role=>({requested_model:requested_models[role]||routing[role]||raw.routes?.[role]?.requested_model,effective_model:routing[role]||raw.routes?.[role]?.effective_model,billing:raw.routes?.[role]?.billing||'unknown'}),
  resolveReceipt:id=>new (require('./improve-operation-receipts.cjs').OperationReceipts)({root:raw.receiptRoot||path.join(store,'operation-receipts'),registry,lockTool:raw.lockTool}).completion(id),
  resolveTerminalArchive:id=>{
   if(!m.token(id)||!raw.archiveStore)fail('archive_unavailable');
   const location=raw.archiveStore;for(const name of ['jobs','blobs','staging'])require('./improve-operation-receipts.cjs').privatePath(path.join(location.root,name),true);
   require('./improve-operation-receipts.cjs').privatePath(path.join(location.root,'manifest-key'));
   return new (require('./improve-worker.cjs').DurableStore)({root:location.root,sourceRoot:location.sourceRoot});
  }
 };
}
module.exports={fromConfig};
