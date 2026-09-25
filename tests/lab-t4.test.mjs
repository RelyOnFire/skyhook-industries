import test from 'node:test';
import assert from 'node:assert/strict';
import { T4_DEFAULT as D,T4_HUB,T4_PIVOT,T4_TIP,T4_CUTOFF,compileT4,t4Initial,t4Point,t4Dynamics,t4Step,t4Invariants,t4Loads,t4Geometry,segmentAltitude,runT4,t4Orbit,t4Gates,t4Sample,validateT4,readT4,t4Fragment } from '../.lab-test/simulation/t4.js';
import { DEFAULT,LUNAR_DEFAULT,MATERIALS,EARTH,MU,validate } from '../.lab-test/simulation/engine.js';
import { PHOBOS_DEFAULT } from '../.lab-test/simulation/phobos.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}; tolerance ${tol}`);
const rel=(a,b,tol=1e-10)=>near(a,b,Math.max(1,Math.abs(b))*tol);
const base=runT4(D),challenge=runT4({...D,phaseDeg:60});

test('T4 uniform quadrature agrees with analytic mass, first moments and inertias',()=>{
  const rho=MATERIALS.find(m=>m.id===D.material).density,L=D.primaryKm*1000,l=D.secondaryKm*1000,m1=rho*D.primaryAreaMm2*1e-6*L,m2=rho*D.secondaryAreaMm2*1e-6*2*l;
  for(const cells of [8,32,128])for(const loaded of [false,true]){
    const b=compileT4(D,loaded,cells),cargo=loaded?D.payloadT*1000:0;
    rel(b.mass,T4_HUB+T4_PIVOT+2*T4_TIP+m1+m2+cargo,1e-13);
    rel(b.first[0],-T4_HUB*L-m1*L/2,1e-13);near(b.first[1],cargo*l,1e-6);
    rel(b.inertia[0],T4_HUB*L*L+m1*L*L/3,1e-13);
    rel(b.inertia[1],(2*T4_TIP+cargo)*l*l+m2*l*l/3,1e-13);
  }
});
test('T4 starts with a circular loaded COM and finite, independently rotating stage kinematics',()=>{
  for(const phaseDeg of [0,60,180,300]){
    const d={...D,phaseDeg},b=compileT4(d),s=t4Initial(d,b),v=t4Invariants(s,b),r=EARTH+d.altitudeKm*1000;
    near(v.center[0],r,1e-7);near(v.center[1],0,1e-8);near(v.momentum[0]/b.mass,0,1e-10);near(v.momentum[1]/b.mass,Math.sqrt(MU/r),1e-10);
    assert.deepEqual(t4Point(s,0,0),t4Point(s,1,0));assert.ok(Math.abs(s[0]-r)>100000);
    for(const stage of [0,1]){const u=stage?50000:-300000,p=t4Point(s,stage,u),h=1e-5,shift=[...s];for(let i=0;i<4;i++)shift[i]+=h*s[i+4];const next=t4Point(shift,stage,u);near((next[0]-p[0])/h,p[2],.001);near((next[1]-p[1])/h,p[3],.001);}
  }
});
test('T4 accelerations satisfy independent inertial force and torque balances for the entire finite system',()=>{
  for(const attached of [false,true]){
    const b=compileT4(D,attached),s=t4Initial(D,b);s[2]=.47;s[3]=1.36;s[6]=.0027;s[7]=-.018;
    const a=t4Dynamics(s,b),net=[0,0],external=[0,0];let torque=0;
    for(const n of b.nodes){const p=t4Point(s,n.stage,n.u),theta=s[2+n.stage],w=s[6+n.stage],alpha=a.alpha[n.stage],ax=a.accel[0]-n.u*(Math.sin(theta)*alpha+Math.cos(theta)*w*w),ay=a.accel[1]+n.u*(Math.cos(theta)*alpha-Math.sin(theta)*w*w),r=Math.hypot(p[0],p[1]);
      net[0]+=n.m*ax;net[1]+=n.m*ay;external[0]-=MU*n.m*p[0]/r**3;external[1]-=MU*n.m*p[1]/r**3;torque+=n.m*(p[0]*ay-p[1]*ax);
    }
    near(net[0],external[0],1e-7);near(net[1],external[1],1e-7);near(torque,0,.005);
    const symmetric=t4Dynamics(s,compileT4(D,false),0),loaded=t4Dynamics(s,compileT4(D,true),0);
    near(symmetric.alpha[0],0,1e-15);near(symmetric.alpha[1],0,1e-15);
    assert.ok(Math.abs(loaded.alpha[0])>1e-7);assert.ok(Math.abs(loaded.alpha[1])>1e-7);
  }
});
test('T4 freely hinged stages conserve energy, angular and linear momentum without gravity',()=>{
  const d={...D,phaseDeg:60},b=compileT4(d);let s=t4Initial(d,b),start=t4Invariants(s,b,null,0,0);
  for(let i=0;i<2400;i++)s=t4Step(s,b,.25,0);
  const end=t4Invariants(s,b,null,0,0);rel(end.energy,start.energy,1e-10);rel(end.angular,start.angular,1e-10);
  // Scale by the vector norm: one initial component is essentially zero.
  assert.ok(Math.hypot(...end.momentum.map((v,i)=>v-start.momentum[i]))/Math.hypot(...start.momentum)<1e-10);
  assert.ok(Math.abs(s[6]-d.primarySpeedKms/d.primaryKm)>1e-5);
});
test('T4 axial and pivot force screens agree with an independent dense continuous-arm integration',()=>{
  const b=compileT4(D),s=t4Initial(D,b);s[2]=.47;s[3]=1.36;
  const a=t4Dynamics(s,b),loads=t4Loads(s,b,D),rho=MATERIALS.find(m=>m.id===D.material).density;
  const force=(stage,u,m)=>{const theta=s[stage+2],w=s[stage+6],c=Math.cos(theta),z=Math.sin(theta),x=s[0]+u*c,y=s[1]+u*z,r=Math.hypot(x,y);return [m*(a.accel[0]-u*(a.alpha[stage]*z+w*w*c)+MU*x/r**3),m*(a.accel[1]+u*(a.alpha[stage]*c-w*w*z)+MU*y/r**3)];};
  const pivot=force(1,0,T4_PIVOT),max=[0,0],transverse=[0,0];let min=Infinity;
  for(const [stage,sign,length,terminal] of [[0,-1,D.primaryKm*1000,T4_HUB],[1,-1,D.secondaryKm*1000,T4_TIP],[1,1,D.secondaryKm*1000,T4_TIP+D.payloadT*1000]]){
    const area=(stage?D.secondaryAreaMm2:D.primaryAreaMm2)*1e-6,theta=s[stage+2],c=Math.cos(theta),z=Math.sin(theta),sum=force(stage,sign*length,terminal),N=8000,du=length/N;
    const assess=()=>{const tension=-sign*(sum[0]*c+sum[1]*z);max[stage]=Math.max(max[stage],tension/area);min=Math.min(min,tension);transverse[stage]=Math.max(transverse[stage],Math.abs(-sum[0]*z+sum[1]*c));};assess();
    // Composite midpoint of a continuous line, independent of the model's Gauss nodes.
    for(let i=0;i<N;i++){const f=force(stage,sign*(length-(i+.5)*du),rho*area*du);sum[0]+=f[0];sum[1]+=f[1];assess();}
    if(stage===1){pivot[0]+=sum[0];pivot[1]+=sum[1];}
  }
  max.forEach((v,i)=>rel(loads.stress[i],v,3e-4));transverse.forEach((v,i)=>rel(loads.transverse[i],v,3e-4));rel(loads.minTension,min,3e-4);rel(loads.pivotForce,Math.hypot(...pivot),1e-8);
});
test('T4 detaches without an impulse, mass loss or a coordinate reset, and velocity contributions sum as vectors',()=>{
  for(const r of [base,challenge,runT4({...D,releaseMin:0},{duration:0})]){
    const i=r.frames.findIndex(f=>f.cargo),before=r.frames[i-1],after=r.frames[i],release=r.release;
    assert.ok(before);near(before.t,release.t);assert.deepEqual(before.s,after.s);
    assert.deepEqual(t4Point(before.s,1,r.design.secondaryKm*1000),after.cargo);
    const wet=t4Invariants(before.s,compileT4(r.design)),dry=t4Invariants(after.s,compileT4(r.design,false),after.cargo,r.design.payloadT*1000);
    rel(wet.mass,dry.mass,1e-13);rel(wet.energy,dry.energy,1e-13);rel(wet.angular,dry.angular,1e-13);wet.momentum.forEach((v,j)=>rel(v,dry.momentum[j],1e-12));
    near(release.closure.energy,0,.1);near(release.closure.angular,0,10);near(release.closure.momentum,0,1e-5);
    [0,1].forEach(j=>near(release.velocityParts.reduce((n,v)=>n+v[j],0),release.state[j+2],1e-9));
  }
});
test('T4 two-hour orbital runs conserve full-system energy and angular momentum, including released cargo',()=>{
  for(const r of [base,challenge]){assert.equal(r.outcome,'complete');assert.equal(r.duration,7200);assert.ok(r.energyError<1e-9);assert.ok(r.angularError<1e-9);assert.ok(r.peakPivotForce>10000);assert.ok(r.peakTransverse.every(v=>v>1000));}
  const release=base.release.state,h0=release[0]*release[3]-release[1]*release[2],energy=t4Orbit(release).energy;
  for(const {cargo:p} of base.frames.filter(f=>f.cargo)){rel(t4Orbit(p).energy,energy,1e-10);rel(p[0]*p[3]-p[1]*p[2],h0,1e-10);}
  assert.notDeepEqual(base.frames.at(-1).s.slice(6),base.frames[0].s.slice(6));
});
test('T4 phase challenge and counterrotation use the same mechanical solver',()=>{
  assert.deepEqual(t4Gates(base),[true,true,true]);assert.deepEqual(t4Gates(challenge),[true,true,false]);
  near(base.release.orbit.apoapsis/1000,9500.058, .002);near(challenge.release.orbit.apoapsis/1000,3040.006,.002);
  const reverse=runT4({...D,secondarySpeedKms:-.8});assert.equal(reverse.outcome,'complete');assert.ok(reverse.release.orbit.apoapsis<5e6);
  const heavy=runT4({...D,payloadT:5},{duration:120});assert.notDeepEqual(heavy.frames.at(-1).s,base.release.state);assert.ok(Math.abs(heavy.frames.at(-1).s[6]-t4Sample(base,120).s[6])>1e-5);
  assert.equal(t4Gates(heavy)[0],false); // A short numerical probe is not the full mission.
});
test('T4 structural and whole-segment clearance gates stop unsafe runs, including after release',()=>{
  const thin=runT4({...D,secondaryAreaMm2:15,payloadT:8});assert.equal(thin.outcome,'stress');assert.equal(thin.duration,0);assert.equal(thin.release,null);
  const low=runT4({...D,altitudeKm:400,primaryKm:800,secondaryKm:200});assert.equal(low.outcome,'clearance');assert.equal(low.release,null);
  // Both endpoints can clear Earth while the middle of a segment does not.
  const x=EARTH+T4_CUTOFF-1;near(segmentAltitude([x,-1e6],[x,1e6]),T4_CUTOFF-1,1e-7);assert.ok(Math.hypot(x,1e6)>EARTH+T4_CUTOFF);
  const d={...D,primarySpeedKms:.7,secondarySpeedKms:.7,phaseDeg:0,releaseMin:0},a=runT4(d),b=runT4(d,{step:.5});assert.equal(a.outcome,'compression');assert.ok(a.release);assert.ok(a.duration>3000&&a.duration<3100);near(a.duration,b.duration,1e-5);
  near(a.frames.at(-1).loads.minTension,-1,1e-4);assert.equal(a.frames.at(-1).t,a.duration);assert.ok(a.frames.slice(0,-1).every(f=>f.loads.minTension>=-1));
});
test('T4 trajectory and load envelopes converge with step and cable quadrature refinement',()=>{
  for(const refined of [runT4(D,{step:.5}),runT4(D,{cells:64})]){
    assert.equal(refined.outcome,base.outcome);near(refined.release.orbit.apoapsis,base.release.orbit.apoapsis,.01);
    base.frames.at(-1).s.forEach((v,i)=>near(v,refined.frames.at(-1).s[i],.01));
    refined.peakStress.forEach((v,i)=>rel(v,base.peakStress[i],.001));rel(refined.peakPivotForce,base.peakPivotForce,1e-6);
  }
});
test('T4 replay is right-continuous at release and follows independently integrated intermediate coordinates',()=>{
  const r=base;assert.equal(t4Sample(r,0).cargo,null);assert.equal(t4Sample(r,r.release.t-.001).cargo,null);assert.ok(t4Sample(r,r.release.t).cargo);assert.deepEqual(t4Sample(r,r.duration),r.frames.at(-1));
  const s=t4Step(r.frames[0].s,compileT4(D),.5),sample=t4Sample(r,.5);s.forEach((v,i)=>near(v,sample.s[i],.001));
  const at=t4Sample(r,125),geom=t4Geometry(at.s,D);assert.ok(Math.hypot(at.cargo[0]-geom.plus[0],at.cargo[1]-geom.plus[1])>1);
});
test('T4 design IO enforces its own model, geometry, finite values and numerical limits',()=>{
  assert.deepEqual(readT4(JSON.stringify(D)),D);assert.deepEqual(readT4(new URLSearchParams(t4Fragment(D).slice(1)).get('t4')),D);
  for(const raw of [null,[],DEFAULT,LUNAR_DEFAULT,PHOBOS_DEFAULT,{...D,schema:2},{...D,model:'T4p-9'},{...D,secondaryKm:200},{...D,phaseDeg:NaN},{...D,releaseMin:Infinity},{...D,primaryKm:'300'},{...D,payloadT:0},{...D,material:'custom'}])assert.throws(()=>validateT4(raw));
  assert.throws(()=>readT4(' '.repeat(6001)));assert.throws(()=>validate(D));assert.deepEqual(validateT4({...D,unknown:1}),D);
  for(const options of [{step:0},{step:NaN},{step:3},{duration:100},{duration:Infinity},{cells:7},{cells:33.5},{cells:129}])assert.throws(()=>runT4(D,options));
});
