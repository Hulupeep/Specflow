# Capsule runtime qualification


## Reproducing the live admission check

From the repository root, with the existing qualified worker software layer and
its private worker configuration available, run:

```sh
node scripts/qualify-input-capsule.cjs "$WORKER_CONFIG" "$PRIVATE_EVIDENCE_DIRECTORY"
```

The configuration is local input and is never printed. The evidence directory
must be owner-private. The check creates disposable network-isolated workers,
records source hashes and twelve observed checks, and removes its owned containers.
It covers actual paused-process identity, foreign/host process rejection,
read-only executable/link/directory reuse, ordinary evidence link rejection,
wrong-job and mutated-tree rejection, and a real unpause before admission.
One additional identity-change control is explicitly injected and labelled;
it does not claim an actual kernel PID reuse event. This command does not run
models, download dependencies, provision a product backend, or prove #171/#172.
The Jest fault suite separately executes elapsed-time and actual SIGKILL failures
and establishes read/write canary detection before testing parent replacement.
