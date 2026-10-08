import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH } from '../.lab-test/simulation/engine.js';
import { T4_DEFAULT as D, runT4 } from '../.lab-test/simulation/t4.js';
import { t4ComparisonMetrics, t4ComparisonPaths, t4CargoPath, t4DesignChanges, t4FlightVerdict, exportT4Comparison } from '../.lab-test/simulation/t4-comparison.js';

const pinned=runT4({...D,phaseDeg:60}),current=runT4(D),failed=runT4({...D,secondaryAreaMm2:15,payloadT:8});
const metric=(rows,id)=>rows.find(row=>row.id===id);

test('T4 comparison reports signed changes in explicit units without altering either accepted result',()=>{
  const before=JSON.stringify([pinned,current]),rows=t4ComparisonMetrics(pinned,current),reversed=t4ComparisonMetrics(current,pinned);
  assert.equal(t4FlightVerdict(pinned),'Outside target band');assert.equal(t4FlightVerdict(current),'Target reached');
  assert.ok(Math.abs(metric(rows,'apoapsis').delta-(current.release.orbit.apoapsis-pinned.release.orbit.apoapsis)/1000)<1e-9);
  assert.equal(metric(rows,'pivot').current,current.peakPivotForce/1000);
  assert.equal(metric(rows,'mass').current,current.dryMass/1000);
  assert.equal(metric(rows,'margin').current,2.9e9/Math.max(...current.peakStress));
  assert.equal(metric(rows,'duration').current,120);
  for(const row of rows){assert.ok(Number.isFinite(row.delta));assert.equal(row.delta+metric(reversed,row.id).delta,0);}
  assert.equal(JSON.stringify([pinned,current]),before);
});
test('T4 comparison distinguishes absent release, escape and a shorter flight instead of inventing zero-valued orbit changes',()=>{
  const rows=t4ComparisonMetrics(current,failed);
  for(const key of ['apoapsis','periapsis']){assert.equal(metric(rows,key).current,null);assert.equal(metric(rows,key).delta,null);}
  assert.equal(t4FlightVerdict(failed),'Model limit reached');assert.equal(metric(rows,'duration').current,0);
  const escape={...current,release:{...current.release,orbit:{...current.release.orbit,apoapsis:null}}};
  assert.equal(metric(t4ComparisonMetrics(current,escape),'apoapsis').delta,null);
  assert.equal(t4FlightVerdict(escape),'Outside target band');
  assert.equal(t4FlightVerdict({...current,duration:300}),'Incomplete run');
  assert.equal(metric(t4ComparisonMetrics(current,{...current,peakStress:[0,0]}),'margin').delta,null);
});
test('T4 comparison paths use exact release and final cargo states in a shared Earth-centered extent',()=>{
  const paths=t4ComparisonPaths(pinned,current);
  for(const [key,result] of [['pinned',pinned],['current',current]]){
    const path=paths[key];assert.deepEqual(path[0],{t:result.release.t,state:result.release.state});
    assert.deepEqual(path.at(-1),{t:result.duration,state:result.frames.at(-1).cargo});
    assert.equal(path.filter(p=>p.t===result.release.t).length,1);
    assert.ok(path.every(p=>p.t>=result.release.t&&p.t<=result.duration&&Math.hypot(p.state[0],p.state[1])<paths.extent));
    assert.ok(path.every((p,i)=>!i||p.t>path[i-1].t));
  }
  assert.deepEqual(t4CargoPath(failed),[]);assert.ok(t4ComparisonPaths(failed,failed).extent>EARTH);
  paths.pinned[0].state[0]=0;assert.notEqual(pinned.release.state[0],0);
});
test('T4 comparison identifies phase, timing and hardware changes and exports both complete result snapshots',()=>{
  assert.deepEqual(t4DesignChanges(pinned.design,current.design),[{key:'phaseDeg',label:'Initial phase',unit:'°',pinned:60,current:180}]);
  const changed={...D,releaseMin:3,payloadT:4,primaryKm:400,secondaryKm:60,altitudeKm:1900,primarySpeedKms:1.1,secondarySpeedKms:-.8,primaryAreaMm2:155,secondaryAreaMm2:85,material:'kevlar',safetyFactor:2.1};
  assert.equal(t4DesignChanges(D,changed).length,11);assert.deepEqual(t4DesignChanges(D,{...D}),[]);
  const file=JSON.parse(JSON.stringify(exportT4Comparison(pinned,current)));
  assert.equal(file.format,'skyhook-t4-comparison');assert.equal(file.model,D.model);assert.equal(file.version,1);
  assert.deepEqual(file.pinned,pinned);assert.deepEqual(file.current,current);assert.deepEqual(file.metrics,t4ComparisonMetrics(pinned,current));
  const failedFile=JSON.parse(JSON.stringify(exportT4Comparison(current,failed)));assert.equal(failedFile.current.release,null);assert.equal(failedFile.current.duration,0);
  assert.match(file.scope,/actual end/);assert.match(file.scope,/current minus pinned/);
});
