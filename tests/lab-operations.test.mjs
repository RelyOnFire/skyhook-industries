import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,EDT_PRESET,compile,initial,invariants,orbit,ready} from '../.lab-test/simulation/engine.js';
import {OPS_MODEL,OPS_DEFAULT,OPS_PRESETS,validateOps,readOps,opsFragment,makeManifest,unpoweredCopy,qualifies,opsStep,simulateOps,sampleOps} from '../.lab-test/simulation/operations.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≠ ${b} (tol ${tol})`);
const coast={...OPS_PRESETS[1].plan,horizonHours:3};
const service=simulateOps({...OPS_DEFAULT,horizonHours:12});
const traffic=simulateOps(coast);

test('operations inputs are finite, versioned and bounded; malformed manifests fail before propagation',()=>{
  assert.equal(validateOps(OPS_DEFAULT).model,OPS_MODEL);
  for(const edit of [{model:'old'},{horizonHours:25},{windowMinutes:0},{outboundPhase:NaN},{inboundPhase:181},{manifest:[]},{manifest:Array(21).fill(OPS_DEFAULT.manifest[0])},{manifest:[{...OPS_DEFAULT.manifest[0],massT:Infinity}]},{manifest:[{...OPS_DEFAULT.manifest[0],massT:251}]},{manifest:[{...OPS_DEFAULT.manifest[0],id:'<script>'}]}])assert.throws(()=>validateOps({...OPS_DEFAULT,...edit}));
  assert.throws(()=>validateOps({...OPS_DEFAULT,manifest:[OPS_DEFAULT.manifest[0],OPS_DEFAULT.manifest[0]]}),/unique/);
  assert.throws(()=>validateOps({...OPS_DEFAULT,mode:'schedule',manifest:[{...OPS_DEFAULT.manifest[0],atMinutes:10},{...OPS_DEFAULT.manifest[1],atMinutes:5}]}),/chronological/);
  assert.throws(()=>simulateOps(OPS_DEFAULT,{step:.01}),/budget/);
});
test('manifest and active hardware round trip through bounded JSON without executable imports',()=>{
  const p={...OPS_PRESETS[2].plan,mode:'schedule',assistance:'immediate'};
  assert.deepEqual(readOps(JSON.stringify(p)),validateOps(p));assert.deepEqual(readOps(new URLSearchParams(opsFragment(p).slice(1)).get('ops')),validateOps(p));
  assert.throws(()=>readOps('x'.repeat(32001)),/32 KB/);assert.throws(()=>readOps(JSON.stringify({model:'D1p-0.4.0'})),/version/);
});
test('repeated operations uses a finite inventory and one non-refilled fuel tank',()=>{
  assert.equal(service.rows.length,6);assert.ok(service.outbound>=3);assert.equal(service.stop,'horizon');
  assert.ok(service.fuelUsedKg>0&&service.fuelUsedKg<=40000);assert.ok(service.frames.every(f=>f.state[6]>=-1e-7));
  service.frames.slice(1).forEach((f,i)=>assert.ok(f.state[6]<=service.frames[i].state[6]+1e-8));
  const captures=service.events.filter(e=>e.kind==='capture');assert.equal(new Set(captures.map(e=>e.shipmentId)).size,captures.length);assert.ok(captures.length<=6);
  assert.ok(service.rows.some(r=>r.status==='unserved'));assert.ok(service.events.some(e=>e.kind==='fuel'));
});
test('outbound and inbound exchanges have physical, unequal energy and angular-momentum changes',()=>{
  const out=traffic.rows[0],back=traffic.rows[1];assert.equal(out.status,'delivered');assert.equal(back.status,'returned');
  assert.equal(out.massT,back.massT);assert.ok(out.energyGainJ>0&&back.energyGainJ<0);assert.ok(out.angularGain>0&&back.angularGain<0);
  assert.ok(Math.abs(out.energyGainJ+back.energyGainJ)>1e9,'Equal tonnes must not award automatic balance');
  for(const row of [out,back]){assert.ok(row.encounter.accepted);near(row.encounter.capture-row.encounter.start,90,1e-6);assert.ok(row.encounter.positionErrorM<=2&&row.encounter.velocityErrorMs<=.02);near(row.energyGainJ,row.massT*1000*(orbit(row.releasedState).energy-orbit(row.capturedState).energy),.01);near(row.eventEnergyResidualJ,0,.1);near(row.eventAngularResidual,0,10);}
});
test('initial inventory + arrivals − departures + actuators − shed propellant closes in both ledgers',()=>{
  for(const r of [service,traffic]){assert.ok(r.maxEnergyResidualJ<100);assert.ok(r.maxAngularResidual<1e6);}
  assert.ok(Math.abs(traffic.energyResidualJ)<1);assert.ok(service.exhaustEnergyJ<0,'bound-orbit propellant carries negative signed mechanical energy');
});
test('a return shipment gives energy back to the dry facility without a fuel or identity reset',()=>{
  const row=traffic.rows[1],start=sampleOps(traffic,row.encounter.capture),end=sampleOps(traffic,row.releasedAt);
  assert.ok(end.dryEnergyJ>start.dryEnergyJ);assert.ok(end.dryAngular>start.dryAngular);assert.equal(traffic.fuelUsedKg,0);
  assert.ok(end.cargo.some(c=>c.id==='OUT-01'&&c.phase==='released'));assert.ok(end.cargo.some(c=>c.id==='IN-01'&&c.phase==='released'));
  assert.ok(start.cargo.some(c=>c.id==='IN-01'&&c.phase==='attached'));
});
test('scheduled windows remain exact; windows can expire while another payload is attached',()=>{
  const p={...OPS_DEFAULT,mode:'schedule',windowMinutes:.5,horizonHours:1,manifest:makeManifest(3,0,3,30).map((r,i)=>({...r,atMinutes:i===0?2:i===1?3:4}))};
  const before=JSON.stringify(p),r=simulateOps(p);assert.equal(JSON.stringify(p),before);assert.deepEqual(r.plan.manifest,p.manifest);
  assert.equal(r.rows[0].status,'delivered');assert.equal(r.rows[1].status,'missed');assert.equal(r.rows[2].status,'missed');
  assert.match(r.rows[1].reason,/carried/);assert.equal(r.rows[1].encounter,undefined);
  for(const row of r.rows)if(row.encounter?.accepted)assert.ok(Math.abs(row.encounter.capture/60-row.atMinutes)<=p.windowMinutes+1e-6);
});
test('capacity dates are inactive and do not secretly constrain or reschedule the queue',()=>{
  const p={...coast,horizonHours:1,manifest:coast.manifest.slice(0,2)},a=simulateOps(p),b=simulateOps({...p,manifest:p.manifest.map(s=>({...s,atMinutes:999}))});
  assert.deepEqual(a.frames,b.frames);assert.deepEqual(a.rows.map(r=>r.encounter),b.rows.map(r=>r.encounter));
});
test('failed inbound destination is not called a delivery and its physical exchange is retained',()=>{
  const r=simulateOps({...coast,horizonHours:2,inboundPhase:180,manifest:coast.manifest.slice(0,2)}),row=r.rows[1];
  assert.equal(row.status,'invalid-release');assert.ok(row.energyGainJ<0);assert.ok(row.perigeeKm<120);assert.equal(r.inbound,0);
  assert.ok(Math.abs(r.energyResidualJ)<1);assert.ok(r.frames.at(-1).cargo.some(c=>c.id===row.id&&c.phase==='cutoff'));
});
test('destination gates reject escape, low perigee and wrong energy direction',()=>{
  const o=OPS_DEFAULT.manifest[0],i={...o,direction:'inbound'};
  assert.equal(qualifies(o,1,null,200,OPS_DEFAULT),false);assert.equal(qualifies(o,-1,10000,200,OPS_DEFAULT),false);assert.equal(qualifies(o,1,10000,119,OPS_DEFAULT),false);
  assert.equal(qualifies(i,-1,3000,200,OPS_DEFAULT),true);assert.equal(qualifies(i,1,3000,200,OPS_DEFAULT),false);
});
test('same-hardware electrical baseline opens circuits without removing mass, adding fuel or mutating the plan',()=>{
  const p={...OPS_PRESETS[2].plan,horizonHours:.5},before=JSON.stringify(p),zero=unpoweredCopy(p);
  assert.equal(JSON.stringify(p),before);assert.equal(compile(p.design,0,false).mass,compile(zero.design,0,false).mass);assert.equal(zero.design.fuelT,0);
  const r=simulateOps(zero);near(r.busEnergyJ,0,0);near(r.actuatorWorkJ,0,0);near(r.fuelUsedKg,0,0);
  assert.throws(()=>unpoweredCopy(OPS_DEFAULT),/electrical/);
});
test('powered electrical repeated run retains current/power and work accounting with no fuel',()=>{
  const r=simulateOps({...OPS_PRESETS[2].plan,horizonHours:3});assert.ok(r.outbound>=2);assert.equal(r.fuelUsedKg,0);assert.ok(r.busEnergyJ>0);
  const y=r.frames.at(-1).state;near(y[8]+y[11]-y[9]-y[10],0,.05);near(y[12],y[9],.01);assert.ok(r.maxEnergyResidualJ<10);
});
test('coast dynamics and ledgers converge with smaller timesteps',()=>{
  const p={...coast,horizonHours:2,manifest:coast.manifest.slice(0,2)},a=simulateOps(p,{step:2}),b=simulateOps(p,{step:1});
  assert.equal(a.inbound,b.inbound);assert.equal(a.outbound,b.outbound);near(a.rows[1].energyGainJ/b.rows[1].energyGainJ,1,1e-6);near(a.rows[1].encounter.capture,b.rows[1].encounter.capture,.01);
  assert.ok(Math.abs(b.energyResidualJ)<Math.abs(a.energyResidualJ)+.01);
});
test('shift observation continues after the finite manifest is completed, not a reset to the starting state',()=>{
  const r=simulateOps({...coast,horizonHours:2,manifest:coast.manifest.slice(0,1)});assert.equal(r.outbound,1);assert.equal(r.frames.at(-1).t,7200);assert.ok(r.rows[0].releasedAt<7200);
  assert.ok(Math.abs(r.frames.at(-1).dryEnergyJ-r.initialDryEnergyJ)>1e9);
});
test('replay preserves pre/post attachment and late arriving identities without interpolation teleportation',()=>{
  const row=traffic.rows[1],t=row.encounter.capture,pre=sampleOps(traffic,t-1e-4),post=sampleOps(traffic,t);
  assert.equal(pre.attachedId,null);assert.equal(post.attachedId,row.id);assert.equal(pre.cargo.find(c=>c.id===row.id).phase,'approach');assert.equal(post.cargo.find(c=>c.id===row.id).phase,'attached');
  assert.equal(sampleOps(traffic,0).cargo.some(c=>c.id===row.id),false);
  for(const f of traffic.frames)assert.equal(new Set(f.cargo.map(c=>c.id)).size,f.cargo.length);
});
test('chemical hybrid applies a finite inbound exchange before later powered recovery',()=>{
  const p={...coast,horizonHours:4,design:{...DEFAULT,fuelT:40},manifest:coast.manifest.slice(0,4)},r=simulateOps(p);
  assert.ok(r.inbound>=1);const incoming=r.rows[1];assert.ok(r.frames.filter(f=>f.t>r.rows[0].releasedAt&&f.t<incoming.releasedAt).every(f=>!f.powered));
  assert.ok(r.frames.some(f=>f.t>incoming.releasedAt&&f.powered));assert.ok(r.fuelUsedKg>0);
});

test('manifest generator rejects non-finite counts before looping',()=>{
  for(const args of [[Infinity,0,3],[3.5,0,3],[0,0,3],[11,1,3],[1,1,NaN],[1,1,3,Infinity]])assert.throws(()=>makeManifest(...args));
});
test('powered operations retain outcome and resource bill with half steps and doubled quadrature',()=>{
  for(const preset of [OPS_PRESETS[0],OPS_PRESETS[2]]){
    const p={...preset.plan,horizonHours:3},a=simulateOps(p),b=simulateOps(p,{step:1,cells:96});
    assert.equal(a.outbound,b.outbound);assert.equal(a.inbound,b.inbound);assert.equal(a.stop,b.stop);
    assert.ok(Math.abs(a.fuelUsedKg-b.fuelUsedKg)<1);
    assert.ok(Math.abs(a.busEnergyJ-b.busEnergyJ)/Math.max(1,a.busEnergyJ)<.001);
    assert.ok(Math.abs(a.rows[0].energyGainJ/b.rows[0].energyGainJ-1)<1e-6);
  }
});
test('an exact observation-boundary release is processed, not silently left attached',()=>{
  const baseline=simulateOps({...OPS_PRESETS[1].plan,horizonHours:3}),returned=baseline.rows.find(r=>r.status==='returned');
  const r=simulateOps({...OPS_PRESETS[1].plan,horizonHours:returned.releasedAt/3600});
  assert.equal(r.rows.find(row=>row.id===returned.id).status,'returned');assert.equal(r.frames.at(-1).attachedId,null);
});
