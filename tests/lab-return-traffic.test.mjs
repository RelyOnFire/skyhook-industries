import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, LUNAR_DEFAULT, simulate, compile, pointState } from '../.lab-test/simulation/engine.js';
import { returnTraffic } from '../.lab-test/simulation/return-traffic.js';
const baseline=simulate(DEFAULT),settings={massT:3,swingDeg:90};
const result=returnTraffic(baseline,settings);
test('matched return gives back energy with conserved energy and angular momentum',()=>{
  assert.equal(result.status,'complete');assert.ok(result.match.matched);
  assert.ok(result.captureTime>90);assert.ok(result.releaseTime>result.captureTime);
  assert.ok(result.releasedOrbit.energy<result.incomingOrbit.energy);
  assert.ok(result.releasedOrbit.perigee>120000);
  assert.ok(result.recoveredFraction>.5&&result.recoveredFraction<.54);
  assert.ok(Math.abs(result.facilityEnergyGainJ-result.payloadEnergyLostJ)<100);
  assert.ok(Math.abs(result.energyResidualJ)<100);assert.ok(Math.abs(result.angularResidual)<1000);
  assert.equal(result.ready,false,'energy return is not complete orbit/spin restoration');
  assert.ok(result.frames.every(f=>f.state[6]===baseline.design.fuelT*1000),'no propellant expenditure');
});
test('return stays on the working tip while attached and does not teleport at release',()=>{
  for(const f of result.frames.filter(f=>f.loaded)) {
    const d={...DEFAULT,payloadT:settings.massT},tip=pointState(f.state,compile(d,f.state[6],true),d.spanKm*500);
    assert.ok(Math.hypot(...tip.map((v,i)=>v-f.payload[i]))<1e-6);
  }
  const pair=result.frames.filter(f=>f.t===result.releaseTime);
  assert.equal(pair.length,2);assert.equal(pair[0].loaded,true);assert.equal(pair[1].loaded,false);
  assert.deepEqual(pair[0].payload,pair[1].payload);
});
test('more exchange can create an unsafe lower orbit and must not count as success',()=>{
  const unsafe=returnTraffic(baseline,{massT:3,swingDeg:120});
  assert.equal(unsafe.status,'unsafe-release');assert.ok(unsafe.recoveredFraction>result.recoveredFraction);
  assert.ok(unsafe.releasedOrbit.perigee<120000);
  const heavy=returnTraffic(baseline,{massT:250,swingDeg:90});assert.equal(heavy.status,'limit');
});
test('return result converges with shorter time steps and preserves the original run',()=>{
  const original=JSON.stringify(baseline),fine=returnTraffic(baseline,settings,{step:1});
  assert.equal(fine.status,result.status);
  assert.ok(Math.abs(fine.recoveredFraction-result.recoveredFraction)<1e-6);
  assert.ok(Math.abs(fine.releasedOrbit.perigee-result.releasedOrbit.perigee)<1);
  assert.equal(JSON.stringify(baseline),original);
});
test('invalid mass, timing, architecture and missing deliveries are rejected',()=>{
  for(const s of [{massT:NaN,swingDeg:90},{massT:0,swingDeg:90},{massT:251,swingDeg:90},{massT:3,swingDeg:151},{massT:3,swingDeg:0}])assert.throws(()=>returnTraffic(baseline,s));
  assert.throws(()=>returnTraffic({...baseline,design:LUNAR_DEFAULT},settings),/Earth/);
  assert.throws(()=>returnTraffic({...baseline,deliveries:[]},settings),/first outbound/);
  assert.throws(()=>returnTraffic(baseline,settings,{step:0}));
});
