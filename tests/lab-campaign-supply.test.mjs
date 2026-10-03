import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCampaign, dispatch, flightPlan, validateCampaign, tetherCapacity } from '../.lab-test/campaign/model.js';
import { suggestSupply } from '../.lab-test/campaign/supply.js';
import { simulate, DEFAULT } from '../.lab-test/simulation/engine.js';
import { earthDesignReport } from '../.lab-test/simulation/expedition-design.js';
const mature=()=>validateCampaign(JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json',import.meta.url))).state);

test('supply suggestions use productive connected depots without changing the world',()=>{
  const world=mature(),before=structuredClone(world);
  const material=suggestSupply(world,'phobos','materials');
  assert.equal(material.from,'moon');assert.equal(material.cargoT,10);assert.equal(material.mode,'tether');assert.equal(material.reason,'');
  const ceres=suggestSupply(world,'ceres','materials');
  assert.equal(ceres.from,'phobos');assert.equal(ceres.cargoT,7);
  const next=dispatch(world,ceres.from,ceres.to,ceres.cargoT,ceres.mode,ceres.kind);
  assert.equal(next.flights.at(-1).cargoT,7);
  assert.deepEqual(world,before);
  assert.equal(suggestSupply(world,'mercury','equipment').from,'earth');
});

test('ready departures outrank recovering suppliers and ties prefer lower fuel per tonne',()=>{
  const world=mature();world.ports.moon.readyDay=world.day+2;
  const alternative=suggestSupply(world,'phobos','materials');
  assert.equal(alternative.from,'mercury');assert.equal(alternative.reason,'');
  world.ports.moon.readyDay=world.day;
  assert.equal(suggestSupply(world,'phobos','materials').from,'moon');
  world.ports.moon.materialsT=3.7;world.ports.mercury.materialsT=0;
  assert.equal(suggestSupply(world,'phobos','materials').cargoT,3);
});

test('supply suggestions honor locks, water direction, tug bootstrapping and empty-stock fallback',()=>{
  const world=createCampaign('supply','Supply');
  assert.equal(suggestSupply(world,'moon','materials').mode,'tug');
  assert.equal(suggestSupply(world,'mercury','materials'),null);
  assert.equal(suggestSupply(world,'ceres','equipment'),null);
  assert.equal(suggestSupply(world,'moon','water'),null);
  world.ports.earth.equipmentT=.5;
  const empty=suggestSupply(world,'moon','equipment');
  assert.equal(empty.from,'earth');assert.equal(empty.cargoT,10);assert.match(empty.reason,/manufactures/);
  const developed=mature(),water=suggestSupply(developed,'phobos','water');
  assert.equal(water.from,'ceres');assert.equal(suggestSupply(developed,'ceres','water'),null);
  for(const amount of [0,-1,.5,NaN,Infinity])assert.throws(()=>suggestSupply(world,'moon','materials',amount));
});

test('supply suggestions respect measured Earth design capacity and requested project mass',()=>{
  const world=createCampaign('design-supply','Design supply');world.ports.moon.level=3;
  world.earthDesign=earthDesignReport(simulate({...DEFAULT,payloadT:1,areaMm2:60}));
  const suggestion=suggestSupply(world,'moon','equipment');
  assert.equal(suggestion.capacity,tetherCapacity(world,'earth'));assert.equal(suggestion.cargoT,3);
  assert.equal(flightPlan(world,suggestion.from,suggestion.to,suggestion.cargoT,suggestion.mode,suggestion.kind).reason,'');
  assert.equal(suggestSupply(world,'moon','equipment',2).cargoT,2);
});
