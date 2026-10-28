'use strict';
// Versioned caller data only. Host identity, paths and commands never enter this schema.
const {z}=require('./vendor/zod/index.cjs');
const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),revision=z.string().regex(/^[a-f0-9]{40,64}$/);
const task=z.object({task_id:id,experiment_id:id,source_revision:revision,contract_revision:revision}).strict();
const base={api_version:z.literal(1),repo_id:id};
const schemas={improve_preflight:z.object(base).strict(),improve_start:z.object({...base,request_id:id,task}).strict(),improve_status:z.object({...base,run_id:id.optional()}).strict(),improve_cancel:z.object({...base,run_id:id,request_id:id}).strict(),improve_resume:z.object({...base,run_id:id,request_id:id}).strict()};
const {ServiceError}=require('./improve-service-errors.cjs');
function parse(tool,input){const result=schemas[tool]?.safeParse(input);if(!result?.success)throw new ServiceError('invalid_request');return result.data;}
module.exports={schemas,parse,ServiceError};
