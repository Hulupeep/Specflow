'use strict';
// Transport schema only; equality with the service contract is tested.
function schemas(z){const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),revision=z.string().regex(/^[a-f0-9]{40,64}$/),task=z.object({task_id:id,experiment_id:id,source_revision:revision,contract_revision:revision}).strict(),base={api_version:z.literal(1),repo_id:id};return {improve_preflight:z.object(base).strict(),improve_start:z.object({...base,request_id:id,task}).strict(),improve_status:z.object({...base,run_id:id.optional()}).strict(),improve_cancel:z.object({...base,run_id:id,request_id:id}).strict(),improve_resume:z.object({...base,run_id:id,request_id:id}).strict()};}
module.exports={schemas};
