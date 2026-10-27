// Only the GitHub read is a network fixture; actual Ed25519 ownerException runs.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const tier = require('../../scripts/specflow-tier.cjs');
function signedGateD(root, digest) {
  const keys = crypto.generateKeyPairSync('ed25519'), dir = path.join(root, '.specflow');
  const record = { issue: { number: 73 }, source: { kind: 'github', repo: 'fixture/project', number: 73 } };
  const scope = tier.inputHash(record), who = 'fixture-owner', commentId = '7301';
  const body = `override:${who}:\nscope:${scope}\nrisks: isolated synthetic acceptance fixture\ngate-d:${digest}`;
  fs.writeFileSync(dir + '/owner-authorization.json', JSON.stringify({ owner: who, publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }) }));
  fs.writeFileSync(dir + '/gate-d-record.json', JSON.stringify(record));
  const payload = { scope, who, commentId, body };
  fs.writeFileSync(dir + '/gate-d-signed.json', JSON.stringify({ payload, signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), keys.privateKey).toString('base64') }), { mode: 0o600 });
  const bin = dir + '/gate-d-authority-bin'; fs.mkdirSync(bin);
  const response = { author_association: 'OWNER', user: { login: who }, body, html_url: 'https://github.com/fixture/project/issues/73#issuecomment-7301' };
  fs.writeFileSync(bin + '/gh', '#!/usr/bin/env node\nprocess.stdout.write(' + JSON.stringify(JSON.stringify(response)) + ');\n', { mode: 0o700 });
  return { bin, args: ['--approval-record', '.specflow/gate-d-record.json', '--approval-comment', commentId, '--approval-signature', '.specflow/gate-d-signed.json'] };
}
module.exports = { signedGateD };
