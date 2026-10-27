# Gate D outcome acceptance

Gate D accepts the integrated working outcome after slices merge. It reuses the accepted parent verification contract and current native Jest/Playwright execution. It calls no model and grants no merge or deployment authority.

```sh
node scripts/teardown-gate.cjs check-gate-d gate-d/EPIC/
# Report lint only: outcome_acceptance = not_evaluated, including a valid red report.

node scripts/teardown-gate.cjs accept-gate-d gate-d/EPIC/ \
  --run-dir .specflow/runs/ACCEPTED-VERIFIER --repo-root .

specflow run gate-d --input gate-d/EPIC/ \
  --run-dir .specflow/runs/gate-d-EPIC \
  --verification-run-dir .specflow/runs/ACCEPTED-VERIFIER --repo-root .
```

The acceptance commands return zero only for `outcome_acceptance: passed`. Report validity is separate. The runner starts at `GATE_D`, uses the epic prompt, and consumes owning acceptance before any provider or generic stage evidence. Historical runs positioned at other rails need explicit migration; they cannot silently advance.

Materialize `journey-map.md` and `findings.md` with one entry per accepted hop. Findings need exactly one `status:` or `result:` line: `green`, `passed`, `red`, `failed`, `blocked`, `missing`, `skipped`, `stale`, `unsupported` or `waived`. Required hops accept only green/passed, then still need fresh actual proof. A bug disposition or named amendment never repairs the outcome. Duplicate, unknown or missing hop IDs and unsafe/dangling references invalidate the report. Value-bearing report entries retain `.txt`/`.json` evidence requirements; file existence and screenshots do not prove correctness.

By default the accepted `journey_id` maps to every required parent obligation. For multiple hops, the optional protected extension is:

```json
{
  "acceptance": {
    "hops": [{"id": "CALCULATE", "obligation_ids": ["O-values"]}],
    "signoff_required": false
  }
}
```

This lives **inside `outcome_contract`**, with the other parent fields. All required obligations must be mapped. Check IDs derive from existing obligations; there is no second check inventory. Changes follow the existing protected outcome amendment mechanism.

Gate D derives every required configuration, executes its applicable checks and reconciles every obligation/configuration/check pair. Native children receive `SPECFLOW_CONFIGURATION_ID` and `SPECFLOW_ENVIRONMENT`; tests must actually select/validate the relevant backend or route. Labels alone do not provision or prove an environment. Shared checks select the active configuration's protected oracle comparisons and data seams. After the last configuration, earlier genuine receipts, artifacts, source/input/oracle/schema bindings, report bytes and latest acceptance are revalidated. Saved JSON and historical passing ledger rows cannot fill missing current proof.

Signoff is off by default. An existing legacy required signoff with no explicit protected setting blocks for migration; it cannot silently disappear. An explicitly accepted protected true/false setting supersedes legacy attribution. A project requiring `signoff_required:true` gets a blocked result with an `approval_scope`. Reuse the existing GitHub OWNER comment plus detached Ed25519 `ownerException` procedure, naming a line `gate-d:<approval_scope>` in its signed reason. Supply `--approval-record`, `--approval-comment` and `--approval-signature` to either acceptance route. The scope covers the accepted contract, source, all configuration bindings and report inputs. New timestamped receipts are excluded so unchanged approved work can be freshly executed again. Local `signoff-policy.json`, hash-only `.signoff.json` and `signed_by` cannot satisfy or disable this protected requirement. Agents must never manufacture owner authority.

A reported waiver remains non-passing and is not authenticated merely by its status word. Existing legacy `sign`/`check-sign` remain hash-bound attribution checks; they detect edits after attribution but do not authenticate the human signer. Oracle amendment authorisation still requires fresh execution afterwards.

The ledger records report validity, final outcome, required tuple states and scope. `specflow run trace` presents a historical Gate D result and current scope diagnostics; it explicitly does not grant fresh acceptance from stored hashes. Rerun acceptance for that.

The native fixture journey uses synthetic 900/90 expectations, a real CLI, persistence and adversarial configuration/artifact/signature controls. This establishes harness behaviour. It does not certify a real product, malicious accepted checker, undeclared dependency or released host installation; those need their own current proof.
