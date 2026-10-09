---
name: specflow-audit
description: Audits a Specflow story/ticket for spec-compliance and surgically uplifts it — adding only the missing executable contract sections (SQL/RLS, TypeScript interfaces, invariant codes, Gherkin, acceptance criteria, Definition of Done, data-testid coverage) — then runs a pre-flight gate that refuses to mark the ticket compliant while CRITICAL or P1 findings remain. This skill should be used when the user asks to "make specflow compliant", "specflow audit", "uplift this story", "run specflow auditor", "is this story compliant", or invokes /specflow-audit on a story file or GitHub issue. It is the reliable replacement for ad-hoc inline "make it compliant" edits, which skip the gap-analysis, the section templates, and the pre-flight gate. Scope is strictly Specflow story/contract work — do NOT trigger on generic "make this code/PR compliant" requests unrelated to Specflow specs.
---

# Specflow Audit & Uplift

## Tier applicability before this procedure

Read `SPECIFICATION.md` (source kit: `templates/SPECIFICATION.md`). Before
using the detailed procedure below, run
`node scripts/specflow-tier.cjs inspect <record.json> specflow-audit inspect`.
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


Take a partially-compliant Specflow story (some sections present, others missing) and bring it to compliance through a fixed three-phase process. The quality comes from the *process*, not improvisation — never freelance the uplift inline.

## When to run

Trigger on: "make specflow compliant", "specflow audit", "uplift this story / ticket", "run specflow auditor", "is this story compliant", or `/specflow-audit <file-or-issue>`.

Do NOT trigger on generic "make this PR/code compliant" that has nothing to do with Specflow specs.

The target is a **story/ticket** — a GitHub issue body, a `docs/specs/*.md` file, or pasted spec text. Not source code.

## The non-negotiable process

Run these three phases in order. Do not skip phase 3.

### Phase 1 — Gap analysis (board-auditor)
Read the target and diff it against the full Specflow template. Produce an explicit list of which sections are PRESENT and which are MISSING. The template sections are in `references/uplift-process.md`. Identify the ticket type (feature / bug / journey) — bug tickets legitimately N/A some sections; record the justification.

### Phase 2 — Surgical uplift (specflow-uplifter)
Add **only the missing sections** — never rewrite or duplicate existing content. Generate *executable* artifacts, not prose:
- Data Contract: copy-pasteable `CREATE TABLE` / `CREATE FUNCTION` / RLS `CREATE POLICY` (use the join-through RLS pattern for tables without a direct org/owner column).
- Frontend Interface: typed TypeScript hook/interface signatures matching project conventions.
- Invariants Referenced: `I-<DOMAIN>-NNN` codes; reuse existing codes, take the next free number for new ones — never invent a code that already exists.
- Gherkin Scenarios, Acceptance Criteria (behaviour-only checkboxes, including negative paths), Definition of Done, and `data-testid` coverage.

Section templates and the RLS/invariant patterns are in `references/uplift-process.md`. Post the additions as one clearly-labelled uplift comment (GitHub) or appended block (file) — supplementing, not replacing.

### Phase 3 — Pre-flight gate (HARD STOP)
After uplift, simulate the combined ticket and assign findings a severity: CRITICAL / P1 / P2. The severity model and the `## Pre-flight Findings` section format are in `references/preflight-gate.md`.

**The gate:** a ticket is compliant ONLY when pre-flight returns no CRITICAL and no P1.
- CRITICAL or P1 remain → surface them, do NOT write a passing status, leave the ticket non-compliant.
- Clean or P2-only → write the `## Pre-flight Findings` section with the appropriate `simulation_status` and mark compliant.

Uplift does not grandfather prior failures. The auditor (this skill) never *declares* compliance on its own — pre-flight findings decide it.

## Journey = Definition of Done (for any UI story)

For a UI story, the **executable Playwright journey IS the Definition of Done** — not a side artifact. A story is not done because the code exists; it is done when a journey walks the user's steps and asserts the intended outcome was reached.

A compliant UI journey must have:
1. **Ordered, explicit steps** — the literal click/type/navigate sequence a real user takes, each step named.
2. **Success criteria** — what observable state proves each step (and the journey overall) succeeded, asserted via `data-testid` / visible text / URL.
3. **A runnable Playwright spec** mapped to the story's `J-<NAME>` id, encoding those steps and assertions.
4. **Evidence it actually ran** — a pass result, OR an explicit "varied because of decision X" note explaining where the real flow legitimately diverged from the written steps and why that still satisfies intent. "Written but never executed" does not count as done.

The audit therefore treats, for a UI story, as **CRITICAL** (blocks compliance):
- no journey steps + success criteria in the story, or
- no Playwright spec mapped to the `J-id`, or
- a journey that has never been executed (no pass / no varied-with-reason record), or a deferral with no tracking issue.

This is the single most common real-world failure ("journeys missing or not executed"); the gate exists to stop it.

## How to execute

1. Read the target (issue via `gh issue view <n> --json title,body,comments`, or the file).
2. Ground against the canonical Specflow docs when present in the repo — full versions live at `<specflow-repo>/agents/{board-auditor,specflow-uplifter,pre-flight-simulator,specflow-writer}.md` and `CONTRACT-SCHEMA.md`, `SPEC-FORMAT.md`, `USER-JOURNEY-CONTRACTS.md`. Find the repo: it is the dir containing `CONTRACT-SCHEMA.md` (commonly `tooling/Specflow/` or a `Specflow/` subdir). If absent, the condensed `references/` files here are sufficient.
3. Run Phase 1 → 2 → 3. For large stories, delegate Phase 1+2 to a subagent prompted with `references/uplift-process.md`, but always perform Phase 3 yourself.
4. Cross-link material verdicts to the durable record (a `node scripts/specflow-publication.cjs <request.json>`), not just chat.

## Reference files
- `references/uplift-process.md` — template sections, the surgical-additions templates (SQL/RLS/TS/invariants/Gherkin/AC/DoD/testid), and the RLS join-through + invariant-domain patterns.
- `references/preflight-gate.md` — CRITICAL/P1/P2 severity model, the compliance gate rule, and the `## Pre-flight Findings` section format.

Scoped grading uses the shared `specflow-reviews.cjs` issue/tier ledger through Duo preparation (`specification.targetTier`). The contracted adversary and build-ready pre-flight each allow an initial review plus one repair/re-grade. Never bypass it with a fresh adapter, different host, run name, or direct simulation. Return `fixed as specified, not re-graded` after changing an already graded scope until a permitted re-grade passes. Exhaustion escalates retained findings.

Publication: save the sanitized proposed comment in `bodyFile`, then write a request JSON with `repo`, `issue`, `bodyFile`, and all `linkedFiles`. Run `node scripts/specflow-publication.cjs <request.json>` and stop on non-zero exit. It requires the project mechanical scanner and private-baseline canary where applicable. Never publish private sources or raw provider records. Preserve concurrent issue-body edits: publish proposals instead of replacing a fetched body.
