'use strict';
// Daily wall slots, separate from delivery time and profile revisions.
const crypto = require('crypto');
const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function resolveSlot({
  canonicalRepo,
  scheduleId,
  timezone,
  localDate,
  localTime,
  now = Date.now(),
  graceMs = 300000
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime))
    throw Error('invalid_slot');
  const base = Date.parse(localDate + 'T' + localTime + ':00Z');
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 10) !== localDate)
    throw Error('invalid_slot');
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const matches = [];
  // IANA offsets are minute-aligned for these contemporary scheduling dates.
  if (+localDate.slice(0, 4) < 2000) throw Error('unsupported_historical_slot');
  for (let offset = -14 * 60; offset <= 14 * 60; offset++) {
    const instant = base + offset * 60000,
      p = Object.fromEntries(fmt.formatToParts(instant).map((v) => [v.type, v.value]));
    if (p.year + '-' + p.month + '-' + p.day === localDate && p.hour + ':' + p.minute === localTime)
      matches.push(instant);
  }
  const instant = matches[0] ?? null;
  return {
    id: sha([canonicalRepo, scheduleId, timezone, localDate, localTime]),
    schedule_id: scheduleId,
    timezone,
    local_date: localDate,
    local_time: localTime,
    intended_at_utc: instant === null ? null : new Date(instant).toISOString(),
    ambiguity: matches.length > 1 ? 'earliest' : 'none',
    disposition:
      instant === null
        ? 'skipped_nonexistent'
        : now < instant
          ? 'not_due'
          : now > instant + graceMs
            ? 'missed'
            : 'due'
  };
}
module.exports = { resolveSlot };
