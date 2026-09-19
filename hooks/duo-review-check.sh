#!/usr/bin/env bash
set -euo pipefail
[ -n "${SPECFLOW_DUO_REVIEWER:-}" ] && exit 0
root="${CLAUDE_PROJECT_DIR:-$PWD}"
if [ ! -f "$root/scripts/duo-cadence.cjs" ]; then
  # A partial installation must not interrupt unrelated Claude conversations.
  input=$(cat)
  session=$(jq -r '.session_id // empty' <<< "$input")
  [ -z "$session" ] && exit 0
  shopt -s nullglob
  runs=("$root"/.specflow/duo/*/run.json)
  [ "${#runs[@]}" -eq 0 ] && exit 0
  if ! jq -e -s --arg session "$session" 'any(.[]; .goalStatus != "complete" and .owner.builder == "claude-code" and .owner.hostSession == $session)' "${runs[@]}" >/dev/null; then
    exit 0
  fi
  echo '{"continue":false,"stopReason":"Duo cadence helper is missing. Repair the SpecFlow installation; no peer verification is implied."}'
  exit 0
fi
exec node "$root/scripts/duo-cadence.cjs" --hook
