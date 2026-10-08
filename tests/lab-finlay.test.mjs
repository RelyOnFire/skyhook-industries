import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINLAY_DEFAULTS, FINLAY_ASSUMPTIONS, FINLAY_ORBIT, FINLAY_NODES,
  estimateFinlay, finlayOrbitPoint,
} from '../.lab-test/missions/finlay-model.js';

const near = (actual, expected, relative = 1e-11) => assert.ok(
  Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)),
  `${actual} != ${expected}`,
);
const length = a => Math.hypot(a.x, a.y, a.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const subtract = (a, b) => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});

test('Finlay water propulsion conserves mass and meets the requested ideal rocket delta-v', () => {
  const result = estimateFinlay(FINLAY_DEFAULTS);
  assert.equal(result.feasible, true);
  near(result.massKg, 4 * Math.PI / 3 * 900 ** 3 * 500);
  near(result.consumedWaterKg + result.finalMassKg, result.massKg);
  near(result.consumedWaterKg + result.remainingWaterKg, result.availableWaterKg);
  near(FINLAY_DEFAULTS.exhaustKmS * Math.log(result.massKg / result.finalMassKg), 1);
  assert.equal(result.waterShortfallKg, 0);
  near(result.massFlowKgS * result.operatingSeconds, result.requiredPropellantKg);
  near(result.elapsedYears * FINLAY_ASSUMPTIONS.secondsPerYear * FINLAY_ASSUMPTIONS.dutyCycle, result.operatingSeconds);
  near(result.extractionPowerW + result.propulsionInputPowerW, FINLAY_DEFAULTS.powerGW * 1e9);
  near(result.jetPowerW, result.propulsionInputPowerW * FINLAY_ASSUMPTIONS.jetEfficiency);
  near(result.thrustN, result.massFlowKgS * result.exhaustMS);
  near(result.extractionPowerFraction + result.jetPowerFraction, 1);
});

test('zero delta-v consumes no water or operating time, including a dry target', () => {
  for (const waterFraction of [0, .5, .9]) {
    const result = estimateFinlay({...FINLAY_DEFAULTS, deltaVKmS: 0, waterFraction});
    assert.equal(result.feasible, true);
    assert.equal(Math.abs(result.requiredPropellantKg), 0);
    assert.equal(Math.abs(result.consumedWaterKg), 0);
    assert.equal(Math.abs(result.operatingSeconds), 0);
    assert.equal(Math.abs(result.elapsedYears), 0);
    near(result.remainingWaterKg, result.availableWaterKg);
    near(result.finalMassKg, result.massKg);
  }
});

test('doubling usable plant power doubles thrust and halves duration without inventing water', () => {
  const first = estimateFinlay(FINLAY_DEFAULTS);
  const second = estimateFinlay({...FINLAY_DEFAULTS, powerGW: FINLAY_DEFAULTS.powerGW * 2});
  near(second.thrustN, 2 * first.thrustN);
  near(second.massFlowKgS, 2 * first.massFlowKgS);
  near(second.operatingSeconds, first.operatingSeconds / 2);
  near(second.elapsedYears, first.elapsedYears / 2);
  near(second.requiredPropellantKg, first.requiredPropellantKg);
  near(second.remainingWaterKg, first.remainingWaterKg);
});

test('higher exhaust velocity saves propellant but pays its greater specific energy cost', () => {
  const first = estimateFinlay(FINLAY_DEFAULTS);
  const second = estimateFinlay({...FINLAY_DEFAULTS, exhaustKmS: 6});
  assert.ok(second.requiredPropellantKg < first.requiredPropellantKg);
  assert.ok(second.massFlowKgS < first.massFlowKgS);
  assert.ok(second.operatingSeconds > first.operatingSeconds);
  assert.ok(second.thrustN < first.thrustN);
  assert.ok(second.extractionPowerFraction < first.extractionPowerFraction);
  const energy = second.massFlowKgS * (3e6 + 6000 ** 2 / 2 / .6);
  near(energy, FINLAY_DEFAULTS.powerGW * 1e9);
});

test('insufficient water reports the shortfall and suppresses requested-mission timing', () => {
  for (const waterFraction of [0, .01, .5]) {
    const result = estimateFinlay({...FINLAY_DEFAULTS, deltaVKmS: 5, waterFraction});
    assert.equal(result.feasible, false);
    assert.equal(result.operatingSeconds, null);
    assert.equal(result.elapsedYears, null);
    assert.equal(result.remainingWaterKg, 0);
    near(result.consumedWaterKg, result.availableWaterKg);
    near(result.waterShortfallKg + result.availableWaterKg, result.requiredPropellantKg);
    near(result.finalMassKg, result.massKg - result.availableWaterKg);
    assert.ok(result.finalMassKg > 0);
    near(result.maxDeltaVKmS, 3 * Math.log(result.massKg / result.finalMassKg));
  }
  const result = estimateFinlay(FINLAY_DEFAULTS);
  const boundary = estimateFinlay({...FINLAY_DEFAULTS, deltaVKmS: result.maxDeltaVKmS});
  assert.equal(boundary.feasible, true);
  near(boundary.remainingWaterKg, 0, 1e-3);
  near(boundary.consumedWaterKg, boundary.availableWaterKg);
});

test('ecliptic node plane changes rotate transverse velocity and preserve radial velocity', () => {
  assert.ok(FINLAY_NODES.near.radiusAU < FINLAY_NODES.far.radiusAU);
  for (const node of Object.values(FINLAY_NODES)) {
    const {positionAU: r, velocityKmS: v, coplanarVelocityKmS: flat} = node;
    near(r.z, 0);
    const rhat = {x: r.x / length(r), y: r.y / length(r), z: 0};
    const radial = dot(v, rhat);
    const transverse = length(subtract(v, {x: rhat.x * radial, y: rhat.y * radial, z: 0}));
    // Independent target vector: preserve the radial component and rotate only
    // the prograde transverse component into the ecliptic plane at the node.
    const expected = {
      x: radial * rhat.x - transverse * rhat.y,
      y: radial * rhat.y + transverse * rhat.x,
      z: 0,
    };
    for (const key of ['x', 'y', 'z']) near(flat[key], expected[key]);
    near(dot(flat, rhat), radial);
    near(radial, node.radialKmS);
    near(transverse, node.transverseKmS);
    near(length(v), node.speedKmS);
    near(length(flat), length(v));
    near(length(subtract(v, expected)), node.planeChangeKmS);
    near(Math.acos(dot(v, {x: -rhat.y, y: rhat.x, z: 0}) / transverse), FINLAY_ORBIT.inclinationDeg * Math.PI / 180);
    assert.ok(node.planeChangeKmS < 2 * node.speedKmS * Math.sin(FINLAY_ORBIT.inclinationDeg * Math.PI / 360), 'using total orbital speed would wrongly rotate radial motion');
  }
  assert.ok(FINLAY_NODES.near.velocityKmS.z > 0);
  assert.ok(FINLAY_NODES.far.velocityKmS.z < 0);
  assert.ok(Math.abs(FINLAY_NODES.near.radiusAU - FINLAY_ORBIT.perihelionAU) > .001);
  assert.ok(Math.abs(FINLAY_NODES.far.radiusAU - FINLAY_ORBIT.aphelionAU) > .1);
});

test('the frozen orbital sketch has the recorded apsides, inclination and source epoch', () => {
  near(finlayOrbitPoint(0).radiusAU, FINLAY_ORBIT.perihelionAU);
  near(finlayOrbitPoint(Math.PI).radiusAU, FINLAY_ORBIT.aphelionAU);
  for (let index = 0; index <= 100; index++) {
    const f = index / 100 * Math.PI * 2, point = finlayOrbitPoint(f);
    near(length(point), point.radiusAU);
    near(point.z / point.radiusAU, Math.sin(f + FINLAY_ORBIT.argumentPerihelionDeg * Math.PI / 180) * Math.sin(FINLAY_ORBIT.inclinationDeg * Math.PI / 180));
  }
  assert.equal(FINLAY_ORBIT.epochJD, 2457327.5);
  assert.equal(FINLAY_ORBIT.solutionId, 'K213/18');
});

test('invalid or non-finite workbench inputs are rejected before producing a result', () => {
  for (const key of Object.keys(FINLAY_DEFAULTS)) {
    for (const value of [NaN, Infinity, -Infinity, undefined, '1', -1]) {
      assert.throws(() => estimateFinlay({...FINLAY_DEFAULTS, [key]: value}), RangeError);
    }
  }
  for (const inputs of [null, undefined, {}, {...FINLAY_DEFAULTS, waterFraction: 1}, {...FINLAY_DEFAULTS, powerGW: 0}, {...FINLAY_DEFAULTS, exhaustKmS: 0}, {...FINLAY_DEFAULTS, radiusKm: 100}]) {
    assert.throws(() => estimateFinlay(inputs), RangeError);
  }
  assert.throws(() => finlayOrbitPoint(NaN), RangeError);
});
