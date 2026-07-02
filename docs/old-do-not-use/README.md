# Old docs — do not use

These documents predate the loop-runtime / verifier era (issues #77–#103) and are **superseded**. They are kept for historical reference only. Do not follow them, link to them, or feed them to agents as current guidance — several describe patterns the current runtime forbids (e.g. a maker verifying its own work).

| Archived doc | Superseded by | Why archived |
|---|---|---|
| `preflightprd.md` | [`docs/PRD.md`](../PRD.md) | Old Pre-Flight Simulator PRD; PRD v1.1 explicitly supersedes its positioning |
| `STATUS.md` | [`docs/PRD.md`](../PRD.md) §8 (current capabilities) | Pre-loop-runtime status snapshot (2026-01); describes a repo without `specflow run`, verifier, ledger, or trace |
| `AGENTIC-FOUNDATIONS-DECK.md` | [`docs/PRD.md`](../PRD.md) §1–§3 + executive summary, [`docs/PRD-COMMERCIAL.md`](../PRD-COMMERCIAL.md) | Old "Type-Checking LLMs" pitch; missing the trust-harness category, verifier rail, and evidence-packet wedge |
| `SIMPLE-WALKTHROUGH.md` | [`README.md`](../../README.md) + [`docs/how-it-works.md`](../how-it-works.md) | Teaches the maker-self-verifies pattern that trust boundary #1 (PRD §10) forbids |

Archived under issue [#107](https://github.com/Hulupeep/Specflow/issues/107) (DOCS-REFRESH-01), 2026-07-02.
