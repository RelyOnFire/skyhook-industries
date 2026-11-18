import test from 'node:test';
import assert from 'node:assert/strict';
import {EARTH,orbit} from '../.lab-test/simulation/engine.js';
import {CARDIO_DEFAULT as D} from '../.lab-test/simulation/cardio.js';
import {simulateCardioRelease,cardioCargoCrossesCutoff} from '../.lab-test/simulation/cardio-release.js';
import {cardioTimingPlan,cardioTimingOutcome,cardioTimingReport} from '../.lab-test/simulation/cardio-study.js';
const design={...D,spinRatio:2.75},plan=cardioTimingPlan(.25),results=plan.map(f=>simulateCardioRelease(design,f));
test('timing plan is bounded, ordered and includes exact off-grid and near-grid selections',()=>{
 assert.equal(plan.length,18);assert.equal(plan[0],.05);assert.equal(plan.at(-1),.9);
 for(const current of [.25123456789,.250000000001]){const p=cardioTimingPlan(current);assert.equal(p.length,19);assert.ok(p.includes(current));assert.ok(p.includes(.25));}
 for(const current of [0,1,NaN,Infinity])assert.throws(()=>cardioTimingPlan(current));
});
test('real timing samples expose different trajectories, and a clear cargo orbit alone cannot qualify a failed coast',()=>{
 const outcomes=results.map(cardioTimingOutcome);assert.ok(outcomes.some(o=>o.clear));assert.ok(outcomes.some(o=>!o.clear));
 assert.ok(new Set(results.map(r=>r.release?.cargoOrbit.apogee)).size>5);
 for(const [i,r] of results.entries()){assert.deepEqual(r.design,design);assert.equal(r.fraction,plan[i]);if(outcomes[i].clear){assert.equal(r.status,'complete');assert.equal(cardioCargoCrossesCutoff(r.release.cargo,r.release.cargoOrbit),false);}}
 const late=simulateCardioRelease(D,.9);assert.equal(late.status,'complete');assert.equal(cardioTimingOutcome(late).clear,false);
 const blocked=simulateCardioRelease({...D,lengthKm:2200,perigeeKm:700,apogeeKm:2400},.25);assert.equal(cardioTimingOutcome(blocked).label,'Release blocked');
 const clear=results.find(r=>cardioTimingOutcome(r).clear);for(const status of ['load','compression','clearance'])assert.equal(cardioTimingOutcome({...clear,status}).clear,false);
});
test('an outbound escape with a past low perigee qualifies only when the tether coast also completes',()=>{
 const complete=results.find(r=>cardioTimingOutcome(r).clear),cargo=[EARTH+1000000,0,12000,1000];
 const release={...complete.release,cargo,cargoOrbit:orbit(cargo)},outbound={...complete,release};
 assert.ok(release.cargoOrbit.perigee<120000&&release.cargoOrbit.energy>0);
 assert.deepEqual(cardioTimingOutcome(outbound),{clear:true,label:'Clear escape coast'});
 for(const status of ['load','compression','clearance','cargo-clearance'])assert.equal(cardioTimingOutcome({...outbound,status}).clear,false);
 const inbound=[cargo[0],cargo[1],-cargo[2],cargo[3]];
 assert.deepEqual(cardioTimingOutcome({...outbound,release:{...release,cargo:inbound,cargoOrbit:orbit(inbound)}}),{clear:false,label:'Cargo crosses cutoff'});
 const bound=[cargo[0],cargo[1],1000,1000];
 assert.deepEqual(cardioTimingOutcome({...outbound,release:{...release,cargo:bound,cargoOrbit:orbit(bound)}}),{clear:false,label:'Cargo crosses cutoff'});
});
test('exports retain exact fixed inputs, timing plan, partial completion and unreached releases without invented values',()=>{
 const report=cardioTimingReport(design,plan,results);assert.equal(report.complete,true);assert.deepEqual(report.design,design);assert.deepEqual(report.plan,plan);
 report.results.forEach((r,i)=>{assert.equal(r.fraction,results[i].fraction);assert.deepEqual(r.release?.cargoOrbit,results[i].release?.cargoOrbit);});
 const partial=cardioTimingReport(design,plan,results.slice(0,3));assert.equal(partial.complete,false);assert.equal(partial.results.length,3);
 assert.throws(()=>cardioTimingReport(D,plan,results));assert.throws(()=>cardioTimingReport(design,plan,[results[1]]));assert.throws(()=>cardioTimingReport(design,[.25,.25],[]));
 const d={...D,lengthKm:2200,perigeeKm:700,apogeeKm:2400},blocked=simulateCardioRelease(d,.25);
 assert.equal(cardioTimingReport(d,[.25],[blocked]).results[0].release,null);assert.equal(D.spinRatio,2);
});
