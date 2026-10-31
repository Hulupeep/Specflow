'use strict';
const crypto = require('crypto');
const { canonical } = require('./improve-production-build.cjs');
const { strictJSON } = require('./improve-worker.cjs');
const { validate, LIFETIME_SECONDS } = require('./improve-backend-credentials.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const need = ok => { if (!ok) throw Error('backend_identity_mismatch'); };

// Only exact, validated generation credentials may disappear from cross-phase
// identity. Raw input hashes, inspection fingerprints and continuity remain bound.
function projection(credentials, request) {
  try { validate(credentials, request); } catch { throw Error('backend_identity_mismatch'); }
  return { schema: credentials.schema, jobId: credentials.jobId,
    databasePasswordSha256: hash(credentials.databasePassword), sodiumSha256: hash(credentials.sodium),
    signing: { algorithm: 'HS256', generationBound: true },
    anon: { role: 'anon', aud: 'authenticated', iss: 'supabase', lifetimeSeconds: LIFETIME_SECONDS, generationBound: true, phaseBound: true } };
}
function environment(role, values, credentials, request) {
  const normalized = projection(credentials, request);
  need(Array.isArray(values));
  const secretName = ['auth', 'authMigration'].includes(role) ? 'GOTRUE_JWT_SECRET' : role === 'rest' ? 'PGRST_JWT_SECRET' : null;
  const names = new Set(); let found = false;
  const result = values.map(value => {
    need(typeof value === 'string' && value.includes('='));
    const name = value.slice(0, value.indexOf('=')); need(!names.has(name)); names.add(name);
    if (name !== secretName) return { sha256: hash(value) };
    need(value === secretName + '=' + credentials.jwtSecret); found = true;
    return { name, credential: normalized.signing };
  });
  need(!secretName || found);
  return result;
}
function gateway(raw, credentials, request) {
  const normalized = projection(credentials, request), result = JSON.parse(canonical(raw));
  need(Array.isArray(result.consumers) && result.consumers.length === 2);
  const anon = result.consumers.filter(x => x.username === 'anon'), server = result.consumers.filter(x => x.username === 'server');
  need(anon.length === 1 && server.length === 1);
  for (const consumer of [anon[0], server[0]]) need(Array.isArray(consumer.keyauth_credentials) && consumer.keyauth_credentials.length === 1);
  need(anon[0].keyauth_credentials[0].key === credentials.anonKey);
  const token = server[0].keyauth_credentials[0].key;
  need(typeof token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token));
  const [header, payload, signature] = token.split('.');
  let claims;
  try {
    need(canonical(strictJSON(Buffer.from(header, 'base64url').toString())) === canonical({ alg: 'HS256', typ: 'JWT' }));
    claims = strictJSON(Buffer.from(payload, 'base64url').toString());
  } catch { throw Error('backend_identity_mismatch'); }
  need(Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp));
  const extended=['heystax-backend-journeys-v1','heystax-backend-journeys-v2'].includes(request.resourceProfile);
  const lifetimeSeconds=extended?require('./improve-backend-profiles.cjs').workerLimits(request.resourceProfile,'app').phaseMilliseconds/1000:600;
  need(extended?(claims.exp>claims.iat&&claims.exp<=claims.iat+lifetimeSeconds&&claims.exp<=credentials.expiresAt):claims.exp===claims.iat+600);
  need(canonical(claims) === canonical({ role: 'service_role', aud: 'authenticated', iss: 'supabase', job: request.jobId, generation: request.generation, iat: claims.iat, exp: claims.exp }));
  need(claims.iat * 1000 <= Date.now() + 1000 && claims.exp * 1000 > Date.now());
  const expected = crypto.createHmac('sha256', credentials.jwtSecret).update(header + '.' + payload).digest(), actual = Buffer.from(signature, 'base64url');
  need(expected.length === actual.length && crypto.timingSafeEqual(expected, actual));
  anon[0].keyauth_credentials[0].key = normalized.anon;
  server[0].keyauth_credentials[0].key = { kind: 'job-generation-server-token', job: claims.job, role: claims.role, aud: claims.aud, iss: claims.iss, lifetimeSeconds, algorithm: 'HS256' };
  return result;
}
module.exports = { projection, environment, gateway };
