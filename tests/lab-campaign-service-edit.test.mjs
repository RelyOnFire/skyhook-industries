import test from 'node:test';
import assert from 'node:assert/strict';
import {addService, advance, createCampaign, toggleService, validateCampaign} from '../.lab-test/campaign/model.js';
import {updateService} from '../.lab-test/campaign/service-edit.js';

const scheduled = () => addService(createCampaign('service-edit', 'Supply line'), 'earth', 'moon', 5, 'tug', 'materials', 20);

test('service edit: unchanged settings are a true no-op; invalid settings leave the world untouched', () => {
  const world = scheduled(), before = structuredClone(world);
  assert.equal(updateService(world, 1, 5, 20), world);
  for (const [mass, interval] of [[0, 20], [-1, 20], [1.5, 20], [11, 20], [NaN, 20], [Infinity, 20], [5, 0], [5, 3651], [5, 1.5], [5, NaN], [5, Infinity]]) {
    assert.throws(() => updateService(world, 1, mass, interval));
  }
  assert.throws(() => updateService(world, 9, 5, 20), /Service not found/);
  assert.deepEqual(world, before);
});

test('service edit: preserves departures, current cargo, service identity, counters and every resource', () => {
  const world = advance(scheduled(), 15), before = structuredClone(world);
  const next = updateService(world, 1, 8, 90);
  assert.deepEqual(world, before);
  assert.deepEqual(next.services[0], {...world.services[0], cargoT: 8, intervalDays: 90});
  assert.deepEqual(next, {...world, revision: world.revision+1, services: next.services, log: next.log});
  assert.equal(next.log.length, world.log.length+1);
  assert.match(next.log.at(-1).text, /Service 1 updated: 8 t construction material, every 90 days/);
  assert.equal(next.log.at(-1).day, world.day);
  assert.deepEqual(validateCampaign(next), next);
});

test('service edit: changes apply at the existing next departure; in-flight cargo arrives only once', () => {
  const inFlight = advance(scheduled(), 1);
  assert.equal(inFlight.flights.length, 1);
  const arrival = inFlight.flights[0].arrival;
  let world = updateService(inFlight, 1, 8, 90);
  assert.deepEqual(world.flights, inFlight.flights);
  assert.equal(world.services[0].nextDay, 21);
  world = advance(world, arrival-world.day);
  assert.equal(world.services[0].deliveredT, 5);
  assert.equal(world.ports.moon.materialsT, 5);
  world = advance(world, 21-world.day);
  assert.equal(world.services[0].dispatched, 2);
  assert.equal(world.services[0].nextDay, 111);
  assert.equal(world.flights[0].cargoT, 8);
  world = advance(world, world.flights[0].arrival-world.day);
  assert.equal(world.services[0].deliveredT, 13);
  assert.equal(world.ports.moon.materialsT, 13);
});

test('service edit: paused and temporarily blocked lines remain editable without dispatch or rescheduling', () => {
  const paused = toggleService(advance(scheduled(), 1), 1);
  const edited = updateService(paused, 1, 9, 3650);
  assert.equal(edited.services[0].enabled, false);
  assert.equal(edited.services[0].nextDay, paused.services[0].nextDay);
  assert.deepEqual(advance(edited, 100).services[0], {...edited.services[0], deliveredT: 5});

  const blocked = addService(createCampaign('blocked', 'Unbuilt tethers'), 'earth', 'moon', 10, 'tether', 'materials', 20);
  const planned = updateService(blocked, 1, 30, 1);
  assert.equal(planned.services[0].nextDay, 1);
  assert.equal(planned.flights.length, 0);
  assert.deepEqual(validateCampaign(planned), planned);
  assert.throws(() => updateService(blocked, 1, 31, 20));
});

test('service edit: blocked departures retry daily before the new interval begins; history is bounded', () => {
  let world = scheduled();
  world.ports.earth.materialsT = 0;
  world = advance(world, 3);
  world = updateService(world, 1, 7, 90);
  assert.equal(world.services[0].nextDay, 4);
  world = advance(world, 1);
  assert.equal(world.services[0].dispatched, 0);
  assert.equal(world.services[0].nextDay, 5);
  world.ports.earth.materialsT = 7;
  world = advance(world, 1);
  assert.equal(world.services[0].dispatched, 1);
  assert.equal(world.services[0].nextDay, 95);
  for (let i=0; i<80; i++) world = updateService(world, 1, 7, 91+i);
  assert.equal(world.log.length, 60);
  assert.deepEqual(validateCampaign(world), world);
});
