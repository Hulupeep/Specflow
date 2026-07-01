# Falsification Pass - fable-loop-compounding

PRD SHA-256: 71f99b621acce4d0d12f3f027aac1574898fd7b0edc76214e5e1c1214371c5fb

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|
| Fable-class models require stronger Specflow control surfaces | User request plus current loop-runtime capabilities | Existing adapter controls may already be enough | Holds | Scope changes to specific missing control-plane surfaces |
| Fable should be used for planning more than implementation | User-provided operating guidance | Some implementation tasks may benefit from Fable | Holds with stipulation | Express as default routing policy, not a universal ban |
| `/loop` and routines need Specflow manifests | User-provided routine guidance and existing loop docs | Provider-native routines may already encode triggers | Holds | Manifest calls `specflow run` and preserves stop rules |
| Memory should compound through state and lessons | User guidance and current ledger behavior | Existing ledger may be sufficient for resume | Holds | State file is summary/resume; ledger remains evidence |
| External reviewer providers improve Fable output | User guidance | External reviewer may be wrong or unavailable | Holds with stipulation | Treat external review as evidence only, never gate authority |
| Stronger models need less up-front implementation detail | Anthropic loop-talk evaluation | Brownfield compliance work still needs durable pre-implementation contracts | Holds with boundary | Keep spec-build as outer WHAT contract; move HOW-verified detail into feature-build negotiation |
| Runtime verification catches failures static gates miss | Anthropic loop-talk evaluation | Runtime verifiers may hallucinate or only inspect screenshots | Holds with stipulation | Runtime verifier evidence is subordinate to mechanical journey/gate checks |
| Trace review is necessary for long-running loops | Anthropic loop-talk evaluation | Trace tooling could leak transcripts to providers or summarize away evidence | Holds with stipulation | Default to local-only reports; provider summarization is opt-in and ledgered |
| Harness scaffolding should be removable | Anthropic loop-talk evaluation | Removing scaffolding could weaken gates | Holds with boundary | Only provider-specific scaffolding is disposable; mechanical gates and human stops remain durable |

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
| Maker/verifier negotiation -> better slice quality | Fine-grained done criteria should be negotiated at build time | Negotiation could become another unreviewed model conversation | Holds | Accepted contract is written to run directory before maker work and re-read by later gates |
| Runtime verifier -> behavioral coverage | Static gates can miss live UI/API behavior | Runtime verifier may pass without mechanical proof | Holds | Runtime verdict is evidence only; journey/mechanical gate remains authoritative |
| Trace report -> debuggability | Long loops need ledger/transcript/gate divergence surfaced | Trace report could invent missing evidence | Holds | Unknown/missing/dangling fields must be reported, not inferred |
| Harness-minimality -> lower long-term complexity | Model-specific knobs drift quickly | Removing knobs could erase audit data | Holds | Ledger preserves durable trust fields; only stale provider knobs are removable |

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
| Maker-verifier negotiation | Verifier accepts vague "looks good" criteria | Accepted verification contract file | AC requires pre-maker contract persisted under run directory |
| Runtime verifier | Runtime model claims it drove the app but no app evidence exists | Playwright/log/screenshot/value evidence | AC requires runtime evidence and mechanical gate rerun |
| Trace review | Summary hides failed tool calls or missing transcripts | Ledger/transcript/evidence cross-reference | AC requires divergence and missing refs to be explicit |
| Harness minimality | Effort tier/model brand becomes a gate proxy | Durable trust field split | AC forbids gates depending solely on provider effort/model/cost |

## Source / Reality Ledger
| Concrete claim | Verified against (file / query) | Holds? | Evidence |
|---|---|---|---|
| Adapter policy format exists | `templates/adapter-policies/claude-print.safe.yml` | Yes | `adapter_policy:` root |
| Runner materializes prompts | `scripts/specflow-runner.cjs` | Yes | `materializeStagePrompt` |
| Ledger path exists in tests | `tests/contracts/loop-run-contract.test.js` | Yes | `ledger.jsonl` assertions |
| teardown-gate validates Gate D evidence | `scripts/teardown-gate.cjs` | Yes | `check-gate-d` command |
| Routine/mistake-harvest concept exists in docs | `templates/QA/loops/README.md`, `templates/process/PROCESS-CODEX.md` | Yes | routine text is present |
| Runner records run status from ledger | `scripts/specflow-runner.cjs` | Yes | `runStatus` |
| Provider event parsing is a named runner surface | `scripts/specflow-runner.cjs` | Yes | `parseProviderEvents` |

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|
| Fable is always the best implementer | User guidance says use it for planning | Fable-class providers are default planners/orchestrators; implementation can route elsewhere |
| External reviewer proves correctness | Reviewer is still model output | External review is evidence before mechanical gates |
| STATE.md makes the model learn | Weights do not change | State/lessons make the surrounding system compound |
| `/loop` is universally available | Provider-specific surface | Routine manifest can include `/loop` where supported |
| A stronger model means more spec-build detail is safer | More up-front detail can cascade planner errors | Spec-build owns WHAT and hard constraints; feature-build negotiates HOW-verified per slice |
| Runtime verifier proves correctness | Verifier is still fallible provider/tool evidence | Runtime verification is evidence subordinate to mechanical gates |
| Trace review can summarize transcripts by default | Provider summarization can leak or distort evidence | Trace review is local-only by default; provider summarization is opt-in and ledgered |
| Model effort labels are product doctrine | Provider labels change quickly | Effort labels are transient policy metadata, not gate criteria |

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

PASS WITH STIPULATIONS. Owner: feature-build implementers must keep provider-specific effort and `/loop` fields optional, validate supported provider surfaces at runtime, keep mechanical gates authoritative, persist maker-verifier contracts before implementation, and keep trace review local-only by default.
