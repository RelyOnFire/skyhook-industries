import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutStudyLabels} from '../.lab-test/lab/study-plot.js';
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function check(points) {
  const before=JSON.stringify(points),labels=layoutStudyLabels(points);
  assert.equal(JSON.stringify(points),before,'Do not move observations');
  assert.equal(labels.length,points.length);
  for(let i=0;i<labels.length;i++) {
    const a=labels[i];assert.ok(a,'Each small-study result needs a callout');
    assert.ok(a.x>=65&&a.x+a.width<=565&&a.y>=26&&a.y+a.height<=235);
    for(const b of labels.slice(i+1))assert.equal(overlap(a,b),false);
    for(const p of points)assert.equal(overlap(a,{x:p.x-20,y:p.y-20,width:40,height:40}),false);
  }
  assert.deepEqual(labels,layoutStudyLabels(points),'Placement must be deterministic');
}
test('coincident power-study results retain separate labels and exact marker positions',()=>check(Array.from({length:4},()=>({x:307,y:61}))));
test('near-coincident power-study results have non-overlapping label hit areas',()=>check([{x:491,y:61},{x:307,y:61},{x:306.9,y:61.1},{x:306.9,y:61.1} ]));
test('labels remain inside the graph at every plot boundary',()=>{
  for(const x of [65,310,555])for(const y of [35,135,235])check(Array.from({length:4},()=>({x,y})));
});
test('empty and non-finite observations do not create misleading annotations',()=>{
  assert.deepEqual(layoutStudyLabels([]),[]);
  assert.deepEqual(layoutStudyLabels([{x:NaN,y:30},{x:Infinity,y:60}]),[null,null]);
});
