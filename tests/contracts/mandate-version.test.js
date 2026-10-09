const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { spawnSync } = require('child_process');
const { currentMandate } = require('../../scripts/adversary-mandate.cjs');
const { DEFAULT_MANDATE_REF } = require('../../scripts/adversary-spawn.cjs');
const { syncLoops } = require('../../scripts/sync-loop-templates.cjs');
const root = path.resolve(__dirname, '../..');

test('#130: source header, loop and spawn agree; every shipped loop file is canonical', () => {
  const { ref, path: file } = currentMandate();
  expect(DEFAULT_MANDATE_REF).toBe(ref);
  const loop = yaml.load(fs.readFileSync(path.join(root, 'templates/loops/spec-build.yaml'), 'utf8'));
  const adversary = loop.stages.find(s => s.id === 'adversary');
  expect(adversary.mandate_ref).toBe(ref);
  expect(adversary.do).toContain(`@${ref.split('@')[1]}`);
  expect(fs.readFileSync(file, 'utf8').match(/^# adversary-mandate@v\d+/gm)).toHaveLength(1);
  expect(syncLoops(root, true)).toEqual([]);
});

test('#130: changing one header regenerates the version references and shipping mirror; check detects drift', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandate-sync-'));
  try {
    fs.mkdirSync(path.join(dir, 'templates'), { recursive: true });
    fs.cpSync(path.join(root, 'templates/loops'), path.join(dir, 'templates/loops'), { recursive: true });
    const file = path.join(dir, 'templates/loops/adversary-mandate.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^# adversary-mandate@v\d+/, '# adversary-mandate@v999'));
    expect(syncLoops(dir, true).length).toBeGreaterThan(0);
    syncLoops(dir);
    expect(syncLoops(dir, true)).toEqual([]);
    const yamlText = fs.readFileSync(path.join(dir, 'templates/loops/spec-build.yaml'), 'utf8');
    expect(yamlText).toContain('adversary-mandate@v999');
    expect(yamlText).toContain('adversarial-prd-reviewer @v999');
    fs.appendFileSync(path.join(dir, 'templates/QA/loops/spec-build.yaml'), '\n# drift\n');
    expect(syncLoops(dir, true)).toContain('mirror: spec-build.yaml');
    syncLoops(dir);
    expect(syncLoops(dir, true)).toEqual([]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('#130: installed resolver uses QA and blocks absent or stacked mandates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandate-installed-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.mkdirSync(path.join(dir, 'QA/loops'), { recursive: true });
    for (const name of ['adversary-mandate.cjs', 'adversary-spawn.cjs', 'verify-seed.cjs']) {
      fs.copyFileSync(path.join(root, 'scripts', name), path.join(dir, 'scripts', name));
    }
    const file = path.join(dir, 'QA/loops/adversary-mandate.md');
    fs.copyFileSync(currentMandate().path, file);
    const run = () => spawnSync(process.execPath, ['-e', "const {prepareAdversarySpawn}=require('./scripts/adversary-spawn.cjs'); console.log(prepareAdversarySpawn(['PRDs/x.md']).mandate_ref)"], { cwd: dir, encoding: 'utf8' });
    expect(run()).toMatchObject({ status: 0, stdout: `${DEFAULT_MANDATE_REF}\n` });
    fs.appendFileSync(file, '\n# adversary-mandate@v999\n');
    expect(run().status).not.toBe(0);
    fs.unlinkSync(file);
    expect(run().status).not.toBe(0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
