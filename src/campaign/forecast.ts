import { advance, industryStatus, LIMITS, SITE, SITES, siteLocked, type Campaign, type SiteId } from './model.js';

export interface ServiceDelay {
  id: number;
  route: string;
  attempts: number;
  firstDay: number;
  lastDay: number;
}

/** Run the real event engine on copies. This is an outlook, never a saved action. */
export function forecastNetwork(world: Campaign, requestedDays: number) {
  const days = Math.min(requestedDays, LIMITS.days - world.day);
  if (!Number.isInteger(requestedDays) || requestedDays < 1 || days <= 0) throw Error('Choose a forecast within the simulation horizon.');
  const delayed = new Map<number, ServiceDelay>();
  let projected = world;
  const endDay = world.day + days;
  while (projected.day < endDay - 1e-8) {
    const before = projected;
    projected = advance(before, Math.min(1, endDay - before.day));
    for (const service of before.services) {
      if (!service.enabled || service.nextDay > projected.day + 1e-8) continue;
      const after = projected.services.find(candidate => candidate.id === service.id);
      if (!after || after.dispatched !== service.dispatched) continue;
      const entry = delayed.get(service.id) ?? {
        id: service.id,
        route: SITE[service.from].name + ' → ' + SITE[service.to].name,
        attempts: 0,
        firstDay: service.nextDay,
        lastDay: service.nextDay,
      };
      entry.attempts++;
      entry.lastDay = service.nextDay;
      delayed.set(service.id, entry);
    }
  }
  const serviceDepartures = projected.services.reduce((sum, service) => {
    const original = world.services.find(candidate => candidate.id === service.id);
    return sum + service.dispatched - (original?.dispatched ?? 0);
  }, 0);
  const ports = SITES.filter(id => !siteLocked(world, id)).map((id: SiteId) => ({
    id,
    name: SITE[id].name,
    now: world.ports[id],
    later: projected.ports[id],
    status: projected.ports[id].industry ? industryStatus(projected, id) : null,
  }));
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
    delayed: [...delayed.values()].sort((a, b) => a.firstDay - b.firstDay || a.id - b.id),
    ports,
  };
}
