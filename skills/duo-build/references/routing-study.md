# Routing study

This is explicit, private shadow collection. It never switches the interactive
host model or its effort. Fresh runs snapshot enrollment; existing runs keep their
pinned runtime and settings. Update the installed kit before starting a new run.

Initialize a private study outside Git with an explicit registered-project list,
family split and budget, then enroll each selected project:

```sh
node scripts/typesafe-routing.cjs init /private/study /private/manifest.json
node scripts/typesafe-routing.cjs enable /private/study /path/to/project /private/context.json
```

`context.json` contains `contextFiles` (selected relative text paths) and optionally
`envFile` (absolute protected `.env` path). Otherwise the existing TypeSafe key
comes from the process environment. Neither the key nor undisclosed source belongs
in Git. The normal runner records each stage; Duo records explicit batch starts.

Manifest example (replace projects and register canonical held-out families before
collecting scored trials; the empty split permits only shadow collection):

```json
{
  "version": 1, "id": "routing-pilot", "projects": ["https://github.com/owner/repo"],
  "jevModel": "jev-1.13.0", "model": "claude-opus-5-5", "efforts": ["medium", "high"],
  "baseline": {"spec-build": "medium", "feature-build": "medium"},
  "budget": {"typesafe": 100, "native": 120},
  "maxPerRun": {"typesafe": 10, "native": 4},
  "timeoutMs": 15000, "nativeTimeoutMs": 180000, "maxOutputBytes": 1048576,
  "reviewer": {"model": "gpt-5.5", "effort": "medium"},
  "taskClass": "bounded-file-change", "maxRepairRounds": 0,
  "seed": 160, "resamples": 10000, "primaryMetric": "elapsedMs",
  "calibrationFamilies": [], "heldoutFamilies": []
}
```

Family keys are JSON strings containing `[repository, canonicalTaskFamilyId]`.
Use one canonical ID for retries/duplicate issue references and related stages.
The first registered indexed stage is frozen for that family; subsequent changed
cases are refused. New questions, policy, model or manifest need a new cohort.

```sh
node scripts/typesafe-routing.cjs trial /private/study /private/case.json
node scripts/typesafe-routing.cjs report /private/study
```

A case contains `repository`, `taskFamilyId`, `loop`, `stage`, `goal`, exact
`acceptance`, `independentUnit: true`, `files` (selected text snapshot), `editable`
(path allowlist), and `oracle: {path, requiredChecks}`. The oracle is an immutable
Node program in that snapshot; stdout must be JSON
`{"checks":[{"id":"AC-1","status":"passed"}]}`. Each required ID must execute;
missing or skipped checks are never success. Include relevant repository
instructions in the snapshot. The harness uses real `claude -p`, medium and high,
with identical structured-edit input and no tool access. It applies only allowed
file changes in fresh temporary workspaces, executes the oracle with Linux
`bwrap` (read-only host, no network), then calls a blinded, read-only `codex exec`
reviewer. This first study covers bounded file changes with zero repair rounds;
it does not represent unrestricted whole-project builds.

Both CLIs must be installed and authenticated. Auth/model errors stay unavailable.
Requested flags are recorded separately from native metadata; missing effective
effort, fallback, clamps, missing review oracles and substitutes are noncomparable.
No guess from a model's prose supplies the missing effective setting. Real trials
may therefore be recorded but not scoreable on a particular CLI version.

Calls reserve study-wide and per-run capacity before dispatch. Zero disables a
budget. Timeouts/crashes keep their reservation and retries do not refund it.
Duplicate trial calls replay retained results or report interruption. If a lock is
left by a dead process, inspect its owner and outstanding reservations before
removing only the stale lock directory; retain all events. No uncertain trial is
relaunched automatically. Output/time/call limits are enforced; actual billing
and plan quota remain unknown unless the provider exposes them. No money cap is
claimed.

For independent question labels, give an assessor only `inputs/<decision>.json`,
without the provider answer or proposal. Save reviewer identity, inputHash,
decisionId, `blinded: true`, evidenceRefs and `labels` keyed by the five question
names; a label is a criterion key or null for ambiguity. Ingest with
`node scripts/typesafe-routing.cjs label /private/study /private/labels.json`.
Label disagreements are reported separately from statistical uncertainty.

Reports appear at 10/30 distinct terminal shadow families and 30/100 attempted
held-out pairs. Status exposes pending links; ack only after presentation. There
is no timer. The first paired report is descriptive; only the frozen 100-pair look
can suggest limited adoption, and still cannot enable routing. Missing coverage,
unknown settings, skipped checks or incomplete outcomes remain visible. Reports
are reproducible locally without another model call. GitHub receives sanitized
progress prose only. Study issue #160 remains open until the first real reports
are delivered, even after instrumentation merges.
