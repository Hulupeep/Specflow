#!/bin/bash
# Specflow model-switch hook — binds the routing policy to Claude Code's
# PreModelSwitch / PostModelSwitch events (#128, CB-002 / CB-003).
#
# Usage (from .claude/settings.json):
#   model-switch-hook.sh pre    # PreModelSwitch  — may block (exit 2)
#   model-switch-hook.sh post   # PostModelSwitch — ledgers the switch
#
# stdin: Claude Code hook JSON with "from_model" and "to_model".
#
# pre:  for every non-terminal run whose current stage is top-thinker work
#       (adversary, persona_lens, falsify_subrun, GATE_B5), look up the routed
#       policy in .specflow/adapter-routing.yml. Allow the switch if to_model is
#       that policy's requested model OR its declared fallback model (a provider
#       forced fallback lands on the declared fallback). Anything else is a
#       downgrade during a stage that must not run on a cheap model → exit 2.
#       Every lookup failure FAILS OPEN (no run, no routing file, no js-yaml):
#       the hook never false-blocks; it only blocks a definite mismatch.
# post: append {event: model_switch, from_model, to_model, kind} to the ledger of
#       every non-terminal run, so a silent downgrade can never be invisible.
#       kind = "fallback" when to_model is the declared fallback, else "switch".
#
# Exit codes:
#   0 — allowed / ledgered / nothing to do
#   2 — (pre only) switch blocked; reason on stderr

set -u

MODE="${1:-pre}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RUNS_DIR="$PROJECT_DIR/.specflow/runs"
INPUT=$(cat 2>/dev/null || echo "{}")

[ -d "$RUNS_DIR" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0

FROM_MODEL=$(echo "$INPUT" | jq -r '.from_model // empty' 2>/dev/null)
TO_MODEL=$(echo "$INPUT" | jq -r '.to_model // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$TO_MODEL" ] || exit 0

ROUTING=""
for candidate in adapter-routing.yml adapter-routing.yaml adapter-routing.json; do
  if [ -f "$PROJECT_DIR/.specflow/$candidate" ]; then
    ROUTING="$PROJECT_DIR/.specflow/$candidate"
    break
  fi
done

yaml_field() {
  awk -v key="$2" '
    $0 ~ "^  " key ":" {
      sub("^  " key ":[ \t]*", "", $0)
      gsub(/^["'"'"']|["'"'"']$/, "", $0)
      print $0
      exit
    }' "$1" 2>/dev/null
}

is_top_thinker() {
  case "$1" in
    adversary|persona_lens|falsify_subrun|GATE_B5) return 0 ;;
    *) return 1 ;;
  esac
}

# Resolve the routed policy for <loop>/<stage> and classify TO_MODEL against it.
# Prints one JSON line: {"match":"requested|fallback|none|unrouted","policy":..,"model":..,"fallback":..}
classify_model() {
  local loop="$1" stage="$2"
  SPECFLOW_ROUTING="$ROUTING" SPECFLOW_LOOP="$loop" SPECFLOW_STAGE="$stage" SPECFLOW_TO_MODEL="$TO_MODEL" \
  SPECFLOW_PROJECT_DIR="$PROJECT_DIR" node -e '
    const fs = require("fs");
    const path = require("path");
    const out = (o) => { process.stdout.write(JSON.stringify(o) + "\n"); process.exit(0); };
    const unrouted = { match: "unrouted", policy: null, model: null, fallback: null };
    const file = process.env.SPECFLOW_ROUTING;
    if (!file || !fs.existsSync(file)) out(unrouted);
    let doc;
    try {
      const text = fs.readFileSync(file, "utf8");
      if (/\.json$/i.test(file)) doc = JSON.parse(text);
      else {
        let yaml = null;
        const root = process.env.SPECFLOW_PROJECT_DIR;
        for (const candidate of ["js-yaml", path.join(root, "node_modules", "js-yaml"), path.join(root, "node_modules", "@colmbyrne", "specflow", "node_modules", "js-yaml")]) {
          try { yaml = require(candidate); break; } catch (_) { /* try next */ }
        }
        if (!yaml) out(unrouted);
        doc = yaml.load(text);
      }
    } catch (_) { out(unrouted); }
    const loop = process.env.SPECFLOW_LOOP, stage = process.env.SPECFLOW_STAGE;
    const routes = (doc && doc.routes && doc.routes[loop]) || {};
    const route = routes[stage] || routes.adversary || null;   // unrouted top-thinker stages inherit the adversary tier
    if (!route || !route.policy) out(unrouted);
    const entry = doc.policies && doc.policies[route.policy];
    const policy = entry && (entry.adapter_policy || entry);
    if (!policy) out(unrouted);
    const norm = (m) => String(m || "").toLowerCase().replace(/\[1m\]$/, "").replace(/-\d{8}$/, "");
    const same = (a, b) => a && b && (a === b || a.startsWith(b) || b.startsWith(a));
    const to = norm(process.env.SPECFLOW_TO_MODEL);
    const requested = norm(policy.requested_model || policy.model);
    const fallback = norm(policy.fallback_model);
    const match = same(to, requested) ? "requested" : same(to, fallback) ? "fallback" : requested ? "none" : "unrouted";
    out({ match, policy: route.policy, model: policy.requested_model || policy.model || null, fallback: policy.fallback_model || null });
  ' 2>/dev/null || echo '{"match":"unrouted","policy":null,"model":null,"fallback":null}'
}

blocked=0
for contract in "$RUNS_DIR"/*/run-contract.yaml; do
  [ -f "$contract" ] || continue
  slug=$(basename "$(dirname "$contract")")
  loop=$(yaml_field "$contract" loop)
  stage=$(yaml_field "$contract" current_stage_or_rail)
  status=$(yaml_field "$contract" terminal_status)
  case "${status:-in_progress}" in
    handoff|done|complete|completed) continue ;;
  esac

  verdict=$(classify_model "$loop" "$stage")
  match=$(echo "$verdict" | jq -r '.match // "unrouted"')
  policy=$(echo "$verdict" | jq -r '.policy // "unrouted"')
  model=$(echo "$verdict" | jq -r '.model // "unknown"')
  fallback=$(echo "$verdict" | jq -r '.fallback // "none"')

  if [ "$MODE" = "post" ]; then
    ledger="$(dirname "$contract")/ledger.jsonl"
    kind="switch"
    [ "$match" = "fallback" ] && kind="fallback"
    jq -cn \
      --arg recorded_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg stage "${stage:-unknown}" \
      --arg from "$FROM_MODEL" --arg to "$TO_MODEL" --arg kind "$kind" \
      --arg policy "$policy" --arg requested "$model" --arg session "$SESSION_ID" \
      '{recorded_at:$recorded_at, stage:$stage, event:"model_switch", source:"hook:PostModelSwitch",
        from_model:$from, to_model:$to, kind:$kind, routed_policy:$policy, requested_model:$requested,
        session_id:$session}' >> "$ledger" 2>/dev/null
    continue
  fi

  # pre: only top-thinker stages are guarded, and only a definite mismatch blocks.
  is_top_thinker "$stage" || continue
  if [ "$match" = "none" ]; then
    echo "Specflow blocked the model switch to '$TO_MODEL': run '$slug' is at '$stage' (top-thinker stage) and routing policy '$policy' requires '$model' (declared fallback: $fallback). Finish or escalate the stage first, or change .specflow/adapter-routing.yml deliberately." >&2
    blocked=1
  fi
done

[ "$blocked" -eq 1 ] && exit 2
exit 0
