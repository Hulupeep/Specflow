# Specflow Journey Verification Hooks

Claude Code hooks that enforce journey contract verification at build boundaries.

## Problem

"Build passed" does NOT mean "feature works". Common failures:
- TypeScript compiles but Playwright tests fail
- Local tests pass but production is broken
- Migration succeeds but RPCs return 400 errors
- Code committed before verifying journeys

## Solution

Hooks that trigger at BUILD BOUNDARIES:

| Trigger | When | Action |
|---------|------|--------|
| PRE-BUILD | Before `pnpm build` | Run baseline journey tests |
| POST-BUILD | After build succeeds | Run journey tests, compare to baseline |
| POST-COMMIT | After `git commit` | Wait for deploy, verify production |
| POST-MIGRATION | After `supabase db push` | Test RPCs, run E2E |

## Quick Install

```bash
# From Specflow repo
bash install-hooks.sh /path/to/your/project

# Or via curl (update YOUR_ORG)
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/install-hooks.sh | bash -s /path/to/project

# Or copy manually
cp hooks/* /path/to/project/.claude/hooks/
```

## What Gets Installed

```
your-project/
├── .claude/
│   ├── settings.json              # Hook triggers
│   └── hooks/
│       └── journey-verification.md # Hook behavior spec
└── CLAUDE.md                      # (add hook section manually)
```

## Files

| File | Purpose |
|------|---------|
| `journey-verification.md` | Detailed hook behavior spec - what Claude should do at each trigger |
| `settings.json` | Claude Code hook configuration - triggers reminders |
| `README.md` | This file |

## Key Principle

**Ticket discovery is AUTOMATIC:**
- From active tasks (TaskList)
- From wave execution context
- From recent git commits

You do NOT need to mention ticket numbers explicitly. Claude discovers context automatically.

## Example Flow

```
User: "Execute Wave 3"

Claude:
> "Starting Wave 3. Issues: #325, #326, #327
> Checking journey contracts...
> Found: J-WHATSAPP-NO-SHOW (CRITICAL)
>
> PRE-BUILD baseline: 12/20 tests passing
> Building..."

[Build succeeds]

> "POST-BUILD: 18/20 passing (+6)
> Committing..."

[Commit succeeds]

> "POST-COMMIT: Production 20/20 passing
> Wave 3 journeys verified."
```

## Requirements

Your project needs:
1. Playwright tests at `tests/e2e/journey_*.spec.ts`
2. Tickets with journey contract references (`## Journey` section)
3. CLAUDE.md with hook instructions
