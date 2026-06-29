# How we build things — a guide for dummies

The plain-language companion to [`PROCESS.md`](./PROCESS.md). If PROCESS.md is the spec, this is the "read me first." Another agent (or a new teammate) should be able to read this cold and know exactly what to do.

## The one idea behind everything

**Nobody grades their own homework.** The agent (or swarm) that *does* the work never gets to say "it's done." Two outsiders decide that: a **hostile critic** checks the plan, and **CI (the machine)** checks the code. Everything the agent does in between is just muscle.

And one rule runs through all of it: **"it ran" / "it's green" / "the file says so" is NOT proof.** Every claim has to point at something real — a real number from the real calculator, a real login to the real backend. If you can't point at the real thing, you don't actually know it works.

## Before you start (preconditions)

You may NOT start building until:
1. There's a **real artifact** to work from — an actual export, a real API response, a real screen. Not a vibe, not "users probably want…".
2. There's a **GitHub ticket**. No ticket = no code. Ever.
3. The plan has **survived the critic** (Gate A below). No SHIP verdict = no tickets = no code.

If any of those is missing, stop and go get it. Don't improvise.

## Where you start: Discovery

You start by **looking at the real thing**, with a human, and asking "what is actually true here?" and "what would break this?"

- *Do:* open the real file/data/repo and poke at it. Find the real edge cases ("31% of rows don't match").
- *Done when:* you can say in plain words what the problem is and what real data the answer must satisfy. That's called **grounding** — you now understand how to proceed.
- *No swarm here.* Just you and the human, looking at reality.

## Then: write a PRD — and expect it to be wrong

Write down the plan (a PRD: what we're building, for whom, what "good" looks like).

**Your first PRD is wrong.** That's normal. So you bring in an **adversary** — a second agent whose only job is to attack it. It checks the plan against a rubric and hunts for lies: fake backends, "we'll just make the test pass," metrics that are always green. You fix what it finds, it re-reads, repeat — until it's honest.

- *Done when:* the critic stops finding fatal problems.

## Gate A (HARD) — the critic's verdict

The critic writes a verdict: **SHIP**, **SHIP WITH STIPULATIONS**, or **DO NOT SHIP**, and saves it as a committed file.

- **You cannot write tickets until that file says SHIP.** This is the first wall. One hostile critic decides — not the team agreeing with itself.

## Then: turn the plan into tickets

Once SHIPped, break the plan into GitHub issues. Each issue gets: how-to-test-it steps (Gherkin), the exact buttons/fields to look for (data-testids), the contract it belongs to, and the name of its test file.

## Gate B (soft) — the specflow auditor

Now you **don't trust that you wrote those tickets well.** You run the **specflow auditor** (`board-auditor`) over the whole board. Its job is to check the tickets are actually *wired up* — not just nice-sounding text. Like a checklist inspector walking down the row asking, for every ticket:

- Does it have **test steps** (Gherkin)?
- Does it name the exact **buttons/fields** (data-testids)?
- Does it point at a **journey contract** (the YAML that makes it machine-checkable)?
- Does it name its **test file**?
- Does every **requirement** trace forward to a journey → a test → a ticket? (a requirement with nowhere to land = an **orphan**)
- Are there **duplicate IDs** — two tickets claiming to be the same journey?

Wherever it finds a hole, the **uplifter** (`specflow-uplifter`) fills it — the missing SQL/RLS, the TypeScript interface, the invariant, the missing selector. Then you **re-run the auditor.** Repeat until it says "all compliant, no orphans, no duplicates."

**Why this gate matters (the bit that makes it click):** Gate C (the CI machine at the end) can only catch a broken journey if that journey was wired to a test and a contract *in the first place*. A ticket with no journey contract gives CI nothing to enforce — it sails through green while being completely unchecked. The specflow auditor is what guarantees there are no such silent holes before anyone writes code. It's "soft" because a human/controller enforces it rather than a machine — but skip it and your unfakeable Gate C quietly becomes fakeable.

## Gate B.5 (soft) — dry-run a fake user

Walk a pretend real user through each ticket *before* coding (`pre-flight-simulator`). If "new staff would land at zero balance," catch it now — it's free here, expensive later. A CRITICAL design gap blocks the ticket.

## Then: build — one journey at a time, on 5 rails

For each ticket, always in this order:
1. **Ticket** exists.
2. **Contract** filled in (the steps + buttons).
3. **Real-backend test** written (against the real system, not a fake).
4. **Check the expected answers against the real source first** — "it should say 2 days, not 5" → confirm with the real calculator *before* you code. Never guess the number.
5. **Write the code** that makes the test pass.

Prove one journey green, *then* start the next. Tools like `/qa` and the swarm help you here — but remember, **they're muscle, not judges.** They find problems; they don't get to approve.

## Gate C (HARD, can't be faked) — CI

The machine runs all the tests against a **real, seeded backend** under branch protection. If anything's wrong, **it cannot merge.** This is the final wall, and it's a wall precisely because it's a machine running real data — "looks green but is actually broken" can't sneak through.

## The shape, in one line

```
Discover (get grounded)  →  PRD  →  Adversary beats it up  →  GATE A: SHIP?
   →  Tickets  →  GATE B: specflow auditor wires them up  →  GATE B.5: dry-run a fake user
   →  Build on the 5 rails, one journey at a time
   →  GATE C: CI on real data  →  merge
```

Soft gates up front catch most mistakes. Two hard walls (a hostile critic, then the machine) make sure a mistake — or a lie — can never actually ship. The specflow auditor in the middle is what keeps the last wall honest.
