import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOBOS_DEFAULT as D, PHOBOS, MARS, MARS_X, PHOBOS_X, RATE, PERIOD, TERMINAL_KG,
  gradient,potential,jacobi,phobosStep,marsState,marsOrbit,tipX,armLoads,transferBudget,runPhobos,
  validatePhobos,readPhobos,phobosFragment,phobosSample } from '../.lab-test/simulation/phobos.js';
import { DEFAULT, LUNAR_DEFAULT, validate, MATERIALS } from '../.lab-test/simulation/engine.js';
const near=(a,b,abs=1e-6)=>assert.ok(Math.abs(a-b)<=abs,`${a} != ${b} (tol ${abs})`);
const inward=runPhobos(D),outward=runPhobos({...D,release:'outward'});

test('P1 circular binary has a common barycenter and gradients agree with potential differences',()=>{
  near(MARS.mu*MARS_X+PHOBOS.mu*PHOBOS_X,0,.01);
  near(RATE**2*PHOBOS.separation**3,MARS.mu+PHOBOS.mu,.1);
  near(PERIOD/3600,7.6554105666763,1e-9);
  for(const [x,y] of [[7e6,1e6],[1.3e7,-2e6],[PHOBOS_X+20000,13000]]){
    const g=gradient(x,y),dx=.1;
    near(g[0],(potential(x+dx,y)-potential(x-dx,y))/(2*dx),2e-8);
    near(g[1],(potential(x,y+dx)-potential(x,y-dx))/(2*dx),2e-8);
  }
});
test('P1 release is corotating and impulse-free, with independent Kepler release elements',()=>{
  for(const r of [inward,outward]){
    const s=r.frames[0].state,x=tipX(r.design,r.design.release)-MARS_X,v=RATE*x;
    assert.deepEqual(s.slice(2),[0,0]);assert.deepEqual(marsState(s,0),[x,0,0,v]);
    const e=Math.abs(x*v*v/MARS.mu-1),p=x*x*v*v/MARS.mu;
    near(r.orbit.periapsis,p/(1+e)-MARS.radius,1e-7);
    near(r.orbit.energy,v*v/2-MARS.mu/x,1e-9);
    const p1=marsState(s,PERIOD/4);near(p1[0],0,1e-8);near(p1[1],x,1e-8);
  }
  near(inward.orbit.periapsis,502114.948155034,1e-6);
  assert.equal(outward.orbit.apoapsis,null);near(outward.orbit.vInfinity,1028.885373284238,1e-8);
});
test('P1 default inward and outward flights conserve Jacobi over two periods',()=>{
  for(const r of [inward,outward]){
    assert.equal(r.outcome,'clear');assert.equal(r.duration,2*PERIOD);assert.ok(r.frames.length>1800);
    assert.ok(r.jacobiRelativeError<1e-10);assert.ok(r.minMarsAltitudeM>MARS.cutoff);assert.ok(r.minPhobosAltitudeM>0);
    for(const f of r.frames)assert.ok(Math.abs(jacobi(f.state)-jacobi(r.frames[0].state))/Math.abs(jacobi(r.frames[0].state))<1e-10);
  }
  assert.ok(Math.hypot(...outward.frames.at(-1).state.slice(0,2))>8e7);
});
test('P1 radial cable force equals independent distributed-load quadrature including retained terminals',()=>{
  for(const arm of ['inward','outward']){
    const d={...D,release:arm},l=armLoads(d,arm),s=arm==='inward'?-1:1,end=PHOBOS.radius+d[arm==='inward'?'inwardKm':'outwardKm']*1000;
    const material=MATERIALS.find(m=>m.id===d.material),area=d.areaMm2*1e-6;
    const g=u=>s*(RATE**2*(PHOBOS_X+s*u)-MARS.mu/(PHOBOS.separation+s*u)**2-s*PHOBOS.mu/u**2);
    // Composite Simpson with log-spaced subintervals resolves near-surface gravity.
    let integral=0;const bins=20000,ratio=end/PHOBOS.radius;
    for(let i=0;i<bins;i++){const a=PHOBOS.radius*ratio**(i/bins),b=PHOBOS.radius*ratio**((i+1)/bins),m=(a+b)/2;integral+=(b-a)*(g(a)+4*g(m)+g(b))/6;}
    near(l.rootLoadedN,(TERMINAL_KG+d.payloadT*1000)*g(end)+material.density*area*integral,1e-5);
    near(l.rootEmptyN,TERMINAL_KG*g(end)+material.density*area*integral,1e-5);
    near(l.rootLoadedN-l.rootEmptyN,d.payloadT*1000*g(end),1e-8);
    near(l.massKg,d[arm==='inward'?'inwardKm':'outwardKm']*1000*area*material.density,1e-6);
    near(g(PHOBOS.radius+l.peakDistanceM),0,1e-12);
    assert.ok(l.peakDistanceM>5000&&l.peakDistanceM<6000);
    assert.ok(l.maxStressPa*area>l.rootLoadedN); // The anchor is NOT the maximum.
  }
});
test('P1 tensile and clearance gates prevent release; payload removal cannot hide a slack empty cable',()=>{
  assert.match(runPhobos({...D,inwardKm:1}).issues.join(' '),/compression/);
  const heavy=runPhobos({...D,outwardKm:8000});assert.equal(heavy.outcome,'structure-limit');assert.equal(heavy.duration,0);assert.match(heavy.issues.join(' '),/allowable/);
  assert.match(runPhobos({...D,inwardKm:5900}).issues.join(' '),/150 km/);
  // At short reaches a heavy terminal load can mask the cable's own Phobos-directed
  // root force while loaded; the empty root must still be tensile.
  let example;
  for(let km=5.5;km<12;km+=.05){const d={...D,inwardKm:km,areaMm2:2000,payloadT:50},l=armLoads(d,'inward');if(l.rootLoadedN>0&&l.rootEmptyN<0){example=runPhobos(d);break;}}
  assert.ok(example);assert.equal(example.outcome,'structure-limit');assert.match(example.issues.join(' '),/compression/);
});
test('P1 overlong inward release stops at the Mars boundary with a refined event time',()=>{
  const r=runPhobos({...D,inwardKm:1500});assert.equal(r.outcome,'mars-limit');assert.ok(r.duration>5700&&r.duration<5800);
  const end=r.frames.at(-1);near(Math.hypot(end.state[0]-MARS_X,end.state[1])-MARS.radius,MARS.cutoff,1e-5);
  assert.equal(end.t,r.duration);assert.ok(r.jacobiRelativeError<1e-10);
  assert.ok(r.frames.slice(0,-1).every(f=>Math.hypot(f.state[0]-MARS_X,f.state[1])>MARS.radius+MARS.cutoff));
});
test('P1 work budget matches independent inertial energy and angular momentum differences',()=>{
  for(const release of ['inward','outward']){
    const d={...D,release},b=transferBudget(d),sign=release==='inward'?-1:1,x0=PHOBOS_X+sign*PHOBOS.radius,x1=tipX(d,release);
    const energy=x=>d.payloadT*1000*(.5*(RATE*x)**2-MARS.mu/Math.abs(x-MARS_X)-PHOBOS.mu/Math.abs(x-PHOBOS_X));
    const angular=x=>d.payloadT*1000*RATE*x*x;
    near(b.deltaEnergyJ,energy(x1)-energy(x0),1e-5);
    near(b.deltaAngularMomentum,angular(x1)-angular(x0),.1);
    near(b.winchWorkJ,b.deltaEnergyJ-RATE*b.deltaAngularMomentum,1e-6);
    assert.equal(Math.sign(b.anchorWorkJ),sign);
    near(transferBudget({...d,payloadT:6}).deltaEnergyJ,b.deltaEnergyJ*2,1e-5);
  }
});
test('P1 converges under step refinement and cargo mass does not change restricted free flight',()=>{
  for(const d of [D,{...D,release:'outward'},{...D,inwardKm:1500}]){
    const a=runPhobos(d,{step:2}),b=runPhobos(d,{step:1});assert.equal(a.outcome,b.outcome);near(a.duration,b.duration,1e-6);
    a.frames.at(-1).state.forEach((v,i)=>near(v,b.frames.at(-1).state[i],.002));
  }
  const light=runPhobos({...D,payloadT:.1});assert.deepEqual(light.frames,inward.frames);
});
test('P1 replay preserves endpoints and agrees with an independently stepped intermediate state',()=>{
  assert.deepEqual(phobosSample(inward,0),inward.frames[0].state);assert.deepEqual(phobosSample(inward,inward.duration),inward.frames.at(-1).state);
  const state=phobosStep(inward.frames[0].state,1);
  phobosSample(inward,1).forEach((v,i)=>near(v,state[i],.001));
});
test('P1 design IO rejects other solvers, unknown versions, nonfinite numbers and invalid controls',()=>{
  assert.deepEqual(readPhobos(JSON.stringify(D)),D);
  assert.deepEqual(readPhobos(new URLSearchParams(phobosFragment(D).slice(1)).get('p')),D);
  for(const raw of [null,[],DEFAULT,LUNAR_DEFAULT,{...D,model:'P1-9'},{...D,schema:2},{...D,payloadT:NaN},{...D,inwardKm:0},{...D,outwardKm:Infinity},{...D,areaMm2:'50'},{...D,release:'earth'},{...D,material:'custom'}])assert.throws(()=>validatePhobos(raw));
  assert.throws(()=>readPhobos(' '.repeat(6001)));assert.throws(()=>validate({...D}));
  assert.deepEqual(validatePhobos({...D,extra:'ignored'}),D);
  for(const options of [{step:0},{step:NaN},{step:11},{duration:Infinity},{duration:PERIOD*3}])assert.throws(()=>runPhobos(D,options));
});
