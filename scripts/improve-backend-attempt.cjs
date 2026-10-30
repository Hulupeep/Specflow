'use strict';

// Trusted coordinator storage only. This records existing authority; it does not
// grant execution authority. Callers must first pass currentAuthority. There is
// deliberately no timeout-based unlock or caller-provided "cleaned" override.
const fs = require('fs'), crypto = require('crypto');
const { DurableStore, strictJSON } = require('./improve-worker.cjs');
const { directory } = require('./improve-offline-cache.cjs');
const { canonical } = require('./improve-production-build.cjs');
const processIdentity = require('./improve-process-identity.cjs');
const { validPhase } = require('./improve-backend-phase.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const need = (ok, code = 'backend_attempt_invalid') => { if (!ok) throw Error(code); };
const exact = (value, keys) => need(value && !Array.isArray(value) && typeof value === 'object' &&
  Object.keys(value).sort().join(',') === keys.slice().sort().join(','));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value) && !/\s/.test(value);
const digest = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]+$/.test(value);
const uuid = value => typeof value === 'string' && value.length === 36 && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const SLOTS = Object.freeze(['source-producer', 'build', 'app', 'checker', 'database', 'authMigration', 'auth', 'rest', 'gateway', 'seed']);

function area(store) {
  need(store instanceof DurableStore, 'backend_attempt_authority');
  const root = directory(store.root); let fd;
  try {
    const target = `/proc/self/fd/${root}/backend-attempts`;
    try { fs.mkdirSync(target, { mode: 0o700 }); fs.fsyncSync(root); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    need(stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700);
    return fd;
  } catch (e) { if (fd !== undefined) fs.closeSync(fd); throw e; }
  finally { fs.closeSync(root); }
}
function mac(store, value) { return store.mac(JSON.parse(canonical(value))); }
function writeExclusive(store, fd, name, value) {
  const file = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(file, canonical({ value, mac: mac(store, value) })); fs.fsyncSync(file); }
  finally { fs.closeSync(file); }
  fs.fsyncSync(fd);
}
function readSigned(store, fd, name) {
  const file = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(file);
    need(stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600 && stat.size <= 65536);
    const record = strictJSON(fs.readFileSync(file, 'utf8'));
    exact(record, ['value', 'mac']); need(digest(record.mac));
    need(crypto.timingSafeEqual(Buffer.from(record.mac, 'hex'), Buffer.from(mac(store, record.value), 'hex')));
    return record.value;
  } finally { fs.closeSync(file); }
}
function present(fd, name) {
  try { fs.lstatSync(`/proc/self/fd/${fd}/${name}`); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function validateIdentity(value) {
  exact(value, ['boot_id', 'pid', 'start', 'group']);
  need(typeof value.boot_id === 'string' && value.boot_id.length > 0 && Number.isSafeInteger(value.pid) && value.pid > 1 &&
    Number.isSafeInteger(value.group) && value.group > 1 && typeof value.start === 'string' && /^[0-9]+$/.test(value.start) && !/\s/.test(value.start));
}
function validateAttempt(value) {
  exact(value, ['schema', 'jobId', 'runId', 'attemptId', 'phase', 'contractSha256', 'constructionSha256', 'authoritySha256', 'owner', 'startedAtMs', 'deadlineAtMs']);
  need(value.schema === 'specflow.backend-attempt/v1' && id(value.jobId) && id(value.runId) && uuid(value.attemptId) && validPhase(value.phase));
  need([value.contractSha256, value.constructionSha256, value.authoritySha256].every(digest));
  validateIdentity(value.owner);
  need(Number.isSafeInteger(value.startedAtMs) && value.startedAtMs >= 0 && Number.isSafeInteger(value.deadlineAtMs) && value.deadlineAtMs > value.startedAtMs);
  return value;
}
const activeName = jobId => 'active-' + hash(jobId) + '.json';
const attemptName = attemptId => 'attempt-' + attemptId + '.json';
function reference(value) {
  return Object.freeze({ jobId: value.jobId, runId: value.runId, attemptId: value.attemptId, attemptSha256: hash(canonical(value)) });
}
function validateReference(ref) {
  exact(ref, ['jobId', 'runId', 'attemptId', 'attemptSha256']);
  need(id(ref.jobId) && id(ref.runId) && uuid(ref.attemptId) && digest(ref.attemptSha256));
}
function current(store, fd, ref) {
  validateReference(ref);
  const value = validateAttempt(readSigned(store, fd, attemptName(ref.attemptId)));
  need(canonical(reference(value)) === canonical(ref));
  need(canonical(readSigned(store, fd, activeName(ref.jobId))) === canonical(ref), 'backend_attempt_not_active');
  return value;
}
function begin(store, input) {
  exact(input, ['jobId', 'runId', 'phase', 'contractSha256', 'constructionSha256', 'authoritySha256', 'deadlineAtMs']);
  const value = validateAttempt({ schema: 'specflow.backend-attempt/v1', ...input,
    attemptId: crypto.randomUUID(), owner: processIdentity.identity(), startedAtMs: Date.now() });
  const fd = area(store);
  try {
    // Persist the attempt before the atomic active claim. A losing caller's inert
    // attempt record is retained; it can never issue/create through current().
    writeExclusive(store, fd, attemptName(value.attemptId), value);
    const ref = reference(value);
    try { writeExclusive(store, fd, activeName(value.jobId), ref); }
    catch (e) { if (e.code === 'EEXIST') throw Error('backend_attempt_active'); throw e; }
    return ref;
  } finally { fs.closeSync(fd); }
}
function read(store, ref) {
  const fd = area(store);
  try { return current(store, fd, ref); } finally { fs.closeSync(fd); }
}
// Serialize resource admission with sealing. A process killed inside this short
// critical section leaves a durable fence; another process must not steal it.
function mutate(store, fd, ref, action) {
  current(store, fd, ref);
  const name = `mutation-${ref.attemptId}`;
  try { fs.mkdirSync(`/proc/self/fd/${fd}/${name}`, { mode: 0o700 }); }
  catch (e) { if (e.code === 'EEXIST') throw Error('backend_attempt_mutation_busy'); throw e; }
  fs.fsyncSync(fd);
  try { return action(); }
  finally { fs.rmdirSync(`/proc/self/fd/${fd}/${name}`); fs.fsyncSync(fd); }
}
function seal(store, ref) {
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const attempt = current(store, fd, ref);
    need(canonical(attempt.owner) === canonical(processIdentity.identity()), 'backend_attempt_owner_unavailable');
    const name = `sealed-${ref.attemptId}.json`;
    if (present(fd, name)) return readSigned(store, fd, name);
    const value = { schema: 'specflow.backend-attempt-seal/v1', attemptId: ref.attemptId,
      attemptSha256: ref.attemptSha256, atMs: Date.now() };
    writeExclusive(store, fd, name, value);
    return value;
  }); } finally { fs.closeSync(fd); }
}
function intent(store, ref, input) {
  exact(input, ['slot', 'expectedConfigSha256', 'creator', 'supervisor']);
  need(SLOTS.includes(input.slot) && digest(input.expectedConfigSha256));
  for (const identity of [input.creator, input.supervisor]) {
    validateIdentity(identity);
    need(processIdentity.state(identity) === 'live' && canonical(processIdentity.identity(identity.pid)) === canonical(identity), 'backend_attempt_owner_unavailable');
  }
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const attempt = current(store, fd, ref);
    need(!present(fd, `sealed-${ref.attemptId}.json`), 'backend_attempt_sealed');
    need(Date.now() < attempt.deadlineAtMs, 'backend_lease_expired');
    // An operational terminal fences further creation even if the process lives.
    need(!present(fd, `operator-${ref.attemptId}.json`), 'backend_cleanup_unconfirmed');
    const value = { schema: 'specflow.backend-resource-intent/v1', attemptId: ref.attemptId, ...input,
      name: 'specflow-' + ref.attemptId + '-' + input.slot, deadlineAtMs: attempt.deadlineAtMs };
    try { writeExclusive(store, fd, `intent-${ref.attemptId}-${input.slot}.json`, value); }
    catch (e) { if (e.code === 'EEXIST') throw Error('backend_resource_intent_exists'); throw e; }
    return Object.freeze({ name: value.name, slot: value.slot, sha256: hash(canonical(value)) });
  }); } finally { fs.closeSync(fd); }
}
function intents(store, ref) {
  const fd = area(store);
  try {
    current(store, fd, ref);
    return SLOTS.flatMap(slot => {
      const name = `intent-${ref.attemptId}-${slot}.json`;
      let value;
      try { value = readSigned(store, fd, name); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
      need(value.attemptId === ref.attemptId && value.slot === slot && value.name === 'specflow-' + ref.attemptId + '-' + slot);
      return [{ value, sha256: hash(canonical(value)) }];
    });
  } finally { fs.closeSync(fd); }
}
function operatorRequired(store, ref) {
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const attempt = current(store, fd, ref);
    const value = { schema: 'specflow.backend-operator-required/v1', attemptId: attempt.attemptId,
      attemptSha256: ref.attemptSha256, state: 'operator_required', cause: 'backend_cleanup_unconfirmed', atMs: Date.now() };
    // This event is NOT a cleanup terminal and cannot release the reservation.
    try { writeExclusive(store, fd, 'operator-' + ref.attemptId + '.json', value); }
    catch (e) { if (e.code !== 'EEXIST') throw e; return readSigned(store, fd, 'operator-' + ref.attemptId + '.json'); }
    return value;
  }); } finally { fs.closeSync(fd); }
}
// Only the recorded live supervisor can append a resource event. Records are
// immutable; an interrupted write is a fence, never a reason to retry creation.
function resourceEvent(store, ref, slot, event) {
  need(SLOTS.includes(slot));
  exact(event, ['state', 'id', 'inspectionSha256']);
  need(['dispatching','created','started','removed','not_dispatched','unconfirmed','foreign'].includes(event.state));
  need(event.id === null || digest(event.id));
  need(event.inspectionSha256 === null || digest(event.inspectionSha256));
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const active = current(store, fd, ref);
    const i = readSigned(store, fd, `intent-${ref.attemptId}-${slot}.json`);
    need(canonical(i.supervisor) === canonical(processIdentity.identity()), 'backend_attempt_owner_unavailable');
    const has = state => present(fd, `resource-${ref.attemptId}-${slot}-${state}.json`);
    if (['dispatching','created','started'].includes(event.state))
      need(!has('unconfirmed') && !has('foreign') && !has('removed'), 'backend_cleanup_unconfirmed');
    if (['dispatching', 'started'].includes(event.state))
      need(!present(fd, `sealed-${ref.attemptId}.json`), 'backend_attempt_sealed');
    if (event.state === 'dispatching') {
      need(Date.now() < active.deadlineAtMs && processIdentity.state(i.creator) === 'live', 'backend_lease_expired');
      need(!present(fd, `operator-${ref.attemptId}.json`) && !has('not_dispatched'), 'backend_cleanup_unconfirmed');
      need(event.id === null && event.inspectionSha256 === null);
    }
    if (event.state === 'not_dispatched') need(!has('dispatching') && event.id === null && event.inspectionSha256 === null);
    if (event.state === 'created') need(has('dispatching') && digest(event.id) && digest(event.inspectionSha256));
    if (['started','removed'].includes(event.state)) {
      const created = readSigned(store, fd, `resource-${ref.attemptId}-${slot}-created.json`);
      need(digest(event.id) && created.id === event.id && created.inspectionSha256 === event.inspectionSha256);
      need(!has('not_dispatched') && !has('unconfirmed') && !has('foreign'));
    }
    const value = { schema: 'specflow.backend-resource-event/v1', attemptId: ref.attemptId,
      slot, intentSha256: hash(canonical(i)), ...event, atMs: Date.now() };
    writeExclusive(store, fd, `resource-${ref.attemptId}-${slot}-${event.state}.json`, value);
    return value;
  }); } finally { fs.closeSync(fd); }
}
function resourceEvents(store, ref, slot) {
  need(SLOTS.includes(slot)); const fd = area(store);
  try {
    current(store, fd, ref);
    const i = readSigned(store, fd, `intent-${ref.attemptId}-${slot}.json`);
    return ['dispatching','created','started','removed','not_dispatched','unconfirmed','foreign'].flatMap(state => {
      let value;
      try { value = readSigned(store, fd, `resource-${ref.attemptId}-${slot}-${state}.json`); }
      catch (e) { if (e.code === 'ENOENT') return []; throw e; }
      need(value.attemptId === ref.attemptId && value.slot === slot && value.state === state && value.intentSha256 === hash(canonical(i)));
      return [value];
    });
  } finally { fs.closeSync(fd); }
}
// Allocate the only managed host credential envelope before any secret is
// staged. Its inode is signed; cleanup never accepts an arbitrary caller path.
function envelope(store, ref) {
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const attempt = current(store, fd, ref);
    need(canonical(attempt.owner) === canonical(processIdentity.identity()), 'backend_attempt_owner_unavailable');
    need(!present(fd, `sealed-${ref.attemptId}.json`) && !present(fd, `operator-${ref.attemptId}.json`), 'backend_attempt_sealed');
    const name = `envelope-${ref.attemptId}`;
    if (present(fd, `${name}.json`)) {
      const saved = readSigned(store, fd, `${name}.json`);
      const owned = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { const stat = fs.fstatSync(owned); need(saved.attemptSha256 === ref.attemptSha256 && stat.dev === saved.dev && stat.ino === saved.ino && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700, 'backend_cleanup_unconfirmed'); }
      finally { fs.closeSync(owned); }
      return require('path').join(store.root, 'backend-attempts', name);
    }
    writeExclusive(store, fd, `${name}-intent.json`, { attemptSha256: ref.attemptSha256 });
    fs.mkdirSync(`/proc/self/fd/${fd}/${name}`, { mode: 0o700 }); fs.fsyncSync(fd);
    const child = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(child);
      writeExclusive(store, fd, `${name}.json`, { attemptSha256: ref.attemptSha256, dev: stat.dev, ino: stat.ino });
    } finally { fs.closeSync(child); }
    return require('path').join(store.root, 'backend-attempts', name);
  }); } finally { fs.closeSync(fd); }
}
function removeEnvelope(store, fd, ref) {
  const name = `envelope-${ref.attemptId}`;
  const record = readSigned(store, fd, `${name}.json`);
  need(record.attemptSha256 === ref.attemptSha256, 'backend_cleanup_unconfirmed');
  const child = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(child);
    need(stat.dev === record.dev && stat.ino === record.ino && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700, 'backend_cleanup_unconfirmed');
    let count = 0;
    function tree(dir, remove, depth = 0) {
      need(depth <= 16, 'backend_cleanup_unconfirmed');
      for (const entry of fs.readdirSync(`/proc/self/fd/${dir}`)) {
        need(++count <= 20000, 'backend_cleanup_unconfirmed');
        const file = `/proc/self/fd/${dir}/${entry}`, st = fs.lstatSync(file);
        need(st.uid === process.getuid() && st.dev === stat.dev && !(st.mode & 0o022), 'backend_cleanup_unconfirmed');
        if (st.isDirectory()) {
          const nested = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
          try {
            const observed = fs.fstatSync(nested); need(observed.ino === st.ino && observed.dev === st.dev, 'backend_cleanup_unconfirmed');
            tree(nested, remove, depth + 1);
            if (remove) { const linked = fs.lstatSync(file); need(linked.ino === st.ino && linked.dev === st.dev, 'backend_cleanup_unconfirmed'); fs.rmdirSync(file); }
          } finally { fs.closeSync(nested); }
        } else {
          need(st.isFile() && st.nlink === 1, 'backend_cleanup_unconfirmed');
          if (remove) fs.unlinkSync(file);
        }
      }
      if (remove) fs.fsyncSync(dir);
    }
    // Validate the complete private tree before deleting anything. Readable
    // mounts are allowed inside the 0700 envelope; writable peers and links are not.
    tree(child, false); count = 0; tree(child, true);
    const linked = fs.lstatSync(`/proc/self/fd/${fd}/${name}`);
    need(linked.dev === stat.dev && linked.ino === stat.ino, 'backend_cleanup_unconfirmed');
    fs.rmdirSync(`/proc/self/fd/${fd}/${name}`); fs.fsyncSync(fd);
    need(!present(fd, name), 'backend_cleanup_unconfirmed');
  } finally { fs.closeSync(child); }
}
function finish(store, ref, input) {
  exact(input, ['cause', 'backendTerminalSha256', 'productReceiptSha256']);
  need(input.cause === null || (typeof input.cause === 'string' && /^backend_[a-z_]+$/.test(input.cause) && !/\s/.test(input.cause)));
  need([input.backendTerminalSha256, input.productReceiptSha256].every(v => v === null || digest(v)));
  if (input.cause === null) need(digest(input.backendTerminalSha256) && digest(input.productReceiptSha256));
  const fd = area(store);
  try { return mutate(store, fd, ref, () => {
    const attempt = current(store, fd, ref);
    need(canonical(attempt.owner) === canonical(processIdentity.identity()), 'backend_attempt_owner_unavailable');
    need(!present(fd, `operator-${ref.attemptId}.json`), 'backend_cleanup_unconfirmed');
    const sealed = readSigned(store, fd, `sealed-${ref.attemptId}.json`);
    need(sealed.attemptId === ref.attemptId && sealed.attemptSha256 === ref.attemptSha256);
    const resources = intents(store, ref).map(({ value: i, sha256 }) => {
      const events = resourceEvents(store, ref, i.slot), by = state => events.find(e => e.state === state);
      need(!by('unconfirmed') && !by('foreign'), 'backend_cleanup_unconfirmed');
      const absent = by('not_dispatched'), removed = by('removed'), created = by('created');
      if (absent) {
        need(!by('dispatching') && !created && !removed, 'backend_cleanup_unconfirmed');
        return { slot: i.slot, intentSha256: sha256, id: null, status: 'absent' };
      }
      need(removed && created && by('dispatching') && removed.id === created.id &&
        removed.inspectionSha256 === created.inspectionSha256, 'backend_cleanup_unconfirmed');
      return { slot: i.slot, intentSha256: sha256, id: removed.id, status: 'removed' };
    });
    removeEnvelope(store, fd, ref);
    const value = { schema: 'specflow.backend-attempt-terminal/v1', attemptId: ref.attemptId,
      attemptSha256: ref.attemptSha256, phase: attempt.phase, finishedAtMs: Date.now(),
      state: 'cleaned', ...input, resources, credentialEnvelopeRemoved: true };
    writeExclusive(store, fd, `terminal-${ref.attemptId}.json`, value);
    // Once-only release claim survives interruption. Never replay unlink after a
    // successor has acquired the job; compare the exact active reference first.
    writeExclusive(store, fd, `release-${ref.attemptId}.json`, { attemptSha256: ref.attemptSha256, terminalSha256: hash(canonical(value)) });
    current(store, fd, ref);
    fs.unlinkSync(`/proc/self/fd/${fd}/${activeName(ref.jobId)}`); fs.fsyncSync(fd);
    return value;
  }); } catch (error) {
    try { operatorRequired(store, ref); } catch { /* A corrupt/stale reservation remains fenced. */ }
    throw error;
  } finally { fs.closeSync(fd); }
}
function terminal(store, ref) {
  validateReference(ref); const fd = area(store);
  try {
    const attempt = validateAttempt(readSigned(store, fd, attemptName(ref.attemptId)));
    need(canonical(reference(attempt)) === canonical(ref));
    const value = readSigned(store, fd, `terminal-${ref.attemptId}.json`);
    need(value.attemptId === ref.attemptId && value.attemptSha256 === ref.attemptSha256 && value.phase === attempt.phase);
    return value;
  } finally { fs.closeSync(fd); }
}
// Report a stopped owner explicitly without stealing a lock or declaring its
// asynchronous daemon requests absent. This is observation/fencing, not recovery
// authority to release or recreate a resource.
function reconcileStopped(store, jobId) {
  need(id(jobId)); const fd = area(store);
  try {
    const ref = readSigned(store, fd, activeName(jobId)), active = current(store, fd, ref);
    const ownerState = processIdentity.state(active.owner);
    if (ownerState === 'live') return { state: 'active', attempt: ref };
    const name = `operator-${ref.attemptId}.json`;
    if (!present(fd, name)) writeExclusive(store, fd, name, {
      schema: 'specflow.backend-operator-required/v1', attemptId: ref.attemptId,
      attemptSha256: ref.attemptSha256, state: 'operator_required',
      cause: 'backend_cleanup_unconfirmed', atMs: Date.now()
    });
    readSigned(store, fd, name);
    return { state: 'operator_required', cause: 'backend_cleanup_unconfirmed', attempt: ref, ownerState };
  } finally { fs.closeSync(fd); }
}
module.exports = { begin, read, seal, envelope, finish, terminal, reconcileStopped, intent, intents, operatorRequired, validateAttempt, SLOTS, resourceEvent, resourceEvents };
