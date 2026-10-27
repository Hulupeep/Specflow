'use strict';
// Local connected-host transport management, never a caller-selected MCP endpoint or authority grant.
const fs=require('fs'),{readPrivate}=require('./improve-controller-cli.cjs'),{createRelay}=require('./improve-connected-tools.cjs');
function cli(args=process.argv.slice(2)){try{const [action,configFile,id,resultFile]=args,cfg=readPrivate(configFile),relay=createRelay(cfg.relay_root,cfg.heystax);if(action==='next')console.log(JSON.stringify({requests:relay.next()}));else if(action==='respond')console.log(JSON.stringify(relay.respond(id,readPrivate(resultFile))));else throw Error('invalid_command');return 0;}catch(e){console.error(JSON.stringify({reason_code:e.code||'connected_host_unavailable'}));return 2;}}
module.exports={cli};if(require.main===module)process.exitCode=cli();
