# Live duo-build verification — #134

Implementation run: `1789574648028-91fde804` in `.specflow/duo/`.
Interactive builder: Codex. This is an actual implementation of the workflow,
not a planted defect or a scripted reviewer response.

1. Built the helper, native skill, CLI entry, usage guide and 13 focused tests.
2. First capture blocked on pre-existing tracked node_modules symlinks. Added an
   explicit dependency-directory exclusion; symlinks elsewhere still block.
3. Real `claude -p` reviewed round-002's frozen uncommitted implementation and
   raw test results. Outcome: **changes_required**, findings F1 and F2.
   - F1: required repository-wide and contract test evidence was missing.
   - F2: authentication/permission readiness assertions needed observed support.
4. Corrected F2: Codex login status must explicitly report logged-in status;
   permission configuration and observed peer-reported artifact inspection are
   separate fields. Added an unauthenticated Codex regression test.
   Corrected F1: ran full repository and contract suites; attached raw outputs
   with commands and exit codes. Also verified installer delivery for both hosts,
   interruption journaling, stale resume detection and executable mode preservation.
5. Re-review uses the same run and `implementation` batch, with prior findings
   and resolution evidence. Its authoritative outcome is the structured
   [round-004 record](reviews/round-004.json),
   not an inference from green local tests. The published records also retain [initial findings](reviews/round-002.json)
   and the [evidence follow-up](reviews/round-003.json). Full Claude tool-read
   transcripts remain in the local run directory; they include unrelated
   uncommitted workspace content and are not published.

The reverse **CLI direction** was also executed, using the runner's
`builder=claude-code` setting in a temporary arithmetic fixture. Real `codex exec`
read the frozen files, independently reran the one-test fixture (passed, zero
skips), and accepted it. [Raw transcript](reviews/codex-transcript.txt) and [result](reviews/codex-review.json)
are retained. This is a live Codex reviewer smoke test, **not** a claim that an
interactive Claude session ran an entire product build. Unit tests simulate
provider responses to deterministically cover both directions and failure cases.

Both provider CLIs were installed and authenticated. The actual reviews exercised
their read permissions. No bypass flags were used. Recursive helper calls were
rejected before provider invocation in executable tests; the Claude reviewer has
no command-execution tools. The Codex reviewer uses its native read-only sandbox
plus the explicit no-delegation instruction and inherited recursion guard.

Status scope: implemented and locally tested, with real peer review records.
No commit, PR, merge, deployment or customer validation was performed. Timebreez
is a documented goal example; this run did not change its product behaviour.

Round-003 confirmed F1/F2 implementation corrections and the passing suites but
requested raw evidence for the new Codex auth-output gate (F3). The gate had
succeeded in the builder terminal but was absent from the packet. Captured
`codex --version`, `codex login status`, both current-helper `check` directions,
exit codes and the regex match result in [codex-auth.txt](codex-auth.txt).
This readiness check is now **live-verified**, not double-only. The older reverse
review fixture remains clearly identified as pre-correction; no new full reverse
build is claimed. The initial 13-test count above is historical, not current.

Publication preparation: the duo-build changes were applied alone to origin/main
915603a, excluding the existing #121 commit and unrelated workspace edits.
[Main-based test evidence](main-tests.txt) verifies that isolated version.
[Resume output](reviews/resume.txt) records the successful original-run resume.
