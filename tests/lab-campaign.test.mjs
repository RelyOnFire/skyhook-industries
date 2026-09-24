import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addService, installIndustry, networkObjectives, removeService, toggleService, advance, build, createCampaign, dispatch, exportCampaign, flightPlan, importCampaign, LIMITS, nextEventDay, objectives, resupply, ROUTES, validateCampaign } from '../.lab-test/campaign/model.js';

const fresh=()=>createCampaign('world-one','First light');
const deliver=(w,to,loads)=>{for(let i=0;i<loads;i++)w=dispatch(w,'earth',to,10,'tug');return advance(w,Math.max(...w.flights.map(f=>f.arrival))-w.day);};

test('campaign: one saved world reaches the Moon, returns cargo, and commissions Phobos',()=>{
  let w=fresh(); const original=structuredClone(w); w=deliver(w,'moon',4);
  assert.equal(w.ports.moon.materialsT,40); assert.equal(w.ports.earth.materialsT,120);
  w=build(w,'moon'); assert.equal(w.ports.moon.materialsT,10);
  w=dispatch(w,'moon','earth',10,'tether'); assert.equal(w.ports.moon.materialsT,0);
  const backup=exportCampaign(w); w=importCampaign(backup,'restored');
  w=advance(w,w.flights[0].arrival-w.day); assert.equal(w.lunarReturnedT,10);
  assert.equal(w.ports.earth.materialsT,130);
  w=deliver(w,'phobos',3); w=build(w,'phobos');
  assert.equal(w.ports.phobos.level,1); assert.equal(w.ports.phobos.materialsT,0);
  assert.deepEqual(objectives(w).map(g=>g.done),[true,true,true,false]);
  assert.deepEqual(fresh(),original); assert.doesNotThrow(()=>validateCampaign(w));
});
test('campaign: transfer times are independent of render timing and match known ideal scales',()=>{
  assert.ok(ROUTES[0].coastDays>4.9&&ROUTES[0].coastDays<5.1);
  assert.ok(ROUTES[1].coastDays>258&&ROUTES[1].coastDays<260);
  let w=dispatch(fresh(),'earth','moon',10,'tug');
  const combined=advance(w,30); for(let i=0;i<30;i++)w=advance(w,1);
  assert.deepEqual(w.ports,combined.ports); assert.equal(w.fuelT,combined.fuelT);
  assert.equal(w.ports.moon.receivedT,10); w=advance(w,100); assert.equal(w.ports.moon.receivedT,10);
});
test('campaign: construction and dispatch conserve cargo until construction consumes it',()=>{
  let w=dispatch(fresh(),'earth','moon',10,'tug');
  const mass=w=>Object.values(w.ports).reduce((n,p)=>n+p.materialsT,0)+w.flights.reduce((n,f)=>n+f.cargoT,0);
  assert.equal(mass(w),160); const fuel=w.fuelT;
  w=advance(w,10);assert.equal(mass(w),160);assert.equal(w.fuelT,fuel+10);
  w=deliver(w,'moon',2);w=build(w,'moon');assert.equal(mass(w),130);
});
test('campaign: invalid and over-budget commands cannot mutate a world',()=>{
  const w=fresh(),before=structuredClone(w);
  for(const cargo of [0,-1,NaN,Infinity,1.5,11])assert.throws(()=>dispatch(w,'earth','moon',cargo,'tug'));
  assert.throws(()=>dispatch(w,'earth','moon',10,'tether'),/both ends/);
  assert.throws(()=>dispatch(w,'moon','phobos',1,'tug'),/Not enough/);
  assert.throws(()=>build(w,'moon'),/more construction cargo/);
  for(const step of [0,-1,NaN,Infinity,LIMITS.days+1])assert.throws(()=>advance(w,step));
  const dry={...w,fuelT:0};assert.throws(()=>dispatch(dry,'earth','moon',10,'tug'),/propellant/);
  assert.deepEqual(w,before);
});
test('campaign: tether service obeys both endpoint capacities and recovery',()=>{
  let w=build(deliver(fresh(),'moon',3),'moon');
  w=dispatch(w,'earth','moon',10,'tether');assert.equal(flightPlan(w,'earth','moon',10,'tether').reason.includes('recovering'),true);
  assert.equal(nextEventDay(w),w.day+2);w=advance(w,2);
  assert.equal(flightPlan(w,'earth','moon',10,'tether').reason,'');
  assert.match(flightPlan(w,'earth','moon',11,'tether').reason,/10 t/);
});
test('campaign: supplies prevent an empty network becoming irrecoverable and enforce their interval',()=>{
  let w=fresh();w.ports.earth.materialsT=0;w.fuelT=0;w=resupply(w);
  assert.equal(w.ports.earth.materialsT,60);assert.equal(w.fuelT,60);
  assert.throws(()=>resupply(w),/not ready/);w=advance(w,30);w=resupply(w);
  assert.equal(w.fuelT,150);assert.equal(w.nextSupplyDay,60);
});
test('campaign: imports round-trip with in-flight cargo and reject corrupt or unsupported files',()=>{
  const w=dispatch(fresh(),'earth','moon',10,'tug'); const imported=importCampaign(exportCampaign(w),'new-slot');
  assert.deepEqual({...imported,id:w.id,revision:w.revision},w);
  for(const mutate of [v=>v.schema=999,v=>v.model='future',v=>v.day=-1,v=>v.fuelT=null,v=>v.ports.moon.level=99,v=>v.flights.push({...v.flights[0]}),v=>v.flights[0].arrival=0,v=>v.flights[0].arrival+=2,v=>v.flights[0].to='sun']){
    const bad=structuredClone(w);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  assert.throws(()=>importCampaign(JSON.stringify(w),'id'));
  assert.throws(()=>importCampaign(' '.repeat(LIMITS.fileBytes+1),'id'));
  assert.throws(()=>importCampaign('{broken','id'));
});
test('campaign: a Phobos return alone does not satisfy the lunar return objective',()=>{
  let w=fresh(); w.ports.phobos.materialsT=10;w=dispatch(w,'phobos','earth',10,'tug');w=advance(w,300);
  assert.equal(objectives(w)[1].done,false);assert.equal(w.ports.earth.receivedT,10);
});


const nearly=(a,b)=>assert.ok(Math.abs(a-b)<1e-6, a+' ≠ '+b);
const industrial=()=>{
  let w=fresh();
  for(const id of ['moon','phobos']){w.ports[id].level=1;w.ports[id].materialsT=20;w.ports[id].equipmentT=25;w=installIndustry(w,id);}
  return w;
};
test('network: real first-chapter backup migrates without changing progress or retroactive production',()=>{
  const backup=JSON.parse(readFileSync(new URL('./fixtures/campaign-v1.json',import.meta.url)));
  const original=structuredClone(backup), old=backup.state, w=validateCampaign(old);
  for(const k of ['id','name','day','revision','fuelT','nextShipment','nextSupplyDay','lunarReturnedT','log']) assert.deepEqual(w[k],old[k]);
  for(const id of ['earth','moon','phobos']) for(const k of Object.keys(old.ports[id])) assert.equal(w.ports[id][k],old.ports[id][k]);
  assert.equal(w.ports.earth.equipmentT,20);assert.equal(w.ports.moon.equipmentT,0);
  assert.equal(w.ports.earth.industry,true);assert.deepEqual(w.services,[]);
  assert.deepEqual(validateCampaign(w),w);assert.deepEqual(backup,original);
  assert.equal(importCampaign(JSON.stringify(backup),'new').schema,6);
  const aged=advance(w,2);nearly(aged.ports.earth.equipmentT,21);nearly(aged.fuelT,old.fuelT+2);
});
test('network: legacy active flights preserve cargo, timing and one-time arrival',()=>{
  const current=dispatch(fresh(),'earth','phobos',10,'tug'), legacy=structuredClone(current);
  legacy.schema=1;legacy.model='network-0.1.0';
  for(const p of Object.values(legacy.ports)){delete p.equipmentT;delete p.industry;}
  for(const f of legacy.flights){delete f.kind;delete f.serviceId;}
  for(const k of ['services','nextService','marsOperations','lunarPhobosDeliveredT'])delete legacy[k];
  const migrated=validateCampaign(legacy);
  assert.deepEqual(migrated.flights,current.flights);
  let w=advance(migrated,300);assert.equal(w.ports.phobos.receivedT,10);
  w=advance(w,300);assert.equal(w.ports.phobos.receivedT,10);
});
test('network: equipment is separate cargo and local industry consumes its recipe only when working',()=>{
  let w=industrial();w.ports.moon.equipmentT=.5;w.ports.phobos.equipmentT=.2;w.ports.phobos.materialsT=3;
  w=advance(w,30);
  nearly(w.ports.moon.materialsT,10);nearly(w.ports.moon.equipmentT,0);
  nearly(w.marsOperations,6);nearly(w.ports.phobos.materialsT,0);nearly(w.ports.phobos.equipmentT,.08);
  w=dispatch(w,'earth','moon',5,'tether','equipment');
  const materials=w.ports.earth.materialsT;
  w=advance(w,w.flights[0].arrival-w.day);nearly(w.ports.moon.equipmentT,5);
  w=advance(w,10);nearly(w.ports.moon.materialsT,20);nearly(w.ports.moon.equipmentT,4.5);
  assert.equal(w.ports.earth.materialsT,materials);
  assert.throws(()=>installIndustry(w,'moon'),/already installed/);
});
test('network: lunar production sustains recurring Phobos deliveries and Mars operations',()=>{
  let w=industrial();
  w=addService(w,'earth','moon',5,'tether','equipment',90);
  w=addService(w,'earth','phobos',3,'tether','equipment',100);
  w=addService(w,'moon','phobos',10,'tether','materials',20);
  w=advance(w,1000);
  assert.ok(w.services[2].dispatched>40);assert.ok(w.services[2].deliveredT>=300);
  assert.ok(w.marsOperations>500);assert.deepEqual(networkObjectives(w).map(g=>g.done),[true,true,true,true]);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('network: event processing is independent of skip size and survives save/reload mid-route',()=>{
  let initial=industrial();
  initial=addService(initial,'earth','moon',5,'tether','equipment',90);
  initial=addService(initial,'earth','phobos',3,'tether','equipment',100);
  initial=addService(initial,'moon','phobos',10,'tether','materials',20);
  const together=advance(initial,900);
  let stepped=initial;
  for(let i=0;i<90;i++)stepped=advance(stepped,10);
  const restored=advance(importCampaign(exportCampaign(advance(initial,350)),'restored'),550);
  for(const w of [stepped,restored]){
    for(const id of ['earth','moon','phobos'])for(const k of ['materialsT','equipmentT','readyDay','receivedT','sentT'])nearly(w.ports[id][k],together.ports[id][k]);
    nearly(w.fuelT,together.fuelT);nearly(w.marsOperations,together.marsOperations);
    assert.deepEqual(w.flights,together.flights);assert.deepEqual(w.services,together.services);assert.deepEqual(w.log,together.log);
  }
});
test('network: blocked departures retry without debt and contend for real endpoint recovery',()=>{
  let w=fresh();w.ports.moon.level=1;w.ports.phobos.level=1;
  w=addService(w,'moon','phobos',10,'tether','materials',30);
  w=advance(w,100);assert.equal(w.flights.length,0);assert.equal(w.services[0].nextDay,101);
  w.ports.moon.materialsT=30;
  w=addService(w,'moon','earth',10,'tether','materials',30);
  w=advance(w,1);assert.equal(w.flights.length,1);assert.equal(w.services[0].dispatched,1);assert.equal(w.services[1].dispatched,0);
  w=advance(w,2);assert.equal(w.services[1].dispatched,1);assert.equal(w.ports.moon.materialsT,10);
  assert.equal(w.services[0].nextDay,131);
});
test('network: arrivals supply a booking at the same instant',()=>{
  let w=fresh();w.ports.moon.level=1;w.ports.phobos.level=1;
  w=dispatch(w,'earth','moon',10,'tug');
  const at=w.flights[0].arrival;
  w=addService(w,'moon','phobos',10,'tether','materials',30);w.services[0].nextDay=at;
  w=advance(w,at);assert.equal(w.services[0].dispatched,1);
  assert.equal(w.flights[0].from,'moon');assert.equal(w.ports.moon.materialsT,0);
});
test('network: paused and removed services keep in-flight deliveries and never catch up missed slots',()=>{
  let w=fresh();w=addService(w,'earth','moon',10,'tug','materials',30);w=advance(w,1);
  w=toggleService(w,1);w=advance(w,100);assert.equal(w.services[0].dispatched,1);assert.equal(w.services[0].deliveredT,10);
  w=toggleService(w,1);w=advance(w,1);assert.equal(w.services[0].dispatched,2);
  w=removeService(w,1);w=advance(w,100);assert.equal(w.ports.moon.receivedT,20);assert.equal(w.services.length,0);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('network: production reserves incoming storage and stops consuming equipment at capacity',()=>{
  let w=industrial();w.ports.moon.materialsT=LIMITS.stock-10;
  w=dispatch(w,'earth','moon',10,'tug');
  const equipment=w.ports.moon.equipmentT;
  w=advance(w,30);assert.equal(w.ports.moon.materialsT,LIMITS.stock);assert.equal(w.ports.moon.equipmentT,equipment);
  assert.match(flightPlan(w,'earth','moon',1,'tug').reason,/storage/);
  assert.doesNotThrow(()=>validateCampaign(w));
});
test('network: service limits, traffic limits, invalid recipes and horizon remain bounded',()=>{
  let w=fresh();
  assert.throws(()=>installIndustry(w,'moon'),/Commission/);
  w.ports.moon.level=1;assert.throws(()=>installIndustry(w,'moon'),/20 t/);
  for(const interval of [0,-1,NaN,1.5,3651])assert.throws(()=>addService(w,'earth','moon',1,'tug','materials',interval));
  for(let i=0;i<12;i++)w=addService(w,'earth','moon',1,'tug','equipment',1);
  assert.throws(()=>addService(w,'earth','moon',1,'tug','materials',1),/12/);
  w.ports.earth.equipmentT=100;w=advance(w,5);assert.equal(w.flights.length,60);assert.doesNotThrow(()=>validateCampaign(w));
  w=advance(w,20);assert.ok(w.ports.moon.receivedT>0);
  const end=fresh();end.day=LIMITS.days-1;
  const last=advance(addService(end,'earth','moon',1,'tug','materials',1),1);
  assert.equal(last.flights.length,0);assert.doesNotThrow(()=>validateCampaign(last));
});
test('network: service save validation rejects malformed schedules before they run',()=>{
  const w=addService(fresh(),'earth','moon',1,'tug','equipment',30);
  for(const mutate of [x=>x.services[0].nextDay=0,x=>x.services[0].intervalDays=0,x=>x.services[0].kind='ore',x=>x.services[0].enabled='yes',x=>x.services.push({...x.services[0]}),x=>x.ports.moon.industry=true]){
    const bad=structuredClone(w);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  assert.deepEqual(importCampaign(exportCampaign(w),'world-one').services,w.services);
});

test('network: Earth equipment recovers after one full-stock shipment, including across a save',()=>{
  let w=fresh();w.ports.earth.level=2;w.ports.moon.level=2;
  w=dispatch(w,'earth','moon',20,'tether','equipment');
  assert.equal(w.ports.earth.equipmentT,0);
  assert.match(flightPlan(w,'earth','moon',10,'tether','equipment').reason,/manufactures 0.5 t per simulation day/);
  const supplied=resupply(w);assert.equal(supplied.ports.earth.equipmentT,0);
  w=importCampaign(exportCampaign(w),'reloaded-empty-depot');
  w=advance(w,30);
  nearly(w.ports.earth.equipmentT,15);assert.equal(w.ports.moon.equipmentT,20);
  assert.equal(flightPlan(w,'earth','moon',10,'tether','equipment').reason,'');
  w=dispatch(w,'earth','moon',10,'tether','equipment');
  nearly(w.ports.earth.equipmentT,5);
  assert.doesNotThrow(()=>validateCampaign(w));
});
