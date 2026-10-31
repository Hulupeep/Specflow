'use strict';

// Shared by credential issue and the managed-generation coordinator. No coercion:
// a phase names an actual core round, not a model-selected expression.
function validPhase(value) {
  if (value === 'baseline' || value === 'after') return true;
  if (typeof value !== 'string' || !/^dev-r[1-9][0-9]*$/.test(value)) return false;
  const round = Number(value.slice(5));
  return Number.isSafeInteger(round) && round > 0 && value === 'dev-r' + round;
}
module.exports = { validPhase };
