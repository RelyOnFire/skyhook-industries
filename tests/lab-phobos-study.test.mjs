import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOBOS_DEFAULT as D,PERIOD,TERMINAL_KG,runPhobos } from '../.lab-test/simulation/phobos.js';
import { planPhobosStudy,runPhobosTrial,phobosStudyValue,phobosTrialLabel,recommendPhobosTrial,phobosStudyMatches,exportPhobosStudy } from '../.lab-test/simulation/phobos-study.js';

const plan=planPhobosStudy(D,100),rows=plan.samples.map(runPhobosTrial);
test('Phobos arm studies preserve fixed inputs, bound distinct samples and include the chosen reach',()=>{
  assert.equal(plan.axis,'inwardKm');assert.deepEqual(plan.lengthsKm,[950,1050,1150,1250,1350,1450,1550]);
  for(const sample of plan.samples)assert.deepEqual({...sample,inwardKm:D.inwardKm},D);
  const d={...D,release:'outward',payloadT:4},out=planPhobosStudy(d,250);assert.equal(out.axis,'outwardKm');
  assert.deepEqual(out.lengthsKm,[2250,2500,2750,3000,3250,3500,3750]);
  for(const sample of out.samples)assert.deepEqual({...sample,outwardKm:d.outwardKm},d);
  d.payloadT=8;assert.equal(out.design.payloadT,4);assert.equal(out.samples[0].payloadT,4);
  for(const [change,spacing,expected] of [[{inwardKm:1},100,[1,101,201,301]],[{inwardKm:1.5},50,[1,1.5,51.5,101.5,151.5]],[{release:'outward',outwardKm:10000},500,[8500,9000,9500,10000]]]){
    const p=planPhobosStudy({...D,...change},spacing);assert.deepEqual(p.lengthsKm,expected);assert.equal(new Set(p.lengthsKm).size,p.samples.length);
  }
  for(const spacing of [0,NaN,Infinity,75,'100'])assert.throws(()=>planPhobosStudy(D,spacing));
  assert.throws(()=>planPhobosStudy({...D,release:'unknown'},100));
});
test('Phobos study rows match the full native solver, including refined boundary stops and loading on both arms',()=>{
  for(const row of [rows[3],rows[6]]){
    const r=runPhobos(row.design);assert.deepEqual(row.orbit,r.orbit);assert.equal(row.duration,r.duration);assert.equal(row.minMarsAltitudeM,r.minMarsAltitudeM);
    assert.equal(row.margin,Math.min(...r.loads.map(l=>l.margin)));assert.equal(row.massKg,r.loads.reduce((m,l)=>m+l.massKg,2*TERMINAL_KG));
    assert.deepEqual(row.budget,r.budget);assert.equal(row.jacobiRelativeError,r.jacobiRelativeError);
  }
  assert.equal(rows[3].duration,2*PERIOD);assert.equal(rows[3].target,true);assert.equal(rows[6].outcome,'mars-limit');assert.equal(rows[6].target,false);
  assert.ok(Math.abs(phobosStudyValue(rows[6])-150)<1e-8);assert.equal(phobosTrialLabel(rows[6]),'Mars boundary');
  const blocked=runPhobosTrial({...D,outwardKm:8000},0);assert.equal(blocked.released,false);assert.equal(blocked.duration,0);assert.equal(blocked.orbit,null);assert.equal(blocked.minMarsAltitudeM,null);
  assert.equal(phobosStudyValue(blocked),null);assert.match(blocked.issues.join(' '),/Outward arm exceeds/);assert.equal(phobosTrialLabel(blocked),'Release blocked');
});
test('Phobos outward studies distinguish bound release energy from escape without inventing a destination',()=>{
  const bound=runPhobosTrial({...D,release:'outward',outwardKm:2250},0),escape=runPhobosTrial({...D,release:'outward'},1);
  assert.ok(bound.clear&&escape.clear);assert.ok(phobosStudyValue(bound)<0);assert.ok(phobosStudyValue(escape)>0);
  assert.equal(phobosStudyValue(escape),escape.orbit.energy/1e6);assert.equal(phobosTrialLabel(bound),'Clear flight');assert.equal(phobosTrialLabel(escape),'Escape energy');
  assert.equal(bound.target,false);assert.equal(escape.target,false);assert.equal(recommendPhobosTrial([bound,escape]),null);
  assert.ok(escape.margin<bound.margin);assert.ok(escape.massKg>bound.massKg);
});
test('Phobos study suggestions require the full low-pass checks; only the sampled arm is ignored for stale-input detection',()=>{
  const copy=[...rows],candidate=recommendPhobosTrial(rows);assert.equal(candidate.design.inwardKm,1250);assert.deepEqual(rows,copy);
  assert.equal(recommendPhobosTrial(rows.filter(r=>!r.target)),null);assert.equal(recommendPhobosTrial([]),null);
  assert.ok(phobosStudyMatches(plan,{...D,inwardKm:1300}));
  for(const change of [{outwardKm:3100},{payloadT:4},{areaMm2:55},{material:'kevlar'},{safetyFactor:2.1},{release:'outward'},{inwardKm:NaN}])assert.equal(phobosStudyMatches(plan,{...D,...change}),false);
});
test('Phobos study export preserves the exact sample plan and mixed outcomes; incomplete runs cannot export as complete',()=>{
  const study={plan,rows,status:'complete'},file=JSON.parse(JSON.stringify(exportPhobosStudy(study)));
  assert.equal(file.format,'skyhook-phobos-study');assert.equal(file.model,D.model);assert.equal(file.version,1);
  assert.deepEqual(file.plan,plan);assert.deepEqual(file.rows,rows);assert.match(file.scope,/Gaps are untested/);
  for(const status of ['running','cancelled','error'])assert.throws(()=>exportPhobosStudy({...study,status}));
  assert.throws(()=>exportPhobosStudy({...study,rows:rows.slice(1)}));
});
