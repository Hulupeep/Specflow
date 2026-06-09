/**
 * Gate B leg 3 — ticket↔journey join (verify-ticket-journey.cjs).
 *
 * Oracle: journey IDs are read from the REAL fixture contracts
 * (sample apps/AISP-Specflow/docs/contracts), never hardcoded by guess.
 */

const { resolve } = require('path');
const {
  loadJourneyIds,
  parseTicketRefs,
  auditTicketJourney,
} = require('../../scripts/verify-ticket-journey.cjs');

const FIXTURE_CONTRACTS = resolve(__dirname, '../../sample apps/AISP-Specflow/docs/contracts');

describe('loadJourneyIds (anchored to real fixtures)', () => {
  test('extracts exactly the journey IDs defined in the fixture contracts', () => {
    const ids = loadJourneyIds(FIXTURE_CONTRACTS);
    // Oracle: the three journey_*.yml fixtures define these IDs.
    expect([...ids].sort()).toEqual(['J-TODO-COMPLETE', 'J-TODO-CREATE', 'J-TODO-DELETE']);
  });

  test('returns empty set for a non-existent dir (no throw)', () => {
    expect(loadJourneyIds(resolve(__dirname, 'does-not-exist')).size).toBe(0);
  });
});

describe('parseTicketRefs', () => {
  test('extracts J- references from title and body', () => {
    const refs = parseTicketRefs([
      { number: 1, title: 'Implement J-TODO-CREATE', body: 'see also J-TODO-COMPLETE' },
      { number: 2, title: 'no refs here', body: 'plain text' },
    ]);
    expect([...refs.get(1)].sort()).toEqual(['J-TODO-COMPLETE', 'J-TODO-CREATE']);
    expect(refs.get(2).size).toBe(0);
  });

  test('does not match J- substrings mid-word', () => {
    const refs = parseTicketRefs([{ number: 3, title: '', body: 'NOTAJ-THING and majJ-X' }]);
    expect(refs.get(3).size).toBe(0);
  });
});

describe('auditTicketJourney (the join)', () => {
  const journeyIds = loadJourneyIds(FIXTURE_CONTRACTS); // real oracle

  test('passes when every journey has a ticket and every ref resolves', () => {
    const issues = [
      { number: 10, title: 'J-TODO-CREATE', body: '' },
      { number: 11, title: 'J-TODO-COMPLETE', body: '' },
      { number: 12, title: 'J-TODO-DELETE', body: '' },
    ];
    const r = auditTicketJourney(journeyIds, issues);
    expect(r.orphanJourneys).toEqual([]);
    expect(r.danglingTickets).toEqual([]);
    expect(r.pass).toBe(true);
  });

  test('flags an orphan journey (defined, no ticket)', () => {
    const issues = [
      { number: 10, title: 'J-TODO-CREATE', body: '' },
      { number: 11, title: 'J-TODO-COMPLETE', body: '' },
      // J-TODO-DELETE intentionally uncovered
    ];
    const r = auditTicketJourney(journeyIds, issues);
    expect(r.orphanJourneys).toEqual(['J-TODO-DELETE']);
    expect(r.pass).toBe(false);
  });

  test('flags a dangling ticket ref (journey ID that does not exist)', () => {
    const issues = [
      { number: 10, title: 'J-TODO-CREATE', body: '' },
      { number: 11, title: 'J-TODO-COMPLETE', body: '' },
      { number: 12, title: 'J-TODO-DELETE', body: '' },
      { number: 13, title: 'J-TODO-NOPE', body: 'references a journey that was never defined' },
    ];
    const r = auditTicketJourney(journeyIds, issues);
    expect(r.orphanJourneys).toEqual([]);
    expect(r.danglingTickets).toEqual([{ number: 13, badIds: ['J-TODO-NOPE'] }]);
    expect(r.pass).toBe(false);
  });
});
