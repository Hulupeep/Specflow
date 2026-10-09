# TypeSafe evidence quality and reviewer bookkeeping — #158

The problem was a mixture of question ambiguity, limited evidence and manual
review bookkeeping. The previous coverage question asked the model to consider
execution output, even though a correct assertion can fail or be skipped. “No
assertion supplied” and an actual unrelated assertion also lacked a sharp boundary.
One independently reviewed visibility case remains ambiguous; its old label was
preserved and the ambiguity recorded before new evaluation.

The new rubric separates assertion coverage, execution of the selected check and
support for the exact claim. Named execution fields preserve current failures,
stale successes, missing facts and contradictory streams. Code supplies the facts;
TypeSafe still makes fallible semantic judgments. No confidence threshold changed.

Duo previously asked reviewers to transcribe which files they read. The new helper
records successful native tool receipts and derives the inspected list. It rejects
unsupported citations even for partial verification, finding closure and diagnostic
progress. An empty file can be successfully read; a nonempty file whose native
transcript contains no output cannot earn a content receipt. Content access does
not prove comprehension. Completion responses have no new finish instruction;
existing finish gates retain their authority.

## Reproducible fixtures

- `tests/fixtures/typesafe/corpus.json` and the v1 question source remain unchanged.
  `legacy-file-identity.json` fixes their original byte hashes.
- `corpus-v2.json` contains sanitized synthetic-product execution examples and
  historical regression cases, labelled by a separate Claude process without
  TypeSafe predictions or expected labels. Related native cases are not independent
  product families; these are not human gold-standard labels.
- `label-review-v2.json` preserves the reasoning and an ambiguous case that was
  excluded from scored accuracy before provider evaluation. No provider responses
  or benchmark metrics are committed.
- Full workflow and focused tests exercise actual helper boundaries. Tests injecting
  model responses explicitly identify their provider substitutes.

```sh
npm test -- --runInBand
node scripts/typesafe-eval.cjs live \
  --corpus tests/fixtures/typesafe/corpus-v2.json --model jev-1.13.0 \
  --env-file /absolute/path/.env.local --output /private/evaluation
node scripts/typesafe-eval.cjs replay \
  --corpus tests/fixtures/typesafe/corpus-v2.json --model jev-1.13.0 \
  --output /private/evaluation
```

Private verification includes live provider calls, unchanged legacy replay, actual
passing/failing assertion controls, native opposite-CLI reviews and a matched
advisory/off comparison. An independent executable oracle checks exact display
output and mutates a private copy to ensure the command test rejects the wrong
value. Provider errors, ambiguous labels, invalid reviews and missing comparisons
stay visible. These observations do not establish production reliability or a
reduction in review rounds.

The native comparison exposed an empty-diff receipt bug, fixed with a regression.
Final source review also exposed directory-wide Grep content being missed; returned
source lines now earn partial receipts only after matching the frozen file.
Later trials also retained a missing-output protocol rejection before completion.
The complete-variant proof checker's stricter skipped-instruction flag did not pass
because that intermediate response was invalid; it is not represented as a fully
passing fault-injection proof. The final product goals and the actual correction
and re-review results are recorded separately. Runtime identities are retained;
earlier trials are not presented as exact-byte tests of later helper changes.

Detailed provider results remain in the operator's private evidence directory,
under `typesafe-quality-158`. Advisory mode still requires independent peer review
and never grants acceptance, scope changes or release permission.
