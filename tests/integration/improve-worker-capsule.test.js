'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const helper = path.resolve(__dirname, '../../scripts/improve-worker-capsule.py');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-fault-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function probe(kind) {
  const script = `
import importlib.util,sys,os,json,hashlib,signal,time
sys.dont_write_bytecode=True
from unittest import mock
spec=importlib.util.spec_from_file_location('capsule',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=sys.argv[2];kind=sys.argv[3];source=root+'/source';target=root+'/capsule';os.mkdir(source);open(source+'/file','w').write('original')
identity={'jobId':'fault-fixture','sourceContainerId':'c'*64,'recipeSha256':'a'*64,'sourceInputSha256':'b'*64}
req={'source':source,'target':target,'identity':identity};error=None
original_sync=os.fsync
canary_reads=0;canary_writes=0;positive_controls=False
if kind in ('source-parent-race','destination-parent-race'):
    canary=root+'/canary';os.mkdir(canary)
    original_read=os.read;original_write=os.write
    def observed_read(fd,*args):
        global canary_reads
        if os.readlink('/proc/self/fd/'+str(fd)).startswith(canary+'/'):canary_reads+=1
        return original_read(fd,*args)
    def observed_write(fd,*args):
        global canary_writes
        if os.readlink('/proc/self/fd/'+str(fd)).startswith(canary+'/'):canary_writes+=1
        return original_write(fd,*args)
    m.os.read=observed_read;m.os.write=observed_write
    fd=os.open(canary+'/control',os.O_CREAT|os.O_RDWR,0o600)
    try:os.write(fd,b'control');os.lseek(fd,0,os.SEEK_SET);assert os.read(fd,7)==b'control'
    finally:os.close(fd)
    positive_controls=canary_reads==1 and canary_writes==1
    os.unlink(canary+'/control');canary_reads=0;canary_writes=0
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
    elif kind=='source-parent-race':
        os.mkdir(source+'/nested');open(source+'/nested/data','w').write('safe')
        canary=root+'/canary';open(canary+'/sentinel','w').write('untouched')
        original_open=os.open;triggered=False
        def raced_open(name,flags,*args,**kwargs):
            global triggered
            if name=='nested' and not triggered:
                triggered=True;parent=kwargs['dir_fd']
                os.rename('nested','nested-old',src_dir_fd=parent,dst_dir_fd=parent)
                os.symlink(canary,'nested',dir_fd=parent)
            return original_open(name,flags,*args,**kwargs)
        with mock.patch.object(m.os,'open',side_effect=raced_open):m.seal(req)
    elif kind=='destination-parent-race':
        canary=root+'/canary';open(canary+'/sentinel','w').write('untouched')
        original_put=m.put;triggered=False
        def raced_put(fd,name,data,mode=0o600):
            global triggered
            if name=='file' and not triggered:
                triggered=True;parent=os.open(os.path.dirname(os.readlink('/proc/self/fd/'+str(fd))),os.O_RDONLY|os.O_DIRECTORY)
                try:
                    os.rename('tree','tree-old',src_dir_fd=parent,dst_dir_fd=parent)
                    os.symlink(canary,'tree',dir_fd=parent)
                finally:os.close(parent)
            return original_put(fd,name,data,mode)
        with mock.patch.object(m,'put',side_effect=raced_put):m.seal(req)
    elif kind=='concurrent-target':
        libc=m.ctypes.CDLL(None,use_errno=True);rename=libc.renameat2
        def race_rename(fd,stage,outfd,name,flags):
            os.mkdir(name,0o700,dir_fd=outfd)
            child=os.open(name,os.O_RDONLY|os.O_DIRECTORY,dir_fd=outfd)
            try:m.put(child,'keep',b'other operation')
            finally:os.close(child)
            return rename(fd,stage,outfd,name,flags)
        proxy=type('Proxy',(),{})();proxy.renameat2=race_rename
        with mock.patch.object(m.ctypes,'CDLL',return_value=proxy):m.seal(req)
    elif kind=='deadline':
        original_put=m.put
        def slow_put(*args,**kwargs):
            time.sleep(1.1)
            return original_put(*args,**kwargs)
        req['limits']={'maxSeconds':1}
        with mock.patch.object(m,'put',side_effect=slow_put):m.seal(req)
    elif kind=='interrupted':
        child=os.fork()
        if child==0:
            def interrupted_put(*args,**kwargs):os.kill(os.getpid(),signal.SIGKILL)
            with mock.patch.object(m,'put',side_effect=interrupted_put):m.seal(req)
            os._exit(99)
        _,status=os.waitpid(child,0)
        assert os.WIFSIGNALED(status) and os.WTERMSIG(status)==signal.SIGKILL
        error='actual_sigkill'
    elif kind=='lost-ack':m.seal(req)
except Exception as e:error=str(e)
exists=os.path.isdir(target);recovered=False
if exists and kind!='concurrent-target':
    expected={'identity':identity,'manifestSha256':hashlib.sha256(open(target+'/manifest.json','rb').read()).hexdigest()}
    recovered=m.verify({'target':target,'expected':expected})['status']=='admitted'
print(json.dumps({'positiveControls':positive_controls,'canaryReads':canary_reads,'canaryWrites':canary_writes,'error':error,'targetExists':exists,'recovered':recovered,'source':open(source+'/file').read(),'canaryIntact':not os.path.exists(root+'/canary') or (open(root+'/canary/sentinel').read()=='untouched' and not os.path.exists(root+'/canary/file')),'competingTarget':open(target+'/keep').read() if kind=='concurrent-target' and exists else None}))
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

test.each(['source-parent-race', 'destination-parent-race'])('capsule-filesystem-races rejects %s without canary writes or admission', kind => {
  const r = probe(kind); expect(r.error).toBeTruthy(); expect(r.targetExists).toBe(false);
  expect(r.recovered).toBe(false); expect(r.canaryIntact).toBe(true);
  expect(r.positiveControls).toBe(true); expect(r.canaryReads).toBe(0); expect(r.canaryWrites).toBe(0);
});
test('capsule-no-replace concurrent destination wins without being overwritten', () => {
  const r = probe('concurrent-target'); expect(r.error).toBe('capsule_conflict');
  expect(r.competingTarget).toBe('other operation'); expect(r.recovered).toBe(false);
});

test('capsule-resource-limits actual elapsed deadline rejects before admission', () => {
  const r = probe('deadline'); expect(r.error).toBe('capsule_deadline');
  expect(r.targetExists).toBe(false); expect(r.recovered).toBe(false);
});
test('capsule-persistence-faults actual helper SIGKILL cannot admit partial input', () => {
  const r = probe('interrupted'); expect(r.error).toBe('actual_sigkill');
  expect(r.targetExists).toBe(false); expect(r.recovered).toBe(false);
});
