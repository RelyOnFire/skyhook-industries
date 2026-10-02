import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecastNetwork, previewService } from '../.lab-test/campaign/forecast.js';
import { acceptContract, addContractService, activeContract, addService, advance, createCampaign, LIMITS, validateCampaign } from '../.lab-test/campaign/model.js';
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

test('new service preview matches actual scheduling, competition and arrivals without mutating its source',()=>{
  const world=addService(createCampaign('preview','Preview'),'earth','moon',10,'tug','equipment',2);
  const original=structuredClone(world),draft={from:'earth',to:'phobos',cargoT:10,mode:'tug',kind:'equipment',intervalDays:1};
  const result=previewService(world,draft,365),scheduled=addService(world,draft.from,draft.to,draft.cargoT,draft.mode,draft.kind,draft.intervalDays),actual=advance(scheduled,365);
  assert.deepEqual(world,original);
  assert.equal(result.serviceId,world.nextService);
  assert.deepEqual(result.current,forecastNetwork(world,365));
  const service=actual.services.find(s=>s.id===result.serviceId);
  assert.equal(result.proposed.serviceDeparturesById[service.id],service.dispatched);
  assert.equal(result.proposed.serviceReceivedTById[service.id],service.deliveredT);
  assert.equal(result.proposed.fuelLater,actual.fuelT);
  assert.ok(result.proposed.delayed.some(item=>item.id===service.id&&item.reason.includes('equipment')));
  assert.ok(result.proposed.delayed.some(item=>item.id===world.services[0].id));
  assert.ok(service.deliveredT>0);
  assert.equal(service.deliveredT+actual.flights.filter(f=>f.serviceId===service.id).reduce((sum,f)=>sum+f.cargoT,0),service.dispatched*draft.cargoT);
  const short=previewService(world,draft,30);
  assert.ok(short.proposed.serviceDeparturesById[service.id]>0);
  assert.equal(short.proposed.serviceReceivedTById[service.id],0,'in-flight cargo is not received cargo');
});

test('new service preview enforces scheduling limits and clips both plans to the same horizon',()=>{
  const world=createCampaign('preview-limits','Preview limits'),original=structuredClone(world);
  const draft={from:'earth',to:'moon',cargoT:10,mode:'tug',kind:'equipment',intervalDays:30};
  for(const invalid of [{...draft,cargoT:11},{...draft,intervalDays:0},{...draft,to:'mercury'},{...draft,to:'earth'},{...draft,kind:'water'}])assert.throws(()=>previewService(world,invalid,30));
  let full=world;for(let i=0;i<LIMITS.services;i++)full=addService(full,draft.from,draft.to,draft.cargoT,draft.mode,draft.kind,draft.intervalDays);
  assert.throws(()=>previewService(full,draft,30),/12 scheduled/);
  const ending={...world,day:LIMITS.days-1.5},end=previewService(ending,draft,365);
  assert.equal(end.current.days,1.5);assert.equal(end.proposed.toDay,LIMITS.days);
  assert.throws(()=>previewService({...world,day:LIMITS.days-.5},draft,30),/horizon/);
  assert.deepEqual(world,original);
});


test('contract service forecast projects consumed customer freight and payment through a long deadline',()=>{
  let world=validateCampaign(JSON.parse(readFileSync(new URL('./fixtures/campaign-v5.json',import.meta.url))).state);
  world.services=[];
  world.ports.moon.materialsT=600;
  world.ports.moon.equipmentT=100;
  world.ports.moon.level=3;
  world.ports.phobos.level=3;
  world.ports.moon.readyDay=world.day;
  world.ports.phobos.readyDay=world.day;
  world=acceptContract(world,'mars-build','industrial');
  const order=activeContract(world),days=order.dueDay-world.day;
  assert.ok(days>365,'the industrial loading window extends past a one-year forecast');
  const original=structuredClone(world);
  const draft={from:'moon',to:'phobos',kind:'materials',mode:'tether',cargoT:30,intervalDays:2,contractId:order.id};
  const preview=previewService(world,draft,days);
  const actual=advance(addContractService(world,order.id,30,'tether',2),days);
  assert.deepEqual(world,original);
  assert.equal(preview.proposed.toDay,order.dueDay);
  assert.equal(preview.proposed.contracts[0].status,'completed');
  assert.equal(preview.proposed.customerDeliveredT,300);
  assert.equal(preview.proposed.creditsLater,3000);
  assert.equal(preview.proposed.receivedT,preview.current.receivedT,'buyer receipts do not become network depot receipts');
  assert.equal(preview.proposed.creditsLater,actual.commerce.credits);
  assert.equal(preview.proposed.serviceDeparturesById[world.nextService],10);
  assert.deepEqual(preview.proposed.ports.map(p=>p.later),preview.proposed.ports.map(p=>actual.ports[p.id]));
  assert.deepEqual(validateCampaign(actual),actual);
});
