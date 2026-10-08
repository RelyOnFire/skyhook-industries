import test from 'node:test';
import assert from 'node:assert/strict';
import {LUNAR_LAUNCH,LUNAR_MS,LUNAR_RAIL,LUNAR_BRAKE,LUNAR_EXIT,LUNAR_EXIT_TIME,LUNAR_RELEASE,LUNAR_RELEASE_TIME,lunarTetherAt,lunarApproachAt,lunarRailAt,lunarCargoCoast,lunarLaunchFrame,lunarAltitude,lunarSpeed} from '../.lab-test/campaign/lunar-launch-motion.js';
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
  near(end.hardwareScale,start.hardwareScale);
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

test('rail exit keeps a continuous playback clock and the coast never gains inertial speed or a faster projected pace',()=>{
 const epsilon=1e-6,wall=(stage,p0,p1)=>(lunarLaunchFrame(stage,p1).time-lunarLaunchFrame(stage,p0).time)/((p1-p0)*LUNAR_MS[stage]/1000);
 near(wall(1,1-epsilon,1),wall(2,0,epsilon),1e-4);
 near(wall(2,1-epsilon,1),wall(3,0,epsilon),1e-4);
 const exit=lunarLaunchFrame(1,1),maxPace=exit.payloadSpeed*exit.timeScale/exit.camera.width;let speed=exit.payloadSpeed;
 for(let i=0;i<=2000;i++){
  const f=lunarLaunchFrame(2,i/2000);
  assert.ok(f.payloadSpeed<=speed+1e-10,'ascending cargo must lose speed under gravity');speed=f.payloadSpeed;
  assert.ok(f.payloadSpeed*f.timeScale/f.camera.width<=maxPace+1e-8,'time compression must not imply a boost after rail exit');
 }
});

test('capture, swing and release preserve their physical endpoints and keep continuous positive playback velocity',()=>{
 const epsilon=1e-6,boundaries=[[1,1,2,0],[2,1,3,0],[3,.55,3,.55],[3,1,4,0],[4,1,5,0]];
 for(const [leftStage,leftProgress,rightStage,rightProgress] of boundaries){
  const left=lunarLaunchFrame(leftStage,leftProgress),right=lunarLaunchFrame(rightStage,rightProgress);
  const before=lunarLaunchFrame(leftStage,leftProgress-epsilon),after=lunarLaunchFrame(rightStage,rightProgress+epsilon);
  const leftSeconds=epsilon*LUNAR_MS[leftStage]/1000,rightSeconds=epsilon*LUNAR_MS[rightStage]/1000;
  near(left.time,right.time);near(left.timeScale,right.timeScale);
  near((left.time-before.time)/leftSeconds,(after.time-right.time)/rightSeconds,1e-4);
  same(left.payloadVelocity,right.payloadVelocity);
  // The actual rendered positions, not just the time-factor label, must keep
  // their velocity through latching, phase changes and the release itself.
  for(const key of ['hub','tip','payload'])for(const axis of ['x','y']){
   near((left[key][axis]-before[key][axis])/leftSeconds,(after[key][axis]-right[key][axis])/rightSeconds,1e-3);
  }
 }
 near(lunarLaunchFrame(3,0).time,-8);near(lunarLaunchFrame(3,.55).time,0);near(lunarLaunchFrame(3,1).time,12);
 near(lunarLaunchFrame(4,1).time,LUNAR_RELEASE_TIME);near(lunarLaunchFrame(5,1).time,LUNAR_RELEASE_TIME+LUNAR_LAUNCH.coastDuration);
 for(let stage=3;stage<=5;stage++){
  let previous=lunarLaunchFrame(stage,0).time;
  for(let i=1;i<=1000;i++){
   const p=i/1000,f=lunarLaunchFrame(stage,p);assert.ok(f.timeScale>0,'playback must never stop or reverse inside a moving phase');assert.ok(f.time>previous);previous=f.time;
   if(i<1000){const derivative=(lunarLaunchFrame(stage,p+epsilon).time-lunarLaunchFrame(stage,p-epsilon).time)/(2*epsilon*LUNAR_MS[stage]/1000);near(derivative,f.timeScale,1e-5);}
  }
 }
});

test('the reusable sled enters braking at launch speed and stops monotonically inside its runout',()=>{
 const launch=lunarLaunchFrame(1,1),exit=lunarLaunchFrame(2,0),exitSpeed=lunarSpeed(LUNAR_EXIT.velocity);
 near(lunarLaunchFrame(0,1).sledDistance,0);near(lunarLaunchFrame(0,1).sledSpeed,0);
 near(launch.sledDistance,exit.sledDistance);near(launch.sledSpeed,exit.sledSpeed);near(exit.sledSpeed,exitSpeed);
 near(exit.sledDistance,LUNAR_RAIL.length);near(exitSpeed*LUNAR_BRAKE.duration/2,LUNAR_BRAKE.distance);
 const epsilon=1e-6,before=lunarLaunchFrame(1,1-epsilon),after=lunarLaunchFrame(2,epsilon);
 near((launch.sledDistance-before.sledDistance)/(launch.time-before.time),exitSpeed,1e-5);
 near((after.sledDistance-exit.sledDistance)/(after.time-exit.time),exitSpeed,1e-5);
 let previous=exit,brakingSamples=0;
 for(let i=1;i<=3000;i++){
  const frame=lunarLaunchFrame(2,i/3000),dt=frame.time-previous.time;
  assert.ok(frame.sledDistance>=previous.sledDistance-1e-10);assert.ok(frame.sledDistance<=LUNAR_RAIL.length+LUNAR_BRAKE.distance+1e-10);
  assert.ok(frame.sledSpeed>=0&&frame.sledSpeed<=previous.sledSpeed+1e-10);
  if(frame.sledSpeed>0){near((previous.sledSpeed-frame.sledSpeed)/dt,LUNAR_BRAKE.deceleration);near(frame.sledDistance-previous.sledDistance,(previous.sledSpeed+frame.sledSpeed)*dt/2);brakingSamples++;}
  previous=frame;
 }
 assert.ok(brakingSamples>100,'sample the complete initial braking interval before the coast time warp');
 for(let stage=2;stage<=5;stage++){
  const parked=lunarLaunchFrame(stage,1);near(parked.sledSpeed,0);near(parked.sledDistance,LUNAR_RAIL.length+LUNAR_BRAKE.distance);
 }
});

test('actual payload and sled meshes pass through every coil bore with clearance on the launch axis',async()=>{
 const THREE=await import('three');
 const {createLunarLauncher,positionLunarCargo,LUNAR_BORE}=await import('../.lab-test/campaign/LunarLauncher.js');
 const material=new THREE.MeshBasicMaterial(),launcher=createLunarLauncher({metal:material,dark:material,copper:material});
 try{
  let maximum=0;
  for(const coil of launcher.coils){
   const progress=Math.sqrt(coil.position.x/LUNAR_RAIL.length),f=lunarLaunchFrame(1,progress);
   positionLunarCargo(launcher,f,1,progress);launcher.group.updateMatrixWorld(true);launcher.payload.updateMatrixWorld(true);
   for(const body of [launcher.payload,launcher.sled])body.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
     const local=coil.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i)));
     maximum=Math.max(maximum,Math.hypot(local.x,local.y));
    }
   });
   const centre=coil.getWorldPosition(new THREE.Vector3());near(centre.x,f.payload.x);near(centre.y,f.payload.y);
  }
  assert.ok(maximum<LUNAR_BORE.radius-LUNAR_BORE.tube-.07,`cargo/sled radius ${maximum} reaches a coil`);
 }finally{launcher.dispose();material.dispose();}
});
