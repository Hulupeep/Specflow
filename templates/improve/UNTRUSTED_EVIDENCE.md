# Peer and judge evidence (#220)

Improve treats repository and builder content as evidence, never instructions to
change roles, criteria, permissions or verdict authority. Every textual file in
a curated peer/judge input directory is wrapped in a fresh nonce envelope, as
are inlined selected-candidate and criterion values. Source labels are JSON
strings; delimiter tokens inside content are escaped. Symlink and unsupported
binary inputs fail before model invocation. Screenshot image bytes remain intact,
and fixed prompt instructions also declare image text to be untrusted evidence.

The frozen contract still defines acceptance. Independent models interpret the
observations; the mechanical holdout, required gates and binding checks decide
whether gain is established. Framing is a structural defence and is not evidence
that a model cannot be manipulated. It supplies neither OS isolation nor
permission to execute a repository instruction or external side effect.
