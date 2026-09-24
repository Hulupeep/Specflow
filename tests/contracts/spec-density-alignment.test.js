const fs = require('fs'), path = require('path'), yaml = require('js-yaml');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('active contracts index the tier policy and scope preflight to selected build-ready work', () => {
  const index = yaml.load(read('docs/contracts/CONTRACT_INDEX.yml'));
  expect(index.contracts).toContainEqual({ id: 'feature_spec_density', path: 'docs/contracts/feature_spec_density.yml' });
  for (const entry of index.contracts) expect(yaml.load(read(entry.path)).contract_meta.id).toBe(entry.id);
  const preflight = yaml.load(read('docs/contracts/feature_preflight.yml'));
  expect(preflight.board_auditor_rules.applicability).toMatchObject({ tier: 'build-ready', policy: 'scripts/specflow-tier.cjs' });
  expect(preflight.board_auditor_rules.applicability.thin).toContain('no automatic full simulation');
  expect(preflight.board_auditor_rules.required_section.description).not.toContain('Every specflow-compliant ticket');
  expect(preflight.board_auditor_rules.staleness_rules.ticket_staleness.rule).toContain('scope/acceptance hash');
  expect(preflight.board_auditor_rules.override_rules.effect).toContain('not passed');
  expect(read('CLAUDE.md')).toContain('| `feature_spec_density`');
});
test('installed loop templates and active planning references carry the same applicability', () => {
  for (const base of ['templates/QA/loops', 'templates/loops']) {
    const spec = yaml.load(read(base + '/spec-build.yaml'));
    expect(spec.specification_policy.thin).toContain('no automatic full review');
    const build = yaml.load(read(base + '/feature-build.yaml'));
    expect(build.specification_policy.command).toContain('feature-build build');
  }
  for (const file of ['skills/specflow-audit/references/uplift-process.md', 'skills/specflow-audit/references/preflight-gate.md', 'skills/specflow-simulate/references/simulation-method.md', 'SKILL.md', 'templates/PROCESS.md']) {
    expect(read(file)).toContain('Thin work stays');
    expect(read(file)).not.toMatch(/EVERY write AND edit|After every uplift, it MUST|Feature ticket\*\*: all sections/);
  }
  expect(read('agents/board-auditor.md')).not.toContain('updated_at > simulated_at');
  expect(read('agents/waves-controller.md')).not.toContain('override:*` → proceed');
});
test('all installed spec-build templates replace legacy retry loops with bounded shared reviews',()=>{
 for(const file of ['templates/QA/loops/spec-build.yaml','templates/loops/spec-build.yaml','templates/QA/spec-build-loop.md','templates/QA/spec-build.md']){
  const text=fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
  expect(text).not.toMatch(/cycles ≤ 4|adversary ≤ 4|uplift ≤ 3|re-audits ≤ 3|do_until:|re-review until a verdict|Repeats until/);
  expect(text).toContain('initial + one repair');expect(text).toContain('no-new-evidence');
 }
});

test('recursive installed instruction scan reports every obsolete budget and universal full-ticket instruction',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 const files=['templates/QA','templates/loops','templates/process'].flatMap(base=>walk(path.join(__dirname,'../..',base))).concat(['README.md','SKILL.md','templates/PROCESS.md'].map(file=>path.join(__dirname,'../..',file)));
 const violations=[];
 for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const obsolete=/adversary ≤ 4|uplift ≤ 3|adversary cycles ≤ 4|re-audits ≤ 3|Repeats until a verdict|do_until: verdict|walks (?:real )?personas through each ticket|walking a real user through each ticket|For every ticket the spec-build loop produced|No ticket-writing starts|refuses to spawn ticket-writing|ticket-writing until SHIP|Round after round|A single model can switch hats|Before any ticket is accepted as specflow-compliant|Do not begin ticket-writing until|No tickets until SHIP|journey-contracted tickets|no tickets before|no SHIP verdict, no tickets|journey-contracted work|carries the full ceremony|cannot write tickets until|through each (?:ticket|one)|wire every ticket|re-attacks/ig;
  const matches=[...text.matchAll(obsolete)].map(match=>({line:text.slice(0,match.index).split('\n').length,text:match[0]}));
  if(matches.length)violations.push({file:path.relative(root,file),matches});
 }
 expect(violations).toEqual([]);
 const skill=read('SKILL.md');
 expect(yaml.load(skill.split('---')[1])).toMatchObject({name:'specflow'});
 expect(skill).not.toMatch(/override.*wave can proceed|All tickets with.*override|any ticket is created or edited/);
});
