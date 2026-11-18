import test from 'node:test';
import assert from 'node:assert/strict';
import { T4_DEFAULT as D,runT4,t4Summary } from '../.lab-test/simulation/t4.js';
import { planT4Study,runT4Trial,recommendT4Trial,t4StudyMatches,exportT4Study } from '../.lab-test/simulation/t4-study.js';
const plan=planT4Study(D,'phase'),rows=plan.samples.map(runT4Trial);

test('T4 timing plans preserve fixed hardware, include the current delay and bound distinct time rows',()=>{
  const d={...D,phaseDeg:62,payloadT:4,releaseMin:1.25},before=JSON.stringify(d),p=planT4Study(d,'timing',.5);
  assert.deepEqual(p.times,[.25,.75,1.25,1.75,2.25]);assert.equal(p.samples.length,30);assert.equal(JSON.stringify(d),before);
  for(const sample of p.samples){assert.deepEqual({...sample,phaseDeg:d.phaseDeg,releaseMin:d.releaseMin},d);assert.ok(p.times.includes(sample.releaseMin));assert.ok(p.phases.includes(sample.phaseDeg));}
  assert.equal(new Set(p.samples.map(s=>`${s.releaseMin}:${s.phaseDeg}`)).size,30);
  for(const [time,expected] of [[0,[0,1,2]],[.2,[0,.2,1.2,2.2]],[29.5,[27.5,28.5,29.5,30]],[30,[28,29,30]]]){
    const p=planT4Study({...D,releaseMin:time},'timing');assert.deepEqual(p.times,expected);assert.ok(p.samples.every(s=>s.releaseMin>=0&&s.releaseMin<=30));
  }
  d.primaryKm=400;assert.equal(p.design.primaryKm,300);assert.equal(p.samples[0].primaryKm,300);
  assert.equal(planT4Study(D,'phase',2).samples.length,6);
  for(const mode of ['unknown',null])assert.throws(()=>planT4Study(D,mode));
  for(const step of [0,NaN,Infinity,30,'1'])assert.throws(()=>planT4Study(D,'timing',step));
});
test('T4 study rows are complete model flights with replayable inputs and matching limit evidence',()=>{
  const r=runT4(D),sample=rows.find(r=>r.design.phaseDeg===180);
  for(const [key,value] of Object.entries(t4Summary(r)))assert.deepEqual(sample[key],value);
  assert.equal(sample.duration,7200);assert.equal(sample.reason,r.reason);assert.equal(sample.peakPivotForce,r.peakPivotForce);assert.equal(sample.minClearance,r.minClearance);
  assert.equal(sample.axialMargin,2.9e9/Math.max(...r.peakStress));
  const failed=runT4Trial({...D,secondaryAreaMm2:15,payloadT:8},3);assert.equal(failed.duration,0);assert.equal(failed.pass,false);assert.equal(failed.released,false);assert.equal(failed.outcome,'stress');assert.match(failed.reason,/axial material/);
  const timing=runT4Trial({...D,phaseDeg:180,releaseMin:1},12);assert.notEqual(timing.apoapsis,sample.apoapsis);assert.equal(timing.design.releaseMin,1);
});
test('T4 suggestions use passing samples only and choose proximity to the target center deterministically',()=>{
  assert.equal(recommendT4Trial([]),null);assert.equal(recommendT4Trial(rows).design.phaseDeg,180);
  const pass=rows.find(r=>r.pass),a={...pass,index:1,apoapsis:9e6},b={...pass,index:2,apoapsis:10.1e6};
  const wrong={...pass,index:0,apoapsis:1e7,pass:false},escape={...pass,index:3,apoapsis:null,pass:false};
  const input=[a,wrong,escape,b],copy=[...input];assert.equal(recommendT4Trial(input),b);assert.deepEqual(input,copy);
  assert.equal(recommendT4Trial([{...b,apoapsis:11e6},a]),a);assert.equal(recommendT4Trial([wrong,escape]),null);
});
test('T4 studies distinguish changed fixed inputs from the two deliberately varied axes',()=>{
  const timing=planT4Study(D,'timing');assert.ok(t4StudyMatches(timing,{...D,phaseDeg:62,releaseMin:1.3}));
  assert.ok(t4StudyMatches(plan,{...D,phaseDeg:62}));assert.equal(t4StudyMatches(plan,{...D,releaseMin:1.3}),false);
  for(const change of [{payloadT:4},{primaryAreaMm2:155},{secondaryAreaMm2:85},{altitudeKm:1900},{primaryKm:400},{secondaryKm:60},{primarySpeedKms:1.1},{secondarySpeedKms:-.8},{material:'kevlar'},{safetyFactor:2.1}])assert.equal(t4StudyMatches(timing,{...D,...change}),false);
  assert.equal(t4StudyMatches(timing,{...D,secondaryKm:200}),false);
  assert.ok(t4StudyMatches(timing,JSON.parse(JSON.stringify(D))));
});
test('T4 study exports carry exact designs and explicit sampling limits; incomplete studies cannot masquerade as complete',()=>{
  const study={plan,rows,status:'complete'},file=exportT4Study(study),roundtrip=JSON.parse(JSON.stringify(file));
  assert.deepEqual(roundtrip.rows,rows);assert.deepEqual(roundtrip.plan,plan);assert.equal(file.format,'skyhook-t4-study');assert.equal(file.model,D.model);assert.match(file.scope,/No interpolation/);
  for(const status of ['running','cancelled','error'])assert.throws(()=>exportT4Study({...study,status}));
  assert.throws(()=>exportT4Study({...study,rows:rows.slice(1)}));assert.ok(file.rows.every(r=>Number.isFinite(r.peakPivotForce)));
});
