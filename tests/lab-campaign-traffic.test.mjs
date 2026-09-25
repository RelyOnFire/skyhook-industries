import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addService,advance,CAMPAIGN_MODEL,dispatch,exportCampaign,flightPlan,importCampaign,launchMirrors,LIMITS,mirrorLaunchPlan,SOLAR,validateCampaign} from '../.lab-test/campaign/model.js';

// Actual completed Ceres playthrough, stranded at the old combined 32-flight limit.
const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json',import.meta.url)));
const resume=()=>validateCampaign(fixture.state);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
function fullCargo() {
  let w=resume();
  while(w.flights.length<LIMITS.cargoFlights)w=dispatch(w,'earth','phobos',1,'tug','equipment');
  return w;
}
function fullMirrors(w=resume()) {
  // Build a valid boundary import; normal tier-3 recovery fills fewer than 128 slots.
  while(w.solar.deployments.length<LIMITS.mirrorDeployments) {
    w.solar.deployments.push({id:w.solar.nextDeployment++,massT:1,departed:w.day,arrival:w.day+SOLAR.deploymentDays});
    w.solar.manufacturedT++;
  }
  return validateCampaign(w);
}

test('traffic: native 0.5.0 migration preserves Ceres and all pending events with empty industrial development',()=>{
  const before=structuredClone(fixture),w=resume();
  assert.equal(fixture.state.flights.length+fixture.state.solar.deployments.length,32);
  assert.deepEqual(w,{...fixture.state,schema:6,model:CAMPAIGN_MODEL,development:{launchLevel:0,waterLevel:0,fuelLevel:0,mercuryTracts:0,ceresTracts:0,fuelReserveT:0}});
  assert.deepEqual(fixture,before);
  assert.deepEqual(importCampaign(JSON.stringify(fixture),'copy'),{...w,id:'copy',revision:0});
  assert.deepEqual(validateCampaign(w),w);
});

test('traffic: a previously full save can dispatch cargo, schedule water returns and launch mirrors immediately',()=>{
  const original=resume();
  let w=dispatch(original,'earth','phobos',1,'tug','equipment');
  w=launchMirrors(w,30);
  w=addService(w,'ceres','phobos',1,'tug','water',90);
  w=advance(w,1);
  assert.equal(w.services.at(-1).dispatched,1);
  assert.ok(w.flights.length+w.solar.deployments.length>32);
  assert.ok(w.solar.nextDeployment>original.solar.nextDeployment+1);
  for(const flight of original.flights)assert.deepEqual(w.flights.find(f=>f.id===flight.id),flight);
  assert.deepEqual(validateCampaign(w),w);
});

test('traffic: full cargo capacity blocks cargo only, allowing manual and automatic mirror launches',()=>{
  let w=fullCargo();
  assert.equal(w.flights.length,LIMITS.cargoFlights);
  assert.match(flightPlan(w,'earth','phobos',1,'tug','equipment').reason,/Cargo traffic is full/);
  assert.throws(()=>dispatch(w,'earth','phobos',1,'tug','equipment'),/Cargo traffic is full/);
  assert.equal(mirrorLaunchPlan(w,30).reason,'');
  w=launchMirrors(w,30);
  const next=w.solar.nextDeployment;
  w=advance(w,1);
  assert.ok(w.solar.nextDeployment>next);
  assert.deepEqual(validateCampaign(w),w);
});

test('traffic: full mirror capacity leaves cargo and recurring services available; blocked launches retry after arrival',()=>{
  let w=fullMirrors();
  assert.match(mirrorLaunchPlan(w,30).reason,/Mirror traffic is full/);
  assert.throws(()=>launchMirrors(w,30),/Mirror traffic is full/);
  assert.equal(flightPlan(w,'earth','phobos',1,'tug','equipment').reason,'');
  w=dispatch(w,'earth','phobos',1,'tug','equipment');
  w=addService(w,'ceres','phobos',1,'tug','water',90);
  const next=w.solar.nextDeployment,firstArrival=Math.min(...w.solar.deployments.map(d=>d.arrival));
  w=advance(w,1);
  assert.equal(w.services.at(-1).dispatched,1);assert.equal(w.solar.nextDeployment,next);
  w=advance(w,firstArrival-w.day+1);
  assert.ok(w.solar.nextDeployment>next);assert.deepEqual(validateCampaign(w),w);
});

test('traffic: both capacity boundaries round-trip below the backup size limit and reject overflowing imports',()=>{
  const w=fullMirrors(fullCargo()),text=exportCampaign(w);
  assert.ok(new TextEncoder().encode(text).length<LIMITS.fileBytes);
  assert.deepEqual(importCampaign(text,'copy'),{...w,id:'copy',revision:0});
  for(const mutate of [
    x=>x.flights.push({...x.flights[0],id:x.nextShipment++}),
    x=>{x.solar.deployments.push({...x.solar.deployments[0],id:x.solar.nextDeployment++});x.solar.manufacturedT+=x.solar.deployments.at(-1).massT;},
    x=>x.model='network-0.5.0',
    x=>x.model='network-0.5.2',
  ]) {
    const bad=structuredClone(w);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
});

test('traffic: larger networks retain deterministic production, one-time arrivals and save/reload continuity',()=>{
  let w=resume();
  for(let i=0;i<48;i++)w=dispatch(w,'earth','phobos',1,'tug','equipment');
  w=addService(w,'ceres','phobos',10,'tug','water',30);
  const together=advance(w,720);let small=w;
  for(let i=0;i<720;i++)small=advance(small,1);
  const restored=advance(importCampaign(exportCampaign(advance(w,303.125)),'resumed'),416.875);
  for(const candidate of [small,restored]) {
    near(candidate.day,together.day);near(candidate.fuelT,together.fuelT);near(candidate.marsOperations,together.marsOperations);
    for(const site of Object.keys(w.ports))for(const key of Object.keys(w.ports[site])) {
      if(typeof w.ports[site][key]==='number')near(candidate.ports[site][key],together.ports[site][key]);
      else assert.equal(candidate.ports[site][key],together.ports[site][key]);
    }
    for(const key of ['mirrorsT','manufacturedT','deployedT','nextLaunchDay'])near(candidate.solar[key],together.solar[key]);
    assert.deepEqual(candidate.solar.deployments,together.solar.deployments);
    assert.deepEqual(candidate.services,together.services);assert.deepEqual(candidate.flights,together.flights);assert.deepEqual(candidate.belt,together.belt);
    assert.deepEqual(validateCampaign(candidate),candidate);
  }
  assert.ok(together.ports.phobos.receivedT>w.ports.phobos.receivedT+48);
  assert.ok(together.belt.refinedT>w.belt.refinedT);
  assert.ok(together.solar.deployedT>w.solar.deployedT);
});
