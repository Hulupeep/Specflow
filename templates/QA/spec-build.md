# spec-build — a best-practice loop from idea to delivery

*Read this first if you're new to spec-build. For the runnable files see [`loops/`](./loops/); for the deep version see [`spec-build-loop.md`](./spec-build-loop.md).*

## What is it?

**spec-build is a string of best practices, run as one loop, that takes you from "an idea or a rough story" all the way to "tickets your LLM can build well."** It exists for one payoff: **fewer bugs afterwards, and a more comprehensive piece of work for the LLM to build** — because the thinking was hardened *before* any code was written.

It strings together two things we already use:

### Pillar 1 — the adversary (before you write tickets)
A **hostile critic** takes your PRD or your stories and *challenges* them — pokes holes, hunts for the cases you didn't think of, checks your claims against the real system. Its job is to make sure you have a **good foundation in your thinking** before anyone builds anything. It's the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer).

### Pillar 2 — Specflow (around the build)
Most people think Specflow just *checks* invariants at the end. It does more:

- **It makes sure the invariants are even there** in the first place — not just that they pass.
- **It audits and uplifts your tickets.** The ticket workflow is: make the ticket Specflow-compliant → **audit** it → **uplift** it (fill the missing SQL/RLS, interfaces, invariants, selectors).
- **It adds meat with persona walkthroughs / simulations** — walking a real user through each ticket *before* code, so edge cases ("new staff land at zero balance") get caught early.
- **Then it checks the invariants after the build** against a real backend, so "the right thing" is what actually shipped.

So: the **adversary makes the spec honest**; **Specflow makes it complete and then enforces it.** Both work together to produce a solid foundation.

## A living practice — with you in the loop

These aren't new steps. We already did them by hand. What's new is **connecting them into one loop**, so the good practice is *retained* — run the same way every time, instead of remembered-or-forgotten case by case.

It's meant to **evolve**: as a team we'll modify this loop as we learn what catches bugs — for example, adding draft-PR checks or new stages over time. Treat it as a living thing, not a fixed pipeline.

And it is **not full automation**. The loop has deliberate **human-in-the-loop breaks** — you approve the adversary's verdict, you confirm before tickets are created. You stay in control, and you can **adapt it however you wish**.

## Two ways in

You don't always start the same way — spec-build handles both:

1. **You already have stories.** The adversary reviews and **corrects your specs** directly.
2. **You're figuring something out in a chat with your LLM** — poking at how a thing works, what would break it. That exploration is **discovery**. The adversary takes that conversation and helps turn it into a **hardened PRD**.

Either way, the output is the same: a corrected/hardened **PRD that becomes the basis for correcting your tickets**.

## The loop, in plain steps

```
  (your stories)  ─┐
                    ├─►  PRD  ─►  ADVERSARY  ─►  honest PRD  ─►  TICKETS  ─►  AUDIT + UPLIFT  ─►  PERSONA WALK-THROUGH  ─►  ready to build
  (a discovery chat)┘            (challenges it)               (Specflow writes them)  (fill the gaps)   (cover the edges)
```

- Nothing gets built until the PRD **survives the adversary**.
- Tickets aren't "done" until they're **audited, uplifted, and walked through a persona**.
- The invariants you set are then **checked after the build** — so you find out if you built the right thing.

That whole string, run as one repeatable practice, **is spec-build**.

## How to set it up (one-time, per repo)

Pick the right terminal for your OS:
- **Mac / Linux** — any terminal works (Terminal, iTerm, your shell).
- **Windows** — use **Git Bash** (not PowerShell or WSL). The scripts target Git Bash; PowerShell's `bash` is usually WSL, which can't see your `C:\` paths and errors with "No such file or directory".

Then run:

```bash
npx @colmbyrne/specflow init .         # scaffolds the loop kit + gate scripts AND installs the adversary skill
npx @colmbyrne/specflow update . --ci  # wires the hooks + CI
# then edit CLAUDE.md → fill in Repository / Project Board / Board CLI
```

That's it — `init` now also installs the adversary critic into your skills dir (`~/.claude/skills/`, and `~/.codex/skills/` if you use Codex). One command, not two. (Add `--no-adversary` to skip it; if you're offline, init prints the manual `git clone` to run later.)

## How to run it

The loop is a **path** (`QA/loops/spec-build.yaml`) plus a **thin prompt**. You don't re-type the steps — you point at the path. Copy [`loops/prompts/spec-build.prompt.md`](./loops/prompts/spec-build.prompt.md) and fill three things:

```
Goal:   SHIP the <thing> spec — a hardened PRD + ready, audited tickets
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <short-name>, grounding_ref: <a file, OR "this discovery chat above; no PRD yet"> }
```

Paste it to your agent and follow the path. (A real, filled example is in [`loops/examples/`](./loops/examples/).)

**Don't want to fill it in by hand?** You don't have to. Paste the blank template into the LLM you've just been working with and say:

> *"Fill this in for the story we've just been discussing and hand it back to me."*

It'll produce the filled-in prompt from your conversation. Then you run that — paste it back and let the loop go. The prompt is just text; get it filled however is easiest (by hand, or by the LLM from your chat), then run it.

## Example scenario

> You need to let admins **roll back a bad data import**. You don't have a spec — just a hunch.
>
> 1. **Discovery chat:** you and the LLM look at the real import tables and ask "what would make a rollback unsafe?" You surface the real rules (don't delete records someone already edited; recalculate balances, don't subtract them back).
> 2. **PRD:** the loop drafts a PRD from that chat.
> 3. **Adversary:** a fresh critic attacks it — and catches that you assumed a table does something it doesn't, and that one rule could be gamed. You fix the PRD.
> 4. **Tickets:** Specflow turns the hardened PRD into tickets, audits them, uplifts the gaps, walks an admin persona through each one.
> 5. **Build:** your LLM now builds against a comprehensive, edge-covered spec — and the invariants get checked after.

The bugs that *would* have shown up in production mostly got found in steps 3–4, on paper, for minutes of effort instead of a hotfix.

## How long it takes — and when to use it

- **Time:** roughly **an hour for a story or two**, most of it in the adversary + uplift, not the typing.
- **Worth it for:** anything non-trivial — real data, money/leave/balances, auth, things you'll maintain, anything where a production bug hurts. The hour up front saves far more in avoided rework.
- **Overkill for:** a one-line copy change, a throwaway spike, or pure exploration where you're not shipping. Don't loop a typo fix.
- **Where it's efficient:** independent tickets can be built in parallel after the spec is ready; discovery + adversary often run while you draft the next thing.
- **Where it's slower:** a single small story carries the full ceremony, and a weak/rushed adversary pass just adds time without catching anything — give it the real artifact and let it actually dig.

**Rule of thumb:** if a bug in this would embarrass you in front of a customer, run spec-build. If not, just write the ticket.

---

## What the loop actually follows (a readout of `spec-build.yaml`)

You point the prompt at one file — [`QA/loops/spec-build.yaml`](./loops/spec-build.yaml). Here's everything inside it, in plain terms, so you know what it's doing without opening it:

| Section | What it means |
|---|---|
| **`inputs`** | The 3 things *you* supply: `goal`, `slug` (short name), `grounding_ref` (a file, or "this discovery chat"). Nothing else. |
| **`state`** | Where it tracks progress — durable files, never chat: the PRD (`PRDs/<slug>-prd.md`), the verdict (`PRDs/<slug>-verdict.md`), and the GitHub issues. Each run reads these to know "where am I?" |
| **`stages`** | The steps, in order ↓ |
| &nbsp;&nbsp;`discover` | Ground against the **real artifact**; write the problem + the real data it must satisfy. |
| &nbsp;&nbsp;`draft` | Write the PRD (JTBD, scope, acceptance, metrics, deps). |
| &nbsp;&nbsp;`adversary` | The hostile critic: 7-pass rubric + reality-grounding + loophole hunt. Repeats until a verdict, fixing each FATAL/SERIOUS in the doc. |
| &nbsp;&nbsp;**`GATE_A` (hard)** | Verdict must be `SHIP` / `SHIP WITH STIPULATIONS`, written to the committed verdict file. **No tickets until SHIP** + your approval. |
| &nbsp;&nbsp;`tickets` | Specflow-writer turns the hardened PRD into issues (Gherkin, data-testids, contract refs, e2e file). |
| &nbsp;&nbsp;`GATE_B` (soft) | board-auditor + uplifter: every requirement→journey→test→issue, no orphans, no duplicate IDs. |
| &nbsp;&nbsp;`GATE_B.5` (soft) | pre-flight-simulator walks real personas through each ticket; a CRITICAL design gap blocks. |
| **`repair`** | On a failed gate: retry with a targeted fix (budget: adversary ≤ 4 cycles, uplift ≤ 3), else escalate. |
| **`escalate_when`** | It stops and asks **you** if: the verdict is DO-NOT-SHIP, the idea turns out wrong, or an open gap has no owner. |
| **`never_without_human`** | It will **never**: create tickets from a rejected PRD, or fake a green verdict. |
| **`done_when`** | Verdict = SHIP (committed) + audited, journey-contracted tickets exist → handed off to `feature-build.yaml`. |

It also prints a little **progress map** at each step so you can see where it is:
```
DISCOVER ─▶ PRD ═╣⛔A╠═▶ TICKETS ─▶ ╎B╎ ─▶ ╎B.5╎ ─▶ handoff
   ✓        ▶     ⛔        ·         ·      ·
  now: drafting the PRD   next: adversary   blocked-on: none
```

## The prompt — blank, then filled

**Blank** (the template you copy from [`loops/prompts/spec-build.prompt.md`](./loops/prompts/spec-build.prompt.md)):
```
Goal:   SHIP the <thing> spec — a hardened PRD + ready, audited tickets
Path:   QA/loops/spec-build.yaml
Inputs: { slug: <short-name>, grounding_ref: <a file path, OR "this discovery chat above; no PRD yet"> }
Follow the path; don't restate it.
```

**Filled** (a real one — rolling back a bad import, started from a discovery chat):
```
Goal:   SHIP the TT-ROLLBACK spec — a hardened PRD + ready, audited tickets for Import Backout & Rehearsal Mode
Path:   QA/loops/spec-build.yaml
Inputs: { slug: tt-rollback, grounding_ref: "this discovery chat above; no PRD exists yet" }
Follow the path; don't restate it.
```
That's the whole difference between runs — three values change. (A longer worked version is in [`loops/examples/tt-rollback.spec-build.md`](./loops/examples/tt-rollback.spec-build.md).)

## Where is everything?

Three kinds of thing — and only the first group actually *runs*. The rest is output the loop *produces*, or reference you *read*. Don't confuse "a worked example" (reading material) with "the path" (machinery).

### 1. The machinery — what runs when you invoke the loop

| Component | Where | What it does |
|---|---|---|
| **The prompt** | `QA/loops/prompts/spec-build.prompt.md` | the thin invocation — **the only thing you actually write** (fill in 3 values) |
| **The path** | `QA/loops/spec-build.yaml` | the steps the loop executes (read out above) |
| **The adversary skill** | `~/.claude/skills/adversarial-prd-reviewer` | the hostile critic that reviews the PRD (Gate A) |
| **The critic's mandate** | `QA/loops/adversary-mandate.md` | the critic's fixed, versioned instructions (so every review runs the same rubric) |
| **The Specflow agents** | `scripts/agents/` — `specflow-writer`, `board-auditor`, `specflow-uplifter`, `pre-flight-simulator` | the muscle: writes the tickets, audits them, uplifts the gaps, walks personas through them |
| **The gate scripts** | `scripts/*.cjs` | the mechanical, model-free checks — described next |

**The gate scripts, in plain terms:**
- **`verify-seed.cjs`** — the *independence* check. Before the critic is spawned, it byte-checks the critic's "seed" against a fixed template. If the seed carries anything extra — e.g. your own reasoning or a "go easy on this" note — it's **rejected**. This is what stops the critic from being quietly primed to agree with you.
- **`adversary-spawn.cjs`** — builds that seed from *only* the allowed inputs (your rationale has no way in — "clean by construction") and runs `verify-seed` before the critic launches.
- **`verify-ticket-journey.cjs`** — checks the ticket↔journey join: every journey has at least one ticket (no **orphan** journeys), and every journey a ticket mentions actually exists (no **dangling** references).
- **`verify-graph.cjs`** — checks the contract graph: every requirement → journey → test → contract resolves, journey IDs are unique, no orphan contracts. The structural-integrity check.

### 2. What it produces — outputs, not things you run

| Output | Where | What it is |
|---|---|---|
| The hardened PRD | `PRDs/<slug>-prd.md` | the spec, after the adversary |
| The verdict | `PRDs/<slug>-verdict.md` | the committed Gate A decision (SHIP / not) |
| The tickets | GitHub issues | the ready, audited, journey-contracted work |

### 3. Reference — you *read* these, you don't run them

| Doc | Where | What it's for |
|---|---|---|
| A worked example | `QA/loops/examples/` | a *filled* prompt + what a good first run looks like — **copy from it, you don't "run" it** |
| This intro | `QA/spec-build.md` | the plain-English overview (you're reading it) |
| The loop deep-dive | `QA/spec-build-loop.md` | the technical version of the path |
| The process docs | `PROCESS.md` / `-GUIDE` / `-CLAUDE` / `-CODEX` | the method, and how to run it on Claude vs Codex |

**Bottom line:** `specflow init` installs **group 1** (the machinery) in one command. **Group 2** is what comes out the other end. **Group 3** is reading. Day to day, the only thing you author is the **prompt**.
