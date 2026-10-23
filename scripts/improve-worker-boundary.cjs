'use strict';
// Owner-invoked positive/negative qualification controls. Never runs repository
// code in an unconfined container and never mounts the Docker socket.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { spawn, spawnSync } = require('child_process');
const w = require('./improve-worker.cjs');
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const need = (ok, code) => {
  if (!ok) throw new w.WorkerError(code, 'boundary-qualification');
};
function hostServer(file, parent) {
  const fs = require('fs'),
    http = require('http'),
    dgram = require('dgram');
  const ports = {};
  const save = () => {
    if (ports.http && ports.dns) fs.writeFileSync(file, JSON.stringify(ports), { mode: 0o600 });
  };
  const httpServer = http.createServer((q, s) => s.end('owned-positive-control'));
  httpServer.listen(0, '127.0.0.1', () => {
    ports.http = httpServer.address().port;
    save();
  });
  const dns = dgram.createSocket('udp4');
  dns.on('message', (q, r) => {
    let end = 12;
    while (end < q.length && q[end]) end += q[end] + 1;
    end += 5;
    if (end > q.length) return;
    const h = Buffer.from(q.subarray(0, 12));
    h.writeUInt16BE(0x8180, 2);
    h.writeUInt16BE(1, 6);
    h.writeUInt16BE(0, 8);
    h.writeUInt16BE(0, 10);
    dns.send(
      Buffer.concat([h, q.subarray(12, end), Buffer.from('c00c000100010000000100047f000001', 'hex')]),
      r.port,
      r.address
    );
  });
  dns.bind(0, '127.0.0.1', () => {
    ports.dns = dns.address().port;
    save();
  });
  setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      process.exit(0);
    }
  }, 200);
  setTimeout(() => process.exit(0), 120000);
}
function probe() {
  const fs = require('fs'),
    net = require('net'),
    dns = require('dns').promises,
    c = JSON.parse(process.argv[1]);
  const connect = (port) =>
    new Promise((resolve) => {
      const s = net.connect({ host: '127.0.0.1', port });
      s.setTimeout(500);
      s.on('connect', () => {
        s.destroy();
        resolve(true);
      });
      s.on('error', () => resolve(false));
      s.on('timeout', () => {
        s.destroy();
        resolve(false);
      });
    });
  (async () => {
    let resolved = false;
    try {
      const r = new dns.Resolver({ timeout: 250, tries: 1 });
      r.setServers(['127.0.0.1:' + c.dns]);
      resolved = (await r.resolve4('owned-control.invalid'))[0] === '127.0.0.1';
    } catch {}
    console.log(
      JSON.stringify({
        hostCanariesVisible: c.canaries.every((p) => fs.existsSync(p)),
        dockerSocketVisible: fs.existsSync('/var/run/docker.sock'),
        hostListenerReachable: await connect(c.http),
        controlledDNSReachable: resolved,
        jobBListenerReachable: await connect(c.jobBPort),
        jobBCanaryVisible: fs.existsSync('/job-b/canary'),
        jobBProcessRootVisible: fs.existsSync('/proc/1/root/job-b/canary')
      })
    );
  })().catch(() => process.exit(2));
}
function parse(result) {
  need(result.status === 0, 'probe_execution_failed');
  return JSON.parse(result.stdout);
}
function qualifyBoundaries(worker, { root, canaries }) {
  const state = fs.mkdtempSync(path.join(root, 'boundary-controls-'));
  fs.chmodSync(state, 0o700);
  const portfile = path.join(state, 'ports.json');
  const child = spawn(
    process.execPath,
    ['-e', '(' + hostServer.toString() + ')(' + JSON.stringify(portfile) + ',' + process.pid + ')'],
    { env: w.controlledEnvironment(), stdio: 'ignore' }
  );
  const ids = [];
  let killedParent;
  try {
    for (let i = 0; i < 100 && !fs.existsSync(portfile); i++) wait(50);
    need(fs.existsSync(portfile), 'positive_host_listener_unavailable');
    const ports = JSON.parse(fs.readFileSync(portfile)),
      config = { ...ports, canaries, jobBPort: 4401 };
    const source = '(' + probe.toString() + ')()';
    const host = parse(
      spawnSync(process.execPath, ['-e', source, JSON.stringify(config)], {
        encoding: 'utf8',
        env: w.controlledEnvironment(),
        timeout: 5000
      })
    );
    need(
      host.hostCanariesVisible && host.dockerSocketVisible && host.hostListenerReachable && host.controlledDNSReachable,
      'positive_host_control_failed'
    );
    const b = worker.create({ role: 'app', tmpfs: [{ path: '/job-b', bytes: 1024 * 1024 }] });
    ids.push(b);
    const bp = worker.start(
      b,
      [
        '/node/bin/node',
        '-e',
        "const fs=require('fs');fs.writeFileSync('/job-b/canary','owned-other-job-canary');require('http').createServer((q,s)=>s.end('job-b-only')).listen(4401,'127.0.0.1')"
      ],
      { cwd: '/tmp' }
    );
    bp.stdout.resume();
    bp.stderr.resume();
    let jobB;
    for (let i = 0; i < 30; i++) {
      const r = worker.exec(b, ['/node/bin/node', '-e', source, JSON.stringify(config)], {
        cwd: '/tmp',
        allowFailure: true
      });
      if (r.status === 0) {
        jobB = JSON.parse(r.stdout);
        if (jobB.jobBListenerReachable) break;
      }
      wait(50);
    }
    need(
      jobB?.jobBListenerReachable && jobB.jobBCanaryVisible && jobB.jobBProcessRootVisible,
      'positive_second_job_failed'
    );
    // A trusted control container sees only deliberately opened fake canaries.
    const opened = worker.create({
      role: 'app',
      mounts: [
        ...canaries.map((source) => ({ source, destination: source })),
        { source: canaries[0], destination: '/job-b/canary' }
      ]
    });
    ids.push(opened);
    const positive = parse(
      worker.exec(opened, ['/node/bin/node', '-e', source, JSON.stringify(config)], { cwd: '/tmp' })
    );
    need(
      positive.hostCanariesVisible && positive.jobBCanaryVisible && positive.jobBProcessRootVisible,
      'positive_opened_path_failed'
    );
    const a = worker.create({ role: 'app' });
    ids.push(a);
    const denied = parse(worker.exec(a, ['/node/bin/node', '-e', source, JSON.stringify(config)], { cwd: '/tmp' }));
    need(
      Object.values(denied).every((v) => v === false),
      'worker_boundary_failed'
    );
    const c = worker.create({ role: 'checker', network: 'container:' + a });
    ids.push(c);
    const checker = parse(worker.exec(c, ['/node/bin/node', '-e', source, JSON.stringify(config)], { cwd: '/tmp' }));
    need(
      Object.values(checker).every((v) => v === false),
      'checker_boundary_failed'
    );
    // A deliberately writable root is rejected BEFORE any repository or journey.
    const bad = worker
      .call([
        'run',
        '-d',
        '--label',
        'specflow.worker=owned-negative-control',
        '--entrypoint',
        '/node/bin/node',
        '--network',
        'none',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        worker.uid + ':' + worker.uid,
        '--pids-limit',
        '128',
        '--cpus',
        '1',
        '--memory',
        '805306368',
        '--memory-swap',
        '805306368',
        ...worker.mountArgs(worker.layer.files, 'app'),
        worker.image,
        '-e',
        'setInterval(()=>{},1000)'
      ])
      .stdout.trim();
    need(/^[a-f0-9]{64}$/.test(bad), 'negative_control_identity');
    worker.containers.add(bad);
    ids.push(bad);
    const inspection = JSON.parse(worker.call(['inspect', bad]).stdout)[0];
    let rejected = false;
    try {
      w.validateInspection(inspection, {
        image: worker.image,
        uid: worker.uid,
        network: 'none',
        memory: 805306368,
        mounts: worker.layer.files,
        tmpfs: []
      });
    } catch (e) {
      rejected = e.code === 'worker_unconfined';
    }
    need(rejected, 'unconfined_worker_accepted');
    worker.destroy(bad);
    const file = path.join(state, 'worker.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        ...worker,
        layer: worker.layer,
        image: worker.image,
        stateRoot: worker.stateRoot,
        gitArea: worker.gitArea,
        maxMilliseconds: 10000
      }),
      { mode: 0o600 }
    );
    const ready = path.join(state, 'child-ready.json');
    const code =
      "const fs=require('fs'),w=require(" +
      JSON.stringify(path.join(__dirname, 'improve-worker.cjs')) +
      ");const d=new w.DockerWorker(JSON.parse(fs.readFileSync(process.argv[1]))),id=d.create({role:'app',tmpfs:[{path:'/data',bytes:1048576}]});const p=d.start(id,['/node/bin/node','-e',\"require('fs').writeFileSync('/data/ready','descendant-active');setInterval(()=>require('fs').writeFileSync('/data/tick',String(Date.now())),50)\"],{cwd:'/tmp'});p.stdout.resume();p.stderr.resume();fs.writeFileSync(process.argv[2],JSON.stringify({id}),{mode:384});setInterval(()=>{},1000);";
    killedParent = spawn(process.execPath, ['-e', code, file, ready], {
      env: w.controlledEnvironment(),
      stdio: 'ignore'
    });
    for (let i = 0; i < 200 && !fs.existsSync(ready); i++) wait(50);
    need(fs.existsSync(ready), 'lifetime_control_unavailable');
    const orphan = JSON.parse(fs.readFileSync(ready)).id;
    need(/^[a-f0-9]{64}$/.test(orphan), 'lifetime_control_identity');
    worker.containers.add(orphan);
    ids.push(orphan);
    wait(200);
    const before = worker.exec(
      orphan,
      [
        '/node/bin/node',
        '-e',
        "process.exit(require('fs').readFileSync('/data/ready','utf8')==='descendant-active'?0:1)"
      ],
      { cwd: '/tmp', allowFailure: true }
    );
    need(before.status === 0, 'lifetime_descendant_not_started');
    process.kill(killedParent.pid, 'SIGKILL');
    let gone = false;
    for (let i = 0; i < 50; i++) {
      const r = worker.call(['inspect', orphan], { allowFailure: true, timeout: 5000 });
      if (r.status !== 0 && /No such (object|container)/i.test(r.stderr || '')) {
        gone = true;
        break;
      }
      wait(100);
    }
    need(gone, 'worker_survived_controller_loss');
    worker.destroy(orphan);
    const result = {
      hostPositive: host,
      openedPathPositive: positive,
      jobBPositive: jobB,
      appDenied: denied,
      checkerDenied: checker,
      unconfinedRejected: {
        readonlyRootObserved: inspection.HostConfig.ReadonlyRootfs,
        rejected,
        repositoryExecuted: false,
        journeySuccessClaimWouldNotOverride: true
      },
      processLoss: { descendantStarted: true, controllerKilled: true, containerAndDescendantGone: gone },
      hostControlPorts: ports,
      policies: [...worker.receipts.values()]
    };
    fs.writeFileSync(path.join(root, 'boundary-qualification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  } finally {
    child.kill();
    if (killedParent)
      try {
        killedParent.kill();
      } catch {}
    for (const id of ids.reverse()) worker.destroy(id);
  }
}
module.exports = { qualifyBoundaries };
