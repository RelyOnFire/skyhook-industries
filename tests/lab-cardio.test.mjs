import test from 'node:test';
import assert from 'node:assert/strict';
import {EARTH,MU,DEFAULT,MATERIALS} from '../.lab-test/simulation/engine.js';
import {CARDIO_DEFAULT as D,CARDIO_MODEL,CARDIO_CUTOFF,CARDIO_ALLOWABLE,validateCardio,readCardio,cardioFragment,cardioBody,cardioInitial,cardioCapture,cardioPoint,cardioStep,cardioInvariants,cardioClearance,cardioLoads,simulateCardio,cardioSample} from '../.lab-test/simulation/cardio.js';
const result=simulateCardio(D);
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≠ ${b} (${tol})`);
test('matched finite-mass pickup preserves all existing material states and closes total energy/angular momentum',()=>{
 const empty=cardioBody(D,false),loaded=cardioBody(D,true),{state}=cardioInitial(D,empty),after=cardioCapture(state,empty,loaded);
 near(loaded.mass-empty.mass,D.payloadT*1000,1e-7);
 for(const s of [0,empty.length/3,empty.length])cardioPoint(state,empty,s).forEach((v,i)=>near(v,cardioPoint(after,loaded,s)[i],1e-8));
 const total=cardioInvariants(after,loaded);
 assert.ok(Math.abs(result.captureEnergyResidual/total.energy)<1e-12);assert.ok(Math.abs(result.captureAngularResidual/total.angular)<1e-12);
 assert.ok(result.loaded.initialPerigee<result.empty.initialPerigee);near(result.empty.initialPerigee,D.perigeeKm*1000,1e-6);
});
test('free orbit passes conservation checks and drifts away from forced spin; completion is not a phase lock',()=>{
 for(const r of [result.empty,result.loaded]){assert.equal(r.status,'complete');near(r.duration,result.period,1e-7);assert.ok(r.minClearance>CARDIO_CUTOFF);assert.ok(r.peakStress<CARDIO_ALLOWABLE);assert.ok(r.energyDrift<1e-8);assert.ok(r.angularDrift<1e-8);assert.ok(Math.abs(r.frames.at(-1).phaseErrorDeg)>10);assert.ok(r.frames.every(f=>f.state.every(Number.isFinite)));}
 assert.notDeepEqual(result.empty.frames.at(-1).state,result.loaded.frames.at(-1).state);
 assert.deepEqual(cardioSample(result.loaded,1e9),result.loaded.frames.at(-1));assert.deepEqual(cardioSample(result.empty,0),result.empty.frames[0]);
});
test('smaller integration steps and finer mass quadrature converge independently',()=>{
 const fine=simulateCardio(D,{step:2.5}),cells=simulateCardio(D,{cells:96});
 for(const name of ['empty','loaded']){const r=result[name];for(const other of [fine[name],cells[name]]){assert.equal(r.status,other.status);r.frames.at(-1).state.forEach((v,i)=>near(v,other.frames.at(-1).state[i],i<2?2:i<4?.003:1e-5));near(r.minClearance,other.minClearance,10);}}
});
test('a low pass stops at the cutoff and an overloaded long arm stops immediately',()=>{
 const low=simulateCardio({...D,lengthKm:800,perigeeKm:700,apogeeKm:1300});
 assert.equal(low.empty.status,'clearance');assert.equal(low.loaded.status,'clearance');assert.ok(low.loaded.duration<low.empty.duration);near(low.loaded.minClearance,CARDIO_CUTOFF,.01);
 const long=simulateCardio({...D,lengthKm:2200,perigeeKm:700,apogeeKm:2400});assert.equal(long.loaded.status,'load');assert.equal(long.loaded.duration,0);
 const body=cardioBody(D,false),y=[EARTH+200000,0,0,7000,Math.PI,0];assert.ok(cardioClearance(y,body)<200000,'whole segment checked, not just COM');
});
test('zero gravity produces inertial translation and constant spin',()=>{
 const body=cardioBody(D,false),initial=cardioInitial(D,body).state;let y=[...initial];for(let i=0;i<100;i++)y=cardioStep(y,5,body,0);
 near(y[0],initial[0]+initial[2]*500,1e-6);near(y[1],initial[1]+initial[3]*500,1e-6);near(y[4],initial[4]+initial[5]*500,1e-12);
 const a=cardioInvariants(initial,body,0),b=cardioInvariants(y,body,0);near(a.energy/b.energy,1,1e-12);near(a.angular/b.angular,1,1e-12);
});
test('terminal stress uses the exact tip area and includes the grapple and payload independently of section resolution',()=>{
 // In zero gravity the terminal's centripetal force is m*omega²*(L-COM).
 // Integrate the linear taper analytically, independently of the body quadrature.
 const d={...D,lengthKm:100,areaMm2:50,taper:10,payloadT:100},length=d.lengthKm*1000;
 const density=MATERIALS.find(m=>m.id==='zylon').density,tipArea=d.areaMm2*1e-6,rootArea=tipArea*d.taper;
 const terminal=2000+d.payloadT*1000,cableMass=density*length*(rootArea+tipArea)/2;
 const firstMoment=density*length**2*(rootArea+2*tipArea)/6;
 const center=(terminal*length+firstMoment)/(d.stationT*1000+terminal+cableMass),omega=.001;
 const expected=terminal*omega**2*(length-center)/tipArea;
 for(const cells of [16,48,96]){
  const body=cardioBody(d,true,cells),loads=cardioLoads([EARTH+2000000,0,0,0,.7,omega],body,0);
  assert.equal(body.cuts.at(-1),length);near(body.areas.at(-1),tipArea,1e-18);
  near(loads.stress,expected,expected*1e-12);assert.ok(loads.minTension>0);
 }
});
test('phase/ballast choices change the actual coast; design validation and storage stay isolated',()=>{
 const shifted=simulateCardio({...D,phaseDeg:15}),heavy=simulateCardio({...D,payloadT:100});assert.notEqual(shifted.empty.minClearance,result.empty.minClearance);assert.ok(heavy.loaded.initialPerigee<result.loaded.initialPerigee);
 assert.deepEqual(readCardio(decodeURIComponent(cardioFragment(D).split('=')[1])),D);
 for(const invalid of [DEFAULT,{...D,model:'future'},{...D,apogeeKm:600},{...D,phaseDeg:NaN},{...D,stationT:0}])assert.throws(()=>validateCardio(invalid));
 for(const options of [{step:0},{cells:1},{step:Infinity}])assert.throws(()=>simulateCardio(D,options));
 assert.throws(()=>readCardio(' '.repeat(16001)));assert.deepEqual(D,result.design);
});
test('legacy C1p schema-1 designs normalize their model without changing any numerical setting',()=>{
 const legacy={...D,model:'C1p-0.1.0',perigeeKm:975.125,apogeeKm:2440.75,lengthKm:640.25,stationT:6500.5,payloadT:12.25,areaMm2:575.5,taper:4.25,spinRatio:2.375,phaseDeg:-13.5};
 const before=structuredClone(legacy),expected={...legacy,model:CARDIO_MODEL};
 assert.equal(CARDIO_MODEL,'C1p-0.1.1');assert.deepEqual(validateCardio(legacy),expected);
 assert.deepEqual(readCardio(JSON.stringify(legacy)),expected);
 assert.deepEqual(JSON.parse(decodeURIComponent(cardioFragment(legacy).split('=')[1])),expected);
 assert.deepEqual(legacy,before);
 for(const invalid of [{...legacy,schema:2},{...legacy,model:'C1p-0.1.2'},{...legacy,phaseDeg:Infinity}])assert.throws(()=>validateCardio(invalid));
});
