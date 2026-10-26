'use strict';
// Explicit protocol double. Never an actual model, subscription or sandbox proof.
const fs = require('fs'),
  path = require('path');
const args = process.argv.slice(2),
  root = path.dirname(process.argv[1]);
if (args[0] === '--version') console.log('protocol-fixture1');
else if (args[0] === 'auth')
  console.log(
    JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      apiKeySource: 'none'
    })
  );
else {
  process.stdin.resume();
  process.stdin.on('end', () => {
    const file = path.join(root, 'provider-mode.json'),
      mode = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)).mode : 'success';
    const stat = fs.readFileSync('/proc/self/stat', 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    fs.writeFileSync(
      path.join(root, 'provider-started.json'),
      JSON.stringify({ pid: process.pid, group: Number(fields[2]) }),
      { mode: 0o600 }
    );
    if (mode === 'hang') {
      setInterval(() => {}, 1000);
      return;
    }
    if (mode === 'nonzero') {
      process.stderr.write('Explicit protocol fixture nonzero exit\n');
      process.exitCode = 3;
      return;
    }
    if (mode === 'malformed') {
      process.stdout.write('not a native event\n');
      return;
    }
    const schema = JSON.parse(args[args.indexOf('--json-schema') + 1]),
      binding = Object.fromEntries(
        Object.entries(schema.properties._binding.properties).map(([k, v]) => [k, v.const])
      );
    const session = args[args.indexOf('--session-id') + 1],
      requested = args[args.indexOf('--model') + 1],
      model = requested === 'sonnet' ? 'fixture-builder' : requested;
    const finish=()=>{
    if(mode==='native-auth-refusal'){for(const record of require('./native-auth-refusal.json').records){const frame={...record,session_id:session};if(frame.model)frame.model=model;console.log(JSON.stringify(frame));}process.exit(1);}

    console.log(
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        model,
        session_id: session,
        tools: ['StructuredOutput'],
        mcp_servers: []
      })
    );
    if (mode === 'quota' || mode === 'auth') {
      console.log(
        JSON.stringify({
          type: 'result',
          subtype: 'error',
          session_id: session,
          is_error: true,
          error: mode === 'quota' ? 'rate_limit: quota unavailable' : 'authentication: unauthorized'
        })
      );
      process.exitCode = 1;
      return;
    }
    if (mode === 'binding') binding.nonce = 'wrong';
    console.log(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        session_id: session,
        structured_output: { _binding: binding },
        total_cost_usd: 99
      })
    );
    };if(mode==='delayed-success')setTimeout(finish,1500);else finish();
  });
}
