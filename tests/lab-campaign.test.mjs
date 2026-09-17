import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, build, createCampaign, dispatch, exportCampaign, flightPlan, importCampaign, LIMITS, nextEventDay, objectives, resupply, ROUTES, validateCampaign } from '../.lab-test/campaign/model.js';

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
  w=advance(w,10);assert.equal(mass(w),160);assert.equal(w.fuelT,fuel);
  w=deliver(w,'moon',2);w=build(w,'moon');assert.equal(mass(w),130);
});
test('campaign: invalid and over-budget commands cannot mutate a world',()=>{
  const w=fresh(),before=structuredClone(w);
  for(const cargo of [0,-1,NaN,Infinity,1.5,11])assert.throws(()=>dispatch(w,'earth','moon',cargo,'tug'));
  assert.throws(()=>dispatch(w,'earth','moon',10,'tether'),/both ends/);
  assert.throws(()=>dispatch(w,'moon','phobos',1,'tug'),/through Earth/);
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
  assert.equal(w.fuelT,120);assert.equal(w.nextSupplyDay,60);
});
test('campaign: imports round-trip with in-flight cargo and reject corrupt or unsupported files',()=>{
  const w=dispatch(fresh(),'earth','moon',10,'tug'); const imported=importCampaign(exportCampaign(w),'new-slot');
  assert.deepEqual({...imported,id:w.id,revision:w.revision},w);
  for(const mutate of [v=>v.schema=2,v=>v.model='future',v=>v.day=-1,v=>v.fuelT=null,v=>v.ports.moon.level=99,v=>v.flights.push({...v.flights[0]}),v=>v.flights[0].arrival=0,v=>v.flights[0].arrival+=2,v=>v.flights[0].to='sun']){
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
