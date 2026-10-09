# Specflow Skills

Claude Code skills that package Specflow workflows so they trigger on natural
phrasing instead of requiring you to manually invoke an agent prompt.

## specflow-loop-selector

Chooses work weight before loop type: Tweak, Bug, UI feature, Schema/RPC change,
New concept/behaviour change, or Multi-slice epic. Use it for proportionate work
triage or explicit loop selection; consulting the skill does not start a loop.
The [decision table](specflow-loop-selector/SKILL.md#choose-the-work-weight)
combines risk modifiers with the checks that remain mandatory.

```
weight + risk → required parts/checks → loop only if needed → execute and verify
```

A bounded task can use individual parts without a loop run contract. Bugs need
a failing regression test; database changes retain replay/rollback/pgTAP and CI
migration-replay; new concepts require simulation and a kill check. Every required
server-state journey runs against a real seeded backend. Owner testing, flags and
mocked journeys cannot substitute for that evidence.

Weight does not replace `SPECIFICATION.md` or its shared depth policy. Formal
Specflow stories and full-loop build-ready work retain required simulation,
audit/pre-flight and readiness checks. Do not relabel work to evade a gate.

Installers copy it to `.claude/skills/`, `.codex/skills/`, and
`.agents/skills/` so Claude Code, Codex, K2.7, and generic agents can all read
the same instructions.

## specflow-audit

Audits a Specflow story/ticket and surgically uplifts it to compliance, then
runs a pre-flight gate that refuses to mark it compliant while CRITICAL/P1
findings remain. Replaces ad-hoc inline "make it compliant" edits, which skip
the gap-analysis, the section templates, and the pre-flight gate.

**Triggers on:** "make specflow compliant", "specflow audit", "uplift this
story", "run specflow auditor", "is this story compliant", or
`/specflow-audit <file-or-issue>`.

It wraps the `agents/board-auditor.md` → `agents/specflow-uplifter.md` →
`agents/pre-flight-simulator.md` flow. The skill bundles condensed copies of the
process under `references/`, so it works standalone in any repo; when the full
Specflow repo is checked out it grounds against the canonical `agents/*.md` +
`CONTRACT-SCHEMA.md` / `SPEC-FORMAT.md` / `USER-JOURNEY-CONTRACTS.md`.

### Install

User scope (available across all your projects):

```bash
cp -r skills/specflow-audit ~/.claude/skills/specflow-audit
```

Project scope (travels with one repo, shared with the team):

```bash
mkdir -p .claude/skills && cp -r skills/specflow-audit .claude/skills/specflow-audit
```

Restart Claude Code (or start a new session) to pick up the skill. Verify it
appears in the skills list, then test with: `make this story specflow compliant`.

> Future direction: package the full Specflow toolset (agents, hooks, contracts,
> skills) as a single Claude Code **plugin** so one install wires everything
> together. This `skills/` directory is the first step toward that.

## specflow-simulate

Runs a story through multiple personas and divergent routes to surface gaps and
edge cases **before** it's built, then proposes each finding as a concrete story
addition (new REQ, negative-path AC, Gherkin branch, journey step). The
high-value exploratory step right after create — distinct from the pre-flight
gate.

**Triggers on:** "simulate this story", "simulate usage end to end", "find gaps
and edges", "run personas through this", "stress-test this story", or
`/specflow-simulate <file-or-issue>`.

Position in the flow:

```
create (specflow-writer) → simulate (specflow-simulate) → audit/uplift (specflow-audit) → pre-flight gate
```

Install the same way as specflow-audit (copy to `~/.claude/skills/` or
`.claude/skills/`). `specflow init` / `specflow update` copy bundled skills into
project-local agent skill directories automatically.
