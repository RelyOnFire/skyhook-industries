import { useMemo, useState } from 'react';
import { LIMITS, type Campaign } from './model.js';
import { forecastNetwork } from './forecast.js';

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const day = (value: number) => 'Day ' + number(value);

export default function NetworkOutlook({ world }: { world: Campaign }) {
  const [open, setOpen] = useState(false);
  const [horizon, setHorizon] = useState(90);
  const outlook = useMemo(() => open && world.day < LIMITS.days ? forecastNetwork(world, horizon) : null, [open, world, horizon]);
  return <details className="network-outlook" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Network outlook <span>Project stocks and service delays ↗</span></summary>
    {world.day >= LIMITS.days ? <p className="outlook-note">This network has reached the simulation horizon.</p> : outlook && <div className="outlook-body">
      <label className="outlook-horizon">Look ahead <select aria-label="Forecast horizon" value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option></select></label>
      <p className="outlook-note">From {day(outlook.fromDay)} to {day(outlook.toDay)}. Current services, production and automatic launches continue. No manual shipments, upgrades or Earth supply requests are assumed. This does not advance your saved world.</p>
      <div className="outlook-metrics"><div><span>Service departures</span><b>{number(outlook.serviceDepartures)}</b></div><div><span>Cargo received</span><b>+{number(outlook.receivedT)} t</b></div><div><span>Support fuel</span><b>{number(outlook.fuelNow)} → {number(outlook.fuelLater)} t</b></div>{world.solar.unlocked && <div><span>Swarm deployed</span><b>{number(outlook.swarmNow)} → {number(outlook.swarmLater)} t</b></div>}</div>
      <h3>Service delays</h3>
      {outlook.delayed.length ? <ul className="outlook-delays">{outlook.delayed.map(item => <li key={item.id}><b>#{item.id} {item.route}</b><span>{item.attempts} blocked {item.attempts === 1 ? 'attempt' : 'attempts'} · first {day(item.firstDay)}</span></li>)}</ul> : <p className="outlook-clear">{outlook.activeServices ? 'No scheduled departure is blocked in this window.' : 'No active services to project.'}</p>}
      <h3>Projected depot stocks <small>now → then</small></h3>
      <div className="outlook-ports">{outlook.ports.map(port => <div className="outlook-port" key={port.id}><b>{port.name}</b><span>Material <strong>{number(port.now.materialsT)} → {number(port.later.materialsT)} t</strong></span><span>Equipment <strong>{number(port.now.equipmentT)} → {number(port.later.equipmentT)} t</strong></span>{(port.id === 'ceres' || port.id === 'phobos') && world.belt.unlocked && <span>Water <strong>{number(port.now.waterT)} → {number(port.later.waterT)} t</strong></span>}{port.status && (port.status.startsWith('Waiting') || port.status.includes('exhausted') || port.status.includes('full')) && <em>{port.status} at {day(outlook.toDay)}</em>}</div>)}</div>
    </div>}
  </details>;
}
