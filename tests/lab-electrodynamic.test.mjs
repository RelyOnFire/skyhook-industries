import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,EARTH,validate,compile,initial,rk4,simulate,invariants,resize,loadProfile} from '../.lab-test/simulation/engine.js';
import {studyDesigns,CHALLENGES,challengeGates} from '../.lab-test/simulation/insights.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}, tolerance ${tol}`);

// E0: circuit limits and energy accounting, not validation of plasma collection.
const {EDT_PRESET,forces:bodyForces} = await import('../.lab-test/simulation/engine.js');
const {ED_DEFAULTS,ED_DENSITY,ED_RESISTIVITY,conductorNodes,dipoleField,electrodynamicForces,circuitPower} = await import('../.lab-test/simulation/electrodynamic.js');
test('E0 configuration requires finite caps, no propellant and physically fitting segments',()=>{
  assert.deepEqual(validate(EDT_PRESET),EDT_PRESET);
  for(const edit of [{fuelT:1},{edCurrentA:Infinity},{edPowerKw:-1},{edVoltageKv:NaN},{edLengthKm:101},{edAreaMm2:0},{edHardwareT:0}])
    assert.throws(()=>validate({...EDT_PRESET,...edit}));
  assert.throws(()=>resize(EDT_PRESET),/conductor mass/);
});
test('conductor mass and power hardware enter gravity, inertia and dry mass; not structural capacity',()=>{
  const e=compile(EDT_PRESET,0,false),plain=compile({...EDT_PRESET,recovery:'none'},0,false);
  const mass=2*ED_DENSITY*EDT_PRESET.edLengthKm*1000*EDT_PRESET.edAreaMm2*1e-6;
  near(e.conductorMass,mass,1e-8);near(e.mass-plain.mass,mass+EDT_PRESET.edHardwareT*1000,1e-7);
  near(e.structural,plain.structural,1e-7);near(e.area,plain.area,1e-15);near(e.center,0,1e-8);
  assert.ok(e.inertia>plain.inertia);
  assert.ok(bodyForces(initial(EDT_PRESET),e,EDT_PRESET).electrical.circuits.every(c=>c.current===0));
});
test('dipole field scales inversely with radius cubed and rejects singular inputs',()=>{
  near(dipoleField(EARTH,0)/dipoleField(2*EARTH,0),8,1e-12);
  assert.throws(()=>dipoleField(0,0));assert.throws(()=>dipoleField(NaN,0));
});
test('E0 force is transverse; torque is the sum of its actual distributed moments',()=>{
  const d=EDT_PRESET,y=initial(d),b=compile(d,0,false);y[4]=.3;y[3]-=20;
  const f=bodyForces(y,b,d,true),u=[Math.cos(y[4]),Math.sin(y[4])];
  near(f.tx*u[0]+f.ty*u[1],0,1e-8);near(f.flow,0,0);
  let fx=0,fy=0,torque=0;
  for(let i=0;i<b.conductors.length;i++){
    const q=b.conductors[i].s-b.center,[a,z]=f.electrical.nodeForces[i];fx+=a;fy+=z;torque+=q*(u[0]*z-u[1]*a);
  }
  near(fx,f.tx,1e-9);near(fy,f.ty,1e-9);near(torque,f.tt,1e-6);
});
test('E0 keeps voltage, current and total electrical draw inside each cap',()=>{
  const nodes=conductorNodes(100000,50000,16);
  for(let j=0;j<20;j++) {
    const state={x:EARTH+700000,y:10000*j,vx:300,vy:7500,theta:j*.31,omega:.008,center:0};
    const cfg={...ED_DEFAULTS,edPowerKw:10+j*10,edVoltageKv:5+j,edCurrentA:2+j};
    const f=electrodynamicForces(state,nodes,cfg,{fx:1e5,fy:-1e5,torque:3e8},true);
    assert.ok(f.busW<=cfg.edPowerKw*1000+1e-6);
    for(const c of f.circuits){assert.ok(Math.abs(c.current)<=cfg.edCurrentA+1e-8);assert.ok(Math.abs(c.voltage)<=cfg.edVoltageKv*1000+1e-6);}
    near(f.busW+f.environmentW-f.mechanicalW-f.heatW,0,1e-7);
  }
});
test('generating intervals dump energy, never claim negative supply consumption',()=>{
  const p=circuitPower(-2,1000,10);
  assert.equal(p.busW,0);assert.ok(p.dumpW>0);
  near(p.busW+2000-p.ohmicW-p.contactW-p.converterW-p.dumpW,0,1e-10);
});
test('zero power, zero current, zero voltage and disabled circuits cannot supply hidden forces',()=>{
  const y=initial(EDT_PRESET);y[3]-=100;y[5]*=.8;
  for(const edit of [{edPowerKw:0},{edCurrentA:0},{edVoltageKv:0}]){
    const d={...EDT_PRESET,...edit},f=bodyForces(y,compile(d,0,false),d,true);
    for(const x of [f.tx,f.ty,f.tt,f.flow,f.electrical.busW])near(x,0,1e-10);
  }
  const f=bodyForces(y,compile(EDT_PRESET,0,false),EDT_PRESET,false);
  near(f.tx,0,1e-10);near(f.ty,0,1e-10);near(f.tt,0,1e-10);
});
test('force/work ledger agrees with the change in extended-body mechanical energy',()=>{
  const d=EDT_PRESET;let y=initial(d);y[0]-=10000;y[3]-=30;y[5]*=.99;
  const b=compile(d,0,false),before=invariants(y,b);
  for(let t=0;t<120;t+=.5)y=rk4(y,.5,d,false,true);
  const after=invariants(y,b);
  near(after.energy-before.energy,y[9],.1);
  near(y[8]+y[11]-y[9]-y[10],0,1e-4);
});
test('E0 transverse force has no spurious axial component; added conductor mass loads the strength tether',()=>{
  const d=EDT_PRESET,y=initial(d);y[0]-=10000;y[3]-=20;y[5]*=.9;
  const b=compile(d,0,false),active=loadProfile(y,b,d,true),idle=loadProfile(y,b,d,false);
  assert.ok(active.every(c=>Number.isFinite(c.stress)));
  active.forEach((c,i)=>near(c.stress,idle[i].stress,.01));
  const without={...d,recovery:'none'};
  assert.ok(Math.max(...active.map(c=>c.stress))>Math.max(...loadProfile(y,compile(without,0,false),without,false).map(c=>c.stress)));
  const f=bodyForces(y,b,d,true);assert.ok(Math.hypot(f.tx,f.ty)>0&&f.electrical.busW>0);
});
test('powered-conductor example completes both checked approaches with zero fuel and a balanced ledger',()=>{
  const r=simulate(EDT_PRESET);assert.equal(r.outcome,'complete');assert.equal(r.rendezvous.length,2);
  assert.ok(r.rendezvous.every(c=>c.accepted));assert.equal(r.fuelUsed,0);assert.ok(r.electricalEnergyJ>0);
  assert.ok(r.frames.every(f=>f.fuel===0&&f.electrical.busW<=r.design.edPowerKw*1000+1e-6));
  near(r.electricalEnergyJ+r.environmentEnergyJ-r.electricalWorkJ-r.electricalHeatJ,0,.01);
  assert.ok(r.events.some(e=>e.title==='Electrodynamic recovery begins'));
});
test('E0 convergence: half step and doubled conductor/mass quadrature retain outcome and budget',()=>{
  const a=simulate(EDT_PRESET),b=simulate(EDT_PRESET,{step:1,cells:96});
  assert.equal(a.outcome,b.outcome);near(a.electricalEnergyJ/b.electricalEnergyJ,1,.003);
  near(a.deliveries[1].apogee/b.deliveries[1].apogee,1,.001);
  near(a.rendezvous[1].t/b.rendezvous[1].t,1,.001);
});
test('a power sweep preserves conductor mass and never rewrites the input design',()=>{
  const original=JSON.stringify(EDT_PRESET),variants=studyDesigns(EDT_PRESET,'electrical');
  assert.equal(variants.length,4);
  const m=compile(EDT_PRESET,0,false).mass;
  for(const v of variants){validate(v.design);near(compile(v.design,0,false).mass,m,1e-8);assert.equal(v.design.fuelT,0);}
  assert.equal(JSON.stringify(EDT_PRESET),original);
});
test('new electrical inputs and the active recovery choice survive URL/file round trips',async()=>{
  const {readDesign,designFragment}=await import('../.lab-test/simulation/design-io.js');
  const d={...EDT_PRESET,edCurrentA:37,edPowerKw:850,edAreaMm2:23};
  assert.deepEqual(readDesign(JSON.stringify(d)).design,d);
  assert.deepEqual(readDesign(new URLSearchParams(designFragment(d).slice(1)).get('d')).design,d);
});
test('old 0.3 imports require review and add no hidden electrical system to coast or chemical',async()=>{
  const {readDesign}=await import('../.lab-test/simulation/design-io.js');
  for(const recovery of ['chemical','none']) {
    const old={...DEFAULT,model:'D1p-0.3.0',recovery,fuelT:recovery==='chemical'?20:0};
    for(const key of Object.keys(ED_DEFAULTS))delete old[key];
    const migrated=readDesign(JSON.stringify(old));assert.equal(migrated.needsConfirmation,true);
    assert.equal(migrated.design.recovery,recovery);assert.equal(compile(migrated.design,0,false).conductorMass,0);
    assert.match(migrated.explanation,/no electrical hardware/i);
  }
});
test('legacy flight-school constraints do not award E0 assumption-based experiments a historical challenge pass',()=>{
  const r=simulate(DEFAULT),c=CHALLENGES[0];
  assert.equal(challengeGates(c,{...r,design:{...r.design,recovery:'electrodynamic',fuelT:0}})[0].pass,false);
});
