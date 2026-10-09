'use strict';
// Small synchronous binding for the existing runner and interactive Duo helper.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const study = require('./typesafe-routing.cjs'), client = require('./typesafe-client.cjs');
function repository(root) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().replace(/^git@github.com:/, 'https://github.com/').replace(/\.git$/, '') : path.resolve(root);
}
function enrollment(root) {
  const file = path.join(root, '.specflow/routing-shadow.json');
  if (!fs.existsSync(file)) return null;
  const c = study.read(file);
  if (c.mode !== 'shadow' || !path.isAbsolute(c.studyDir) || !Array.isArray(c.contextFiles) || c.contextFiles.some(f => typeof f !== 'string')) throw Error('Invalid routing shadow enrollment');
  if (c.envFile && (!path.isAbsolute(c.envFile) || !/^\.env(?:\.[^/]*)?$/.test(path.basename(c.envFile)))) throw Error('Protected explicit .env path required');
  const s = study.load(c.studyDir);
  if (c.cohortId !== s.manifest.cohortId || !s.manifest.projects.includes(repository(root))) throw Error('Routing enrollment cohort/project mismatch');
  return c;
}
function enable(root, dir, contextFiles = [], envFile) {
  const s = study.load(dir);
  if (!s.manifest.projects.includes(repository(root))) throw Error('Register this repository in the frozen manifest first');
  const c = { mode: 'shadow', repository: repository(root), studyDir: path.resolve(dir), cohortId: s.manifest.cohortId, contextFiles, ...(envFile ? { envFile: path.resolve(envFile) } : {}) };
  // Refuse replacing a different enrollment; active runs retain their pinned copy.
  const file = path.join(root, '.specflow/routing-shadow.json');
  if (fs.existsSync(file) && client.hash(study.read(file)) !== client.hash(c)) throw Error('Existing enrollment preserved; use a new study enrollment explicitly between runs');
  selected(root, contextFiles); client.atomic(file, c); enrollment(root); return c;
}
function selected(root, files) {
  return files.map(name => {
    const f = path.resolve(root, name);
    if (!f.startsWith(path.resolve(root) + path.sep) || /(^|\/)(\.env(?:\.[^/]*)?|credentials[^/]*|[^/]*\.(key|pem))$/.test(name)) throw Error('Invalid selected context path');
    const text = fs.readFileSync(client.noLinks(f), 'utf8');
    if (Buffer.byteLength(text) > 24000 || client.sensitive(text)) throw Error('Context unavailable: sensitive or too large');
    return { path: name, hash: client.hash(text), text };
  });
}
function snapshot(root) {
  const r = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (r.status !== 0) throw Error('A Git snapshot is required');
  const files = [...new Set(r.stdout.split('\0').filter(Boolean))].filter(f => !/^(\.specflow\/|\.claude\/worktrees\/|node_modules\/)/.test(f) && !/(^|\/)\.env(?:\.|$)|credentials|\.(key|pem)$/.test(f)).sort();
  const entries = files.map(f => {
    const target = client.noLinks(path.join(root, f));
    return [f, fs.existsSync(target) && fs.statSync(target).isFile() ? client.hash(fs.readFileSync(target).toString('base64')) : 'missing'];
  });
  return client.hash(entries);
}
function begin(root, config, task, options = {}) {
  if (!config) return null;
  try {
    const s = study.load(config.studyDir);
    if (s.manifest.cohortId !== config.cohortId) throw Error('Pinned routing cohort changed');
    const context = selected(root, config.contextFiles);
    const input = { ...task, repository: repository(root), snapshotHash: task.snapshotHash || snapshot(root), context: JSON.stringify(context.length ? context : [{ text: task.context || task.acceptance }]), evidenceRefs: [...(task.evidenceRefs || []), ...context.map(c => c.path)] };
    const file = path.join(config.studyDir, 'requests', client.hash(input) + '.json'); client.atomic(file, input);
    const result = (options.execute || spawnSync)(process.execPath, [path.join(__dirname, 'typesafe-routing.cjs'), 'observe', config.studyDir, file, ...(config.envFile ? [config.envFile] : [])], { encoding: 'utf8', timeout: s.manifest.timeoutMs + 5000, maxBuffer: 4096, env: process.env });
    if (result.status !== 0) throw Error('Observer unavailable or interrupted; inspect private study records');
    const receipt = JSON.parse(result.stdout);
    if (!receipt.decisionId || !['recorded', 'unavailable'].includes(receipt.status)) throw Error('Invalid observer receipt');
    return { ...receipt, studyDir: config.studyDir };
  } catch (e) { return { status: 'unavailable', reason: e.message }; }
}
function end(config, receipt, value) {
  if (!config || !receipt) return null;
  if (!receipt.decisionId) return { status: 'unavailable', reason: receipt.reason };
  try { study.outcome(config.studyDir, receipt.decisionId, value); return { status: 'recorded', decisionId: receipt.decisionId }; }
  catch (e) { return { status: 'unavailable', reason: e.message }; }
}
function terminal(config, runId, status, evidenceRefs = []) {
  if (!config) return null;
  try { return study.terminal(config.studyDir, runId, status, evidenceRefs, config.repository); }
  catch (e) { return { status: 'unavailable', reason: e.message }; }
}
function reportStatus(config) {
  if (!config) return null;
  try {
    return { mode: 'shadow', reports: study.reports(config.studyDir).map(r => { const report = study.read(r.file); return { ...r, outcome: report.outcome, blocker: report.blocker, nextAction: report.nextAction }; }), nextAction: 'Read pending private report, present its outcome/blocker/next action, then acknowledge its report ID. No automatic model switching.' };
  } catch (e) { return { mode: 'shadow', status: 'unavailable', reason: e.message }; }
}
module.exports = { repository, enrollment, enable, selected, snapshot, begin, end, terminal, reportStatus };
