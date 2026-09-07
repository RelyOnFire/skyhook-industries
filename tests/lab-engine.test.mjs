import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,MODEL,MU,EARTH,validate,compile,initial,rk4,simulate,pointState,reframe,invariants,orbit,resize,clearance} from '../.lab-test/simulation/engine.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}, tolerance ${tol}`);
test('untrusted designs: finite bounds, enums, version; never silently migrate',()=>{
  assert.deepEqual(validate(DEFAULT),DEFAULT);
  for(const p of [{spanKm:Infinity},{density:-5},{fuelT:NaN},{recovery:'electrodynamic'},{model:'unknown'},{schema:999},{areaMm2:0}])assert.throws(()=>validate({...DEFAULT,...p}));
  assert.equal(Object.hasOwn(validate({...DEFAULT,html:'<script>'}),'html'),false);
});
test('compiled mass and inertia follow uniform physical geometry',()=>{
  const b=compile(DEFAULT,0,false,96);near(b.structural,1560*80e-6*600000,1e-7);near(b.center,0,1e-8);
  const expected=b.structural*600000**2/12+4000*300000**2;near(b.inertia/expected,1,0.00012);
});
test('matched capture preserves every pre-existing point and momentum accounting',()=>{
  const y=initial(DEFAULT),b=compile(DEFAULT,y[6],false),next=compile(DEFAULT,y[6],true),p=pointState(y,b,b.half),z=reframe(y,b,next),a=invariants(y,b),n=invariants(z,next),m=DEFAULT.payloadT*1000;
  for(const s of [-b.half,0,b.half])pointState(y,b,s).forEach((v,i)=>near(v,pointState(z,next,s)[i],1e-7));
  near(a.px+m*p[2],n.px,1e-5);near(a.py+m*p[3],n.py,1e-5);
  near((n.angular-a.angular)/(m*(p[0]*p[3]-p[1]*p[2])),1,1e-12);
  near((n.energy-a.energy)/(m*orbit(p).energy),1,1e-11);
});
test('release conserves total energy/angular momentum and point continuity',()=>{
  const y=initial(DEFAULT),b=compile(DEFAULT,y[6],true),next=compile(DEFAULT,y[6],false),p=pointState(y,b,b.half),z=reframe(y,b,next),a=invariants(y,b),n=invariants(z,next),m=DEFAULT.payloadT*1000;
  near((n.energy+m*orbit(p).energy)/a.energy,1,1e-12);near((n.angular+m*(p[0]*p[3]-p[1]*p[2]))/a.angular,1,1e-12);
  pointState(y,b,0).forEach((v,i)=>near(v,pointState(z,next,0)[i],1e-7));
});
test('extended-body coast conserves energy and angular momentum over one orbit',()=>{
  let y=initial(DEFAULT);const b=compile(DEFAULT,y[6],false),before=invariants(y,b);
  for(let t=0;t<7200;t+=2)y=rk4(y,2,DEFAULT,false,false);
  const after=invariants(y,b);near(after.energy/before.energy,1,2e-9);near(after.angular/before.angular,1,2e-9);
});
test('segment clearance checks the interior, not just endpoints',()=>{
  const d={...DEFAULT,spanKm:4000},b=compile(d,0,false);const y=[EARTH-1000,0,0,0,Math.PI/2,0,0,0];
  assert.ok(Math.hypot(...pointState(y,b,b.half).slice(0,2))>EARTH);near(clearance(y,b),-1000,1e-6);
});
test('default achieves two deliveries with finite propellant; no reboost does not',()=>{
  const r=simulate(DEFAULT);assert.equal(r.outcome,'complete');assert.equal(r.deliveries.length,2);assert.ok(r.fuelUsed>0&&r.fuelUsed<DEFAULT.fuelT*1000);
  assert.ok(r.minMargin>1&&r.minClearance>120000);assert.ok(r.events.some(e=>e.kind==='ready'));
  const n=simulate({...DEFAULT,recovery:'none',fuelT:0});assert.equal(n.deliveries.length,1);assert.equal(n.fuelUsed,0);assert.equal(n.outcome,'incomplete');
});
test('low material margin stops the run instead of continuing a fictional flight',()=>{
  const r=simulate({...DEFAULT,material:'kevlar',areaMm2:35,payloadT:5});assert.equal(r.outcome,'limit');assert.ok(r.minMargin<1);assert.equal(r.deliveries.length,0);
});
test('fixed-area material change changes mass; resize is separate',()=>{
  const z=compile(DEFAULT,0,false),k=compile({...DEFAULT,material:'kevlar'},0,false);assert.notEqual(z.mass,k.mass);assert.equal(z.area,k.area);
  const a=resize(DEFAULT);assert.ok(a>=5&&a<=2500);assert.equal(DEFAULT.areaMm2,80);
});
test('time-step and mass-quadrature convergence on the complete mission',()=>{
  const a=simulate(DEFAULT),b=simulate(DEFAULT,{step:1,cells:96});assert.equal(a.outcome,b.outcome);near(a.fuelUsed/b.fuelUsed,1,0.005);
  near(a.deliveries[0].gain/b.deliveries[0].gain,1,0.0001);near(a.deliveries[1].apogee/b.deliveries[1].apogee,1,0.001);
});
test('invalid numerical settings and unsupported circulation reject explicitly',()=>{
  assert.throws(()=>simulate(DEFAULT,{step:0}));assert.throws(()=>simulate({...DEFAULT,spanKm:4000,tipSpeedKms:0.25}));
});
test('independent SciPy DOP853 coast reference agrees with the browser RK4 core',async()=>{
  const {readFile}=await import('node:fs/promises');const fixture=JSON.parse(await readFile(new URL('./fixtures/lab-coast.json',import.meta.url),'utf8'));
  let y=initial(DEFAULT);for(let t=0;t<fixture.duration;t+=2)y=rk4(y,2,DEFAULT,false,false);
  y.slice(0,6).forEach((v,i)=>near(v,fixture.state[i],i<2?.1:i<4?1e-4:i===4?1e-6:1e-9));
});

// Payload range is an input envelope, never a statement of physical feasibility.
test('extended payload range is accepted through 250 t, with finite initial loads',()=>{
  for (const payloadT of [20,50,100,250]) {
    const d=validate({...DEFAULT,payloadT}); const b=compile(d,0,true);
    assert.ok(Number.isFinite(b.mass)&&Number.isFinite(b.inertia));
    const run=simulate(d,{horizon:120});
    assert.ok(run.frames.length>0);
    assert.ok(run.frames.every(f=>f.state.every(Number.isFinite)));
  }
  assert.throws(()=>validate({...DEFAULT,payloadT:250.1}));
  assert.throws(()=>validate({...DEFAULT,payloadT:0}));
});
test('coast has no hidden propellant mass or chemical thrust',()=>{
  assert.throws(()=>validate({...DEFAULT,recovery:'none',fuelT:20}));
  const d=validate({...DEFAULT,recovery:'none',fuelT:0}),r=simulate(d);
  assert.equal(initial(d)[6],0);assert.equal(r.fuelUsed,0);
  assert.ok(r.frames.every(f=>f.fuel===0&&!f.burn));
});
test('catalogue-only architectures cannot masquerade as runnable rotovators',()=>{
  for(const architecture of ['t4','mxer','cislunar','hoytether']) assert.throws(()=>validate({...DEFAULT,architecture}));
});

test('saved designs round-trip at both payload range extremes', async () => {
  const { readDesign, designFragment } = await import('../.lab-test/simulation/design-io.js');
  for (const payloadT of [.1, 20, 100, 250]) {
    const d = { ...DEFAULT, payloadT };
    const raw = new URLSearchParams(designFragment(d).slice(1)).get('d');
    const imported = readDesign(raw);
    assert.equal(imported.needsConfirmation, false);
    assert.deepEqual(imported.design, d);
  }
});

test('legacy coast imports require confirmation and explicitly remove old dead fuel', async () => {
  const { readDesign } = await import('../.lab-test/simulation/design-io.js');
  const old = { ...DEFAULT, schema: 1, model: 'D1p-0.1.0', recovery: 'none', fuelT: 20 };
  delete old.architecture;
  const migrated = readDesign(JSON.stringify(old));
  assert.equal(migrated.needsConfirmation, true);
  assert.equal(migrated.design.fuelT, 0);
  assert.equal(migrated.design.schema, 2);
  assert.match(migrated.explanation, /removes that fuel mass/);
  assert.equal(old.fuelT, 20); // No mutation of the imported source.
});

test('imports reject malformed data, unsupported models and unimplemented architecture ids', async () => {
  const { readDesign } = await import('../.lab-test/simulation/design-io.js');
  for (const text of ['{', 'null', '[]', ' '.repeat(16001), JSON.stringify({ ...DEFAULT, payloadT: 251 }),
    JSON.stringify({ ...DEFAULT, model: 'D1p-future' }), JSON.stringify({ ...DEFAULT, architecture: 't4' })]) {
    assert.throws(() => readDesign(text));
  }
});

test('architecture catalogue never marks an unsupported solver as runnable', async () => {
  const { ARCHITECTURES } = await import('../.lab-test/simulation/catalogue.js');
  const runnable = ARCHITECTURES.filter(a => a.availability === 'runnable');
  assert.equal(runnable.length, 1);
  assert.equal(runnable[0].id, DEFAULT.architecture);
  assert.match(ARCHITECTURES.find(a => a.id === 't4').topology, /pivot/);
  assert.equal(ARCHITECTURES.find(a => a.id === 'hoytether').category, 'Structural construction');
  assert.equal(new Set(ARCHITECTURES.map(a => a.id)).size, ARCHITECTURES.length);
});

// Flight school interprets the same numerical results, never a separate arcade model.
const { CHALLENGES, challengeGates, diagnose, deliveries: goodDeliveries, studyDesigns,
  designChanges, readiness } = await import('../.lab-test/simulation/insights.js');
const { loadProfile, loadCheck, properties } = await import('../.lab-test/simulation/engine.js');
test('each mission has a failing starting state and a reachable passing solution',()=>{
  const solutions=[DEFAULT,{...DEFAULT,payloadT:5,areaMm2:45},{...DEFAULT,fuelT:12,areaMm2:45,releaseDeg:210}];
  CHALLENGES.forEach((c,i)=>{
    const start=simulate(c.start),solution=simulate(solutions[i]);
    assert.ok(challengeGates(c,start).some(g=>!g.pass),`${c.id} starting state must teach a trade`);
    assert.ok(challengeGates(c,solution).every(g=>g.pass),`${c.id}: ${JSON.stringify(challengeGates(c,solution))}`);
  });
});
test('mission checks reject changed payload, hypothetical materials, excess fuel and low delivered orbit',()=>{
  const r=simulate(DEFAULT),mission=CHALLENGES[0];
  for(const edit of [{payloadT:1},{material:'future'},{fuelT:21},{altitudeKm:1700}]){
    assert.ok(challengeGates(mission,{...r,design:{...r.design,...edit}}).some(g=>!g.pass));
  }
  const lowOrbit={...r,deliveries:r.deliveries.map(d=>({...d,apogee:7000000}))};
  assert.ok(!challengeGates(mission,lowOrbit).find(g=>g.label.startsWith('Apogee')).pass);
  const escape={...r,deliveries:r.deliveries.map(d=>({...d,apogee:null}))};
  assert.ok(!challengeGates(mission,escape).find(g=>g.label.startsWith('Apogee')).pass);
});
test('a stored release is not counted as a successful delivery without energy gain and clearance',()=>{
  const r=simulate(DEFAULT,{horizon:10});
  const partial={...r,deliveries:[{gain:0,perigee:130000},{gain:1,perigee:110000},{gain:1,perigee:130000}]};
  assert.equal(goodDeliveries(partial).length,1);
});
test('debrief explanations distinguish tensile limit, coasting, exhaustion and completion',()=>{
  assert.match(diagnose(simulate({...DEFAULT,material:'kevlar',areaMm2:35,payloadT:5})).title,/load margin/);
  assert.match(diagnose(simulate({...DEFAULT,recovery:'none',fuelT:0})).title,/no second/);
  assert.match(diagnose(simulate({...DEFAULT,fuelT:2})).title,/budget runs out/);
  const complete=simulate(DEFAULT);assert.match(diagnose(complete).title,/Two deliveries/);
  assert.ok(readiness(complete).every(g=>Number.isFinite(g.value)));
});
test('trade candidates keep non-target controls fixed, bound payloads and never mutate the source',()=>{
  const copy={...DEFAULT};
  for(const kind of ['recovery','material','release','payload']){
    const allowed={recovery:['recovery','fuelT'],material:['material'],release:['releaseDeg'],payload:['payloadT']}[kind];
    for(const candidate of studyDesigns(copy,kind)) {
      validate(candidate.design);
      assert.ok(designChanges(copy,candidate.design).every(key=>allowed.includes(key)));
    }
  }
  assert.deepEqual(copy,DEFAULT);
  const high=studyDesigns({...copy,payloadT:250},'payload');
  assert.equal(high.length,2);assert.ok(high.every(v=>v.design.payloadT<=250));
  assert.equal(studyDesigns(copy,'recovery')[0].design.fuelT,0);
});
test('section inspector reads the same cuts and peak stress as the numerical stop condition',()=>{
  for(const loaded of [false,true]) {
    const d={...DEFAULT,shape:'tapered'},y=initial(d),b=compile(d,y[6],loaded),cuts=loadProfile(y,b,d,false),check=loadCheck(y,b,d,false);
    assert.ok(cuts.length>20&&cuts.every(c=>Number.isFinite(c.stress)&&c.area>0));
    const peak=Math.max(...cuts.map(c=>c.stress));
    near(check.margin,properties(d).allowable/peak,1e-10);
    assert.ok(cuts[0].s<0&&cuts.at(-1).s>0);
  }
});

// Shipments retain identity throughout the entire recorded mission.
const { flightObjects, trackedObject } = await import('../.lab-test/lab/objects.js');
const { sample } = await import('../.lab-test/lab/view.js');
const { particleStep, planApproach, rendezvousResidual } = await import('../.lab-test/simulation/engine.js');
const identityRun = simulate(DEFAULT);
test('both payloads have independently propagated approaches and accepted numerical matches',()=>{
  assert.equal(identityRun.approaches.length,2);
  assert.equal(identityRun.rendezvous.length,2);
  for(const id of [1,2]) {
    const a=identityRun.approaches.find(a=>a.payloadId===id),check=identityRun.rendezvous.find(c=>c.payloadId===id);
    near(a.captureTime-a.startTime,90,1e-6);
    assert.ok(check.accepted&&check.positionErrorM<2&&check.velocityErrorMs<.02);
    const frames=identityRun.frames.filter(f=>f.incomingId===id);
    assert.ok(frames.length>=10);
    near(frames[0].t,a.startTime,1e-6);
    // Reintegrate the incoming particle independently from its supplied state.
    let p=[...a.initialState],t=a.startTime;
    for(const frame of frames) {
      while(t<frame.t-1e-9){const h=Math.min(2,frame.t-t);p=particleStep(p,h);t+=h;}
      p.forEach((v,i)=>near(v,frame.incoming[i],i<2?.01:1e-5));
    }
  }
  assert.ok(identityRun.frames.every(f=>(f.incoming===null)===(f.incomingId===null)));
});
test('readiness never counts as a payload recapture; coast never inserts shipment two',()=>{
  for(const e of identityRun.events.filter(e=>e.kind==='ready')) {
    const f=sample(identityRun,e.t);
    assert.equal(f.loaded,false);assert.equal(f.payloads.length,1);
    assert.match(e.title,/Facility ready/);
  }
  const coast=simulate({...DEFAULT,recovery:'none',fuelT:0});
  assert.equal(coast.approaches.length,1);assert.equal(coast.rendezvous.length,1);
  assert.ok(coast.frames.every(f=>f.incomingId!==2));
  const y=initial(DEFAULT);
  assert.equal(planApproach(y,DEFAULT,Math.PI+2*Math.PI,0,2,48,10),null);
});
test('a distant or velocity-mismatched shipment fails capture checks regardless of marker size',()=>{
  const p=[8000000,0,0,7000];
  assert.ok(rendezvousResidual(p,[...p]).matched);
  assert.equal(rendezvousResidual(p,[8000010,0,0,7000]).matched,false);
  assert.equal(rendezvousResidual(p,[8000000,0,0,7001]).matched,false);
  assert.throws(()=>rendezvousResidual(p,[NaN,0,0,7000]));
});
test('payload one stays independent when payload two approaches and attaches',()=>{
  const capture=identityRun.events.find(e=>e.kind==='capture'&&e.payloadId===2);
  for(const time of [capture.t-90,capture.t-30,capture.t,capture.t+100]) {
    const f=sample(identityRun,time),one=trackedObject(identityRun,f,'payload-1'),two=trackedObject(identityRun,f,'payload-2');
    assert.equal(one.phase,'released');assert.deepEqual(one.state,f.payloads[0]);
    assert.equal(two.phase,time<capture.t?'approach':'attached');
    assert.notEqual(one.color,two.color);assert.notEqual(one.glyph,two.glyph);
    assert.ok(Math.hypot(one.state[0]-two.state[0],one.state[1]-two.state[1])>1000000);
  }
  const before=sample(identityRun,0);
  assert.equal(trackedObject(identityRun,before,'payload-2').state,null);
  assert.equal(flightObjects(identityRun,before).length,3);
});
test('interpolation approaches event boundaries continuously without morphing shipment identity',()=>{
  for(const e of identityRun.events.filter(e=>['capture','release'].includes(e.kind))) {
    const left=sample(identityRun,e.t-.001),at=sample(identityRun,e.t);
    assert.equal(at.loaded,e.kind==='capture');
    const id=`payload-${e.payloadId}`,a=trackedObject(identityRun,left,id),b=trackedObject(identityRun,at,id);
    assert.ok(a.state&&b.state);
    assert.ok(Math.hypot(a.state[0]-b.state[0],a.state[1]-b.state[1])<20);
    assert.equal(a.id,b.id);
  }
});
test('model 0.2 imports require confirmation before independently checked second approaches',async()=>{
  const {readDesign}=await import('../.lab-test/simulation/design-io.js');
  const old={...DEFAULT,model:'D1p-0.2.0'},copy=JSON.stringify(old),updated=readDesign(copy);
  assert.equal(updated.needsConfirmation,true);assert.equal(updated.design.model,MODEL);
  assert.match(updated.explanation,/propagates it independently/);assert.equal(JSON.stringify(old),copy);
});
