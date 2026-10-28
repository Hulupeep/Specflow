#!/usr/bin/env node
'use strict';
// Development/release generator only. Shipped runtime never resolves npm modules.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inventory(root=path.resolve(__dirname,'..')) {
 const files={},packages=[];
 for(const [name,version] of [['js-yaml','4.3.2'],['zod','4.6.7']]) {
  const base=path.dirname(require.resolve(name+'/package.json',{paths:[root]})),meta=JSON.parse(fs.readFileSync(path.join(base,'package.json')));
  if(meta.version!==version)throw Error(`Vendor generation requires ${name}@${version}; got ${meta.version}`);
  const add=(from,to)=>{files[to]=fs.readFileSync(path.join(base,from));};
  add('LICENSE',name+'/LICENSE');
  if(name==='js-yaml')add('dist/js-yaml.min.js','js-yaml/js-yaml.cjs');
  else {
   const pending=['index.cjs'],seen=new Set();
   while(pending.length){const rel=pending.pop();if(seen.has(rel))continue;seen.add(rel);
    const text=fs.readFileSync(path.join(base,rel),'utf8');add(rel,'zod/'+rel);
    for(const m of text.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
     if(!m[1].startsWith('.'))throw Error('External vendor dependency: '+m[1]);
     const next=path.posix.normalize(path.posix.join(path.posix.dirname(rel),m[1]));
     if(next.startsWith('../')||path.posix.isAbsolute(next))throw Error('Vendor import escapes package');
     pending.push(next);
    }
   }
  }
  packages.push({name,version,license:meta.license,source:`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`});
 }
 const hashes=Object.fromEntries(Object.keys(files).sort().map(f=>[f,sha(files[f])]));
 files['manifest.json']=Buffer.from(JSON.stringify({version:1,packages,files:hashes},null,2)+'\n');return files;
}
function generate(root=path.resolve(__dirname,'..'),check=false){
 const files=inventory(root),destination=path.join(root,'scripts/vendor'),existing=[];
 function walk(dir,rel=''){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Vendor path cannot be a symlink');const next=rel?rel+'/'+e.name:e.name;if(e.isDirectory())walk(path.join(dir,e.name),next);else existing.push(next);}}
 walk(destination);
 const drift=[...Object.entries(files).filter(([f,b])=>!fs.existsSync(path.join(destination,f))||!fs.readFileSync(path.join(destination,f)).equals(b)).map(([f])=>f),...existing.filter(f=>!Object.hasOwn(files,f))];
 if(!check){for(const f of existing.filter(f=>!Object.hasOwn(files,f)))fs.unlinkSync(path.join(destination,f));for(const [f,b]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(destination,f)),{recursive:true});fs.writeFileSync(path.join(destination,f),b);}}
 return drift;
}
module.exports={inventory,generate};
if(require.main===module){try{const drift=generate(undefined,process.argv.includes('--check'));if(process.argv.includes('--check')&&drift.length)throw Error('Vendored runtime drift: '+drift.join(', '));console.error(JSON.stringify({files:Object.keys(inventory()).length,drift:drift.length}));}catch(e){console.error(e.message);process.exitCode=1;}}
