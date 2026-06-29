# Journeys — the how-to

**The journey is the parent spine; the stories are the verbs.** A journey like *"Owner files a Notice of Loss after a named storm"* is delivered by a dozen small stories (render the alert, build the snapshot, wire the drafter, persist it, surface it in the pipeline…). The journey exists so that, at any point, a story can look **up** at its parent and ask:

> ### "Does what I'm building still let the human finish the whole thing?"

That question is the entire reason journeys exist. Buttons A and B can each pass their own test while the human is stranded between them — a missing redirect, a balance that reads zero, a record that never links to the next screen. **Stories verify the parts; journeys verify the parts add up to something a real person can finish, on real data, end to end.**

That's also why journeys *are* our Definition of Done. A feature is not "done" because the code compiles and a unit test is green. It's done when **a real human can complete the whole task on real data**, and a Playwright test against the real backend proves it.

This how-to is the practical pipeline: how a designer sketches a journey, and how that sketch becomes a machine-readable contract referenced by every story under it. Companion to [`QA/README.md`](./README.md) (PR / review practices). The live artifacts are in `claims-monorepo` (`docs/contracts/`, `docs/specs/`, `tests/e2e/`); copy-ready examples are in [`QA/journeys/`](./journeys/) (this folder).

---

## TL;DR — the rules of thumb

1. **A journey answers "can a real person finish this on real data?"** — not "does button A work?" If it doesn't cross 2+ systems and end in a persisted state change, it's a story, not a journey.
2. **Journeys are the DoD.** A feature ships when its **CRITICAL** journeys are green against the **real** backend. The list lives in `CONTRACT_INDEX.yml → definition_of_done.critical_journeys`.
3. **Real backend, not mocks.** A DoD-gating journey runs against `playwright.config.ts` (real seeded user via `tests/e2e/global-setup.ts`). The mocked config is for narrow component panels only.
4. **Every assertion is oracle-anchored.** Check a real value — a record exists, a status reads `Filed`, a redirect lands. Where there's a known-wrong answer, assert against it (`expect(...).not...`) so a regression can't pass silently.
5. **Write the journey before you build; prove the same journey after.** It starts as a registered **stub** and graduates to a green test.
6. **The `data-testid` is the contract.** The same testid string appears in the spec, the journey YAML, the React component, and the e2e test. Keep them stable and semantic.

---

## The pipeline at a glance

Five steps. Each adds machine-enforceability. The designer owns Step 1; nobody hand-waves past a step on the way to "done."

```
 STEP 1            STEP 2              STEP 3                  STEP 4              STEP 5
 designer          PM / architect      engineer                engineer            engineer
┌──────────┐      ┌──────────────┐   ┌────────────────────┐  ┌──────────────┐   ┌────────────────┐
│ CSV       │ ───▶ │ spec + ADR   │──▶│ journey_*.yml       │─▶│ stories ref  │──▶│ real-backend   │
│ journey   │ tier │ (Gherkin +   │   │ + CONTRACT_INDEX    │  │ the journey  │   │ Playwright e2e │
│ map row   │      │  oracle #s)  │   │   DoD tier          │  │ id           │   │ (the proof)    │
└──────────┘      └──────────────┘   └────────────────────┘  └──────────────┘   └────────────────┘
 enumerate         decide/explain      make it enforceable     keep stories       prove on real data
 the promise                                                   on the spine
   │                   │                      │                                         │
   ▼                   ▼                      ▼                                         ▼
 journey_map_       examples/             examples/                              examples/
 TEMPLATE.csv       notice-of-loss        journey_nol_file.yml                   journey_nol_file
                    .spec.md              (register + DoD list)                  .spec.ts
```

Worked end-to-end below using one real journey: **J-NOL-FILE** — *owner files a Notice of Loss after a named storm.* Every step links to a file in [`QA/journeys/`](./journeys/) you can open and copy.

---

## What a journey is (vs a story)

| | **Journey** | **Story / ticket** |
|---|---|---|
| Altitude | The whole task a human completes | One step / screen / rule |
| Owner | Product + Eng (designed up front) | Whoever picks up the ticket |
| Lives in | `docs/contracts/journey_*.yml` | a GitHub issue (references the journey id) |
| Proves | "A real person finishes this on real data" | "This specific behavior works" |
| Test | `tests/e2e/journey_*.spec.ts` (real backend) | unit / `tests/contracts/*.test.ts` / component |
| Count | ~30 for the whole product | hundreds |

## Journeys are the Definition of Done

Tiers are not labels — they're literally the release gate, encoded in `docs/contracts/CONTRACT_INDEX.yml`:

```yaml
definition_of_done:
  critical_journeys:      # MUST pass to ship. A red one blocks the release.
    - J-AUTH-SIGNUP
    - J-POLICY-UPLOAD
    - J-NOL-FILE
  important_journeys:     # SHOULD pass. A red one is a tracked defect, not a hard block.
    - J-ACCOUNT-SETTINGS
    - J-BOOK-CONSULTATION
```

| Tier | The business question | If it breaks | List |
|------|----------------------|--------------|------|
| **CRITICAL** | "Can a customer do the core job at all?" | We shipped something a real claimant cannot complete. | `critical_journeys` |
| **IMPORTANT** | "Will the customer still be happy past day one?" | Degraded UX, manual workaround, tracked defect. | `important_journeys` |
| **DIFFERENTIATOR** | "Why pick us over a public adjuster / spreadsheet / carrier portal?" | We become a me-too claims form with no moat. | *(add `differentiator_journeys` when these exist)* |

**DoD = the `critical_journeys` list is green against the real backend.** A CRITICAL journey that is red, skipped, or only green under mocks is, by definition, not done.

---

## Step 0 — whiteboard → agree (before anything digital)

The CSV is not the start. It's the moment a journey goes *digital* — and you only digitize what has been seen whole and agreed.

1. **Map it on the wall first.** Sketch the journeys spatially — Figma / FigJam, or a literal whiteboard. (ClaimAlert's FigJam board is the home for this — see [`README.md`](../README.md).) A *map*, not a list: personas as lanes, the arc as a path, the hand-offs between systems drawn as crossings. This is the diverge / sense-make stage — you're finding the real journeys, arguing the tiers, and spotting the gaps *between* steps where a person gets stranded.
2. **Agree the set.** Product + Eng + Design sign off on which journeys exist, their tier (CRITICAL / IMPORTANT / DIFFERENTIATOR), and each success outcome. Agreement is a gate: an un-agreed journey is not ready to digitize. This is where the **parity baseline** gets settled — and the parity baseline decides the tier.
3. **Then, and only then, convert to CSV.** Each agreed journey on the wall becomes one row in [`journey_map_TEMPLATE.csv`](./journeys/journey_map_TEMPLATE.csv). The CSV is the first machine-ingestible artifact — the start of the digital journey, the bridge from the wall to the contract.

> **What we must have, to build:** journeys mapped on the wall → agreed → in the CSV. If it isn't on the wall, we haven't seen it whole. If it isn't agreed, we're building one person's guess. If it isn't in the CSV, the pipeline has nothing to ingest.

---

## Step 1 — the designer fills in the journey map (CSV)

**File:** [`QA/journeys/journey_map_TEMPLATE.csv`](./journeys/journey_map_TEMPLATE.csv) — open it, keep the header, delete the example row, add one row per journey.

You're describing a promise the platform makes to a real person, end to end — **not a screen**. Don't invent UI or selectors; describe intent. Engineering picks the `data-testid`s at Step 2.

### Fill in each column — what goes in it

| Column | What to write | J-NOL-FILE example | The trap to avoid |
|---|---|---|---|
| **tier** | `CRITICAL` / `IMPORTANT` / `DIFFERENTIATOR`. Set by the parity baseline (below). | `CRITICAL` | Marking everything CRITICAL. If a manual workaround is tolerable, it's IMPORTANT. |
| **journey_id** | `J-<DOMAIN>-<VERB>`, UPPER-KEBAB, stable forever — this id is what stories reference. | `J-NOL-FILE` | Renaming it later (breaks every story + test that points at it). |
| **journey_name** | Short human title. | `File Notice of Loss after named storm` | A whole sentence. |
| **persona** | Who is doing this. | `Property owner` | "User." Be specific — owner vs case manager vs PM behave differently. |
| **trigger** | The real-world event that starts it. | `Owner gets a loss alert that a named storm hit their property` | Starting at a screen ("opens the NOL page") instead of the event. |
| **narrative** | 2–3 sentences, trigger → outcome. | *(see the template row)* | If it doesn't cross 2+ systems and end in a saved state change, it's a story. |
| **steps** | The meaningful beats in order, `;`-separated. Prose, NOT clicks. ~5–10. | `See alert; open snapshot; draft NOL; file NOL; see Filed; (case mgr) see in pipeline` | Keystroke-level detail ("click the blue button"). |
| **systems_touched** | The apps/engines involved, `;`-separated. | `claims-client; claims-server; named-storm engine; NOL drafter; mgmt pipeline` | Listing only the screen the persona sees. |
| **success_outcome** | **THE ORACLE.** One checkable fact: a record / status / number / redirect. | `NOL status reads 'Filed' AND a NOL record exists in the case manager pipeline` | A feeling ("owner is confident"). Un-checkable = un-testable. |
| **parity_baseline** | How a person does this **today** (adjuster / spreadsheet / carrier portal). This decides the tier. | `A public adjuster hand-keying the loss from a phone call` | Leaving blank — then nobody can judge CRITICAL vs IMPORTANT. |
| **failure_modes** | How it goes wrong in real life, `;`-separated → become `error_scenarios`. | `No policy on file; duplicate filing; storm not matched to property` | Only describing the happy path. |
| **preconditions** | What must already be true before the trigger. | `Authed owner; property with uploaded policy; a named storm intersecting it` | Assuming an empty/fresh account when the journey needs seeded state. |
| **data_created** | What records exist afterward. | `NOL record; pipeline entry; audit log row` | Forgetting the audit row (ADR-115: every state transition writes one). |
| **help_needed** | Where a real user gets confused (informs UI copy). | `Owner doesn't know what a 'Notice of Loss' is` | — |

**The two columns where the rigor lives:** `success_outcome` (#9) must be a fact a test can check, and `parity_baseline` (#10) is what auto-sorts the DoD tier. Get those two right and the rest of the pipeline almost writes itself.

---

## Step 2 — PM/architect turns each row into a spec

**File:** [`QA/journeys/examples/notice-of-loss.spec.md`](./journeys/examples/notice-of-loss.spec.md) → in the repo: `docs/specs/notice-of-loss.md`.

The spec makes the row precise and testable:

- **Narrative → Gherkin** acceptance criteria (happy path **and** the failure modes from the CSV).
- **Oracle numbers** — for each Gherkin clause, the *real value* that proves it (peak gust `> 0 mph` matching the storm-store row; filed-NOL count 0 → 1; pipeline query returns the row).
- **data-testids** — engineering names them here (`loss-alert-card`, `nol-status`, …). This is the contract surface every later artifact keys on.
- **Shared rules referenced, not restated.** A calculation, a matching policy, an auth rule → a `docs/ard/ADR-NNN-*.md`, linked from the spec. Restating a rule inside each journey is how preview drifts from persisted and owner-app from mgmt-app.

---

## Step 3 — engineer writes the machine-readable journey contract

**File:** [`QA/journeys/examples/journey_nol_file.yml`](./journeys/examples/journey_nol_file.yml) → in the repo: `docs/contracts/journey_nol_file.yml`.

This is the machine-readable contract. Annotated schema (same shape for a stub and a full journey — a stub just omits `steps` and sets `stub: true`):

```yaml
journey_meta:
  id: J-NOL-FILE                       # the id stories reference (Step 4)
  from_spec: "docs/specs/notice-of-loss.md"   # back-link to Step 2
  covers_reqs: [NOL-001, NOL-002, STORM-004]  # requirement IDs from feature_*.yml (the gate checks these)
  type: "e2e"
  dod_criticality: critical            # -> which CONTRACT_INDEX DoD list
  status: not_tested                   # not_tested | passing | failing | draft(=stub)
  last_verified: null                  # last green real-backend run (staleness signal)

preconditions:                         # the seeded REAL state (not mocks)
  - "Owner has a property with an uploaded policy"
  - "A named storm intersecting the property exists in the storm store"

steps:                                 # the spine — one step per meaningful state transition
  - step: 1
    name: "Loss alert card is visible on the dashboard"
    action: "navigate"
    target: "/dashboard"
    expected:
      - { type: element_visible, selector: "[data-testid='loss-alert-card']" }
  # ...steps 2-4: open snapshot -> draft -> file (see the example file)

error_scenarios:                       # from the CSV failure_modes
  - { id: ERR-NOL-NO-POLICY, name: "No policy on file", action: "...", expected: [...] }

success_criteria:                      # the oracle in prose; each clause checkable against a real value
  - "Filing transitions status to 'Filed' and persists a NOL record"
  - "Filed NOL appears in the case manager's pipeline"

test_hooks:
  e2e_test_file: "tests/e2e/journey_nol_file.spec.ts"
```

Then **register it** so the gate can see it. In `docs/contracts/CONTRACT_INDEX.yml`:

```yaml
# under contracts:
- { id: J-NOL-FILE, file: journey_nol_file.yml, type: e2e, dod_criticality: critical,
    status: not_tested, covers_reqs: [NOL-001, NOL-002, STORM-004],
    e2e_test: "tests/e2e/journey_nol_file.spec.ts", issue: "#<issue>" }
# under definition_of_done.critical_journeys:
  - J-NOL-FILE
```

Bump `metadata.total_journeys`, then `npm run specflow:verify && npm run test:contracts` — both must pass (they fail the build if a journey isn't indexed, an indexed journey has no file, or required fields are missing).

> **Stub vs full.** Designed-but-unbuilt? Commit the same file with `stub: true`, no `steps`, but real `success_criteria` + a planned `test_hooks.e2e_test_file`. That registers the promise so the epic can hold it before any code exists — openly not-done, never a fabricated green.

---

## Step 4 — every story references the journey

This is the link that keeps twenty in-flight stories coherent. When you cut the child tickets, **each one names its parent journey id**, so the story can always look up at the spine:

```markdown
**Parent journey:** J-NOL-FILE  ·  **Covers:** NOL-002
**Contract:** docs/contracts/journey_nol_file.yml

As an owner I can file a drafted NOL so that...
AC: clicking [data-testid='file-nol-btn'] sets [data-testid='nol-status'] to "Filed"
```

Two cross-links make it machine-traceable, not just prose:
- **`Parent journey: J-NOL-FILE`** — ties the ticket to the journey contract and its e2e.
- **`Covers: NOL-002`** — ties it to the requirement id in the feature contract, which the journey's `covers_reqs` also lists.

So the chain is closed both ways: the journey lists the requirements it proves; each story lists the requirement it implements and the journey it serves. A reviewer (human or the QE fleet) can walk from a story → its requirement → the journey that proves it → the e2e that gates it.

---

## Step 5 — the e2e proves it (real backend)

**File:** [`QA/journeys/examples/journey_nol_file.spec.ts`](./journeys/examples/journey_nol_file.spec.ts) → in the repo: `tests/e2e/journey_nol_file.spec.ts`.

The test drives the exact `data-testid`s from the YAML, against the **real** seeded backend, with oracle-anchored assertions:

```ts
await page.getByTestId('review-incident-btn').click()
// oracle: real met data, and explicitly NOT the placeholder
await expect(page.getByTestId('incident-peak-gust')).toContainText(/\d+\s*mph/i)
await expect(page.getByTestId('incident-peak-gust')).not.toContainText('-- mph')

const before = await countFiledNols()        // prove the record count actually changes
await page.getByTestId('file-nol-btn').click()
await expect(page.getByTestId('nol-status')).toContainText('Filed')
expect(await countFiledNols()).toBe(before + 1)
```

Green against `playwright.config.ts` (real backend) = `J-NOL-FILE` is **done**: set `journey_meta.status: passing`, `last_verified: <ts>`, and check it off in its epic.

---

## Lifecycle + the gates

```
CSV row → tiered → STUB journey_*.yml (status: draft, in CONTRACT_INDEX + a DoD list)   ← before build
   → child stories cut, each referencing J-<ID>  (Step 4)
   → fill steps + success_criteria + error_scenarios   (status: not_tested)
   → wire data-testids, implement the stories
   → green vs real backend → status: passing, last_verified: <ts>
   → drifts later? the gate re-runs it → red → status: failing → back into an epic
```

| Gate | Command (in `claims-monorepo`) | Enforces |
|------|---------|----------|
| Specflow contract check | `npm run specflow:verify` | every `journey_*.yml` indexed; required fields present; no orphans |
| Contract / invariant tests | `npm run test:contracts` | `tests/contracts/*` + completeness; `CONTRACT_INDEX` counts match disk |
| Journey proof (real) | `npm run test:e2e` | `journey_*.spec.ts` green against the **real** seeded backend |
| Component panel (mocked) | `npx playwright test --config playwright.mocked.config.ts` | narrow panels only — **never** the proof for a DoD-gating journey |
| Full release gate | `npm run validate` | lint + format + test + build |
| Human gate | multicheck reviewer | adversarial `[R-NNN]` verdict; process violations block too |

> Inherited-baseline journey failures you didn't introduce are not your PR's problem — `--no-verify` with explicit operator authorization + a tracking ticket, per the [`QA/README.md`](./README.md) rule of thumb. Under multicheck, an ungrounded "looks good" or a silent skip is itself a rejectable process violation.

---

## Keeping journeys visible (so the YAML never goes obscure)

The failure mode: the wall and the YAML drift apart, the `journey_*.yml` files rot in a folder nobody but engineers ever opens, and the designer's map becomes fiction. Guard against it with one rule and three synced views.

**The rule: the YAML is the destination, never the origin.** Truth always flows **wall → CSV → spec → YAML → e2e**. Nobody invents or mutates a journey *inside* the YAML. That single discipline is what keeps the contract legible — it only ever restates what the wall and the spec already agreed.

**Three views of one journey, kept in sync:**
- **The wall (Figma / FigJam)** — the human map. Label each node with its `journey_id` so the wall and the contracts share one vocabulary.
- **The board (CSV + a generated dashboard)** — the index. The same status the gate already knows (passing / failing / stub / `last_verified`) should be *rendered* somewhere everyone sees — a dashboard generated from `CONTRACT_INDEX.yml`, not a number buried in CI logs. A red or stale journey must be visible at a glance. *(If no dashboard exists yet, generating one from `CONTRACT_INDEX.yml` is the highest-leverage visibility step — it's a pure read of data the gate already maintains.)*
- **The YAML** — the enforceable detail, linked from the board and linking back to the wall's intent via `from_spec`.

Visibility is a maintenance practice, not one-time setup: when the board goes red, or a `last_verified` goes stale, that is the signal to act — surfaced, not hidden.

## Changing a journey (the kaizen ritual)

A journey is a promise, so you change it the way it was born — **from the wall, through agreement, down the ladder** — never by quietly editing the YAML. Editing the contract in the dark is exactly how it becomes obscure and untrusted.

**1. Classify the change** (this sets the ceremony):
- **Refinement** — add a step, tighten an assertion, fix a selector. Same `journey_id`. Update spec + YAML + e2e together in one PR; re-prove.
- **Material change** — the *promise* changes: a different outcome, a new tier, a newly-important failure mode. Back to the wall, re-agree. A tier change to/from CRITICAL is a release-gate change and needs explicit sign-off. If a shared rule changed, that's an ADR.
- **Supersession** — the journey is replaced by a different promise. Don't silently mutate a passing journey's meaning: retire the old id (`status: retired`) and create a new one. Git history + the retired id preserve the audit trail.

**2. Travel the whole ladder in lockstep.** Wall re-sketch → CSV row updated → spec updated → YAML updated → affected stories re-pointed → e2e re-proven. The gate enforces the lockstep: a changed contract whose e2e is red or missing fails `npm run test:contracts` — you cannot land a contract that lies.

**3. Reset the proof.** On any material change, set `status: not_tested` and `last_verified: null` until the e2e is green again. A changed journey is unproven until re-proven, and the board shows it amber, visibly, until then.

> Rule of thumb: **the `journey_id` is stable; its meaning is governed.** Stable id → stories and tests keep their anchor. Governed meaning → the promise can't drift without someone agreeing and the e2e re-proving.

## How this relates to specflow

Journeys *are* specflow, applied at the altitude of the whole user task. [Specflow](https://github.com/Hulupeep/multicheck) is the spec-driven, contract-gated method this repo runs: **no ticket = no code; contracts are non-negotiable; verify before "done."** Its contracts come in two layers — both in `docs/contracts/`, both registered in one `CONTRACT_INDEX.yml`:

| Specflow layer | Asserts | Enforced by | Example |
|---|---|---|---|
| **Feature contract** (`feature_*.yml`) | an *invariant* — a rule that must always hold | `tests/contracts/*.test.ts` (unit-level, fast) | "only `claim-incident-snapshot.service.ts` writes `incident_snapshot`" (NOL-SNAP-004) |
| **Journey contract** (`journey_*.yml`) | a *promise* — a whole task a human can complete | `tests/e2e/journey_*.spec.ts` (real backend) | "owner files a NOL and it lands in the pipeline" (J-NOL-FILE) |

They interlock: a journey's `covers_reqs` lists the feature-requirement ids it exercises (`NOL-001`, `STORM-004`), so the journey is the **outer loop** ("does the whole promise hold on real data?") sitting on the feature contracts' **inner loop** ("do the invariants hold?"). Same registry, same gate (`npm run specflow:verify` + `test:contracts`), same philosophy: contract before code, verify before done. The CSV → spec → YAML → e2e ladder in this guide is just specflow's authoring pipeline written for journeys; `specflow:verify` is the check that the pipeline wasn't short-circuited.

## The invariants that keep journeys honest

1. **One registry, gated.** Every journey is in `CONTRACT_INDEX.yml` or the build fails.
2. **Stub ≠ fake-done.** Unbuilt = openly `draft`/`stub` with no `steps`, never a fabricated green.
3. **Oracle or it didn't happen.** Each `success_criteria` clause checks a real value; known-wrong answers get an explicit negative assertion.
4. **Real backend, real session.** A DoD-gating journey is proven against `playwright.config.ts`. Mocks prove mocks.
5. **Shared rules live in an ADR**, consumed via `covers_reqs` / `from_spec` — not restated in each journey.
6. **Tier carries the consequence.** CRITICAL blocks the release; IMPORTANT is a tracked defect.
7. **Every story traces to a journey and a requirement; nothing is "done" unverified** — the reviewer checks the real run, not the summary of it.

---

## The build prompt (turn one CSV row into a green journey)

Reusable IC / agent prompt. Encodes the five steps for `claims-monorepo`:

> **You are building one journey from a CSV journey-map row to a green real-backend e2e test in `claims-monorepo`. Don't skip steps; don't mark anything "done" without running it.**
>
> **Input:** one CSV row + its tier + the parent epic/issue #.
>
> 1. **Stories + ticket.** Create/locate the issue(s). Each carries: Gherkin from `success_outcome`; the `data-testid` list; the `covers_reqs` requirement ids; the e2e filename; and `Parent journey: J-<ID>`.
> 2. **Spec.** Write/extend `docs/specs/<name>.md`: narrative → Gherkin → **oracle numbers** → data-testids → e2e filename. Shared rules go in `docs/ard/ADR-NNN-*.md` and are referenced, not inlined.
> 3. **Journey YAML + index.** Create `docs/contracts/journey_<name>.yml` (journey_meta, preconditions, steps, error_scenarios, success_criteria, test_hooks). Register in `CONTRACT_INDEX.yml`, add to the right `definition_of_done` list, bump `metadata.total_journeys`. `npm run specflow:verify && npm run test:contracts` must pass.
> 4. **Real-backend e2e.** Write `tests/e2e/journey_<name>.spec.ts`. Real seeded session (`global-setup.ts`), drive the YAML's `data-testid`s, assert oracle-anchored values, add the negative assertion where a known-wrong value exists. No `route.fulfill` of the domain under test. No `test.skip`.
> 5. **Implement.** Wire the `data-testid`s and build until the spec is green against `playwright.config.ts` (real). Set `status: passing`, `last_verified: <ts>`.
>
> **DoD:** `npm run lint` (0 errors), `npm run build`, `npm run test:contracts` green, the journey spec green against the **real** backend, no silent skips. Report WHERE it ran (real vs mocked), WHICH files, HOW MANY passed, any SKIPPED + why.

---

## Files in this folder

| File | What it is | Maps to (in `claims-monorepo`) |
|---|---|---|
| [`journeys-how-to.md`](./journeys-how-to.md) | This guide | — |
| [`journeys/journey-deck.html`](./journeys/journey-deck.html) | The deck — journey purpose + designer how-to, through 道 / Bashō / 間 / 型 / 守破離 | — |
| [`journeys/journey_map_TEMPLATE.csv`](./journeys/journey_map_TEMPLATE.csv) | **Step 1** — the designer's blank-with-example template | `docs/product/journey_map_*.csv` |
| [`journeys/examples/notice-of-loss.spec.md`](./journeys/examples/notice-of-loss.spec.md) | **Step 2** — example spec | `docs/specs/notice-of-loss.md` |
| [`journeys/examples/journey_nol_file.yml`](./journeys/examples/journey_nol_file.yml) | **Step 3** — example machine-readable contract | `docs/contracts/journey_nol_file.yml` |
| [`journeys/examples/journey_nol_file.spec.ts`](./journeys/examples/journey_nol_file.spec.ts) | **Step 5** — example real-backend e2e | `tests/e2e/journey_nol_file.spec.ts` |

**The whole pipeline, in one line:** designer fills a CSV row → PM writes a spec with oracle numbers → engineer writes the `journey_*.yml` and registers it in a DoD tier → every story references the journey id → a real-backend Playwright test proves it. The same artifact you write *before* building is the one that proves it *after*.
