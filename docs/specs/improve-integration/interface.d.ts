// Trusted owner-host bindings. None are accepted as arbitrary service tool input.
export interface TaskBootstrap {
 version:1; repo_id:string;
 task:{task_id:string;experiment_id:string;source_revision:string;contract_revision:string};
 source_issue:string; brief_ref:string; brief_sha256:string;
 stax_id:string; action_id:string; role_id:string;
}
export interface PublicationBinding {
 run_id:string; retained_commit:string; validated_base_oid:string;
 repository:string; base_ref:string; branch:string; policy_revision:string;
 evidence_refs:string[]; task_sha256:string;
}
export interface DeliveryOperation {
 id:string; purpose:'push'|'draft_pr'|'stax_result'|'proposal_observation';
 destination:string; payload_sha256:string; marker:string;
 state:'pending'|'issued'|'confirmed'|'blocked'|'unknown';
 actor:{principal:string;role_id:string;holder:string;assignment_revision:string};
 remote_id:string|null; reason_code:string|null; observation_sha256:string|null;
}
export interface Delivery {
 version:1; run_id:string; task_sha256:string; report_id:string; report_revision:string;
 publication:PublicationBinding|null; operations:DeliveryOperation[];
 github:'not_requested'|'pending'|'delivered'|'blocked'|'unknown';
 heystax:'not_requested'|'pending'|'delivered'|'blocked'|'unknown';
 recipient_observation:'unconfirmed'|'confirmed';
}
export interface PluginBinding {
 version:1; package_version:string; resources_sha256:string;
 // Private configuration references, never bearer values or caller-chosen commands.
 client_config_file:string; runtime_root:string; bootstrap:TaskBootstrap;
}
