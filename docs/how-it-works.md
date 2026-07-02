# How Specflow Works

The mechanics behind the trust harness: the contracted loop, the maker/verifier split, how gates decide on evidence, and how a run stays readable after the fact.

Specflow runs a model as an untrusted worker inside a contracted loop. The model is the actuator; the gate is the sensor. **A provider's output — including its exit code — is never a gate verdict.**

[← Back to README](../README.md)

---

## The Core Loop

One goal enters; an evidence-backed change packet leaves. The twelve steps:

1. **A human or agent starts with a goal** — an idea doc, a bug, a client requirement.
2. **`spec-build` creates the outer contract**: PRD, invariants, journeys, acceptance criteria, seams, risks — hardened by an adversary before any ticket exists. The outer contract owns the *what*; it deliberately does not pin implementation detail.
3. **`feature-build` takes one approved slice.**
4. **The maker proposes a slice-local verification contract** — "done means X, verified by Y" — before writing any code.
5. **An independent verifier accepts, rejects, or strengthens it.** The negotiated contract is written to disk. The verifier's job is to be harsher than the maker's proposal.
6. **The maker implements** against the negotiated contract.
7. **The runtime verifier exercises the behavior where required** — launches the app, drives the journey, reads console/network/backend state.
8. **Findings are written separately.** The verifier never sees the maker's reasoning trace; its findings file is its own artifact.
9. **The mechanical gate consumes verifier evidence.** Maker claims are inputs, not verdicts. Missing or failed required evidence blocks.
10. **The ledger records everything**: model requested/effective, action, evidence, maker-claim vs. verifier-finding divergence, gate result, and any human boundary crossings or ledgered skips.
11. **A human reviews or authorizes only where needed** — at `never_without_human` boundaries (push, PR, merge, override) and ledgered skips, not on every line of diff.
12. **`specflow run trace` explains what happened** — the run is readable after the fact, including where the maker's judgment diverged from the gate.

---

## The Runner and Its State

```bash
specflow run spec-build      # build the outer contract from a goal
specflow run feature-build   # execute one approved slice under contract
specflow run trace           # divergence report over the ledger
```

Add `--until-terminal` to drive a loop stage by stage through to completion for long runs.

State lives on disk, not only inside a context window, so a run survives compaction, crashes, and resumption:

| File | What it holds |
|---|---|
| `.specflow/runs/<slug>/run-contract.yaml` | The run's setpoint: goal, stages, gates, adapter policy, stop rules |
| `.specflow/runs/<slug>/ledger.jsonl` | Append-only machine state: model requested vs. effective, action, evidence paths, divergence, gate results, human authorizations |
| findings files | The verifier's own artifacts, written separately from the maker's work |

---

## Maker and Verifier Are Separated

This is the load-bearing rule. The entity that produces a change is never the entity that certifies it.

- **Different contexts, different roles — structurally, not by politeness.** The maker builds; the verifier judges.
- **The verifier judges artifacts and behavior, not the maker's reasoning.** Its input is the artifact, the observed behavior, the spec, and the rubric — never the maker's chain-of-thought. Feeding the maker's trace to the verifier lets it inherit the maker's delusion.
- **The maker's claim is subordinate.** A maker can claim "complete"; a blocked or failed required verifier finding blocks the gate regardless.

### The verifier lifecycle

```
maker proposes verification contract
   → verifier accepts / rejects / strengthens (harsher than the maker)
   → negotiated contract written to disk
   → maker implements
   → verifier exercises the built behavior
   → findings written separately
   → gate consumes findings
```

### Mandatory verifier slice types

The verifier stage is enforced in `feature-build`, not optional. Runtime-required slices cannot advance the gate without verifier evidence. Verification is required by **slice type**, not a global toggle:

`ui`, `workflow`, `api_behavior`, `integration`, `data_mutation`, `auth`, `billing`, `runtime_required`

### Value-bearing checks need non-visual evidence

A screenshot is evidence, not proof. Value-bearing tags — **`api_behavior`, `data_mutation`, `billing`** — cannot pass on screenshot evidence alone. Something must actually observe the API response, the row that changed, or the charge that occurred.

### Human-only ledgered skips

A human — and only a human — may skip a required verification. The skip is recorded in the ledger with attribution. There is no `mode: never` self-certification path back in.

---

## How Gates Check Things

Gates decide using evidence. Underneath the verifier evidence, two concrete mechanisms do the checking.

### Contract tests (fast, static gate)

Pattern scans run on source code before build. They check:

- **forbidden_patterns** — must NOT appear in any file in scope
- **required_patterns** — must appear in at least one file in scope

Violations block immediately, no build needed. These are hard gates.

```yaml
rules:
  non_negotiable:
    - id: AUTH-001
      scope: ["src/routes/**/*.ts"]
      behavior:
        forbidden_patterns:
          - pattern: /localStorage\.setItem.*token/i
            message: "Tokens must use httpOnly cookies, not localStorage"
        required_patterns:
          - pattern: /authMiddleware/
            message: "Route missing authMiddleware"
```

Pattern scans are narrow by design — they catch known code shapes fast, and miss novel syntax and runtime behavior. That is why they are one check under the harness, not the whole gate.

### Journey tests (runtime gate, via Playwright)

Playwright drives the running application and verifies users can accomplish their goals end to end. This is how the runtime verifier exercises UI and workflow slices.

```yaml
journey_id: J-CHECKOUT-FLOW
steps:
  - user_does: "Adds item to cart"
    system_shows: "Cart updates with item"
  - user_does: "Clicks checkout"
    system_shows: "Payment form"
```

### The provenance gate

A post-code check that output is real — no hard-coded or mock data passing as implementation. It catches the plausible-completion failure where a UI looks done over a dead backend.

### Default contracts out of the box

```bash
cp Specflow/templates/contracts/*.yml docs/contracts/
```

| Template | Rules | What it catches |
|---|---|---|
| `security_defaults.yml` | SEC-001..005 | Hardcoded secrets, SQL injection, XSS via innerHTML, dynamic code execution, path traversal |
| `accessibility_defaults.yml` | A11Y-001..004 | Missing alt text, icon buttons without aria-label, unlabelled inputs, broken tab order |
| `production_readiness_defaults.yml` | PROD-001..003 | Demo/mock data in production, placeholder domains, hardcoded UUIDs |
| `test_integrity_defaults.yml` | TEST-001..005 | Mocking in E2E tests, swallowed errors, placeholder tests, suspicious assertions |

---

## Adapters and Model Honesty

Provider CLIs (`claude-print` / `codex-exec` style) run behind thin adapter policies with budget, tool, and timeout caps. The adapter layer is provider-agnostic — the worker is swappable — and, critically, an adapter result is never a verdict: gates re-run their own checks (`I-ADAPTER-001`).

Model metadata is ledgered per entry. The requested model and the effective model are both recorded, so a **silent downgrade or fallback is a failed contract**, not an invisible substitution.

---

## Human-Only Boundaries

Some actions can only be crossed by a human, mechanically enforced from provider events rather than requested via prompt: **push, merge, open a PR, `--no-verify`, and gate override** are all `never_without_human`. The run can go six hours unattended; the merge still needs a person.

---

## Trust Boundaries

These invariants define the product. If any can be crossed, Specflow has failed regardless of what else works.

| Boundary | Enforcement |
|---|---|
| The maker cannot mark its own work as accepted | Gate advancement requires verifier/gate evidence; maker claims are recorded but non-authoritative |
| A provider exit code cannot become a pass | `I-ADAPTER-001`: gates re-run checks; adapter results are never verdicts |
| A screenshot alone cannot satisfy value-bearing behavior | `api_behavior`, `data_mutation`, `billing` require non-visual evidence |
| Missing verifier evidence cannot advance runtime-required work | Enforced verifier rail: required slice types block without findings |
| A failed required finding cannot be overridden silently | Only a human may skip, and the skip is ledgered with attribution |
| Model fallback/downgrade cannot be hidden | Requested vs. effective model recorded per ledger entry |
| The agent cannot push, merge, PR, or override gates without approval | `never_without_human`, enforced from provider events |
| The verifier cannot be polluted by maker chain-of-thought | Verifier input is artifact + behavior + spec + rubric — never the maker's reasoning |
| Routine/cron execution cannot invent a second loop | All scheduled variants call `specflow run`; no parallel loop with weaker gates |

Specflow enforces that evidence exists and gates on it. It does not guarantee correctness — it cannot conjure ground truth a project never defined.

---

→ **Deciding whether to adopt?** See [Should I Use Specflow?](should-i-use-specflow.md)
→ **Setting up for a team?** See [Team Workflows](team-workflows.md)
→ **Full contract schema?** See [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md)
