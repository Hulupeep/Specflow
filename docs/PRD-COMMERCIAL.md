# Specflow — Trusted Delivery for AI-Produced Software

**Commercial narrative PRD · 2026-07-02**
*For clients, investors, and partners. The canonical internal PRD (with engineering roadmap detail) is `docs/PRD.md`.*

---

## 1. What Specflow is

**Capability does not create authority.**

Specflow is for teams that want frontier-agent speed without granting frontier agents merge authority. It turns AI-produced work into an **evidence-backed change packet**: contract, verifier findings, runtime proof, provenance, trace, and human authorization where required.

Specflow is a model-agnostic trust harness for frontier coding agents. Claude, Codex, Fable-class models, or agent swarms produce the work — but only contracts, verifier evidence, mechanical gates, ledger state, and human boundaries decide what advances or ships. The model is the actuator; the gate is the sensor. A model's own output — or its exit code — is never a verdict.

**Frontier models can carry the work. Specflow carries the trust.**

---

## 2. The problem

AI coding agents can now run for hours and produce large, plausible changes — and then confidently certify their own work as done. The problem is not that models are bad at coding. It is that they are good enough to be dangerous in a specific way:

- They can plan, build, summarize, and self-approve — and they are still weak judges of their own output.
- The failure mode is **plausible completion**: working-looking UIs over dead backends, green tests over hard-coded data, journeys that were never actually driven.
- No commercial team can read every line of a six-hour agent run. "The agent says it's done" is not evidence.

The buyer pain, verbatim:

> **"I used an AI agent. It produced something that looks done. I need to know whether it is safe to merge."**

### Before / after

| Without Specflow | With Specflow |
|---|---|
| Agent says "done" | Gate decides from evidence |
| Reviewer reads a huge diff cold | Reviewer reads trace/divergence first |
| Tests may be written by the maker | Verifier contract defines what counts |
| Screenshot implies success | Runtime/value evidence required |
| Model fallback is invisible | Requested/effective model is ledgered |
| Client gets reassurance | Client gets an evidence packet |

---

## 3. Who it's for

**The primary customer is the AI-enabled agency or consultancy delivering commercial software to clients who need evidence that agent-produced work is controlled.** They want agent speed for margin — but they must explain trust to a paying client, and "our AI is careful" is not an answer a client accepts. Specflow's deliverable for them is the **client-ready evidence packet**: per change, a durable record of what was contracted, what was verified at runtime, what the model actually was, and who authorized what.

It also serves:

- Product teams on brownfield production systems, where existing behavior must not regress.
- Any team where auth, billing, data mutation, workflows, compliance, or audit trails matter.
- Technical founders and engineering leads who want agent speed without agent self-certification.

**It is not for** throwaway demos, hobby projects, teams that will manually inspect every line anyway, or anyone seeking fully autonomous merge-and-deploy. The qualifying question: *would you merge a six-hour agent run without reading it?* If the honest answer is "no, but I wish it were yes" — that gap is Specflow.

---

## 4. How it works

1. A goal is hardened into an **outer contract**: acceptance criteria, invariants, user journeys, forbidden actions.
2. The agent (the *maker*) proposes, before writing code, how its change will be verified.
3. An **independent verifier** — which never sees the maker's reasoning — accepts or strengthens that verification contract.
4. The maker builds. The verifier then **actually drives the built behavior**: launches the app, exercises the journey, reads console, network, and backend state. For anything touching UI, workflows, APIs, integrations, data mutation, auth, or billing, this runtime verification is mandatory, not optional.
5. A **mechanical gate** decides from the verifier's evidence. The maker's "complete" claim cannot outvote a failed finding. A screenshot alone never satisfies a value-bearing check.
6. An **append-only ledger** records everything: which model was requested and which actually ran, claims, findings, divergences, gate results, and every human authorization or skip.
7. Pushing, merging, and opening PRs remain **mechanically human-only**. A run can go six hours; the merge still needs a person.
8. A **trace report** makes any run readable after the fact — divergences first, evidence linked.

The result of every change is the evidence packet: something a reviewer, a client, or an auditor can read in minutes instead of a diff they'd never finish.

---

## 5. Trust guarantees

These boundaries are enforced by the harness, not requested by prompt:

1. The maker cannot mark its own work as accepted.
2. A model's exit code cannot become a pass.
3. A screenshot alone cannot satisfy value-bearing behavior (API, data, billing).
4. Missing verifier evidence cannot advance runtime-required work.
5. A failed required finding cannot be overridden silently — only a human can skip, on the record.
6. Model fallback or downgrade cannot be hidden.
7. The agent cannot push, merge, or open a PR without human approval.
8. The verifier is never contaminated by the maker's reasoning.
9. Scheduled/automated runs go through the same gates — there is no weaker second loop.

---

## 6. Why Specflow and not…

| Alternative | Why it isn't enough |
|---|---|
| Better prompts / prompt packs | The model can ignore them; there is no enforcement |
| Agent swarms and orchestrators | More workers means more plausible change, not more trust |
| Generic CI | Runs after the agent has self-certified; checks what was written, not whether claims match runtime behavior |
| Test runners | The maker chose the tests — a self-graded exam |
| Manual review of everything | Doesn't scale to agent output volume; erases the speed you paid for |

Specflow sits **underneath** those systems as the trust layer. The model stack above it is swappable and expected to churn; the gate layer is fixed. You upgrade the worker freely. You never let the worker become the sensor.

**The model proposes; Specflow disposes. Swarm faster — ship only what survives contracts. Do not let a powerful model become its own judge.**

---

## 7. What exists today

The trust core is shipped and tested (830 passing tests across 32 suites):

- The **contracted loop runner** with durable on-disk run contracts and ledger — runs survive interruption and resume without losing state.
- The full **verifier lifecycle**: maker-proposed verification contracts, independent strengthening, runtime verification, separately-written findings.
- The **enforced verifier rail**: behavioral changes cannot pass the gate without verifier evidence.
- **Provenance checking** that catches hard-coded or mocked data posing as implementation.
- **Run tracing** for human-readable post-hoc review of any run.
- **Model honesty metadata**: requested vs. effective model recorded per action; silent downgrade is a failed contract.
- **Mechanically enforced human boundaries** on push, merge, PR, and gate override.

In progress: durable cross-run state memory, isolated workspaces for delegated agents, cost-per-accepted-change reporting, and scheduled routines — deliberately sequenced so autonomy features land only after the trust layer beneath them is proven.

---

## 8. Commercial value

The wedge is not "better AI coding." It is: **make AI-assisted delivery acceptable to serious clients.**

- **Agencies and consultancies** hand clients evidence packets instead of assurances — AI-assisted delivery becomes a selling point, not a disclosure.
- **Product teams** cut review burden without cutting accountability: humans review boundaries and divergences, not every line.
- **Organizations** avoid the expensive class of plausible-completion failures — dead backends and silently-skipped verifications caught before the PR, not in production.
- **Managers** can allow longer agent runs without surrendering merge authority.
- **Audit-sensitive environments** get a decision trail by construction.

The economics: agents make raw output cheap; the scarce quantity is *trusted* output. Specflow makes trusted output measurable — **cost per accepted change** — and drives it down without trust going with it.

---

## Executive summary

AI coding agents now run for hours and produce large, plausible changes — then confidently certify their own work. For anyone shipping commercial software with AI assistance, that creates one unavoidable question: *is this safe to merge?* Confidence is not evidence, and no team can read every line an agent produces. **Capability does not create authority.**

Specflow is the trust harness that answers the question with evidence. Agents do the work; Specflow decides what counts. Every change passes through a contracted loop: an independent verifier — isolated from the maker's reasoning — drives the actual built behavior at runtime; a mechanical gate rules on the verifier's evidence, not the maker's claims; an append-only ledger records models, findings, divergences, and every human authorization; and merge authority stays mechanically human. The output per change is a **client-ready evidence packet** a reviewer, client, or auditor can absorb in minutes.

The primary customer is the AI-enabled agency or consultancy that needs to prove to paying clients that agent-produced work is controlled — followed by any team touching auth, billing, data, or production systems with AI assistance. The trust core is built, shipped, and tested. The pitch in one line: **frontier models carry the work; Specflow carries the trust — swarm faster, and ship only what survives contracts.**
