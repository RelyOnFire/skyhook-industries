import test from 'node:test';
import assert from 'node:assert/strict';
import {EARTH,MU} from '../.lab-test/simulation/engine.js';
import {CARDIO_REFERENCE_DEFAULT as D,validateCardioReference,cardioReferenceOrbit,
  cardioReferenceSample,cardioReferenceSummary} from '../.lab-test/simulation/cardio-reference.js';

const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);

test('Cardio geometry reaches inward from apogee and points outward at perigee',()=>{
  const {period,length}=cardioReferenceOrbit(D);
  const apogee=cardioReferenceSample(D,0),perigee=cardioReferenceSample(D,period/2);
  near(apogee.station[0],EARTH+D.apogeeKm*1000,1e-7);
  near(apogee.tip[0],EARTH+D.pickupKm*1000,1e-7);
  near(apogee.station[1],0,1e-7);near(apogee.tip[1],0,1e-7);
  assert.ok(apogee.station[3]>0);assert.ok(apogee.tip[3]<apogee.station[3]);
  near(perigee.station[0],-(EARTH+D.perigeeKm*1000),1e-7);
  near(perigee.tip[0],perigee.station[0]-length,1e-7);
  near(perigee.tip[1],0,1e-7);
  assert.ok(perigee.tip[3]<perigee.station[3]);
});

test('two inertial turns close one station orbit, with dependent arm length and rotation period',()=>{
  for(const design of [D,{perigeeKm:500,apogeeKm:1500,pickupKm:100}]) {
    const orbit=cardioReferenceOrbit(design),a=cardioReferenceSample(design,0),b=cardioReferenceSample(design,orbit.period);
    near(orbit.length,(design.apogeeKm-design.pickupKm)*1000,1e-9);
    near(orbit.period,2*Math.PI*Math.sqrt(orbit.semiMajor**3/MU),1e-9);
    near(2*Math.PI/a.spinRate,orbit.period/2,1e-9);
    near(b.angle-a.angle,4*Math.PI,1e-12);
    a.station.forEach((value,i)=>near(value,b.station[i],1e-7));
    a.tip.forEach((value,i)=>near(value,b.tip[i],1e-7));
    near(Math.hypot(a.tip[2]-a.station[2],a.tip[3]-a.station[3]),4*Math.PI*orbit.length/orbit.period,1e-9);
  }
});

test('analytic station and tip velocities agree with independent centered position differences',()=>{
  const {period}=cardioReferenceOrbit(D),h=.01;
  for(const fraction of [0,.03,.17,.25,.5,.79,.97,1]) {
    const t=period*fraction,at=cardioReferenceSample(D,t);
    const before=cardioReferenceSample(D,t-h),after=cardioReferenceSample(D,t+h);
    for(const point of ['station','tip'])for(let axis=0;axis<2;axis++)
      near(at[point][axis+2],(after[point][axis]-before[point][axis])/(2*h),.00002);
  }
});

test('the default lowest pass is near apogee pickup and all-arm clearance includes the station',()=>{
  const summary=cardioReferenceSummary(D);
  near(summary.minTipAltitude,D.pickupKm*1000,1e-7);
  near(summary.minClearance,D.pickupKm*1000,1e-7);
  near(summary.minClearanceTime,0,1e-9);
  near(summary.perigeeTipAltitude,(D.perigeeKm+D.apogeeKm-D.pickupKm)*1000,1e-7);
  assert.equal(summary.sampleCount,4097);
  const short={perigeeKm:150,apogeeKm:500,pickupKm:400},other=cardioReferenceSummary(short);
  near(other.minClearance,150000,1e-7);
  assert.ok(other.minClearance<other.minTipAltitude);
  near(other.minClearanceTime,other.period/2,1e-7);
});

test('station motion follows the Kepler ellipse with conserved specific energy and angular momentum',()=>{
  const {period,semiMajor}=cardioReferenceOrbit(D),first=cardioReferenceSample(D,0).station;
  const angular=first[0]*first[3]-first[1]*first[2];
  for(let i=0;i<=40;i++) {
    const {station:s,meanAnomaly:M,eccentricAnomaly:E}=cardioReferenceSample(D,period*i/40);
    const {eccentricity:e}=cardioReferenceOrbit(D);
    near(E-e*Math.sin(E),M,2e-14);
    near((s[2]**2+s[3]**2)/2-MU/Math.hypot(s[0],s[1]),-MU/(2*semiMajor),1e-7);
    near((s[0]*s[3]-s[1]*s[2])/angular,1,1e-14);
  }
});

test('reference inputs reject nonfinite and impossible geometries without accepting mass or spin as controls',()=>{
  for(const bad of [null,[],{}, {...D,perigeeKm:NaN},{...D,apogeeKm:Infinity},
    {...D,pickupKm:0},{...D,perigeeKm:1500,apogeeKm:1000},{...D,apogeeKm:500,pickupKm:500}])
    assert.throws(()=>validateCardioReference(bad));
  assert.deepEqual(validateCardioReference({...D,spinRatio:1,lengthKm:100,payloadT:500}),D);
  for(const invalid of [NaN,Infinity,-Infinity])assert.throws(()=>cardioReferenceSample(D,invalid));
  for(const invalid of [0,127,32769,1.5,NaN])assert.throws(()=>cardioReferenceSummary(D,invalid));
});
