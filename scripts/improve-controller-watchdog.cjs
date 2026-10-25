'use strict';
// Independent owner-host guardian for one relay process group; no repository I/O.
const fs = require('fs');
function birth(pid) {
  try {
    const s = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const p = s.slice(s.lastIndexOf(')') + 2).split(' ');
    return { state: p[0], group: Number(p[2]), start: p[19] };
  } catch {
    return null;
  }
}
function start({ parent, group, started, deadline }) {
  if (
    !Number.isSafeInteger(parent) ||
    parent <= 1 ||
    !Number.isSafeInteger(group) ||
    group <= 1 ||
    !Number.isFinite(deadline) ||
    typeof started !== 'string'
  )
    process.exit(2);
  const timer = setInterval(() => {
    const p = birth(parent);
    if (p && p.start === started && !['Z', 'X'].includes(p.state) && Date.now() < deadline) return;
    clearInterval(timer);
    try {
      process.kill(-group, 'SIGKILL');
    } catch (e) {
      if (e.code !== 'ESRCH') process.exitCode = 2;
    }
  }, 100);
}
if (require.main === module) start(JSON.parse(process.argv[2]));
module.exports = { birth, start };
