import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addService,advance,automaticMirrorLaunchReason,automaticMirrorPlan,BELT,beltProduction,CAMPAIGN_MODEL,ceresReserveT,createCampaign,DEVELOPMENT,developmentObjectives,developmentProjects,developmentUnlockReason,dispatch,exportCampaign,flightPlan,importCampaign,launchMirrors,mercuryReserveT,mirrorCapacity,mirrorLaunchPlan,setMirrorFuelReserve,SOLAR,upgradeDevelopment,validateCampaign} from '../.lab-test/campaign/model.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≠ '+b);
const migrated=()=>importCampaign(JSON.stringify(fixture),'development-test');
function funded() {
  const w=migrated();
  for(const id of ['mercury','phobos','ceres']){w.ports[id].materialsT=100000;w.ports[id].equipmentT=10000;}
  return validateCampaign(w);
}
function isolated() {
  const w=funded();w.services=[];
  // Return undelivered water to Ceres so the conserved ledger stays intact.
  w.ports.ceres.waterT+=w.flights.filter(f=>f.kind==='water').reduce((n,f)=>n+f.cargoT,0);w.flights=[];
  w.ports.earth.industry=false;w.ports.phobos.materialsT=0;
  w.solar.nextLaunchDay=w.day+1;
  return validateCampaign(w);
}
function ledger(w) {
  near(ceresReserveT(w)-w.belt.depositT,w.belt.extractedT);
  near(w.belt.extractedT,w.ports.ceres.waterT+w.ports.phobos.waterT+w.belt.refinedT+w.flights.filter(f=>f.kind==='water').reduce((n,f)=>n+f.cargoT,0));
  near(w.belt.returnedWaterT,w.ports.phobos.waterT+w.belt.refinedT);
  near(w.solar.manufacturedT,w.solar.mirrorsT+w.solar.deployedT+w.solar.deployments.reduce((n,d)=>n+d.massT,0));
  assert.deepEqual(validateCampaign(w),w);
}

test('development: real v5 migration preserves all balances, traffic, clocks and history without grants',()=>{
  const old=fixture.state,before=structuredClone(fixture),w=validateCampaign(old);
  for(const key of Object.keys(old).filter(k=>!['schema','model'].includes(k)))assert.deepEqual(w[key],old[key],key);
  assert.equal(w.schema,6);assert.equal(w.model,CAMPAIGN_MODEL);
  assert.deepEqual(w.development,{launchLevel:0,waterLevel:0,fuelLevel:0,mercuryTracts:0,ceresTracts:0,fuelReserveT:0});
  assert.deepEqual(fixture,before);ledger(w);
  const encoded=exportCampaign(w);assert.equal(JSON.parse(encoded).version,6);
  assert.deepEqual(importCampaign(encoded,'copy'),{...w,id:'copy',revision:0});
  for(const version of [1,2,3,4,5]){
    const earlier=JSON.parse(readFileSync(new URL(`./fixtures/campaign-v${version}.json`,import.meta.url)));
    earlier.state.development={...w.development,launchLevel:3,mercuryTracts:8,fuelReserveT:999};
    assert.deepEqual(importCampaign(JSON.stringify(earlier),'old').development,w.development,'schema '+version);
  }
  const legacyBatch=structuredClone(old);legacyBatch.ports.mercury.level=1;
  const restored=validateCampaign(legacyBatch);
  assert.ok(restored.solar.deployments.some(d=>d.massT===30));
  assert.equal(mirrorCapacity(restored),10);assert.deepEqual(validateCampaign(restored),restored);
  assert.deepEqual(importCampaign(exportCampaign(restored),'legacy-batch').solar,restored.solar);
});

test('development: v5 traffic versions retain their respective bounds during migration',()=>{
  let w=funded();w.fuelT=10000;
  for(let i=0;i<40;i++)w=dispatch(w,'earth','moon',1,'tug','equipment');
  w.schema=5;w.model='network-0.5.1';delete w.development;
  assert.equal(validateCampaign(w).flights.length,w.flights.length);
  const encoded={format:'skyhook-campaign',version:5,state:w};
  assert.equal(importCampaign(JSON.stringify(encoded),'copy').schema,6);
  w.model='network-0.5.0';assert.throws(()=>validateCampaign(w),/size limit|deployments/);
});

test('development: projects require lasting network progress and local resources',()=>{
  const w=funded();assert.equal(developmentUnlockReason(w),'');
  const noServices=structuredClone(w);noServices.services=[];assert.equal(developmentUnlockReason(noServices),'');
  for(const mutate of [v=>v.solar.powerLink=false,v=>v.belt.unlocked=false,v=>v.ports.ceres.industry=false,v=>v.belt.propellantWorks=false,v=>v.belt.refinedT=99]){
    const locked=structuredClone(w);mutate(locked);assert.ok(developmentUnlockReason(locked));
    for(const p of developmentProjects(locked))assert.ok(p.reason);
    assert.throws(()=>upgradeDevelopment(locked,'launch'));assert.throws(()=>setMirrorFuelReserve(locked,10));
  }
  assert.throws(()=>upgradeDevelopment(w,'unknown'),/Unknown/);
  for(const p of developmentProjects(w)){
    for(const resource of ['materialsT','equipmentT']){
      const low=structuredClone(w);low.ports[p.site][resource]=p[resource]-1;
      assert.match(developmentProjects(low).find(x=>x.id===p.id).reason,/Prepare/);
      assert.throws(()=>upgradeDevelopment(low,p.id));
    }
  }
  const missingArray=structuredClone(w);missingArray.solar.launchArray=false;
  assert.match(developmentProjects(missingArray).find(p=>p.id==='launch').reason,/launch array/);
});

test('development: upgrades debit once locally, scale costs and preserve event clocks and existing cargo',()=>{
  for(const id of ['launch','water','fuel']){
    let w=funded();
    for(let level=0;level<DEVELOPMENT.maxLevel;level++){
      const p=developmentProjects(w).find(p=>p.id===id),before=structuredClone(w);
      assert.equal(p.materialsT,(id==='launch'?300:100)*(id==='launch'?3:2)**level);
      assert.equal(p.equipmentT,(id==='launch'?20:10)*2**level);
      w=upgradeDevelopment(w,id);
      for(const site of Object.keys(w.ports)){
        near(w.ports[site].materialsT,before.ports[site].materialsT-(site===p.site?p.materialsT:0));
        near(w.ports[site].equipmentT,before.ports[site].equipmentT-(site===p.site?p.equipmentT:0));
      }
      assert.deepEqual(w.solar,before.solar);assert.deepEqual(w.belt,before.belt);
      assert.deepEqual(w.flights,before.flights);assert.deepEqual(w.services,before.services);
      assert.equal(w.day,before.day);assert.equal(w.revision,before.revision+1);
      assert.equal(w.development[id+'Level'],level+1);ledger(w);
    }
    assert.match(developmentProjects(w).find(p=>p.id===id).reason,/limit/);
    assert.throws(()=>upgradeDevelopment(w,id),/limit/);
  }
});

test('development: upgraded mirror payloads leave cargo ratings, fuel recipes and recovery unchanged',()=>{
  let w=funded();const oldCargo=flightPlan(w,'mercury','earth',30,'tether','materials');
  for(let i=0;i<3;i++)w=upgradeDevelopment(w,'launch');
  assert.equal(mirrorCapacity(w),240);assert.equal(automaticMirrorPlan(w).massT,240);
  const plan=mirrorLaunchPlan(w,240);assert.equal(plan.reason,'');assert.equal(plan.fuelT,24);
  assert.match(mirrorLaunchPlan(w,241).reason,/240/);
  const cargo=flightPlan(w,'mercury','earth',30,'tether','materials');assert.equal(cargo.capacity,oldCargo.capacity);
  assert.match(flightPlan(w,'mercury','phobos',60,'tether','materials').reason,/up to 20/);
  const started=w;w=launchMirrors(w,240);const d=w.solar.deployments.at(-1);
  near(d.arrival-d.departed,SOLAR.deploymentDays);near(w.ports.mercury.readyDay-w.day,2/3);
  near(started.solar.mirrorsT-w.solar.mirrorsT,240);near(started.fuelT-w.fuelT,24);
  assert.deepEqual(w.solar.deployments.slice(0,-1),started.solar.deployments);ledger(w);
  assert.deepEqual(importCampaign(exportCampaign(w),'copy').solar.deployments,w.solar.deployments);
});

test('development: finite paid tracts extend reserves without crediting mined output',()=>{
  let w=funded();assert.equal(w.solar.depositT,0);
  for(const id of ['mercuryTract','ceresTract']){
    for(let n=0;n<DEVELOPMENT.maxTracts;n++){
      const before=structuredClone(w),project=developmentProjects(w).find(p=>p.id===id);
      assert.equal(project.materialsT,(id==='mercuryTract'?500:150)*(n+1));
      assert.equal(project.equipmentT,(id==='mercuryTract'?20:10)*(n+1));
      w=upgradeDevelopment(w,id);
      near(w[id==='mercuryTract'?'solar':'belt'].depositT-before[id==='mercuryTract'?'solar':'belt'].depositT,100000);
      near(w.solar.manufacturedT,before.solar.manufacturedT);near(w.belt.extractedT,before.belt.extractedT);
      assert.equal(w.solar.nextCycleDay,before.solar.nextCycleDay);assert.equal(w.belt.nextCycleDay,before.belt.nextCycleDay);ledger(w);
    }
    assert.throws(()=>upgradeDevelopment(w,id),/limit/);
  }
  assert.equal(mercuryReserveT(w),900000);assert.equal(ceresReserveT(w),900000);
  w.solar.autoLaunch=false;w.solar.nextLaunchDay=null;
  const before=w;w=advance(w,1);assert.ok(w.solar.depositT<before.solar.depositT);assert.ok(w.belt.depositT<before.belt.depositT);ledger(w);
});

test('development: scaled water and fuel recipes honor maintenance, storage and local input limits',()=>{
  let w=funded();w=upgradeDevelopment(upgradeDevelopment(w,'water'),'fuel');
  let p=beltProduction(w);assert.equal(p.waterCapacity,4);assert.equal(p.fuelCapacity,4);assert.equal(p.waterT,4);assert.equal(p.fuelT,0);
  // Move extracted water between depots while retaining the full water ledger.
  w.ports.ceres.waterT-=10;w.ports.phobos.waterT+=10;w.belt.returnedWaterT+=10;
  w.ports.phobos.materialsT=0; // Isolate refinery maintenance from Mars staging.
  w.ports.ceres.equipmentT=.015;w.ports.phobos.equipmentT=.0025;
  p=beltProduction(w);near(p.waterT,1.5);near(p.fuelT,.5);
  const before=structuredClone(w);w=advance(w,w.belt.nextCycleDay-w.day);
  near(w.belt.extractedT-before.belt.extractedT,1.5);near(w.belt.refinedT-before.belt.refinedT,.5);
  near(w.ports.ceres.equipmentT,0);near(w.ports.phobos.equipmentT,0);ledger(w);
  const full=funded();full.fuelT=1000000;assert.equal(beltProduction(full).fuelT,0);
  const scarce=funded(),priorExtracted=scarce.belt.extractedT;scarce.belt.depositT=.2;scarce.belt.extractedT=BELT.depositT-.2;
  scarce.ports.ceres.waterT+=scarce.belt.extractedT-priorExtracted;
  assert.equal(beltProduction(scarce).waterT,.2);ledger(scarce);
});

test('development: an opt-in reserve lets cargo book first and pauses automatic mirrors, with manual override',()=>{
  let w=isolated();w.fuelT=20;w=setMirrorFuelReserve(w,15);
  const oldClock=w.solar.nextLaunchDay;
  w=addService(w,'earth','moon',10,'tug','equipment',10);
  const before=structuredClone(w);w=advance(w,1);
  assert.equal(w.services.at(-1).dispatched,1);near(w.fuelT,16.5);
  assert.equal(w.solar.nextDeployment,before.solar.nextDeployment);assert.match(automaticMirrorLaunchReason(w),/holding 15 t/);
  assert.equal(w.solar.nextLaunchDay,oldClock+1);
  const manual=launchMirrors(w,30);near(manual.fuelT,13.5);assert.equal(manual.solar.nextDeployment,w.solar.nextDeployment+1);ledger(manual);
  const released=setMirrorFuelReserve(w,0);assert.equal(released.solar.nextLaunchDay,w.solar.nextLaunchDay);
  assert.equal(setMirrorFuelReserve(released,0),released);
  const resumed=advance(released,1);assert.equal(resumed.solar.nextDeployment,released.solar.nextDeployment+1);ledger(resumed);
  for(const bad of [-1,.5,1000001,NaN,Infinity])assert.throws(()=>setMirrorFuelReserve(w,bad),/reserve/);
});

test('development: default reserve preserves automatic launches and exact fuel threshold is allowed',()=>{
  let w=isolated();w.fuelT=18;w=setMirrorFuelReserve(w,15);
  assert.equal(automaticMirrorLaunchReason(w),'');
  const next=advance(w,1);near(next.fuelT,15);assert.equal(next.solar.nextDeployment,w.solar.nextDeployment+1);
  w=setMirrorFuelReserve(w,0);w.fuelT=3;const noReserve=advance(w,1);near(noReserve.fuelT,0);assert.equal(noReserve.solar.nextDeployment,w.solar.nextDeployment+1);
});

test('development: upgraded events agree through large steps, small steps and reload',()=>{
  let w=funded();for(const id of ['launch','water','fuel','mercuryTract','ceresTract'])w=upgradeDevelopment(w,id);
  w=setMirrorFuelReserve(w,50);
  const large=advance(w,90);let small=w;
  for(let i=0;i<180;i++)small=advance(small,.5);
  const restored=advance(importCampaign(exportCampaign(advance(w,27.25)),'copy'),62.75);
  const compare=(a,b)=>{
    near(a.day,b.day);near(a.fuelT,b.fuelT);
    for(const id of Object.keys(a.ports))for(const key of Object.keys(a.ports[id])){
      if(typeof a.ports[id][key]==='number')near(a.ports[id][key],b.ports[id][key]);else assert.equal(a.ports[id][key],b.ports[id][key]);
    }
    for(const obj of ['solar','belt'])for(const key of Object.keys(a[obj])){
      if(typeof a[obj][key]==='number')near(a[obj][key],b[obj][key]);else assert.deepEqual(a[obj][key],b[obj][key]);
    }
    assert.deepEqual(a.development,b.development);assert.deepEqual(a.services,b.services);assert.deepEqual(a.flights,b.flights);ledger(a);
  };
  compare(small,large);compare(restored,large);
  assert.deepEqual(developmentObjectives(w).map(x=>x.done),[true,true,true,false]);
  const finished=structuredClone(w);finished.solar.deployedT=50000;assert.equal(developmentObjectives(finished).at(-1).done,true);
});

test('development: invalid expansions, reserves, dependencies and mirror or water ledgers are rejected',()=>{
  let good=funded();for(const id of ['launch','water','fuel','mercuryTract','ceresTract'])good=upgradeDevelopment(good,id);
  for(const mutate of [w=>delete w.development,w=>w.development.launchLevel=4,w=>w.development.waterLevel=.5,w=>w.development.fuelLevel=-1,w=>w.development.mercuryTracts=9,w=>w.development.ceresTracts=NaN,w=>w.development.fuelReserveT=.1,w=>w.development.fuelReserveT=1000001,w=>w.solar.depositT=mercuryReserveT(w)+1,w=>w.belt.depositT++,w=>w.solar.mirrorsT++,w=>w.solar.powerLink=false,w=>w.belt.refinedT=99,w=>w.solar.deployments[0].massT=61]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  const noProgress=createCampaign('fresh','fresh');noProgress.development.fuelReserveT=1;assert.throws(()=>validateCampaign(noProgress),/Industrial/);
  const envelope=JSON.parse(exportCampaign(good));envelope.version=5;
  assert.throws(()=>importCampaign(JSON.stringify(envelope),'bad'),/do not match/);ledger(good);
});
