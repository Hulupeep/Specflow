#!/bin/bash
# Specflow SessionStart hook — re-entry briefing from durable run state.
#
# Prints, for every non-terminal Specflow run under .specflow/runs/, the
# position the runner would resume from: loop, current stage/rail, next gate,
# terminal status, and the last ledger entry. The authoritative position is the
# committed run-contract.yaml — never model memory (CB-004 / #128).
#
# Output goes to stdout, which Claude Code adds to the session context.
# Exit codes:
#   0 — always (a missing runs dir is normal; a briefing is advisory)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RUNS_DIR="$PROJECT_DIR/.specflow/runs"

[ -d "$RUNS_DIR" ] || exit 0

# Read a top-level run_contract field from the YAML (2-space indent, first match).
yaml_field() {
  awk -v key="$2" '
    $0 ~ "^  " key ":" {
      sub("^  " key ":[ \t]*", "", $0)
      gsub(/^["'"'"']|["'"'"']$/, "", $0)
      print $0
      exit
    }' "$1" 2>/dev/null
}

briefed=0
for contract in "$RUNS_DIR"/*/run-contract.yaml; do
  [ -f "$contract" ] || continue
  slug=$(basename "$(dirname "$contract")")
  loop=$(yaml_field "$contract" loop)
  stage=$(yaml_field "$contract" current_stage_or_rail)
  gate=$(yaml_field "$contract" next_gate)
  status=$(yaml_field "$contract" terminal_status)
  [ -n "$status" ] || status="unknown"

  case "$status" in
    handoff|done|complete|completed) continue ;;
  esac

  if [ "$briefed" -eq 0 ]; then
    echo "## Specflow re-entry briefing (durable state, not memory)"
    echo
    briefed=1
  fi

  ledger="$(dirname "$contract")/ledger.jsonl"
  last_entry=""
  if [ -f "$ledger" ]; then
    last_line=$(tail -n 1 "$ledger" 2>/dev/null)
    if [ -n "$last_line" ] && command -v jq >/dev/null 2>&1; then
      last_entry=$(echo "$last_line" | jq -r '[.recorded_at // "", .stage // "", .event // .status // ""] | map(select(length > 0)) | join(" · ")' 2>/dev/null || echo "")
    fi
    [ -n "$last_entry" ] || last_entry="$last_line"
  fi

  echo "- run: $slug"
  echo "  loop: ${loop:-unknown}   stage: ${stage:-missing}   status: $status"
  echo "  next gate: ${gate:-missing}"
  [ -n "$last_entry" ] && echo "  last ledger: $last_entry"
  echo "  contract: ${contract#$PROJECT_DIR/}"
done

if [ "$briefed" -eq 1 ]; then
  echo
  echo "Resume with: npx @colmbyrne/specflow run status --contract <contract path>. Advance from the durable stage above, not from what you remember."
fi

exit 0
