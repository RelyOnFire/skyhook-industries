import assert from 'node:assert/strict';
import test from 'node:test';
import { compile, DEFAULT, LUNAR_DEFAULT } from '../.lab-test/simulation/engine.js';
import { captureScreen, EXAMPLE_CAPTURE } from '../.lab-test/simulation/capture-screen.js';

const near = (a, b) => assert.ok(Math.abs(a-b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

for (const axis of ['along', 'across']) {
  test(`predicted stopping work equals kinetic energy lost after a momentum-conserving ${axis} impulse`, () => {
    const b = compile(DEFAULT, 1000 * DEFAULT.fuelT, false);
    const m = DEFAULT.payloadT * 1000, v = 8;
    const result = captureScreen(DEFAULT, { ...EXAMPLE_CAPTURE, speedMs: v, axis });
    const J = result.effectiveKg * v;
    const payloadFinal = v - J/m, facilityFinal = J/b.mass;
    const arm = axis === 'along' ? 0 : b.half-b.center;
    const angularFinal = arm*J/b.inertia;
    near(payloadFinal, facilityFinal + angularFinal*arm);
    near(m*v, m*payloadFinal + b.mass*facilityFinal);
    near(m*arm*v, m*arm*payloadFinal + b.inertia*angularFinal);
    near(m*v*v/2 - (m*payloadFinal**2 + b.mass*facilityFinal**2 + b.inertia*angularFinal**2)/2, result.energyJ);
    near(result.meanForceN, result.energyJ / EXAMPLE_CAPTURE.strokeM);
    near(result.minStrokeM * EXAMPLE_CAPTURE.forceKN * 1000, result.energyJ);
    near(result.speedLimitMs**2 * result.effectiveKg / 2, result.idealCapacityJ);
  });
}
test('mismatch grows quadratically and the budget changes sign at the ceiling', () => {
  const base = captureScreen(DEFAULT, EXAMPLE_CAPTURE);
  assert.equal(base.exceedsBudget, true);
  near(captureScreen(DEFAULT, {...EXAMPLE_CAPTURE, speedMs:16}).energyJ, 4*base.energyJ);
  assert.equal(captureScreen(DEFAULT, {...EXAMPLE_CAPTURE, speedMs:base.speedLimitMs*0.999}).exceedsBudget, false);
  assert.equal(captureScreen(DEFAULT, {...EXAMPLE_CAPTURE, speedMs:base.speedLimitMs*1.001}).exceedsBudget, true);
  assert.equal(captureScreen(DEFAULT, {...EXAMPLE_CAPTURE, speedMs:0}).energyJ, 0);
  assert.ok(captureScreen(DEFAULT, {...EXAMPLE_CAPTURE, axis:'across'}).energyJ < base.energyJ);
  assert.ok(captureScreen({...DEFAULT,payloadT:6}, EXAMPLE_CAPTURE).energyJ > base.energyJ);
});
test('inapplicable design and incomplete or nonphysical inputs are rejected', () => {
  assert.throws(() => captureScreen(LUNAR_DEFAULT, EXAMPLE_CAPTURE));
  for (const invalid of [{strokeM:0}, {forceKN:0}, {speedMs:-1}, {strokeM:NaN}, {speedMs:Infinity}, {speedMs:1e300}, {axis:'up'}]) {
    assert.throws(() => captureScreen(DEFAULT, {...EXAMPLE_CAPTURE,...invalid}));
  }
});
