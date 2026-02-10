/**
 * Tests for CSV parsing and row grouping in specflow-compile.
 */

const { parseCsv, groupByJourney } = require('../../scripts/specflow-compile');

const HEADER = 'journey_id,journey_name,step,user_does,system_shows,critical,owner,notes';

describe('parseCsv', () => {
  test('parses a simple CSV with one row', () => {
    const csv = `${HEADER}\nJ-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].journey_id).toBe('J-LOGIN');
    expect(rows[0].journey_name).toBe('Login');
    expect(rows[0].step).toBe('1');
    expect(rows[0].user_does).toBe('Clicks login');
    expect(rows[0].system_shows).toBe('Shows form');
    expect(rows[0].critical).toBe('yes');
    expect(rows[0].owner).toBe('@alice');
    expect(rows[0].notes).toBe('');
  });

  test('parses multiple rows', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
      'J-SIGNUP,Signup,1,Clicks signup,Shows signup form,no,@bob,',
    ].join('\n');
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
  });

  test('handles quoted fields with commas', () => {
    const csv = `${HEADER}\nJ-TEST,Test,1,"Clicks ""big, red"" button",Shows modal,yes,@alice,`;
    const rows = parseCsv(csv);
    expect(rows[0].user_does).toBe('Clicks "big, red" button');
  });

  test('handles notes field with content', () => {
    const csv = `${HEADER}\nJ-TEST,Test,1,Does something,Shows result,yes,@alice,Must send email`;
    const rows = parseCsv(csv);
    expect(rows[0].notes).toBe('Must send email');
  });

  test('skips empty lines', () => {
    const csv = `${HEADER}\n\nJ-TEST,Test,1,Does something,Shows result,yes,@alice,\n\n`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  test('handles Windows line endings', () => {
    const csv = `${HEADER}\r\nJ-TEST,Test,1,Does something,Shows result,yes,@alice,\r\n`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  test('throws on empty CSV', () => {
    expect(() => parseCsv('')).toThrow('CSV file is empty');
  });

  test('throws on missing required header', () => {
    const csv = 'journey_id,journey_name,step\nJ-TEST,Test,1';
    expect(() => parseCsv(csv)).toThrow('Missing required CSV header: "user_does"');
  });
});

describe('groupByJourney', () => {
  test('groups rows by journey_id', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
      'J-SIGNUP,Signup,1,Clicks signup,Shows form,no,@bob,',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);

    expect(journeys.size).toBe(2);
    expect(journeys.has('J-LOGIN')).toBe(true);
    expect(journeys.has('J-SIGNUP')).toBe(true);
    expect(journeys.get('J-LOGIN').steps).toHaveLength(2);
    expect(journeys.get('J-SIGNUP').steps).toHaveLength(1);
  });

  test('sets criticality from CSV', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-SIGNUP,Signup,1,Clicks signup,Shows form,no,@bob,',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);

    expect(journeys.get('J-LOGIN').critical).toBe(true);
    expect(journeys.get('J-SIGNUP').critical).toBe(false);
  });

  test('collects notes as acceptance_criteria', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,Must be fast',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,Session cookie set',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);

    expect(journeys.get('J-LOGIN').acceptance_criteria).toEqual([
      'Must be fast',
      'Session cookie set',
    ]);
  });

  test('skips empty notes', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,Has a note',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);

    expect(journeys.get('J-LOGIN').acceptance_criteria).toEqual(['Has a note']);
  });

  test('preserves owner from first row of journey', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);

    expect(journeys.get('J-LOGIN').owner).toBe('@alice');
  });

  test('sorts steps by step number', () => {
    const csv = [
      HEADER,
      'J-LOGIN,Login,3,Clicks submit,Redirects,yes,@alice,',
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
    ].join('\n');
    const rows = parseCsv(csv);
    const journeys = groupByJourney(rows);
    const steps = journeys.get('J-LOGIN').steps;

    expect(steps[0].step).toBe(1);
    expect(steps[1].step).toBe(2);
    expect(steps[2].step).toBe(3);
  });
});
