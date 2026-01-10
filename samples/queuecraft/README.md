# Building QueueCraft: A Specflow Dev Blog

**Watch Specflow build a real product from Reddit pain point to working app.**

---

## The Premise

We've spent the last year trying to make LLMs behave—better prompts, smaller steps, more supervision, more review. Individually these things help, but systemically they don't hold.

So we flipped the model.

We stopped treating LLMs like obedient machines and started treating them like creative humans:

> *Do what you like—explore, generate, surprise me—but I'm going to type-check you at the end.*

That's what Specflow is.

**We don't need LLMs to behave. We need them to be checkable.**

---

## What This Blog Shows

This blog documents building **QueueCraft**—a commission queue manager for creative freelancers (cosplay makers, furry artists, prop builders). We found this problem on Reddit, wrote a spec, generated contracts, and built it using the Specflow methodology.

## What You'll See

1. **Real problem** - Not a contrived example, an actual pain point people pay to solve
2. **Full workflow** - Spec → Contracts → Tests → Code
3. **The "aha" moment** - When contracts catch what unit tests miss
4. **Both perspectives** - What the user does vs. what the LLM does

## Read in Order

| Part | Title | What Happens |
|------|-------|--------------|
| 1 | [The Reddit Discovery](01-reddit-discovery.md) | Finding the pain point |
| 2 | [The Spec](02-the-spec.md) | User writes monetizable spec |
| 3 | [Architecture Contracts](03-architecture-contracts.md) | LLM generates ARCH rules first |
| 4 | [Feature Contracts](04-feature-contracts.md) | LLM generates feature rules |
| 5 | [Journey Contracts](05-journey-contracts.md) | LLM defines Definition of Done |
| 6 | [Building It](06-implementation.md) | Implementation with Playwright |
| 7 | [The Catch](07-the-catch.md) | Contract catches a violation |
| 8 | [Summary](08-summary.md) | What we learned |

## The Product: QueueCraft

**One-liner:** Commission queue management for creative freelancers.

**Who it's for:**
- Cosplay makers with 6-month queues
- Furry artists juggling 50+ commissions
- Custom prop builders tracking deposits across Venmo/PayPal/Cash App
- Anyone who's lost track of "who paid, who's next, who needs an update"

**Price:** $9/month (hobby) | $19/month (pro)

---

## Time Investment

This entire build took approximately 4 hours:
- Research: 30 min
- Spec writing: 30 min
- Contract generation: 45 min
- Implementation: 2 hours
- Blog documentation: 15 min

**The blog writes itself** - Specflow artifacts ARE the documentation.
