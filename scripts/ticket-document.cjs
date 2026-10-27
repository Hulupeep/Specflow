'use strict';
// One ticket document for existing seam and ADR readers. Legacy arrays retain
// their meaning; version 2 opts into strict typed-interface capability.
function parseTicketDocument(value) {
  if (Array.isArray(value)) {
    for (const ticket of value) for (const key of ['writes', 'reads']) {
      if (Array.isArray(ticket?.[key]) && ticket[key].some(surface => typeof surface !== 'string')) throw Error('typed endpoints require a version:2 tickets envelope; legacy arrays support string surfaces only');
    }
    return { version: 1, tickets: value };
  }
  if (!value || typeof value !== 'object' || value.version !== 2 || !Array.isArray(value.tickets)
    || Object.keys(value).some(k => !['version', 'tickets'].includes(k))) throw Error('unsupported ticket document; use a legacy array or version:2 tickets envelope');
  const seen = new Set();
  for (const ticket of value.tickets) {
    if (!ticket || typeof ticket !== 'object' || typeof ticket.id !== 'string' || !ticket.id.trim() || seen.has(ticket.id)) throw Error('typed ticket needs a unique stable owner id');
    seen.add(ticket.id);
    for (const key of ['writes', 'reads']) if (ticket[key] !== undefined && !Array.isArray(ticket[key])) throw Error(`${ticket.id}: ${key} must be an array`);
  }
  return { version: 2, tickets: value.tickets };
}
function legacySurfaces(document) {
  return document.version === 1 ? document.tickets : document.tickets.map(t => ({ ...t,
    writes: (t.writes || []).filter(s => typeof s === 'string'), reads: (t.reads || []).filter(s => typeof s === 'string'),
  }));
}
module.exports = { parseTicketDocument, legacySurfaces };
