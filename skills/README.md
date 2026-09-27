# Specflow Skills

Claude Code skills that package Specflow workflows so they trigger on natural
phrasing instead of requiring you to manually invoke an agent prompt.

## specflow-loop-selector

Use only after `AGENTS.md` routes work to **Full loop**, or for an explicit
request to select/run spec-build, feature-build, Gate D, or daily-use-teardown.
Ordinary ticket implementation, PRD edits, and standalone audit/simulation do
not automatically invoke this skill. Direct and Targeted Specflow work do not
need a loop run contract.

```
route work → select loop if needed → emit run_contract → advance unblocked stages
```

Use `SPECIFICATION.md` and the shared tier helper to determine depth. Thin
backlog work stays planning; for the selected build-ready slice, simulation
and audit still apply:

```
create/refine story → specflow-simulate → specflow-audit/uplift → pre-flight gate → implementation
```

Implementation can be direct for Targeted Specflow or use feature-build for
Full loop. Targeted Specflow is an agent workflow, not a runner mode.

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
