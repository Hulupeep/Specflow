#!/bin/bash
# Fires at session start - reminds Claude of critical CLAUDE.md rules
# Uses exit 2 + stderr to ensure output is shown to the model
# Customize this for your project

cat >&2 <<'EOF'
══════════════════════════════════════════════════════════════
SPECFLOW ENVIRONMENT ACTIVE
══════════════════════════════════════════════════════════════

You are in a Specflow project with wave-based execution.

BEFORE ANY WORK:
1. Check GitHub issues for this repo
2. No ticket = No code. Every task needs an issue first.
3. Check for journey contracts (J-XXX) in the ticket

BEFORE CLAIMING DONE:
1. Run build and lint commands
2. Run E2E tests (relevant tests)
3. Report: WHERE tested (local/prod), WHAT tests, HOW MANY passed
4. Verify production after deploy

WAVE EXECUTION:
- Use waves-controller agent for "execute waves"
- Agents discover tickets automatically from TaskList, git, conversation
- Tests run at BUILD BOUNDARIES (pre-build, post-build, post-commit)

CONTRACTS:
- Check docs/contracts/ before modifying protected files
- Architecture, Feature, and Journey contracts are enforced
- Violations block PRs

Read CLAUDE.md for full project-specific details.
══════════════════════════════════════════════════════════════
EOF

# Exit 2 = show stderr to model
exit 2
