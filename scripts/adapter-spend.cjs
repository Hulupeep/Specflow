'use strict';

// Operator-selected policy, not a price oracle or permission to use an API.
// No model name, estimate or task text establishes billing or spending authority.
function resolve(policy = {}) {
  const billing = policy.billing === undefined ? 'unknown' : policy.billing;
  const cost = policy.cost === undefined ? 'unknown' : policy.cost;
  if (!['subscription_cli', 'api', 'unknown'].includes(billing)) throw Error('invalid_billing_classification');
  if (!['ordinary', 'low_cost', 'expensive', 'unknown'].includes(cost)) throw Error('invalid_cost_classification');
  const valid = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (policy.max_budget_usd !== undefined && !valid(policy.max_budget_usd)) throw Error('invalid_monetary_cap');
  const flags = [];
  const args = policy.args || [];
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) throw Error('invalid_adapter_args');
  if (args.includes('--')) throw Error('adapter_args_option_terminator: adapter owns the prompt boundary');
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    if (args[i] === '--max-budget-usd') flags.push(Number(args[++i]));
    else if (args[i].startsWith('--max-budget-usd=')) flags.push(Number(args[i].slice(17)));
  }
  if (flags.length > 1) throw Error('conflicting_monetary_cap');
  if (flags.some(n => !valid(n))) throw Error('invalid_monetary_cap');
  if (flags.length && policy.max_budget_usd !== undefined && flags[0] !== policy.max_budget_usd) throw Error('conflicting_monetary_cap');
  const cap = policy.max_budget_usd ?? flags[0] ?? null;
  if (cost === 'expensive' && billing === 'unknown') throw Error('expensive_billing_unknown: configure the trusted billing classification');
  if (billing === 'api' && cost === 'expensive' && cap === null) throw Error('expensive_api_cap_required: configure an explicit positive max_budget_usd');
  const enforcement = cap === null ? 'none' : policy.provider === 'claude-print' ? 'cli' : 'unsupported';
  if (enforcement === 'unsupported' && (policy.provider !== 'fake' || (billing === 'api' && cost === 'expensive'))) {
    throw Error('monetary_guard_unsupported: this adapter cannot enforce the configured owner cap');
  }
  return { billing, cost, max_budget_usd: cap, enforcement };
}

function apply(args, decision) {
  if (decision.enforcement === 'cli' && !args.some(a => a === '--max-budget-usd' || a.startsWith('--max-budget-usd='))) {
    args.push('--max-budget-usd', String(decision.max_budget_usd));
  }
  return args;
}

function peerPolicy(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !['billing', 'cost', 'max_budget_usd'].includes(k))) {
    throw Error('peer_policy_field: only billing, cost and max_budget_usd are allowed');
  }
  resolve({ ...raw, provider: 'claude-print' });
  return { ...raw };
}

module.exports = { resolve, apply, peerPolicy };
