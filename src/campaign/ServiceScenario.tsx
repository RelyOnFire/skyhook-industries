import { useEffect, useMemo, useState } from 'react';
import { CARGO, SITE, type Campaign } from './model.js';
import { forecastNetwork } from './forecast.js';
import { updateService } from './service-edit.js';

type Forecast = ReturnType<typeof forecastNetwork>;
type Draft = { id:number; cargoT:number; intervalDays:number };
const number=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});

export default function ServiceScenario({world,horizon,current,busy,act}:{world:Campaign;horizon:number;current:Forecast;busy:boolean;act:(fn:(world:Campaign)=>Campaign)=>void}) {
  const [serviceId,setServiceId]=useState(world.services[0]?.id??0);
  const service=world.services.find(item=>item.id===serviceId)??world.services[0];
  const [cargo,setCargo]=useState(String(service?.cargoT??''));
  const [interval,setInterval]=useState(String(service?.intervalDays??''));
  const [draft,setDraft]=useState<Draft|null>(null);
  useEffect(()=>{
    setCargo(String(service?.cargoT??''));
    setInterval(String(service?.intervalDays??''));
    setDraft(null);
  },[service?.id,service?.cargoT,service?.intervalDays]);
  const cargoT=Number(cargo),intervalDays=Number(interval);
  const maximum=service?.mode==='tug'?10:30;
  const valid=!!service&&cargo.trim()!==''&&interval.trim()!==''&&Number.isInteger(cargoT)&&cargoT>=1&&cargoT<=maximum&&Number.isInteger(intervalDays)&&intervalDays>=1&&intervalDays<=3650;
  const changed=valid&&(cargoT!==service.cargoT||intervalDays!==service.intervalDays);
  const proposed=useMemo(()=>{
    if(!draft||!service||draft.id!==service.id)return null;
    return forecastNetwork(updateService(world,draft.id,draft.cargoT,draft.intervalDays),horizon);
  },[draft,service?.id,world,horizon]);
  if(!service)return null;
  const serviceHolds=(projection:Forecast)=>projection.delayed.filter(item=>item.id===service.id).reduce((sum,item)=>sum+item.attempts,0);
  const comparison=proposed&&[
    {label:'This service departs',before:current.serviceDeparturesById[service.id]??0,after:proposed.serviceDeparturesById[service.id]??0,unit:''},
    {label:'Blocked attempts',before:serviceHolds(current),after:serviceHolds(proposed),unit:''},
    {label:'Cargo received',before:current.receivedT,after:proposed.receivedT,unit:' t'},
    {label:'Fuel at end',before:current.fuelLater,after:proposed.fuelLater,unit:' t'},
    ...(world.solar.unlocked?[{label:'Mirror launches',before:current.mirrorLaunches,after:proposed.mirrorLaunches,unit:''}]:[]),
  ];
  return <section className="outlook-scenario" aria-labelledby="outlook-scenario-heading">
    <h3 id="outlook-scenario-heading">Try a service change <small>Compare before applying</small></h3>
    <form onSubmit={event=>{event.preventDefault();if(changed)setDraft({id:service.id,cargoT,intervalDays});}}>
      <label className="outlook-scenario-service">Service
        <select value={service.id} onChange={event=>setServiceId(Number(event.target.value))} aria-label="Service to compare">
          {world.services.map(item=><option key={item.id} value={item.id}>#{item.id} {SITE[item.from].name} → {SITE[item.to].name} · {CARGO[item.kind]}</option>)}
        </select>
      </label>
      <div className="outlook-scenario-fields">
        <label>Payload (t)<input type="number" inputMode="numeric" min="1" max={maximum} step="1" required value={cargo} onChange={event=>{setCargo(event.target.value);setDraft(null);}}/></label>
        <label>Every (days)<input type="number" inputMode="numeric" min="1" max="3650" step="1" required value={interval} onChange={event=>{setInterval(event.target.value);setDraft(null);}}/></label>
      </div>
      <button type="submit" disabled={!changed}>Compare plans</button>
      {!valid&&<p className="outlook-scenario-note">Choose 1–{maximum} whole tonnes and an interval of 1–3,650 whole days.</p>}
    </form>
    {proposed&&comparison&&<div className="outlook-comparison" aria-live="polite">
      <table><caption className="sr-only">Projected effect of changing service {service.id}</caption><thead><tr><th scope="col">Next {horizon} days</th><th scope="col">Current</th><th scope="col">Proposed</th></tr></thead><tbody>{comparison.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{number(row.before)}{row.unit}</td><td>{number(row.after)}{row.unit}</td></tr>)}</tbody></table>
      <p className="outlook-scenario-note">{!service.enabled?'This service is paused; resume it to see departures.':service.nextDay>current.toDay?'Its next attempt is beyond this window. Try a longer forecast.':'The next attempt stays on Day '+number(service.nextDay)+'. Cargo in flight keeps its arrival.'} Receipts count only cargo that arrives by the end of this window.</p>
      <button type="button" className="primary" disabled={busy} onClick={()=>{act(w=>updateService(w,draft!.id,draft!.cargoT,draft!.intervalDays));setDraft(null);}}>Apply schedule</button>
    </div>}
  </section>;
}
