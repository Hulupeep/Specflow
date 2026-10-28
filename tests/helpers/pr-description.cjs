// Explicit synthetic draft for isolated runner tests; never production test evidence.
const fs=require('fs'),path=require('path');
const body=issue=>`## Summary\nExercise an isolated runner fixture.\n\nCloses #${issue}\n\n## Contract / journey IDs\nJ-PR-DESCRIPTION-HANDOFF (synthetic fixture).\n\n## What changed\nOnly fixture state.\n\n## Test plan\n\`node fixture-check.cjs\`: passed in the isolated test harness.\n\n## Gate C\nPending; fixture does not establish real CI approval.\n\n## Risk / rollout\nNo product rollout; temporary fixture only.\n\n## Screenshots / recordings\nN/A: no UI.\n`;
function write(root,issue=122){const file=path.join(root,'evidence',`pr-description-${issue}.md`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body(issue));return file;}
module.exports={body,write};
