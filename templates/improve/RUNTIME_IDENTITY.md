# Runtime identity for real applications (#176)

By default an Improve run hashes every file in the workspace and stops at 256 MiB
or 50,000 entries. A real web app is usually larger than that: tabstax-webapps
has 549 MB of `node_modules` before any build, plus a generated `.next`. To run
an app like that, declare its runtime identity in the frozen contract:

```json
"runtime": {
  "identity": {
    "max_bytes": 4294967296,
    "max_entries": 400000,
    "disposable_outputs": [".next", "test-results", "playwright-report"]
  },
  "setup": [["pnpm", "exec", "next", "build"]],
  "serve": { "command": ["pnpm", "exec", "next", "start", "-p", "3100"], "port": 3100 }
}
```

- **Bounds fail closed.** Every file, dependencies included, is still hashed. A
  tree over the declared bound blocks verification; nothing is skipped or
  truncated. The hard ceilings are 16 GiB and 2,000,000 entries.
- **Hashing streams.** File contents are hashed in 1 MiB chunks. Within one
  process, a hash is reused only when the inode, size, mtime and ctime all
  match, so any write, even one that restores the mtime, forces a rehash.
- **Disposable outputs start empty.** Each declared output is deleted before
  `setup` in every verification phase, so its contents come only from sealed
  inputs and the frozen commands. An output path must be relative, untracked by
  Git, not a symlink, disjoint from the other outputs and outside
  `scope.allowed_paths`. It is recorded by path, not by content, so build or
  dev-server churn during checks does not invalidate a receipt. A builder cannot
  smuggle a prebuilt artefact through one, because it is wiped first.
- **Workspace-local tools compare across worktrees.** An executable that
  resolves inside the workspace (for example `node_modules/.bin/playwright`) is
  identified by its workspace-relative path and its bytes. The baseline and
  candidate worktrees therefore compare equal unless the tool itself changed.

## What this is not

This is not an isolation boundary. It does not stop dependency lifecycle hooks,
the dev server or the builder from reaching the network or reading the host;
that remains REQ-RUNTIME-04/06 (an approved filesystem and egress adapter). Run
unattended cycles only in a disposable environment that holds no production
credentials. The verifier environment is still compared exactly: run baseline
and after verification from the same shell, with the same `PATH` and working
directory.
