import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addService,advance,build,buildSolar,createCampaign,dispatch,exportCampaign,flightPlan,importCampaign,installIndustry,launchMirrors,LIMITS,mercuryUnlockReason,mirrorLaunchPlan,nextEventDay,resupply,ROUTES,SOLAR,solarObjectives,toggleMirrorLaunches,unlockMercury,validateCampaign} from '../.lab-test/campaign/model.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v2.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≠ '+b);
const fresh=()=>createCampaign('solar-test','First light');
function refinery() {
  let w=importCampaign(JSON.stringify(fixture),'solar-test');
  if(w.ports.earth.materialsT<60)w=resupply(w);
  w=unlockMercury(w);
  for(let i=0;i<5;i++)w=dispatch(w,'moon','mercury',10,'tug');
  for(let i=0;i<5;i++)w=dispatch(w,'earth','mercury',10,'tug','equipment');
  w=advance(w,120);w=build(w,'mercury');w=installIndustry(w,'mercury');
  return w;
}
function pipeline() {
  let w=refinery();
  w=advance(w,20);w=buildSolar(w,'mirrorWorks');
  w=advance(w,40);w=buildSolar(w,'launchArray');
  return w;
}
test('solar: a real v2 network migrates all stocks, schedules and active flights exactly',()=>{
  const before=structuredClone(fixture),old=fixture.state,w=validateCampaign(old);
  for(const k of Object.keys(old).filter(k=>!['schema','model','ports'].includes(k)))assert.deepEqual(w[k],old[k],k);
  for(const site of Object.keys(old.ports))assert.deepEqual(w.ports[site],{...old.ports[site],waterT:0});
  assert.equal(w.solar.unlocked,false);assert.equal(w.ports.mercury.level,0);
  assert.equal(w.solar.manufacturedT,0);assert.deepEqual(w.solar.deployments,[]);
  assert.deepEqual(validateCampaign(w),w);assert.deepEqual(fixture,before);
  assert.equal(importCampaign(JSON.stringify(fixture),'new').schema,6);
});
test('solar: expedition costs and lock apply equally to direct commands and scheduled routes',()=>{
  const w=fresh(),before=structuredClone(w);
  assert.match(mercuryUnlockReason(w),/100 Mars/);assert.throws(()=>unlockMercury(w),/100 Mars/);
  assert.throws(()=>dispatch(w,'earth','mercury',10,'tug'),/expedition/);
  assert.throws(()=>addService(w,'earth','mercury',10,'tug','equipment',60),/expedition/);
  assert.throws(()=>build(w,'mercury'),/expedition/);
  assert.deepEqual(w,before);
  w.marsOperations=100;const opened=unlockMercury(w);
  assert.equal(opened.ports.earth.materialsT,100);assert.equal(opened.ports.earth.equipmentT,0);
  assert.equal(opened.ports.mercury.materialsT,0);assert.equal(opened.solar.unlocked,true);
  assert.throws(()=>unlockMercury(opened),/already/);
});
test('solar: Mercury supply and deployment times use frozen ideal transfer estimates',()=>{
  assert.ok(ROUTES[3].coastDays>105&&ROUTES[3].coastDays<106);
  assert.ok(SOLAR.deploymentDays>55&&SOLAR.deploymentDays<57);
  let w=fresh();w.marsOperations=100;w=unlockMercury(w);
  w=dispatch(w,'earth','mercury',10,'tug');
  const first=w.flights[0].arrival;
  w=advance(w,first);assert.equal(w.ports.mercury.materialsT,10);
  w=dispatch(w,'mercury','earth',10,'tug');near(w.flights[0].arrival-w.day,first);
});
test('solar: gameplay builds the refinery, mirror works, launcher, and all solar milestones',()=>{
  let w=pipeline();
  assert.ok(w.solar.mirrorsT>=39.999);assert.equal(w.solar.deployedT,0);
  w=addService(w,'earth','mercury',10,'tether','equipment',60);
  w=toggleMirrorLaunches(w);w=advance(w,600);
  assert.deepEqual(solarObjectives(w).map(g=>g.done),[true,true,true,true]);
  assert.ok(w.solar.deployedT>400);
  near(w.solar.manufacturedT,w.solar.mirrorsT+w.solar.deployedT+w.solar.deployments.reduce((n,d)=>n+d.massT,0));
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('solar: launch consumes mirrors and fuel now, but deploys exactly once later',()=>{
  const start=pipeline(),mass=start.solar.mirrorsT;
  let w=launchMirrors(start,10);
  near(w.solar.mirrorsT,mass-10);near(w.fuelT,start.fuelT-1);assert.equal(w.solar.deployedT,0);
  const arrived=w.solar.deployments[0].arrival;
  w=advance(w,arrived-w.day-.01);assert.equal(w.solar.deployedT,0);
  w=importCampaign(exportCampaign(w),'restored');w=advance(w,.02);
  assert.equal(w.solar.deployedT,10);assert.equal(w.solar.deployments.length,0);
  w=advance(w,100);assert.equal(w.solar.deployedT,10);
});
test('solar: daily refinery and mirror cycles give the same result across large and small time steps',()=>{
  let w=pipeline();w=addService(w,'earth','mercury',10,'tether','equipment',60);w=toggleMirrorLaunches(w);
  const together=advance(w,600);let small=w;
  for(let i=0;i<1200;i++)small=advance(small,.5);
  near(small.day,together.day);near(small.fuelT,together.fuelT);
  for(const site of Object.keys(w.ports))for(const k of ['materialsT','equipmentT','receivedT','sentT','readyDay'])near(small.ports[site][k],together.ports[site][k]);
  for(const k of ['mirrorsT','manufacturedT','deployedT','depositT'])near(small.solar[k],together.solar[k]);
  assert.deepEqual(small.solar.deployments,together.solar.deployments);
  assert.deepEqual(small.services,together.services);
  const resumed=advance(importCampaign(exportCampaign(advance(w,250)),'resumed'),350);
  assert.deepEqual(resumed.solar,together.solar);
});
test('solar: scarce equipment and finite deposit cannot create unearned production',()=>{
  let w=refinery();w.ports.mercury.equipmentT=.025;
  const deposit=w.solar.depositT;w=advance(w,1);
  near(w.ports.mercury.materialsT,.5);near(w.solar.depositT,deposit-.5);near(w.ports.mercury.equipmentT,0);
  w=advance(w,10);near(w.ports.mercury.materialsT,.5);
  w.solar.depositT=.25;w.ports.mercury.equipmentT=10;w=advance(w,10);
  near(w.ports.mercury.materialsT,.75);near(w.solar.depositT,0);near(w.ports.mercury.equipmentT,9.9875);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('solar: production respects inbound storage reservations and cannot spend nonexistent mirror inputs',()=>{
  let w=pipeline();w.ports.mercury.materialsT=LIMITS.stock-10;
  w=dispatch(w,'moon','mercury',10,'tug');
  w.solar.mirrorsT=LIMITS.stock;w.solar.manufacturedT=LIMITS.stock;
  const e=w.ports.mercury.equipmentT,deposit=w.solar.depositT;
  w=advance(w,120);
  near(w.ports.mercury.materialsT,LIMITS.stock);near(w.ports.mercury.equipmentT,e);near(w.solar.depositT,deposit);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('solar: paused automatic launches keep transit and resume without a missed-launch backlog',()=>{
  let w=toggleMirrorLaunches(pipeline());w=advance(w,1);
  assert.equal(w.solar.nextDeployment,2);w=toggleMirrorLaunches(w);
  w=advance(w,100);assert.equal(w.solar.nextDeployment,2);assert.equal(w.solar.deployedT,10);
  w=toggleMirrorLaunches(w);w=advance(w,1);assert.equal(w.solar.nextDeployment,3);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('solar: Mercury recovery is shared, but 32 cargo flights no longer block automatic mirrors',()=>{
  let w=pipeline();w=dispatch(w,'earth','mercury',1,'tether','equipment');
  assert.match(mirrorLaunchPlan(w,10).reason,/recovering/);
  w=advance(w,2);
  while(w.flights.length<32)w=dispatch(w,'earth','mercury',1,'tug','equipment');
  assert.equal(mirrorLaunchPlan(w,10).reason,'');
  w=toggleMirrorLaunches(w);const next=w.solar.nextDeployment;w=advance(w,1);assert.equal(w.solar.nextDeployment,next+1);
  assert.ok(w.flights.length+w.solar.deployments.length>32);assert.deepEqual(validateCampaign(w),w);
});
test('solar: horizon and corrupted solar saves cannot run overdue events or duplicate mass',()=>{
  const w=launchMirrors(pipeline());
  for(const mutate of [x=>x.solar.nextCycleDay=x.day,x=>x.solar.autoLaunch=true,x=>x.solar.deployedT+=10,
    x=>x.solar.deployments.push({...x.solar.deployments[0]}),x=>x.solar.deployments[0].arrival+=1,
    x=>x.solar.depositT=-1,x=>x.solar.unlocked=false,x=>x.solar.launchArray=false]){
    const bad=structuredClone(w);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  const end=pipeline();end.day=LIMITS.days-1;end.flights=[];end.services=[];end.solar.nextCycleDay=end.day+1;
  const last=advance(toggleMirrorLaunches(end),1);assert.equal(last.solar.deployments.length,0);
  assert.equal(nextEventDay(last),null);assert.doesNotThrow(()=>validateCampaign(last));
});
