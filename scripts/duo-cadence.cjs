#!/usr/bin/env node
'use strict';
// Observe the owner's run. Never claim it, change acceptance or launch a model.
const fs = require('fs');
const path = require('path');
const duo = require('./duo-build.cjs');
const direction = require('./duo-direction.cjs');
const actions = require('./duo-actions.cjs');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function assess(root, id) {
  const pinned = require('./duo-runtime.cjs').dispatch(root,id,__dirname);
  if (pinned) return require(path.join(pinned,'duo-cadence.cjs')).assess(root,id);
  const { dir, state: saved } = duo.load(root, id);
  if (fs.existsSync(path.join(dir, 'review.lock'))) return { status: 'blocked', reason: 'A run operation is active. Wait for its result; do not start another review or edit its snapshot.' };
  const state = duo.inspect(root, id), last = state.history.at(-1);
  if (state.goalStatus === 'complete') return { status: 'reviewed', reason: 'Scoped goal finished on current evidence.' };
  const guards=duo.eligibility(root,id).blockers;
  if (guards.length) {
    const recoverable=guards.every(g=>g.recoverable === true);
    return {status:recoverable?'continue_required':'blocked',reason:`Cause: ${state.lastFailure || state.blocker || 'Review unavailable'}. ${guards.map(g=>g.reason).join('; ')}. Inspect retained round evidence and use recover-review for an evidenced different action; do not reset history.`};
  }
  if (!last) return { status: 'review_required', reason: 'No peer feedback yet. Review the completed implementation, diagnosis or verification batch, even if other goal gates remain blocked.' };
  const batch = readJson(path.join(dir, `round-${String(state.history.length).padStart(3, '0')}`, 'batch.json'));
  const fresh = last.snapshot === duo.fingerprint(root, [...Object.keys(state.pinned), ...(batch.evidence || [])]);
  const captureFresh = Object.hasOwn(last, 'capturePath') ? last.capturePath === (state.lastCapture?.path || null) : !state.lastCapture;
  if (!fresh || !captureFresh) return { status: 'review_required', reason: (actions.next(state)?.reason || '') + ' Source or execution evidence changed since review. Capture current raw results and request review before reporting this batch complete.' };
  if (last.stage === 'validated' || last.progress) {
    const instruction = actions.next(state);
    if (instruction) return instruction;
    if (last.review?.direction?.assessment === 'blocked') return { status: 'blocked', reason: direction.next(last.review.direction) };
    if (last.review?.direction?.next_steps.some(s => s.owner === 'builder')) return { status: 'continue_required', reason: direction.next(last.review.direction) };
    if (last.outcome === 'changes_required') return { status: 'review_required', reason: 'Peer requested corrections. Fix actionable findings, capture new evidence and re-review within the existing limits.' };
    return { status: last.outcome === 'accepted' ? 'reviewed' : 'blocked', reason: last.summary };
  }
  if (['peer_check', 'peer_review'].includes(last.stage)) return { status: 'blocked', reason: `Peer feedback unavailable: ${last.summary}. Report blocked, never duo-verified.` };
  return { status: 'review_required', reason: `Review preflight failed: ${saved.blocker}. Correct the batch/evidence and retry without weakening acceptance.` };
}
function stop(root, input) {
  if (process.env.SPECFLOW_DUO_REVIEWER || !input.session_id) return {};
  const base = path.join(root, '.specflow/duo');
  if (!fs.existsSync(base)) return {};
  const ids = fs.readdirSync(base).filter(id => /^[a-zA-Z0-9-]+$/.test(id)).filter(id => {
    const file = path.join(base, id, 'run.json');
    if (!fs.existsSync(file)) return false;
    // Unreadable unrelated state cannot identify an owner and must not stop all
    // conversations. Direct status/review/finish still reject that corrupt run.
    let state; try { state = readJson(file); } catch { return false; }
    return state && state.goalStatus !== 'complete' && state.owner?.builder === 'claude-code' && state.owner.hostSession === input.session_id;
  });
  if (!ids.length) return {}; // Other conversations and non-duo work are unaffected.
  const pending = ids.map(id => {
    try { return { id, ...assess(root, id) }; }
    catch (e) { return { id, status: 'blocked', reason: e.message }; }
  });
  const required = pending.filter(row => ['review_required', 'continue_required'].includes(row.status));
  if (required.length) {
    const reason = required.map(row => {
      const state=duo.load(root,row.id).state;
      const entry=state.runtime.directory ? path.join('.specflow/duo',row.id,state.runtime.directory,'scripts/duo-build.cjs') : 'scripts/duo-build.cjs';
      return `Duo ${row.id}: ${row.reason}\nUse your existing owner token with node ${entry} review ${row.id} --session <token> --batch <batch.json>.`;
    }).join('\n') + '\nRead the saved continuation.md and act on the authorized builder step now. Record your direction_response and capture the result. Do not wait for user permission to review, unrelated live gates, or a ten-minute timer. Do not change pinned acceptance.';
    // One corrective continuation; never an unbounded Stop-hook loop.
    return input.stop_hook_active ? { continue: false, stopReason: `Duo remains unreviewed; automatic continuation exhausted. ${reason}` } : { decision: 'block', reason };
  }
  const blocked = pending.filter(row => row.status === 'blocked');
  return blocked.length ? { continue: false, stopReason: blocked.map(row => `Duo ${row.id} blocked: ${row.reason}`).join('\n') } : {};
}
function cli(args, root = process.cwd()) {
  if (process.env.SPECFLOW_DUO_REVIEWER) return 0;
  try {
    if (args[0] === '--hook') console.log(JSON.stringify(stop(root, readJson(0))));
    else { const result = assess(root, args[0]); console.log(JSON.stringify(result)); return result.status === 'reviewed' ? 0 : 2; }
    return 0;
  } catch (e) {
    console.log(JSON.stringify({ continue: false, stopReason: `Duo cadence check blocked: ${e.message}` })); return 0;
  }
}
module.exports = { assess, stop, cli };
if (require.main === module) process.exitCode = cli(process.argv.slice(2), path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd()));
