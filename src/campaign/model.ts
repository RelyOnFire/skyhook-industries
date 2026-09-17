/** Persistent, turn-based logistics model. Never dispatches the Earth flight
 * solver for lunar or Phobos operations. See docs/tether-lab/campaign.md. */
export const CAMPAIGN_MODEL = 'network-0.1.0';
export const SITES = ['earth', 'moon', 'phobos'] as const;
export type SiteId = typeof SITES[number];
export const SITE = {
  earth: { name: 'Earth', facility: 'Orbital rotovator', description: 'The starting point. Assemble cargo in orbit and send it onward.', color: '#8ebbc6' },
  moon: { name: 'Moon', facility: 'Lunavator', description: 'A freely orbiting lunar rotor. Deliver equipment, then open the return route.', color: '#d7d1bf' },
  phobos: { name: 'Phobos', facility: 'Phobos anchor hub', description: 'Phobos is the central anchor, with an inward Mars-facing tether and an outward transfer arm.', color: '#e3a782' },
} as const;
export const DAY = 86400;
const AU = 149597870700, SUN_GM = 1.32712440018e20, EARTH_GM = 3.986004418e14;
/** Ideal half-ellipse between circular radii, SI. No ephemerides or targeting. */
export function hohmannDays(mu: number, r1: number, r2: number) {
  if (![mu,r1,r2].every(x => Number.isFinite(x) && x > 0)) throw Error('Invalid orbital parameters.');
  return Math.PI * Math.sqrt(((r1 + r2) / 2) ** 3 / mu) / DAY;
}
export const ROUTES = [
  { id: 'lunar', a: 'earth', b: 'moon', name: 'Cislunar corridor', coastDays: hohmannDays(EARTH_GM, 6371000 + 1600000, 384400000), handlingDays: 1, fuelPerT: .35 },
  { id: 'mars', a: 'earth', b: 'phobos', name: 'Mars transfer corridor', coastDays: hohmannDays(SUN_GM, AU, AU * 1.523679), handlingDays: 3, fuelPerT: 1.2 },
] as const;
export interface Port { materialsT: number; level: number; readyDay: number; receivedT: number; sentT: number }
export interface Shipment { id: number; from: SiteId; to: SiteId; cargoT: number; fuelT: number; mode: 'tug' | 'tether'; departed: number; arrival: number }
export interface Entry { day: number; text: string }
export interface Campaign {
  schema: 1; model: typeof CAMPAIGN_MODEL; id: string; name: string; revision: number;
  day: number; fuelT: number; nextShipment: number; nextSupplyDay: number; lunarReturnedT: number;
  ports: Record<SiteId, Port>; flights: Shipment[]; log: Entry[];
}
export const LIMITS = { days: 100000, stock: 1000000, flights: 32, fileBytes: 512000 };
export function createCampaign(id: string, name: string): Campaign {
  const port = (materialsT: number, level = 0): Port => ({ materialsT, level, readyDay: 0, receivedT: 0, sentT: 0 });
  return { schema: 1, model: CAMPAIGN_MODEL, id, name: name.trim().slice(0,48) || 'First light', revision: 0,
    day: 0, fuelT: 100, nextShipment: 1, nextSupplyDay: 0, lunarReturnedT: 0,
    ports: { earth: port(160,1), moon: port(0), phobos: port(0) }, flights: [],
    log: [{ day: 0, text: 'Earth depot commissioned. Deliver 30 t of construction cargo to the Moon to build your first lunavator.' }] };
}
export function routeFor(from: SiteId, to: SiteId) {
  const route = ROUTES.find(r => (r.a === from && r.b === to) || (r.b === from && r.a === to));
  if (!route) throw Error('This corridor is not open. Route Moon–Phobos cargo through Earth.');
  return route;
}
export function flightPlan(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode']) {
  const route = routeFor(from,to), origin = world.ports[from], destination = world.ports[to];
  const capacity = mode === 'tether' ? 10 * Math.min(origin.level, destination.level) : 10;
  // These rates are gameplay allocations for support/targeting/recovery fuel,
  // not delta-v predictions or a claim that a particular tether closes the route.
  const fuelT = Math.round(cargoT * route.fuelPerT * (mode === 'tether' ? .4 : 1) * 1000) / 1000;
  const duration = route.coastDays + route.handlingDays;
  let reason = '';
  if (!['tug','tether'].includes(mode)) reason = 'Choose a transport mode.';
  else if (!Number.isFinite(cargoT) || cargoT < 1 || !Number.isInteger(cargoT)) reason = 'Cargo must be a whole number of tonnes, at least 1.';
  else if (mode === 'tether' && (!origin.level || !destination.level)) reason = 'Commission a tether at both ends first. Use a bootstrap tug to deliver construction cargo.';
  else if (cargoT > capacity) reason = `This service carries up to ${capacity} t per flight.`;
  else if (origin.materialsT < cargoT) reason = `Only ${origin.materialsT} t of construction cargo is available at ${SITE[from].name}.`;
  else if (world.fuelT + 1e-9 < fuelT) reason = 'Support propellant is low. Request an Earth supply allocation.';
  else if (mode === 'tether' && Math.max(origin.readyDay,destination.readyDay) > world.day + 1e-9) reason = 'The tether service is recovering. Advance time before booking another slot.';
  else if (world.flights.length >= LIMITS.flights) reason = 'The traffic limit is 32 active flights. Advance to an arrival first.';
  else if (world.day + duration > LIMITS.days) reason = 'This campaign has reached its simulation horizon. Export it and start a new network.';
  return { route, capacity, fuelT, duration, reason };
}
function edit(world: Campaign) { const next = structuredClone(world); next.revision++; return next; }
function note(world: Campaign, text: string, day = world.day) { world.log.push({ day, text }); world.log = world.log.slice(-60); }
export function dispatch(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode']): Campaign {
  const plan = flightPlan(world,from,to,cargoT,mode); if (plan.reason) throw Error(plan.reason);
  const next = edit(world);
  next.ports[from].materialsT -= cargoT; next.ports[from].sentT += cargoT; next.fuelT = Math.max(0,next.fuelT-plan.fuelT);
  if (mode === 'tether') for (const id of [from,to]) next.ports[id].readyDay = next.day + 2 / next.ports[id].level;
  const flight: Shipment = { id: next.nextShipment++, from, to, cargoT, fuelT: plan.fuelT, mode, departed: next.day, arrival: next.day + plan.duration };
  next.flights.push(flight);
  note(next, `Flight ${flight.id}: ${cargoT} t dispatched from ${SITE[from].name} to ${SITE[to].name} by ${mode === 'tether' ? 'tether service' : 'bootstrap tug'}.`);
  return next;
}
export function advance(world: Campaign, days: number): Campaign {
  if (!Number.isFinite(days) || days <= 0 || world.day + days > LIMITS.days) throw Error('Choose a positive time step within the campaign horizon.');
  const next = edit(world); next.day += days;
  const arrived = next.flights.filter(f => f.arrival <= next.day + 1e-8).sort((a,b) => a.arrival-b.arrival || a.id-b.id);
  for (const f of arrived) {
    next.ports[f.to].materialsT += f.cargoT; next.ports[f.to].receivedT += f.cargoT;
    if (f.from === 'moon' && f.to === 'earth') next.lunarReturnedT += f.cargoT;
    note(next, `Flight ${f.id} arrived at ${SITE[f.to].name}. ${f.cargoT} t added to the depot.`, f.arrival);
  }
  next.flights = next.flights.filter(f => f.arrival > next.day + 1e-8);
  return next;
}
export function nextEventDay(world: Campaign) {
  const days = [...world.flights.map(f => f.arrival), ...SITES.map(s => world.ports[s].readyDay), world.nextSupplyDay].filter(d => d > world.day + 1e-8);
  return days.length ? Math.min(...days) : null;
}
export function buildCost(world: Campaign, site: SiteId) { return 30 * (world.ports[site].level + 1); }
export function build(world: Campaign, site: SiteId): Campaign {
  const port = world.ports[site], cost = buildCost(world,site);
  if (port.level >= 3) throw Error('This facility is already at the highest campaign tier.');
  if (port.materialsT < cost) throw Error(`Deliver ${cost-port.materialsT} t more construction cargo to ${SITE[site].name}.`);
  const next = edit(world); next.ports[site].materialsT -= cost; next.ports[site].level++;
  note(next, `${SITE[site].facility} ${port.level ? 'upgraded' : 'commissioned'} at ${SITE[site].name}. Tier ${next.ports[site].level} / ${next.ports[site].level * 10} t service rating.`);
  return next;
}
export function resupply(world: Campaign): Campaign {
  if (world.day + 1e-8 < world.nextSupplyDay) throw Error('The next Earth supply allocation is not ready yet.');
  if (world.ports.earth.materialsT > LIMITS.stock - 60 || world.fuelT > LIMITS.stock - 60) throw Error('The depot has reached its storage limit.');
  const next = edit(world); next.ports.earth.materialsT += 60; next.fuelT += 60; next.nextSupplyDay = next.day + 30;
  note(next, 'Earth supply allocation: +60 t construction cargo and +60 t support propellant. Next allocation in 30 days.');
  return next;
}
export function objectives(world: Campaign) {
  return [
    { name: 'Establish a lunar foothold', detail: 'Deliver 30 t to the Moon and commission the lunavator.', done: world.ports.moon.level > 0 },
    { name: 'Open the return corridor', detail: 'Send lunar cargo back to Earth and let it arrive.', done: world.lunarReturnedT > 0 },
    { name: 'Anchor the Mars network', detail: 'Deliver 30 t to Phobos and commission its anchored hub.', done: world.ports.phobos.level > 0 },
    { name: 'Grow beyond the first flight', detail: 'Upgrade the lunavator or Phobos hub to tier 2.', done: world.ports.moon.level >= 2 || world.ports.phobos.level >= 2 },
  ];
}

/** Validate untrusted saves before they can alter the active campaign. Reject
 * unknown physics versions instead of silently changing a player's world. */
export function validateCampaign(value: unknown): Campaign {
  const object = (v: unknown): Record<string,unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid campaign object.'); return v as Record<string,unknown>; };
  const num = (v: unknown, lo: number, hi: number, integer=false): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) throw Error('Invalid campaign number.'); return v; };
  const str = (v: unknown, max: number): string => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid campaign text.'); return v; };
  const site = (v: unknown): SiteId => { if (!SITES.includes(v as SiteId)) throw Error('Unknown destination in save.'); return v as SiteId; };
  const raw = object(value);
  if (raw.schema !== 1 || raw.model !== CAMPAIGN_MODEL) throw Error('This save uses a different campaign version. Keep your backup; it has not been changed.');
  const day = num(raw.day,0,LIMITS.days), rawPorts = object(raw.ports), ports = {} as Record<SiteId,Port>;
  for (const id of SITES) {
    const p = object(rawPorts[id]); ports[id] = { materialsT: num(p.materialsT,0,LIMITS.stock), level: num(p.level,0,3,true), readyDay: num(p.readyDay,0,LIMITS.days+30), receivedT: num(p.receivedT,0,1e9), sentT: num(p.sentT,0,1e9) };
  }
  if (!Array.isArray(raw.flights) || raw.flights.length > LIMITS.flights || !Array.isArray(raw.log) || raw.log.length > 60) throw Error('Campaign record exceeds its size limit.');
  const nextShipment = num(raw.nextShipment,1,1e9,true), ids = new Set<number>();
  const flights: Shipment[] = raw.flights.map((v): Shipment => {
    const f = object(v), from = site(f.from), to = site(f.to); const route = routeFor(from,to);
    const id = num(f.id,1,nextShipment-1,true); if (ids.has(id)) throw Error('Duplicate flight in save.'); ids.add(id);
    const departed = num(f.departed,0,day), arrival = num(f.arrival,day+1e-9,LIMITS.days);
    if (Math.abs(arrival - departed - route.coastDays - route.handlingDays) > 1e-6) throw Error('Invalid flight timing in save.');
    if (f.mode !== 'tug' && f.mode !== 'tether') throw Error('Invalid transport mode.');
    const cargoT = num(f.cargoT,1,f.mode === 'tug' ? 10 : 30,true);
    return { id, from, to, cargoT, fuelT: num(f.fuelT,0,1000), mode: f.mode, departed, arrival };
  });
  const log = raw.log.map(v => { const e = object(v); return { day: num(e.day,0,day), text: str(e.text,300) }; });
  return { schema:1, model:CAMPAIGN_MODEL, id:str(raw.id,80), name:str(raw.name,48), revision:num(raw.revision,0,1e9,true), day,
    fuelT:num(raw.fuelT,0,LIMITS.stock), nextShipment, nextSupplyDay:num(raw.nextSupplyDay,0,LIMITS.days+30), lunarReturnedT:num(raw.lunarReturnedT,0,1e9), ports, flights, log };
}
export function exportCampaign(world: Campaign) { return JSON.stringify({ format:'skyhook-campaign', version:1, state:validateCampaign(world) },null,2); }
export function importCampaign(text: string, id: string): Campaign {
  if (new TextEncoder().encode(text).length > LIMITS.fileBytes) throw Error('Campaign file exceeds 512 KB.');
  const envelope = JSON.parse(text);
  if (envelope?.format !== 'skyhook-campaign' || envelope?.version !== 1) throw Error('Choose a Skyhook campaign backup. Flight Studio design files are separate.');
  const world = validateCampaign(envelope.state); world.id = id; world.revision = 0; return world;
}
