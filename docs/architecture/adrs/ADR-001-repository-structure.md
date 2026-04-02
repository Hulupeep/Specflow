# ADR-001: Repository Structure

**Status:** Proposed
**Date:** 2026-04-02
**Phase:** 1

## Context

The Specflow repository root contains 20+ files: 13 markdown documents, 4 bash scripts, plus package.json, jest.config, and LICENSE. It also contains directories that don't belong in a framework package: `sample apps/` (3 full applications with their own node_modules), `supabase/` (a Stripe webhook), `context/` (meta-prompts), and `ruflo/` (empty dev tooling artifact).

This makes the repo hard to navigate, inflates the npm package, and confuses the boundary between "Specflow the framework" and "projects that use Specflow."

## Decision

### Remove from repository

| Directory | Reason | Action |
|-----------|--------|--------|
| `sample apps/` | 3 full apps (AISP-Specflow, mindsplit, queuecraft) with node_modules | Archive to `specflow-examples` repo or archive branch |
| `supabase/` | Project-specific Stripe webhook, not framework code | Delete |
| `ruflo/` | Empty dir from dev tooling setup | Delete |
| `context/` | 5 meta-prompt docs | Merge useful content into `docs/guides/`, delete directory |

### Move to `docs/`

Create two subdirectories:

**`docs/guides/`** — adoption and workflow guides:
- QUICKSTART.md
- MID-PROJECT-ADOPTION.md
- PUSH-TO-GITHUB.md
- PROMPT-TEMPLATE.md
- SPEC-FORMAT.md
- USER-JOURNEY-CONTRACTS.md
- README_FRONTIER.md
- FRONTIER_IMPROVEMENTS.md

**`docs/reference/`** — technical reference:
- CONTRACT-SCHEMA.md
- CONTRACT-SCHEMA-EXTENSIONS.md
- CONTRACTS-README.md
- LLM-MASTER-PROMPT.md

### Keep in root

Only files that tools, CI, or npm expect in root:
- `README.md` — project overview
- `CLAUDE.md` — Claude Code instructions
- `SKILL.md` — portable single-file Specflow spec
- `CLAUDE-MD-TEMPLATE.md` — template for target projects
- `CI-INTEGRATION.md` — CI setup guide
- `LICENSE` — MIT license
- `package.json`, `package-lock.json`
- `jest.config.js`

### Move bash scripts to `scripts/legacy/`

- `setup-project.sh` → `scripts/legacy/setup-project.sh`
- `install-hooks.sh` → `scripts/legacy/install-hooks.sh`
- `verify-setup.sh` → `scripts/legacy/verify-setup.sh`
- `extract-to-project.sh` → `scripts/legacy/extract-to-project.sh`

These are kept as reference implementations while Node.js replacements are built. They will be removed from the `files` array in package.json so they don't ship in the npm package.

### Add `src/` for new Node.js source

```
src/
├── cli.js
├── commands/
├── hooks/
├── contracts/
├── mcp/
├── agents/
└── utils/
```

### Final root structure

```
specflow/
├── README.md
├── CLAUDE.md
├── SKILL.md
├── CLAUDE-MD-TEMPLATE.md
├── CI-INTEGRATION.md
├── LICENSE
├── package.json
├── jest.config.js
├── bin/specflow.js
├── src/                  # New Node.js source
├── agents/               # 32 agent prompt files
├── hooks/                # Hook templates
├── templates/            # Default contracts, CI, journeys
├── scripts/              # Compiler, graph validator, legacy/
├── docs/                 # Guides + reference + contracts
├── docs-2/               # Planning docs (not shipped)
├── demo/                 # Working demo
├── examples/             # Reference files
└── tests/                # Test suites
```

## Consequences

### Positive
- Root directory drops from 20+ items to ~10
- npm package shrinks significantly (no sample apps)
- Clear separation: framework code vs documentation vs planning
- New contributors can orient quickly

### Negative
- Links to moved files break (GitHub redirects handle most)
- Sample app users need to find the new repo/branch
- Git history for moved files requires `git log --follow`

### Risks
- Any external documentation linking to root markdown files will break
- Mitigation: add redirect notes in moved files during transition
