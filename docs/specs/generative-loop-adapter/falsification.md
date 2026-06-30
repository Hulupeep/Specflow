# Falsification Pass - generative-loop-adapter

PRD SHA-256: 0af1f68c2ba6a91636ae19b305cf2be565906f029d4a87bba0e553e01df86a7f

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|
| Generative loop stages should run through local CLIs | User request and #77 boundary | A local controller may be enough and full automation may be unsafe | Holds with stipulation | Require adapter policies, budgets, and human-gate enforcement |
| Claude can be a subscription-backed adapter | `claude --help` and user context | Subscription behavior differs by operator machine | Holds | Spec only relies on local CLI auth readiness, not stored subscription secrets |
| Codex can use the same adapter contract | `codex exec --help` | Codex flags differ from Claude flags | Holds | Provider-specific command builders behind one ledger contract |
| CLI success can advance Specflow | Adversary review | Model output may be wrong or unsafe | Corrected | Rerun owning Specflow gate before advancing |

## Claim Inventory
| Claim | Type | Source support | Load-bearing? | Status | What breaks downstream if wrong | Correction |
|---|---|---|---|---|---|---|
| `claude -p` runs non-interactively | definition | `claude --help` | Yes | Verified | Claude adapter command would be invented | Use `claude -p` / `--print` |
| Claude exposes JSON/stream-json output | definition | `claude --help` | Yes | Verified | Transcript parser may be wrong | Support JSON/stream-json explicitly |
| `codex exec` runs non-interactively | definition | `codex exec --help` | Yes | Verified | Codex adapter command would be invented | Use `codex exec` |
| Codex exposes JSONL output | definition | `codex exec --help` | Yes | Verified | Ledger parser may be wrong | Support `--json` event stream |
| Provider auth should stay with provider CLI | theorem | User subscription context and CLI auth model | Yes | Accepted | Specflow could mishandle secrets | Do not store subscription secrets |

## Dependency Audit
| Edge (A -> B) | Reason edge exists | False-edge risk | Verdict | Correction |
|---|---|---|---|---|
| #77 loop runner -> adapter execution | Adapter needs run contract and ledger first | Adapter could fork its own state | Holds | Depend on #77 and reuse ledger |
| adapter policy -> safe execution | Tool/sandbox/budget controls need structured policy | Policy could be advisory only | Holds | Block on policy absence and audit attempted actions |
| provider CLI -> subscription-backed usage | User wants existing plans used | CLI auth may not be available | Holds | Detect command/auth readiness before live runs |
| adapter output -> gate rerun | Model output is not a verifier | False green risk | Holds | Require owning gate/verifier rerun |

## Acceptance Gate Attack
| Gate | How it could be gamed | Missing oracle | Correction |
|---|---|---|---|
| Adapter invocation logged | Wrapper logs command but discards transcript | Transcript artifact path | Require transcript and final output paths |
| Human gate enforcement | Prompt tells model not to push, but tool still can | Out-of-band action audit | Deny patterns and stop on attempted forbidden action |
| Budget control | Budget field ignored by provider | Ledger budget status | Record configured and observed budget/timeout status |
| CI test | CI calls a live model or skips adapter tests | Fake provider fixture | CI uses fake adapter by default |

## Source / Reality Ledger
| Concrete claim | Verified against (file:line / query) | Holds? | Evidence |
|---|---|---|---|
| Claude non-interactive print mode exists | `claude --help` | Yes | `-p, --print` listed |
| Claude supports `--max-budget-usd` | `claude --help` | Yes | Help lists max dollar budget for print mode |
| Codex non-interactive exec exists | `codex exec --help` | Yes | Help says run non-interactively |
| Codex supports `--json` | `codex exec --help` | Yes | Help says print events to stdout as JSONL |
| #77 created local runner boundary | `docs/specs/loop-runtime-optimization/prd.md` | Yes | Generative stage stops with `agent_action_required` |

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|
| Specflow autonomously runs all agents | Hosted/autonomous fleet is out of scope | Specflow delegates one generative stage to an approved local CLI adapter |
| Adapter makes gates pass | Model output is not a gate | Adapter output is input to the owning Specflow gate |
| Subscription support is universal | Operator auth differs by machine | Provider CLI owns auth; Specflow detects readiness |
| CLI installed means ready | Installed command may be unauthenticated | Add `adapter_unavailable` pre-invocation stop |

## Banned-Mode Self-Check
| Banned mode | Present? | Evidence / note |
|---|---|---|
| blanket dependency | No | Provider-specific facts are grounded in local help output |
| definition-as-assumption | No | Adapter contract defines inputs, command, outputs, failure states |
| source laundering | No | CLI claims cite local help output |
| nearby-proof | No | Acceptance requires transcript, ledger, and gate rerun |
| green-by-assertion | No | CLI success cannot advance without gate rerun |
| inventory-as-reliance | No | Reuse list is not treated as implementation |
| unapplied correction | No | Human gate and auth corrections are in PRD requirements |

## Final Verdict

PASS WITH STIPULATIONS. Owner: feature-build implementer must keep live provider calls opt-in and prove human-gate enforcement outside provider prompts.
