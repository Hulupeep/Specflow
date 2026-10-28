'use strict';
// Canonical fresh read-only native transport shared by preparation and advice.
const path=require('path'),cp=require('child_process');
function command(exe,args,options={}){const {combineOutput,...spawnOptions}=options;const r=cp.spawnSync(exe,args,{encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,...spawnOptions});if(r.error||r.status!==0)throw Error(exe+': '+(r.error?.message||r.stderr||r.stdout||'exit '+r.status));return combineOutput?(r.stdout||'')+(r.stderr||''):r.stdout;}
function check(provider,invoke=command){
 if(!['claude','codex'].includes(provider))throw Error('Unsupported read-only native provider');
 const version=invoke(provider,['--version']).trim(),auth=invoke(provider,provider==='claude'?['auth','status']:['login','status'],{combineOutput:true});
 if(provider==='claude'&&JSON.parse(auth).loggedIn!==true)throw Error('Claude authentication unavailable');
 if(provider==='codex'&&!/Logged in using\s+\S/i.test(auth))throw Error('Codex authentication not confirmed by login status');
 return {peer:provider,version,authenticated:true,artifactAccess:'not yet verified',enforcedMode:provider==='claude'?'Read/Glob/Grep only, dontAsk':'read-only sandbox, approval never'};
}
function invocation(provider,dir,github=null,reviewerModel=null,{purpose='duo',outputSchema}={}){
 if(!['claude','codex'].includes(provider)||!outputSchema)throw Error('Provider and strict output schema required');
  if (!['duo','advisory'].includes(purpose)) throw Error('Unsupported read-only review purpose');
  const reads = ['issue view', 'issue list', 'pr view', 'pr list', 'pr diff', 'pr checks', 'run view', 'run list', 'repo view', 'auth status'];
  const cache = path.resolve(dir, 'gh-cache');
  const env = github ? { XDG_CACHE_HOME: cache, GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' } : {};
  const transport = `You are a read-only ${purpose} reviewer. Use Read, Glob and Grep for ALL local inspection, including JSON. Read every path in the required-read checklist before deciding. Bash is ONLY for one standalone allowlisted gh read per call. Never use gh api, local shell utilities, pipes, redirects, command chaining or substitution. Use gh --json/--jq options to select output instead of shell tools. Do not probe permissions, edit files, run skills or launch another model. If required access is unavailable, report blocked with the missing evidence.`;
  if (provider === 'claude') return { exe: 'claude', env, args: ['-p', '--effort', 'medium', '--append-system-prompt', transport, '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(providerSchema(outputSchema,'claude')), '--permission-mode', 'dontAsk', '--tools', github ? 'Read,Glob,Grep,Bash' : 'Read,Glob,Grep', '--allowedTools', ['Read,Glob,Grep', ...(github ? reads.flatMap(cmd => [`Bash(gh ${cmd})`, `Bash(gh ${cmd} *)`]) : [])].join(','), '--disable-slash-commands', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence', '--setting-sources', '', '--safe-mode'] };
  if(reviewerModel && !/^(gpt|o[134]|codex)[A-Za-z0-9._-]*$/.test(reviewerModel)) throw Error('Codex scoped review requires an explicit supported model family');
  const permissions = github ? ['--strict-config', '-c', 'default_permissions="duo-review"', '-c', 'permissions.duo-review.extends=":read-only"', '-c', `permissions.duo-review.filesystem={${JSON.stringify(cache)}="write"}`, '-c', 'permissions.duo-review.network.enabled=true'] : ['--sandbox', 'read-only'];
  return { exe: 'codex', env, args: ['exec', ...permissions, ...(reviewerModel ? ['--model',reviewerModel] : []), '--json', '--ephemeral', '--ignore-user-config', '-c', 'approval_policy="never"', '--skip-git-repo-check', '--output-schema', path.join(dir, 'schema.json'), '-o', path.join(dir, 'response.json'), '-'] };
}
function providerSchema(value,provider){const copy=structuredClone(value);if(provider==='claude')delete copy.$schema;function visit(node){if(!node||typeof node!=="object")return;if(provider==="codex")delete node.uniqueItems;for(const child of Object.values(node))visit(child);}visit(copy);return copy;}
module.exports={check,invocation,providerSchema};
