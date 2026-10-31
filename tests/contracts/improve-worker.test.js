'use strict';
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto');
const worker = require('../../scripts/improve-worker.cjs');
let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-contract-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const binding = { nonce: 'current-nonce', input_sha256: 'a'.repeat(64), role: 'oracle' };
const expected = { ...binding, session: 'fresh-session', model: 'claude-opus-5-5' };
function native(changes = {}) {
  const output = {
    _binding: binding,
    files: [{ path: 'holdout/check.cjs', content: '// independently authored fixture' }]
  };
  return [
    {
      type: 'system',
      subtype: 'init',
      session_id: 'fresh-session',
      model: 'claude-opus-5-5',
      tools: ['StructuredOutput'],
      mcp_servers: []
    },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'StructuredOutput', input: output }] } },
    {
      type: 'result',
      subtype: 'success',
      session_id: 'fresh-session',
      is_error: false,
      structured_output: output,
      ...changes
    }
  ];
}
const encode = (e) => e.map(JSON.stringify).join('\n');
test('worker-role-provenance validates actual context/model/binding, not role names (synthetic parser fixture)', () => {
  const result = worker.validateRoleResponse(encode(native()), expected);
  expect(result.output.files[0].path).toBe('holdout/check.cjs');
  expect(result.provenance.model).toBe('claude-opus-5-5');
  expect(result.provenance.io_tool_calls).toBe(0);
});
test.each(['session', 'model', 'tools', 'mcp', 'nonce', 'digest', 'duplicate-init', 'error'])(
  'worker-role-provenance rejects %s',
  (kind) => {
    const events = native();
    if (kind === 'session') events[0].session_id = 'previous';
    if (kind === 'model') events[0].model = 'claude-sonnet-5-5';
    if (kind === 'tools') events[0].tools.push('Read');
    if (kind === 'mcp') events[0].mcp_servers.push({ name: 'host' });
    if (kind === 'nonce') events[2].structured_output._binding = { ...binding, nonce: 'previous' };
    if (kind === 'digest') events[2].structured_output._binding = { ...binding, input_sha256: 'b'.repeat(64) };
    if (kind === 'duplicate-init') events.unshift(events[0]);
    if (kind === 'error') events[2].is_error = true;
    expect(() => worker.validateRoleResponse(encode(events), expected)).toThrow(worker.WorkerError);
  }
);
test('worker-role-provenance rejects actual host I/O invocation even when init tool list lies', () => {
  const e = native();
  e[1].message.content.push({ type: 'tool_use', name: 'Bash', input: { command: 'read host' } });
  expect(() => worker.validateRoleResponse(encode(e), expected)).toThrow(/role_io_tool/);
});
test('worker-output-escape rejects duplicate JSON object keys before applying content', () => {
  expect(() => worker.strictJSON('{"path":"src/a","path":"../host"}')).toThrow(/duplicate_json_key/);
});
test('worker-output-escape applies a genuine scoped file while refusing traversal, protected metadata and symlinks', () => {
  const app = path.join(root, 'app');
  fs.mkdirSync(path.join(app, 'src'), { recursive: true });
  const outside = path.join(root, 'outside');
  fs.writeFileSync(outside, 'protected');
  worker.applyScopedFiles(app, [{ path: 'src/app.cjs', content: 'module.exports=1;' }], ['src/**']);
  expect(fs.readFileSync(path.join(app, 'src/app.cjs'), 'utf8')).toBe('module.exports=1;');
  for (const rel of ['../outside', '/outside', '.git/config', '.env.local', 'AGENTS.md', 'src/../../outside'])
    expect(() => worker.applyScopedFiles(app, [{ path: rel, content: 'bad' }], ['**'])).toThrow(worker.WorkerError);
  fs.symlinkSync(root, path.join(app, 'src/link'));
  expect(() => worker.applyScopedFiles(app, [{ path: 'src/link/outside', content: 'bad' }], ['src/**'])).toThrow(
    worker.WorkerError
  );
  expect(fs.readFileSync(outside, 'utf8')).toBe('protected');
});
test('worker-output-escape validates all paths before changing any candidate bytes', () => {
  const app = path.join(root, 'app');
  fs.mkdirSync(path.join(app, 'src'), { recursive: true });
  fs.writeFileSync(path.join(app, 'src/a.cjs'), 'original');
  expect(() =>
    worker.applyScopedFiles(
      app,
      [
        { path: 'src/a.cjs', content: 'changed' },
        { path: '../escape', content: 'bad' }
      ],
      ['src/**']
    )
  ).toThrow(worker.WorkerError);
  expect(fs.readFileSync(path.join(app, 'src/a.cjs'), 'utf8')).toBe('original');
});
function storeFixture() {
  const source = path.join(root, 'work');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'decision.json'), JSON.stringify({ decision: 'REVERT' }));
  fs.writeFileSync(path.join(source, 'evidence.txt'), 'actual fixture evidence');
  const meta = {
    job_id: 'job-1',
    operation_id: 'operation-1',
    principal: 'alice',
    repo_id: 'repo-a',
    profile_revision: 'a'.repeat(64),
    core_run_id: 'core-1'
  };
  return { source, meta, store: new worker.DurableStore({ root: path.join(root, 'store'), sourceRoot: source }) };
}
test('worker-durable-recovery retains identical historical bytes after source/worker deletion and lost acknowledgement', () => {
  const f = storeFixture();
  const first = f.store.commit(f.meta, f.source);
  fs.rmSync(f.source, { recursive: true });
  const recovered = f.store.recover('job-1', {
    principal: 'alice',
    repo_id: 'repo-a',
    profile_revision: 'a'.repeat(64)
  });
  expect(recovered).toMatchObject({ historical: true, decision: 'REVERT', manifest_sha256: first.manifest_sha256 });
  expect(f.store.commit(f.meta, f.source).manifest_sha256).toBe(first.manifest_sha256);
});
test.each(['blob', 'manifest', 'missing', 'wrong-owner', 'wrong-revision'])(
  'worker-durable-recovery refuses %s substitution',
  (kind) => {
    const f = storeFixture();
    f.store.commit(f.meta, f.source);
    const location = f.store.location('job-1');
    if (kind === 'manifest') {
      const p = path.join(location, 'manifest.json');
      const m = JSON.parse(fs.readFileSync(p));
      m.payload.repo_id = 'other';
      fs.writeFileSync(p, JSON.stringify(m));
    }
    if (kind === 'blob') {
      const m = JSON.parse(fs.readFileSync(path.join(location, 'manifest.json')));
      fs.writeFileSync(path.join(root, 'store', 'blobs', m.payload.files[0].sha256), 'modified');
    }
    if (kind === 'missing') {
      const m = JSON.parse(fs.readFileSync(path.join(location, 'manifest.json')));
      fs.unlinkSync(path.join(root, 'store', 'blobs', m.payload.files[0].sha256));
    }
    expect(() =>
      f.store.recover('job-1', {
        principal: kind === 'wrong-owner' ? 'bob' : 'alice',
        repo_id: 'repo-a',
        profile_revision: 'a'.repeat(64),
        ...(kind === 'wrong-revision' ? { profile_revision: 'b'.repeat(64) } : {})
      })
    ).toThrow(worker.WorkerError);
  }
);
test.each([
  'before_blob_write',
  'before_blob_fsync',
  'before_manifest_write',
  'before_manifest_fsync',
  'before_commit',
  'after_commit_before_sync',
  'after_commit_before_ack'
])('worker-persistence-faults never acknowledge %s as completed', (point) => {
  const f = storeFixture();
  const broken = new worker.DurableStore({
    root: path.join(root, 'store'),
    sourceRoot: f.source,
    fault: (stage) => {
      if (stage === point) throw Error('injected persistence fault');
    }
  });
  expect(() => broken.commit(f.meta, f.source)).toThrow(worker.WorkerError);
  if (['after_commit_before_sync', 'after_commit_before_ack'].includes(point))
    expect(
      f.store.recover('job-1', { principal: 'alice', repo_id: 'repo-a', profile_revision: 'a'.repeat(64) })
    ).toMatchObject({
      historical: true,
      decision: 'REVERT'
    });
  else
    expect(() =>
      f.store.recover('job-1', { principal: 'alice', repo_id: 'repo-a', profile_revision: 'a'.repeat(64) })
    ).toThrow(worker.WorkerError);
});
test('worker-output-escape refuses source symlinks/special files instead of archiving host contents', () => {
  const f = storeFixture();
  fs.symlinkSync('/etc/passwd', path.join(f.source, 'escape'));
  expect(() => f.store.commit(f.meta, f.source)).toThrow(worker.WorkerError);
});
test('worker-mode refuses unknown/API routes and same-builder fake independence', () => {
  expect(() =>
    worker.validateRoleRouting({
      mode: 'api_billed',
      builder: 'claude-sonnet-5-5',
      oracle: 'claude-opus-5-5',
      peer: 'claude-opus-5-5',
      judge: 'claude-opus-5-5'
    })
  ).toThrow(/usage_mode_unavailable/);
  expect(() =>
    worker.validateRoleRouting({
      mode: 'subscription_cli',
      builder: 'claude-sonnet-5-5',
      oracle: 'claude-sonnet-5-5',
      peer: 'claude-opus-5-5',
      judge: 'claude-opus-5-5'
    })
  ).toThrow(/role_independence/);
});
test.each(['NaN', 'Infinity', '-Infinity'])('worker-output-escape strict JSON rejects non-JSON %s', (value) => {
  expect(() => worker.strictJSON('{"value":' + value + '}')).toThrow(/invalid_json_constant/);
});
test('worker-role-provenance rejects primitive native events with a named protocol error', () => {
  expect(() => worker.validateRoleResponse('null', expected)).toThrow(/role_protocol/);
});
test('worker-core-compatible pins backend bytes while allowing only the served client literal to change', () => {
  const s = fs.readFileSync(path.join(__dirname, '../fixtures/improve-worker/server.cjs'), 'utf8');
  expect(
    worker.backendFingerprint(
      s.replace('status.textContent=r.status', "document.getElementById('status').textContent=r.status")
    )
  ).toBe(worker.backendFingerprint(s));
  expect(worker.backendFingerprint(s.replace('s.writeHead(403)', 's.writeHead(200)'))).not.toBe(
    worker.backendFingerprint(s)
  );
});
test.each([{}, { principal: 'alice' }, { principal: 'alice', repo_id: 'repo-a' }])(
  'worker-durable-recovery requires complete caller/repository/revision binding %j',
  (binding) => {
    const f = storeFixture();
    f.store.commit(f.meta, f.source);
    expect(() => f.store.recover('job-1', binding)).toThrow(
      expect.objectContaining({ code: 'result_binding_required' })
    );
  }
);
test.each(['missing-manifest', 'truncated-manifest', 'moved-wrong-job'])(
  'worker-durable-recovery rejects %s with a named unavailable result',
  (kind) => {
    const f = storeFixture();
    f.store.commit(f.meta, f.source);
    const file = path.join(f.store.location('job-1'), 'manifest.json');
    let id = 'job-1';
    if (kind === 'missing-manifest') fs.unlinkSync(file);
    if (kind === 'truncated-manifest') fs.writeFileSync(file, '{"payload":');
    if (kind === 'moved-wrong-job') {
      id = 'job-2';
      fs.renameSync(f.store.location('job-1'), f.store.location(id));
    }
    expect(() => f.store.recover(id, f.meta)).toThrow(expect.objectContaining({ code: 'result_unavailable' }));
  }
);
test.each([
  'before_blob_write',
  'before_blob_fsync',
  'before_manifest_write',
  'before_manifest_fsync',
  'before_commit'
])('worker-persistence-faults healthy same-operation retry after %s commits once', (point) => {
  const f = storeFixture();
  const broken = new worker.DurableStore({
    root: path.join(root, 'store'),
    sourceRoot: f.source,
    fault: (stage) => {
      if (stage === point) throw Error('injected');
    }
  });
  expect(() => broken.commit(f.meta, f.source)).toThrow(
    expect.objectContaining({ code: 'artifact_persistence_failed' })
  );
  const first = f.store.commit(f.meta, f.source),
    second = f.store.commit(f.meta, f.source);
  expect(first.manifest_sha256).toBe(second.manifest_sha256);
  expect(second.idempotent).toBe(true);
  expect(fs.readdirSync(path.join(root, 'store/jobs'))).toEqual(['job-1']);
});
test('worker-persistence-faults a real EACCES target cannot acknowledge completion and healthy retry succeeds', () => {
  const f = storeFixture(),
    blobs = path.join(root, 'store/blobs');
  fs.chmodSync(blobs, 0o500);
  try {
    expect(() => f.store.commit(f.meta, f.source)).toThrow(
      expect.objectContaining({ code: 'artifact_persistence_failed' })
    );
    expect(fs.readdirSync(path.join(root, 'store/jobs'))).toEqual([]);
  } finally {
    fs.chmodSync(blobs, 0o700);
  }
  expect(f.store.commit(f.meta, f.source)).toMatchObject({ historical: true, decision: 'REVERT' });
});
test('worker-persistence-faults actual post-rename acknowledgement fsync error is commit_unconfirmed, then recover only', () => {
  const f = storeFixture(),
    original = fs.fsyncSync;
  const spy = jest.spyOn(fs, 'fsyncSync').mockImplementation((fd) => {
    if (fs.readlinkSync('/proc/self/fd/' + fd) === f.store.location('job-1'))
      throw Object.assign(Error('injected fsync EIO'), { code: 'EIO' });
    return original(fd);
  });
  try {
    expect(() => f.store.commit(f.meta, f.source)).toThrow(expect.objectContaining({ code: 'commit_unconfirmed' }));
  } finally {
    spy.mockRestore();
  }
  fs.rmSync(f.source, { recursive: true });
  expect(f.store.recover('job-1', f.meta)).toMatchObject({ decision: 'REVERT', historical: true });
});
function syntheticInspection() {
  const expected = {
    image: 'sha256:' + 'a'.repeat(64),
    uid: 1000,
    network: 'none',
    memory: 805306368,
    mounts: [{ source: '/approved/source', destination: '/app' }],
    tmpfs: ['/tmp']
  };
  const inspect = {
    Image: expected.image,
    Config: { User: '1000:1000' },
    Mounts: [
      { Type: 'bind', Source: '/approved/source', Destination: '/app', RW: false },
      { Type: 'tmpfs', Destination: '/tmp', RW: true }
    ],
    HostConfig: {
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: ['ALL'],
      CapAdd: [],
      PidsLimit: 128,
      Memory: 805306368,
      MemorySwap: 805306368,
      NanoCpus: 1000000000,
      SecurityOpt: ['no-new-privileges'],
      NetworkMode: 'none',
      PidMode: '',
      IpcMode: 'private',
      Tmpfs: { '/tmp': 'rw,nosuid,nodev' }
    }
  };
  return { inspect, expected };
}
test('worker-boundaries synthetic inspect fixture accepts only the intended exact boundary', () => {
  const f = syntheticInspection();
  expect(worker.validateInspection(f.inspect, f.expected)).toBe(true);
});
test.each([
  'host-network',
  'mount-write',
  'extra-mount',
  'root-user',
  'unconfined-seccomp',
  'host-pid',
  'writable-root',
  'privileged',
  'extra-cap',
  'memory-swap',
  'cpu-unbounded',
  'extra-tmpfs'
])('worker-boundaries synthetic policy weakening %s is rejected independently of a passing journey claim', (kind) => {
  const f = syntheticInspection(),
    h = f.inspect.HostConfig;
  if (kind === 'host-network') h.NetworkMode = 'host';
  if (kind === 'mount-write') f.inspect.Mounts[0].RW = true;
  if (kind === 'extra-mount') f.inspect.Mounts.push({ Type: 'bind', Source: '/host', Destination: '/host', RW: false });
  if (kind === 'root-user') f.inspect.Config.User = '0:0';
  if (kind === 'unconfined-seccomp') h.SecurityOpt.push('seccomp=unconfined');
  if (kind === 'host-pid') h.PidMode = 'host';
  if (kind === 'writable-root') h.ReadonlyRootfs = false;
  if (kind === 'privileged') h.Privileged = true;
  if (kind === 'extra-cap') h.CapAdd.push('SYS_ADMIN');
  if (kind === 'memory-swap') h.MemorySwap = -1;
  if (kind === 'cpu-unbounded') h.NanoCpus = 0;
  if (kind === 'extra-tmpfs') h.Tmpfs['/unapproved'] = 'rw';
  expect(() => worker.validateInspection(f.inspect, f.expected)).toThrow(
    expect.objectContaining({ code: 'worker_unconfined' })
  );
});
test.each(['skipped', 'serial-fail-fast', 'missing-width', 'flaky'])(
  'J-WORKER-QUALIFICATION refuses %s as complete execution',
  (kind) => {
    const r = {
      stats: { expected: 2, unexpected: 0, skipped: 0, flaky: 0 },
      suites: [{ specs: [{ title: '1280px journey' }, { title: '360px journey' }] }]
    };
    if (kind === 'skipped') r.stats.skipped = 1;
    if (kind === 'serial-fail-fast') Object.assign(r.stats, { expected: 0, unexpected: 1, skipped: 1 });
    if (kind === 'missing-width') r.suites[0].specs[1].title = '1280px duplicate';
    if (kind === 'flaky') r.stats.flaky = 1;
    expect(() => worker.validateJourneyReport(r)).toThrow(expect.objectContaining({ code: 'journey_incomplete' }));
  }
);
test('J-WORKER-QUALIFICATION accepts two actually failed seed cases as executed baseline, never as a pass', () => {
  expect(
    worker.validateJourneyReport({
      stats: { expected: 0, unexpected: 2, skipped: 0, flaky: 0 },
      suites: [{ specs: [{ title: '1280px seed fails' }, { title: '360px seed fails' }] }]
    })
  ).toBe(true);
});
test('worker-role-provenance rejects17 distinct frames before provider launch with an actionable bound', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YQAAAABJRU5ErkJggg==',
    'base64'
  );
  const images = Array.from({ length: 17 }, (_, i) => {
    const f = path.join(root, `frame-${i}.png`);
    fs.writeFileSync(f, Buffer.concat([png, Buffer.from(String(i))]));
    return f;
  });
  expect(() =>
    worker.roleCall({
      role: 'judge',
      model: 'opus',
      effectiveModel: 'claude-opus-5-5',
      prompt: 'must not run',
      schema: {},
      cwd: root,
      evidence: path.join(root, 'not-created'),
      claude: process.execPath,
      images
    })
  ).toThrow(
    expect.objectContaining({
      code: 'role_image_limit',
      observed: expect.stringContaining('16'),
      next_action: expect.stringContaining('do not drop')
    })
  );
  expect(fs.existsSync(path.join(root, 'not-created'))).toBe(false);
});
test('worker image manifest preserves26 paths while sending all14 byte-distinct frames exactly once', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YQAAAABJRU5ErkJggg==',
    'base64'
  );
  const images = Array.from({ length: 26 }, (_, i) => {
    const f = path.join(root, `image-${i}.png`);
    fs.writeFileSync(f, Buffer.concat([png, Buffer.from(String(i % 14))]));
    return f;
  });
  const { frames, manifest } = worker.prepareRoleImages(images);
  expect(frames).toHaveLength(14);
  expect(manifest.flatMap((f) => f.paths)).toHaveLength(26);
  expect(new Set(manifest.map((f) => f.sha256)).size).toBe(14);
  for (const f of frames) expect(crypto.createHash('sha256').update(f.bytes).digest('hex')).toBe(f.sha256);
});

test('managed product builder sees approved source rather than a nonexistent Node fixture',()=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'package.json'),'{"name":"product"}');fs.writeFileSync(path.join(root,'src/page.tsx'),'approved-product-source');fs.writeFileSync(path.join(root,'src/private.tsx'),'protected-private-source');
 for(const dir of ['.specflow','holdout','node_modules']){fs.mkdirSync(path.join(root,dir));fs.writeFileSync(path.join(root,dir,'hidden.txt'),'hidden-oracle-or-dependency');}
 fs.writeFileSync(path.join(root,'src/.env.local'),'secret-env');
 const text=worker.builderText(root,{backendJobBinding:{},allowed:['src/**'],protected:['src/private.tsx']});
 expect(text).toContain('approved-product-source');expect(text).toContain('product');expect(text).not.toContain('protected-private-source');expect(text).not.toContain('secret-env');expect(text).not.toContain('hidden-oracle-or-dependency');
});
test('managed builder refuses linked candidate source instead of following it',()=>{
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'package.json'),'{}');fs.symlinkSync('/etc/passwd',path.join(root,'src/page.tsx'));
 expect(()=>worker.builderText(root,{backendJobBinding:{},allowed:['src/**'],protected:[]})).toThrow('role_input_link');
});
