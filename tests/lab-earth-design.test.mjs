import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,LUNAR_DEFAULT,simulate} from '../.lab-test/simulation/engine.js';
import {earthDesignReport,earthDesignUrl,validateEarthDesignReport} from '../.lab-test/simulation/expedition-design.js';
import {createCampaign,commissionEarthDesign,restoreStandardEarth,earthDesignCost,earthDesignPerformance,tetherCapacity,tetherRecoveryDays,flightPlan,dispatch,advance,addService,exportCampaign,importCampaign,validateCampaign,CAMPAIGN_MODEL} from '../.lab-test/campaign/model.js';
const result=simulate(DEFAULT),report=earthDesignReport(result);
const small=earthDesignReport(simulate({...DEFAULT,payloadT:1,areaMm2:60}));
const heavy=earthDesignReport(simulate({...DEFAULT,payloadT:5,areaMm2:120}));
const efficient=earthDesignReport(simulate({...DEFAULT,isp:450}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function network(){const w=createCampaign('bridge','Bridge');w.ports.moon.level=3;w.ports.earth.materialsT=1000;w.ports.earth.equipmentT=100;return w;}

test('exact inputs and bounded version-2 measurements; failed flights cannot transfer',()=>{
  assert.equal(report.version,2);near(report.dryMassT,108.88);
  assert.deepEqual(JSON.parse(decodeURIComponent(earthDesignUrl(result).split('=')[1])),DEFAULT);
  for(const invalid of [{...result,outcome:'incomplete'},{...result,design:LUNAR_DEFAULT},{...result,minMargin:.9},{...result,rendezvous:[]}])assert.throws(()=>earthDesignReport(invalid));
  for(const invalid of [{...report,minMargin:NaN},{...report,payloadT:10},{...report,version:3},{...report,fuelUsedT:-1},{...report,deliveryIntervalS:Infinity},{...report,dryMassT:1},{...report,dryMassT:NaN}])assert.throws(()=>validateEarthDesignReport(invalid));
});
test('real designs produce distinct capacity, cadence, fuel and cost; reference gets no import bonus',()=>{
  const standard=earthDesignPerformance(report,1),light=earthDesignPerformance(small,1),cargo=earthDesignPerformance(heavy,1),economical=earthDesignPerformance(efficient,1);
  // Continuous solver ratios can differ by a few ULPs across Node/V8 versions.
  assert.deepEqual({capacity:standard.capacity,materialsT:standard.materialsT,equipmentT:standard.equipmentT},{capacity:10,materialsT:40,equipmentT:10});
  near(standard.recoveryDays,2);near(standard.fuelFactor,1);
  assert.equal(light.capacity,3);assert.ok(light.recoveryDays<1);assert.ok(light.materialsT<standard.materialsT);assert.ok(light.equipmentT<standard.equipmentT);
  assert.equal(cargo.capacity,16);assert.ok(cargo.recoveryDays<standard.recoveryDays);assert.ok(cargo.fuelFactor<standard.fuelFactor);assert.ok(cargo.materialsT>standard.materialsT);assert.ok(cargo.equipmentT>standard.equipmentT);
  assert.ok(economical.fuelFactor<standard.fuelFactor);assert.equal(economical.capacity,standard.capacity);
  const baseline=network(),up=commissionEarthDesign(baseline,heavy),down=commissionEarthDesign(baseline,small);
  assert.equal(flightPlan(up,'earth','moon',16,'tether').reason,'');assert.ok(flightPlan(down,'earth','moon',4,'tether').reason.includes('up to 3 t'));
  assert.ok(flightPlan(up,'earth','moon',3,'tether').fuelT<flightPlan(baseline,'earth','moon',3,'tether').fuelT);
  assert.deepEqual(flightPlan(up,'earth','moon',3,'tug'),flightPlan(baseline,'earth','moon',3,'tug'));
  assert.deepEqual(flightPlan(up,'moon','phobos',3,'tether'),flightPlan(baseline,'moon','phobos',3,'tether'));
  up.ports.moon.level=1;assert.equal(flightPlan(up,'earth','moon',16,'tether').capacity,10,'remote port remains a bottleneck');
});
test('commission and replacement preserve current traffic/reservations and affect both directions on future bookings',()=>{
  const w=dispatch(network(),'earth','moon',3,'tether'),before=structuredClone(w),up=commissionEarthDesign(w,heavy),cost=earthDesignCost(w,heavy);
  assert.deepEqual(w,before);assert.equal(up.revision,w.revision+1);
  assert.equal(up.ports.earth.materialsT,w.ports.earth.materialsT-cost.materialsT);assert.equal(up.ports.earth.equipmentT,w.ports.earth.equipmentT-cost.equipmentT);
  assert.equal(up.ports.earth.readyDay,w.ports.earth.readyDay);assert.deepEqual(up.flights,w.flights);
  const after=dispatch(advance(up,2),'earth','moon',16,'tether');near(after.ports.earth.readyDay,2+earthDesignPerformance(heavy,1).recoveryDays);
  near(after.ports.moon.readyDay,2+2/3);near(after.flights[1].arrival-after.flights[0].arrival,2);
  assert.throws(()=>commissionEarthDesign(up,heavy),/already/);
  const replaced=commissionEarthDesign(up,small);assert.equal(tetherCapacity(replaced,'earth'),3);assert.deepEqual(replaced.flights,up.flights);
  assert.equal(replaced.ports.earth.materialsT,up.ports.earth.materialsT-earthDesignCost(up,small).materialsT);
  const standard=restoreStandardEarth(replaced);assert.equal(tetherCapacity(standard,'earth'),10);assert.deepEqual(standard.ports,replaced.ports);assert.deepEqual(standard.flights,replaced.flights);
  const poor=network();poor.ports.earth.equipmentT=0;assert.throws(()=>commissionEarthDesign(poor,heavy),/Requires/);
  assert.deepEqual(importCampaign(exportCampaign(after),'copy'),{...after,id:'copy',revision:0});
});
test('daily services actually depart more often with a faster design; coarse/fine time steps agree',()=>{
  let base=network();base.ports.moon.materialsT=100;
  base=addService(base,'moon','earth',3,'tether','materials',1);
  const improved=commissionEarthDesign(base,small),first=advance(improved,1);
  near(first.ports.earth.readyDay,1+earthDesignPerformance(small,1).recoveryDays);
  const large=advance(improved,30);let fine=improved;for(let i=0;i<30;i++)fine=advance(fine,1);
  assert.ok(large.services[0].dispatched>advance(base,30).services[0].dispatched);
  assert.deepEqual(large.flights,fine.flights);assert.deepEqual(large.services,fine.services);assert.deepEqual(large.ports,fine.ports);near(large.fuelT,fine.fuelT);assert.deepEqual(validateCampaign(large),large);
  const oversized=addService(network(),'earth','moon',10,'tether','materials',1),replaced=commissionEarthDesign(oversized,small),blocked=advance(replaced,1);
  assert.equal(blocked.services[0].dispatched,0);assert.equal(blocked.services[0].cargoT,10);assert.equal(blocked.services[0].nextDay,2);
});
test('v1–v6 have no free design; v7 preserves its paid legacy terms until explicit conversion with one-time credit',()=>{
  for(let version=1;version<=7;version++){
    const raw=JSON.parse(readFileSync(new URL(`./fixtures/campaign-v${version}.json`,import.meta.url))),before=structuredClone(raw);
    const migrated=validateCampaign(raw.state);assert.equal(migrated.schema,8);assert.deepEqual(raw,before);
    if(version<7){assert.equal(migrated.earthDesign,null);raw.state.earthDesign=report;assert.equal(validateCampaign(raw.state).earthDesign,null);}
    if(version===6)assert.deepEqual(migrated,{...raw.state,schema:8,model:CAMPAIGN_MODEL,earthDesign:null});
    if(version===7){
      assert.deepEqual(migrated,{...raw.state,schema:8,model:CAMPAIGN_MODEL});near(tetherRecoveryDays(migrated,'earth'),1.6);
      const cost=earthDesignCost(migrated,heavy);assert.equal(cost.credit,true);assert.equal(cost.materialsT,earthDesignPerformance(heavy,1).materialsT-40);
      const converted=commissionEarthDesign(migrated,heavy);assert.equal(converted.earthDesign.version,2);assert.equal(earthDesignCost(converted,small).credit,false);
      assert.deepEqual(converted.flights,migrated.flights);assert.deepEqual(converted.services,migrated.services);assert.equal(converted.ports.earth.readyDay,migrated.ports.earth.readyDay);
      assert.deepEqual(importCampaign(exportCampaign(converted),'roundtrip'),{...converted,id:'roundtrip',revision:0});
      raw.state.earthDesign=report;assert.throws(()=>validateCampaign(raw.state),/saved campaign version/);
    }
    assert.deepEqual(importCampaign(JSON.stringify(before),'copy'),{...migrated,id:'copy',revision:0});
  }
});
