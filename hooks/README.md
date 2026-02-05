# Specflow Journey Verification Hooks

Claude Code hooks that enforce journey contract verification at build boundaries.

## Problem

"Build passed" does NOT mean "feature works". Common failures:
- Code compiles but E2E tests fail
- Local tests pass but production is broken
- Migration succeeds but APIs return errors
- Code committed before verifying journeys

## Solution

Hooks that trigger at BUILD BOUNDARIES:

| Trigger | When | Action |
|---------|------|--------|
| PRE-BUILD | Before build | Run baseline journey tests |
| POST-BUILD | After build succeeds | Run journey tests, compare to baseline |
| POST-COMMIT | After `git commit` | Wait for deploy, verify production |
| POST-MIGRATION | After migration | Test APIs, run E2E |

## Quick Install

```bash
# From Specflow repo
bash install-hooks.sh /path/to/your/project

# Or via curl (update YOUR_ORG to your GitHub org)
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/install-hooks.sh | bash -s /path/to/project

# Or copy manually
mkdir -p /path/to/project/.claude/hooks
cp hooks/* /path/to/project/.claude/hooks/
cp hooks/settings.json /path/to/project/.claude/settings.json
```

## What Gets Installed

```
your-project/
├── .claude/
│   ├── settings.json              # Hook triggers (generic)
│   └── hooks/
│       └── journey-verification.md # Hook behavior spec
└── CLAUDE.md                      # (add config + hook section)
```

## Configuration Required

After installing, add project-specific config to your CLAUDE.md:

```markdown
## Project Configuration

- **Package Manager:** pnpm (or npm/yarn/bun)
- **Build Command:** `pnpm build`
- **Test Command:** `pnpm test:e2e`
- **Test Directory:** `tests/e2e`
- **Production URL:** `https://www.yourapp.com`
- **Deploy Platform:** Vercel (90s wait)
- **Migration Command:** `supabase db push` (if applicable)
```

## Supported Stacks

| Stack | Build | Test | Migration |
|-------|-------|------|-----------|
| Next.js + Vercel | `npm run build` | `npm run test:e2e` | Prisma |
| Vite + Supabase | `pnpm build` | `pnpm test:e2e` | `supabase db push` |
| Rails + Heroku | `rails assets:precompile` | `rails test:system` | `rails db:migrate` |
| Django + Railway | `python manage.py collectstatic` | `pytest` | `python manage.py migrate` |
| Go + Fly.io | `go build` | `go test ./...` | `goose up` |
| SvelteKit + Cloudflare | `npm run build` | `npm run test` | Drizzle |

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
> Found: J-USER-SIGNUP (CRITICAL)
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

## Files

| File | Purpose |
|------|---------|
| `journey-verification.md` | Detailed hook behavior spec |
| `settings.json` | Claude Code hook configuration (generic patterns) |
| `README.md` | This file |

## Requirements

Your project needs:
1. E2E tests (Playwright, Cypress, etc.)
2. Tickets with journey contract references (`## Journey` section)
3. CLAUDE.md with project configuration
