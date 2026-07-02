#!/usr/bin/env node
/*
 * AC8 proof (issue #102): a runnable journey that FAILS when the app only
 * "looks done". The verifier rail wires this as a runtime check; a failing
 * journey blocks gate advancement — the exact frontier-model trap (plausible
 * UI, dead behavior) that static contract checks miss.
 *
 *   node journey.js                 -> PASS (behavior works)
 *   BEHAVIOR_BUG=1 node journey.js  -> FAIL (space does nothing)
 *
 * The production form is journey.spec.ts (real Playwright against the live app).
 */

function makeApp({ bug }) {
  const state = { x: 0 };
  return {
    render: () => '<canvas id="game"></canvas><button>Play</button>', // renders — looks done
    pressSpace: () => { if (!bug) state.x += 1; },                     // behavior — dead when bug
    x: () => state.x,
  };
}

const app = makeApp({ bug: process.env.BEHAVIOR_BUG === '1' });

// A static/screenshot check would pass here: the UI renders a canvas + Play button.
if (!app.render().includes('<canvas')) {
  console.error('FAIL: no canvas rendered');
  process.exit(1);
}

// The runtime journey — this is what static checks cannot see.
app.pressSpace();
if (app.x() === 0) {
  console.error('FAIL: pressing space did not move the player (dead behavior behind a done-looking UI)');
  process.exit(1);
}

console.log('PASS: space moves the player');
process.exit(0);
