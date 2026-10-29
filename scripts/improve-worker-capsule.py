#!/usr/bin/python3
"""Trusted filesystem primitive for sealed inputs; no worker/job authority is granted here.
The worker integration must establish quiescence and trusted receipt ownership.
Ordinary evidence capture uses its separate, stricter helper.
"""
import ctypes, errno, hashlib, json, os, re, stat, sys, secrets, time
class CapsuleError(Exception): pass
def fail(code): raise CapsuleError('capsule_'+code)
def pairs(items):
    out={}
    for k,v in items:
        if k in out: fail('duplicate_key')
        out[k]=v
    return out
def parse(raw):
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:fail('invalid_number'))
def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode('utf8')
def sha(raw): return hashlib.sha256(raw).hexdigest()
def directory(name):
    if not isinstance(name,str) or not os.path.isabs(name): fail('path')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY)
    try:
        for part in name.split('/')[1:]:
            if not part or part in ('.','..'): fail('path')
            nxt=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd);fd=nxt
        return fd
    except: os.close(fd);raise
class Budget:
    defaults={'maxBytes':2*1024**3,'maxFileBytes':512*1024**2,'maxEntries':100000,'maxDepth':128,'maxSeconds':300}
    def __init__(self,limits=None):
        limits=limits or {}
        if not isinstance(limits,dict) or set(limits)-set(self.defaults):fail('limits')
        self.values={**self.defaults,**limits};self.start=time.monotonic()
        for k,v in self.values.items():
            if type(v)!=int or v<1 or v>self.defaults[k]:fail('limits')
    def check(self):
        if time.monotonic()-self.start>self.values['maxSeconds']:fail('deadline')
def identity(value):
    keys={'jobId','sourceContainerId','recipeSha256','sourceInputSha256'}
    if not isinstance(value,dict) or set(value)!=keys:fail('identity')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,119}',value['jobId']):fail('identity')
    if any(not isinstance(value[k],str) or not re.fullmatch('[a-f0-9]{64}',value[k]) for k in keys-{'jobId'}):fail('identity')
    return value
def signature(s):return (s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def graph(entries):
    by={e['path']:e for e in entries}
    for e in entries:
        if e['kind']!='link':continue
        todo=e['path'].split('/');done=[];expansions=0
        while todo:
            part=todo.pop(0)
            if part in ('','.'):continue
            if part=='..':
                if not done:fail('link_escape')
                done.pop();continue
            key='/'.join(done+[part]);node=by.get(key)
            if node is None:fail('dangling_link')
            if node['kind']=='link':
                expansions+=1
                if expansions>40:fail('link_cycle')
                target=node['target']
                if not target or target.startswith('/') or '\\' in target or '\x00' in target:fail('link_escape')
                todo=target.split('/')+todo
            else:
                if todo and node['kind']!='directory':fail('link_parent')
                done.append(part)
        dest='/'.join(done)
        if not dest or e['path'].startswith(dest+'/'):fail('ancestor_link')
def scan(fd,budget):
    entries=[];total=0
    def walk(parent,prefix,depth):
        nonlocal total
        budget.check()
        if depth>budget.values['maxDepth']:fail('depth_limit')
        original=os.fstat(parent)
        for name in sorted(os.listdir(parent)):
            budget.check()
            if not name or name in ('.','..') or '\\' in name or '\x00' in name:fail('path')
            try:name.encode('utf8')
            except UnicodeError:fail('unicode')
            if len(entries)>=budget.values['maxEntries']:fail('entry_limit')
            before=os.stat(name,dir_fd=parent,follow_symlinks=False);mode=stat.S_IMODE(before.st_mode)
            if mode&0o7000:fail('privileged_mode')
            item={'path':prefix+name};entries.append(item)
            if stat.S_ISLNK(before.st_mode):
                target=os.readlink(name,dir_fd=parent);target.encode('utf8')
                item.update(kind='link',target=target)
            elif stat.S_ISDIR(before.st_mode):
                child=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
                try:
                    if signature(before)!=signature(os.fstat(child)):fail('race')
                    item.update(kind='directory',mode=mode);walk(child,prefix+name+'/',depth+1)
                finally:os.close(child)
            elif stat.S_ISREG(before.st_mode):
                if before.st_nlink!=1:fail('hardlink')
                child=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
                try:
                    if signature(before)!=signature(os.fstat(child)):fail('race')
                    h=hashlib.sha256();size=0
                    while True:
                        budget.check();data=os.read(child,65536)
                        if not data:break
                        size+=len(data);total+=len(data)
                        if size>budget.values['maxFileBytes'] or total>budget.values['maxBytes']:fail('byte_limit')
                        h.update(data)
                    if signature(before)!=signature(os.fstat(child)) or size!=before.st_size:fail('race')
                    item.update(kind='file',mode=mode,size=size,sha256=h.hexdigest())
                finally:os.close(child)
            else:fail('special_file')
            if signature(before)!=signature(os.stat(name,dir_fd=parent,follow_symlinks=False)):fail('race')
        if signature(original)!=signature(os.fstat(parent)):fail('race')
    walk(fd,'',0);entries.sort(key=lambda e:e['path']);graph(entries)
    return {'schema':'specflow.input-capsule/v1','entries':entries,'bytes':total,'entryCount':len(entries)}
def parent_fd(root,name):
    parts=name.split('/');fd=os.dup(root)
    try:
        for part in parts[:-1]:
            nxt=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd);os.close(fd);fd=nxt
        return fd,parts[-1]
    except:os.close(fd);raise
def put(fd,name,data,mode=0o600):
    out=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=fd)
    try:
        view=memoryview(data)
        while view:view=view[os.write(out,view):]
        os.fchmod(out,mode);os.fsync(out)
    finally:os.close(out)
def read(fd,name,limit):
    child=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
    try:
        s=os.fstat(child)
        if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_size>limit:fail('metadata_file')
        data=bytearray()
        while True:
            b=os.read(child,min(65536,limit+1-len(data)))
            if not b:break
            data.extend(b)
            if len(data)>limit:fail('metadata_limit')
        if signature(s)!=signature(os.fstat(child)):fail('race')
        return bytes(data)
    finally:os.close(child)
def validate_manifest(m,budget):
    if not isinstance(m,dict) or set(m)!={'schema','entries','bytes','entryCount'} or m['schema']!='specflow.input-capsule/v1':fail('manifest_schema')
    if not isinstance(m['entries'],list) or type(m['bytes'])!=int or type(m['entryCount'])!=int:fail('manifest_schema')
    if not 0<=m['bytes']<=budget.values['maxBytes'] or not 0<=m['entryCount']<=budget.values['maxEntries'] or len(m['entries'])!=m['entryCount']:fail('manifest_limits')
    known={};total=0;previous=None
    for e in m['entries']:
        if not isinstance(e,dict) or not isinstance(e.get('path'),str):fail('manifest_schema')
        name=e['path'];parts=name.split('/')
        if not name or any(not x or x in ('.','..') for x in parts) or '\\' in name or '\x00' in name:fail('manifest_path')
        name.encode('utf8')
        if previous is not None and name<=previous:fail('manifest_order')
        previous=name
        if len(parts)>budget.values['maxDepth']+1:fail('depth_limit')
        parent='/'.join(parts[:-1])
        if parent and known.get(parent,{}).get('kind')!='directory':fail('manifest_parent')
        kind=e.get('kind');fields={'path','kind'}
        if kind=='link':
            fields|={'target'}
            if not isinstance(e.get('target'),str):fail('manifest_schema')
            e['target'].encode('utf8')
        elif kind in ('directory','file'):
            fields|={'mode'}
            if type(e.get('mode'))!=int or not 0<=e['mode']<=0o777:fail('manifest_mode')
            if kind=='file':
                fields|={'size','sha256'}
                if type(e.get('size'))!=int or not 0<=e['size']<=budget.values['maxFileBytes'] or not isinstance(e.get('sha256'),str) or not re.fullmatch('[a-f0-9]{64}',e['sha256']):fail('manifest_schema')
                total+=e['size']
        else:fail('manifest_schema')
        if set(e)!=fields:fail('manifest_schema')
        known[name]=e
    if total!=m['bytes']:fail('manifest_size')
    graph(m['entries'])
def verify_fd(fd,expected,budget):
    if set(os.listdir(fd))!={'tree','manifest.json','receipt.json'}:fail('layout')
    raw=read(fd,'manifest.json',32*1024**2);manifest=parse(raw);validate_manifest(manifest,budget)
    if raw!=canonical(manifest) or sha(raw)!=expected['manifestSha256']:fail('manifest_identity')
    receipt=parse(read(fd,'receipt.json',65536))
    if receipt!={'identity':identity(expected['identity']),'manifestSha256':expected['manifestSha256']}:fail('receipt_identity')
    tree=os.open('tree',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
    try:
        if scan(tree,budget)!=manifest:fail('tree_changed')
    finally:os.close(tree)
    return {'status':'admitted',**receipt}
def verify(req):
    fd=directory(req['target'])
    try:
        result=verify_fd(fd,req['expected'],Budget(req.get('limits')))
        parent=directory(os.path.dirname(req['target']))
        try:os.fsync(fd);os.fsync(parent)
        except OSError:fail('commit_unconfirmed')
        finally:os.close(parent)
        return result
    finally:os.close(fd)
def seal(req):
    binding=identity(req['identity']);budget=Budget(req.get('limits'))
    source=os.path.abspath(req['source']);target=os.path.abspath(req['target']);parent,name=os.path.split(target)
    if source==target or target.startswith(source+'/') or source.startswith(target+'/'):fail('path_overlap')
    src=directory(source);dest=directory(parent);stagefd=None
    try:
        owner=os.fstat(dest)
        if owner.st_uid!=os.getuid() or owner.st_mode&0o077:fail('private_parent')
        manifest=scan(src,budget);raw=canonical(manifest);expected={'identity':binding,'manifestSha256':sha(raw)}
        try:os.stat(name,dir_fd=dest,follow_symlinks=False);exists=True
        except FileNotFoundError:exists=False
        if exists:
            old=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=dest)
            try:return {**verify_fd(old,expected,budget),'idempotent':True}
            finally:os.close(old)
        for attempt in range(10):
            stageName='.capsule-staging-'+secrets.token_hex(16)
            try:os.mkdir(stageName,0o700,dir_fd=dest);break
            except FileExistsError:continue
        else:fail('staging_conflict')
        stagefd=os.open(stageName,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=dest)
        os.mkdir('tree',0o700,dir_fd=stagefd);tree=os.open('tree',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=stagefd)
        try:
            # Create all regular parents before any link; linked-parent imports are impossible.
            for e in manifest['entries']:
                budget.check();out,leaf=parent_fd(tree,e['path'])
                try:
                    if e['kind']=='directory':os.mkdir(leaf,0o700,dir_fd=out)
                    elif e['kind']=='file':
                        inp,part=parent_fd(src,e['path'])
                        try:data=read(inp,part,budget.values['maxFileBytes'])
                        finally:os.close(inp)
                        if len(data)!=e['size'] or sha(data)!=e['sha256']:fail('source_changed')
                        put(out,leaf,data,e['mode'])
                finally:os.close(out)
            for e in manifest['entries']:
                if e['kind']=='link':
                    out,leaf=parent_fd(tree,e['path'])
                    try:os.symlink(e['target'],leaf,dir_fd=out)
                    finally:os.close(out)
            for e in reversed(manifest['entries']):
                if e['kind']=='directory':
                    out,leaf=parent_fd(tree,e['path'])
                    try:
                        child=os.open(leaf,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=out)
                        try:os.fchmod(child,e['mode']);os.fsync(child)
                        finally:os.close(child)
                    finally:os.close(out)
            os.fsync(tree)
            if scan(src,budget)!=manifest or scan(tree,budget)!=manifest:fail('source_changed')
        finally:os.close(tree)
        put(stagefd,'manifest.json',raw);put(stagefd,'receipt.json',canonical(expected));os.fsync(stagefd)
        verify_fd(stagefd,expected,budget);budget.check()
        libc=ctypes.CDLL(None,use_errno=True)
        rename=getattr(libc,'renameat2',None)
        if rename is None:fail('atomic_rename_unavailable')
        if rename(dest,stageName.encode(),dest,name.encode(),1)!=0:
            error=ctypes.get_errno()
            if error==errno.EEXIST:fail('conflict')
            fail('rename_failed')
        try:os.fsync(dest)
        except OSError:fail('commit_unconfirmed')
        return {'status':'admitted',**expected}
    finally:
        if stagefd is not None:os.close(stagefd)
        os.close(src);os.close(dest)
def main():
    raw=sys.stdin.buffer.read(65537)
    if len(raw)>65536:fail('request_limit')
    req=parse(raw);action=sys.argv[1]
    if action=='seal':result=seal(req)
    elif action=='verify':result=verify(req)
    else:fail('action')
    print(json.dumps(result,separators=(',',':')))
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(json.dumps({'error':str(e) if isinstance(e,CapsuleError) else 'capsule_io_or_protocol'}));sys.exit(2)
