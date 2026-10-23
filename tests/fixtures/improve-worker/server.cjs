const fs = require('fs'),
  http = require('http');
if (!fs.existsSync('/data/state.json')) fs.writeFileSync('/data/state.json', JSON.stringify({ value: 'seed' }));
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Worker capability fixture</title><style>body{font:16px sans-serif;max-width:500px;margin:16px}input{display:block;box-sizing:border-box;max-width:100%;margin:8px 0}button{min-height:40px}</style><h1>Worker capability fixture</h1><p id="value"></p><label>Fixture credential<input id="credential" type="password"></label><label>New value<input id="newvalue"></label><button id="save">Save</button><p id="status" role="status"></p><script>async function load(){value.textContent=(await(await fetch('/api')).json()).value}load();save.onclick=async()=>{const r=await fetch('/api',{method:'POST',headers:{authorization:'Bearer '+credential.value,'content-type':'application/json'},body:JSON.stringify({value:newvalue.value})});status.textContent=r.status===200?'Saved':'Forbidden';credential.value='';await load();};</script>`;
http
  .createServer(async (q, s) => {
    if (q.url === '/api' && q.method === 'POST') {
      if (q.headers.authorization !== 'Bearer ' + fs.readFileSync('/fixture/token', 'utf8')) {
        s.writeHead(403);
        s.end('Forbidden');
        return;
      }
      let b = '';
      for await (const c of q) b += c;
      const d = JSON.parse(b);
      fs.writeFileSync('/data/state.json', JSON.stringify({ value: d.value }));
      s.end('Saved');
      return;
    }
    if (q.url === '/api') {
      s.end(fs.readFileSync('/data/state.json'));
      return;
    }
    s.setHeader('content-type', 'text/html');
    s.end(html);
  })
  .listen(4400, '127.0.0.1');
