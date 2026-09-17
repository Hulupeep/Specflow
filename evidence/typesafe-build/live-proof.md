# Live installed-workflow proof

This is implementation verification, not a provider benchmark. Provider outputs
and evaluation metrics remain in private, ignored records and are not published.

The final protocol-regression fixture is run `1789668636507-9c611581`:

1. Installed the current helper/skill into a fresh synthetic project using the
   normal installer. The harness selected the Claude host; no human Claude
   interactive session is claimed. A real `codex exec` peer reviewed the frozen
   source, actual execution output and live TypeSafe advice.
2. The deliberately incomplete calculation returned 20 instead of 18 and the
   test checked only type. Codex returned `changes_required`, with stable value
   and exact-assertion findings. The helper retained both findings.
3. The builder (this Codex session, using an external fixture harness) corrected
   the calculation and added a full exact-object assertion. The stronger test
   failed against the old calculation, then passed after the correction.
4. Released the old host and resumed with the Codex host adapter. A real
   `claude -p` peer accepted the correction and closed both findings. TypeSafe
   was unavailable in that round; the helper explicitly recorded this and
   ordinary required peer review still completed.
5. A separate provider-recovery verification batch on the same run retained
   history/counters and obtained live repair judgments plus evidence-backed
   peer dispositions. Claude accepted it; `finish` reported all three fixture
   criteria verified, zero open findings, goal complete.

Both peer CLIs and the TypeSafe API were real. The host-selection wrapper and
synthetic employee facts were a harness, not a claim of human interaction or a
supported jurisdiction. No production customer data was submitted.

Earlier exploratory run `1789667909335-a8458d26` remains blocked and preserved.
It exposed citation validation/schema mismatches. Its counters and findings
were not reset, and it is not claimed complete. The revised protocol was tested
in the distinct regression fixture above; the successful proof did not erase
those failures.

The source-review run `1789667839388-19d276f0` independently reviewed the code
and adjudicated the corpus before live held-out inference. Initial findings
corrected coverage labels, separated control/edge denominators, reconciled PRD
status and disclosed omitted snapshot paths. A subsequent finding required one
fresh full-suite execution after the last protocol change; final raw output is
in tests-final.txt, followed by final combined-tree verification.

Actual package proof is in package-proof.json: npm pack (including the normal
prepack normalization), npm installation into a temporary consumer, both native
host installations, helper byte comparison and both peer-authentication checks.
The package has not been published to npm.
