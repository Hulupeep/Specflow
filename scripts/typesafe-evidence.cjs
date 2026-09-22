'use strict';
// Build factual context from selected bytes, never from a model's assessment.
function execution(evidence, sourceFingerprint) {
  return evidence.map(item => {
    let value;
    try { value = JSON.parse(item.text); } catch { /* Explicitly unknown raw text. */ }
    if (value?.duo_capture !== 1) return { path: item.path, format: 'raw', freshness: 'unknown', content: item.text };
    return {
      path: item.path, format: 'duo_capture',
      freshness: !value.stable || value.sourceBefore !== value.sourceAfter ? 'unstable' : !sourceFingerprint ? 'unknown' : value.sourceAfter === sourceFingerprint ? 'current' : 'stale',
      sourceBefore: value.sourceBefore, sourceAfter: value.sourceAfter,
      command: value.command, exitCode: value.exitCode, error: value.error || null,
      stdout: value.stdout, stderr: value.stderr,
      note: 'A command exit is not proof that every required test executed. Inspect check identity, counts, skips and actual result.',
    };
  });
}
module.exports = { execution };
