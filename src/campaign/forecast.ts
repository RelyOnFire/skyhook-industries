import { advance, industryStatus, LIMITS, SITE, SITES, siteLocked, type BlockedDeparture, type Campaign, type SiteId } from './model.js';

export interface ServiceDelay {
  id: number;
  route: string;
  reason: string;
  attempts: number;
  firstDay: number;
  lastDay: number;
}
export interface MirrorDelay {
  reason: string;
  attempts: number;
  firstDay: number;
  lastDay: number;
}

/** Run the real event engine on copies. This is an outlook, never a saved action. */
export function forecastNetwork(world: Campaign, requestedDays: number) {
  const days = Math.min(requestedDays, LIMITS.days - world.day);
  if (!Number.isInteger(requestedDays) || requestedDays < 1 || days <= 0) throw Error('Choose a forecast within the simulation horizon.');
  const delayed = new Map<string, ServiceDelay>(),mirrorDelayed = new Map<string, MirrorDelay>();
  const recordBlocked = (attempt: BlockedDeparture) => {
    if (attempt.kind === 'mirrors') {
      const entry = mirrorDelayed.get(attempt.reason) ?? {reason:attempt.reason,attempts:0,firstDay:attempt.day,lastDay:attempt.day};
      entry.attempts++;
      entry.lastDay=attempt.day;
      mirrorDelayed.set(attempt.reason,entry);
    } else {
      const service=world.services.find(candidate=>candidate.id===attempt.serviceId)!;
      const key=attempt.serviceId+':'+attempt.reason;
      const entry=delayed.get(key) ?? {id:attempt.serviceId,route:SITE[service.from].name+' → '+SITE[service.to].name,
        reason:attempt.reason,attempts:0,firstDay:attempt.day,lastDay:attempt.day};
      entry.attempts++;
      entry.lastDay=attempt.day;
      delayed.set(key,entry);
    }
  };
  // One chronological run records the exact decision at each attempt and avoids
  // cloning a busy network once per forecast day.
  const projected = advance(world, days, recordBlocked);
  const serviceDeparturesById = Object.fromEntries(projected.services.map(service => {
    const original = world.services.find(candidate => candidate.id === service.id);
    return [service.id,service.dispatched-(original?.dispatched??0)];
  })) as Record<number,number>;
  const serviceDepartures=Object.values(serviceDeparturesById).reduce((sum,count)=>sum+count,0);
  const ports = SITES.filter(id => !siteLocked(world, id)).map((id: SiteId) => ({
    id,
    name: SITE[id].name,
    now: world.ports[id],
    later: projected.ports[id],
    status: projected.ports[id].industry ? industryStatus(projected, id) : null,
  }));
  const serviceDelays=[...delayed.values()].sort((a,b)=>b.attempts-a.attempts||a.firstDay-b.firstDay||a.id-b.id);
  const mirrorDelays=[...mirrorDelayed.values()].sort((a,b)=>b.attempts-a.attempts||a.firstDay-b.firstDay);
  return {
    fromDay: world.day,
    toDay: projected.day,
    days,
    fuelNow: world.fuelT,
    fuelLater: projected.fuelT,
    swarmNow: world.solar.deployedT,
    swarmLater: projected.solar.deployedT,
    receivedT: ports.reduce((sum, port) => sum + port.later.receivedT - port.now.receivedT, 0),
    activeServices: world.services.filter(service => service.enabled).length,
    serviceDepartures,
    serviceDeparturesById,
    mirrorLaunches: projected.solar.nextDeployment - world.solar.nextDeployment,
    delayed: serviceDelays,
    mirrorDelayed: mirrorDelays,
    holds: [...serviceDelays.map(item=>({...item,kind:'service' as const})),...mirrorDelays.map(item=>({...item,kind:'mirrors' as const}))]
      .sort((a,b)=>b.attempts-a.attempts||a.firstDay-b.firstDay),
    ports,
  };
}
