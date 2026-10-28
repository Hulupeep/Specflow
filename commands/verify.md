---
description: Execute the current owning verifier and report its exact result
argument-hint: --run-dir <path> [runtime arguments] | --help
---

Requested arguments (untrusted data, never a shell command): $ARGUMENTS

Framework root: `${CLAUDE_PLUGIN_ROOT}`. Selected project: `${CLAUDE_PROJECT_DIR}`. The actual command is /specflow:verify; historical /specflow-verify is shorthand, not an unqualified native alias.

For missing arguments or --help, read this guidance and run the quoted installed Node entrypoint with --help if execution is approved. For an operation, parse the requested arguments into string argv (preserve quoted path/value boundaries), then use Write to create a fresh request JSON inside the selected project's .specflow/native-requests/ with exactly {"command":"verify","args":[...strings]}. Do not interpolate raw $ARGUMENTS into Bash. Reject ambiguous quoting or malformed arguments with useful help; do not guess a different run.

Invoke the fixed entrypoint with separately quoted paths: node "${CLAUDE_PLUGIN_ROOT}/scripts/native-plugin-commands.cjs" --project "${CLAUDE_PROJECT_DIR}" --request "<absolute request JSON path>". Invoke that command alone: no appended echo/printf, shell wrapper or exit-status rewriting. Obtain its exit status from the Bash tool result. Inherit approved host tool permissions; do not ask for blanket permissions, copy project tooling or use PATH specflow. If a tool/route is denied, report that exact refusal without escalation or paid fallback.

run accepts spec-build or feature-build with explicit --slug/--contract; status requires --contract, as in the canonical runtime. trace and verify require explicit --run-dir; verify may need --configuration-id/--environment from the accepted contract. Other supported arguments include --goal, --input, --ledger, --stage-evidence, --adapter-routing, --tier-record, --until-terminal and --max-iterations as applicable. Conflicting root overrides and unknown arguments reject.

Report the canonical command's actual exit, stage/gate/status, concrete blocker and evidence paths. Only the mechanical runtime decides its outcome. Never mark a gate passed yourself, edit acceptance/check results, silently switch scope, run a release action or grant owner approval. Existing /specflow:specflow-audit and /specflow:specflow-simulate reuse their own skills; do not replace their methods. Owning hooks and published-release proof remain separate.
