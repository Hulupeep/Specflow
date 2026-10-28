# PRD: Pre-Flight Simulator — SpecFlow

**Feature:** Pre-Flight Simulation Gate
**Author:** Colm Byrne / Flout Labs
**Status:** Ready for implementation — reviewed and clarified 2026-02-19
**Target:** SpecFlow agent library + SPEC-FORMAT extension

---

## Problem Statement

SpecFlow catches drift after build. Contract tests, journey gates, and the heal-loop are all post-build mechanisms. A broken spec produces a broken wave, and the wave only fails after compute has been spent, agents have fired, code has been written, and tests have run.

The cost of a broken spec is discovered at the wrong end of the pipeline.

The pre-flight simulator moves the catch point to the earliest possible moment: before a ticket is accepted as specflow-compliant, and before a wave fires a single agent.

---

## The Gap in the Current Pipeline

Current pipeline:

```
specflow-writer → contract-validator → dependency-mapper → sprint-executor → test-runner → heal-loop
```

Problems discovered in heal-loop or test-runner cost a full build cycle to surface.
Problems discovered in pre-flight cost nothing — no code was written.

New pipeline:

```
specflow-writer/uplifter → [PRE-FLIGHT: single ticket] → contract-validator → dependency-mapper → [PRE-FLIGHT: wave] → sprint-executor → test-runner → heal-loop
```

---

## Trigger Definition

"Write this as a specflow ticket" and "update/edit this ticket as a specflow ticket" both do exactly two things, in order:

1. **Format** — Produce or update a fully specflow-compliant ticket: Gherkin scenarios, contract IDs, journey contract reference, data-testid attributes, full spec structure per SPEC-FORMAT.md
2. **Simulate** — Run pre-flight automatically on the resulting ticket before marking it compliant

Neither step is optional. A ticket is not specflow-compliant until both have completed cleanly.

---

## ARCHITECTURE

### ARCH-001 (MUST)
The pre-flight simulator MUST be a read-only agent. It reads contracts, schemas, and ticket content. It writes only to a `## Pre-flight Findings` section on the ticket/spec. It does NOT modify any source file, contract YAML, or migration. Ever.

### ARCH-002 (MUST)
Simulation MUST run in two distinct scopes:
- **Ticket scope** — triggered on single ticket creation OR any edit/update to an existing ticket
- **Wave scope** — triggered by waves-controller between dependency-mapper and sprint-executor

These are separate invocations with different lenses. Wave scope has access to all tickets in the wave simultaneously and MUST detect cross-ticket failures that single-ticket simulation cannot see.

### ARCH-003 (MUST)
Severity MUST map to pipeline behaviour as follows:

| Severity | Definition | Pipeline Effect |
|----------|-----------|-----------------|
| CRITICAL | Will break the build or produce wrong system state | Blocks wave execution. Human must resolve. |
| P1 | Wrong, incomplete, or contradicts existing contract | Surfaces as warning. Wave can proceed with explicit override. |
| P2 | Product correctness issues, missing edge handling | Logged silently to `docs/preflight/` for async review. |

### ARCH-004 (MUST)
Pre-flight findings MUST be written to a `## Pre-flight Findings` section in the ticket body. This section is machine-readable and parsed by waves-controller to determine gate status.

### ARCH-005 (MUST)
Pre-flight MUST load and read all files in `docs/contracts/*.yml` before running any simulation pass. Schema reality checks MUST be grounded in actual contract definitions, not assumptions.

### ARCH-006 (MUST)
`simulation_status` is an enum field. Valid values: `passed`, `passed_with_warnings`, `blocked`, `stale`, `override:[reason]`. It MUST NOT be free text. waves-controller parses this field directly — any value outside the enum is treated as `blocked`.

### ARCH-007 (MUST)
Staleness MUST be detected automatically. If `ticket.updated_at > preflight.simulated_at`, the `simulation_status` MUST be set to `stale` regardless of its previous value. `stale` is treated as `blocked` by waves-controller. No wave fires on a stale pre-flight.

**Staleness extraction mechanism — explicit implementation requirement:**

Three data sources must be read and compared. Any ambiguity here causes inconsistent implementation across agents:

1. **`simulated_at`** — parsed from the `## Pre-flight Findings` section of the ticket body. Line format is exactly: `**simulated_at:** 2026-02-19T14:32:00Z`. Parsing must find this line and extract the ISO timestamp value. If the line is absent, the ticket has no pre-flight and is treated as `blocked`.

2. **`ticket.updated_at`** — fetched from GitHub API via: `gh issue view [N] --json updatedAt -q '.updatedAt'`. This is the authoritative source for ticket modification time. Do not use file system timestamps or git log for this.

3. **`contract_file.mtime`** — fetched via filesystem: `stat -c %Y docs/contracts/[file].yml` (Linux) or `stat -f %m docs/contracts/[file].yml` (macOS). Convert to ISO timestamp for comparison. board-auditor must check mtime for every contract file referenced by contract IDs found in the ticket body.

If any of source 2 or 3 is newer than source 1: `simulation_status` → `stale`.

### ARCH-008 (MUST)
Contract staleness MUST also be detected. If any `docs/contracts/*.yml` file has `updated_at > preflight.simulated_at` for a ticket checked against that contract, board-auditor MUST flag the ticket pre-flight as `stale`. A contract update can invalidate a previously passing simulation.

See ARCH-007 for the explicit extraction mechanism.

---

## REQS

### SIM-001 (MUST)
When a user issues any of the following, specflow-writer MUST invoke pre-flight simulation on the resulting ticket before marking it specflow-compliant:
- "write this as a specflow ticket"
- "update this ticket as a specflow ticket"
- "edit this ticket as a specflow ticket"
- "make this ticket specflow-compliant"
- Any instruction that results in specflow-writer creating or modifying a ticket body

A ticket without a passing or acknowledged pre-flight section is NOT compliant.

### SIM-002 (MUST)
waves-controller MUST invoke pre-flight-simulator between dependency-mapper and sprint-executor. If pre-flight returns any CRITICAL findings, the wave MUST NOT fire sprint-executor until findings are resolved or explicitly overridden.

### SIM-003 (MUST)
When specflow-uplifter modifies a ticket, it MUST trigger pre-flight re-simulation on the modified ticket after uplift completes. The uplifter does not mark a ticket compliant — pre-flight makes that determination.

### SIM-004 (MUST)
When any ticket in a wave is edited after wave-scope pre-flight has run, the entire wave-scope pre-flight MUST re-run before sprint-executor fires. Partial re-simulation of a single ticket is not sufficient because cross-ticket analysis may surface new conflicts introduced by the edit.

> **Known optimisation debt:** For waves with 15+ tickets, full re-simulation on a single edit is expensive. A future optimisation could re-run only cross-ticket lenses (2, 6) on unedited tickets and full lenses on the edited ticket. Not in scope for v1 — implement as specified.

### SIM-005 (MUST)
Pre-flight simulation MUST run the following lenses in sequence:

**Lens 1: DEPENDENCY ORDER**
What must exist before what? Are all upstream dependencies present in the wave or in the existing schema? Flag any ticket referencing a resource not yet created.

**Lens 2: SHARED STATE**
What data, tables, services, or API endpoints do multiple tickets in this wave touch? Where could concurrent writes or mode switches conflict? Flag any global state that should be per-run or per-user scoped.

**Lens 3: SCHEMA REALITY CHECK**
Load `docs/contracts/*.yml` and all referenced table schemas. For every query, field reference, or API call in the tickets: does it exist? Flag any field, column, endpoint, or contract ID referenced that is not defined.

**Lens 4: TIMING AND INTERVAL ASSUMPTIONS**
Are any polling intervals, timeouts, SLA thresholds, or sequences assumed? Do they match actual system intervals defined in contracts or code? Flag any mismatch.

**Lens 5: PARTIAL FAILURE STATES**
Step N succeeds, step N+1 fails. What is the state of the system? Are there orphaned records, dangling hooks, or incomplete state transitions? Flag any missing rollback, cleanup, or idempotency requirement.

**Lens 6: CONCURRENT USER SCENARIOS** (Wave scope only)
Two users execute this flow simultaneously. What breaks? Are there race conditions, missing locks, or global state not isolated per-session? Flag any resource that should be per-user or per-run scoped but is not.

### SIM-006 (MUST)
Simulation output MUST include Lens attribution for every finding. The implementing agent, the user, and the audit log must all know which lens caught which issue.

### SIM-007 (MUST)
A ticket MUST NOT be accepted as specflow-compliant if it has unresolved CRITICAL findings. specflow-writer MUST surface CRITICAL findings to the user inline and request resolution before finalising.

### SIM-008 (MUST)
waves-controller MUST parse the `simulation_status` enum field directly before firing sprint-executor. No interpretation. No regex.

### SIM-009 (MUST)
All P2 findings MUST be written to `docs/preflight/[ticket-id]-[timestamp].md` for async review.

### SIM-010 (MUST)
Override mechanics MUST be explicit and audited:
- User invokes with: `override_preflight: [ticket-id] reason: [reason text]`
- `simulation_status` is set to `override:[reason]`
- Override is logged to `docs/preflight/overrides.md` with ticket-id, reason, timestamp, and user
- board-auditor MUST display overridden tickets distinctly from passing tickets
- board-auditor SHOULD flag overrides older than the last contract update as potentially stale

### SIM-011 (SHOULD)
When a CRITICAL finding is raised, pre-flight SHOULD propose a resolution. Non-binding.

### ~~SIM-012~~ — DEFERRED
`confidence_score` deferred to a future spec. The scoring formula was not defined here and a half-specified feature is worse than no feature. Do not implement in v1. When the scoring criteria are defined, a new SIM-012 will be issued.

### SIM-013 (MUST NOT)
Pre-flight MUST NOT auto-fix tickets. It finds and surfaces. heal-loop fixes built code. Pre-flight audits unbuilt specs. These are different jobs.

---

## Agent Input Format

Pre-flight-simulator accepts the following input. The implementing agent MUST NOT guess at input structure.

**Ticket scope:**
```json
{
  "scope": "ticket",
  "ticket": {
    "id": "string",
    "body": "string (full markdown ticket body)",
    "updated_at": "ISO timestamp"
  },
  "contracts_dir": "docs/contracts/",
  "schema_files": ["path/to/schema1.sql", "path/to/schema2.ts"]
}
```

**Wave scope:**
```json
{
  "scope": "wave",
  "wave_number": "integer",
  "tickets": [
    {
      "id": "string",
      "body": "string (full markdown ticket body)",
      "updated_at": "ISO timestamp"
    }
  ],
  "contracts_dir": "docs/contracts/",
  "schema_files": ["path/to/schema1.sql", "path/to/schema2.ts"]
}
```

The agent reads all files in `contracts_dir` before running any lens.

---

## JOURNEYS

### J-PREFLIGHT-TICKET-WRITE
**Trigger:** User says "write this as a specflow ticket"
1. specflow-writer generates full specflow-compliant ticket draft (format)
2. Pre-flight runs automatically — Lenses 1-5 (simulate)
3. CRITICAL: surface inline, do not finalise, request resolution
4. P1: surface as warnings, user confirms or adjusts
5. P2 or clean: ticket finalised, pre-flight section appended, marked compliant

---

### J-PREFLIGHT-TICKET-EDIT
**Trigger:** User says "update/edit this ticket" or any instruction modifying an existing specflow ticket
1. specflow-writer applies changes (format)
2. `updated_at` updated on ticket
3. Pre-flight re-runs automatically — Lenses 1-5 (simulate)
4. Previous `simulation_status` discarded and replaced with new result
5. If previously `passed` and now CRITICAL: compliance reverts to blocked, user notified
6. If clean: ticket re-marked compliant with new `simulated_at`

**Critical behaviour:** An edit that produces new CRITICAL findings MUST revert compliance status even if the ticket was previously passing. No grandfather clause.

---

### J-PREFLIGHT-UPLIFT
**Trigger:** specflow-uplifter modifies a non-compliant ticket
1. specflow-uplifter applies structural fixes
2. Pre-flight runs on the uplifted ticket
3. Findings remain: uplifter surfaces them, does not mark compliant
4. Clean: ticket marked compliant with pre-flight section appended

---

### J-PREFLIGHT-WAVE-GATE
**Trigger:** waves-controller completes dependency-mapper
1. All wave tickets passed to pre-flight as a batch
2. Lenses 1-6 run across full wave (cross-ticket analysis)
3. Findings written to each ticket's `## Pre-flight Findings` section
4. waves-controller reads `simulation_status` from each ticket
5. Any `blocked` or `stale`: wave pauses, user notified with finding summary
6. All `passed`, `passed_with_warnings`, or `override:*`: sprint-executor fires

---

### J-PREFLIGHT-STALE-DETECTION
**Trigger:** board-auditor runs compliance audit
1. board-auditor reads `simulated_at` from each ticket's pre-flight section
2. Compares against `ticket.updated_at` and `contract_file.updated_at` for each referenced contract
3. Either newer than `simulated_at`: sets `simulation_status` to `stale`
4. Flags stale tickets as non-compliant in audit report
5. User must re-run pre-flight before ticket can enter a wave

---

## Deliverables

> **Note:** Deliverable 2 (spec doc conversion) was removed. This PRD at `docs/preflightprd.md` IS the spec. Copying it to `docs/specs/` would be bureaucratic duplication. The ARCH-*, SIM-*, and J-* IDs here serve as the canonical spec IDs.

### 1. `agents/pre-flight-simulator.md`
Stateless, read-only agent. Accepts the defined JSON input. Runs all lenses. Returns structured findings. Follows SpecFlow agent conventions from `agents/README.md`.

### 2. `docs/contracts/feature_preflight.yml`
**Important:** This is NOT a source-code pattern-scanning contract. The existing `templates/contracts/*.yml` files enforce regex patterns against source code files. `feature_preflight.yml` is different: it is a board-auditor rule set that defines required fields in GitHub ticket bodies.

It serves as the compliance checklist for board-auditor, not a build-time pattern scanner. board-auditor reads this contract to know what to check in issue bodies.

Enforces: `simulation_status` field present, `simulated_at` timestamp present, enum value valid. No wave fires without gate passing. board-auditor is the enforcement mechanism, not the pattern-scanning test runner.

### 3. SPEC-FORMAT.md update
Add `## Pre-flight Findings` as a required section immediately after `## Journey Contract`:

```markdown
## Pre-flight Findings

**simulation_status:** [passed | passed_with_warnings | blocked | stale | override:reason]
**simulated_at:** [ISO timestamp]
**scope:** [ticket | wave]

### CRITICAL
<!-- Empty if none -->

### P1
<!-- Empty if none -->

### P2
<!-- Logged to docs/preflight/[ticket-id]-[timestamp].md -->
```

> Note: `confidence_score` is NOT in the v1 section format. It was deferred (see ~~SIM-012~~ above).

### 4. waves-controller update
Insert pre-flight between dependency-mapper and sprint-executor. Parse `simulation_status` enum. Block on `blocked` or `stale`. Treat any non-enum value as `blocked`.

### 5. specflow-writer update
After generating OR editing a ticket: auto-invoke pre-flight. Do not finalise on CRITICAL. Surface P1s for confirmation. Format-then-simulate applies to every write AND edit trigger phrase.

### 6. specflow-uplifter update
Post-uplift: invoke pre-flight on modified ticket before marking compliant.

### 7. board-auditor update
Add three compliance checks:
- Pre-flight section present with valid `simulation_status` enum value
- Ticket staleness: `ticket.updated_at > simulated_at` (use ARCH-007 extraction mechanism)
- Contract staleness: referenced `docs/contracts/*.yml` `mtime > simulated_at` (use ARCH-007 extraction mechanism)
- Override audit: display distinctly, flag overrides older than last contract update

### 8. SKILL.md update
Add pre-flight simulation to the portable Specflow skill description. Include pipeline position, trigger phrases, and `simulation_status` enum. Lowest priority — implement last after all agents are updated.

---

## Output Format (Machine-Readable)

```
PRE-FLIGHT SIMULATION REPORT
=============================
Scope: [ticket | wave]
Tickets analysed: [N]
Simulated at: [ISO timestamp]

CRITICAL (blocks execution)
----------------------------
[PREF-C001]: [Finding title]
Ticket: [ticket-id]
Lens: [DEPENDENCY ORDER | SHARED STATE | SCHEMA REALITY CHECK | TIMING | PARTIAL FAILURE | CONCURRENT USERS]
Detail: [Full description]
Proposed resolution: [Non-binding]

P1 (warning — wave can proceed with override)
----------------------------------------------
[PREF-W001]: [Finding title]
...

P2 (logged to docs/preflight/ — does not block)
-------------------------------------------------
[PREF-P001]: [Finding title]
...

SUMMARY
-------
simulation_status: [passed | passed_with_warnings | blocked]
Block reason: [If blocked — one-line summary for waves-controller]
```

---

## What Pre-Flight Does NOT Do

- Does NOT modify source files, contract YAMLs, or migrations
- Does NOT run tests or Playwright
- Does NOT fix tickets (that is heal-loop's job on built code)
- Does NOT call external APIs
- Does NOT mark a ticket compliant — it returns findings, specflow-writer applies the status
- Does NOT make judgements about business logic — only structural, schema, and dependency correctness

---

## Acceptance Criteria

1. "write this as a specflow ticket" and all edit/update trigger phrases both invoke format-then-simulate, in that order, every time
2. A ticket with unresolved CRITICAL findings cannot be marked specflow-compliant
3. waves-controller pauses on CRITICAL or stale pre-flights before sprint-executor fires
4. Editing a previously passing ticket re-triggers pre-flight and can revert compliance status — no grandfather clause
5. specflow-uplifter triggers pre-flight re-simulation post-uplift
6. When any ticket in a wave is edited post wave-scope simulation, the entire wave re-simulates
7. `simulation_status` is a parsed enum — no regex, no interpretation, non-enum value treated as `blocked`
8. `stale` set automatically when `ticket.updated_at > simulated_at`
9. `stale` set when a referenced contract file is newer than `simulated_at`
10. Overrides logged to `docs/preflight/overrides.md`, displayed distinctly in board-auditor
11. All findings include Lens attribution
12. P2 findings written to `docs/preflight/` without blocking anything
13. board-auditor catches: missing pre-flight section, ticket staleness, contract staleness, unresolved CRITICALs
14. The Incident Lab scenario (8 tickets, 4 CRITICALs, 4 P1s, 3 P2s) is caught by pre-flight before a single line of code is written

---

## Implementation Sequence

Build in this order to avoid circular dependencies:

1. `agents/pre-flight-simulator.md` — core agent, read-only, stateless (SPEC-002)
2. `docs/contracts/feature_preflight.yml` — board-auditor rule set (NOT source-code pattern scanner) (SPEC-003)
3. SPEC-FORMAT.md update — add `## Pre-flight Findings` section definition, no confidence_score (SPEC-004)
4. specflow-writer update — format-then-simulate for ALL write and edit triggers (SPEC-005)
5. specflow-uplifter update — post-uplift simulation trigger (SPEC-006)
6. waves-controller update — wave-scope pre-flight between dependency-mapper and sprint-executor (SPEC-007)
7. board-auditor update — staleness and compliance checks with explicit extraction mechanism from ARCH-007 (SPEC-008)
8. SKILL.md update — add pre-flight to portable skill description (SPEC-009)

Read before writing any code:
`agents/waves-controller.md`, `agents/specflow-writer.md`, `agents/specflow-uplifter.md`, `agents/board-auditor.md`, `SPEC-FORMAT.md`, `docs/contracts/*.yml`, `agents/README.md`

---

## V1 Constraints and Known Limitations

**SIM-004 cut from v1.** Automatic wave re-simulation on ticket edit is removed. Wave simulation runs once; if you edit a ticket after it passes, re-run pre-flight manually. The detection mechanism for edit events is unreliable (GitHub `updated_at` advances on comments, not just body edits), and automating what you can't reliably detect produces false triggers. Revisit in v2.

**Timestamp format pinned.** `simulated_at` MUST be written in RFC 3339 UTC: `2026-02-19T14:32:00Z`. No other ISO 8601 variant. GitHub's `updatedAt` field is also RFC 3339 UTC — the comparison only works if formats match.

**GitHub write mechanism.** Ticket body writes use `gh issue edit [N] --body "[full updated body]"`. This replaces the entire body. Race condition is known: two agents editing the same ticket simultaneously will clobber one write. Accepted risk for v1; mitigate by not parallelising writes to the same ticket.

**Write permissions by agent.** Only three agents touch ticket bodies:
- `pre-flight-simulator` — read-only, never writes
- `specflow-writer` — writes the full `## Pre-flight Findings` section after simulation
- `board-auditor` — writes only `simulation_status: stale` when staleness is detected

**feature_preflight.yml schema test.** Add a schema validation test to `tests/schema/` that confirms `feature_preflight.yml` is valid YAML and contains the required fields. One test, no regex scanning.

**Gap 6 is a prompt engineering problem, not a spec problem.** The proof-of-work requirement (list every contract file loaded before running Lens 1) belongs inside `agents/pre-flight-simulator.md`, not here. The implementing agent must include it.

---

*Hand this document to Claude Code with the SpecFlow agent library and say:*
*"Read docs/preflightprd.md and implement the pre-flight simulator feature across the SpecFlow agent library. Follow the implementation sequence at the bottom of the PRD."*
