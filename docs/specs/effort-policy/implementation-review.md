# #235 slice A implementation acceptance

Source: preparation.md, AC-A1..5; original #235 B remains outside this selected scope.

AC-A1 (REQ-EFFORT-01/02): multiple distinct evidenced subscription recoveries proceed in one history, without a fixed lifetime recovery count.

AC-A2 (REQ-EFFORT-02): duplicate/stale/unstable/tampered evidence, timestamp-only recapture and renamed notes cannot permit another review or credit progress.

AC-A3 (REQ-EFFORT-03/05): explicit ceilings, owner fencing, findings and finish remain enforced; quota and actual charges are not fabricated.

AC-A4 (REQ-EFFORT-05): root and scoped ledgers agree; old receipts remain readable, pending recovery consumes once, pinned runtime bytes stay unchanged.

AC-A5: failed recovery reports its real diagnosis and available next action, never a fake financial exhaustion or a request for routine owner resumption.

GATE-FULL: Execute the full canonical suite on final source with zero failures or skipped tests; required root/scoped/CLI evidence and original red regression remain honest.
