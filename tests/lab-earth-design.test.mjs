import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,LUNAR_DEFAULT,simulate} from '../.lab-test/simulation/engine.js';
import {earthDesignReport,earthDesignUrl,validateEarthDesignReport} from '../.lab-test/simulation/expedition-design.js';
import {createCampaign,commissionEarthDesign,dispatch,advance,addService,exportCampaign,importCampaign,validateCampaign,CAMPAIGN_MODEL} from '../.lab-test/campaign/model.js';
const result=simulate(DEFAULT),report=earthDesignReport(result);
test('Earth bridge carries exact inputs and reports two checked deliveries',()=>{
  assert.equal(report.payloadT,DEFAULT.payloadT);assert.ok(report.deliveryIntervalS>0);
  assert.deepEqual(JSON.parse(decodeURIComponent(earthDesignUrl(result).split('=')[1])),DEFAULT);
  for(const invalid of [{...result,outcome:'incomplete'},{...result,design:LUNAR_DEFAULT},{...result,minMargin:.9},{...result,rendezvous:[]}])assert.throws(()=>earthDesignReport(invalid));
  for(const invalid of [{...report,minMargin:NaN},{...report,payloadT:10},{...report,version:2},{...report,fuelUsedT:-1},{...report,deliveryIntervalS:Infinity}])assert.throws(()=>validateEarthDesignReport(invalid));
});
test('v1–v6 migrate without any free upgrade; v6 fields and writer revision remain intact',()=>{
  for(let version=1;version<=6;version++){
    const raw=JSON.parse(readFileSync(new URL(`./fixtures/campaign-v${version}.json`,import.meta.url))),before=structuredClone(raw);
    const migrated=validateCampaign(raw.state);assert.equal(migrated.earthDesign,null);assert.equal(migrated.schema,7);
    if(version===6)assert.deepEqual(migrated,{...raw.state,schema:7,model:CAMPAIGN_MODEL,earthDesign:null});
    raw.state.earthDesign=report;assert.equal(validateCampaign(raw.state).earthDesign,null,'old schema cannot smuggle an upgrade');
    assert.deepEqual(importCampaign(JSON.stringify(before),'copy'),{...migrated,id:'copy',revision:0});
  }
});
function network(){const w=createCampaign('bridge','Bridge');w.ports.moon.level=2;return w;}
test('commissioning debits once, preserves reservations, and changes only future Earth bookings',()=>{
  const w=dispatch(network(),'earth','moon',3,'tether'),before=structuredClone(w),up=commissionEarthDesign(w,report);
  assert.deepEqual(w,before);assert.equal(up.revision,w.revision+1);
  assert.equal(up.ports.earth.materialsT,w.ports.earth.materialsT-40);assert.equal(up.ports.earth.equipmentT,w.ports.earth.equipmentT-10);
  assert.equal(up.ports.earth.readyDay,w.ports.earth.readyDay);assert.deepEqual(up.flights,w.flights);
  const after=dispatch(advance(up,2),'earth','moon',3,'tether');
  assert.equal(after.ports.earth.readyDay,3.6);assert.equal(after.ports.moon.readyDay,3);
  assert.equal(after.flights[1].arrival-after.flights[0].arrival,2);assert.equal(after.flights[1].fuelT,w.flights[0].fuelT);
  assert.throws(()=>commissionEarthDesign(up,report),/already/);
  const poor=network();poor.ports.earth.equipmentT=0;assert.throws(()=>commissionEarthDesign(poor,report),/Requires/);
  assert.deepEqual(importCampaign(exportCampaign(after),'copy'),{...after,id:'copy',revision:0});
});
test('recurring services use the same Earth reservation in either direction; large/small steps agree',()=>{
  let w=network();w.ports.moon.materialsT=100;
  w=commissionEarthDesign(w,report);w=addService(w,'moon','earth',3,'tether','materials',2);
  const first=advance(w,1);assert.equal(first.ports.earth.readyDay,2.6);assert.equal(first.ports.moon.readyDay,2);
  const large=advance(w,30);let small=w;for(let i=0;i<30;i++)small=advance(small,1);
  assert.deepEqual(large.flights,small.flights);assert.deepEqual(large.services,small.services);assert.deepEqual(large.ports,small.ports);
  assert.equal(large.fuelT,small.fuelT);assert.deepEqual(validateCampaign(large),large);
});
