import test from 'node:test';
import assert from 'node:assert/strict';
import {LUNAR_LAUNCH,LUNAR_RAIL,LUNAR_EXIT,LUNAR_EXIT_TIME,LUNAR_RELEASE,lunarTetherAt,lunarApproachAt,lunarRailAt,lunarCargoCoast,lunarLaunchFrame,lunarAltitude,lunarSpeed} from '../.lab-test/campaign/lunar-launch-motion.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const same=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
test('lunar launcher remains above the surface and its ballistic cargo matches the moving tip',()=>{
 near(lunarAltitude(LUNAR_RAIL.start),LUNAR_LAUNCH.clearance);
 assert.ok(LUNAR_RAIL.length>7&&LUNAR_RAIL.length<9);
 assert.ok(lunarSpeed(LUNAR_EXIT.velocity)<1,'mass driver supplies less speed than lunar escape');
 let previous=-Infinity;
 for(let i=0;i<=1000;i++){
  const s=lunarRailAt(i/1000);assert.ok(lunarAltitude(s.position)>=LUNAR_LAUNCH.clearance-1e-7);
  const coast=lunarApproachAt(LUNAR_EXIT_TIME*(1-i/1000));assert.ok(lunarAltitude(coast.position)>=previous-1e-7);previous=lunarAltitude(coast.position);
 }
 same(lunarRailAt(1).position,LUNAR_EXIT.position);same(lunarRailAt(1).velocity,LUNAR_EXIT.velocity);
 const caught=lunarApproachAt(0),tip=lunarTetherAt(0);same(caught.position,tip.tip);same(caught.velocity,tip.velocity);
 near(lunarAltitude(caught.position),50);near(lunarSpeed(caught.velocity),.9);
 const f=lunarLaunchFrame(3,.55);assert.equal(f.latched,true);near(f.jawAngle,0);
});
test('all six lunar phases have continuous positions and cameras; the wide view contains the rotor and departing cargo',()=>{
 for(let stage=0;stage<5;stage++){
  const end=lunarLaunchFrame(stage,1),start=lunarLaunchFrame(stage+1,0);
  for(const key of ['hub','tip','payload'])same(end[key],start[key]);
  same(end.camera.center,start.camera.center);near(end.camera.width,start.camera.width);
  near(end.angle,start.angle);near(end.payloadAngle,start.payloadAngle);
 }
 for(let stage=4;stage<=5;stage++)for(let i=stage===4?32:0;i<=100;i++){
  const f=lunarLaunchFrame(stage,i/100);
  for(const p of [f.tip,f.otherTip,f.payload]){
   assert.ok(Math.abs(p.x-f.camera.center.x)<f.camera.width/2-20);
   assert.ok(Math.abs(p.y-f.camera.center.y)<f.camera.width*.31-20);
  }
  assert.ok(lunarAltitude(f.tip)>=50-1e-7,'rotor stays clear of the mean surface');
 }
});
test('lunar free-flight conserves energy and angular momentum and release inherits the tip velocity',()=>{
 const energy=s=>lunarSpeed(s.velocity)**2/2-LUNAR_LAUNCH.mu/lunarSpeed(s.position);
 const angular=s=>s.position.x*s.velocity.y-s.position.y*s.velocity.x;
 const start=lunarApproachAt(LUNAR_EXIT_TIME),end=lunarApproachAt(0);
 near(energy(start),energy(end),1e-9);near(angular(start),angular(end),1e-7);
 const first=lunarCargoCoast(0),last=lunarCargoCoast(1);
 same(first.position,LUNAR_RELEASE.tip);same(first.velocity,LUNAR_RELEASE.velocity);
 near(energy(first),energy(last),1e-9);near(angular(first),angular(last),1e-7);
 assert.ok(energy(first)>0,'illustrative release escapes the spherical Moon');
 assert.ok(lunarAltitude(last.position)>lunarAltitude(first.position));
});
