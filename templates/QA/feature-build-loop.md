# Feature-build loop — ticket → tested slice → evidence → human gate

**The problem.** A finished slice is full of claims that nothing enforces: *the test passes, this number is right, the journey works.* Hand-built, those claims go *untyped* — a green check against a mock, an assertion someone guessed, a "looks done" that breaks production. The cost isn't the labor of building; it's that a wrong-typed slice can merge.

**What this is.** A loop that **type-checks a ticket into a slice.** Given a ready ticket, it builds on five fixed rails one at a time — and each rail is a type boundary the next can't cross until it conforms: the contract must be wired, the e2e must run against a *real* backend, every asserted number must be anchored to the **oracle** (never guessed), the implementation must make it pass. Failures route into repair within a budget instead of you re-prompting.

**Why it's safe to let it go.** The slice never certifies its own type — **Gate C does: branch-protected CI against a real seeded backend.** Nothing merges unless real data says it works, so *green-but-broken can't typecheck*. Around that: the slice is capped under 1000 lines (reviewable), `/qa` and the swarm are *muscle that finds problems, never approves them*, and the loop never pushes, opens a PR, merges, or overrides a contract without you. A type error is caught at its boundary — worst case, a branch you don't merge.

Wired to **our** gates (`/qa`, ruflo swarm, `npm run specflow:verify`, multicheck) and our hard rule: **land a slice, not a feature.** Scope discipline: this is **one loop**, not a platform — don't generalise it until it has run unattended on three real slices.

> **Executable path:** [`QA/loops/feature-build.yaml`](./loops/feature-build.yaml) is the source of truth (rails, muscle, Gate C, repair, `done_when`, the per-tick progress map). **This doc is the prose explainer.** If the two ever disagree, the YAML wins.
>
> **You don't paste the contract below into a prompt.** The prompt is thin — goal + inputs + automation — and points at the YAML:
> ```
> Goal:   <e.g. branch for #566 green on CI, ready for review>
> Path:   QA/loops/feature-build.yaml
> Inputs: { issue: <n> }
> Automation: thread automation per ticket; interval matched to CI duration.
> Each tick: load the path, locate the rail from the branch + CI state, advance ONE rail, persist, stop/escalate. Don't restate the path — follow it.
> ```

---

## PART 1 — THE LOOP CONTRACT

Write/confirm this before the driver runs. It is what the loop reads instead of your head.

```yaml
loop: feature-build
repo: AI-Claims-LLC/claims-monorepo   # code repo; docs mirror in gmh-docs
version: 1
input:
  issue: required                     # GitHub issue / ticket
  branch: feat/<issue>-<slug>
  constraints:
    - SLICE under 1000 lines (insertions+deletions). Bigger → split first, loop per slice.
    - independently mergeable — the slice lands on its own
    - every status-mutating change writes an audit row (propertyActivityLog/caseEvents, ADR-115)
preconditions:                        # loop refuses to start → escalate
  - CRITICAL journey defined for this work (CSV → spec → journey_*.yml → e2e), per journeys-how-to.md
  - ACs explicit; if a journey is missing → draft it, re-check; still ambiguous → ESCALATE
  - if the change revises an architectural pattern → ADR exists at docs/ard/ADR-NNN
# This loop is PROCESS.md Step 6 (the 5 rails) → Step 7 (Gate C).
# Trust lives ONLY in Gate C. Everything else is muscle — agents/tools that DO work, never approve it.
rails:                                # build the slice on the 5 fixed rails, one journey at a time
  1_ticket:    confirm ticket exists (Rule 1: no ticket = no code)   check: ticket + ACs + journey id
  2_contract:  promote contract YAML stub → full (steps+selectors lifted from the catalogue)
               check: journey_*.yml complete for this journey
  3_e2e:       write the REAL-backend e2e test for the journey       check: runs against a real seeded backend
  4_oracle:    anchor EVERY assertion to the oracle (live calc / real source numbers — never a guess)
               check: each asserted number traced to its oracle ("2 days, not 5" → verified, not assumed)
  5_impl:      smallest mergeable slice (<1000 lines) that makes it pass   check: diff within budget
muscle:                               # these DO the work; they never gate it
  - /qa (coverage + regression) — run, then SPOT-CHECK before trusting; pre-CI mechanical pass
  - multicheck REVIEWER (different model) for complex slices
  - ruflo swarm — ONLY if triggered* ; design-level review, still NOT a gate
  # *swarm triggers (README map): slice >1500 lines, 3+ arch layers,
  #  security/invariant-critical (auth, audit, hash, lockouts), rejected-unsure, or new pattern.
GATE_C:                               # HARD, unfakeable — the ONLY trust gate in this loop (PROCESS.md Step 7)
  - branch-protected CI: contract + journey tests vs a REAL seeded backend,
    + anti-pattern audit + coverage ratchet + migrations-replay
  - a violation CANNOT merge — this is the machine, not an agent's opinion
  - green-but-broken can't pass, because the journeys run against real data
repair:                               # this replaces YOU re-prompting on a failing gate
  on_gate_fail: classify → targeted repair prompt → retry
  classify: [coverage, regression, contract, journey, swarm-finding, lint, flake]
  budget: 3 attempts per stage, 2 full-loop retries
  inherited_baseline: NOT your problem — note the tracking ticket, do not fix in this slice
  on_budget_exhausted: ESCALATE with classified failure + last diff
evidence_pack:                        # output is "movement with proof", not "code"
  - issue + ACs + journey id covered
  - branch + diff summary (files, +/- lines) — confirm under 1000
  - /qa result (spot-checked, not trusted blind) + specflow:verify verdict
  - journey test result: WHERE / WHICH / HOW MANY / SKIPPED-why
  - swarm verdict if run; audit-row confirmation for every state mutation
  - unresolved risks / assumptions
human_gate:                           # the ONE escape hatch
  escalate_when:
    - precondition unmet after drafting the journey
    - ACs ambiguous (>1 reasonable reading)
    - slice can't be kept under 1000 lines without losing mergeability
    - inherited-baseline failure blocks the gate (needs --no-verify operator authorization)
    - repair budget exhausted
  never_without_human: [git push, open PR, merge, --no-verify, override contract]
done_when:
  - 5 rails complete, muscle run + spot-checked, GATE C (CI) green, evidence_pack complete, no escalation open
  - loop STOPS at "branch ready for review" — human opens the PR
```

---

## PART 2 — THE DRIVER PROMPT

Run on demand in the claims-monorepo: *"Run the feature-build loop from gmh-docs/QA/feature-build-loop.md on #<issue>."* (Or schedule it against a `ready`-labelled queue.)

> You are the **driver** of the feature-build loop defined in `QA/feature-build-loop.md` — PROCESS.md Step 6→7. You do not free-style. For the given issue you build on the 5 rails, GENERATING each worker prompt from the ticket/spec/repo/ADR state — you never wait for a human to hand you a prompt. **Trust lives only in Gate C; everything you and the swarm do is muscle, never self-approval.**
>
> 1. Load the issue + relevant ADRs and check **preconditions**. Missing CRITICAL journey → draft it via the `journeys-how-to.md` ladder, re-check; still ambiguous → **escalate** and stop.
> 2. Build on the 5 rails in order — ticket → contract YAML → real-backend e2e → **oracle-anchored assertions** → implementation. Never assert a number you haven't traced to the oracle (the live calc / real source). "It's green" is not evidence.
> 3. Run muscle as needed — `/qa`, multicheck, and ruflo swarm **only if a README trigger fires** (else skip and say so). None of these is a gate; they find problems, they don't approve work.
> 4. On any failure, **classify** it and generate a targeted repair prompt; retry within the **repair budget**. An inherited-baseline failure is not yours — note the ticket, never silently `--no-verify`.
> 5. Hold the **slice under 1000 lines**. If it won't fit, stop and propose a 4–8 slice split — do not land a 2400-line diff.
> 6. **Spot-check `/qa` before trusting it** (README: non-negotiable). Confirm an audit row exists for every state mutation. The real verdict is **Gate C (branch-protected CI vs the real seeded backend)** — surface its result, don't substitute your own opinion for it.
> 7. Produce the **evidence pack** with WHERE/WHICH/HOW MANY/SKIPPED for every test run, then **stop at "branch ready for review."** Never push, open a PR, merge, `--no-verify`, or override a contract — those are `never_without_human`.
>
> Guardrails: land a slice not a feature; oracle-anchor every assertion; ambiguity → escalate, don't guess; ADR is ground truth.

---

## How this composes

- **This loop (execution)** turns a ticket into a tested, evidenced, sub-1000-line slice without manual nudging — `/qa` and the swarm become *stages it runs*, not commands you remember.
- A **daily mistake-harvest loop** (sibling routine in the timebreez repo) reads recent loop runs across repos, finds where gates were skipped or repairs thrashed, and updates the skills/preamble/contracts this loop depends on.

Execution loop does the work; harvest loop improves the loop. That's the "operating system around the agent" the practice is really about — not better one-off prompts, but a system that prompts, gates, repairs, audits, and learns. Start with one slice; widen only once it survives unattended.
