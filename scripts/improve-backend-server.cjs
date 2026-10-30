'use strict';
// Fixed private delivery programs used only by the admitted backend capability.
// No caller-selected entrypoint, environment, path outside /tmp, or secret argv.
function consumeEnvelope(directory, expected, now = Date.now(), hostname = require('os').hostname()) {
  const fs = require('fs'), crypto = require('crypto');
  const fail = code => { throw Error('backend_envelope_' + code); };
  let parent, file;
  try {
    if (!/^\/tmp\/sf-secret-[a-f0-9]{32}$/.test(directory)) fail('path');
    if (!expected || Object.keys(expected).sort().join(',') !== 'container,envelopeSha256,generation,job,nonce' ||
        !/^[a-f0-9]{64}$/.test(expected.container) || !/^[a-f0-9]{64}$/.test(expected.envelopeSha256)) fail('binding');
    if (hostname !== expected.container.slice(0, 12)) fail('container');
    parent = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    const ds = fs.fstatSync(parent);
    if ((ds.mode & 0o777) !== 0o700 || ds.uid !== process.getuid()) fail('directory');
    file = fs.openSync('/proc/self/fd/' + parent + '/envelope', fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(file);
    if (!before.isFile() || before.nlink !== 1 || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600) fail('file');
    if (before.size < 1 || before.size > 8192) fail('size');
    const buffer=Buffer.alloc(before.size+1);let length=0;while(length<buffer.length){const n=fs.readSync(file,buffer,length,buffer.length-length,null);if(!n)break;length+=n;}
    const bytes=buffer.subarray(0,length), after = fs.fstatSync(file);
    if (bytes.length !== before.size || ['dev','ino','size','mtimeMs','ctimeMs'].some(k => before[k] !== after[k])) fail('changed');
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected.envelopeSha256) fail('binding');
    const value = JSON.parse(bytes);
    if (Object.keys(value).sort().join(',') !== 'container,expires,generation,issued,job,key,nonce') fail('fields');
    for (const key of ['job','generation','container','nonce']) if (value[key] !== expected[key]) fail(key);
    if (!Number.isSafeInteger(value.issued) || value.issued > now + 1000 || now - value.issued > 30000) fail('stale');
    if (!Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + 600000) fail('expired');
    if (typeof value.key !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.key)) fail('key');
    fs.unlinkSync('/proc/self/fd/' + parent + '/envelope');
    fs.rmdirSync(directory);
    return value;
  } catch (error) {
    if (/^backend_envelope_[a-z]+$/.test(error.message)) throw error;
    fail(error.code === 'ENOENT' ? 'missing' : error.code === 'ELOOP' ? 'symlink' : 'invalid');
  } finally { if (file !== undefined) fs.closeSync(file); if (parent !== undefined) fs.closeSync(parent); }
}
function writer() {
  const fs = require('fs'), directory = process.argv[1];
  const fail = () => { process.stdout.write('backend_envelope_write_failed'); process.exit(23); };
  if (!/^\/tmp\/sf-secret-[a-f0-9]{32}$/.test(directory)) fail();
  let size = 0; const chunks = [];
  process.stdin.on('error', fail);
  process.stdin.on('data', bytes => { size += bytes.length; if (size > 8192) fail(); chunks.push(bytes); });
  process.stdin.on('end', () => {
    let parent, fd;
    try {
      if (!size) fail();
      fs.mkdirSync(directory, { mode: 0o700 });
      parent = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      fd = fs.openSync('/proc/self/fd/' + parent + '/envelope', fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeFileSync(fd, Buffer.concat(chunks)); fs.fsyncSync(fd);
      process.stdout.write('delivered');
    } catch { fail(); }
    finally { if (fd !== undefined) fs.closeSync(fd); if (parent !== undefined) fs.closeSync(parent); }
  });
}
function launcher(consume) {
  let value;
  const fail = () => { process.stdout.write('backend_server_start_failed'); process.exit(23); };
  try { value = consume(process.argv[1], JSON.parse(process.argv[2])); } catch { fail(); }
  const child = require('child_process').spawn('/node/bin/node', ['/app/node_modules/next/dist/bin/next','start','-p','3000','-H','127.0.0.1'], {
    env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: value.key }, stdio: 'inherit'
  });
  value.key = '';
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
  child.once('error', fail);
  child.once('exit', code => process.exit(code ?? 1));
}
function secretForms(key) {
  if (typeof key !== 'string' || key.split('.').length !== 3) throw Error('backend_input_invalid');
  return [key, Buffer.from(key).toString('base64'), ...key.split('.').slice(1)];
}
function scanArtifacts(directory, key) {
  const fs=require('fs'), needles=secretForms(key).map(s=>Buffer.from(s));
  let files=0,bytes=0,entries=0;
  function walk(fd,depth){
    if(depth>32)throw Error('backend_output_limit');
    for(const name of fs.readdirSync('/proc/self/fd/'+fd)){
      if(++entries>4096)throw Error('backend_output_limit');
      const file='/proc/self/fd/'+fd+'/'+name,stat=fs.lstatSync(file);
      if(stat.isSymbolicLink())throw Error('backend_input_invalid');
      const child=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK|(stat.isDirectory()?fs.constants.O_DIRECTORY:0));
      try{
        const before=fs.fstatSync(child);
        if(before.isDirectory()){walk(child,depth+1);continue;}
        if(!before.isFile()||before.nlink!==1)throw Error('backend_input_invalid');
        if(before.size>16*1024*1024||bytes+before.size>64*1024*1024)throw Error('backend_output_limit');
        const buffer=Buffer.alloc(before.size+1);let length=0;while(length<buffer.length){const n=fs.readSync(child,buffer,length,buffer.length-length,null);if(!n)break;length+=n;}
        const b=buffer.subarray(0,length),after=fs.fstatSync(child);files++;bytes+=b.length;
        if(b.length!==before.size||['size','mtimeMs','ctimeMs'].some(k=>before[k]!==after[k]))throw Error('backend_input_changed');
        if(needles.some(n=>b.includes(n)))throw Error('backend_server_secret_exposed');
      }finally{fs.closeSync(child);}
    }
  }
  const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
  try{walk(fd,0);}finally{fs.closeSync(fd);}
  return {files,bytes,canaryHits:0};
}
module.exports = {
  consumeEnvelope, secretForms, scanArtifacts,
  writerArgv: directory => ['/node/bin/node','-e','(' + writer.toString() + ')()',directory],
  launcherArgv: (directory, expected) => ['/node/bin/node','-e','(' + launcher.toString() + ')(' + consumeEnvelope.toString() + ')',directory,JSON.stringify(expected)]
};
