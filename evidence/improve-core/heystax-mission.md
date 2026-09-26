# HeyStax mission (input to `specflow improve --once`, #180)

Source: product intent in #171/#180, `goal.md` and `docs/specs/attention_blocks_ux.md`
in the TabStax web-app repository (read 2026-09-26; old docs are not assumed current).

HeyStax helps a person capture useful context quickly, recover it after an
interruption, see what matters now, reconnect related information, and take
the next useful action without reconstructing everything mentally.

The attention board is the "map": a compact, prioritized view (Must / Should /
Good / Meh) that should let someone see what is important in seconds and jump
to the next action. Its header is specified as one-line, mobile-safe controls.

Improvement posture: refinement over redesign, removal over addition, workflow
over decoration, clarity over novelty, less cognitive work over more UI.
Never: production deploys or data, outbound messages, purchases, secrets,
merges to protected branches.
