# Historical Pastor observations and original proposal

Source: https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374

## Implementation brief for the Specflow agent building SPEC-DENSITY

**Read this before starting any ticket in this epic.** It records what one full spec-build run produced in practice: which parts earned their cost, and which were theatre. The tier design follows directly from it.

### Source run

Hulupeep/pastor, epic E09 (#47–#64), 2026-09-22..23, run as spec-build.

| Stage | What ran |
|---|---|
| discover / draft | done |
| Adversary | 4 cycles: structural critic, falsification, persona lens |
| GATE_A | owner-accepted |
| Tickets | 13 stories, one later split into 4 |
| GATE_B | traceability, seams, graph |
| GATE_B5 | simulation, then 2 pre-flight rounds |

Output: about 320 REQs, about 360 ACs, 13 contract packages, 160 declared fixtures, 66 recorded decisions. The target code depended on V1/V2 stories that did not exist, and a parser that had never opened the real archive.

---

### What did real work. Keep it, and point it at the right tier

1. **An adversary pass on irreversible decisions.**
   - The first cycle found contradictions that would have meant rewrites or silent data corruption after code existed:
     - A model-provider design silently broke a Baseline offline requirement.
     - User-authored corrections were stored only in the derived, rebuildable store, which violates the owner's storage decision.
     - A network-isolation design could not be built with the chosen sandbox.
     - "Run-stable" keys re-keyed whenever group membership changed, so rejected claims came back as active.
     - The work re-implemented test vectors another story already owned.
   - **Keep:** one adversary pass, scoped to storage and ownership, privacy, destructive operations, identity and keys, and external data flows. Run it at `contracted`.
2. **Privacy checks that are verified mechanically.** They found exact file sizes and hash-shaped values in shared artifacts. They also found that the scanner itself was blind to rounded sizes and hashes.
   - **Keep:** a scanner with value forms generated from the private baseline and a real canary. Run it on every publish, at every tier.
3. **A persona walk-through on paper, for user-facing flows.** Examples of what it found:
   - "the only way back from an expired session is a restart that interrupts extraction";
   - "the reader has no text-search box";
   - "there is no claim list to reject from".
   - **Keep:** at `contracted`, for UI epics.
4. **Durable artifacts that the build will actually use:** the decision log, the fixture catalogue with independent expected values, contract interfaces checked by `tsc`, and a verifier for backlog structure and size.
5. **Forcing owner decisions into writing.** The loop surfaced about 10 real owner decisions: storage, the model-privacy scope, the network rule, and O-1..O-7 (risk acceptance and scope). Each became a one-line recorded choice.
6. **Reuse checks** (adversary mandate v3). They caught two components about to be built a second time: an expired-session page and a database health check that V1 already owns.

### What was theatre. Remove it or gate it by tier

1. **Findings the process generated itself.**
   - Every repair added surface, and the next critic attacked that new surface. 2 of cycle 3's 4 FATALs were caused by cycle-2 fixes. In pre-flight round 2, 2 of 3 residual P1s were created by round-1 fixes.
   - A loop run "until zero findings" converges on specification *volume*, not on truth.
2. **Precision far ahead of the build frontier.** The run pinned TypeScript field names, SQL columns and refusal-code spellings for code whose dependency tables do not exist. Most of that will be revised when upstream work freezes and real data is parsed.
3. **Consistency errors between self-generated documents, graded as P1.** Examples: three different lengths for one outcome enum, a validator shape that differed from the registry's, a place-state value spelled one way in the interface and another in the ACs. These are real if the story is built next month. They are noise when it is built next year.
4. **Paper review cannot reach the largest risk.** The riskiest unknown, whether the parser can read the real archive, can only be answered by building the parser. No amount of review touches it.
5. **Volume.** Issue bodies reached GitHub's 65,536-character limit. Stories carried 60–70 REQs. One story was 69 REQs / 79 ACs and had to be split. At that size nobody can review a ticket, and that is a quality defect in itself.
6. **"Independent" review that was not.** Every lens ran on the same model family. The cross-model peer that duo-build is designed around was never used. "Fresh context" is weaker than "a different reviewer", so label it honestly.

---

### Rules this epic must implement

1. **Tier is explicit, per ticket.**
   - Labels: `spec:thin`, `spec:contracted` and `spec:build-ready`.
   - A ticket with no label is `thin`, and the tool warns.
   - feature-build refuses anything that is not `build-ready`.
2. **Gate depth follows tier.**

   | Tier | Contains | Review |
   |---|---|---|
   | `thin` | Outcome, description, 3–8 behaviour ACs, known dependencies | None |
   | `contracted` | Adds REQs, interface names, fixture ids, dependency reasons | One adversary pass, on irreversible decisions only; plus a persona walk-through for UI |
   | `build-ready` | Adds contracts and fixtures | Simulation and pre-flight |

3. **Promotion is just in time.**
   - A ticket is promoted only when its dependencies are built, or are themselves `build-ready` and next in order.
   - spec-build scope is the promoted ticket and its direct seams, never the whole epic.
   - Promoting beyond the frontier needs a recorded owner reason.
4. **The stop rule is about convergence, not zero findings.**
   - Stop when no FATAL remains in the irreversible-decision scope.
   - Accept P2s and log them.
   - Tag a finding `targets_unbuilt_dependency` and defer it to that dependency's promotion.
   - Track `repair_induced` findings. If they exceed 50% of a cycle's new FATAL and SERIOUS findings, **escalate to the human and do not run another cycle**.
   - Hard caps: 2 adversary cycles at `contracted` and 1 pre-flight re-grade at `build-ready`.
5. **Build discoveries flow back.**
   - feature-build `finish` records `discoveries[]`: the fact, its evidence, and the affected tickets.
   - Each discovery posts a proposed edit on each affected ticket and marks it `stale-spec`.
   - A stale ticket cannot be promoted until the edit is reviewed.
6. **Size is a gate.**
   - Issue body: target 20k characters, maximum 30–35k.
   - Detail goes to `docs/specs/`, `docs/reviews/` and `docs/contracts/`.
   - More than about 40 REQs means split the story, do not compress it.
   - An id-preservation check runs on every move out of a body.
7. **Honesty in status.**
   - When the owner overrides a gate, the status is `override:<who>:<reason>`, never `passed`.
   - A fix applied without a re-grade is recorded as "fixed as specified, not re-graded".
   - Always record which model family did each review.

### Acceptance for the epic as a whole

- [ ] Replaying the E09 inputs under these rules produces, at `contracted`, the irreversible-decision findings listed under "What did real work" above.
- [ ] That replay stops after at most 2 adversary cycles.
- [ ] The frontier report shows only the next buildable ticket(s) as `build-ready`.
- [ ] No ticket body exceeds the size limit.
- [ ] No gate is reported as passed when it was overridden.

---

### Tickets created from this analysis

| Issue | Ticket |
|---|---|
| **#162** | Epic: SPEC-DENSITY, inverted-triangle specification (specify deeply only what is about to be built) |
| **#163** | SPEC-DENSITY-01: specification tiers (thin / contracted / build-ready) and labels |
| **#164** | SPEC-DENSITY-02: promotion trigger (specify just in time at the build frontier) |
| **#165** | SPEC-DENSITY-03: tier-proportional gates and a convergent stop rule |
| **#166** | SPEC-DENSITY-04: build discoveries flow back into thin downstream stories |
| **#167** | SPEC-DENSITY-05: ticket size and executability guard |

Applied first in the consuming repo, Hulupeep/pastor:
- the rule is in `CLAUDE.md` § "Specification density";
- the labels `spec:thin`, `spec:contracted` and `spec:build-ready` are created and applied to the backlog;
- `docs/duo/verify-backlog-structure.py` enforces body size, spec and contract links, and umbrella stories;
- the evidence record is `docs/duo/email-corpus-ingestion-verdict.md`.

