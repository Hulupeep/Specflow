# Runtime identity for real applications (#176)

By default an Improve run hashes every input file in the workspace and stops at 256 MiB
or 50,000 entries. A real web app is usually larger than that: tabstax-webapps
has 549 MB of `node_modules` before any build, plus a generated `.next`. To run
an app like that, declare its runtime identity in the frozen contract:

```json
"runtime": {
  "identity": {
    "max_bytes": 4294967296,
    "max_entries": 400000,
    "disposable_outputs": [".next"],
    "mutable_outputs": [".next/cache", "test-results", "playwright-report"]
  },
  "setup": [["pnpm", "exec", "next", "build"]],
  "serve": { "command": ["pnpm", "exec", "next", "start", "-p", "3100"], "port": 3100 }
}
```

- **Bounds fail closed.** Every consumed input, dependencies included, is still hashed; only explicitly
  non-consumed mutable output contents are omitted. A
  tree over the declared bound blocks verification; nothing is skipped or
  truncated. The hard ceilings are 16 GiB and 2,000,000 entries.
- **Hashing streams.** File contents are hashed in 1 MiB chunks. Within one
  process, a hash is reused only when the inode, size, mtime and ctime all
  match, so any write, even one that restores the mtime, forces a rehash.
- **Regenerated inputs are sealed.** `disposable_outputs` are deleted before
  setup, then hashed with source and dependencies. Their contents must remain
  unchanged through checks, evaluation and retention. Put compiled application
  code here (for example `.next` after a production build). An earlier passing
  receipt cannot authorise KEEP after a consumed generated input changes.
- **Mutable output is explicit.** `mutable_outputs` is only for non-consumed
  logs, reports and caches. Those paths are deleted before setup and recorded
  by their frozen location; their contents may churn. The independent contract
  author must verify that these paths do not contain application, dependency or
  check inputs. Never mark all of `.next` or `node_modules` mutable. Use a
  production build/start for a sealed Next.js runtime rather than a dev server
  that recompiles executable inputs during deciding checks. Create any missing
  parent directories during setup, before the first input identity is captured.
- **Paths are confined and source stays separate.** Both classes must be safe
  relative paths, untracked, and outside the allowed product-edit scope. Every
  existing path component is checked for symlinks before cleanup, including
  ancestors. Within a class paths are unique/disjoint. A mutable child of a
  sealed build (such as `.next/cache`) is allowed; a mutable parent cannot hide
  sealed code. Outputs are excluded from Git staging/retention even without a
  `.gitignore` entry. Tracked inputs under an output remain an error.
- **Workspace-local tools compare across worktrees.** An executable that
  resolves inside the workspace (for example `node_modules/.bin/playwright`) is
  identified by its workspace-relative path and its bytes. The baseline and
  candidate worktrees therefore compare equal unless the tool itself changed.

## What this is not

This is not an isolation boundary. It does not stop dependency lifecycle hooks,
the dev server or the builder from reaching the network or reading the host;
that remains REQ-RUNTIME-04/06 (an approved filesystem and egress adapter). Run
unattended cycles only in a disposable environment that holds no production
credentials. The verifier environment is still compared exactly. In hosted
agent containers the harness environment can drift between phases, so the
first real run (#180) required one stable environment for every phase. Prefer a
small explicit non-secret environment owned by the runner; do not dump the
whole session environment into a workspace or evidence file. If an existing
private runner uses an environment snapshot, protect its directory and file
permissions and keep it outside all builder mounts and publication paths.
The private runner must apply the same environment to baseline, build, verify
and evaluation; recording an environment hash is not permission to expose its
values.

Historical workaround (contains credentials; avoid for new runners):

```sh
(umask 077; env -0 > /private-runner/pinned.env0) # never in a checkout/evidence directory
mapfile -d '' VARS < /private-runner/pinned.env0
env -i "${VARS[@]}" specflow improve <stage> RUN   # every later stage
```

Keep `pinned.env0` out of evidence and version control; it holds session tokens.
