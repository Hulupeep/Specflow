// Exact selected v2 extension; owner-host callbacks are not caller JSON.
export interface ProcessIdentity { boot_id:string; pid:number; start:string; group:number }
export interface Assignment { principal:string; holder:string; revision:string; process:ProcessIdentity }
export interface ExecutionContext extends Assignment { generation:number }
export interface LimitsV2 {
  maxCycles:number; maxAttempts:number|null;
  maxConsecutiveNoProgress:number|null; maxWallMs:number;
}
export interface RouteGrant {
  role:'builder'|'oracle'|'peer'|'judge'; requested_model:string;
  effective_model:string; billing:'subscription_cli'|'api'|'unknown';
  cost:'ordinary'|'low_cost'|'expensive'|'unknown';
  maxStarts:number|null;
}
export interface PolicyV2 {
  version:2; repo_id:string; profile_revision:string;
  limits:LimitsV2; routes:RouteGrant[];
  schedule:{id:string;timezone:string;local_time:string};
}
export interface RecoveryRequest {
  repo_id:string; run_id:string; request_id:string; expected_generation:number;
}
export interface ReconcileRequest extends RecoveryRequest { receipt_id:string }
export interface ClaimReceipt {
  allowed:boolean; reason_code:string|null; run_id:string;
  generation:number; duplicate:boolean;
  unresolved:string[]; next_action:string;
}
export interface OperationBinding {
  run_id:string; cycle_id:string; operation_id:string; generation:number;
  principal:string; repo_id:string; profile_revision:string;
  input_sha256:string;
}
export interface OperationReceipt {
  version:2; id:string; binding:OperationBinding;
  phase:'not_started'|'complete';
  result:{exit_code:number;reason_code:string|null;estimate_usd:number|null};
  stdout_sha256:string; stderr_sha256:string;
  // Integrity seal is derived by the owner-private receipt store, never caller data.
  seal:string;
}
export interface RecoveryHost {
  format:2;
  lockTool:{path:string;sha256:string;version:string};
  resolveAssignment():Assignment;
  resolveSuccessor(key:{principal:string;holder:string;revision:string}):Assignment;
  resolveExecution():ExecutionContext|null;
  resolveProcess(identity:ProcessIdentity):'live'|'dead'|'unknown';
  // Actual gateway tuple, derived from the pinned owner-host worker config.
  resolveRoute(role:RouteGrant['role']):Pick<RouteGrant,'requested_model'|'effective_model'|'billing'>;
  // Opaque lookup into configured private receipt store; authenticates bytes/seal.
  resolveReceipt(id:string):OperationReceipt;
  // A real existing DurableStore instance, checked again against original metadata.
  resolveTerminalArchive(job_id:string):unknown;
}
export interface ControllerRecoveryExtension {
  resume(req:RecoveryRequest):ClaimReceipt;
  reconcile(req:ReconcileRequest):ClaimReceipt;
  // Owner-only explicit assignment; original principal remains immutable.
  assign(req:RecoveryRequest & {principal:string;holder:string;assignment_revision:string}):ClaimReceipt;
  migrate(req:{repo_id:string;request_id:string}):{allowed:boolean;reason_code:string|null};
}
// Existing status/report remain authority-gated. Actual v2 report includes:
export interface MorningReportV2 {
  version:2; run_id:string; report_id:string; revision:string;
  claim:string; established:boolean;
  code_results:{cycle_id:string;decision:string;retained_commit:string|null;available:boolean}[];
  experiment_results:{outcome_id:string;verdict:string}[];
  unresolved:string[]; original_limits:LimitsV2; deadline_ms:number;
  usage:{mode:string;attempts:number;estimates_usd:number|null;actual_charges_usd:null};
  next_action:{owner:'agent'|'owner';action:string;reason_code:string};
}
