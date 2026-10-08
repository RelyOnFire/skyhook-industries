import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, MODEL, LUNAR_DEFAULT, LUNAR_MODEL, LUNAR_PRESETS, MOON_ENV, EARTH_ENV,
  environment, validate, gravity, initial, compile, rk4, particleStep, invariants,
  orbit, clearance, pointState, reframe, simulate, resize } from '../.lab-test/simulation/engine.js';
import { CHALLENGES, challengeGates, deliveries, readiness, studyDesigns } from '../.lab-test/simulation/insights.js';
import { readDesign, designFragment } from '../.lab-test/simulation/design-io.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}, tolerance ${tol}`);
const moon=MOON_ENV, d=LUNAR_DEFAULT, run=simulate(d);

test('lunar environment agrees with analytic circular and eccentric Kepler orbits',()=>{
  assert.equal(moon.mu,4.902800118e12);assert.equal(moon.radius,1737400);
  assert.equal(environment(DEFAULT),EARTH_ENV);assert.equal(environment(d),moon);
  const r=moon.radius+250000,v=Math.sqrt(moon.mu/r),period=2*Math.PI*Math.sqrt(r**3/moon.mu);
  const y=initial(d);near(y[0],r,1e-9);near(y[3],v,1e-9);
  near(gravity(r,0,moon)[0],-moon.mu/r**2,1e-12);
  const circular=orbit([r,0,0,v],moon);
  near(circular.perigee,250000,.1);near(circular.apogee,250000,.1);near(circular.energy,-moon.mu/(2*r),1e-8);
  const ra=moon.radius+1000000,a=(r+ra)/2,ellipse=orbit([r,0,0,Math.sqrt(moon.mu*(2/r-1/a))],moon);
  near(ellipse.perigee,r-moon.radius,1e-6);near(ellipse.apogee,ra-moon.radius,1e-6);
  let p=[r,0,0,v];for(let t=0;t<period;){const h=Math.min(2,period-t);p=particleStep(p,h,moon);t+=h;}
  near(p[0],r,.001);near(p[1],0,.001);near(p[2],0,1e-6);near(p[3],v,1e-6);
});

test('lunar extended-body coast conserves energy and angular momentum through an orbit',()=>{
  let y=initial(d);const b=compile(d,y[6],false),before=invariants(y,b,moon);
  const period=2*Math.PI*Math.sqrt((moon.radius+d.altitudeKm*1000)**3/moon.mu);
  for(let t=0;t<period;){const h=Math.min(2,period-t);y=rk4(y,h,d,false,false);t+=h;}
  const after=invariants(y,b,moon);near(after.energy/before.energy,1,2e-9);near(after.angular/before.angular,1,2e-9);
});

test('lunar ideal capture and release conserve exchanged energy, momentum and physical points',()=>{
  for(const loaded of [false,true]){
    const y=initial(d),b=compile(d,y[6],loaded),next=compile(d,y[6],!loaded);
    const p=pointState(y,b,b.half),z=reframe(y,b,next),before=invariants(y,b,moon),after=invariants(z,next,moon);
    const m=(loaded?-1:1)*d.payloadT*1000;
    near(after.px,before.px+m*p[2],1e-5);near(after.py,before.py+m*p[3],1e-5);
    near((after.energy-before.energy)/(m*orbit(p,moon).energy),1,1e-11);
    near((after.angular-before.angular)/(m*(p[0]*p[3]-p[1]*p[2])),1,1e-11);
    for(const s of [-b.half,0,b.half])pointState(y,b,s).forEach((v,i)=>near(v,pointState(z,next,s)[i],1e-7));
  }
});

test('lunar clearance includes the interior and uses its own cutoff for sizing and flight',()=>{
  const b=compile(d,0,false),y=[moon.radius+5000,0,0,0,Math.PI/2,0,0,0];
  near(clearance(y,b,moon),5000,1e-6);
  assert.ok(Math.hypot(...pointState(y,b,b.half).slice(0,2))-moon.radius>5000);
  assert.throws(()=>resize({...d,altitudeKm:105}),/Raise the orbit/);
  assert.ok(resize(d)>=5);
  assert.ok(run.minClearance>moon.cutoff&&run.minClearance<EARTH_ENV.cutoff);
  assert.equal(run.outcome,'complete');assert.equal(deliveries(run).length,2);
});

test('lunar mission completes two distinct checked approaches and spends finite propellant',()=>{
  assert.equal(run.model,LUNAR_MODEL);assert.equal(run.dryMass,49600);
  assert.ok(run.fuelUsed>0&&run.fuelUsed<d.fuelT*1000);assert.ok(run.minMargin>1);
  assert.deepEqual(run.rendezvous.map(c=>c.payloadId),[1,2]);
  for(const a of run.approaches){
    const check=run.rendezvous.find(c=>c.payloadId===a.payloadId);
    assert.ok(check.accepted&&check.positionErrorM<2&&check.velocityErrorMs<.02);
    near(a.captureTime-a.startTime,90,1e-6);
    let p=[...a.initialState],t=a.startTime;
    for(const frame of run.frames.filter(f=>f.incomingId===a.payloadId)){
      while(t<frame.t-1e-9){const h=Math.min(2,frame.t-t);p=particleStep(p,h,moon);t+=h;}
      p.forEach((v,i)=>near(v,frame.incoming[i],i<2?.01:1e-5));
    }
  }
  // Each released shipment follows its own Moon-centered orbit throughout the remaining replay.
  for(let id=0;id<2;id++){
    const frames=run.frames.filter(f=>f.payloads[id]);let p=[...frames[0].payloads[id]],t=frames[0].t;
    for(const frame of frames){
      while(t<frame.t-1e-9){const h=Math.min(2,frame.t-t);p=particleStep(p,h,moon);t+=h;}
      p.forEach((v,i)=>near(v,frame.payloads[id][i],i<2?.05:1e-4));
    }
  }
  const mission=CHALLENGES.find(c=>c.id==='lunar-relay');
  assert.ok(challengeGates(mission,run).every(g=>g.pass));
  assert.ok(challengeGates(CHALLENGES[0],run).some(g=>!g.pass));
  assert.deepEqual(readiness(run).map(g=>g.limit),[2,2,3,.5]);
});

test('lunar failure presets expose physical limits and cannot earn mission completion',()=>{
  const mission=CHALLENGES.find(c=>c.id==='lunar-relay');
  for(const preset of LUNAR_PRESETS.slice(1)){
    const r=simulate(preset.design);assert.equal(r.outcome,'limit');
    assert.ok(challengeGates(mission,r).some(g=>!g.pass));
    if(preset.id==='lunar-load'){assert.ok(r.minMargin<1);assert.equal(r.deliveries.length,0);}
    else{assert.ok(r.minClearance<moon.cutoff);assert.match(r.reason,/10 km lunar/);}
    if(preset.id==='lunar-coast'){assert.equal(r.fuelUsed,0);assert.equal(r.deliveries.length,1);assert.equal(r.approaches.length,1);}
  }
});

test('lunar delivered orbits and recovery converge with smaller steps and finer mass quadrature',()=>{
  const fine=simulate(d,{step:1,cells:96});assert.equal(fine.outcome,'complete');
  near(run.fuelUsed/fine.fuelUsed,1,.005);near(run.minClearance/fine.minClearance,1,.001);
  run.deliveries.forEach((o,i)=>{near(o.gain/fine.deliveries[i].gain,1,.001);near(o.apogee/fine.deliveries[i].apogee,1,.005);});
  const finer=simulate(d,{step:.5,cells:96});
  near(fine.fuelUsed/finer.fuelUsed,1,.001);near(fine.deliveries[1].apogee/finer.deliveries[1].apogee,1,.001);
});

test('saved designs keep the declared body and reject mixed models or Earth-only lunar actuators',()=>{
  for(const design of [DEFAULT,d,...LUNAR_PRESETS.map(p=>p.design)]){
    assert.deepEqual(readDesign(JSON.stringify(design)).design,design);
    const raw=new URLSearchParams(designFragment(design).slice(1)).get('d');
    assert.deepEqual(readDesign(raw),{design,needsConfirmation:false,explanation:''});
  }
  for(const edit of [{model:MODEL},{architecture:DEFAULT.architecture},{recovery:'electrodynamic',fuelT:0},{altitudeKm:79},{tipSpeedKms:1.6},{spanKm:1201}])assert.throws(()=>validate({...d,...edit}));
  assert.throws(()=>readDesign(JSON.stringify({...d,model:'D1p-0.2.0'})),/do not match/);
  assert.throws(()=>validate({...DEFAULT,model:LUNAR_MODEL}));
  assert.equal(validate(DEFAULT).model,MODEL);
});

test('lunar studies preserve their environment and cannot schedule the Earth E0 field',()=>{
  const copy=JSON.stringify(d);
  assert.deepEqual(studyDesigns(d,'recovery').map(c=>c.design.recovery),['none','chemical']);
  assert.throws(()=>studyDesigns(d,'electrical'),/Earth E0/);
  for(const kind of ['recovery','material','release','payload'])for(const candidate of studyDesigns(d,kind)){
    assert.equal(validate(candidate.design).model,LUNAR_MODEL);assert.equal(environment(candidate.design),moon);
  }
  assert.equal(JSON.stringify(d),copy);
});
