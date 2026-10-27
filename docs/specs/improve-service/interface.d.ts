// Selected non-UI service contract; proposed until preparation promotion.
export type ApiVersion = 1;
export interface AuthenticatedActor {
  principal: string; credential_id: string; role_id: string;
  holder: string; assignment_revision: string;
} // Trusted transport/owner registry only; forbidden in caller payloads.
export interface TaskRef {
  task_id: string; experiment_id: string;
  source_revision: string; contract_revision: string;
}
export interface Preflight { api_version: ApiVersion; repo_id: string }
export interface Start extends Preflight {
  request_id: string; task: TaskRef;
}
export interface Status extends Preflight { run_id?: string }
export interface Control extends Preflight { run_id: string; request_id: string }
export type Lifecycle = 'queued'|'running'|'cancelling'|'interrupted'|'blocked'|'completed'|'cancelled';
export interface Blocker {
  reason_code: string; stage: string|null; failed_check: string|null;
  retryable: boolean; evidence_refs: string[];
  next_action: {owner:'agent'|'owner'; action:string; reason_code:string};
}
export interface Job {
  api_version: 1; run_id: string; repo_id: string; task: TaskRef;
  profile_revision: string; lifecycle: Lifecycle;
  report_id: string; report_revision: string;
  code_decision: 'KEEP'|'REVERT'|'INCONCLUSIVE'|null;
  current_improvement_established: boolean;
  experiment_verdict: 'proven'|'disproven'|'needs-change'|null;
  delivery: 'not_requested'|'pending'|'delivered'|'blocked'|'unknown';
  blocker: Blocker|null;
  limits: {maxCycles:number;maxAttempts:number|null;maxConsecutiveNoProgress:number|null;maxWallMs:number};
  deadline_ms:number;
  consumed:{cycles:number;terminal_cycles:number;attempts:number;consecutive_no_progress:number};
  usage:{mode:string;estimates_usd:number|null;actual_charges_usd:null};
}
export interface Admission {
  api_version:1; accepted:boolean; duplicate:boolean;
  run_id:string|null; job:Job|null; blocker:Blocker|null;
}
export interface Capabilities {
  api_version:1; service_version:string;
  tools:('improve_preflight'|'improve_start'|'improve_status'|'improve_cancel'|'improve_resume')[];
  admission:'policy_creator_only';
  execution:'owner_registered_qualified_plan';
  deployment:'owner_local_loopback';
}
// Strict schemas reject every extra field. No caller principal, paths, commands,
// provider/model/billing selection, execution generation or receipt body.
// Cancellation and dispatch intents are durable controller facts; no second executor.

// Durable trusted representation. No caller can instantiate these by API payload.
export interface PreparedPlan {
  version:1; repo_id:string; profile_revision:string; task:TaskRef;
  recipe_id:string; runtime_sha256:string; driver_module:string;
  input_hashes:Record<string,string>; qualification_evidence_sha256:string;
}
export interface DispatchIntent {
  state:'pending'|'worker_recorded'|'released'|'blocked'|'complete';
  binding_revision:1; plan_sha256:string;
  // Actual boot/PID/birth identity; absent launch acknowledgement is unknown.
  process:{boot_id:string;pid:number;start:string;group:number}|null;
}
export interface ServiceRetryReceipt {
  kind:'service_start'; principal:string; repo_id:string; request_id:string;
  input_sha256:string; run_id:string|null; accepted:boolean;
  reason_code:string|null; actor:AuthenticatedActor;
}
export interface TaskClaim {
  kind:'service_task'; principal:string; repo_id:string; task:TaskRef;
  run_id:string; plan_sha256:string;
}
export interface ControlBinding {
  kind:'service_control'; principal:string; repo_id:string; run_id:string;
  request_id:string; action:'cancel'|'resume'; input_sha256:string;
  original_command:Record<string,unknown>; expected_generation:number;
  state:'pending'|'complete'; receipt:unknown;
}
