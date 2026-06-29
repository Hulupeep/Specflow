# teardown-walkthrough-mandate@v1

Static, versioned method for the daily-use-teardown's **investigate** and **deep-dive** stages. The walker references this file by id — it never inlines instructions, and the author's expectations of "what should work" have no place in it. Same pattern as `adversary-mandate@v1`: changing the method is a deliberate, reviewable act (bump to `@v2`, don't edit `@v1`).

## Persona construction (investigate stage) — JTBD-grounded, not demographic

A persona here is a **job**, not a profile. For each proposed persona, state:
1. **The job-to-be-done** — what outcome are they hired-by-the-user to achieve today? ("clear the overnight alert queue before 9am", not "Sarah, 34, likes efficiency").
2. **Frequency + stakes** — daily/weekly? what breaks if they fail?
3. **Their entry point and exit condition** — where do they start, and what does "done" look like *to them*?
Propose 2–4. The human confirms or corrects them at the sign-off — a wrong persona walks the wrong day.

## The walk (deep-dive stage) — a cognitive walkthrough, not a tour

For each journey × persona, at **every step** ask the four cognitive-walkthrough questions:
1. Does the persona **know what they're trying to do** at this step?
2. Is the **right action visible**? (discoverability)
3. Will they **connect the action to their goal**? (does the label/affordance say what it does?)
4. After acting, does **feedback confirm progress**? (or are they guessing whether it worked?)

A "no" on any question = a stall → screenshot (URL bar visible) + note **which question failed**. That's what makes a CONFUSING verdict actionable instead of vibes.

## Naming findings — use the vocabulary, it sharpens the do-list

- **discoverability** — the control exists but the persona can't find it
- **affordance** — found it, but it doesn't look actionable / doesn't say what it does
- **feedback** — acted, but no confirmation; the persona can't tell if it worked
- **mental-model mismatch** — the app's flow contradicts how the persona thinks the task works
- **slip vs mistake** — mis-click on a known path (slip) vs wrong path chosen confidently (mistake — the dangerous one)
- **dead end** — no route from here to the goal without backtracking

## Output discipline

- Verdict per journey: **WORKS / CONFUSING / BROKEN**. CONFUSING is always **[hypothesis]** — you are a simulation of a user, not a user. Name the failed walkthrough question + the vocabulary term.
- BROKEN = the journey cannot achieve its purpose (correctness), with the step + evidence.
- Observations only — never propose the fix (that's the PRD's job, behind the adversary).
- Every claim has a screenshot under `evidence/`, referenced from the finding. No evidence, no finding.
