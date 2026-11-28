import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDIO_REFERENCE_DEFAULT as D} from '../.lab-test/simulation/cardio-reference.js';
import {traceCardioReferenceRelease} from '../.lab-test/simulation/cardio-reference-release.js';
import {CARDIO_DEFAULT,readCardio} from '../.lab-test/simulation/cardio.js';
import {createCardioReferenceSetup as create,validateCardioReferenceSetup as validate,readCardioReferenceSetup as read,
  cardioReferenceFragment as fragment,CARDIO_REFERENCE_SAVE_KEY,CARDIO_REFERENCE_FILE_LIMIT} from '../.lab-test/simulation/cardio-reference-design.js';

test('reference file and fragment retain exact geometry, off-grid phase and trace selection',()=>{
  const design={perigeeKm:375.125,apogeeKm:2780.75,pickupKm:123.456},phase=.25123456789;
  for(const showTrace of [false,true]){
    const setup=create(design,phase,showTrace),raw=JSON.stringify(setup);
    assert.deepEqual(read(raw),setup);
    const params=new URLSearchParams(fragment(setup).slice(1));
    assert.equal(params.has('cardio'),false);assert.deepEqual(read(params.get('cardio-reference')),setup);
    assert.deepEqual(setup.design,design);assert.equal(setup.phase,phase);assert.equal(setup.showTrace,showTrace);
    assert.deepEqual(traceCardioReferenceRelease(read(raw).design,read(raw).phase),traceCardioReferenceRelease(design,phase));
  }
  assert.notEqual(CARDIO_REFERENCE_SAVE_KEY,'skyhook-lab-cardio-design-v1');
});

test('unknown formats, versions, models and malformed inputs are rejected before adoption',()=>{
  const setup=create(D,.5,true);
  for(const value of [null,[],{},CARDIO_DEFAULT,{...setup,version:2},{...setup,model:'C1k-9'},
    {...setup,format:'skyhook-cardio-reference-release'},{...setup,phase:NaN},{...setup,phase:Infinity},
    {...setup,phase:-.1},{...setup,phase:1.01},{...setup,phase:'0.5'},{...setup,showTrace:1},
    {...setup,design:{...D,pickupKm:0}},{...setup,design:{...D,apogeeKm:NaN}}])assert.throws(()=>validate(value));
  assert.throws(()=>read('{bad JSON'));
  assert.throws(()=>readCardio(JSON.stringify(setup)),'the passive importer remains separate');
  assert.deepEqual(readCardio(JSON.stringify(CARDIO_DEFAULT)),CARDIO_DEFAULT);
  for(const phase of [0,1])assert.equal(read(JSON.stringify(create(D,phase,false))).phase,phase);
});

test('normalization copies only accepted inputs and enforces a UTF-8 file limit',()=>{
  const setup=create(D,.5,true),dirty={...setup,frames:[{state:['untrusted result']}],design:{...D,armLength:999}};
  const before=structuredClone(dirty);
  assert.deepEqual(validate(dirty),setup);assert.deepEqual(dirty,before);
  const small=JSON.stringify(setup),exact=small+' '.repeat(CARDIO_REFERENCE_FILE_LIMIT-new TextEncoder().encode(small).length);
  assert.deepEqual(read(exact),setup);assert.throws(()=>read(exact+' '),/16 KB/);
  const unicode=JSON.stringify({...setup,note:'é'.repeat(9000)});
  assert.ok(unicode.length<CARDIO_REFERENCE_FILE_LIMIT);assert.throws(()=>read(unicode),/16 KB/);
});
