/**
 * Tests for validation logic in specflow-compile.
 */

const { parseCsv, validateRows } = require('../../scripts/specflow-compile');

const HEADER = 'journey_id,journey_name,step,user_does,system_shows,critical,owner,notes';

function makeRows(lines) {
  return parseCsv([HEADER, ...lines].join('\n'));
}

describe('validateRows', () => {
  test('passes valid rows', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
    ]);
    expect(() => validateRows(rows)).not.toThrow();
  });

  test('rejects empty rows', () => {
    expect(() => validateRows([])).toThrow('CSV has no data rows');
  });

  test('rejects invalid journey_id format — lowercase', () => {
    const rows = makeRows(['j-login,Login,1,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('must match');
  });

  test('rejects invalid journey_id format — missing J- prefix', () => {
    const rows = makeRows(['LOGIN,Login,1,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('must match');
  });

  test('rejects invalid journey_id format — starts with number after J-', () => {
    const rows = makeRows(['J-1LOGIN,Login,1,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('must match');
  });

  test('accepts journey_id with numbers after first letter', () => {
    const rows = makeRows(['J-AUTH2,Login,1,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).not.toThrow();
  });

  test('rejects empty owner', () => {
    const rows = makeRows(['J-LOGIN,Login,1,Does thing,Shows thing,yes,,']);
    expect(() => validateRows(rows)).toThrow('owner is required');
  });

  test('rejects whitespace-only owner', () => {
    const rows = makeRows(['J-LOGIN,Login,1,Does thing,Shows thing,yes,   ,']);
    expect(() => validateRows(rows)).toThrow('owner is required');
  });

  test('rejects invalid critical value', () => {
    const rows = makeRows(['J-LOGIN,Login,1,Does thing,Shows thing,maybe,@alice,']);
    expect(() => validateRows(rows)).toThrow('critical must be "yes" or "no"');
  });

  test('accepts case-insensitive critical values', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Does thing,Shows thing,YES,@alice,',
      'J-SIGNUP,Signup,1,Does thing,Shows thing,No,@bob,',
    ]);
    expect(() => validateRows(rows)).not.toThrow();
  });

  test('rejects non-integer step', () => {
    const rows = makeRows(['J-LOGIN,Login,abc,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('step must be a positive integer');
  });

  test('rejects step 0', () => {
    const rows = makeRows(['J-LOGIN,Login,0,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('step must be a positive integer');
  });

  test('rejects negative step', () => {
    const rows = makeRows(['J-LOGIN,Login,-1,Does thing,Shows thing,yes,@alice,']);
    expect(() => validateRows(rows)).toThrow('step must be a positive integer');
  });

  test('rejects duplicate (journey_id, step) pairs', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Does thing,Shows thing,yes,@alice,',
      'J-LOGIN,Login,1,Does other,Shows other,yes,@alice,',
    ]);
    expect(() => validateRows(rows)).toThrow('duplicate (journey_id, step) pair');
  });

  test('allows same step number in different journeys', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Does thing,Shows thing,yes,@alice,',
      'J-SIGNUP,Signup,1,Does thing,Shows thing,yes,@bob,',
    ]);
    expect(() => validateRows(rows)).not.toThrow();
  });

  test('rejects non-sequential steps — gap', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Does thing,Shows thing,yes,@alice,',
      'J-LOGIN,Login,3,Does thing,Shows thing,yes,@alice,',
    ]);
    expect(() => validateRows(rows)).toThrow('steps must be sequential');
  });

  test('rejects non-sequential steps — starting at 2', () => {
    const rows = makeRows([
      'J-LOGIN,Login,2,Does thing,Shows thing,yes,@alice,',
    ]);
    expect(() => validateRows(rows)).toThrow('steps must be sequential');
  });

  test('passes multi-journey validation', () => {
    const rows = makeRows([
      'J-LOGIN,Login,1,Does A,Shows A,yes,@alice,',
      'J-LOGIN,Login,2,Does B,Shows B,yes,@alice,',
      'J-SIGNUP,Signup,1,Does C,Shows C,no,@bob,',
      'J-SIGNUP,Signup,2,Does D,Shows D,no,@bob,',
      'J-SIGNUP,Signup,3,Does E,Shows E,no,@bob,',
    ]);
    expect(() => validateRows(rows)).not.toThrow();
  });
});
