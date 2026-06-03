# Specflow Skills

Claude Code skills that package Specflow workflows so they trigger on natural
phrasing instead of requiring you to manually invoke an agent prompt.

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
