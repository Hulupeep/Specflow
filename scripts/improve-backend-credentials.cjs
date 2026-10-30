'use strict';
// Trusted coordinator only. The caller must first pass currentAuthority; this
// module preserves the existing DurableStore authority, it does not grant it.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DurableStore, strictJSON } = require('./improve-worker.cjs');
const { directory } = require('./improve-offline-cache.cjs');
const { canonical } = require('./improve-production-build.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const need = (ok, code = 'backend_credentials_invalid') => { if (!ok) throw Error(code); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
const phaseOK = phase => ['baseline', 'after'].includes(phase);
const secret = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const LIFETIME_SECONDS = 3600;

function area(store) {
  need(store instanceof DurableStore, 'backend_credentials_authority');
  const root = directory(store.root);
  let fd;
  try {
    const target = `/proc/self/fd/${root}/backend-credentials`;
    try { fs.mkdirSync(target, { mode: 0o700 }); fs.fsyncSync(root); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    need(stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700);
    return fd;
  } catch (e) { if (fd !== undefined) fs.closeSync(fd); throw e; }
  finally { fs.closeSync(root); }
}
const mac = (store, value) => store.mac(JSON.parse(canonical(value)));
function signed(store, value) { return canonical({ value, mac: mac(store, value) }); }
function readSigned(store, fd, name) {
  const file = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(file);
    need(stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600 && stat.size <= 16384);
    const envelope = strictJSON(fs.readFileSync(file, 'utf8'));
    need(envelope && Object.keys(envelope).sort().join(',') === 'mac,value');
    need(typeof envelope.mac === 'string' && /^[a-f0-9]{64}$/.test(envelope.mac));
    need(crypto.timingSafeEqual(Buffer.from(envelope.mac, 'hex'), Buffer.from(mac(store, envelope.value), 'hex')));
    return envelope.value;
  } finally { fs.closeSync(file); }
}
function exclusive(store, fd, name, value) {
  const file = fs.openSync(`/proc/self/fd/${fd}/${name}`, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(file, signed(store, value)); fs.fsyncSync(file); }
  finally { fs.closeSync(file); }
  fs.fsyncSync(fd);
}
function token(key, claims) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode(claims);
  return unsigned + '.' + crypto.createHmac('sha256', key).update(unsigned).digest('base64url');
}
function validate(value, expected, now = Date.now()) {
  need(value && Object.keys(value).sort().join(',') === 'anonKey,databasePassword,expiresAt,generation,issuedAt,jobId,jwtSecret,phase,schema,sodium');
  need(value.schema === 'specflow.backend-credentials/v2' && id(value.jobId) && id(value.generation) && phaseOK(value.phase));
  need(value.jobId === expected.jobId && value.phase === expected.phase && value.generation === expected.generation);
  need([value.jwtSecret, value.databasePassword, value.sodium].every(secret));
  need(Number.isSafeInteger(value.issuedAt) && Number.isSafeInteger(value.expiresAt) && value.expiresAt - value.issuedAt === LIFETIME_SECONDS);
  need(value.issuedAt * 1000 <= now + 1000 && value.expiresAt * 1000 > now + 300000, 'backend_credentials_expired');
  need(typeof value.anonKey === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.anonKey));
  const [header, payload, signature] = value.anonKey.split('.');
  need(canonical(strictJSON(Buffer.from(header, 'base64url').toString())) === canonical({ alg: 'HS256', typ: 'JWT' }));
  const claims = strictJSON(Buffer.from(payload, 'base64url').toString());
  need(canonical(claims) === canonical({ role: 'anon', aud: 'authenticated', iss: 'supabase', job: value.jobId, phase: value.phase, generation: value.generation, iat: value.issuedAt, exp: value.expiresAt }));
  const actual = Buffer.from(signature, 'base64url'), expectedSignature = crypto.createHmac('sha256', value.jwtSecret).update(header + '.' + payload).digest();
  need(actual.length === expectedSignature.length && crypto.timingSafeEqual(actual, expectedSignature));
  return value;
}
function issue(store, { jobId, phase }) {
  need(id(jobId) && phaseOK(phase));
  const fd = area(store);
  try {
    // Database identity is stable across phases. JWT authority is not.
    const jobFile = 'job-' + hash(jobId) + '.json';
    try { exclusive(store, fd, jobFile, { jobId, databasePassword: crypto.randomBytes(32).toString('hex'), sodium: crypto.randomBytes(32).toString('hex') }); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stable = readSigned(store, fd, jobFile);
    need(Object.keys(stable).sort().join(',') === 'databasePassword,jobId,sodium' && stable.jobId === jobId && secret(stable.databasePassword) && secret(stable.sodium));
    const generation = crypto.randomUUID(), issuedAt = Math.floor(Date.now() / 1000), expiresAt = issuedAt + LIFETIME_SECONDS;
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const value = { schema: 'specflow.backend-credentials/v2', ...stable, phase, generation, issuedAt, expiresAt, jwtSecret,
      anonKey: token(jwtSecret, { role: 'anon', aud: 'authenticated', iss: 'supabase', job: jobId, phase, generation, iat: issuedAt, exp: expiresAt }) };
    validate(value, { jobId, phase, generation });
    const keyDigest = hash(jwtSecret), credentialSha256 = hash(canonical(value));
    exclusive(store, fd, 'issued-' + keyDigest + '.json', value);
    return Object.freeze({ jobId, phase, generation, keyDigest, credentialSha256 });
  } finally { fs.closeSync(fd); }
}
function read(store, reference) {
  need(reference && Object.keys(reference).sort().join(',') === 'credentialSha256,generation,jobId,keyDigest,phase');
  need([reference.keyDigest, reference.credentialSha256].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)));
  const fd = area(store);
  try {
    const value = validate(readSigned(store, fd, 'issued-' + reference.keyDigest + '.json'), reference);
    need(hash(value.jwtSecret) === reference.keyDigest && hash(canonical(value)) === reference.credentialSha256);
    return value; // Only trusted coordinator code may receive these private bytes.
  } finally { fs.closeSync(fd); }
}
function consume(store, reference, expected) {
  const value = read(store, reference);
  validate(value, expected);
  const fd = area(store);
  try {
    const reservation = { schema: 'specflow.backend-credential-consumption/v1', ...reference, consumedAt: new Date().toISOString() };
    try { exclusive(store, fd, 'consumed-' + reference.keyDigest + '.json', reservation); }
    catch (e) { if (e.code === 'EEXIST') throw Error('backend_credentials_consumed'); throw e; }
    return Object.freeze(reservation);
  } finally { fs.closeSync(fd); }
}
module.exports = { issue, read, consume, validate, LIFETIME_SECONDS };
