// Network-only fixture; detached Ed25519 verification uses the real authority path.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tier = require('../../scripts/specflow-tier.cjs');
function signedAmendment(root, oldHash, nextHash) {
  const keys = crypto.generateKeyPairSync('ed25519'), dir = path.join(root, '.specflow');
  const record = { issue: { number: 70 }, source: { kind: 'github', repo: 'fixture/project', number: 70 } };
  const scope = tier.inputHash(record), commentId = '7001', who = 'fixture-owner';
  const body = `override:${who}:\nscope:${scope}\nrisks: isolated synthetic amendment fixture\noutcome-amendment:${oldHash}:${nextHash}`;
  fs.writeFileSync(path.join(dir, 'owner-authorization.json'), JSON.stringify({ owner: who, publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }) }));
  fs.writeFileSync(path.join(dir, 'amendment-record.json'), JSON.stringify(record));
  const payload = { scope, who, commentId, body };
  fs.writeFileSync(path.join(dir, 'owner-signed.json'), JSON.stringify({ payload, signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), keys.privateKey).toString('base64') }), { mode: 0o600 });
  const bin = path.join(dir, 'authority-fixture-bin'); fs.mkdirSync(bin);
  const response = { author_association: 'OWNER', user: { login: who }, body, html_url: 'https://github.com/fixture/project/issues/70#issuecomment-7001' };
  fs.writeFileSync(path.join(bin, 'gh'), '#!/usr/bin/env node\nprocess.stdout.write(' + JSON.stringify(JSON.stringify(response)) + ');\n', { mode: 0o700 });
  return { bin, amendment: { record: '.specflow/amendment-record.json', commentId, signatureFile: '.specflow/owner-signed.json' } };
}
module.exports = { signedAmendment };
