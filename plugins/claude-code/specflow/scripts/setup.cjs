#!/usr/bin/env node
'use strict';
// Thin public CLI adapter. Core setup owns init, target verification and state.
if(process.argv.slice(2).includes('--runtime')){console.error('This host action selects claude-code; use the public CLI for a different runtime.');process.exit(1);}
const r=require('child_process').spawnSync('specflow',['setup',...process.argv.slice(2),'--runtime','claude-code'],{stdio:'inherit'});
if(r.error)console.error(r.error.message+'\nUse a matching core CLI release: specflow setup TARGET --runtime claude-code. No private repair was attempted.');
process.exitCode=r.status===null?1:r.status;
