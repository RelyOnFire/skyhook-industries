import test from 'node:test';
import assert from 'node:assert/strict';
import {EARTH,MU} from '../.lab-test/simulation/engine.js';
import {CARDIO_REFERENCE_DEFAULT as D,cardioReferenceOrbit,cardioReferenceSample} from '../.lab-test/simulation/cardio-reference.js';
import {traceCardioReferenceRelease as trace} from '../.lab-test/simulation/cardio-reference-release.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b} by more than ${tol}`);

test('reference particle inherits the complete tip state without a release kick',()=>{
  const fraction=.25123456789,r=trace(D,fraction),tip=cardioReferenceSample(D,cardioReferenceOrbit(D).period*fraction).tip;
  assert.deepEqual(r.initial,tip);assert.deepEqual(r.frames[0],{t:0,state:tip});
  assert.deepEqual(r.design,D);assert.equal(r.fraction,fraction);
  assert.ok(Math.hypot(r.frames[1].state[0]-tip[0],r.frames[1].state[1]-tip[1])>0);
});

test('reference phase distinguishes bound, escape and cutoff trajectories',()=>{
  const bound=trace(D,.25),escape=trace(D,.5),cutoff=trace(D,0);
  assert.equal(bound.outcome,'bound');assert.ok(bound.elements.energy<0&&bound.elements.perigee>120000);
  assert.equal(escape.outcome,'escape');assert.ok(escape.elements.energy>0);assert.equal(escape.elements.apogee,null);
  near(escape.elements.perigee,2300000,1e-6);
  assert.equal(cutoff.outcome,'below-cutoff');assert.equal(cutoff.status,'cutoff');assert.equal(cutoff.duration,0);assert.equal(cutoff.frames.length,1);
  assert.deepEqual(trace(D,1).initial,cutoff.initial);
  for(const r of [bound,escape]){assert.equal(r.status,'horizon');assert.equal(r.duration,1800);}
});

test('a descending release stops at the cutoff without tracing through the atmosphere',()=>{
  const r=trace(D,.125);
  assert.equal(r.outcome,'crosses-cutoff');assert.equal(r.status,'cutoff');assert.ok(r.duration>0&&r.duration<1800);
  const altitude=q=>Math.hypot(q[0],q[1])-EARTH;
  near(altitude(r.frames.at(-1).state),120000,1e-4);
  assert.ok(r.frames.every(f=>altitude(f.state)>=120000));
  assert.ok(r.frames.every((f,i)=>i===0||f.t>r.frames[i-1].t));
});

test('an unsafe future perigee stays flagged when the 30-minute trace ends earlier',()=>{
  const r=trace(D,.16);
  assert.equal(r.outcome,'crosses-cutoff');assert.equal(r.status,'horizon');assert.equal(r.duration,1800);
  assert.ok(r.elements.energy<0&&r.elements.perigee<120000);
  assert.ok(r.frames.every(f=>Math.hypot(f.state[0],f.state[1])-EARTH>=120000));
});

test('point coasts conserve Kepler invariants and agree across independent step sizes',()=>{
  for(const fraction of [.125,.25,.5,.875]){
    const coarse=trace(D,fraction,{step:4}),fine=trace(D,fraction,{step:1});
    assert.equal(coarse.status,fine.status);assert.equal(coarse.outcome,fine.outcome);
    near(coarse.duration,fine.duration,1e-5);
    coarse.frames.at(-1).state.forEach((v,i)=>near(v,fine.frames.at(-1).state[i],i<2?.01:.0001));
    assert.ok(coarse.energyError<1e-8&&coarse.angularError<1e-8);
    const initial=fine.initial,h=initial[0]*initial[3]-initial[1]*initial[2];
    for(const {state:q} of fine.frames){
      const energy=(q[2]**2+q[3]**2)/2-MU/Math.hypot(q[0],q[1]);
      near(energy,fine.elements.energy,.01);
      near((q[0]*q[3]-q[1]*q[2])/h,1,1e-10);
    }
  }
});

test('geometry changes affect the actual release state and invalid inputs are rejected',()=>{
  const changed=trace({...D,apogeeKm:2600},.5),original=trace(D,.5);
  assert.notDeepEqual(changed.initial,original.initial);assert.notEqual(changed.elements.energy,original.elements.energy);
  for(const fraction of [-.1,1.1,NaN,Infinity])assert.throws(()=>trace(D,fraction));
  for(const step of [0,.1,11,Infinity,NaN])assert.throws(()=>trace(D,.5,{step}));
  assert.throws(()=>trace({...D,pickupKm:Infinity},.5));
});
