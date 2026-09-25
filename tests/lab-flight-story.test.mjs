import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY, RELEASE, STORY_MU, approachAt, tetherAt, coastAt, storyFrame, distanceFromEarth, captureDetail, electrodynamicDrive } from '../.lab-test/components/flight-story-motion.js';
const near = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const same = (a, b, tol) => { near(a.x, b.x, tol); near(a.y, b.y, tol); };

test('illustrated approach climbs in Earth-centered altitude and matches pickup position and velocity', () => {
  let previous = distanceFromEarth(approachAt(0));
  for (let i = 1; i <= 1000; i++) {
    const p = approachAt(i / 1000), radius = distanceFromEarth(p);
    assert.ok(radius >= previous, 'the approaching payload must never descend');
    assert.ok(p.y <= approachAt((i - 1) / 1000).y, 'climb also reads upward on screen');
    previous = radius;
  }
  same(approachAt(1), tetherAt(0).tip);
  const h = 1e-6, a = approachAt(1 - h), b = approachAt(1);
  same({ x: (b.x - a.x) / (h * STORY.approachDuration), y: (b.y - a.y) / (h * STORY.approachDuration) }, tetherAt(0).velocity, .002);
});

test('capture, swing and release connect without teleporting or changing tether ends', () => {
  for (let stage = 0; stage < 3; stage++) {
    const end = storyFrame(stage, 1), start = storyFrame(stage + 1, 0);
    same(end.hub, start.hub); same(end.tip, start.tip); same(end.payload, start.payload); near(end.angle, start.angle);
  }
  let previous = distanceFromEarth(storyFrame(1, 0).payload);
  for (const stage of [1, 2]) for (let i = 0; i <= 1000; i++) {
    const f = storyFrame(stage, i / 1000), radius = distanceFromEarth(f.payload);
    same(f.payload, f.tip);
    assert.ok(radius >= previous - 1e-8, 'attached payload must rise after pickup');
    previous = radius;
  }
});

test('the entire illustrated tether and attached payload stay above the atmospheric band', () => {
  for (let stage = 0; stage < 5; stage++) for (let i = 0; i <= 200; i++) {
    const f = storyFrame(stage, i / 200);
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      const p = { x: f.tip.x * t + f.otherTip.x * (1 - t), y: f.tip.y * t + f.otherTip.y * (1 - t) };
      assert.ok(distanceFromEarth(p) > STORY.atmosphere + 9, `atmospheric intersection at stage ${stage}`);
    }
  }
});

test('release inherits orbit plus spin velocity and coasts under central gravity', () => {
  const h = 1e-6, before = tetherAt(STORY.releaseTime - h), after = tetherAt(STORY.releaseTime + h);
  const derivative = { x: (after.tip.x - before.tip.x) / (2 * h), y: (after.tip.y - before.tip.y) / (2 * h) };
  same(coastAt(0).position, RELEASE.tip); same(coastAt(0).velocity, derivative, 1e-6);
  same(RELEASE.velocity, { x: RELEASE.hubVelocity.x + RELEASE.spinVelocity.x, y: RELEASE.hubVelocity.y + RELEASE.spinVelocity.y });
  const energy = s => (s.velocity.x ** 2 + s.velocity.y ** 2) / 2 - STORY_MU / distanceFromEarth(s.position);
  const angular = s => (s.position.x - STORY.earth.x) * s.velocity.y - (s.position.y - STORY.earth.y) * s.velocity.x;
  const start = coastAt(0), end = coastAt(1);
  near(energy(start), energy(end), 1e-6); near(angular(start), angular(end), 1e-6);
  assert.ok(end.velocity.y > start.velocity.y, 'gravity bends the coast toward Earth');
  assert.ok(distanceFromEarth(end.position) > distanceFromEarth(start.position));
});

test('recovery raises the schematic orbit and its thrust arrow is tangential', () => {
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const f = storyFrame(4, i / 100), radius = distanceFromEarth(f.hub);
    assert.ok(radius >= previous); previous = radius;
    near((f.hub.x - STORY.earth.x) * f.prograde.x + (f.hub.y - STORY.earth.y) * f.prograde.y, 0);
    assert.equal(f.payload, null);
  }
  near(distanceFromEarth(storyFrame(4, 0).hub), STORY.recoveryOrbit);
  near(distanceFromEarth(storyFrame(4, 1).hub), STORY.orbit);
});

test('controlled tether current gives perpendicular magnetic force with a nonnegative prograde component', () => {
  const prograde = { x: Math.cos(.3), y: Math.sin(.3) };
  const directions = new Set();
  let gated = false;
  for (let i = 0; i <= 720; i++) {
    const angle = i / 720 * 2 * Math.PI;
    const d = electrodynamicDrive(angle, prograde);
    directions.add(d.direction);
    near(d.force.x * -Math.sin(angle) + d.force.y * Math.cos(angle), 0);
    assert.ok(d.force.x * prograde.x + d.force.y * prograde.y >= -1e-10);
    assert.ok(d.strength >= 0 && d.strength <= 1);
    if (d.strength === 0) gated = true;
  }
  assert.equal(directions.size, 2, 'current reverses during rotation');
  assert.ok(gated, 'current switches off near unfavorable alignment');
});

test('capture close-up returns to the wide frame and closes before latching', () => {
  for (const p of [0, 1]) {
    const c = captureDetail(p);
    near(c.scale, 1); near(c.x, 0); near(c.y, 0); near(c.detailOpacity, 0);
  }
  let previousAngle = 36;
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000, c = captureDetail(p), tip = storyFrame(1, p).tip;
    assert.ok(c.scale >= 1 && c.scale <= 6);
    assert.ok(c.jawAngle <= previousAngle + 1e-9);
    if (c.locked) near(c.jawAngle, 0);
    const x = tip.x * c.scale + c.x, y = tip.y * c.scale + c.y;
    assert.ok(x >= Math.min(tip.x, 440) - 1e-8 && x <= Math.max(tip.x, 440) + 1e-8, 'camera tracks without a sideways overshoot');
    assert.ok(y >= Math.min(tip.y, 298) - 1e-8 && y <= Math.max(tip.y, 298) + 1e-8, 'camera tracks without a vertical overshoot');
    previousAngle = c.jawAngle;
  }
  near(captureDetail(.4).scale, 6);
  assert.ok(captureDetail(.4).jawAngle > 0);
  assert.equal(captureDetail(.68).locked, true);
});
