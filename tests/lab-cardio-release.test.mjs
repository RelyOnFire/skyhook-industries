import test from 'node:test';
import assert from 'node:assert/strict';
import {EARTH,MU,orbit} from '../.lab-test/simulation/engine.js';
import {CARDIO_DEFAULT as D,cardioBody,cardioPoint,cardioInvariants,cardioStep} from '../.lab-test/simulation/cardio.js';
import {CARDIO_RELEASE_MODEL,simulateCardioRelease,cardioReleaseSample,cardioCargoStep,cardioCargoCrossesCutoff} from '../.lab-test/simulation/cardio-release.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
const safeDesign={...D,spinRatio:2.75},safe=simulateCardioRelease(safeDesign,.25),unsafe=simulateCardioRelease(D,.25);

test('release preserves every tether material point and cargo velocity, with no invented impulse or energy',()=>{
 const r=safe.release;assert.ok(r);near(r.t,safe.period*.25,1e-8);
 const loaded=cardioBody(safeDesign,true),empty=cardioBody(safeDesign,false);
 for(const s of [0,empty.length/2,empty.length])cardioPoint(r.before,loaded,s).forEach((v,i)=>near(v,cardioPoint(r.after,empty,s)[i],1e-8));
 assert.deepEqual(r.cargo,cardioPoint(r.before,loaded,loaded.length));
 near(loaded.mass,empty.mass+safeDesign.payloadT*1000,1e-7);
 const iv=cardioInvariants(r.before,loaded);assert.ok(Math.abs(r.energyResidual/iv.energy)<1e-12);assert.ok(Math.abs(r.angularResidual/iv.angular)<1e-12);
});
test('cargo and unloaded tether coast separately with conserved total energy and angular momentum',()=>{
 assert.equal(safe.status,'complete');assert.ok(safe.release.cargoOrbit.perigee>120000);
 assert.ok(safe.energyDrift<1e-8);assert.ok(safe.angularDrift<1e-8);
 const final=safe.frames.at(-1),tip=cardioPoint(final.state,cardioBody(safeDesign,false),safeDesign.lengthKm*1000);
 assert.ok(Math.hypot(final.cargo[0]-tip[0],final.cargo[1]-tip[1])>100000);
 const fine=simulateCardioRelease(safeDesign,.25,{step:2.5}),dense=simulateCardioRelease(safeDesign,.25,{cells:96});
 for(const r of [fine,dense]){assert.equal(r.status,safe.status);r.frames.at(-1).state.forEach((v,i)=>near(v,final.state[i],i<2?2:i<4?.01:1e-5));r.frames.at(-1).cargo.forEach((v,i)=>near(v,final.cargo[i],i<2?5:.01));}
});
test('unsafe cargo stops at the atmosphere boundary; an unsafe future perigee stays visible even before reaching it',()=>{
 assert.equal(unsafe.status,'cargo-clearance');near(unsafe.minCargoClearance,120000,.01);assert.ok(unsafe.release.cargoOrbit.perigee<0);
 const late=simulateCardioRelease(D,.9);assert.equal(late.status,'complete');assert.ok(late.release.cargoOrbit.perigee<120000,'completion cannot be equated with safe delivery');
 const earlier=simulateCardioRelease(safeDesign,.5);assert.notEqual(earlier.release.cargoOrbit.perigee,safe.release.cargoOrbit.perigee);
});
test('future cargo cutoff distinguishes returning bound orbits and inbound escape from outbound escape',()=>{
 const radius=EARTH+1000000;
 for(const radial of [-1000,1000]){
  const bound=[radius,0,radial,1000],elements=orbit(bound);
  assert.ok(elements.energy<0&&elements.perigee<120000);
  assert.equal(cardioCargoCrossesCutoff(bound),true,'bound cargo returns to its low perigee');
 }
 const inbound=[radius,0,-12000,1000],outbound=[radius,0,12000,1000];
 assert.ok(orbit(inbound).energy>0&&orbit(inbound).perigee<120000);
 assert.deepEqual(orbit(inbound),orbit(outbound));
 assert.equal(cardioCargoCrossesCutoff(inbound),true);
 assert.equal(cardioCargoCrossesCutoff(outbound),false,'outbound unbound perigee is in the past');
 assert.equal(cardioCargoCrossesCutoff(outbound,orbit(outbound)),false);
 const high=[radius,0,-1000,12000];assert.ok(orbit(high).perigee>120000);
 assert.equal(cardioCargoCrossesCutoff(high),false,'inbound escape above the cutoff is clear');
 assert.equal(cardioCargoCrossesCutoff([EARTH+100000,0,12000,1000]),true,'an existing cutoff violation remains unsafe');
 assert.equal(CARDIO_RELEASE_MODEL,'C1r-0.1.1');
});
test('pre-release limit stops do not invent a release state or continue an unsafe tether',()=>{
 const r=simulateCardioRelease({...D,lengthKm:2200,perigeeKm:700,apogeeKm:2400},.25);
 assert.equal(r.status,'load');assert.equal(r.release,null);assert.equal(r.duration,0);assert.equal(r.minCargoClearance,null);assert.equal(r.frames[0].cargo,null);
 const compressed=simulateCardioRelease({...D,spinRatio:2.5},.5);assert.equal(compressed.status,'compression');assert.equal(compressed.release,null);
});
test('replay is right-continuous at separation and interpolates each side without a false cargo or COM jump',()=>{
 const r=safe.release,at=cardioReleaseSample(safe,r.t);assert.deepEqual(at.state,r.after);assert.deepEqual(at.cargo,r.cargo);assert.equal(at.released,true);
 const before=cardioReleaseSample(safe,r.t-.001);assert.equal(before.released,false);assert.equal(before.cargo,null);
 const b=cardioBody(safeDesign,true),e=cardioBody(safeDesign,false);
 const beforeTip=cardioPoint(before.state,b,b.length),afterTip=cardioPoint(at.state,e,e.length);assert.ok(Math.hypot(beforeTip[0]-afterTip[0],beforeTip[1]-afterTip[1])<20);
 const after=cardioReleaseSample(safe,r.t+1),expected=cardioStep(r.after,1,e),cargo=cardioCargoStep(r.cargo,1);
 after.state.forEach((v,i)=>near(v,expected[i],i<2?100:i<4?.1:.0001));after.cargo.forEach((v,i)=>near(v,cargo[i],i<2?100:.1));
});
test('free cargo follows an independent circular-orbit solution and invalid timing is rejected',()=>{
 const radius=EARTH+1000000,velocity=Math.sqrt(MU/radius),period=2*Math.PI*radius/velocity;
 let q=[radius,0,0,velocity];for(let i=0;i<2000;i++)q=cardioCargoStep(q,period/2000);
 near(q[0],radius,.02);near(q[1],0,.02);near(q[2],0,.0001);near(q[3],velocity,.0001);
 for(const fraction of [NaN,Infinity,0,1,-.1])assert.throws(()=>simulateCardioRelease(D,fraction));
 for(const options of [{step:0},{cells:1},{step:Infinity}])assert.throws(()=>simulateCardioRelease(D,.25,options));
 assert.equal(D.spinRatio,2,'original design unchanged');
});
