# IMPROVE-CORE slice 1: discoveries from the first HeyStax run

Run: `improve-heystax-001` against `Hulupeep/tabstax-webapps@df8cdf9` (private; full
evidence stays in that repository's local `.specflow/runs/`). This file holds only
product-level, sanitized findings. The machine-readable form is
`discoveries-slice-1.json` (collected via `specflow specification collect`).

| ID | Kind | Finding | Affects | Disposition |
|---|---|---|---|---|
| D1 | confirmed-cause | `claude -p --output-format stream-json` now requires `--verbose`; `templates/adapter-policies/claude-print.safe.yml` and the runner default args omit it | #177 | improve policies include it; template fix proposed |
| D2 | confirmed-cause | `parseProviderEvents` ignored Claude's `total_cost_usd`, so every claude-print stage reported cost `unknown` | #177, #179 | fixed in runner (measured cost now recorded) |
| D3 | confirmed-cause | `buildAdapterCommand` placed the prompt after variadic `--allowedTools/--disallowedTools`; the CLI swallowed it and the call failed ("Input must be provided") for any policy with tool lists | #177 | fixed: prompt follows `--` |
| D4 | observation | The side-effect guard classifies argv, scans builder tool calls and enforces diff scope after the fact. It is not a sandbox: network egress from the builder or dev server is limited by tool permissions and env scrubbing, not blocked | #176 | keep as explicit limitation; route through the project's experiment sandbox policy when one exists |
| D5 | observation | The agent workspace has no Supabase credentials. Only the auth-bypass demo board runs; capture, resume, Today and real-data journeys cannot be exercised; 57/116 vitest files and most e2e journeys fail or skip on untouched base | #180, #173 | candidate discovery is biased to runnable surfaces; #180 needs a seeded local Supabase or read-only fixture to test mission-level journeys |
| D6 | observation | Dry-running the frozen check against base before freezing showed a "preservation" criterion was already failing (tablet card had no visible list path) | #174 | make a pre-freeze check dry-run part of contract writing; baseline mismatch still forces a new version before implementation |
| D7 | observation | The independent UX critic materially changed the contract (footer View List is invisible on mobile and clipped on narrow cards; value for narrow cards was overstated) | #175 | the distinct UX role is load-bearing; add an `improve critique` stage (done ad hoc via claude -p + `improve role` in this run) |
| D8 | observation | Host-session roles (scout, contract writer) have no separable cost; they are reported as unknown | #177, #179 | run scout/contract writer through adapters for measured cost |
| D9 | observation | Stream-json usage merging keeps the first event's tokens, so token counts are wrong even when cost is measured | #179 | aggregate usage from the result event |
| D10 | observation | Worktrees nested inside the product checkout confuse Next/pnpm root detection; each worktree also needs an offline install | #176 | default worktree root is a sibling directory; setup is declared in the contract |
| D11 | observation | The tier gate blocks production build for `spec:thin` tickets; this slice ran as the bounded learning experiment the gate points to. `improve` is not a runner loop or tier route yet | #171 | decide whether the target product's change is governed by the ImprovementContract rather than a Specflow issue tier |
| D12 | observation | `tests/contracts/typesafe-effort-eval.test.js` has 2 failures on untouched main in this environment | none | pre-existing; not caused by this slice |

## Design lessons from the run (what `improve` itself needs next)

| ID | Lesson | Affects |
|---|---|---|
| L1 | The decision was right, but the builder ignored the contract's permitted fallback ("wrap the controls if removal alone leaves the narrow card unreadable"). A one-shot builder that cannot run the frozen checks cannot tell that its change is insufficient. Next slice: let the builder run the frozen checks read-only against its own workspace inside its budget, and allow one bounded repair round under the same frozen contract version. The final decision still comes only from the independent verify and evaluate steps. | #178, #174 |
| L2 | Conditional hypotheses ("if X is not enough, do Y") are ambiguous to builders. A contract should name one intended change; a fallback is either required or its own cycle. | #174 |
| L3 | Critic → contract → frozen check worked as intended. The critic predicted the exact failure mode (the footer path is invisible on narrow cards, the value was overstated), the contract encoded it as AC-5, and the check caught a tablet regression the builder's "complete" claim missed. | #175, #178 |
| L4 | The value of C1 was measured on two demo cards only. Real stax-name lengths and card counts are unknown without real data (D5). | #180 |
| L5 | A REVERT report must still say what the evidence established. The generic headline was fixed in this slice. The next decision should propose the concrete next contract, not only "decide whether to rescope". | #179 |
| L6 | Durable evidence has no home yet. The run record lives untracked in the private product clone, the container is ephemeral, and Specflow is public. Pushing a branch to the product repo is `never_without_human`. A human needs to choose a durable private location. | #179, #176 |
| L7 | Cycle time: from contract freeze to applied decision took about 3 minutes of machine time. Measured model spend was $1.36; host-session roles are unmeasured. | #179 |
