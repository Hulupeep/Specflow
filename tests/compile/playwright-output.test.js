/**
 * Tests for Playwright test stub generation in specflow-compile.
 */

const {
  generatePlaywright,
  groupByJourney,
  parseCsv,
} = require('../../scripts/specflow-compile');

const HEADER = 'journey_id,journey_name,step,user_does,system_shows,critical,owner,notes';

function makeJourney(lines) {
  const rows = parseCsv([HEADER, ...lines].join('\n'));
  const journeys = groupByJourney(rows);
  return journeys.values().next().value;
}

describe('generatePlaywright', () => {
  test('imports Playwright test and expect', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain("import { test, expect } from '@playwright/test'");
  });

  test('wraps tests in test.describe with journey ID and name', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain("test.describe('J-LOGIN: Login'");
  });

  test('generates one test per step', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
      'J-LOGIN,Login,3,Clicks submit,Redirects,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    const testMatches = code.match(/test\('Step \d+:/g);
    expect(testMatches).toHaveLength(3);
  });

  test('step test title includes user_does', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks the login button,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain("test('Step 1: Clicks the login button'");
  });

  test('includes TODO comment in test body', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain('// TODO: Implement');
  });

  test('includes user_does comment in test body', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks the big button,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain('// User does: Clicks the big button');
  });

  test('includes system_shows comment in test body', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows the login form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain('// System shows: Shows the login form');
  });

  test('test functions use async ({ page })', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code).toContain('async ({ page })');
  });

  test('generates valid structure — opens and closes describe block', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    expect(code.trim()).toMatch(/\}\);$/);
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });

  test('step numbers are sequential in output', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Step one,Result one,yes,@alice,',
      'J-LOGIN,Login,2,Step two,Result two,yes,@alice,',
      'J-LOGIN,Login,3,Step three,Result three,yes,@alice,',
    ]);
    const code = generatePlaywright(journey);
    const stepIndices = [];
    const re = /test\('Step (\d+):/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      stepIndices.push(parseInt(m[1], 10));
    }
    expect(stepIndices).toEqual([1, 2, 3]);
  });
});
