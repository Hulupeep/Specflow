'use strict';
// Rebuild candidate integrity after source edits; never hot-edit an active installed pin.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function seal(root=path.resolve(__dirname,'../plugins/specflow-improve')){const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.name==='integrity.json'?[]:e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]),files=walk(root).sort().map(f=>({path:path.relative(root,f).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')})),version=JSON.parse(fs.readFileSync(path.join(root,'plugin.json'))).version,data=JSON.stringify({version,files},null,2)+'\n';fs.writeFileSync(path.join(root,'integrity.json'),data);return {version,files:files.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}
module.exports={seal};if(require.main===module)console.log(JSON.stringify(seal(process.argv[2])));
