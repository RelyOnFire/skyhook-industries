import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  acceptContract,activeContracts,addContractService,advance,buyerMarket,cancelContract,CAMPAIGN_MODEL,
  CONTRACT_OFFERS,contractQuote,contractRemaining,createCampaign,dispatch,dispatchContract,exportCampaign,
  importCampaign,LIMITS,MARKET,nextEventDay,procure,PROCUREMENT_PRICES,RIVAL_OPERATORS,routeFor,validateCampaign,
} from '../.lab-test/campaign/model.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
const fixture=JSON.parse(readFileSync(new URL('./fixtures/campaign-v9.json',import.meta.url)));
const offerFor=id=>CONTRACT_OFFERS.find(offer=>offer.id===id);
function network() {
  const w=createCampaign('market-test','Customer demand');
  Object.assign(w.ports.moon,{level:1,industry:true,materialsT:1000,equipmentT:100});
  w.ports.phobos.level=1;w.solar.unlocked=true;w.ports.mercury.level=1;
  w.ports.earth.equipmentT=1000;w.fuelT=1000;
  return validateCampaign(w);
}
function ledger(w) {
  const market=w.commerce.market;
  for(const offer of CONTRACT_OFFERS) {
    const buyer=market.buyers[offer.id];
    assert.equal(buyer.openT+buyer.playerCommittedT+buyer.rivalCommittedT,buyerMarket(w,offer.id).requestedT);
  }
  for(const operator of RIVAL_OPERATORS)assert.ok(market.flights.filter(f=>f.operatorId===operator.id).length<=operator.maxFlights);
  assert.deepEqual(validateCampaign(w),w);
}

test('market: v9 migration preserves the real partially delivered order, locked pay, clocks and all resources',()=>{
  const old=fixture.state,before=structuredClone(fixture),w=validateCampaign(old);
  assert.deepEqual(fixture,before);assert.equal(w.schema,10);assert.equal(w.model,CAMPAIGN_MODEL);
  for(const key of Object.keys(old).filter(key=>!['schema','model','commerce'].includes(key)))assert.deepEqual(w[key],old[key],key);
  for(const key of Object.keys(old.commerce).filter(key=>key!=='contracts'))assert.deepEqual(w.commerce[key],old.commerce[key],key);
  assert.deepEqual(w.commerce.contracts,old.commerce.contracts.map(c=>({...c,rate:offerFor(c.offerId).rate,completionBonusCredits:c.quantityT*offerFor(c.offerId).rate/4,marketRound:null})));
  const fresh=createCampaign('new','New').commerce.market;
  assert.deepEqual(w.commerce.market,{...fresh,startedDay:w.day,nextReviewDay:w.day+90,nextRivalDay:w.day+15});
  assert.deepEqual(importCampaign(JSON.stringify(fixture),'copy'),{...w,id:'copy',revision:0});
  const aged=advance(w,60),activeBefore=old.commerce.contracts.find(c=>c.status==='active'),receipt=aged.commerce.contracts.find(c=>c.id===activeBefore.id);
  assert.equal(receipt.status,'completed');assert.equal(receipt.earnedCredits,150);assert.equal(receipt.rate,4);
  assert.equal(aged.commerce.earnedCredits-old.commerce.earnedCredits,150-activeBefore.earnedCredits);
  assert.equal(aged.commerce.market.buyers['lunar-return'].playerCommittedT,0);
  ledger(aged);
});

test('market: buyer bands and actual rival reservations change unaccepted quotes, while accepted terms lock',()=>{
  const start=network();
  assert.deepEqual(CONTRACT_OFFERS.map(offer=>contractQuote(start,offer.id,'standard').rate),[4,8,20]);
  assert.equal(nextEventDay(start),15);
  const first=advance(start,15);
  assert.deepEqual(first.commerce.market.flights.map(f=>[f.operatorId,f.offerId,f.cargoT]),[['selene','lunar-return',90],['vector','mars-build',120]]);
  assert.deepEqual(CONTRACT_OFFERS.map(offer=>buyerMarket(first,offer.id).rate),[2,6,20]);
  assert.equal(buyerMarket(first,'lunar-return').demandBand,'low');
  assert.equal(buyerMarket(first,'mars-build').rivalInFlightT,120);
  assert.equal(buyerMarket(first,'mars-build').nextRivalArrivalDay,first.commerce.market.flights[1].arrival);
  const high=advance(start,90);assert.equal(buyerMarket(high,'lunar-return').rate,6);
  const q=contractQuote(high,'lunar-return','standard'),accepted=acceptContract(high,'lunar-return','standard',q);
  assert.equal(accepted.commerce.contracts[0].rate,6);assert.equal(accepted.commerce.contracts[0].completionBonusCredits,45);
  assert.equal(buyerMarket(accepted,'lunar-return').rate,4);
  let paid=accepted;for(let i=0;i<3;i++)paid=dispatchContract(paid,1,10,'tug');
  paid=advance(paid,20);assert.equal(paid.commerce.contracts[0].earnedCredits,225);
  assert.equal(paid.commerce.contracts[0].rate,6);ledger(paid);
  for(const offer of CONTRACT_OFFERS)for(const rate of MARKET.rates[offer.id])assert.ok(rate*1.25<PROCUREMENT_PRICES[offer.kind]);
});

test('market: stale quotes reject atomically on rate and round changes even when infrastructure is unchanged',()=>{
  const w=network(),quote=contractQuote(w,'lunar-return','standard'),changed=advance(w,15),before=structuredClone(changed);
  assert.throws(()=>acceptContract(changed,'lunar-return','standard',quote),/quote changed/);assert.deepEqual(changed,before);
  const later=advance(w,360);assert.equal(contractQuote(later,'lunar-return','standard').rate,quote.rate);
  assert.throws(()=>acceptContract(later,'lunar-return','standard',quote),/quote changed/);
  const current=contractQuote(changed,'lunar-return','standard');
  assert.equal(acceptContract(changed,'lunar-return','standard',current).commerce.contracts[0].rate,2);
});

test('market: player commitments divert the rival toward other open business and cannot be stolen',()=>{
  const start=network(),baseline=advance(start,15);
  let w=acceptContract(start,'mars-build','standard');w=advance(w,15);
  assert.equal(baseline.commerce.market.flights.find(f=>f.operatorId==='vector').offerId,'mars-build');
  assert.equal(w.commerce.market.flights.find(f=>f.operatorId==='vector').offerId,'mercury-tooling');
  assert.deepEqual(w.commerce.market.buyers['mars-build'],{openT:570,playerCommittedT:30,rivalCommittedT:0});
  assert.equal(w.commerce.contracts[0].quantityT,30);assert.equal(w.commerce.contracts[0].rate,8);
  assert.deepEqual(w.ports,baseline.ports);assert.equal(w.fuelT,baseline.fuelT);assert.deepEqual(w.flights,baseline.flights);
  w=advance(w,90);assert.equal(w.commerce.contracts[0].status,'active');assert.equal(w.commerce.contracts[0].quantityT,30);
  ledger(w);
});

test('market: rivals use bounded independent convoys, actual transit, and no player fuel, stocks or traffic slots',()=>{
  let w=network();
  while(w.flights.length<LIMITS.cargoFlights)w=dispatch(w,'earth','phobos',1,'tug','equipment');
  const before=structuredClone(w);w=advance(w,15);
  assert.equal(w.flights.length,LIMITS.cargoFlights);assert.equal(w.commerce.market.flights.length,2);
  near(w.fuelT,before.fuelT+15);near(w.ports.earth.equipmentT,before.ports.earth.equipmentT+7.5);
  assert.equal(w.ports.phobos.materialsT,before.ports.phobos.materialsT);
  for(const flight of w.commerce.market.flights) {
    const offer=offerFor(flight.offerId),route=routeFor(offer.from,offer.to);
    near(flight.arrival-flight.departed,route.coastDays+route.handlingDays);
  }
  const lunar=w.commerce.market.flights.find(f=>f.operatorId==='selene');
  w=advance(w,lunar.arrival-w.day);
  assert.equal(w.commerce.market.rivalDeliveredT.selene,90);assert.equal(w.commerce.credits,0);
  assert.equal(w.ports.earth.receivedT,0);assert.equal(w.lunarReturnedT,0);
  w=advance(w,105-w.day);
  assert.equal(w.commerce.market.flights.filter(f=>f.operatorId==='vector').length,3);
  assert.equal(w.commerce.market.flights.some(f=>f.operatorId==='vector'&&f.departed===105),false);
  assert.equal(w.commerce.market.rivalDeliveredT.selene,270);ledger(w);
});

test('market: same-round cancellation restores only undelivered demand, including non-convoy quantities',()=>{
  let w=acceptContract(network(),'lunar-return','standard');w=dispatchContract(w,1,9,'tug');
  w=advance(w,w.flights[0].arrival-w.day);w=dispatchContract(w,1,7,'tug');
  const committedFlight=structuredClone(w.flights[0]);w=cancelContract(w,1);
  assert.deepEqual(w.commerce.market.buyers['lunar-return'],{openT:291,playerCommittedT:9,rivalCommittedT:0});
  assert.equal(w.commerce.credits,36);assert.deepEqual(w.flights[0],committedFlight);
  assert.throws(()=>acceptContract(w,'lunar-return','standard'),/another order/);
  w=advance(w,15-w.day);
  assert.deepEqual(w.commerce.market.buyers['lunar-return'],{openT:201,playerCommittedT:9,rivalCommittedT:90});
  assert.equal(w.ports.earth.receivedT,7);assert.equal(w.commerce.credits,36);ledger(w);
  let one=acceptContract(network(),'lunar-return','standard');one=dispatchContract(one,1,1,'tug');one=advance(one,7);one=cancelContract(one,1);one=advance(one,68);
  assert.equal(one.commerce.market.buyers['lunar-return'].openT,29);
  assert.match(contractQuote(one,'lunar-return','standard').reason,/another order/);
  assert.ok(one.commerce.market.flights.every(f=>f.cargoT%30===0));ledger(one);
});

test('market: procurement rounds replace unclaimed requests while long player and rival freight continues',()=>{
  let w=acceptContract(network(),'mars-build','standard');w=dispatchContract(w,1,10,'tug');w=advance(w,89);
  const job=structuredClone(w.commerce.contracts[0]),cargo=structuredClone(w.flights[0]);
  const rival=structuredClone(w.commerce.market.flights.find(f=>f.operatorId==='vector'));
  w=advance(w,1);
  assert.equal(w.commerce.market.round,1);assert.deepEqual(w.commerce.contracts[0],job);assert.deepEqual(w.flights[0],cargo);
  assert.deepEqual(w.commerce.market.flights.find(f=>f.id===rival.id),rival);
  assert.deepEqual(w.commerce.market.buyers['mars-build'],{openT:300,playerCommittedT:0,rivalCommittedT:0});
  w=cancelContract(w,1);
  assert.deepEqual(w.commerce.market.buyers['mars-build'],{openT:300,playerCommittedT:0,rivalCommittedT:0});
  w=advance(w,cargo.arrival-w.day);
  assert.equal(w.ports.phobos.receivedT,10);assert.equal(w.commerce.credits,0);ledger(w);
});

test('market: player arrivals at a review settle locked money before the new round, and expiry cannot inflate new requests',()=>{
  const start=network(),duration=contractQuote(start,'lunar-return','standard').duration;
  let w=advance(start,90-duration);w=acceptContract(w,'lunar-return','standard');
  assert.equal(w.commerce.contracts[0].rate,2);
  for(let i=0;i<3;i++)w=dispatchContract(w,1,10,'tug');
  w=advance(w,90-w.day);
  assert.equal(w.commerce.contracts[0].status,'completed');assert.equal(w.commerce.credits,75);
  assert.equal(w.commerce.market.round,1);assert.deepEqual(w.commerce.market.buyers['lunar-return'],{openT:600,playerCommittedT:0,rivalCommittedT:0});
  ledger(w);
  let expiring=advance(start,90-duration-30);expiring=acceptContract(expiring,'lunar-return','standard');
  expiring=dispatchContract(expiring,1,9,'tug');expiring=advance(expiring,90-expiring.day);
  assert.equal(expiring.commerce.contracts[0].status,'expired');near(expiring.commerce.contracts[0].settledDay,90);
  assert.equal(expiring.commerce.market.buyers['lunar-return'].openT,600);ledger(expiring);
});

test('market: one order per buyer allows overlapping routes without mixing cargo, deadlines or payments',()=>{
  let w=network();for(const offer of CONTRACT_OFFERS)w=acceptContract(w,offer.id,'standard');
  assert.equal(activeContracts(w).length,3);assert.deepEqual(activeContracts(w).map(c=>c.id),[1,2,3]);
  for(const offer of CONTRACT_OFFERS)assert.throws(()=>acceptContract(w,offer.id,'standard'),/active contract for this buyer/);
  for(let i=0;i<3;i++)w=dispatchContract(w,1,10,'tug');
  w=dispatchContract(w,2,10,'tug');for(let i=0;i<2;i++)w=dispatchContract(w,3,10,'tug');
  assert.deepEqual([1,2,3].map(id=>contractRemaining(w,id).inFlightT),[30,10,20]);
  assert.throws(()=>dispatchContract(w,1,1,'tug'),/already in flight/);
  w=advance(w,7);assert.equal(activeContracts(w).length,2);assert.equal(w.commerce.credits,150);
  w=advance(w,300-w.day);
  assert.deepEqual(w.commerce.contracts.map(c=>[c.status,c.earnedCredits]),[['completed',150],['expired',80],['expired',400]]);
  assert.equal(w.commerce.credits,630);assert.equal(activeContracts(w).length,0);ledger(w);
});

test('market: many rounds keep prices changing, industrial opportunities recurring, and history bounded',()=>{
  let w=network();const rates=Object.fromEntries(CONTRACT_OFFERS.map(o=>[o.id,new Set()])),industrial=Object.fromEntries(CONTRACT_OFFERS.map(o=>[o.id,0]));
  for(let i=0;i<360;i++) {
    w=advance(w,15);
    for(const offer of CONTRACT_OFFERS) {const facts=buyerMarket(w,offer.id);rates[offer.id].add(facts.rate);if(facts.openT>=300)industrial[offer.id]++;}
    ledger(w);
  }
  for(const offer of CONTRACT_OFFERS) {assert.ok(rates[offer.id].size>=2,offer.id+' has changing rates');assert.ok(industrial[offer.id]>60,offer.id+' has recurring industrial volumes');}
  assert.equal(w.commerce.market.history.length,MARKET.historyLimit);
  assert.ok(w.commerce.market.rivalDeliveredT.selene>0);assert.ok(w.commerce.market.rivalDeliveredT.vector>0);
});

test('market: a mature saved network completes repeat industrial orders and reinvests earnings in its fuel shortage',()=>{
  let w=validateCampaign(JSON.parse(readFileSync(new URL('./fixtures/campaign-v6.json',import.meta.url))).state);
  const started=w.day;
  for(let round=0;round<3;round++) {
    if(round)w=advance(w,started+round*360-w.day);
    const fuelPurchase=Math.max(0,Math.ceil(1105-w.fuelT));
    if(fuelPurchase)w=procure(w,'fuel',fuelPurchase);
    for(const offer of CONTRACT_OFFERS) {
      const quote=contractQuote(w,offer.id,'industrial');assert.equal(quote.reason,'');
      w=acceptContract(w,offer.id,'industrial',quote);
      const id=w.commerce.nextContract-1;
      for(let flight=0;flight<30;flight++)w=dispatchContract(w,id,10,'tug');
    }
    w=advance(w,300);ledger(w);
    assert.equal(w.commerce.contracts.filter(c=>c.status==='completed').length,(round+1)*3);
  }
  assert.equal(w.commerce.earnedCredits,36000);assert.ok(w.commerce.spentCredits>0);
  assert.equal(w.commerce.credits,w.commerce.earnedCredits-w.commerce.spentCredits);
  assert.equal(w.day-started,1020);assert.ok(w.ports.moon.materialsT>0);
});

test('market: long steps, fractional steps and reload preserve rounds, rival choices and concurrent customer settlements',()=>{
  let base=network();for(const offer of CONTRACT_OFFERS) {base=acceptContract(base,offer.id,'standard');base=addContractService(base,base.commerce.nextContract-1,7,'tether',2);}
  const coarse=advance(base,1080);let fine=base;
  for(let i=0;i<4320;i++)fine=advance(fine,.25);
  const restored=advance(importCampaign(exportCampaign(advance(base,154.4835536820693)),'restored'),925.5164463179307);
  for(const w of [fine,restored]) {
    assert.deepEqual(w.commerce,coarse.commerce);assert.deepEqual(w.flights,coarse.flights);assert.deepEqual(w.services,coarse.services);
    near(w.fuelT,coarse.fuelT);for(const id of Object.keys(w.ports))for(const key of ['materialsT','equipmentT','receivedT','sentT','readyDay'])near(w.ports[id][key],coarse.ports[id][key]);
    ledger(w);
  }
  assert.equal(coarse.commerce.credits,1200);assert.deepEqual(importCampaign(exportCampaign(coarse),'copy'),{...coarse,id:'copy',revision:0});
});

test('market: malformed round ledgers, snapshots, rival routes, clocks, fleets and lifetime totals fail validation',()=>{
  const good=advance(acceptContract(network(),'mars-build','standard'),75);
  const edits=[
    w=>delete w.commerce.market,w=>w.commerce.market.startedDay++,w=>w.commerce.market.round++,
    w=>w.commerce.market.nextReviewDay++,w=>w.commerce.market.nextRivalDay++,w=>w.commerce.market.nextRivalDay=w.day,
    w=>w.commerce.market.buyers['mars-build'].openT++,
    w=>{w.commerce.market.buyers['mars-build'].openT++;w.commerce.market.buyers['mars-build'].playerCommittedT--;},
    w=>w.commerce.contracts[0].rate=7,w=>w.commerce.contracts[0].completionBonusCredits++,w=>w.commerce.contracts[0].marketRound=1,
    w=>{w.commerce.contracts[0].marketRound=null;w.commerce.contracts[0].acceptedDay=1;w.commerce.contracts[0].dueDay++;},
    w=>w.commerce.market.flights[0].operatorId='unknown',w=>w.commerce.market.flights[0].offerId='lunar-return',
    w=>w.commerce.market.flights[0].arrival++,w=>w.commerce.market.flights[0].departed++,w=>w.commerce.market.flights[0].marketRound=1,
    w=>w.commerce.market.flights[0].cargoT=31,w=>w.commerce.market.flights[0].cargoT=150,
    w=>w.commerce.market.flights.push({...w.commerce.market.flights[0]}),w=>w.commerce.market.rivalDeliveredT.selene++,
    w=>w.commerce.market.rivalDeliveredT.vector=100000,w=>w.commerce.market.nextShipment=1,
    w=>w.commerce.market.history.push(...Array.from({length:25},()=>({day:w.day,text:'Invalid extra history.'}))),
  ];
  for(const change of edits) {const bad=structuredClone(good);change(bad);assert.throws(()=>validateCampaign(bad),undefined,String(change));}
  const twice=acceptContract(network(),'lunar-return','standard');const duplicate={...twice.commerce.contracts[0],id:twice.commerce.nextContract++};twice.commerce.contracts.push(duplicate);
  assert.throws(()=>validateCampaign(twice),/cooldown|commitments/);
});

test('market: near-horizon migrations schedule no impossible convoy and terminal clocks stay valid',()=>{
  const old=network();old.day=99975;old.schema=9;old.model='network-0.9.0';
  let w=validateCampaign(old);w=advance(w,15);
  assert.equal(w.commerce.market.flights.length,1);assert.equal(w.commerce.market.flights[0].operatorId,'selene');
  assert.ok(w.commerce.market.flights[0].arrival<=LIMITS.days);w=advance(w,LIMITS.days-w.day);
  assert.equal(nextEventDay(w),null);assert.equal(w.commerce.market.flights.length,0);ledger(w);
  const terminal=network();terminal.day=LIMITS.days;terminal.schema=9;terminal.model='network-0.9.0';
  const migrated=validateCampaign(terminal);
  assert.equal(migrated.commerce.market.nextReviewDay,LIMITS.days+90);assert.equal(migrated.commerce.market.nextRivalDay,LIMITS.days+15);
  assert.deepEqual(validateCampaign(migrated),migrated);
});
