# improve-heystax-001 — REVERT (sanitized public summary)

The full record (ledger, frozen contract, checks, screenshots, patch) is private to the
TabStax web-app repository clone. This summary contains no product source.

**Product result:** Improvement not established; product unchanged. Removing the
duplicate header "View List" control made the desktop Must card's context name fully
readable, but it left the narrow card and tablet names unreadable and removed the only
visible list path on a tablet card.

| Stage | What happened |
|---|---|
| Mission | HeyStax mission from #171/#180 and product docs (`heystax-mission.md`) |
| Observation | Runtime walk of the auth-bypass demo board at 1440, 768 and Pixel 5; code and test inspection |
| Candidates | 6: C1 selected (card name crowded out by duplicate control); C2 header overflow and C3 footer clipping kept as opportunities; C5 redesign held as an opportunity; C4 tour rejected as a product decision; C6 contrast kept as a follow-up |
| UX critic | Independent `claude -p` (opus → observed claude-opus-5-5), endorse_with_changes: require a visible list path, honest per-card thresholds, a bounded wrap fallback. $0.65 |
| Contract | v1 frozen before implementation: 7 level-2 criteria checked by a frozen Playwright script, 1 mandatory level-4 UX criterion, scope of 1 file, 6 non-goals |
| Baseline | Frozen checks on an isolated base worktree: AC-1..5 fail (problem reproduced), AC-6/7 pass, gates pass |
| Builder | `claude -p` (sonnet → observed claude-sonnet-5) in an isolated worktree with secrets scrubbed; 14-line removal; claimed "complete". $0.24 |
| After | AC-1, AC-2, AC-6, AC-7 pass; AC-3 (narrow card 93/120px), AC-4 (tablet 48px and 0px), AC-5 (tablet list path lost) fail; gates pass |
| UX evaluator | Independent read-only `claude -p` (opus → observed claude-opus-5-5), no builder transcript: AC-8 fail, with the tablet regression and the screen-reader discoverability gap. $0.48 |
| Decision | REVERT: mandatory AC-3, AC-4, AC-5 and AC-8 failed; divergence recorded (the builder claimed complete) |
| Applied | Worktrees removed, branch deleted, patch kept (sha256 84a612e6…); base `main` df8cdf9 unchanged |
| Safety | 0 prohibited actions attempted or blocked; no deploy, push, merge, outbound call or production data |
| Trace | 60 ledger entries, hash chain verified; measured model spend $1.36; 2 host roles with unknown cost |

**Next human decision:** choose the next contract. Candidates are C1 with one intended
change (header controls wrap below the title, with a named list affordance), or C2
(header overflow). Also choose a durable private home for run evidence (L6).
