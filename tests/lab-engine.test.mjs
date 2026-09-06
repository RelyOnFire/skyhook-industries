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
