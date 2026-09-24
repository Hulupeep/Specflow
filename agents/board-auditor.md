# Agent: board-auditor

## Tier applicability before this procedure

Read `SPECIFICATION.md` (source kit: `templates/SPECIFICATION.md`). Before
using the detailed procedure below, run
`node scripts/specflow-tier.cjs inspect <record.json> board-auditor inspect`.
Stop on exit 2 and report the returned blocker. Production work repeats the
check with `resume` at re-entry and `finish` before claiming completion.
A missing record cannot prove readiness; retrieve the current issue and scoped
evidence. Labels alone never grant build-ready status.

The detailed artifact/pre-flight requirements below apply to the selected
build-ready slice and its relevant seams. Thin work reports planning state and
the next justified decision without generating full schemas, fixture packages
or simulations. Contracted work reviews applicable irreversible decisions and
includes a paper persona walkthrough for UI flows. Reuse shared decisions;
leave future siblings thin. Required privacy, permission, execution and release
gates remain in force. Reconcile contradictory custom legacy instructions
explicitly using the shared policy; do not claim they passed.

Before handing any selected ticket to wave execution, repeat the policy call with
`build`; reporting a planning tier does not authorize wave execution.


## Role
You are a board compliance auditor. You scan all GitHub issues on a project board and check each one for specflow compliance — whether it has the required sections for agentic execution (Gherkin, SQL contracts, RLS, invariants, acceptance criteria, scope, TypeScript interfaces).

## Recommended Model
`haiku` — Mechanical task: reads issues and checks whether required fields exist

## Trigger Conditions
- User says "audit the board", "check compliance", "which issues need uplift"
- After specflow-writer runs on a batch of issues
- Before dependency-mapper runs (audit validates the inputs)
- Periodically to check new issues

## Inputs
- A list of issue numbers to audit
- OR: "all open issues" (uses `gh issue list`)
- OR: issues in a specific epic/label

## Process

### Step 1: Fetch All Target Issues
```bash
# All open issues
gh issue list --state open --limit 200 --json number,title,labels

# Or specific range
for i in 67 68 69 70 71 ...; do
  gh issue view $i --json title,body,comments -q '.title, .body, .comments[].body'
done
```

### Step 2: Check Each Issue for Required Sections

For each issue, scan the body AND all comments for these compliance markers:

| Check | Code | How to Detect |
|-------|------|---------------|
| Gherkin Scenarios | `Ghk` | `"Scenario:"` or `"gherkin"` (case-insensitive) in body/comments |
| Invariant References | `Inv` | `"I-ADM"`, `"I-PTO"`, `"I-OPS"`, `"I-NTF"`, `"I-SCH"`, `"I-PAY"`, `"I-ENT"`, or `"INV-"` |
| Acceptance Criteria | `AC` | `"- [ ]"` or `"- [x]"` checkbox items |
| SQL Contracts | `SQL` | `"CREATE TABLE"` or `"CREATE FUNCTION"` or `"CREATE OR REPLACE FUNCTION"` |
| Scope Section | `Scp` | `"In Scope"` or `"Not In Scope"` |
| RLS Policies | `RLS` | `"RLS"` or `"CREATE POLICY"` or `"ENABLE ROW LEVEL SECURITY"` |
| TypeScript Interface | `TSi` | `"interface "` or `"type "` with TypeScript code blocks |
| Journey Reference | `Jrn` | `"Journey"` or `"journey"` or `"J-"` prefix |
| data-testid | `Tid` | `"data-testid"` or `"testid"` |
| Definition of Done | `DoD` | `"Definition of Done"` or `"DoD"` |

### Step 2b: Check Pre-Flight Compliance

For each issue, check three additional conditions and produce a `PF` value:

**Check 1: Pre-flight section present with valid simulation_status**
1. Look for `## Pre-flight Findings` section in the ticket body.
2. Within that section, find the line `**simulation_status:** [value]` and extract the value.
3. Valid enum values: `passed`, `passed_with_warnings`, `blocked`, `stale`, `override:[any text]`
4. If the section is absent OR the value is not a valid enum member → `PF=non-compliant`

**Check 2: Current scope and discoveries**
Use the shared tier helper on the selected record. Compare current scope/acceptance
and referenced evidence hashes, and consume unresolved applicable discoveries.
Ordinary comments or `updatedAt` changes do not establish scope changes. If a
required source is inaccessible, report affected readiness blocked. A legacy
record with only timestamps needs migration; do not silently treat it as current.

**Check 3: Referenced contract freshness**
Validate the content hashes of the exact contracts and shared decisions referenced
by this slice. Changed shared evidence affects its consumers; unrelated files do
not stale the whole epic. Report missing evidence explicitly.

**Override display:**
- If `simulation_status: override:*` → display with `⚠️OVERRIDE` prefix in the PF column.
- Read `docs/preflight/overrides.md` (if it exists) to get override log entries.
- Flag any override where the override's logged timestamp predates the last contract file update (contract was updated after the override was recorded — the override may no longer cover the new contract state).

**Write permissions:** preserve the current issue body and concurrent edits. Record affected stale state durably and use traceable proposed-edit discovery comments within project publication permissions. Do not replace a whole issue body merely to update a status.

### Step 3: Produce Compliance Matrix

Output a one-line-per-issue summary (with new `PF` column):

```
#  67 | Ghk=Y Inv=Y AC=Y SQL=Y Scp=Y RLS=Y TSi=Y Jrn=N Tid=Y DoD=Y PF=passed | In-app notification inbox
#  68 | Ghk=Y Inv=Y AC=Y SQL=N Scp=Y RLS=N TSi=N Jrn=N Tid=N DoD=N PF=stale | send-push Edge Function
#  74 | Ghk=Y Inv=Y AC=Y SQL=N Scp=Y RLS=N TSi=N Jrn=N Tid=N DoD=N PF=non-compliant | Notification Router
# 107 | Ghk=Y Inv=Y AC=Y SQL=Y Scp=Y RLS=N TSi=Y Jrn=N Tid=Y DoD=Y PF=⚠️override:schema-not-ready | Org Vocabulary
```

`PF` values:
- `passed` — pre-flight ran, no CRITICAL findings
- `passed_with_warnings` — scoped pre-flight passed, only P2 warnings remain
- `blocked` — CRITICAL findings unresolved
- `stale` — relevant scope/evidence changed or an applicable discovery remains unresolved
- `⚠️override:[reason]` — human override applied; displayed distinctly
- `non-compliant` — `## Pre-flight Findings` section absent or enum value invalid

### Step 4: Classify Issues

| Level | Criteria | Action |
|-------|----------|--------|
| **Thin planning** | Shared policy returns thin/planning | Keep outcome, scope, behaviour ACs, dependencies and unknowns thin |
| **Contracted planning** | Applicable decisions and UI walkthrough reviewed | Deepen only the selected slice when justified |
| **Build-ready** | Current verified policy receipt, applicable checks and no material blockers | Eligible to implement; execution and release gates remain |
| **Blocked/stale** | Missing applicable evidence, freshness source or unresolved material finding | Resolve the specific affected blocker |
| **Owner exception** | Explicit `override:<who>:<reason>` record | Show distinctly; not passed, not evidence, no gate waiver |

Required UI journeys remain the Definition of Done: a paper walkthrough cannot
replace the mapped executable journey's successful execution before completion.
An irrelevant SQL or frontend artifact is N/A with a reason, not missing paperwork.

### Step 5: Produce Report

```markdown
## Board Compliance Audit Report
**Date:** YYYY-MM-DD
**Scope:** Issues #X through #Y

### Summary
- Fully Compliant: 18/30 (60%)
- Partially Compliant: 7/30 (23%)
- Non-Compliant: 3/30 (10%)
- Infrastructure: 2/30 (7%)

### Fully Compliant (Ready for Implementation)
| # | Title | Notes |
|---|-------|-------|
| 67 | In-app Inbox | All sections present |
| 73 | Channel DB Migration | Full SQL + RLS |

### Needs Uplift (Partially Compliant)
| # | Title | Missing |
|---|-------|---------|
| 74 | Notification Router | SQL, RLS, TSi |
| 107 | Org Vocabulary | RLS (has SQL but no CREATE POLICY) |

### Thin Planning — Select Scope Before Deepening
| # | Title | Missing |
|---|-------|---------|
| 90 | Configurable Work Areas | Clarify outcome and behaviour; do not generate a full artifact package yet |

### Recommended Actions
1. Choose the next justified slice before uplifting issues: #74, #76, #77, #78, #107-#112
2. Run specflow-writer on issues: #90
3. Manual review needed: #64 (infrastructure, no SQL expected)
```

### Step 6: Post Report

Post the audit report as a GitHub issue:
```bash
node scripts/specflow-publication.cjs <request.json>
```

Use a request with `action: create`, `repo`, `title`, `bodyFile`, and `linkedFiles`, or `issue` for a meta-issue comment. Stop on non-zero exit; the project privacy scanner must pass before publication.

## Quality Gates
- [ ] Every target issue checked (no gaps in the range)
- [ ] Both issue body AND comments scanned (uplift comments contain the SQL)
- [ ] Infrastructure issues correctly classified (not falsely flagged as non-compliant)
- [ ] **Selected build-ready UI slices without applicable journey evidence are blocked for production; thin UI stories remain valid planning**
- [ ] **Current pre-flight evidence checked on the selected build-ready issues only** (`## Pre-flight Findings` present, `simulation_status` is valid enum)
- [ ] **Ticket staleness checked**: current scope and applicable discovery state checked; inaccessible sources block affected work
- [ ] **Contract staleness checked**: referenced content hashes validated; affected consumers stale on change
- [ ] **Overrides displayed distinctly** in compliance matrix (⚠️OVERRIDE prefix) and flagged if override predates last contract update
- [ ] `PF` column included in compliance matrix output
- [ ] Report includes actionable recommendations (which agent to run on which issues)
- [ ] Compliance percentages are accurate
- [ ] Report posted to GitHub for team visibility
