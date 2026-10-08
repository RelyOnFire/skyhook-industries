import test from 'node:test';
import assert from 'node:assert/strict';
import {LAUNCH,earthLaunchFrame,launchTetherAt,launchAircraftAt,launchCargoCoast,launchAltitude,launchSpeed,LAUNCH_RELEASE} from '../.lab-test/campaign/earth-launch-motion.js';
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const same=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};

test('Earth access climbs above the surface, coasts engine-off and matches the moving grapple',()=>{
  let altitude=-Infinity;
  for(let i=0;i<=1000;i++) {
    const f=earthLaunchFrame(0,i/1000);
    assert.ok(f.altitude>=altitude-1e-7,'aircraft ascent must not dip into Earth');altitude=f.altitude;
    assert.ok(f.altitude>0);assert.equal(f.powered,i/1000<.32);
  }
  const aircraft=launchAircraftAt(0),tether=launchTetherAt(0);
  same(aircraft.position,tether.tip);same(aircraft.velocity,tether.velocity);
  near(launchAltitude(aircraft.position),150);near(launchSpeed(aircraft.velocity),4.5);
  assert.ok(launchAltitude(launchAircraftAt(-180).position)<80,'engines turn off before the high-altitude coast');
  const caught=earthLaunchFrame(1,.45);same(caught.payload,caught.tip);assert.equal(caught.latched,true);near(caught.jawAngle,0);
  const lift=earthLaunchFrame(2,.25);
  assert.ok(launchAltitude(lift.payload)>launchAltitude(launchAircraftAt(lift.time).position),'tether lifts cargo clear of the returning aircraft');
});

test('Earth launch phases connect without position, attitude or camera jumps',()=>{
  for(let stage=0;stage<3;stage++) {
    const end=earthLaunchFrame(stage,1),start=earthLaunchFrame(stage+1,0);
    for(const field of ['hub','tip','payload','aircraft'])same(end[field],start[field]);
    same(end.camera.center,start.camera.center);near(end.camera.width,start.camera.width);
    near(end.angle,start.angle);near(end.payloadAngle,start.payloadAngle);
  }
  for(let stage=2;stage<=3;stage++)for(let i=stage===2?30:0;i<=100;i++) {
    const f=earthLaunchFrame(stage,i/100);
    for(const p of [f.tip,f.otherTip,f.payload]) {
      assert.ok(Math.abs(p.x-f.camera.center.x)<f.camera.width/2-40);
      assert.ok(Math.abs(p.y-f.camera.center.y)<f.camera.width*.31-40);
    }
  }
});

test('cargo release inherits tether velocity and free coast conserves energy and angular momentum',()=>{
  const first=launchCargoCoast(0),last=launchCargoCoast(1);
  same(first.position,LAUNCH_RELEASE.tip);same(first.velocity,LAUNCH_RELEASE.velocity);
  const energy=s=>launchSpeed(s.velocity)**2/2-LAUNCH.mu/Math.hypot(s.position.x,s.position.y);
  const angular=s=>s.position.x*s.velocity.y-s.position.y*s.velocity.x;
  near(energy(first),energy(last));near(angular(first),angular(last),1e-6);
  assert.ok(launchSpeed(first.velocity)>LAUNCH.aircraftSpeed);
  assert.ok(launchAltitude(last.position)>launchAltitude(first.position));
});
