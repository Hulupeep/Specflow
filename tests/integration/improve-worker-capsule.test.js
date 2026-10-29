'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const helper = path.resolve(__dirname, '../../scripts/improve-worker-capsule.py');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-fault-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function probe(kind) {
  const script = `
import importlib.util,sys,os,json,hashlib
sys.dont_write_bytecode=True
from unittest import mock
spec=importlib.util.spec_from_file_location('capsule',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=sys.argv[2];kind=sys.argv[3];source=root+'/source';target=root+'/capsule';os.mkdir(source);open(source+'/file','w').write('original')
identity={'jobId':'fault-fixture','sourceContainerId':'c'*64,'recipeSha256':'a'*64,'sourceInputSha256':'b'*64}
req={'source':source,'target':target,'identity':identity};error=None
original_sync=os.fsync
def sync(fd):
    if kind=='precommit' or (kind=='postcommit' and os.readlink('/proc/self/fd/'+str(fd))==root and os.path.isdir(target)):
        raise OSError('injected fsync failure')
    return original_sync(fd)
try:
    if kind in ('precommit','postcommit'):
        with mock.patch.object(m.os,'fsync',side_effect=sync):m.seal(req)
    elif kind=='write':
        with mock.patch.object(m,'put',side_effect=OSError('injected write failure')):m.seal(req)
    elif kind=='rename':
        with mock.patch.object(m.ctypes,'CDLL',side_effect=OSError('injected rename unavailable')):m.seal(req)
    elif kind=='lost-ack':m.seal(req)
except Exception as e:error=str(e)
exists=os.path.isdir(target);recovered=False
if exists:
    expected={'identity':identity,'manifestSha256':hashlib.sha256(open(target+'/manifest.json','rb').read()).hexdigest()}
    recovered=m.verify({'target':target,'expected':expected})['status']=='admitted'
print(json.dumps({'error':error,'targetExists':exists,'recovered':recovered,'source':open(source+'/file').read()}))
`;
  const r = spawnSync('/usr/bin/python3', ['-c', script, helper, root, kind], { encoding: 'utf8', timeout: 20000 });
  expect(r.status).toBe(0); return JSON.parse(r.stdout);
}
test.each(['write', 'precommit', 'rename'])('capsule-persistence-faults %s cannot admit partial input', kind => {
  const r = probe(kind); expect(r.error).toBeTruthy(); expect(r.targetExists).toBe(false);
  expect(r.recovered).toBe(false); expect(r.source).toBe('original');
});
test('capsule-persistence-faults parent-sync failure is explicitly unconfirmed until verified recovery', () => {
  const r = probe('postcommit'); expect(r.error).toBe('capsule_commit_unconfirmed');
  expect(r.targetExists).toBe(true); expect(r.recovered).toBe(true);
});
test('capsule-lost-ack confirms the existing durable tree without another capture', () => {
  const r = probe('lost-ack'); expect(r.error).toBe(null); expect(r.recovered).toBe(true);
});
