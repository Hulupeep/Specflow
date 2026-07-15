# Specflow Model Routing

Specflow model routing lets a project choose which local agent runtime handles
each stage of a larger initiative. The default pattern is:

- expensive thinking and review: Claude/Fable through `claude -p`
- bounded coding, tests, and release prep: Codex CLI through `codex exec`
- thinking level: the policy `effort` field, recorded per route
- approval: Specflow gates, CI, and humans

Models do work. Models do not approve their own work.

## Quick Start

Select the active agent runtime during initial install or any later refresh:

```bash
specflow init . --runtime codex
specflow update . --runtime claude-code
```

CLI `--runtime` takes precedence over `SPECFLOW_RUNTIME`. A non-interactive run
without either value fails before changing active routing. Interactive runs may
prompt for `codex` or `claude-code`.

Activate or refresh routing without reinstalling other files with:

```bash
specflow run --setup-routing --runtime codex
```

All paths install both shipped templates, activate the selected profile, and
write ownership and SHA-256 provenance to `.specflow/install-state.yml`. They do
not launch Claude or Codex. A rerun refreshes managed routing and switches known
shipped profiles. Custom routing remains byte-identical and reports
`custom_routing_preserved`; replace it only with explicit `--replace-routing`.

Start a loop normally:

```bash
specflow run spec-build --slug auth-system --goal "build auth" --input docs/auth-idea.md
```

If routing is active, Specflow stops before provider spend and prints the selected
provider, role, requested model, fallback model, thinking level, budget cap,
transcript path, and output path. Continue only after reviewing the choices:

```bash
specflow run spec-build --slug auth-system --confirm-models
```

Confirmation is scoped to that durable run and the canonical semantics of the
active routing document plus the resolved provider, requested model, effort,
fallback, and budget guard. Specflow writes the confirmation event before
starting the provider. An unchanged run can reuse it after restart; a material
routing change records `routing_semantics_changed` and requires confirmation
again. YAML formatting or key-order changes do not invalidate it. Confirmation
records copied from another run, chat text, and provider output are never
accepted as approval. `specflow run status --contract <path>` reports the current
confirmation hash, scope, timestamp, validity, and invalidation reason.

If routing is not installed, Specflow reports that model routing is inactive and
prints the setup command above. In an interactive terminal, `specflow run` also
asks whether to enable the default routing before it continues. Agents using the
Specflow skill must announce either `Model routing active:` or the setup
instruction before starting `spec-build` or `feature-build`.

## Runtime-Specific Profiles

The loop-selector chooses a shipped profile from the active agent runtime. It
does not infer the runtime from installed directories because every project can
contain `.claude/`, `.codex/`, and `.agents/` together.

| Active runtime | Routing template |
|---|---|
| Claude Code | `.specflow/adapter-policies/claude-code-large-routing.yml` |
| Codex | `.specflow/adapter-policies/codex-gpt56-sol-routing.yml` |

Both profiles require explicit model confirmation before provider execution.
The Codex profile pins the official `gpt-5.6-sol` model ID and routes planning,
review, ticket writing, and implementation through `codex exec`.

## What The Claude Code Profile Does

The template at `.specflow/adapter-policies/claude-code-large-routing.yml`
defines three policies:

| Policy | Runtime | Role | Default model | Thinking level | Fallback | Used for |
|---|---|---|---|---|---|---|
| `fable-planner` | `claude -p` | `planner` | `claude-fable-5` | `xhigh` | `claude-opus-4-8` | discovery and PRD shaping |
| `fable-reviewer` | `claude -p` | `verifier` | `claude-fable-5` | `xhigh` | `claude-opus-4-8` | adversarial review and high-value review |
| `gpt55-coder` | `codex exec` | `implementer` | `gpt-5.5` | `medium` | none | contracts, E2E, oracle wiring, implementation |

The default route map is:

```yaml
routes:
  spec-build:
    discover: fable-planner
    draft: fable-planner
    adversary: fable-reviewer
    tickets: gpt55-coder

  feature-build:
    2_contract: gpt55-coder
    3_e2e: gpt55-coder
    4_oracle: gpt55-coder
    5_impl: gpt55-coder
    review: fable-reviewer
```

The exact file uses expanded YAML objects so each route can carry a reason and
each policy can carry tool permissions, budgets, transcript paths, and human
boundaries. `model`, `requested_model`, and `fallback_model` must be real
provider model IDs accepted by the target CLI, not display shorthand. For
example, Claude policies use `claude-fable-5` and `claude-opus-4-8`.

## Checking And Updating Model IDs

When provider model IDs change, first check the project routing file:

```bash
specflow run --check-routing-models
```

The command reads `.specflow/adapter-routing.yml` and reports known stale
shorthands in `model`, `requested_model`, and `fallback_model`. To apply the
known safe replacements:

```bash
specflow run --update-routing-models
```

This updater is deliberately conservative. It rewrites known aliases such as
`fable-5` to `claude-fable-5` and `opus-4.8` to `claude-opus-4-8`; it does not
invent the latest provider IDs. For newly released models, check the provider
CLI/docs, edit `.specflow/adapter-routing.yml`, then rerun
`specflow run --check-routing-models`.

## Thinking Level

Model routing includes both the model and how hard it should think. In adapter
policies this is the `effort` field:

```yaml
adapter_policy:
  requested_model: claude-fable-5
  role: planner
  effort: xhigh
```

Specflow currently accepts these effort values:

| Effort | Intended use |
|---|---|
| `low` | cheap, bounded chores where mistakes are easy to catch |
| `medium` | normal coding, contract expansion, test writing |
| `high` | hard implementation, debugging, or local design choices |
| `xhigh` | expensive planning, adversarial review, architecture, falsification |
| `ultracode` | provider-specific maximum coding/reasoning mode, only when supported |

Effort is policy metadata, not a gate. A high-effort model output still has to
pass Specflow gates, CI, and any human approvals. Provider effort labels can
change over time, so keep them thin and easy to edit.

## Budget Caps, Quota, And Codex Auth

`max_budget_usd` is a **policy cap / quota guard**, not a prediction and not a
guaranteed charge. It exists so a routed adapter has a ceiling when the provider
supports budget enforcement or reports metered usage.

For Codex specifically, billing depends on how the Codex CLI is authenticated:

- **Signed in with ChatGPT:** Codex usage counts against your Codex plan
  quota/credits for that ChatGPT plan or workspace.
- **Signed in with an API key:** Codex uses normal OpenAI API billing for that
  Platform organization.

So an option like `gpt55-coder, max_budget_usd: 8` should be described as:

```text
gpt55-coder via codex-exec, effort medium, budget cap/quota guard $8.
If Codex CLI is signed in with ChatGPT, this consumes Codex plan quota/credits,
not OpenAI API billing.
```

Do not present the cap as "`$8` cost" unless the adapter has actually reported
metered usage.

## Why Confirmation Is Mandatory

Fable/frontier routes are expensive and easy to trigger accidentally in a resumed
automation. Specflow therefore treats routed provider execution as a human
spend/quota decision:

1. Resolve the current loop stage from the durable run contract.
2. Look up the matching route in `.specflow/adapter-routing.yml`.
3. Print the selected provider/model plan.
4. Stop with `model_confirmation_required`.
5. Run the provider only when the operator reruns with `--confirm-models`.

That confirmation does not approve the work product. It only approves spending
or quota use for the selected model on the current stage. The owning Specflow
gate must still rerun before the loop advances.

## How It Works Technically

`specflow run` reads the durable run contract from:

```text
.specflow/runs/<slug>/run-contract.yaml
```

The current stage is stored as `current_stage_or_rail`. When no explicit
`--adapter-policy` is passed, the runner searches for:

```text
.specflow/adapter-routing.yml
.specflow/adapter-routing.yaml
.specflow/adapter-routing.json
```

It supports either dotted route keys:

```yaml
routes:
  spec-build.discover:
    policy: fable-planner
```

or nested route keys:

```yaml
routes:
  spec-build:
    discover:
      policy: fable-planner
```

The selected policy is normalized like any other adapter policy. The runner then
records routing metadata in the JSONL ledger:

```json
{
  "event": "model_confirmation",
  "stop_reason": "model_confirmation_required",
  "provider": "claude-print",
  "role": "planner",
  "effort": "xhigh",
  "requested_model": "claude-fable-5",
  "fallback_model": "claude-opus-4-8",
  "max_budget_usd": 20
}
```

After `--confirm-models`, adapter execution records the policy id, routing path,
role, effort, requested model, effective model when reported by the provider,
transcript path, output path, and whether the gate must rerun.

## Changing The Defaults

Edit:

```text
.specflow/adapter-routing.yml
```

If the file does not exist yet, run
`specflow run --setup-routing --runtime codex|claude-code` first.

To use Opus as the primary reviewer instead of Fable, change the reviewer policy:

```yaml
policies:
  fable-reviewer:
    adapter_policy:
      requested_model: claude-opus-4-8
      model: claude-opus-4-8
      effort: high
      fallback_model: null
      max_budget_usd: 8
```

To lower planning spend, keep Fable but reduce the thinking level:

```yaml
policies:
  fable-planner:
    adapter_policy:
      requested_model: claude-fable-5
      model: claude-fable-5
      effort: high
      max_budget_usd: 12
```

To make Codex use a different model for implementation:

```yaml
policies:
  gpt55-coder:
    adapter_policy:
      requested_model: gpt-5.5
      model: gpt-5.5
      effort: medium
```

To add a route for a new stage:

```yaml
routes:
  feature-build:
    6_provenance:
      policy: gpt55-coder
      reason: provenance evidence assembly
```

To disable automatic routing for a stage:

```yaml
routes:
  spec-build:
    tickets:
      policy: none
```

To make a low-cost stage run without confirmation, override that route only:

```yaml
routes:
  spec-build:
    tickets:
      policy: gpt55-coder
      confirm_models: false
```

Keep confirmation enabled for expensive planning/review routes unless you have a
separate budget control outside Specflow.

## Claude Code And Codex

If you are in Claude Code and the Claude profile is installed:

- planning/review routes call `claude -p`
- coding routes call `codex exec`

If you are in Codex, the Codex profile routes every generative stage through
`codex exec` with `gpt-5.6-sol`. Planning and adversarial review use higher
reasoning effort than bounded ticket writing and implementation. The policy
passes `model_reasoning_effort` explicitly because Specflow's `effort` field is
also retained as routing and ledger metadata.

## Safety Rules

- Do not put subscription secrets in adapter routing files.
- Do not grant push, merge, production deploy, `--no-verify`, or contract
  override permissions to model policies.
- Treat direct `--adapter-policy <path>` as a one-off override and announce the
  selected provider/model before invoking it.
- Do not treat provider output as a gate result. Provider output is work product;
  Specflow gates, CI, and human sign-offs decide whether work advances.
