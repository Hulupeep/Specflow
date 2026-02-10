/**
 * Tests for YAML output generation in specflow-compile.
 */

const yaml = require('js-yaml');
const {
  generateYaml,
  groupByJourney,
  parseCsv,
  journeyIdToSlug,
} = require('../../scripts/specflow-compile');

const HEADER = 'journey_id,journey_name,step,user_does,system_shows,critical,owner,notes';

function makeJourney(lines) {
  const rows = parseCsv([HEADER, ...lines].join('\n'));
  const journeys = groupByJourney(rows);
  return journeys.values().next().value;
}

describe('journeyIdToSlug', () => {
  test('converts J-SIGNUP-FLOW to signup_flow', () => {
    expect(journeyIdToSlug('J-SIGNUP-FLOW')).toBe('signup_flow');
  });

  test('converts J-LOGIN to login', () => {
    expect(journeyIdToSlug('J-LOGIN')).toBe('login');
  });

  test('converts J-CHECKOUT-FLOW-V2 to checkout_flow_v2', () => {
    expect(journeyIdToSlug('J-CHECKOUT-FLOW-V2')).toBe('checkout_flow_v2');
  });
});

describe('generateYaml', () => {
  test('produces valid YAML', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const yamlStr = generateYaml(journey);
    const parsed = yaml.load(yamlStr);
    expect(parsed).toBeDefined();
    expect(parsed.journey_meta).toBeDefined();
  });

  test('sets journey_meta.id correctly', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.id).toBe('J-LOGIN');
  });

  test('sets dod_criticality to critical when critical=yes', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.dod_criticality).toBe('critical');
  });

  test('sets dod_criticality to important when critical=no', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,no,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.dod_criticality).toBe('important');
  });

  test('sets owner correctly', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.owner).toBe('@alice');
  });

  test('sets status to not_tested', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.status).toBe('not_tested');
  });

  test('sets type to e2e', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.type).toBe('e2e');
  });

  test('generates correct number of steps', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
      'J-LOGIN,Login,3,Clicks submit,Redirects,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.steps).toHaveLength(3);
  });

  test('step numbers are sequential', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.steps[0].step).toBe(1);
    expect(parsed.steps[1].step).toBe(2);
  });

  test('step name comes from user_does', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks the login button,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.steps[0].name).toBe('Clicks the login button');
  });

  test('step expected has description from system_shows', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows the login form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.steps[0].expected[0].description).toBe('Shows the login form');
    expect(parsed.steps[0].expected[0].type).toBe('element_visible');
  });

  test('includes acceptance_criteria from notes', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,Must be fast',
      'J-LOGIN,Login,2,Enters creds,Authenticates,yes,@alice,Session cookie set',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.acceptance_criteria).toEqual([
      'Must be fast',
      'Session cookie set',
    ]);
  });

  test('omits acceptance_criteria when no notes', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const yamlStr = generateYaml(journey);
    expect(yamlStr).not.toContain('acceptance_criteria');
  });

  test('sets correct e2e_test_file in test_hooks', () => {
    const journey = makeJourney([
      'J-SIGNUP-FLOW,Signup,1,Clicks signup,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.test_hooks.e2e_test_file).toBe('tests/e2e/journey_signup_flow.spec.ts');
  });

  test('includes preconditions section', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.preconditions).toBeDefined();
    expect(parsed.preconditions).toHaveLength(1);
  });

  test('sets covers_reqs to empty array', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,Clicks login,Shows form,yes,@alice,',
    ]);
    const parsed = yaml.load(generateYaml(journey));
    expect(parsed.journey_meta.covers_reqs).toEqual([]);
  });

  test('handles special characters in user_does', () => {
    const journey = makeJourney([
      'J-LOGIN,Login,1,"Clicks ""Sign Up"" button",Shows form,yes,@alice,',
    ]);
    const yamlStr = generateYaml(journey);
    const parsed = yaml.load(yamlStr);
    expect(parsed.steps[0].name).toContain('Sign Up');
  });
});
