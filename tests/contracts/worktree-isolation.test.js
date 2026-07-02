const fs = require('fs');
const os = require('os');
const path = require('path');

const { prepareWorktree, releaseWorktree } = require('../../scripts/specflow-runner.cjs');

// WORKTREE-ISOLATION-01 / J-WORKTREE-ISOLATION (#86)
// Bar: isolated delegated execution with branch/base/path/cleanup ledgered and
// no silent collision with the main working tree.

const REPO = process.cwd(); // a real git repo, used read-only for rev-parse
function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-wt-'));
}
function ledgerEvents(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
}

describe('WORKTREE-ISOLATION-01 — isolated delegated execution (#86)', () => {
  test('HOSTILE: refuses a worktree path that resolves to the main working tree', () => {
    const root = tmp();
    expect(() => prepareWorktree({ repoRoot: root, worktreePath: root }))
      .toThrow(/collides with the main working tree/);
    // trailing-slash / relative form of the same path is still refused
    expect(() => prepareWorktree({ repoRoot: root, worktreePath: `${root}/` }))
      .toThrow(/collides with the main working tree/);
  });

  test('ledgers branch, base ref, base commit, path, read-only and cleanup status', () => {
    const dir = tmp();
    const ledger = path.join(dir, 'ledger.jsonl');
    const rec = prepareWorktree({
      repoRoot: REPO,
      worktreePath: path.join(dir, 'wt'),
      branch: 'specflow/delegate-x',
      readOnly: true,
      ledger,
    });
    expect(rec.action).toBe('referenced'); // create:false -> no git worktree add
    expect(rec.branch).toBe('specflow/delegate-x');
    expect(rec.base_ref).toBe('HEAD');
    expect(rec.base_commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(rec.read_only).toBe(true);
    expect(rec.auto_merge).toBe(false);
    expect(rec.auto_push).toBe(false);

    const entry = ledgerEvents(ledger).find((e) => e.event === 'worktree_prepared');
    expect(entry.worktree_path).toContain('wt');
    expect(entry.base_commit).toBe(rec.base_commit);
    expect(entry.cleanup_status).toBe('pending');
  });

  test('release records cleanup status and never auto-merges/pushes', () => {
    const dir = tmp();
    const ledger = path.join(dir, 'ledger.jsonl');
    const rec = releaseWorktree({
      repoRoot: REPO,
      worktreePath: path.join(dir, 'wt-absent'),
      branch: 'specflow/delegate-x',
      remove: true, // path does not exist -> nothing removed
      ledger,
    });
    expect(rec.cleanup_status).toBe('kept');
    expect(rec.auto_merge).toBe(false);
    expect(rec.auto_push).toBe(false);
    expect(ledgerEvents(ledger).some((e) => e.event === 'worktree_released')).toBe(true);
  });
});
