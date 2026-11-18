import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  acceptContract,activeContract,addContractService,addService,advance,cancelContract,CAMPAIGN_MODEL,
  CONTRACT_OFFERS,commissionEarthDesign,contractFlightPlan,contractQuote,contractRemaining,createCampaign,dispatch,
  dispatchContract,exportCampaign,importCampaign,isCustomerFreight,LIMITS,nextEventDay,
  procure,procurementReason,PROCUREMENT_PRICES,removeService,serviceFlightPlan,SOLAR,toggleService,validateCampaign,
} from '../.lab-test/campaign/model.js';
import {updateService} from '../.lab-test/campaign/service-edit.js';
import {DEFAULT,simulate} from '../.lab-test/simulation/engine.js';
import {earthDesignReport} from '../.lab-test/simulation/expedition-design.js';

const freshCommerceAt=day=>{const commerce=createCampaign('x','x').commerce;Object.assign(commerce.market,{startedDay:day,nextReviewDay:day+90,nextRivalDay:day+15});return commerce;};

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
function network() {
  const w=createCampaign('commerce-test','Working customer network');
  Object.assign(w.ports.moon,{level:1,industry:true,materialsT:100,equipmentT:100});
  w.ports.phobos.level=1;w.solar.unlocked=true;w.ports.mercury.level=1;
  w.ports.earth.equipmentT=100;
  return validateCampaign(w);
}
const accepted=(offer='lunar-return')=>acceptContract(network(),offer,'standard');
function completed(offer='lunar-return') {
  let w=accepted(offer);
  for(let i=0;i<3;i++)w=dispatchContract(w,1,10,'tug');
  return advance(w,w.flights[0].arrival-w.day);
}

test('contracts: offers require infrastructure, accept without stock, and freeze useful delivery terms',()=>{
  assert.match(contractQuote(createCampaign('new','New'),'lunar-return','standard').reason,/Commission/);
  const w=network();w.ports.moon.materialsT=0;
  const q=contractQuote(w,'lunar-return','standard');
  assert.equal(q.reason,'');assert.equal(q.quantityT,30);assert.equal(q.loadingWindowDays,30);
  assert.equal(q.lastDepartureDay,30);near(q.dueDay,30+q.duration);
  assert.equal(q.baseCredits,120);assert.equal(q.bonusCredits,30);assert.equal(q.totalCredits,150);
  assert.match(contractQuote(w,'lunar-return','industrial').reason,/Industrial/);
  const missing=structuredClone(w);missing.ports.moon.industry=false;
  assert.match(contractQuote(missing,'lunar-return','standard').reason,/lunar processor/);
  const before=structuredClone(w),next=acceptContract(w,'lunar-return','standard');
  assert.deepEqual(w,before);assert.equal(next.day,w.day);assert.deepEqual(next.ports,w.ports);
  assert.deepEqual(next.flights,w.flights);assert.deepEqual(next.services,w.services);assert.deepEqual(next.solar,w.solar);
  assert.equal(next.fuelT,w.fuelT);assert.equal(next.commerce.credits,0);assert.equal(next.revision,w.revision+1);
  assert.equal(activeContract(next).dueDay,q.dueDay);assert.deepEqual(validateCampaign(next),next);
  assert.throws(()=>acceptContract(next,'lunar-return','standard'),/active contract/);
  assert.throws(()=>dispatchContract(next,1,10,'tug'),/Not enough/);
  assert.throws(()=>contractQuote(w,'unknown','standard'),/Unknown/);
  assert.throws(()=>contractQuote(w,'lunar-return','unknown'),/standard or industrial/);
  const mature=validateCampaign(JSON.parse(readFileSync(new URL('./fixtures/campaign-v6.json',import.meta.url))).state);
  const industrial=contractQuote(mature,'lunar-return','industrial');
  assert.equal(industrial.reason,'');assert.equal(industrial.quantityT,300);assert.equal(industrial.loadingWindowDays,120);
  const nearEnd=network();nearEnd.day=LIMITS.days-35;
  assert.match(contractQuote(nearEnd,'lunar-return','standard').reason,/horizon/);
});

test('contracts: each buyer consumes cargo once on arrival, pays once, and never credits legacy objectives or depot supply',()=>{
  for(const offer of CONTRACT_OFFERS) {
    let w=accepted(offer.id),start=structuredClone(w);
    for(let i=0;i<3;i++)w=dispatchContract(w,1,10,'tug');
    const resource=offer.kind==='materials'?'materialsT':'equipmentT';
    assert.equal(w.ports[offer.from][resource],start.ports[offer.from][resource]-30);
    assert.ok(w.fuelT<start.fuelT);assert.equal(w.commerce.credits,0);
    assert.deepEqual(contractRemaining(w,1),{unassignedT:0,inFlightT:30});
    assert.ok(w.flights.every(f=>isCustomerFreight(w,f)));
    assert.throws(()=>dispatchContract(w,1,1,'tug'),/already in flight/);
    assert.throws(()=>procure(w,'fuel',1),/credits/);
    const expected=start.ports[offer.to][resource],received=start.ports[offer.to].receivedT;
    w=importCampaign(exportCampaign(w),'restored');
    w=advance(w,w.flights[0].arrival-w.day);
    assert.equal(w.commerce.credits,30*offer.rate*1.25);
    assert.equal(w.commerce.earnedCredits,w.commerce.credits);assert.equal(w.commerce.spentCredits,0);
    assert.equal(w.commerce.contracts[0].deliveredT,30);assert.equal(w.commerce.contracts[0].status,'completed');
    assert.equal(w.ports[offer.to][resource],expected);assert.equal(w.ports[offer.to].receivedT,received);
    assert.equal(w.lunarReturnedT,start.lunarReturnedT);assert.equal(w.lunarPhobosDeliveredT,start.lunarPhobosDeliveredT);
    assert.equal(activeContract(w),null);assert.equal(w.flights.length,0);
    assert.deepEqual(validateCampaign(w),w);
    const paid=w.commerce.credits;w=advance(w,500);assert.equal(w.commerce.credits,paid);
    assert.throws(()=>cancelContract(w,1),/already settled/);
  }
});

test('contracts: ordinary cargo before and after acceptance remains depot supply, never retroactive customer progress',()=>{
  let w=dispatch(network(),'moon','earth',10,'tug','materials');
  w=acceptContract(w,'lunar-return','standard');
  w=dispatch(w,'moon','earth',10,'tug','materials');
  w=dispatchContract(w,1,10,'tug');
  assert.deepEqual(w.flights.map(f=>isCustomerFreight(w,f)),[false,false,true]);
  w=advance(w,w.flights[0].arrival-w.day);
  assert.equal(w.ports.earth.materialsT,180);assert.equal(w.lunarReturnedT,20);
  assert.equal(w.ports.earth.receivedT,20);assert.equal(w.commerce.contracts[0].deliveredT,10);assert.equal(w.commerce.credits,40);
  const due=w.commerce.contracts[0].dueDay;
  assert.equal(nextEventDay(w),Math.min(due,w.commerce.market.nextRivalDay));
  w=advance(w,due-w.day);
  assert.equal(w.commerce.contracts[0].status,'expired');assert.equal(w.commerce.credits,40);
  assert.equal(w.commerce.contracts[0].settledDay,due);assert.equal(w.commerce.cooldowns['lunar-return'],due+90);
  assert.deepEqual(validateCampaign(w),w);
});

test('contracts: deadlines include transit; last-day arrivals win before expiry and no late departures are booked',()=>{
  let w=advance(accepted(),30),due=activeContract(w).dueDay;
  assert.equal(contractFlightPlan(w,1,10,'tug').reason,'');
  const late=advance(w,0.001);
  assert.match(contractFlightPlan(late,1,10,'tug').reason,/deadline/);
  assert.throws(()=>dispatchContract(late,1,10,'tug'),/deadline/);
  assert.throws(()=>addContractService(w,1,10,'tug',1),/deadline/);
  for(let i=0;i<3;i++)w=dispatchContract(w,1,10,'tug');
  for(const f of w.flights)near(f.arrival,due);
  w=advance(w,due-w.day);
  assert.equal(w.commerce.contracts[0].status,'completed');assert.equal(w.commerce.credits,150);
  assert.equal(w.commerce.contracts[0].settledDay,due);assert.deepEqual(validateCampaign(w),w);
  let mars=accepted('mars-build');
  assert.ok(activeContract(mars).dueDay>290);
  mars=dispatchContract(mars,1,10,'tug');mars=advance(mars,30);
  assert.equal(mars.commerce.contracts[0].status,'active');assert.equal(mars.commerce.credits,0);
  mars=advance(mars,activeContract(mars).dueDay-mars.day);
  assert.equal(mars.commerce.contracts[0].status,'expired');assert.equal(mars.commerce.credits,80);
});

test('contracts: cancellation preserves earned credits, stops booking, and returns committed cargo to reserved depot storage',()=>{
  let w=accepted();w=addContractService(w,1,10,'tug',10);w=advance(w,8);
  assert.equal(w.commerce.credits,40);assert.equal(w.commerce.contracts[0].deliveredT,10);
  w=dispatchContract(w,1,10,'tug');const flight=structuredClone(w.flights[0]);
  w=cancelContract(w,1);
  assert.equal(w.services[0].enabled,false);assert.deepEqual(w.flights[0],flight);
  assert.equal(isCustomerFreight(w,w.flights[0]),false);
  assert.equal(w.commerce.credits,40);assert.match(contractQuote(w,'lunar-return','standard').reason,/another order/);
  assert.throws(()=>toggleService(w,1),/already settled/);
  assert.throws(()=>dispatchContract(w,1,1,'tug'),/already settled/);
  w.ports.earth.materialsT=LIMITS.stock-10;
  assert.deepEqual(validateCampaign(w),w);
  w=advance(w,flight.arrival-w.day);
  assert.equal(w.ports.earth.materialsT,LIMITS.stock);assert.equal(w.lunarReturnedT,10);assert.equal(w.commerce.credits,40);
  const until=w.commerce.cooldowns['lunar-return'];w=advance(w,until-w.day);
  assert.equal(contractQuote(w,'lunar-return','standard').reason,'');
  assert.deepEqual(validateCampaign(w),w);
});

test('contracts: services clamp the final shipment and pause all lines when the order is assigned',()=>{
  let w=addContractService(accepted(),1,7,'tug',2);
  assert.equal(serviceFlightPlan(w,w.services[0]).cargoT,7);
  w=advance(w,9);
  assert.equal(w.services[0].dispatched,5);assert.equal(w.services[0].enabled,false);
  assert.equal(w.flights.at(-1).cargoT,2);assert.equal(contractRemaining(w,1).unassignedT,0);
  assert.equal(serviceFlightPlan(w,w.services[0]).cargoT,0);
  assert.throws(()=>toggleService(w,1),/already in flight/);
  const changed=updateService(w,1,9,50);
  assert.deepEqual(changed.flights,w.flights);assert.equal(changed.services[0].nextDay,w.services[0].nextDay);
  w=removeService(changed,1);w=advance(w,30);
  assert.equal(w.commerce.contracts[0].status,'completed');assert.equal(w.commerce.credits,150);
  assert.equal(w.flights.length,0);assert.deepEqual(validateCampaign(w),w);
  let multiple=addContractService(addContractService(accepted(),1,10,'tug',1),1,10,'tug',1);
  multiple=advance(multiple,2);
  assert.equal(multiple.flights.reduce((sum,f)=>sum+f.cargoT,0),30);
  assert.ok(multiple.services.every(s=>!s.enabled));assert.deepEqual(validateCampaign(multiple),multiple);
});

test('contracts: commercial bookings share ordinary recovery, stock, fuel and service priority',()=>{
  let w=addService(network(),'moon','earth',10,'tether','materials',100);
  w=acceptContract(w,'lunar-return','standard');w=addContractService(w,1,10,'tether',2);
  const blocked=[];w=advance(w,3,attempt=>blocked.push(attempt));
  assert.equal(w.services[0].dispatched,1);assert.equal(w.services[1].dispatched,1);
  assert.equal(w.flights[0].contractId,null);assert.equal(w.flights[1].contractId,1);
  assert.deepEqual(blocked.map(b=>b.serviceId),[2,2]);assert.ok(blocked.every(b=>b.reason.includes('recovering')));
  const dry=accepted();dry.fuelT=0;assert.match(contractFlightPlan(dry,1,10,'tug').reason,/propellant/);
  const full=accepted();full.ports.earth.materialsT=LIMITS.stock;
  assert.match(contractFlightPlan(full,1,10,'tug').reason,/storage/);
  let produced=accepted();produced.ports.moon.materialsT=0;
  produced=addContractService(produced,1,10,'tug',10);produced=advance(produced,activeContract(produced).dueDay);
  assert.equal(produced.commerce.contracts[0].status,'completed');assert.equal(produced.services[0].dispatched,3);
});

test('commerce: procurement debits a conserved ledger, buys only Earth stock or pooled fuel, and cannot fund its own cargo',()=>{
  let w=completed('mercury-tooling');
  const before=structuredClone(w),earned=w.commerce.earnedCredits;
  w=procure(w,'materials',2);w=procure(w,'equipment',3);w=procure(w,'fuel',5);
  assert.equal(w.ports.earth.materialsT,before.ports.earth.materialsT+2);
  assert.equal(w.ports.earth.equipmentT,before.ports.earth.equipmentT+3);assert.equal(w.fuelT,before.fuelT+5);
  for(const id of ['moon','phobos','mercury','ceres'])assert.deepEqual(w.ports[id],before.ports[id]);
  assert.equal(w.commerce.earnedCredits,earned);assert.equal(w.commerce.spentCredits,124);
  assert.equal(w.commerce.credits,earned-124);assert.equal(w.day,before.day);assert.deepEqual(w.flights,before.flights);
  assert.deepEqual(validateCampaign(w),w);
  for(const offer of CONTRACT_OFFERS)assert.ok(offer.rate*1.25<PROCUREMENT_PRICES[offer.kind]);
  for(const amount of [0,-1,1.2,NaN,Infinity,LIMITS.stock+1])assert.throws(()=>procure(w,'fuel',amount));
  assert.throws(()=>procure(w,'water',1),/Choose material/);
  assert.throws(()=>procure(w,'equipment',1000),/credits/);
  const full=structuredClone(w);full.fuelT=LIMITS.stock;assert.match(procurementReason(full,'fuel',1),/no room/);
  let incoming=dispatch(w,'moon','earth',10,'tug','materials');incoming.ports.earth.materialsT=LIMITS.stock-10;
  assert.match(procurementReason(incoming,'materials',1),/incoming deliveries/);
  assert.deepEqual(validateCampaign(incoming),incoming);
});

test('contracts: large steps, fractional steps and reload preserve exact settlements and booking decisions',()=>{
  let base=addContractService(accepted(),1,7,'tether',2),fine=base;
  const coarse=advance(base,400);
  for(let i=0;i<1600;i++)fine=advance(fine,.25);
  const restored=advance(importCampaign(exportCampaign(advance(base,3.125)),'copy'),396.875);
  for(const candidate of [fine,restored]) {
    assert.deepEqual(candidate.commerce,coarse.commerce);assert.deepEqual(candidate.flights,coarse.flights);
    assert.deepEqual(candidate.services,coarse.services);near(candidate.fuelT,coarse.fuelT);
    for(const id of Object.keys(coarse.ports))for(const key of ['materialsT','equipmentT','receivedT','sentT','readyDay'])near(candidate.ports[id][key],coarse.ports[id][key]);
    assert.deepEqual(validateCampaign(candidate),candidate);
  }
});

test('contracts: malformed money, cargo ownership, progress, clocks and completion records are rejected',()=>{
  const pending=dispatchContract(addContractService(accepted(),1,10,'tug',2),1,10,'tug');
  const badEdits=[
    w=>delete w.commerce,w=>w.commerce.credits++,w=>w.commerce.spentCredits++,w=>w.commerce.earnedCredits=-1,
    w=>w.commerce.contracts.push({...w.commerce.contracts[0]}),w=>w.commerce.contracts[0].dueDay++,
    w=>w.commerce.contracts[0].deliveredT=31,w=>w.commerce.contracts[0].earnedCredits++,
    w=>w.commerce.contracts[0].acceptedDay=1,w=>w.commerce.contracts[0].size='huge',
    w=>w.commerce.contracts[0].status='completed',w=>w.commerce.contracts[0].settledDay=0,
    w=>w.commerce.cooldowns['lunar-return']=1,w=>w.flights[0].contractId=999,
    w=>w.flights[0].kind='equipment',w=>{w.flights[0].contractId=null;w.flights[0].serviceId=1;},
    w=>w.services[0].contractId=999,w=>w.services[0].kind='equipment',
    w=>{for(let i=0;i<3;i++)w.flights.push({...w.flights[0],id:w.nextShipment++});},
  ];
  for(const mutate of badEdits) {
    const bad=structuredClone(pending);mutate(bad);assert.throws(()=>validateCampaign(bad),undefined,String(mutate));
  }
  const done=completed();
  for(const mutate of [w=>w.commerce.contracts[0].deliveredT--,w=>w.commerce.cooldowns['lunar-return']=0,w=>w.commerce.contracts[0].status='expired']) {
    const bad=structuredClone(done);mutate(bad);assert.throws(()=>validateCampaign(bad));
  }
  const empty=network();empty.commerce.credits=empty.commerce.earnedCredits=10;assert.throws(()=>validateCampaign(empty),/ledger/);
});

test('contracts: repeat orders enforce persistent cooldowns and bounded history retains referenced services',()=>{
  let w=addContractService(accepted(),1,10,'tug',1);w=cancelContract(w,1);
  assert.throws(()=>acceptContract(w,'lunar-return','standard'),/another order/);
  for(let i=0;i<25;i++) {
    w=advance(w,w.commerce.cooldowns['lunar-return']-w.day);
    w=acceptContract(w,'lunar-return','standard');w=cancelContract(w,activeContract(w).id);
  }
  assert.equal(w.commerce.contracts.length,21);assert.equal(w.commerce.contracts[0].id,1);
  assert.deepEqual(validateCampaign(w),w);
  w=removeService(w,1);assert.equal(w.commerce.contracts.length,20);
  assert.deepEqual(importCampaign(exportCampaign(w),'copy'),{...w,id:'copy',revision:0});
  assert.ok(new TextEncoder().encode(exportCampaign(w)).length<LIMITS.fileBytes);
});

test('commerce: full traffic and retained customer history export below the portable file limit',()=>{
  let w=validateCampaign(JSON.parse(readFileSync(new URL('./fixtures/campaign-v6.json',import.meta.url))).state);
  w.services=[];w.solar.autoLaunch=false;w.solar.nextLaunchDay=null;
  w=advance(w,700);
  for(let i=0;i<32;i++) {
    if(i)w=advance(w,w.commerce.cooldowns['lunar-return']-w.day);
    w=acceptContract(w,'lunar-return','standard');
    const id=activeContract(w).id;
    if(i<12)w=addContractService(w,id,10,'tug',1);
    w=cancelContract(w,id);
  }
  assert.equal(w.commerce.contracts.length,32);assert.equal(w.services.length,LIMITS.services);
  while(w.flights.length<LIMITS.cargoFlights)w=dispatch(w,'earth','moon',1,'tug','equipment');
  while(w.solar.deployments.length<LIMITS.mirrorDeployments) {
    w.solar.deployments.push({id:w.solar.nextDeployment++,massT:1,departed:w.day,arrival:w.day+SOLAR.deploymentDays});
    w.solar.manufacturedT++;
  }
  w.log=Array.from({length:60},()=>({day:w.day,text:'Cargo account history. '.padEnd(300,'x')}));
  const encoded=exportCampaign(w);
  assert.ok(new TextEncoder().encode(encoded).length<LIMITS.fileBytes);
  assert.deepEqual(importCampaign(encoded,'full-copy'),{...w,id:'full-copy',revision:0});
});

test('commerce: every older schema migrates with zero credits and unchanged traffic, supplies and clocks',()=>{
  for(let version=1;version<=8;version++) {
    let raw;
    if(version<8)raw=JSON.parse(readFileSync(new URL(`./fixtures/campaign-v${version}.json`,import.meta.url))).state;
    else {
      const measured=commissionEarthDesign(network(),earthDesignReport(simulate(DEFAULT)));
      raw=addService(dispatch(measured,'moon','earth',10,'tether'),'earth','moon',5,'tug','equipment',30);
      raw.schema=8;raw.model='network-0.8.0';delete raw.commerce;
      for(const f of raw.flights)delete f.contractId;for(const s of raw.services)delete s.contractId;
    }
    const before=structuredClone(raw),next=validateCampaign(raw);
    assert.deepEqual(raw,before);assert.equal(next.schema,10);assert.equal(next.model,CAMPAIGN_MODEL);
    assert.deepEqual(next.commerce,freshCommerceAt(raw.day));
    for(const key of ['id','name','day','revision','fuelT','nextShipment','nextSupplyDay','lunarReturnedT','log'])assert.deepEqual(next[key],raw[key]);
    for(const f of raw.flights)for(const key of Object.keys(f))assert.deepEqual(next.flights.find(item=>item.id===f.id)[key],f[key]);
    assert.ok(next.flights.every(f=>f.contractId===null));assert.ok(next.services.every(s=>s.contractId===null));
    if(version===8)assert.deepEqual(next,{...raw,schema:10,model:CAMPAIGN_MODEL,commerce:freshCommerceAt(raw.day),flights:raw.flights.map(f=>({...f,contractId:null})),services:raw.services.map(s=>({...s,contractId:null}))});
    assert.deepEqual(importCampaign(JSON.stringify({format:'skyhook-campaign',version,state:raw}),'copy'),{...next,id:'copy',revision:0});
    assert.deepEqual(validateCampaign(next),next);
  }
});
