import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addService,advance,BELT,beltObjectives,beltProduction,build,buildPropellantWorks,ceresUnlockReason,createCampaign,dispatch,exportCampaign,flightPlan,importCampaign,installIndustry,LIMITS,nextEventDay,removeService,routeFor,toggleMirrorLaunches,toggleService,unlockCeres,validateCampaign} from '../.lab-test/campaign/model.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v4.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≠ '+b);
const duration=routeFor('phobos','ceres').coastDays+routeFor('phobos','ceres').handlingDays;
// A developed scenario with working stock, isolating the new recipes from older services.
function prepared() {
  let w=importCampaign(JSON.stringify(fixture),'belt-test');
  for(const s of w.services)w=removeService(w,s.id);
  if(w.solar.autoLaunch)w=toggleMirrorLaunches(w);
  w=advance(w,600);
  w.ports.phobos.level=2;w.ports.phobos.materialsT=3000;w.ports.phobos.equipmentT=200;
  return validateCampaign(w);
}
function outpost() {
  let w=unlockCeres(prepared());
  for(let i=0;i<5;i++)w=dispatch(w,'phobos','ceres',10,'tug','materials');
  w=dispatch(w,'phobos','ceres',10,'tug','equipment');
  w=advance(w,duration);w=build(w,'ceres');w=installIndustry(w,'ceres');
  return buildPropellantWorks(w);
}
function productionOnly() {
  const w=outpost();
  // Isolate the belt; facilities remain valid but old recipes have no working input.
  w.ports.earth.industry=false;w.ports.phobos.materialsT=0;
  w.ports.mercury.materialsT=0;w.ports.mercury.equipmentT=0;
  return w;
}
const checkLedger=w=>{
  near(BELT.depositT-w.belt.depositT,w.belt.extractedT);
  near(w.belt.extractedT,w.ports.ceres.waterT+w.ports.phobos.waterT+w.belt.refinedT+w.flights.filter(f=>f.kind==='water').reduce((sum,f)=>sum+f.cargoT,0));
  near(w.belt.returnedWaterT,w.ports.phobos.waterT+w.belt.refinedT);
  assert.deepEqual(validateCampaign(w),w);
};

test('belt: the real v4 export preserves every old field and starts an empty Ceres economy',()=>{
  const old=fixture.state,before=structuredClone(fixture),w=validateCampaign(old);
  for(const k of Object.keys(old).filter(k=>!['schema','model','ports'].includes(k)))assert.deepEqual(w[k],old[k],k);
  for(const id of Object.keys(old.ports))assert.deepEqual(w.ports[id],{...old.ports[id],waterT:0});
  const fresh=createCampaign('fresh','Fresh');
  assert.deepEqual(w.ports.ceres,fresh.ports.ceres);assert.deepEqual(w.belt,fresh.belt);
  assert.equal(w.schema,5);assert.equal(w.model,'network-0.5.0');assert.deepEqual(fixture,before);
  const envelope=JSON.parse(exportCampaign(w));assert.equal(envelope.version,5);
  const restored=importCampaign(JSON.stringify(envelope),'copy');assert.deepEqual(restored,{...w,id:'copy',revision:0});
  checkLedger(w);
});

test('belt: old envelopes cannot activate belt fields or smuggle water and Ceres traffic',()=>{
  for(const version of [1,2,3,4]) {
    const old=JSON.parse(readFileSync(new URL(`./fixtures/campaign-v${version}.json`,import.meta.url))).state;
    old.belt={...createCampaign('x','x').belt,unlocked:true,refinedT:100};
    old.ports.ceres={...createCampaign('x','x').ports.ceres,materialsT:99};old.ports.phobos.waterT=99;
    const migrated=validateCampaign(old);assert.equal(migrated.belt.unlocked,false);assert.equal(migrated.ports.ceres.materialsT,0);assert.equal(migrated.ports.phobos.waterT,0);
    if(old.flights.length){old.flights[0].from='phobos';old.flights[0].to='ceres';assert.throws(()=>validateCampaign(old));}
  }
  const old=structuredClone(fixture.state);old.services[0].kind='water';assert.throws(()=>validateCampaign(old),/cargo type/);
});

test('belt: expedition prerequisites and one-time local costs leave existing traffic untouched',()=>{
  const start=prepared(),before=structuredClone(start),opened=unlockCeres(start);
  near(opened.ports.phobos.materialsT,start.ports.phobos.materialsT-60);near(opened.ports.phobos.equipmentT,start.ports.phobos.equipmentT-20);
  assert.deepEqual(opened.ports.ceres,start.ports.ceres);assert.deepEqual(opened.solar,start.solar);
  assert.deepEqual(opened.flights,start.flights);assert.deepEqual(opened.services,start.services);
  assert.equal(opened.day,start.day);assert.equal(opened.belt.nextCycleDay,start.day+1);assert.equal(opened.revision,start.revision+1);
  assert.deepEqual(start,before);assert.throws(()=>unlockCeres(opened),/already/);
  for(const mutate of [w=>w.solar.powerLink=false,w=>w.solar.deployedT=1999,w=>w.ports.phobos.level=1,w=>w.ports.phobos.industry=false,w=>w.ports.phobos.materialsT=59,w=>w.ports.phobos.equipmentT=19]){
    const bad=structuredClone(start);mutate(bad);assert.ok(ceresUnlockReason(bad));assert.throws(()=>unlockCeres(bad));
  }
  checkLedger(opened);
});

test('belt: Ceres connects only to Phobos, water returns only to Phobos, and old travel times stay frozen',()=>{
  const w=unlockCeres(prepared());assert.ok(duration>580&&duration<590);
  assert.equal(routeFor('ceres','phobos'),routeFor('phobos','ceres'));
  for(const id of ['earth','moon','mercury'])assert.throws(()=>routeFor(id,'ceres'),/Phobos hub/);
  assert.match(flightPlan(prepared(),'phobos','ceres',10,'tug').reason,/Chapter 05/);
  assert.throws(()=>build(prepared(),'ceres'),/expedition/);assert.throws(()=>installIndustry(prepared(),'ceres'),/expedition/);
  assert.throws(()=>addService(prepared(),'phobos','ceres',5,'tug','equipment',200),/expedition/);
  for(const [from,to] of [['phobos','ceres'],['earth','moon'],['phobos','mercury']]) {
    assert.match(flightPlan(w,from,to,10,'tug','water').reason,/Water returns/);
    assert.throws(()=>addService(w,from,to,10,'tug','water',90),/Water returns/);
  }
  for(const f of fixture.state.flights)near(f.arrival-f.departed,routeFor(f.from,f.to).coastDays+routeFor(f.from,f.to).handlingDays);
});

test('belt: actual shipments commission the outpost, extraction is local, and plant construction debits once',()=>{
  let w=outpost();assert.equal(w.ports.ceres.materialsT,0);assert.equal(w.ports.ceres.equipmentT,5);assert.equal(w.ports.ceres.waterT,0);
  assert.equal(w.belt.refinedT,0);assert.throws(()=>buildPropellantWorks(w),/already/);
  const before=structuredClone(w);w=advance(w,5);
  near(w.belt.extractedT,10);near(w.ports.ceres.waterT,10);near(w.ports.ceres.equipmentT,4.9);
  near(w.ports.phobos.waterT,0);near(w.belt.refinedT,0);assert.deepEqual(before.belt.refinedT,0);
  checkLedger(w);
  const empty=unlockCeres(prepared()),plant=buildPropellantWorks(empty);
  near(empty.ports.phobos.materialsT-plant.ports.phobos.materialsT,40);near(empty.ports.phobos.equipmentT-plant.ports.phobos.equipmentT,10);
  empty.ports.phobos.equipmentT=9;assert.throws(()=>buildPropellantWorks(empty),/40 t/);
});

test('belt: a return flight consumes fuel, credits water once on arrival, and earns net support fuel',()=>{
  let w=advance(productionOnly(),5),before=w.fuelT;
  w=dispatch(w,'ceres','phobos',10,'tether','water');near(w.fuelT,before-2);near(w.ports.ceres.waterT,0);
  checkLedger(w);w=advance(w,duration-.01);assert.equal(w.belt.returnedWaterT,0);assert.equal(w.belt.refinedT,0);
  w=advance(w,.01);near(w.belt.returnedWaterT,10);near(w.ports.phobos.waterT+w.belt.refinedT,10);
  w=advance(w,6);near(w.belt.refinedT,10);near(w.ports.phobos.waterT,0);near(w.fuelT,before+8);
  const restored=importCampaign(exportCampaign(w),'resumed');w=advance(restored,30);
  near(w.belt.returnedWaterT,10);near(w.belt.refinedT,10);checkLedger(w);
});

test('belt: partial cycles consume only real inputs and stop at the finite deposit',()=>{
  let w=productionOnly();w.ports.ceres.equipmentT=.005;
  w=advance(w,1);near(w.belt.extractedT,.5);near(w.ports.ceres.equipmentT,0);
  w=advance(w,20);near(w.belt.extractedT,.5);
  w.ports.ceres.equipmentT=5;w.belt.depositT=.25;w.belt.extractedT=BELT.depositT-.25;w.ports.ceres.waterT=w.belt.extractedT;
  const eq=w.ports.ceres.equipmentT;w=advance(w,3);near(w.belt.depositT,0);near(w.ports.ceres.waterT,BELT.depositT);near(w.ports.ceres.equipmentT,eq-.0025);
  assert.match(beltProduction(w).mineStatus,/exhausted/);checkLedger(w);
});

test('belt: fuel storage and Phobos equipment limit refining without spending undeliverable output',()=>{
  let w=advance(productionOnly(),5);w.ports.phobos.waterT=10;w.ports.ceres.waterT=0;w.belt.returnedWaterT=10;
  w.ports.phobos.equipmentT=.005;w=advance(w,1);near(w.belt.refinedT,1);near(w.ports.phobos.waterT,9);
  w=advance(w,20);near(w.belt.refinedT,1);w.ports.phobos.equipmentT=2;w.fuelT=LIMITS.stock-.5;
  w=advance(w,1);near(w.belt.refinedT,1.5);near(w.fuelT,LIMITS.stock);near(w.ports.phobos.waterT,8.5);near(w.ports.phobos.equipmentT,1.9975);
  const eq=w.ports.phobos.equipmentT;w=advance(w,10);near(w.ports.phobos.equipmentT,eq);near(w.belt.refinedT,1.5);checkLedger(w);
});

test('belt: same-instant water arrival and refining can fund a scheduled departure',()=>{
  let w=advance(productionOnly(),5);w=dispatch(w,'ceres','phobos',10,'tether','water');
  const at=w.flights[0].arrival;w.belt.nextCycleDay=at;
  w=addService(w,'phobos','ceres',4,'tug','equipment',200);w.services[0].nextDay=at;
  w.fuelT=0;w=advance(w,at-w.day);
  near(w.belt.returnedWaterT,10);near(w.belt.refinedT,2);near(w.fuelT,0);
  assert.equal(w.services[0].dispatched,1);assert.equal(w.flights.length,1);assert.equal(w.flights[0].departed,at);checkLedger(w);
});

test('belt: return services retry shortages, respect shared recovery, and retain cargo when paused or removed',()=>{
  let w=productionOnly();w=addService(w,'ceres','phobos',10,'tether','water',90);
  w=advance(w,4);assert.equal(w.services[0].dispatched,0);
  w=advance(w,1);assert.equal(w.services[0].dispatched,1);assert.equal(w.services[0].nextDay,w.day+90);
  assert.match(flightPlan(w,'phobos','ceres',1,'tether','equipment').reason,/recovering/);
  w=toggleService(w,w.services[0].id);assert.equal(w.flights.length,1);
  w=advance(w,100);w=toggleService(w,w.services[0].id);assert.equal(w.services[0].nextDay,w.day+1);
  w=removeService(w,w.services[0].id);w=advance(w,duration);
  near(w.belt.returnedWaterT,10);near(w.belt.refinedT,10);checkLedger(w);
});

test('belt: daily, irregular and large steps agree across supply, returns, fuel and existing swarm production',()=>{
  let w=outpost();w=addService(w,'phobos','ceres',5,'tether','equipment',200);
  w=addService(w,'ceres','phobos',10,'tether','water',90);
  const large=advance(w,1600);let small=w;
  for(let i=0;i<1600;i++)small=advance(small,1);
  const reloaded=advance(importCampaign(exportCampaign(advance(w,723.125)),'resume'),876.875);
  for(const candidate of [small,reloaded]) {
    near(candidate.fuelT,large.fuelT);near(candidate.marsOperations,large.marsOperations);
    for(const id of Object.keys(w.ports))for(const key of ['materialsT','equipmentT','waterT','readyDay','sentT','receivedT'])near(candidate.ports[id][key],large.ports[id][key]);
    for(const key of ['depositT','extractedT','returnedWaterT','refinedT','nextCycleDay'])near(candidate.belt[key],large.belt[key]);
    assert.deepEqual(candidate.services,large.services);assert.deepEqual(candidate.flights,large.flights);
    near(candidate.solar.manufacturedT,large.solar.manufacturedT);checkLedger(candidate);
  }
  assert.deepEqual(beltObjectives(large).map(g=>g.done),[true,true,true,true]);
  assert.ok(large.ports.ceres.equipmentT>0);assert.ok(large.belt.refinedT>=100);assert.ok(large.belt.depositT>0);
});

test('belt: global traffic capacity and the final campaign day still bound new flights and cycles',()=>{
  let w=advance(outpost(),5);w=dispatch(w,'ceres','phobos',10,'tether','water');
  while(w.flights.length<LIMITS.flights)w=dispatch(w,'phobos','ceres',1,'tug','equipment');
  assert.match(flightPlan(w,'phobos','ceres',1,'tug','equipment').reason,/traffic/);checkLedger(w);
  let last=productionOnly();last.day=LIMITS.days-1;last.belt.nextCycleDay=LIMITS.days;last.solar.nextCycleDay=LIMITS.days;
  assert.equal(nextEventDay(last),LIMITS.days);assert.match(flightPlan(last,'phobos','ceres',1,'tug','equipment').reason,/horizon/);
  last=advance(last,1);assert.equal(last.belt.nextCycleDay,LIMITS.days+1);assert.equal(nextEventDay(last),null);checkLedger(last);
});

test('belt: validation rejects impossible water balances, dependencies, routes, clocks and versions',()=>{
  const good=advance(outpost(),5);
  for(const mutate of [w=>delete w.belt,w=>w.belt.unlocked='yes',w=>w.belt.nextCycleDay=w.day,w=>w.belt.nextCycleDay=null,w=>w.belt.depositT=NaN,w=>w.belt.extractedT++,w=>w.belt.returnedWaterT++,w=>w.belt.refinedT++,w=>w.ports.earth.waterT=1,w=>w.ports.ceres.waterT=-1,w=>w.ports.ceres.industry=false,w=>w.ports.phobos.level=1,w=>w.solar.powerLink=false,w=>w.belt.unlocked=false,w=>w.schema=6]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  const withWater=dispatch(good,'ceres','phobos',10,'tether','water');withWater.flights[0].to='earth';assert.throws(()=>validateCampaign(withWater));
  const envelope=JSON.parse(exportCampaign(good));envelope.version=4;assert.throws(()=>importCampaign(JSON.stringify(envelope),'bad'),/do not match/);
  checkLedger(good);
});
