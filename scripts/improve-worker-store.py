#!/usr/bin/python3
"""Bounded fd-relative artifact I/O. Repository/model input is data, never code."""
import sys,os,json,stat,hashlib,tarfile,io
class Unsafe(Exception): pass
def pairs(items):
 d={}
 for k,v in items:
  if k in d: raise Unsafe('duplicate_json_key')
  d[k]=v
 return d
def invalid_constant(value): raise Unsafe('invalid_json_constant')
def strict(text): return json.loads(text,object_pairs_hook=pairs,parse_constant=invalid_constant)
def parts(name):
 if not isinstance(name,str) or not name or name.startswith('/') or '\\' in name or '\x00' in name: raise Unsafe('unsafe_path')
 p=name.split('/')
 if any(not v or v in ('.','..') for v in p): raise Unsafe('unsafe_path')
 return p
def directory(parent,name):
 try:os.mkdir(name,0o700,dir_fd=parent)
 except FileExistsError:pass
 return os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
def parent_fd(root,name):
 p=parts(name);fd=os.dup(root)
 try:
  for component in p[:-1]:
   nxt=directory(fd,component);os.close(fd);fd=nxt
  return fd,p[-1]
 except:os.close(fd);raise
def write(root,name,chunks):
 parent,leaf=parent_fd(root,name)
 try:
  fd=os.open(leaf,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
  try:
   for chunk in chunks:
    view=memoryview(chunk)
    while view:n=os.write(fd,view);view=view[n:]
   os.fsync(fd)
  finally:os.close(fd)
 finally:os.close(parent)
def capture(req):
 source=os.open(req['source'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);target=os.open(req['target'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);files=[];count=0;total=0
 def walk(fd,prefix):
  nonlocal count,total
  for name in sorted(os.listdir(fd)):
   rel=prefix+name;parts(rel);count+=1
   if count>req.get('max_entries',10000):raise Unsafe('artifact_entry_limit')
   before=os.stat(name,dir_fd=fd,follow_symlinks=False)
   if stat.S_ISDIR(before.st_mode):
    child=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
    try:walk(child,rel+'/')
    finally:os.close(child)
   elif stat.S_ISREG(before.st_mode):
    if before.st_nlink!=1:raise Unsafe('artifact_hardlink')
    if before.st_size>req.get('max_file_bytes',64*1024*1024):raise Unsafe('artifact_file_limit')
    total+=before.st_size
    if total>req.get('max_bytes',256*1024*1024):raise Unsafe('artifact_byte_limit')
    original=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd);h=hashlib.sha256()
    def chunks():
     while True:
      data=os.read(original,65536)
      if not data:break
      h.update(data);yield data
    try:
     opened=os.fstat(original)
     if not stat.S_ISREG(opened.st_mode) or (before.st_dev,before.st_ino)!=(opened.st_dev,opened.st_ino):raise Unsafe('artifact_race')
     write(target,rel,chunks());after=os.fstat(original)
     if (opened.st_size,opened.st_mtime_ns,opened.st_ctime_ns)!=(after.st_size,after.st_mtime_ns,after.st_ctime_ns):raise Unsafe('artifact_race')
    finally:os.close(original)
    files.append({'path':rel,'sha256':h.hexdigest(),'size':before.st_size,'mode':stat.S_IMODE(before.st_mode)})
   else:raise Unsafe('artifact_special_or_link')
 try:walk(source,'');return {'files':files,'bytes':total,'entries':count}
 finally:os.close(source);os.close(target)
def extract(req,data):
 if len(data)>req.get('max_tar_bytes',64*1024*1024):raise Unsafe('archive_byte_limit')
 target=os.open(req['target'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);seen=set();total=0;count=0
 try:
  with tarfile.open(fileobj=io.BytesIO(data),mode='r:*')as archive:
   for item in archive:
    name=item.name
    while name.startswith('./'):name=name[2:]
    if name.endswith('/'):name=name[:-1]
    p=parts(name)
    if req.get('prefix'):
     if p[0]!=req['prefix']:raise Unsafe('archive_prefix')
     p=p[1:]
    if not p:
     if not item.isdir():raise Unsafe('archive_root_type')
     continue
    rel='/'.join(p);count+=1
    if count>req.get('max_entries',10000)or rel in seen:raise Unsafe('archive_duplicate_or_limit')
    seen.add(rel)
    if item.isdir():
     fd,leaf=parent_fd(target,rel)
     try:child=directory(fd,leaf);os.close(child)
     finally:os.close(fd)
    elif item.isreg()and not item.sparse:
     total+=item.size
     if total>req.get('max_bytes',64*1024*1024):raise Unsafe('archive_byte_limit')
     f=archive.extractfile(item)
     def chunks():
      while True:
       b=f.read(65536)
       if not b:break
       yield b
     write(target,rel,chunks())
    else:raise Unsafe('archive_special_or_link')
  return {'entries':count,'bytes':total}
 finally:os.close(target)
def apply(req):
 root=os.open(req['root'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);opened=[]
 try:
  # Open every parent before changing any candidate byte. No followed links.
  for file in req['files']:
   parent,leaf=parent_fd(root,file['path'])
   try:
    try:s=os.stat(leaf,dir_fd=parent,follow_symlinks=False)
    except FileNotFoundError:s=None
    if s and not stat.S_ISREG(s.st_mode):raise Unsafe('unsafe_output')
    opened.append((parent,leaf,file['content'].encode('utf-8')))
   except:os.close(parent);raise
  for parent,leaf,data in opened:
   tmp='.worker-apply-'+os.urandom(12).hex();fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
   try:
    view=memoryview(data)
    while view:n=os.write(fd,view);view=view[n:]
    os.fsync(fd)
   finally:os.close(fd)
   os.rename(tmp,leaf,src_dir_fd=parent,dst_dir_fd=parent);os.fsync(parent)
  return {'written':len(opened)}
 finally:
  for fd,_,_ in opened:os.close(fd)
  os.close(root)
def main():
 action=sys.argv[1]
 if action=='strict':print(json.dumps(strict(sys.stdin.read()),separators=(',',':')));return
 req=strict(sys.argv[2])
 if action=='capture':out=capture(req)
 elif action=='extract':out=extract(req,sys.stdin.buffer.read(req.get('max_tar_bytes',64*1024*1024)+1))
 elif action=='apply':out=apply(req)
 else:raise Unsafe('unsupported_artifact_operation')
 print(json.dumps(out,separators=(',',':')))
if __name__=='__main__':
 try:main()
 except Exception as e:
  # Never echo source content, paths or credentials in a diagnostic.
  print(json.dumps({'error':str(e)if isinstance(e,Unsafe)else'unsafe_artifact_io'}));sys.exit(2)
