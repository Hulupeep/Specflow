# Verifier Runtime Lifecycle Ticket Packet

**Source epic:** #100
**Amends:** #84, #92
**Loop:** spec-build

## Scope

These tickets turn the verifier epic into feature-buildable slices. The trust boundary is non-negotiable: maker proposes, verifier attacks, mechanical gate decides, ledger remembers.

## Tickets

### VERIFIER-CONTRACT-01 - Persist verification proposal and accepted contract before implementation

**Journey:** `J-VERIFIER-CONTRACT-LIFECYCLE`

Acceptance:
- Feature-build can write `.specflow/runs/<slug>/verification-proposal.md` before maker implementation starts.
- A verifier can accept or reject the proposal and write `.specflow/runs/<slug>/verification-contract.json` only on acceptance.
- Rejected proposals block maker implementation and name the missing runtime/value/negative-path check.
- The accepted contract includes journey ID, maker policy, verifier policy, runtime checks, forbidden evidence, and accepted timestamp.
- Ledger entries reference proposal path, verifier decision, accepted contract path, and current mechanical gate state.
- A provider exit code or maker summary cannot satisfy this ticket.

### VERIFIER-POLICY-01 - Run verifier policy in isolated artifact/spec/rubric context

**Journey:** `J-VERIFIER-POLICY-ISOLATION`

Acceptance:
- Adapter policy can declare a verifier policy distinct from maker policy.
- Verifier input includes artifact path, outer spec/ticket, accepted verification contract, and rubric.
- Verifier input excludes maker reasoning transcript by default.
- Any exception that includes maker trace requires a human-recorded exception in the ledger.
- Verifier output path and transcript path are separate from maker output and transcript paths.
- Gate advance remains blocked until the owning mechanical gate reruns.

### VERIFIER-RUNTIME-01 - Collect adversarial runtime evidence for UI/workflow slices

**Journey:** `J-VERIFIER-RUNTIME-EVIDENCE`

Acceptance:
- Verification contracts can declare runtime checks of type `playwright`, `api`, `db-reread`, `console`, `network`, `screenshot`, or `custom-script`.
- UI/workflow slices require at least one executable runtime check when the journey can pass static checks while failing in the app.
- State-changing or value-bearing slices require an API, DB, or custom-script reread assertion; screenshot-only evidence is insufficient.
- Runtime verifier findings are written to `verifier-findings.jsonl` with severity, check type, maker claim, verifier result, gate result, and evidence path.
- Missing executable surface creates a blocked verifier finding instead of fabricated evidence.
- Runtime verifier verdict is evidence only; the owning journey/mechanical gate still decides.

### VERIFIER-TRACE-01 - Show maker claim, verifier finding, gate result, and divergence

**Journey:** `J-VERIFIER-TRACE-DIVERGENCE`

Acceptance:
- `specflow run status`, `specflow run trace`, or the equivalent status surface can read verifier lifecycle ledger entries.
- Output groups maker claim, verifier finding, mechanical gate result, and final disposition separately.
- Divergence is highlighted when maker claims done but verifier fails, verifier passes but mechanical gate fails, evidence paths are missing, or a human-gated action is attempted.
- Missing transcript/evidence/model fields are reported as missing or unknown, not inferred.
- Trace does not send transcript content to a provider by default.
- The output links the accepted verification contract and verifier finding paths.

## Parent Issue Body Update

#100 should remain the epic. Feature-build can implement these four tickets either as local slices or as child GitHub issues. If child issues are created, each body must include its journey ID and link back to #100.
