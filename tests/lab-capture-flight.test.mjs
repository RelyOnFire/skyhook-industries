import test from 'node:test';
import assert from 'node:assert/strict';
import {launchTetherAt, launchAircraftAt} from '../.lab-test/campaign/earth-launch-motion.js';
import {passes, encounter, closeJaws, neutral, moveCarriage, separationAcceleration, LIMIT} from '../.lab-test/campaign/capture/pass.js';

test('terminal approach reproduces the radial separation of the Earth launch model within one centimetre at its tabulated times', () => {
  for (const t of [-3, -2, -1, 0, .5]) {
    const exact = 1000 * (launchAircraftAt(t).position.y - launchTetherAt(t).tip.y);
    assert.ok(Math.abs(exact + .5 * separationAcceleration * t*t) < .01);
  }
});

test('each pass can be caught, and position, velocity and timing independently affect capture', () => {
  for (const name of Object.keys(passes)) {
    const c = {...neutral(), x: passes[name].x, z: passes[name].z};
    assert.equal(closeJaws(encounter(name,0,c),0),'secured');
    assert.equal(closeJaws(encounter(name,0,neutral()),0),'offset');
    assert.equal(closeJaws(encounter(name,0,{...c,vx:4}),0),'speed');
    assert.equal(closeJaws(encounter(name,-1,c),-1),'early');
    assert.equal(closeJaws(encounter(name,1,c),1),'late');
  }
});

test('carriage travel is bounded in metres and resultant speed is bounded on diagonals', () => {
  const a = moveCarriage(neutral(),{x:12,z:12},.1);
  assert.ok(Math.abs(Math.hypot(a.vx,a.vz)-LIMIT.slew)<1e-10);
  const b = moveCarriage(a,{x:12,z:12},10);
  assert.equal(b.x,LIMIT.travel); assert.equal(b.z,LIMIT.travel);
  const stopped=moveCarriage(b,{x:12,z:12},.01);
  assert.equal(stopped.vx,0);assert.equal(stopped.vz,0);
});

test('a captured pod rides the modelled tip to release and then separates without a velocity jump', async () => {
  const {rideFrame,RIDE_SWING,RIDE_END}=await import('../.lab-test/campaign/capture/ride.js');
  const c={...neutral(),x:.9,z:-.65},start=rideFrame(0,c),release=rideFrame(RIDE_SWING,c),coast=rideFrame(RIDE_END,c);
  assert.equal(start.altitude,150);
  assert.ok(Math.abs(start.inertialSpeed-4.5)<1e-8);
  assert.deepEqual(start.data.cargo,{x:c.x,y:0,z:c.z});
  assert.equal(start.released,false);assert.equal(release.released,true);
  assert.ok(release.altitude>2000 && release.inertialSpeed>start.inertialSpeed);
  assert.ok(release.data.range<1e-8 && release.data.speed<1e-8);
  assert.ok(coast.data.range>1);
});
