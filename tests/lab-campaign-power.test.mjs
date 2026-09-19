import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advance,automaticMirrorPlan,build,connectSwarmPower,createCampaign,dispatch,exportCampaign,importCampaign,launchMirrors,LIMITS,mercuryProduction,mirrorLaunchPlan,POWER,powerLinkReason,powerObjectives,SOLAR,swarmPower,toggleMirrorLaunches,toggleService,validateCampaign} from '../.lab-test/campaign/model.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v3.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≠ '+b);
const established=()=>importCampaign(JSON.stringify(fixture),'power-test');
function linked() {return connectSwarmPower(established());}
function expanded() {let w=linked();w=build(w,'mercury');return build(w,'mercury');}

test('power: a real v3 world preserves every balance, facility, schedule, clock and deployment',()=>{
  const old=fixture.state,before=structuredClone(fixture),w=validateCampaign(old);
  for(const k of Object.keys(old).filter(k=>!['schema','model','solar','ports'].includes(k)))assert.deepEqual(w[k],old[k],k);
  for(const site of Object.keys(old.ports))assert.deepEqual(w.ports[site],{...old.ports[site],waterT:0});
  for(const k of Object.keys(old.solar))assert.deepEqual(w.solar[k],old.solar[k],k);
  assert.equal(w.schema,5);assert.equal(w.solar.powerLink,false);
  assert.equal(swarmPower(w).multiplier,1);assert.equal(swarmPower(w).returnedGW,0);
  assert.equal(mercuryProduction(w).mineCapacity,2);assert.equal(mercuryProduction(w).mirrorCapacity,1);
  assert.deepEqual(automaticMirrorPlan(w),{massT:10,intervalDays:10});
  assert.deepEqual(validateCampaign(w),w);assert.deepEqual(fixture,before);
  const exported=JSON.parse(exportCampaign(w));assert.equal(exported.version,5);
  assert.deepEqual(importCampaign(JSON.stringify(exported),'copy').solar,w.solar);
  // Old envelopes cannot smuggle activation into a migration.
  const altered=structuredClone(old);altered.solar.powerLink=true;
  assert.equal(validateCampaign(altered).solar.powerLink,false);
});

test('power: intercepted sunlight uses area and inverse square distance; return is opt-in',()=>{
  const w=established();w.solar.deployedT=100;
  const offline=swarmPower(w);near(offline.areaKm2,10);near(offline.sunlightGW,54.44);
  assert.equal(offline.returnedGW,0);assert.equal(offline.multiplier,1);
  w.solar.powerLink=true;const power=swarmPower(w);
  near(power.returnedGW,10.888);near(power.multiplier,1.5444);
  w.solar.deployedT=200;near(swarmPower(w).returnedGW,power.returnedGW*2);
});

test('power: connecting costs only local stock once and does not rewrite pending events',()=>{
  const start=established(),before=structuredClone(start),w=connectSwarmPower(start);
  near(w.ports.mercury.materialsT,start.ports.mercury.materialsT-POWER.linkMaterialsT);
  near(w.ports.mercury.equipmentT,start.ports.mercury.equipmentT-POWER.linkEquipmentT);
  for(const k of Object.keys(start.solar).filter(k=>k!=='powerLink'))assert.deepEqual(w.solar[k],start.solar[k]);
  assert.deepEqual(w.services,start.services);assert.deepEqual(w.flights,start.flights);assert.deepEqual(start,before);
  assert.equal(w.day,start.day);assert.equal(w.revision,start.revision+1);
  assert.throws(()=>connectSwarmPower(w),/already/);
  assert.throws(()=>connectSwarmPower(createCampaign('locked','locked')),/100 t/);
  for(const k of ['materialsT','equipmentT']){const low=established();low.ports.mercury[k]=0;assert.match(powerLinkReason(low),/60 t/);assert.throws(()=>connectSwarmPower(low));}
  assert.doesNotThrow(()=>validateCampaign(w));
});

test('power: deployment raises returned power exactly once, with no credit for in-flight mirrors',()=>{
  let w=linked();w=toggleMirrorLaunches(w);const power=swarmPower(w);
  w=launchMirrors(w,10);assert.deepEqual(swarmPower(w),power);
  const arrived=Math.min(...w.solar.deployments.map(d=>d.arrival));
  w=advance(w,arrived-w.day-.01);assert.deepEqual(swarmPower(w),power);
  const mass=w.solar.deployments.filter(d=>Math.abs(d.arrival-arrived)<1e-8).reduce((n,d)=>n+d.massT,0);
  w=advance(w,.01);near(swarmPower(w).returnedGW-power.returnedGW,mass*.10888);
  const restored=importCampaign(exportCampaign(w),'resumed');
  near(swarmPower(advance(restored,.01)).returnedGW,swarmPower(w).returnedGW);
});

test('power: automatic reinvestment sustains tooling and accelerates output without Mercury equipment services',()=>{
  let w=expanded();w=toggleService(w,4);
  const start=w.solar.manufacturedT,initialPower=swarmPower(w).returnedGW;
  w=advance(w,100);const first=w.solar.manufacturedT-start;
  w=advance(w,100);const second=w.solar.manufacturedT-start-first;
  assert.ok(second>first*1.2,'production grows as new batches return more power');
  assert.ok(swarmPower(w).returnedGW>initialPower*1.5);
  w=advance(w,300);
  assert.ok(w.ports.mercury.equipmentT>0);assert.ok(mercuryProduction(w).toolingT>0);
  assert.deepEqual(powerObjectives(w).map(g=>g.done),[true,true,true,true]);
  assert.ok(w.solar.depositT>0);assert.doesNotThrow(()=>validateCampaign(w));
});

test('power: daily tooling consumes real material and partial production consumes only its inputs',()=>{
  let w=linked();w.solar.autoLaunch=false;w.solar.nextLaunchDay=null;
  w.ports.mercury.materialsT=.025;w.ports.mercury.equipmentT=0;
  const old=structuredClone(w),plan=mercuryProduction(w);
  near(plan.toolingT,.025);near(plan.minedT,.5);near(plan.madeT,0);
  w=advance(w,w.solar.nextCycleDay-w.day);
  near(w.ports.mercury.materialsT,.5);near(w.ports.mercury.equipmentT,0);
  near(old.solar.depositT-w.solar.depositT,.5);near(w.solar.manufacturedT,old.solar.manufacturedT);
  const dry=linked();dry.ports.mercury.materialsT=0;dry.ports.mercury.equipmentT=0;
  const stopped=mercuryProduction(dry);assert.equal(stopped.madeT,0);assert.equal(stopped.minedT,0);assert.equal(stopped.toolingT,0);
});

test('power: equipment fabrication honors reserved storage and a two-cycle stock target',()=>{
  let w=linked();w.ports.mercury.equipmentT=LIMITS.stock-10-w.flights.filter(f=>f.to==='mercury'&&f.kind==='equipment').reduce((n,f)=>n+f.cargoT,0);
  w=dispatch(w,'earth','mercury',10,'tug','equipment');
  near(mercuryProduction(w).toolingT,0);
  const buffer=linked();buffer.ports.mercury.equipmentT=mercuryProduction(buffer).equipmentDemand*2;
  near(mercuryProduction(buffer).toolingT,0);
  const finite=linked();finite.solar.depositT=.01;
  const before=finite.solar.depositT;const after=advance(finite,1);
  near(after.solar.depositT,0);assert.ok(mercuryProduction(finite).minedT<=before);
  assert.doesNotThrow(()=>validateCampaign(after));
});

test('power: power-driven launch batches retain recovery, fuel, storage and traffic constraints',()=>{
  let w=expanded();const schedule=automaticMirrorPlan(w);
  assert.equal(schedule.massT,30);assert.ok(schedule.intervalDays<10);
  w=launchMirrors(w,schedule.massT);assert.match(mirrorLaunchPlan(w,30).reason,/stock|recovering/i);
  w.fuelT=0;assert.match(mirrorLaunchPlan(w,10).reason,/propellant/);
  const full=expanded();full.solar.mirrorsT+=100;full.solar.manufacturedT+=100;
  while(full.solar.deployments.length<LIMITS.mirrorDeployments){full.solar.deployments.push({id:full.solar.nextDeployment++,massT:1,departed:full.day,arrival:full.day+SOLAR.deploymentDays});full.solar.manufacturedT++;}
  assert.match(mirrorLaunchPlan(full,30).reason,/traffic/);
  assert.deepEqual(validateCampaign(full),full);
  const end=expanded();end.day=LIMITS.days-1;end.flights=[];end.services=[];end.solar.deployments=[];
  end.solar.manufacturedT=end.solar.mirrorsT+end.solar.deployedT;end.solar.nextCycleDay=end.day+1;end.solar.nextLaunchDay=end.day+1;
  const last=advance(end,1);assert.equal(last.solar.deployments.length,0);assert.doesNotThrow(()=>validateCampaign(last));
});

test('power: irregular small steps, large jumps and reload agree through changing production and launch rates',()=>{
  const w=expanded(),together=advance(w,600);let small=w;
  for(let i=0;i<1200;i++)small=advance(small,.5);
  const same=(a,b)=>{
    near(a.day,b.day);near(a.fuelT,b.fuelT);
    for(const site of Object.keys(w.ports))for(const key of ['materialsT','equipmentT','receivedT','sentT','readyDay'])near(a.ports[site][key],b.ports[site][key]);
    for(const key of ['mirrorsT','manufacturedT','deployedT','depositT','nextLaunchDay','nextCycleDay'])near(a.solar[key],b.solar[key]);
    assert.deepEqual(a.solar.deployments,b.solar.deployments);assert.deepEqual(a.services,b.services);
    assert.doesNotThrow(()=>validateCampaign(a));
  };
  same(small,together);
  same(advance(importCampaign(exportCampaign(advance(w,253.125)),'resumed'),346.875),together);
});

test('power: corrupted flags, dependencies and envelope versions fail before changing state',()=>{
  const good=linked();
  for(const mutate of [w=>w.solar.powerLink='yes',w=>delete w.solar.powerLink,w=>w.solar.deployedT=99,w=>w.solar.launchArray=false,w=>w.model='network-0.3.0']){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  const envelope=JSON.parse(exportCampaign(good));envelope.version=3;assert.throws(()=>importCampaign(JSON.stringify(envelope),'bad'),/do not match/);
  assert.doesNotThrow(()=>validateCampaign(good));
});
