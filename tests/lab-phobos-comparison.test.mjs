import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOBOS_DEFAULT as D, PHOBOS, MARS_X, RATE, PERIOD, TERMINAL_KG, runPhobos } from '../.lab-test/simulation/phobos.js';
import { phobosComparisonMetrics, phobosComparisonPaths, phobosCargoPath, phobosDesignChanges, phobosFlightVerdict, exportPhobosComparison } from '../.lab-test/simulation/phobos-comparison.js';

const pinned=runPhobos(D),current=runPhobos({...D,inwardKm:1350}),stopped=runPhobos({...D,inwardKm:1500});
const blocked=runPhobos({...D,inwardKm:1}),outward=runPhobos({...D,release:'outward'});
const metric=(rows,id)=>rows.find(row=>row.id===id);

test('P1 comparison preserves results and reports signed orbit, cable and positioning-work changes in explicit units',()=>{
  const before=JSON.stringify([pinned,current]),rows=phobosComparisonMetrics(pinned,current),reverse=phobosComparisonMetrics(current,pinned);
  assert.equal(phobosFlightVerdict(pinned),'Low-pass target');assert.equal(phobosFlightVerdict(current),'Low-pass target');
  assert.ok(Math.abs(metric(rows,'periapsis').delta-(current.orbit.periapsis-pinned.orbit.periapsis)/1000)<1e-9);
  assert.equal(metric(rows,'energy').current,current.orbit.energy/1e6);
  assert.equal(metric(rows,'mass').current,(current.loads.reduce((sum,l)=>sum+l.massKg,0)+2*TERMINAL_KG)/1000);
  assert.equal(metric(rows,'margin').current,Math.min(...current.loads.map(l=>l.margin)));
  assert.equal(metric(rows,'anchor').current,current.budget.anchorWorkJ/1e9);
  assert.equal(metric(rows,'winch').current,current.budget.winchWorkJ/1e9);
  assert.equal(metric(rows,'duration').current,2*PERIOD/3600);
  for(const row of rows){assert.ok(Number.isFinite(row.delta));assert.equal(row.delta+metric(reverse,row.id).delta,0);}
  assert.equal(JSON.stringify([pinned,current]),before);
});
test('P1 comparison distinguishes blocked release, unbound release energy and actual boundary stops',()=>{
  const rows=phobosComparisonMetrics(pinned,blocked);
  for(const id of ['altitude','periapsis','apoapsis','energy']){assert.equal(metric(rows,id).current,null);assert.equal(metric(rows,id).delta,null);}
  assert.equal(metric(rows,'duration').current,0);assert.equal(phobosFlightVerdict(blocked),'Release blocked');
  assert.equal(metric(rows,'anchor').current,blocked.budget.anchorWorkJ/1e9);
  const stop=phobosComparisonMetrics(pinned,stopped);assert.ok(Math.abs(metric(stop,'altitude').current-150)<1e-6);
  assert.ok(metric(stop,'duration').current<metric(stop,'duration').pinned);assert.equal(phobosFlightVerdict(stopped),'Mars boundary reached');
  assert.equal(phobosFlightVerdict(outward),'Clear flight · escape energy');
  const escape=phobosComparisonMetrics(pinned,outward);assert.equal(metric(escape,'apoapsis').current,null);assert.equal(metric(escape,'apoapsis').delta,null);
  assert.ok(metric(escape,'energy').current>0);assert.ok(metric(escape,'anchor').pinned<0&&metric(escape,'anchor').current>0);
  assert.equal(phobosFlightVerdict(runPhobos(D,{duration:300})),'Incomplete flight');
});
test('P1 paths rotate each stored frame about Mars at its own time and retain exact early-stop endpoints',()=>{
  const paths=phobosComparisonPaths(pinned,stopped);
  for(const [key,result] of [['pinned',pinned],['current',stopped]]){
    const path=paths[key];assert.equal(path.length,result.frames.length);assert.equal(path[0].t,0);assert.equal(path.at(-1).t,result.duration);
    for(let i=0;i<path.length;i++){
      const f=result.frames[i],p=path[i],c=Math.cos(RATE*f.t),s=Math.sin(RATE*f.t),x=f.state[0]-MARS_X,y=f.state[1];
      assert.equal(p.state[0],c*x-s*y);assert.equal(p.state[1],s*x+c*y);
      assert.ok(Math.hypot(p.state[0],p.state[1])<paths.extent);assert.ok(i===0||p.t>path[i-1].t);
    }
    const quarter=path[Math.floor(path.length/4)];assert.notEqual(quarter.state[1],result.frames[Math.floor(path.length/4)].state[1]);
  }
  assert.deepEqual(phobosCargoPath(blocked),[]);assert.ok(phobosComparisonPaths(blocked,blocked).extent>PHOBOS.separation);
  const escape=phobosComparisonPaths(pinned,outward);assert.ok(escape.extent>paths.extent);
  paths.pinned[0].state[0]=0;assert.notEqual(pinned.frames[0].state[0],0);
});
test('P1 comparison records every changed input and exports both complete accepted results including raw blocked-state scope',()=>{
  assert.deepEqual(phobosDesignChanges(D,current.design),[{key:'inwardKm',label:'Inward arm',unit:'km',pinned:1250,current:1350}]);
  assert.equal(phobosDesignChanges(D,{...D,release:'outward',inwardKm:1300,outwardKm:3500,payloadT:4,areaMm2:60,material:'kevlar',safetyFactor:2.1}).length,7);
  assert.deepEqual(phobosDesignChanges(D,{...D}),[]);
  const file=JSON.parse(JSON.stringify(exportPhobosComparison(pinned,current)));
  assert.equal(file.format,'skyhook-phobos-comparison');assert.equal(file.version,1);assert.equal(file.model,D.model);
  assert.deepEqual(file.pinned,pinned);assert.deepEqual(file.current,current);assert.deepEqual(file.metrics,phobosComparisonMetrics(pinned,current));
  const failedFile=JSON.parse(JSON.stringify(exportPhobosComparison(pinned,blocked)));assert.deepEqual(failedFile.current,blocked);
  assert.match(file.scope,/rotating barycentric SI/);assert.match(file.scope,/actual end/);assert.match(file.scope,/current minus pinned/);assert.match(file.scope,/unflown terminal state/);
});
