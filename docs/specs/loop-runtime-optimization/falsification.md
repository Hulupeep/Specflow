# Falsification Pass - loop-runtime-optimization

PRD SHA-256: d7300907f4f3c7bca72c7fb27dc3f2f2279b3387555ecd57025916fa1fa5bf7d

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|
| Specflow should position around loops, not prompting | User request plus existing loop docs | The repo may already say enough and only need copy edits | Holds with stipulation | Require a command-level runtime, not only wording |
| A local runner is the highest leverage first step | PRD Requirements | Hosted scheduling may be more marketable | Holds | State scheduling is out of scope and make local state/resume measurable |
| Agents fail when they only reference YAML | User provided transcript and templates/AGENTS.md | Failure may be agent-specific, not product-wide | Holds | Install docs must require run contracts and direct skill discovery |
| CLI can execute the whole loop | Adversary re-review | Generative stages need an active LLM agent and cannot be honestly executed by a plain CLI | Corrected | Define mechanical gates vs `agent_action_required` generative stops |

## Claim Inventory
| Claim | Type | Source support | Load-bearing? | Status | What breaks downstream if wrong | Correction |
|---|---|---|---|---|---|---|
| Specflow has spec-build and feature-build loop paths | definition | `templates/QA/loops/spec-build.yaml`, `templates/QA/loops/feature-build.yaml` | Yes | Verified | Ticket scope would be invented | Reuse those paths |
| `specflow run` does not exist today | impl-choice | `bin/specflow.js` command list | Yes | Verified | Ticket could duplicate an existing command | Add to existing CLI |
| Verifiers can gate ticket joins and seams | definition | `scripts/verify-ticket-journey.cjs`, `scripts/verify-seams.cjs` | Yes | Verified | Gate B would be prose-only | Use existing scripts |
| The product should not claim hosted scheduling | theorem | README currently positions local CLI and loop kit | Yes | Verified | Overclaim would mislead users | Explicit non-goal |
| Durable loop state has a default storage path | impl-choice | Amended PRD Operating Model | Yes | Verified | Engineers would write incompatible storage locations | Pin `.specflow/runs/<slug>/` defaults |

## Dependency Audit
| Edge (A -> B) | Reason edge exists | False-edge risk | Verdict | Correction |
|---|---|---|---|---|
| run contract schema -> resumable loop runner | Runner needs durable state to resume | Schema could be decorative only | Holds | AC requires resume from persisted state |
| ledger -> measurable loop quality | Users need stop reasons and verifier results | Ledger could become transcript bloat | Holds | Store compact evidence pointers |
| docs positioning -> install adoption | Fresh agents/users discover behavior through installed docs | Docs can overpromise | Holds | Require prompt-vs-loop distinction and no hosted scheduling claim |
| simulation evidence -> feature-build readiness | Spec-build tickets must survive B.5 before implementation | Simulation could be skipped in chat | Holds | Run contract carries `simulation_required` until evidence exists |

## Acceptance Gate Attack
| Gate | How it could be gamed | Missing oracle | Correction |
|---|---|---|---|
| `specflow run` creates YAML | A stub command writes a file but runs no gates | Evidence of command execution | Require ledger entries with gate commands and results |
| Resume behavior | Runner always starts over but rewrites current stage | Previous ledger comparison | AC requires resume from persisted current stage |
| Positioning docs | Copy says "loop" but product acts like prompts | CLI behavior and install docs | Pair docs ticket with runtime ticket |
| Simulation readiness | Agent marks simulated based on chat | Durable simulation file | B.5 evidence file required before handoff |

## Source / Reality Ledger
| Concrete claim | Verified against (file:line / query) | Holds? | Evidence |
|---|---|---|---|
| CLI currently has init, verify, update, audit, graph | `bin/specflow.js` command map | Yes | No `run` command is present |
| Install copies skills into Claude, Codex, and generic agent paths | `setup-project.sh` skill install block | Yes | Existing install path supports discovery fix |
| Loop selector requires concrete run contracts | `skills/specflow-loop-selector/SKILL.md` | Yes | Skill text defines mandatory `run_contract` |
| Spec-build requires Gate B.5 simulation before handoff | `templates/QA/loops/spec-build.yaml` | Yes | Stage `GATE_B5` exists |

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|
| Specflow runs autonomous loops in the background | Hosted scheduling is not in scope | Specflow runs local contracted loops with durable state and gates |
| Specflow replaces Claude/Codex workflow features | Agent runtimes still execute work | Specflow supplies the vendor-neutral loop contract and verifier gates |
| Loop runtime guarantees accepted changes | Acceptance depends on product quality and review | Loop runtime reports gates, stop reasons, and evidence for review |

## Banned-Mode Self-Check
| Banned mode | Present? | Evidence / note |
|---|---|---|
| blanket dependency | No | Dependencies cite concrete existing files |
| definition-as-assumption | No | "Loop runtime" is constrained to state, gates, and stop rules |
| source laundering | No | Source claims are checked against repo files |
| nearby-proof | No | Acceptance requires command and ledger behavior |
| green-by-assertion | No | Gate commands are listed and rerun below |
| inventory-as-reliance | No | Reuse list is not treated as implementation proof |
| unapplied correction | No | Scope corrections are applied to PRD non-goals and positioning |

## Final Verdict

PASS WITH STIPULATIONS. Owner: feature-build implementer must keep hosted scheduling out of scope and prove the runner executes real gates.
