"""Local only; emits structural counts and codes, never private source values."""
import json,sys,tempfile,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
base=Path(__file__).parent
config=json.loads((base/'private-replay-config.json').read_text())
project=Path(config['project'])
sys.path.insert(0,str(project/'src'))
from pastor.runtime import check_readiness
from pastor.sandbox import run_sandboxed,WORKER_PYTHON
ready=check_readiness()
if not ready['extraction_allowed']:
 print(json.dumps({'status':'blocked','codes':ready['error_codes'],'private_content_emitted':False}));sys.exit(2)
if '--probe' in sys.argv:
 print(json.dumps({'success':True,'sandboxReady':True,'restrictions':'Existing Pastor runtime and synthetic sandbox probes passed'}));sys.exit(0)
expected=json.loads((base/'private-input-reference.json').read_text())
source=Path(expected['path'])
if not source.is_file() or source.stat().st_size!=expected['size'] or source.stat().st_mtime_ns!=expected['mtime_ns']:
 print(json.dumps({'status':'input_unavailable_or_changed','private_content_emitted':False}));sys.exit(2)
# Values remain private, used only by the existing project's scanner.
h=hashlib.sha256()
with source.open('rb') as f:
 for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
(base/'private-baseline.json').write_text(json.dumps([{'path':str(source),'size':source.stat().st_size,'sha256':h.hexdigest()}]))
worker='''import sys,json
sys.path.insert(0,'/job/site')
import pypff
archive=pypff.file()
stage='open'
try:
 archive.open('/job/source')
 stage='root-folder'
 root=archive.get_root_folder()
 stage='structure'
 queue=[root];visited=0;messages=0;message_read=False;attachments=None
 while queue and visited<25:
  folder=queue.pop(0);visited+=1;messages+=folder.number_of_sub_messages
  if not message_read and folder.number_of_sub_messages:
   message=folder.get_sub_message(0);attachments=message.number_of_attachments;message_read=True
  for n in range(min(folder.number_of_sub_folders,25-len(queue))):queue.append(folder.get_sub_folder(n))
 print(json.dumps({'status':'observed','archive_opened':True,'root_folder_read':True,'folders_visited':visited,'messages_enumerated':messages,'one_message_structure_read':message_read,'first_message_attachment_count':attachments,'traversal_limit':25,'private_content_emitted':False}))
 archive.close()
except Exception as error:
 print(json.dumps({'status':'parser_failed','stage':stage,'error_class':type(error).__name__,'private_content_emitted':False}));sys.exit(1)
'''
with tempfile.TemporaryDirectory(dir=base) as d:
 staging=Path(d);script=staging/'worker.py';script.write_text(worker)
 site=next((project/'.venv/lib').glob('python*/site-packages'))
 try:
  result=run_sandboxed(source,staging,[WORKER_PYTHON,'/job/worker.py'],timeout=20,extra_ro=[(str(script),'/job/worker.py'),(str(site),'/job/site')])
  # Deliberately drop native parser stderr, which may contain source values.
  (base/'private-worker-stderr.txt').write_text(result.stderr)
  (base/'private-worker-stderr.txt').chmod(0o600)
  try:parsed=json.loads(result.stdout)
  except ValueError:parsed={'status':'worker_failed','error_class':next((c for c in ['ModuleNotFoundError','ImportError','SyntaxError','PermissionError'] if c in result.stderr),'unclassified'),'exitCode':result.returncode,'private_content_emitted':False}
  parsed['stable_input']=(source.stat().st_size==expected['size'] and source.stat().st_mtime_ns==expected['mtime_ns'])
  if not parsed['stable_input']:parsed['status']='input_changed'
  parsed.update({'sandbox_network':'denied','source_write':'denied','memory_limit_gib':2,'worker_time_limit_seconds':20,'scope':'One representative PST, bounded structural read; not extraction or all-format qualification'})
  print(json.dumps(parsed));sys.exit(0 if result.returncode==0 else 2)
 except Exception:
  print(json.dumps({'status':'budget_or_environment_blocked','private_content_emitted':False}));sys.exit(2)
