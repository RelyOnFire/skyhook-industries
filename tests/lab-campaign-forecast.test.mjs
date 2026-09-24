import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecastNetwork } from '../.lab-test/campaign/forecast.js';
import { addService, advance, createCampaign, validateCampaign } from '../.lab-test/campaign/model.js';
import { updateService } from '../.lab-test/campaign/service-edit.js';

test('outlook uses the real engine without changing the saved world or its revision', () => {
  const world = addService(createCampaign('forecast', 'Forecast'), 'earth', 'moon', 10, 'tug', 'equipment', 1);
  const original = structuredClone(world);
  const outlook = forecastNetwork(world, 30);
  const actual = advance(world, 30);
  assert.deepEqual(world, original);
  assert.equal(outlook.fromDay, 0);
  assert.equal(outlook.toDay, actual.day);
  assert.equal(outlook.fuelLater, actual.fuelT);
  assert.equal(outlook.serviceDepartures, actual.services[0].dispatched - world.services[0].dispatched);
  assert.deepEqual(outlook.ports.map(port => port.later), outlook.ports.map(port => actual.ports[port.id]));
  assert.ok(outlook.delayed.length === 1 && outlook.delayed[0].attempts > 0);
  assert.equal(outlook.delayed[0].id, world.services[0].id);
  assert.equal(outlook.delayed[0].firstDay, 3);
  assert.match(outlook.delayed[0].reason,/Not enough equipment at Earth/);
  assert.equal(outlook.holds[0].kind,'service');
});

test('mature-network outlook projects cargo, swarm, fuel and service counts without committing', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json', import.meta.url)));
  const world = validateCampaign(fixture.state);
  const original = structuredClone(world);
  const outlook = forecastNetwork(world, 90);
  const actual = advance(world, 90);
  assert.deepEqual(world, original);
  assert.equal(outlook.toDay, actual.day);
  assert.equal(outlook.fuelLater, actual.fuelT);
  assert.equal(outlook.swarmLater, actual.solar.deployedT);
  assert.equal(outlook.receivedT, Object.keys(actual.ports).reduce((sum, id) => sum + actual.ports[id].receivedT - world.ports[id].receivedT, 0));
  assert.equal(outlook.serviceDepartures, actual.services.reduce((sum, service, i) => sum + service.dispatched - world.services[i].dispatched, 0));
});

test('outlook respects the remaining simulation horizon', () => {
  const world = createCampaign('horizon', 'Horizon');
  assert.equal(forecastNetwork(world, 30).activeServices, 0);
  world.day = 99999.5;
  const outlook = forecastNetwork(world, 365);
  assert.equal(outlook.days, 0.5);
  assert.equal(outlook.toDay, 100000);
  assert.equal(world.day, 99999.5);
  assert.throws(() => forecastNetwork({ ...world, day: 100000 }, 30), /horizon/);
});

test('outlook names actual automatic launch holds without consuming protected cargo fuel', () => {
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json', import.meta.url)));
  const world=validateCampaign(fixture.state);
  world.development.fuelReserveT=4000;
  const original=structuredClone(world),outlook=forecastNetwork(world,3),actual=advance(world,3);
  assert.deepEqual(world,original);
  assert.equal(outlook.mirrorLaunches,0);
  assert.equal(outlook.mirrorDelayed.length,1);
  assert.equal(outlook.mirrorDelayed[0].firstDay,world.solar.nextLaunchDay);
  assert.equal(outlook.mirrorDelayed[0].attempts,3);
  assert.match(outlook.mirrorDelayed[0].reason,/holding 4000 t of support propellant/);
  assert.deepEqual(outlook.ports.map(port=>port.later),outlook.ports.map(port=>actual.ports[port.id]));
  assert.equal(outlook.fuelLater,actual.fuelT);
  assert.deepEqual(validateCampaign(actual),actual);
});

test('a service schedule can be compared on a copy before changing the real world', () => {
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json',import.meta.url)));
  const world=validateCampaign(fixture.state),original=structuredClone(world);
  const baseline=forecastNetwork(world,365);
  const proposal=updateService(world,7,10,8);
  const alternative=forecastNetwork(proposal,365);
  assert.deepEqual(world,original);
  assert.equal(proposal.day,world.day);
  assert.deepEqual(proposal.flights,world.flights);
  assert.equal(proposal.services.find(s=>s.id===7).nextDay,world.services.find(s=>s.id===7).nextDay);
  assert.ok(alternative.serviceDeparturesById[7]>baseline.serviceDeparturesById[7]);
  assert.equal(baseline.serviceDepartures,Object.values(baseline.serviceDeparturesById).reduce((a,b)=>a+b,0));
  assert.equal(alternative.serviceDepartures,Object.values(alternative.serviceDeparturesById).reduce((a,b)=>a+b,0));
  assert.deepEqual(validateCampaign(proposal),proposal);
});
