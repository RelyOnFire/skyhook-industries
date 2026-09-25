import { useMemo, useState } from 'react';
import { LIMITS, type Campaign } from './model.js';
import { forecastNetwork } from './forecast.js';
import ServiceScenario from './ServiceScenario.js';

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const day = (value: number) => 'Day ' + number(value);

export default function NetworkOutlook({ world,busy,act }: { world:Campaign;busy:boolean;act:(fn:(world:Campaign)=>Campaign)=>void }) {
  const [open, setOpen] = useState(false);
  const [horizon, setHorizon] = useState(90);
  const outlook = useMemo(() => open && world.day < LIMITS.days ? forecastNetwork(world, horizon) : null, [open, world, horizon]);
  return <details className="network-outlook" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Network outlook <span>Project stocks and departure holds ↗</span></summary>
    {world.day >= LIMITS.days ? <p className="outlook-note">This network has reached the simulation horizon.</p> : outlook && <div className="outlook-body">
      <label className="outlook-horizon">Look ahead <select aria-label="Forecast horizon" value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option></select></label>
      <p className="outlook-note">From {day(outlook.fromDay)} to {day(outlook.toDay)}. Current services, production and automatic launches continue. No manual shipments, upgrades or Earth supply requests are assumed. This does not advance your saved world. {world.development.fuelReserveT>0&&<>Automatic mirrors protect {number(world.development.fuelReserveT)} t fuel; cargo can spend it.</>}</p>
      <div className="outlook-metrics"><div><span>Service departures</span><b>{number(outlook.serviceDepartures)}</b></div><div><span>Cargo received</span><b>+{number(outlook.receivedT)} t</b></div><div><span>Support fuel</span><b>{number(outlook.fuelNow)} → {number(outlook.fuelLater)} t</b></div>{world.solar.unlocked && <div><span>Swarm deployed</span><b>{number(outlook.swarmNow)} → {number(outlook.swarmLater)} t</b></div>}{world.solar.unlocked&&<div><span>Mirror launches</span><b>{number(outlook.mirrorLaunches)}</b></div>}</div>
      <h3>Departure holds <small>{outlook.holds.length} {outlook.holds.length===1?'cause':'causes'}</small></h3>
      {outlook.holds.length ? <div className="outlook-hold-scroll" tabIndex={0} role="region" aria-label="Projected departure holds"><ul className="outlook-delays">{outlook.holds.map(item => <li key={item.kind==='service'?'service-'+item.id+'-'+item.reason:'mirrors-'+item.reason}><b>{item.kind==='service'?'#'+item.id+' '+item.route:'Automatic mirror launches'}</b><span>{item.attempts} blocked {item.attempts === 1 ? 'attempt' : 'attempts'} · first {day(item.firstDay)}</span><p>{item.reason}</p><a href={item.kind==='service'?'#service-'+item.id:item.reason.includes('holding')?'#development-operations':'#solar-heading'}>{item.kind==='service'?'Review service':'Review mirror controls'} ↗</a></li>)}</ul></div> : <p className="outlook-clear">{outlook.activeServices||world.solar.autoLaunch?'No departures are blocked in this window.':'No active services or automatic launches to project.'}</p>}
      <ServiceScenario world={world} horizon={horizon} current={outlook} busy={busy} act={act}/>
      <h3>Projected depot stocks <small>now → then</small></h3>
      <div className="outlook-ports">{outlook.ports.map(port => <div className="outlook-port" key={port.id}><b>{port.name}</b><span>Material <strong>{number(port.now.materialsT)} → {number(port.later.materialsT)} t</strong></span><span>Equipment <strong>{number(port.now.equipmentT)} → {number(port.later.equipmentT)} t</strong></span>{(port.id === 'ceres' || port.id === 'phobos') && world.belt.unlocked && <span>Water <strong>{number(port.now.waterT)} → {number(port.later.waterT)} t</strong></span>}{port.status && (port.status.startsWith('Waiting') || port.status.includes('exhausted') || port.status.includes('full')) && <em>{port.status} at {day(outlook.toDay)}</em>}</div>)}</div>
    </div>}
  </details>;
}
