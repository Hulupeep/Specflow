'use strict';
// Shared sensitive-path and reviewer environment filtering.
const excluded = name => /(^|\/)(\.env(?:\.[^/]*)?|[^/]*\.(?:pem|key)|credentials(?:\.[^/]*)?)$|(^|\/)(?:production|prod)[-_/].*log|(^|\/)logs\/production|(?:production|prod)\.log$/i.test(name)
  || /(^|\/)\.specflow\/runs\/(?:repair-backups\/|[^/]+\/adapter\/)/.test(name.replace(/\\/g,'/'));
function peerEnv(env) { return Object.fromEntries(Object.entries(env).filter(([key]) => !/^TYPESAFE_/i.test(key))); }
module.exports={excluded,peerEnv};
