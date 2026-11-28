import test from 'node:test';
import assert from 'node:assert/strict';
import {launchTetherAt, launchAircraftAt} from '../.lab-test/campaign/earth-launch-motion.js';
import {EYE,PIN,bearingHeight,fittingClearance,innerRadius,pinTip} from '../.lab-test/visuals/capture-fitting.js';
import {lockDuration,latchPose,passes, encounter, insertionOutcome, neutral, moveCarriage, separationAcceleration, LIMIT} from '../.lab-test/campaign/capture/pass.js';

test('terminal approach reproduces the radial separation of the Earth launch model within one centimetre at its tabulated times', () => {
  for (const t of [-3, -2, -1, 0, .5]) {
    const exact = 1000 * (launchAircraftAt(t).position.y - launchTetherAt(t).tip.y);
    assert.ok(Math.abs(exact + .5 * separationAcceleration * t*t) < .01);
  }
});

test('each pass can be caught, and position, velocity and timing independently affect capture', () => {
  for (const name of Object.keys(passes)) {
    const c = {...neutral(), x: passes[name].x, z: passes[name].z};
    assert.equal(insertionOutcome(encounter(name,0,c)),'secured');
    assert.ok(['fork','offset'].includes(insertionOutcome(encounter(name,0,neutral()))));
    assert.equal(insertionOutcome(encounter(name,0,{...c,vx:4})),'speed');
    assert.equal(insertionOutcome(encounter(name,-1,c)),'early');
    assert.equal(insertionOutcome(encounter(name,1,c)),'late');
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
  assert.deepEqual(start.data.cargo,{x:c.x,y:bearingHeight(0),z:c.z});
  assert.equal(start.released,false);assert.equal(release.released,true);
  assert.ok(release.altitude>2000 && release.inertialSpeed>start.inertialSpeed);
  assert.ok(release.data.range<1e-8 && release.data.speed<1e-8);
  assert.ok(coast.data.range>1);
});

test('the pin must fit through the circular bore and the loop must fit between both cheeks', () => {
  const p=passes.offset, c={...neutral(),x:p.x,z:p.z};
  const at=(dx,dz)=>encounter('offset',-.06,{...c,x:p.x-dx,z:p.z-dz});
  for(const side of [-1,1]){
    assert.equal(insertionOutcome(at(side*.17,0)),'offset'); // passed the old 28 cm gate
    assert.equal(insertionOutcome(at(0,side*.16)),'fork');
  }
  assert.equal(insertionOutcome(at(.06,.06)),'secured');
  // Late in the window several gates can fail. Report the tightest clearance.
  const missedFork=encounter('offset',.04,{...c,z:c.z+.20});
  assert.ok(missedFork.forkMargin<missedFork.boreMargin&&missedFork.boreMargin<0);
  assert.equal(insertionOutcome(missedFork),'fork');
  const offPlane=encounter('drift',-.05,{...neutral(),x:passes.drift.x,z:passes.drift.z-.13});
  assert.ok(offPlane.clearance.fork>PIN.guard&&offPlane.forkMargin<0);
  assert.equal(insertionOutcome(offPlane),'fork');
});

test('an accepted stroke clears the moving eye throughout insertion and finishes in the receiver', () => {
  for(const name of Object.keys(passes)){
    const head={...neutral(),x:passes[name].x+.025,z:passes[name].z-.04};
    const at=-.07;
    assert.equal(insertionOutcome(encounter(name,at,head)),'secured');
    const initial=latchPose(name,at,head,0),end=latchPose(name,at,head,PIN.strokeSeconds);
    assert.ok(pinTip(initial.stroke)<initial.cargo.z-head.z-EYE.tube);
    assert.ok(pinTip(end.stroke)>PIN.forkHalfGap);
    for(let i=0;i<=100;i++){
      const moving=latchPose(name,at,head,PIN.strokeSeconds*i/100),g=fittingClearance(moving.cargo,head);
      assert.ok(g.bore>=PIN.guard&&g.fork>=PIN.guard);
      assert.equal(moving.latched,false);
    }
    const seated=latchPose(name,at,head,lockDuration);
    assert.equal(seated.latched,true);
    assert.equal(seated.cargo.x,end.cargo.x);assert.equal(seated.cargo.z,end.cargo.z);
    assert.ok(Math.abs(Math.hypot(seated.cargo.x-head.x,seated.cargo.y)+PIN.radius-innerRadius)<1e-12);
  }
});

test('the ride keeps the acquired contact offsets and retracts the pin before free flight', async () => {
  const {rideFrame,RIDE_SWING}=await import('../.lab-test/campaign/capture/ride.js');
  const head={...neutral(),x:.96,z:-.60};
  const grip=latchPose('offset',-.05,head,lockDuration).cargo;
  assert.deepEqual(rideFrame(0,head,grip).data.cargo,grip);
  const opening=rideFrame(RIDE_SWING-.5,head,grip),released=rideFrame(RIDE_SWING,head,grip);
  assert.ok(opening.stroke>0&&opening.stroke<1);assert.equal(opening.released,false);
  assert.deepEqual(opening.data.cargo,grip);
  assert.equal(released.released,true);
  assert.ok(Math.abs(pinTip(released.stroke)-(grip.z-head.z-EYE.tube))<1e-12);
  assert.equal(rideFrame(RIDE_SWING+1,head,grip).stroke,0);
});
