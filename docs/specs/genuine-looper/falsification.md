# Falsification Pass - genuine-looper

PRD SHA-256: d5d0b1540955a51a3b7c62b7bf1ecffcc9759ae2abc6f78f8e932789e9a522dc

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|
| Specflow needs bounded continuation to be a genuine looper | User request and loop YAML execution rules | Agents may still need HITL at generative stages | Holds with stipulation | Continue through mechanical gates only and stop honestly at generative work |
| YAML should drive stage order | `templates/QA/loops/*.yaml` | The YAML might be incomplete for terminal handoff states | Holds | Use YAML first and fallback defaults when absent |
| Diff provenance can catch made-up values | User concern about hard-coded data | Static scanning cannot prove semantic truth | Holds with stipulation | Treat it as a gate for obvious risks plus provenance evidence, not full proof |
| CI status readback is enough for Gate C routing | `gh pr checks` behavior | GitHub auth or PR context may be missing | Holds | Fail closed with actionable auth/repo message |

## Claim Inventory
| Claim | Type | Source support | Load-bearing? | Status | What breaks downstream if wrong | Correction |
|---|---|---|---|---|---|---|
| `specflow run` currently exists and can be extended | impl-choice | `bin/specflow.js`, `scripts/specflow-runner.cjs` | Yes | Would require a new command surface | Reuse existing command |
| Existing loop YAML has stage and rail IDs | definition | `templates/QA/loops/spec-build.yaml`, `templates/QA/loops/feature-build.yaml` | Yes | YAML-derived sequence would be impossible | Read `stages[].id` or `rails[].id` |
| Adapter policy templates install under `.specflow/adapter-policies` | definition | `setup-project.sh`, `templates/adapter-policies/*.yml` | Yes | Verify check would point at nonexistent convention | Reuse installed path |
| Provenance is a feature-build rail | definition | `templates/QA/loops/feature-build.yaml` | Yes | Diff gate would be in the wrong loop | Wire under `specflow provenance` |

## Dependency Audit
| Edge (A -> B) | Reason edge exists | False-edge risk | Verdict | Correction |
|---|---|---|---|---|
| YAML stage order -> bounded continuation | Runner needs next-stage calculation for every iteration | YAML and code drift | Holds | Tests assert YAML-derived sequence |
| Stage prompt -> provider adapter | Generative stages need concrete instructions | Prompt could omit human gates | Holds | Prompt includes `never_without_human` |
| Provider event parser -> session resume | Resume id must come from provider output | Providers may use different field names | Holds with stipulation | Parser accepts common session id spellings |
| Diff audit -> provenance gate | Hard-coded values appear in changed lines | False positives are possible | Holds | Allow explicit contract-approved lines |

## Acceptance Gate Attack
| Gate | How it could be gamed | Missing oracle | Correction |
|---|---|---|---|
| `--until-terminal` | Loop exits after one pass and claims done | Iteration count and ledger tail | Contract test requires two iterations |
| YAML state machine | Code still uses hardcoded order | Re-read loop YAML | Contract test reads `templates/QA/loops/spec-build.yaml` |
| Stage prompt | Prompt written but missing constraints | Prompt content assertion | Contract test checks stage and human gates |
| Provenance diff | JSON passes while code adds literals | Diff scan | Contract test rejects suspicious added line |
| Install completeness | Fresh codespace misses policy files | Verify output | Installer test checks missing policy failure |

## Source / Reality Ledger
| Concrete claim | Verified against (file / query) | Holds? | Evidence |
|---|---|---|---|
| Feature-build has provenance rail | `templates/QA/loops/feature-build.yaml` | Yes | Rail `6_provenance` defines the audit |
| Setup installs adapter policies | `setup-project.sh` | Yes | Copy block targets `.specflow/adapter-policies` |
| Runner already has adapter event parsing | `scripts/specflow-runner.cjs` | Yes | `parseProviderEvents` exists |
| Provenance gate already validates JSON evidence | `scripts/provenance-gate.cjs` | Yes | `auditProvenance` exists |

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|
| Specflow fully automates agents | Live providers and human gates remain external | Specflow controls local contracted loop execution and stops honestly |
| Provenance proves all truth | Static scan is not semantic proof | Provenance gate rejects obvious laundering and requires source evidence |
| CI status command runs Gate C | It reads checks; it does not create protected CI | CI status command classifies existing Gate C checks |

## Banned-Mode Self-Check
| Banned mode | Present? | Evidence / note |
|---|---|---|
| blanket dependency | No | Dependencies name concrete files |
| definition-as-assumption | No | "Looper" is decomposed into runtime behaviors |
| source laundering | No | Repo claims have file sources |
| nearby-proof | No | Tests assert behavior directly |
| green-by-assertion | No | Gate commands are runnable |
| inventory-as-reliance | No | Reuse is declared separately from proof |
| unapplied correction | No | Stipulations are reflected in non-goals and ACs |

## Final Verdict

PASS WITH STIPULATIONS. Owner: feature-build implementer must keep provider output behind rerun gates and must not automate push, PR creation, merge, or `--no-verify`.
