# Falsification Pass - fable-loop-compounding

PRD SHA-256: 2bf63f432d1acc0b8d67507435d5d014b631a146ac55acd986505fc8b5b7ba13

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|
| Fable-class models require stronger Specflow control surfaces | User request plus current loop-runtime capabilities | Existing adapter controls may already be enough | Holds | Scope changes to specific missing control-plane surfaces |
| Fable should be used for planning more than implementation | User-provided operating guidance | Some implementation tasks may benefit from Fable | Holds with stipulation | Express as default routing policy, not a universal ban |
| `/loop` and routines need Specflow manifests | User-provided routine guidance and existing loop docs | Provider-native routines may already encode triggers | Holds | Manifest calls `specflow run` and preserves stop rules |
| Memory should compound through state and lessons | User guidance and current ledger behavior | Existing ledger may be sufficient for resume | Holds | State file is summary/resume; ledger remains evidence |
| External reviewer providers improve Fable output | User guidance | External reviewer may be wrong or unavailable | Holds with stipulation | Treat external review as evidence only, never gate authority |

## Claim Inventory
| Claim | Type | Source support | Load-bearing? | Status | What breaks downstream if wrong | Correction |
|---|---|---|---|---|---|---|
| Specflow has adapter policies today | definition | `templates/adapter-policies/*.yml` | Yes | Model routing ticket would target wrong surface | Reuse adapter policy format |
| Specflow records run ledgers today | definition | `scripts/specflow-runner.cjs`, tests | Yes | State/cost tickets would duplicate storage | Extend ledger; do not replace it |
| Gate D and teardown use evidence files | definition | `scripts/teardown-gate.cjs` | Yes | Vision evidence would be unanchored | Extend evidence path |
| Worktree isolation is already documented in process docs | definition | `templates/process/PROCESS-CLAUDE.md` | No | Ticket can still implement runner support | Cite as reuse, not proof |
| Fable effort names are provider-specific | hypothesis | User-provided operational guidance | Yes | Hardcoding would break other providers | Validate against active provider |

## Dependency Audit
| Edge (A -> B) | Reason edge exists | False-edge risk | Verdict | Correction |
|---|---|---|---|---|
| Model routing -> cost control | Expensive models should not run every task | Role policy may be ignored | Holds | Ledger must record role/model/effort/cost |
| State memory -> compounding loops | Long-running agents need compact resume facts | State can become unverified lore | Holds | Separate verified facts from open questions |
| Independent verifier -> safer Fable output | Maker self-critique is weak | Verifier can become another self-attestation | Holds | Mechanical gates remain required |
| Routine manifests -> scheduled loops | Cron/hosted triggers need consistent contract | Routine could bypass human gates | Holds | Manifest inherits `never_without_human` |
| Vision evidence -> UI/Gate D quality | Visual tasks need screenshot review | Vision model could hallucinate | Holds | teardown-gate validates files and value re-reads |

## Acceptance Gate Attack
| Gate | How it could be gamed | Missing oracle | Correction |
|---|---|---|---|
| Model routing | Policy accepts role fields but command ignores them | Re-read argv and ledger | AC requires command/ledger evidence |
| State memory | Agent writes flattering lessons without verification | Verified/open split | AC requires confirmed lessons only |
| Verifier | Same model grades its own output | Separate transcript and artifact-only input | AC requires independent ledger entry |
| Worktree | Multiple agents still share checkout | Worktree path/branch evidence | AC requires ledgered worktree path |
| Routine | Scheduled job runs a different process | Manifest command inspection | AC requires `specflow run` command |
| Vision gate | Screenshot exists but no goal comparison | Finding file | AC requires vision finding evidence |
| Cost | Missing usage gets fabricated | Unknown marker | AC requires unknown when unavailable |

## Source / Reality Ledger
| Concrete claim | Verified against (file / query) | Holds? | Evidence |
|---|---|---|---|
| Adapter policy format exists | `templates/adapter-policies/claude-print.safe.yml` | Yes | `adapter_policy:` root |
| Runner materializes prompts | `scripts/specflow-runner.cjs` | Yes | `materializeStagePrompt` |
| Ledger path exists in tests | `tests/contracts/loop-run-contract.test.js` | Yes | `ledger.jsonl` assertions |
| teardown-gate validates Gate D evidence | `scripts/teardown-gate.cjs` | Yes | `check-gate-d` command |
| Routine/mistake-harvest concept exists in docs | `templates/QA/loops/README.md`, `templates/process/PROCESS-CODEX.md` | Yes | routine text is present |

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|
| Fable is always the best implementer | User guidance says use it for planning | Fable-class providers are default planners/orchestrators; implementation can route elsewhere |
| External reviewer proves correctness | Reviewer is still model output | External review is evidence before mechanical gates |
| STATE.md makes the model learn | Weights do not change | State/lessons make the surrounding system compound |
| `/loop` is universally available | Provider-specific surface | Routine manifest can include `/loop` where supported |

## Banned-Mode Self-Check
| Banned mode | Present? | Evidence / note |
|---|---|---|
| blanket dependency | No | Provider surfaces are policy metadata, not hard dependencies |
| definition-as-assumption | No | "self-improvement" is defined as state/skill/routine artifacts |
| source laundering | No | User-provided operational guidance is not restated as verified provider docs |
| nearby-proof | No | Acceptance requires concrete runner/test surfaces |
| green-by-assertion | No | Gate B commands are run below |
| inventory-as-reliance | No | Reuse list does not claim implementation exists |
| unapplied correction | No | Corrections are reflected in PRD non-goals and tickets |

## Final Verdict

PASS WITH STIPULATIONS. Owner: feature-build implementers must keep provider-specific effort and `/loop` fields optional, validate supported provider surfaces at runtime, and keep mechanical gates authoritative.
