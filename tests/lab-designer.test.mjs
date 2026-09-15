import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,EARTH,MU,compile,initial,forces,loadProfile,loadCheck,orbit} from '../.lab-test/simulation/engine.js';
import {GEOMETRY_DEFAULT as D,GEOMETRY_PRESETS as P,validateGeometry,readGeometry,geometryFragment,
  compileGeometry,initialGeometry,areaAt,geometryPoint,geometryForces,geometryStep,
  geometryInvariants,geometryClearance,geometryLoads,orbitReference,simulateGeometry,sampleGeometry} from '../.lab-test/simulation/designer.js';
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b} by ${Math.abs(a-b)} (tolerance ${t})`);

test('G1 validates bounded finite geometry, ordered orbit elements and a capped observation',()=>{
  assert.equal(validateGeometry(D).armAKm,300);
  for(const edit of [{armAKm:NaN},{hubT:-1},{endAT:0},{apogeeKm:100},{spinPeriodMin:0},{density:Infinity},
    {armAKm:2500,armBKm:2500},{perigeeKm:2000,apogeeKm:1000},{perigeeKm:30000,apogeeKm:50000,turns:2},
    {model:'D1p-0.4.0'},{shape:'not a cable'},{material:'fiction'}])assert.throws(()=>validateGeometry({...D,...edit}));
  for(const input of [null,[],3])assert.throws(()=>validateGeometry(input));
  for(const options of [{step:0},{step:5},{step:Infinity},{cells:4},{cells:48.5}])assert.throws(()=>simulateGeometry(D,options));
});
test('G1 imports and sharing keep a separate model; legacy files do not silently change meaning',()=>{
  const d={...P[2].design,anomalyDeg:37,attitudeDeg:129,shape:'tapered'},clean=validateGeometry(d);
  assert.deepEqual(readGeometry(JSON.stringify(d)),clean);
  assert.deepEqual(readGeometry(new URLSearchParams(geometryFragment(d).slice(1)).get('g')),clean);
  assert.throws(()=>readGeometry(JSON.stringify(DEFAULT)),/different models/);
  assert.throws(()=>readGeometry(' '.repeat(16001)),/16 KB/);
  assert.equal(validateGeometry({...D,arbitrary:'discarded'}).arbitrary,undefined);
});
test('symmetric G1 recovers the same D1p dry mass, inertia, state, forces and axial loads',()=>{
  const old={...DEFAULT,recovery:'none',fuelT:0},b=compileGeometry(D),plain=compile(old,0,false),y=initialGeometry(D);
  near(b.mass,plain.mass,1e-8);near(b.center,plain.center,1e-9);near(b.inertia,plain.inertia,1);
  initial(old).slice(0,6).forEach((v,i)=>near(y[i],v,1e-12));
  const f=geometryForces(y,b),g=forces([...y,0,0],plain,old,false);
  near(f.ax,g.ax,1e-12);near(f.ay,g.ay,1e-12);near(f.alpha,g.alpha,1e-15);
  const a=geometryLoads(y,b,D),z=loadCheck([...y,0,0],plain,old,false);near(a.margin,z.margin,1e-10);
  const cuts=loadProfile([...y,0,0],plain,old,false);a.cuts.forEach((c,i)=>{near(c.stress,cuts[i].stress,1e-4);near(c.tension,cuts[i].tension,1e-8);});
});
test('asymmetric mass centroid follows analytic uniform mass moments, not the hardware hub',()=>{
  const d=P[1].design,b=compileGeometry(d),la=d.armAKm*1000,lb=d.armBKm*1000,rho=1560,linear=rho*d.areaMm2*1e-6;
  const cable=linear*(la+lb),mass=cable+(d.hubT+d.endAT+d.endBT)*1000;
  const moment=linear*(lb*lb-la*la)/2-d.endAT*1000*la+d.endBT*1000*lb;
  near(b.mass,mass,1e-7);near(b.center,moment/mass,1e-8);assert.ok(Math.abs(b.center)>100000);
  const continuousI=linear*(la**3+lb**3)/3+d.endAT*1000*la**2+d.endBT*1000*lb**2-mass*b.center**2;
  near(b.inertia/continuousI,1,.001);
  const y=initialGeometry(d),hub=geometryPoint(y,b,0);
  near(Math.hypot(hub[0]-y[0],hub[1]-y[1]),Math.abs(b.center),1e-7);
  near(b.points.reduce((sum,p)=>sum+p.m*(geometryPoint(y,b,p.s)[0]-y[0]),0),0,.1);
});
test('moving terminal ballast changes the centroid but never moves or resizes either input arm',()=>{
  const original=JSON.stringify(P[1].design),a=compileGeometry(P[1].design),d={...P[1].design,endAT:80},b=compileGeometry(d);
  assert.ok(b.center<a.center);assert.equal(a.min,b.min);assert.equal(a.max,b.max);assert.equal(JSON.stringify(P[1].design),original);
});
test('taper is referenced independently to each hub-to-tip length and stays positive',()=>{
  const d={...P[1].design,shape:'tapered'},a=d.areaMm2*1e-6,b=compileGeometry(d);
  near(areaAt(d,0),a,1e-16);near(areaAt(d,b.min),.3*a,1e-16);near(areaAt(d,b.max),.3*a,1e-16);
  assert.ok(b.points.every(p=>areaAt(d,p.s)>0));assert.ok(b.structuralMass<compileGeometry({...d,shape:'uniform'}).structuralMass);
});
test('mirror geometry plus a half-turn preserves physical masses, gravity and inertia',()=>{
  const a=P[1].design,b={...a,armAKm:a.armBKm,armBKm:a.armAKm,endAT:a.endBT,endBT:a.endAT,attitudeDeg:0};
  const ba=compileGeometry(a),bb=compileGeometry(b),fa=geometryForces(initialGeometry(a),ba),fb=geometryForces(initialGeometry(b),bb);
  near(ba.center,-bb.center,1e-8);near(ba.inertia,bb.inertia,4);near(fa.ax,fb.ax,1e-12);near(fa.ay,fb.ay,1e-12);near(fa.alpha,fb.alpha,1e-15);
});
test('elliptical initial conditions recover both prescribed apses, eccentricity and vis-viva speed',()=>{
  const d=P[2].design,ref=orbitReference(d);
  for(const angle of [0,35,90,180,270]){
    const y=initialGeometry({...d,anomalyDeg:angle}),o=orbit(y),r=Math.hypot(y[0],y[1]);
    near(o.perigee,d.perigeeKm*1000,.0001);near(o.apogee,d.apogeeKm*1000,.0001);
    near(y[2]**2+y[3]**2,MU*(2/r-1/ref.a),1e-7);
    near(y[4],(angle+d.attitudeDeg)*Math.PI/180,1e-14);
  }
  const per=initialGeometry(d),apo=initialGeometry({...d,anomalyDeg:180});assert.ok(Math.hypot(per[2],per[3])>Math.hypot(apo[2],apo[3]));
});
test('distributed force is the potential-energy gradient and torque is its attitude derivative',()=>{
  const d={...P[2].design,anomalyDeg:35,attitudeDeg:107},b=compileGeometry(d),y=initialGeometry(d),f=geometryForces(y,b);
  for(const [i,h,wanted] of [[0,1,-f.ax*b.mass],[1,1,-f.ay*b.mass],[4,1e-5,-f.alpha*b.inertia]]){
    const a=[...y],z=[...y];a[i]+=h;z[i]-=h;const derivative=(geometryInvariants(a,b).energy-geometryInvariants(z,b).energy)/(2*h);
    near(derivative,wanted,Math.abs(wanted)*2e-6+.01);
  }
});
test('coast agrees with independently implemented SciPy DOP853 at a non-radial, non-apsidal state',()=>{
  const ref=JSON.parse(readFileSync(new URL('./fixtures/geometry-reference.json',import.meta.url))),d={...P[2].design,...ref.designChanges},b=compileGeometry(d,ref.cells);
  let y=initialGeometry(d);y.forEach((v,i)=>near(v,ref.initial[i],1e-8));
  for(let t=0;t<ref.time;t+=1)y=geometryStep(y,1,b);
  y.forEach((v,i)=>near(v,ref.final[i],i<2?.001:i<4?1e-6:i===4?1e-8:1e-10));
});
test('all offered experiments complete a finite unpowered coast with conservative E/H accounting',()=>{
  for(const p of P){const before=JSON.stringify(p.design),r=simulateGeometry(p.design);assert.equal(JSON.stringify(p.design),before);
    assert.equal(r.outcome,'observed');near(r.frames.at(-1).t,r.requestedSeconds,1e-6);
    assert.ok(r.maxEnergyError/Math.abs(r.initialEnergy)<1e-10);assert.ok(r.maxAngularError/Math.abs(r.initialAngular)<1e-10);
    assert.ok(r.minMargin>1&&r.minClearance>120000);assert.ok(r.frames.every(f=>f.state.length===6&&f.state.every(Number.isFinite)));
  }
});
test('the whole segment is checked for clearance, not only the tips',()=>{
  const b=compileGeometry(D),y=[EARTH+119000,0,0,0,Math.PI/2,0];
  assert.ok(Math.hypot(...geometryPoint(y,b,b.min).slice(0,2))-EARTH>120000);
  near(geometryClearance(y,b),119000,1e-8);
});
test('unsafe initial geometry or strength stops honestly with no completed orbit claim',()=>{
  const low=simulateGeometry({...D,perigeeKm:200,apogeeKm:200});assert.equal(low.outcome,'limit');assert.equal(low.frames[0].t,0);assert.match(low.reason,/120 km/);
  const weak=simulateGeometry({...D,spinPeriodMin:4});assert.equal(weak.outcome,'limit');assert.match(weak.reason,/axial allowable/);
  const slack=simulateGeometry({...D,attitudeDeg:90,spinPeriodMin:240});assert.equal(slack.outcome,'limit');assert.match(slack.reason,/compression/);
});
test('a descending low-perigee ellipse splits the step at the cable clearance cutoff',()=>{
  const r=simulateGeometry({...D,armAKm:150,armBKm:150,perigeeKm:200,apogeeKm:1000,anomalyDeg:180,spinPeriodMin:20});
  assert.equal(r.outcome,'limit');assert.ok(r.frames.at(-1).t>0);assert.match(r.reason,/120 km/);near(r.minClearance,120000,.1);
});
test('smaller timestep and refined mass quadrature preserve outcomes and bound trajectory changes',()=>{
  for(const shape of ['uniform','tapered']){
    const d={...P[2].design,shape,turns:.5},a=simulateGeometry(d),b=simulateGeometry(d,{step:1}),c=simulateGeometry(d,{step:1,cells:96});
    assert.equal(a.outcome,b.outcome);assert.equal(a.outcome,c.outcome);
    near(a.frames.at(-1).state[0],b.frames.at(-1).state[0],.02);
    near(a.minMargin/c.minMargin,1,.015);near(a.minClearance,c.minClearance,100);
    assert.ok(b.maxEnergyError<a.maxEnergyError+.01);
  }
});
test('replay sampling preserves the recorded calculation and rejects non-finite time',()=>{
  const r=simulateGeometry({...P[2].design,turns:.25}),before=JSON.stringify(r);
  for(const t of [0,2,17,58.4,r.requestedSeconds]){const f=sampleGeometry(r,t);near(f.energy,r.initialEnergy,1);assert.ok(f.state.every(Number.isFinite));}
  assert.equal(JSON.stringify(r),before);assert.deepEqual(sampleGeometry(r,-1),r.frames[0]);assert.deepEqual(sampleGeometry(r,1e20),r.frames.at(-1));assert.throws(()=>sampleGeometry(r,NaN));
});

test('tapered terminal load is checked at the actual narrow tip, not a cell midpoint',()=>{
  const d={...P[2].design,shape:'tapered'},b=compileGeometry(d),load=geometryLoads(initialGeometry(d),b,d);
  assert.equal(load.cuts[0].s,b.min);near(load.cuts[0].area,d.areaMm2*1e-6*.3,1e-16);
});
