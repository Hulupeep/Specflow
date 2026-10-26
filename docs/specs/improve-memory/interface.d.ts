// Proposed trusted-host interfaces for #182; not a deployed API declaration.
export type Digest = string;
export interface HostActor {
  principal: string;
  holder: string;
  assignment_revision: string;
  role: 'researcher' | 'builder' | 'evaluator' | 'owner';
}
export interface Family {
  affected_paths: string[];
  observable: string;
}
export interface EvidenceRef { id: string; sha256: Digest }
// Resolver is owner-host code, not a request field. Resolve against immutable
// captured observation records/authenticated archives; never trust claimed roles.
export interface ResolvedEvidence {
  id: string; sha256: Digest; repo_id: string; family_key: Digest;
  source_revision: string; affected_paths: string[]; actor: HostActor;
  executed: number; failed: number; skipped: number; exit_code: number;
  valid: boolean; failure_category: 'none' | 'implementation' | 'verification' | 'unavailable';
}
export interface Task {
  id: string; experiment_id: string; source_revision: string; intent: string;
  criteria_revision: Digest;
  criteria: {id: string; statement: string}[];
}
export interface Selection {
  base_ref: string; base_commit: string; task: Task;
  // Existing validateCandidates governs this object, including selected/ranking.
  candidates: Record<string, unknown>;
  families: Record<string, Family>;
  consumed_observations: Digest[];
  rationale: string;
  retry: { reason: string; evidence: EvidenceRef[] } | null;
}
export interface Command {
  repo_id: string; run_id: string; request_id: string;
  expected_revision: Digest;
}
export interface SelectCommand extends Command { selection: Selection }
export interface ResolveCommand extends Command {
  outcome_id: Digest;
  action: 'reject_idea' | 'retry_with_new_evidence' | 'accept_baseline' | 'alias_family';
  reason: string; source_revision: string; evidence: EvidenceRef[];
  baseline: {ref: string; commit: string} | null;
  alias_family: Digest | null;
}
export interface ObserveCommand extends Command {
  outcome_id: Digest; source_revision: string; evidence: EvidenceRef[];
  observation:
    | {kind: 'proposal'; state: 'pending_delivery' | 'open' | 'merged' | 'closed_unmerged' | 'unknown'}
    | {kind: 'experiment'; verdict: 'proven' | 'disproven' | 'needs-change';
       criteria_revision: Digest; rationale: string};
}
export interface MemoryEvent {
  id: Digest; previous: Digest; sequence: number; kind: string;
  repo_id: string; canonical_repo_digest: Digest;
  actor: HostActor; source_revision: string;
  // Event-type validators define the bounded safe content, never raw evidence.
  data: Record<string, unknown>;
}
export interface DecisionPack {
  version: 1; repo_id: string; revision: Digest;
  events: MemoryEvent[]; truncated: boolean; limitations: string[];
}
export interface MemoryReceipt {
  id: Digest; revision: Digest; allowed: boolean; duplicate: boolean;
  reason_code: string | null; evidence_ids: string[];
}
export interface MemoryHost {
  required: true;
  resolveActor(): HostActor;
  resolveEvidence(ref: EvidenceRef): ResolvedEvidence;
}
// Extend the existing controller service, never a separate executor/store.
export interface MemoryControllerExtension {
  decisionPack(req: {repo_id: string}): DecisionPack;
  selectMemory(req: SelectCommand): MemoryReceipt;
  resolveMemory(req: ResolveCommand): MemoryReceipt;
  observeMemory(req: ObserveCommand): MemoryReceipt;
}
