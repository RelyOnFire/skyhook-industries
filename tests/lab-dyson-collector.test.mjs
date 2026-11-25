import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTOR_DEFAULTS, screenCollector } from '../.lab-test/simulation/dyson-collector.js';

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('a face-on collector at one AU receives nominal sunlight and accounts for every watt', () => {
  const result = screenCollector({ ...COLLECTOR_DEFAULTS, radiusAU: 1 });
  assert.equal(result.solarWm2, 1361);
  assert.equal(result.dcWm2, 340.25);
  assert.equal(result.tiltDeg, 0);
  assert.equal(result.thermalLimited, false);
  near(result.dcWm2 + result.heatWm2, .85 * 1361);
  near(result.panelAreaM2 * result.dcWm2, 1e6);
});

test('near the Sun the operating temperature caps output even as available sunlight rises', () => {
  const result = screenCollector(COLLECTOR_DEFAULTS);
  assert.equal(result.thermalLimited, true);
  assert.equal(result.wholeSunInFront, true);
  near(result.solarWm2, 8506.25);
  near(result.faceOnC, 213.861726);
  near(result.tiltDeg, 69.839673);
  near(result.heatWm2, 1758.998638);
  near(result.crossoverAU, .681352629);
  const inward = screenCollector({ ...COLLECTOR_DEFAULTS, radiusAU: .2 });
  near(inward.dcWm2, result.dcWm2);
  near(inward.solarWm2, 4 * result.solarWm2);
  assert.ok(inward.tiltDeg > result.tiltDeg);
  near(result.panelMassKg, result.panelAreaM2 * 3);
});

test('warns when the required tilt would illuminate the back of the panel', () => {
  const result = screenCollector({ ...COLLECTOR_DEFAULTS, radiusAU: .2, limitC: 0, emissivityPct: 1, absorptancePct: 100, efficiencyPct: 1 });
  assert.equal(result.wholeSunInFront, false);
});

test('checks optical consistency and bounded, finite physical inputs', () => {
  for (const patch of [{ efficiencyPct: 40, absorptancePct: 39 }, { radiusAU: 0 }, { limitC: NaN }, { emissivityPct: 0 }]) {
    assert.throws(() => screenCollector({ ...COLLECTOR_DEFAULTS, ...patch }), RangeError);
  }
});
