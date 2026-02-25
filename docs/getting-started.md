# Getting Started with Specflow

Three paths depending on how you work. Pick one — they all lead to the same place.

[← Back to README](../README.md)

---

## Which Path Is Right for You?

| I want to... | Use |
|---|---|
| Let Claude handle everything automatically | [Path A: One Prompt Setup](#path-a-one-prompt-setup-recommended) |
| Drop in a single file for instant enforcement | [Path B: SKILL.md (Single File)](#path-b-skillmd-single-file) |
| Set up manually with full control | [Path C: Manual Setup](#path-c-manual-setup) |

---

## Path A: One Prompt Setup (Recommended)

**Best for:** Teams using Claude Code who want the full agent pipeline.

### Step 1: Add Specflow to your project

```bash
cp -r Specflow/ your-project/docs/Specflow/
# or
git clone https://github.com/Hulupeep/Specflow.git your-project/docs/Specflow
```

### Step 2: Tell Claude Code

```
Read Specflow/README.md and set up my project with Specflow agents including updating
my CLAUDE.md to run the right agents at the right time. Use the claude template
CLAUDE-MD-TEMPLATE.md in specflow to update the claude.md.
Then make my issues compliant and execute my backlog in waves.
```

Claude Code will:
1. Copy agents to `scripts/agents/`
2. Update your CLAUDE.md with enforcement rules
3. Make your GitHub issues specflow-compliant (Gherkin, contracts, data-testid)
4. Build dependency waves from your tickets
5. Execute your backlog in parallel
6. Run tests and close validated tickets

**One prompt. Full pipeline.**

---

## Path B: SKILL.md (Single File)

**Best for:** Quick adoption without the full agent library.

```bash
cp Specflow/SKILL.md your-project/
```

Then in Claude Code: `/specflow`

SKILL.md packages the core Specflow loop — contract enforcement, security/accessibility gates, model routing, self-healing fixes — into a single portable file. No other Specflow files required.

For the full 23+ agent experience, use Path A or see [agents/README.md](../agents/README.md).

---

## Path C: Manual Setup

**Best for:** Full control, non-Claude LLMs, or integrating into an existing workflow.

### Step 1: Add Specflow

```bash
cp -r Specflow/ your-project/docs/Specflow/
```

### Step 2: Tell your LLM

```
I want to use Specflow to protect my codebase. Read these docs:
- LLM-MASTER-PROMPT.md
- SPEC-FORMAT.md
- CONTRACT-SCHEMA.md
- USER-JOURNEY-CONTRACTS.md

Then interview me about my project:
- What architectural rules should NEVER be broken?
- What features exist and how should they behave?
- What user journeys must always work?

From my answers:
1. Generate REQ IDs (AUTH-001, STORAGE-001, J-CHECKOUT-001, etc.)
2. Create contract YAML files in docs/contracts/
3. Create test files in src/__tests__/contracts/
4. Show me how to add to CI
5. Update this project's CLAUDE.md with contract rules
```

The LLM will interview you, generate REQ IDs, contracts, tests, and update your CLAUDE.md. You describe things in plain English — it structures them.

See [QUICKSTART.md](../QUICKSTART.md) for more prompt variations.

---

## Install Hooks (All Paths)

Hooks make contract and journey tests run automatically after builds and commits — you can't forget.

```bash
bash Specflow/install-hooks.sh .
```

### How hooks work

```
pnpm build (success)
    ↓
Hook extracts issue numbers from recent commits (#123, #456)
    ↓
Fetches each issue for journey contract (J-SIGNUP-FLOW)
    ↓
Runs only those tests (not full suite)
    ↓
Pass → continue | Fail → blocks with error
```

### Critical: commit message format

Hooks only trigger when commits reference issues:

```bash
# ✅ GOOD — hooks find #375 and run its journey tests
git commit -m "feat: add signup validation (#375)"

# ❌ BAD — hooks find nothing, no tests run
git commit -m "feat: add signup validation"
```

### Defer tests temporarily

```bash
touch .claude/.defer-tests    # Skip
rm .claude/.defer-tests       # Re-enable
```

---

## Verify Setup

After setup, run:

```bash
./verify-setup.sh
```

Or ask Claude Code:

```
What contracts are active in this project?
```

If Claude lists contracts from `docs/contracts/`, it's working. If it says "I don't see any contracts," check:
1. Contract rules are near the **top** of `CLAUDE.md`
2. File is named exactly `CLAUDE.md` in project root
3. Claude Code started in the correct directory
4. Contract files exist in `docs/contracts/*.yml`

**The litmus test:** If Claude modifies a file in `src/` without mentioning contracts, the `CLAUDE.md` is not being read.

**What you should NOT need to say:** "Re-read CLAUDE.md", "Use specflow for this", "Remember to check contracts." If you find yourself saying these, setup needs attention.

---

## You're Done When

✅ Spec has requirement IDs (`AUTH-001`, `EMAIL-042`)
✅ Contract maps IDs to rules (`AUTH-001` → forbidden patterns)
✅ Test references contract ID (`it('AUTH-001: ...')`)
✅ Intentional violation fails with clear message
✅ CI runs contract tests on every PR

---

→ **Understand how it works deeper?** See [How It Works](how-it-works.md)
→ **Using with a team?** See [Team Workflows](team-workflows.md)
→ **Setting up CI?** See [CI Integration](../CI-INTEGRATION.md)
