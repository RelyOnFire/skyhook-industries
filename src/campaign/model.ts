/** Persistent event-driven logistics. Rates and recipes are game rules.
 * This does not dispatch the Earth solver for lunar or Phobos operations. */
export const CAMPAIGN_MODEL = 'network-0.3.0';
export const SITES = ['earth', 'moon', 'phobos', 'mercury'] as const;
export type SiteId = typeof SITES[number];
export const SITE = {
  earth: { name: 'Earth', facility: 'Orbital rotovator', description: 'Manufacture equipment and allocate support propellant for the network.', color: '#8ebbc6' },
  moon: { name: 'Moon', facility: 'Lunavator', description: 'A freely orbiting lunar rotor. Supply its processor with equipment to export lunar construction material.', color: '#d7d1bf' },
  mercury: { name: 'Mercury', facility: 'Mercury rotovator', description: 'An orbital transfer port above a surface refinery and mirror works. Supply equipment to turn local material into the first solar swarm.', color: '#c6b69a' },
  phobos: { name: 'Phobos', facility: 'Phobos anchor hub', description: 'Phobos is the central anchor, with an inward Mars-facing tether and an outward transfer arm.', color: '#e3a782' },
} as const;
export const DAY = 86400;
export const EARTH_EQUIPMENT_PER_DAY = .5;
const AU = 149597870700, SUN_GM = 1.32712440018e20, EARTH_GM = 3.986004418e14;
const EPS = 1e-8;
export const MERCURY_AU = .38709927;
/** Ideal half-ellipse between circular radii, SI. No ephemerides or targeting. */
export function hohmannDays(mu: number, r1: number, r2: number) {
  if (![mu,r1,r2].every(x => Number.isFinite(x) && x > 0)) throw Error('Invalid orbital parameters.');
  return Math.PI * Math.sqrt(((r1 + r2) / 2) ** 3 / mu) / DAY;
}
export const ROUTES = [
  { id: 'lunar', a: 'earth', b: 'moon', name: 'Cislunar corridor', coastDays: hohmannDays(EARTH_GM, 6371000 + 1600000, 384400000), handlingDays: 1, fuelPerT: .35 },
  { id: 'mars', a: 'earth', b: 'phobos', name: 'Mars transfer corridor', coastDays: hohmannDays(SUN_GM, AU, AU * 1.523679), handlingDays: 3, fuelPerT: 1.2 },
  // Moon's heliocentric radius is approximated as Earth's; one extra handling day.
  { id: 'lunar-mars', a: 'moon', b: 'phobos', name: 'Lunar–Phobos corridor', coastDays: hohmannDays(SUN_GM, AU, AU * 1.523679), handlingDays: 4, fuelPerT: 1.2 },
  { id: 'earth-mercury', a: 'earth', b: 'mercury', name: 'Mercury supply corridor', coastDays: hohmannDays(SUN_GM, AU, AU * MERCURY_AU), handlingDays: 4, fuelPerT: 1.8 },
  { id: 'moon-mercury', a: 'moon', b: 'mercury', name: 'Lunar–Mercury corridor', coastDays: hohmannDays(SUN_GM, AU, AU * MERCURY_AU), handlingDays: 5, fuelPerT: 1.8 },
  { id: 'phobos-mercury', a: 'phobos', b: 'mercury', name: 'Phobos–Mercury corridor', coastDays: hohmannDays(SUN_GM, AU * 1.523679, AU * MERCURY_AU), handlingDays: 6, fuelPerT: 2.2 },
] as const;
export const SOLAR = {
  depositT: 100000, unlockMaterialsT: 60, unlockEquipmentT: 20, unlockOperations: 100,
  worksMaterialsT: 40, worksEquipmentT: 10, arrayMaterialsT: 40, arrayEquipmentT: 10,
  mineTPerDay: 2, mineEquipmentPerT: .05, mirrorsTPerDay: 1, mirrorEquipmentPerT: .05,
  launchT: 10, intervalDays: 10, fuelPerT: .1, radiusAU: .5, areaKm2PerT: .1,
  deploymentDays: hohmannDays(SUN_GM, AU * MERCURY_AU, AU * .5) + 2,
} as const;
export type CargoKind = 'materials' | 'equipment';
export const CARGO = { materials: 'Construction material', equipment: 'Equipment' } as const;
export const INDUSTRY = {
  mercury: { name: 'Mercury refinery', detail: 'Up to 2 t construction material / daily cycle, using 0.1 t equipment and 2 t of the local deposit.' },
  earth: { name: 'Earth manufacturing', detail: '+0.5 t equipment and +1 t pooled support propellant / day. Surface supply is included.' },
  moon: { name: 'Lunar processor', detail: '+1 t construction material / day, using 0.05 t equipment / day for maintenance.' },
  phobos: { name: 'Mars staging depot', detail: '+1 Mars operations point / day, using 0.5 t construction material and 0.02 t equipment / day.' },
} as const;
export interface Port { materialsT: number; equipmentT: number; industry: boolean; level: number; readyDay: number; receivedT: number; sentT: number }
export interface Shipment { id: number; from: SiteId; to: SiteId; cargoT: number; fuelT: number; mode: 'tug' | 'tether'; departed: number; arrival: number; kind: CargoKind; serviceId: number | null }
export interface Service { id: number; from: SiteId; to: SiteId; cargoT: number; kind: CargoKind; mode: Shipment['mode']; intervalDays: number; nextDay: number; enabled: boolean; dispatched: number; deliveredT: number }
export interface Deployment { id: number; massT: number; departed: number; arrival: number }
export interface SolarIndustry {
  unlocked: boolean; depositT: number; nextCycleDay: number | null; mirrorWorks: boolean;
  launchArray: boolean; mirrorsT: number; manufacturedT: number; deployedT: number;
  autoLaunch: boolean; nextLaunchDay: number | null; nextDeployment: number; deployments: Deployment[];
}
function freshSolar(): SolarIndustry {
  return {unlocked:false,depositT:SOLAR.depositT,nextCycleDay:null,mirrorWorks:false,launchArray:false,
    mirrorsT:0,manufacturedT:0,deployedT:0,autoLaunch:false,nextLaunchDay:null,nextDeployment:1,deployments:[]};
}
function emptyPort(): Port {return {materialsT:0,equipmentT:0,industry:false,level:0,readyDay:0,receivedT:0,sentT:0};}
export interface Entry { day: number; text: string }
export interface Campaign {
  schema: 3; model: typeof CAMPAIGN_MODEL; id: string; name: string; revision: number;
  day: number; fuelT: number; nextShipment: number; nextSupplyDay: number; lunarReturnedT: number;
  ports: Record<SiteId, Port>; flights: Shipment[]; log: Entry[];
  solar: SolarIndustry; services: Service[]; nextService: number; marsOperations: number; lunarPhobosDeliveredT: number;
}
export const LIMITS = { days: 100000, stock: 1000000, flights: 32, services: 12, fileBytes: 512000 };
export function createCampaign(id: string, name: string): Campaign {
  const port = (materialsT: number, level = 0): Port => ({ materialsT, equipmentT: level ? 20 : 0, industry: !!level, level, readyDay: 0, receivedT: 0, sentT: 0 });
  return { schema: 3, model: CAMPAIGN_MODEL, id, name: name.trim().slice(0,48) || 'First light', revision: 0,
    day: 0, fuelT: 100, nextShipment: 1, nextSupplyDay: 0, lunarReturnedT: 0,
    ports: { earth: port(160,1), moon: port(0), phobos: port(0), mercury: emptyPort() }, flights: [],
    solar:freshSolar(), services: [], nextService: 1, marsOperations: 0, lunarPhobosDeliveredT: 0,
    log: [{ day: 0, text: 'Earth depot commissioned. Deliver 30 t of construction cargo to the Moon to build your first lunavator.' }] };
}
export function routeFor(from: SiteId, to: SiteId) {
  const route = ROUTES.find(r => (r.a === from && r.b === to) || (r.b === from && r.a === to));
  if (!route) throw Error('Choose two different destinations.');
  return route;
}
const key = (kind: CargoKind) => kind === 'materials' ? 'materialsT' : 'equipmentT';
const stock = (w: Campaign, site: SiteId, kind: CargoKind) => w.ports[site][key(kind)];
function room(w: Campaign, site: SiteId, kind: CargoKind) {
  return Math.max(0,LIMITS.stock-stock(w,site,kind)-w.flights.filter(f=>f.to===site&&f.kind===kind).reduce((n,f)=>n+f.cargoT,0));
}
export function flightPlan(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind = 'materials') {
  const route = routeFor(from,to), origin = world.ports[from], destination = world.ports[to];
  const capacity = mode === 'tether' ? 10 * Math.min(origin.level, destination.level) : 10;
  // Support/targeting/recovery allocations, not delta-v or demonstrated fuel savings.
  const fuelT = Math.round(cargoT * route.fuelPerT * (mode === 'tether' ? .4 : 1) * 1000) / 1000;
  const duration = route.coastDays + route.handlingDays;
  let reason = '';
  if ((from==='mercury'||to==='mercury')&&!world.solar.unlocked) reason = 'Open the Mercury expedition in Chapter 03 first.';
  else if (!Object.hasOwn(CARGO,kind)) reason = 'Choose a cargo type.';
  else if (!['tug','tether'].includes(mode)) reason = 'Choose a transport mode.';
  else if (!Number.isFinite(cargoT) || cargoT < 1 || !Number.isInteger(cargoT)) reason = 'Cargo must be a whole number of tonnes, at least 1.';
  else if (mode === 'tether' && (!origin.level || !destination.level)) reason = 'Commission a tether at both ends first. Use a bootstrap tug to deliver construction cargo.';
  else if (cargoT > capacity) reason = 'This service carries up to '+capacity+' t per flight.';
  else if (stock(world,from,kind) + EPS < cargoT) {
    reason = 'Not enough '+CARGO[kind].toLowerCase()+' at '+SITE[from].name+'.';
    if(from==='earth'&&kind==='equipment'&&origin.industry) reason += ' Earth manufactures '+EARTH_EQUIPMENT_PER_DAY+' t per simulation day. Press Play or advance time to replenish it.';
  }
  else if (room(world,to,kind) + EPS < cargoT) reason = 'The destination has no storage space after incoming deliveries.';
  else if (world.fuelT + EPS < fuelT) reason = 'Support propellant is low. Request an Earth supply allocation.';
  else if (mode === 'tether' && Math.max(origin.readyDay,destination.readyDay) > world.day + EPS) reason = 'The tether service is recovering. Advance time before booking another slot.';
  else if (world.flights.length + world.solar.deployments.length >= LIMITS.flights) reason = 'The traffic limit is 32 active flights. Advance to an arrival first.';
  else if (world.day + duration > LIMITS.days) reason = 'This campaign has reached its simulation horizon. Export it and start a new network.';
  return { route, capacity, fuelT, duration, reason };
}
function edit(world: Campaign) { const next = structuredClone(world); next.revision++; return next; }
function note(world: Campaign, text: string) { world.log.push({ day: world.day, text }); world.log = world.log.slice(-60); }
function launch(next: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind, serviceId: number | null) {
  const plan = flightPlan(next,from,to,cargoT,mode,kind); if (plan.reason) throw Error(plan.reason);
  next.ports[from][key(kind)] = Math.max(0,stock(next,from,kind)-cargoT);
  next.ports[from].sentT += cargoT; next.fuelT = Math.max(0,next.fuelT-plan.fuelT);
  if (mode === 'tether') for (const id of [from,to]) next.ports[id].readyDay = next.day + 2 / next.ports[id].level;
  const flight: Shipment = { id: next.nextShipment++, from, to, cargoT, fuelT: plan.fuelT, mode, kind, serviceId, departed: next.day, arrival: next.day + plan.duration };
  next.flights.push(flight);
  note(next,'Flight '+flight.id+': '+cargoT+' t '+CARGO[kind].toLowerCase()+' dispatched from '+SITE[from].name+' to '+SITE[to].name+(serviceId?' by service '+serviceId:'')+'.');
}
export function dispatch(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind = 'materials'): Campaign {
  const next = edit(world); launch(next,from,to,cargoT,mode,kind,null); return next;
}
/** Continuous production between discrete events. Incoming cargo reserves
 * storage; a full producer pauses without consuming maintenance. */
function produce(w: Campaign, days: number) {
  if (w.ports.earth.industry) {
    w.ports.earth.equipmentT += Math.min(days * EARTH_EQUIPMENT_PER_DAY,room(w,'earth','equipment'));
    w.fuelT = Math.min(LIMITS.stock,w.fuelT+days);
  }
  const moon=w.ports.moon;
  if (moon.industry) {
    const output=Math.max(0,Math.min(days,moon.equipmentT/.05,room(w,'moon','materials')));
    moon.materialsT += output; moon.equipmentT = Math.max(0,moon.equipmentT-output*.05);
  }
  const phobos=w.ports.phobos;
  if (phobos.industry) {
    const work=Math.max(0,Math.min(days,phobos.materialsT/.5,phobos.equipmentT/.02));
    phobos.materialsT = Math.max(0,phobos.materialsT-work*.5);
    phobos.equipmentT = Math.max(0,phobos.equipmentT-work*.02); w.marsOperations += work;
  }
}
function mercuryCycle(w: Campaign) {
  const p=w.ports.mercury, s=w.solar;
  const mined=Math.max(0,Math.min(SOLAR.mineTPerDay,s.depositT,p.equipmentT/SOLAR.mineEquipmentPerT,room(w,'mercury','materials')));
  s.depositT=Math.max(0,s.depositT-mined); p.materialsT+=mined; p.equipmentT=Math.max(0,p.equipmentT-mined*SOLAR.mineEquipmentPerT);
  if(s.mirrorWorks) {
    const made=Math.max(0,Math.min(SOLAR.mirrorsTPerDay,p.materialsT,p.equipmentT/SOLAR.mirrorEquipmentPerT,LIMITS.stock-s.mirrorsT));
    p.materialsT=Math.max(0,p.materialsT-made);p.equipmentT=Math.max(0,p.equipmentT-made*SOLAR.mirrorEquipmentPerT);
    s.mirrorsT+=made;s.manufacturedT+=made;
  }
  s.nextCycleDay=w.day+1;
}
function deploy(w: Campaign) {
  for(const d of w.solar.deployments.filter(d=>d.arrival<=w.day+EPS).sort((a,b)=>a.arrival-b.arrival||a.id-b.id)) {
    w.solar.deployedT+=d.massT;
    note(w,'Mirror launch '+d.id+' deployed. '+d.massT+' t joined the solar swarm.');
  }
  w.solar.deployments=w.solar.deployments.filter(d=>d.arrival>w.day+EPS);
}
function arrive(w: Campaign) {
  const arrived=w.flights.filter(f=>f.arrival<=w.day+EPS).sort((a,b)=>a.arrival-b.arrival||a.id-b.id);
  for (const f of arrived) {
    w.ports[f.to][key(f.kind)] += f.cargoT; w.ports[f.to].receivedT += f.cargoT;
    if(f.from==='moon'&&f.to==='earth') w.lunarReturnedT += f.cargoT;
    if(f.from==='moon'&&f.to==='phobos'&&f.kind==='materials') w.lunarPhobosDeliveredT += f.cargoT;
    const service=w.services.find(s=>s.id===f.serviceId); if(service) service.deliveredT += f.cargoT;
    note(w,'Flight '+f.id+' arrived at '+SITE[f.to].name+'. '+f.cargoT+' t '+CARGO[f.kind].toLowerCase()+' added to the depot.');
  }
  w.flights=w.flights.filter(f=>f.arrival>w.day+EPS);
}
export function advance(world: Campaign, days: number): Campaign {
  if (!Number.isFinite(days) || days <= 0 || world.day + days > LIMITS.days) throw Error('Choose a positive time step within the campaign horizon.');
  const next=edit(world), target=world.day+days;
  // Arrivals precede bookings at the same instant; older services get first use.
  while(next.day<target) {
    const events=[target,...next.flights.map(f=>f.arrival),...next.services.filter(s=>s.enabled).map(s=>s.nextDay),
      ...next.solar.deployments.map(d=>d.arrival),
      ...(next.solar.nextCycleDay===null?[]:[next.solar.nextCycleDay]),
      ...(next.solar.autoLaunch&&next.solar.nextLaunchDay!==null?[next.solar.nextLaunchDay]:[])];
    const at=Math.min(...events); produce(next,Math.max(0,at-next.day)); next.day=at;
    arrive(next); deploy(next);
    if(next.solar.nextCycleDay!==null&&next.solar.nextCycleDay<=at+EPS)mercuryCycle(next);
    for(const service of [...next.services].sort((a,b)=>a.id-b.id)) {
      if(!service.enabled||service.nextDay>at+EPS) continue;
      const plan=flightPlan(next,service.from,service.to,service.cargoT,service.mode,service.kind);
      if(!plan.reason) {
        launch(next,service.from,service.to,service.cargoT,service.mode,service.kind,service.id);
        service.dispatched++; service.nextDay=at+service.intervalDays;
      } else service.nextDay=at+1; // No backlog or log spam: retry tomorrow.
    }
    if(next.solar.autoLaunch&&next.solar.nextLaunchDay!==null&&next.solar.nextLaunchDay<=at+EPS) {
      if(!mirrorLaunchPlan(next,SOLAR.launchT).reason) {
        launchMirrorsInto(next,SOLAR.launchT); next.solar.nextLaunchDay=at+SOLAR.intervalDays;
      } else next.solar.nextLaunchDay=at+1;
    }
  }
  return next;
}
export function nextEventDay(world: Campaign) {
  const days = [...world.flights.map(f => f.arrival), ...SITES.map(s => world.ports[s].readyDay), world.nextSupplyDay,
    ...world.services.filter(s=>s.enabled).map(s=>s.nextDay),...world.solar.deployments.map(d=>d.arrival),
    ...(world.solar.nextCycleDay===null?[]:[world.solar.nextCycleDay]),
    ...(world.solar.autoLaunch&&world.solar.nextLaunchDay!==null?[world.solar.nextLaunchDay]:[])].filter(d => d > world.day + EPS && d <= LIMITS.days);
  return days.length ? Math.min(...days) : null;
}
export function buildCost(world: Campaign, site: SiteId) { return 30 * (world.ports[site].level + 1); }
export function build(world: Campaign, site: SiteId): Campaign {
  if(site==='mercury'&&!world.solar.unlocked)throw Error('Open the Mercury expedition first.');
  const port = world.ports[site], cost = buildCost(world,site);
  if (port.level >= 3) throw Error('This facility is already at the highest campaign tier.');
  if (port.materialsT + EPS < cost) throw Error('Deliver '+(cost-port.materialsT)+' t more construction cargo to '+SITE[site].name+'.');
  const next = edit(world); next.ports[site].materialsT = Math.max(0,port.materialsT-cost); next.ports[site].level++;
  note(next,SITE[site].facility+' '+(port.level?'upgraded':'commissioned')+' at '+SITE[site].name+'. Tier '+next.ports[site].level+' / '+next.ports[site].level*10+' t service rating.');
  return next;
}
export function installIndustry(world: Campaign, site: SiteId): Campaign {
  if(site==='mercury'&&!world.solar.unlocked)throw Error('Open the Mercury expedition first.');
  const p=world.ports[site];
  if(p.industry) throw Error('This industry is already installed.');
  if(!p.level) throw Error('Commission the tether here first.');
  if(p.materialsT+EPS<20 || p.equipmentT+EPS<5) throw Error('Industry needs 20 t construction material and 5 t equipment in this depot.');
  const next=edit(world); next.ports[site].materialsT=Math.max(0,p.materialsT-20);next.ports[site].equipmentT=Math.max(0,p.equipmentT-5);next.ports[site].industry=true;
  if(site==='mercury')next.solar.nextCycleDay=next.day+1;
  note(next,INDUSTRY[site].name+' installed at '+SITE[site].name+'.'); return next;
}
export function industryStatus(w: Campaign, site: SiteId) {
  const p=w.ports[site];
  if(!p.industry) return 'Not installed';
  if(site==='earth') return 'Manufacturing and support allocation active';
  if(site==='mercury'&&w.solar.depositT<EPS)return 'Local deposit exhausted';
  if(site==='mercury'&&room(w,site,'materials')<EPS)return 'Construction storage full';
  if(site==='mercury'&&p.equipmentT>=EPS)return 'Refining local material each simulation day';
  if(p.equipmentT<EPS) return 'Waiting for equipment';
  if(site==='moon'&&room(w,site,'materials')<EPS) return 'Construction storage full';
  if(site==='phobos'&&p.materialsT<EPS) return 'Waiting for construction material';
  return site==='moon'?'Processing lunar material':'Supporting Mars operations';
}
export function addService(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind, intervalDays: number): Campaign {
  routeFor(from,to);
  if((from==='mercury'||to==='mercury')&&!world.solar.unlocked)throw Error('Open the Mercury expedition first.');
  if(world.services.length>=LIMITS.services) throw Error('The network supports up to 12 scheduled services.');
  if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>3650) throw Error('Choose an interval from 1 to 3,650 whole days.');
  if(!['tug','tether'].includes(mode)||!Object.hasOwn(CARGO,kind)||!Number.isInteger(cargoT)||cargoT<1||cargoT>(mode==='tug'?10:30)) throw Error('Choose a valid cargo type, service and payload.');
  if(world.day+1>LIMITS.days) throw Error('This campaign has reached its simulation horizon.');
  const next=edit(world), id=next.nextService++;
  next.services.push({id,from,to,cargoT,mode,kind,intervalDays,nextDay:world.day+1,enabled:true,dispatched:0,deliveredT:0});
  note(next,'Service '+id+' scheduled: '+cargoT+' t '+CARGO[kind].toLowerCase()+', '+SITE[from].name+' → '+SITE[to].name+', every '+intervalDays+' days.'); return next;
}
export function toggleService(world: Campaign, id: number): Campaign {
  const next=edit(world), service=next.services.find(s=>s.id===id);
  if(!service) throw Error('Service not found.');
  service.enabled=!service.enabled; service.nextDay=Math.max(next.day+1,service.nextDay);
  note(next,'Service '+id+' '+(service.enabled?'resumed':'paused')+'.'); return next;
}
export function removeService(world: Campaign, id: number): Campaign {
  if(!world.services.some(s=>s.id===id)) throw Error('Service not found.');
  const next=edit(world); next.services=next.services.filter(s=>s.id!==id);
  note(next,'Service '+id+' removed. Its flights already in transit will still arrive.'); return next;
}
export function resupply(world: Campaign): Campaign {
  if (world.day + EPS < world.nextSupplyDay) throw Error('The next Earth supply allocation is not ready yet.');
  if (room(world,'earth','materials') < 60 || world.fuelT > LIMITS.stock - 60) throw Error('The depot has reached its storage limit.');
  const next = edit(world); next.ports.earth.materialsT += 60; next.fuelT += 60; next.nextSupplyDay = next.day + 30;
  note(next,'Earth supply allocation: +60 t construction cargo and +60 t support propellant. Next allocation in 30 days.');
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
export function networkObjectives(w: Campaign) {
  return [
    {name:'Process the Moon',detail:'Install a lunar processor and keep it supplied with equipment.',done:w.ports.moon.industry},
    {name:'Connect the outer depot',detail:'Deliver lunar construction material directly to Phobos.',done:w.lunarPhobosDeliveredT>0},
    {name:'Establish a regular service',detail:'Complete three departures and a delivery on one Moon–Phobos construction service.',done:w.services.some(s=>s.from==='moon'&&s.to==='phobos'&&s.kind==='materials'&&s.dispatched>=3&&s.deliveredT>0)},
    {name:'Support Mars operations',detail:'Install the Phobos staging depot and earn 100 operations points.',done:w.marsOperations>=100},
  ];
}

export function mercuryUnlockReason(w: Campaign) {
  if(w.solar.unlocked)return 'Mercury expedition already open.';
  if(w.marsOperations<SOLAR.unlockOperations)return 'Earn 100 Mars operations points at the Phobos staging depot.';
  if(w.ports.earth.materialsT<SOLAR.unlockMaterialsT||w.ports.earth.equipmentT<SOLAR.unlockEquipmentT)return 'Prepare 60 t construction material and 20 t equipment at Earth for the expedition.';
  return '';
}
export function unlockMercury(w: Campaign): Campaign {
  const reason=mercuryUnlockReason(w);if(reason)throw Error(reason);
  const next=edit(w);next.ports.earth.materialsT-=SOLAR.unlockMaterialsT;next.ports.earth.equipmentT-=SOLAR.unlockEquipmentT;
  next.solar.unlocked=true;
  note(next,'Mercury expedition opened. Earth procurement consumed 60 t construction and 20 t equipment. Ship cargo to commission Mercury next.');return next;
}
export function solarBuildReason(w: Campaign, facility: 'mirrorWorks'|'launchArray') {
  if(w.solar[facility])return 'This facility is already installed.';
  if(!w.solar.unlocked||!w.ports.mercury.industry)return 'Install the Mercury refinery first.';
  if(facility==='launchArray'&&!w.solar.mirrorWorks)return 'Install the mirror works first.';
  if(w.ports.mercury.materialsT<40||w.ports.mercury.equipmentT<10)return 'This facility needs 40 t construction material and 10 t equipment at Mercury.';
  return '';
}
export function buildSolar(w: Campaign, facility: 'mirrorWorks'|'launchArray'): Campaign {
  if(!['mirrorWorks','launchArray'].includes(facility))throw Error('Unknown solar facility.');
  const reason=solarBuildReason(w,facility);if(reason)throw Error(reason);
  const next=edit(w);next.ports.mercury.materialsT-=40;next.ports.mercury.equipmentT-=10;next.solar[facility]=true;
  note(next,(facility==='mirrorWorks'?'Mirror works':'Mirror launch array')+' installed at Mercury.');return next;
}
export function mirrorLaunchPlan(w: Campaign, massT: number) {
  const fuelT=massT*SOLAR.fuelPerT,p=w.ports.mercury;
  let reason='';
  if(!w.solar.unlocked||!w.solar.launchArray||!p.level)reason='Build the mirror launch array at Mercury first.';
  else if(!Number.isInteger(massT)||massT<1||massT>p.level*10)reason='Choose a whole payload from 1 to '+p.level*10+' t.';
  else if(w.solar.mirrorsT+EPS<massT)reason='Mirror stock is low. Supply Mercury with equipment and advance time.';
  else if(w.fuelT+EPS<fuelT)reason='Support propellant is low. Advance time or request an Earth supply allocation.';
  else if(p.readyDay>w.day+EPS)reason='Mercury transfer service is recovering.';
  else if(w.flights.length+w.solar.deployments.length>=LIMITS.flights)reason='The network traffic limit is 32 active flights.';
  else if(w.day+SOLAR.deploymentDays>LIMITS.days)reason='This transfer would exceed the campaign horizon.';
  return {fuelT,duration:SOLAR.deploymentDays,reason};
}
function launchMirrorsInto(w: Campaign, massT: number) {
  const plan=mirrorLaunchPlan(w,massT);if(plan.reason)throw Error(plan.reason);
  w.solar.mirrorsT=Math.max(0,w.solar.mirrorsT-massT);w.fuelT=Math.max(0,w.fuelT-plan.fuelT);
  w.ports.mercury.readyDay=w.day+2/w.ports.mercury.level;
  const id=w.solar.nextDeployment++;
  w.solar.deployments.push({id,massT,departed:w.day,arrival:w.day+plan.duration});
  note(w,'Mirror launch '+id+': '+massT+' t departed Mercury for the solar swarm.');
}
export function launchMirrors(w: Campaign, massT=SOLAR.launchT): Campaign {
  const next=edit(w);launchMirrorsInto(next,massT);return next;
}
export function toggleMirrorLaunches(w: Campaign): Campaign {
  if(!w.solar.launchArray)throw Error('Install the mirror launch array first.');
  const next=edit(w);next.solar.autoLaunch=!next.solar.autoLaunch;next.solar.nextLaunchDay=next.solar.autoLaunch?next.day+1:null;
  note(next,'Automatic mirror launches '+(next.solar.autoLaunch?'enabled: 10 t every 10 days, retrying tomorrow when blocked.':'paused. Existing deployments continue.'));return next;
}
export function solarObjectives(w: Campaign) {
  return [
    {name:'Establish the Mercury base',detail:'Open the expedition, commission its rotovator and install a refinery.',done:w.ports.mercury.industry},
    {name:'Build the mirror pipeline',detail:'Install mirror works and a mirror launch array at Mercury.',done:w.solar.mirrorWorks&&w.solar.launchArray},
    {name:'First light',detail:'Launch mirrors and wait for at least 10 t to join the swarm.',done:w.solar.deployedT>=10-EPS},
    {name:'A growing solar swarm',detail:'Deploy 100 t of mirrors: 10 km² under the scenario area assumption.',done:w.solar.deployedT>=100-EPS},
  ];
}

/** Construct clean bounded state, migrating only the known first-chapter save.
 * No catch-up production: the new economy starts at the saved simulation day. */
export function validateCampaign(value: unknown): Campaign {
  const object = (v: unknown): Record<string,unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid campaign object.'); return v as Record<string,unknown>; };
  const num = (v: unknown, lo: number, hi: number, integer=false): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) throw Error('Invalid campaign number.'); return v; };
  const str = (v: unknown, max: number): string => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid campaign text.'); return v; };
  const site = (v: unknown): SiteId => { if (!SITES.includes(v as SiteId)) throw Error('Unknown destination in save.'); return v as SiteId; };
  const bool=(v: unknown): boolean=>{if(typeof v!=='boolean')throw Error('Invalid campaign flag.');return v;};
  const kind=(v: unknown): CargoKind=>{if(v!=='materials'&&v!=='equipment')throw Error('Invalid cargo type.');return v;};
  const raw = object(value), legacy=raw.schema===1 && raw.model==='network-0.1.0', previous=raw.schema===2 && raw.model==='network-0.2.0', migrate=legacy||previous;
  if (!migrate && (raw.schema !== 3 || raw.model !== CAMPAIGN_MODEL)) throw Error('This save uses a different campaign version. Keep your backup; it has not been changed.');
  const day = num(raw.day,0,LIMITS.days), rawPorts = object(raw.ports), ports = {} as Record<SiteId,Port>;
  for (const id of SITES) {
    if(id==='mercury'&&migrate){ports.mercury=emptyPort();continue;}
    const p = object(rawPorts[id]); ports[id] = {
      materialsT: num(p.materialsT,0,LIMITS.stock), equipmentT:legacy?(id==='earth'?20:0):num(p.equipmentT,0,LIMITS.stock),
      industry:legacy?id==='earth':bool(p.industry), level: num(p.level,0,3,true), readyDay: num(p.readyDay,0,LIMITS.days+30),
      receivedT: num(p.receivedT,0,1e9), sentT: num(p.sentT,0,1e9) };
    if(ports[id].industry&&!ports[id].level) throw Error('Industry requires a commissioned facility.');
  }
  if (!Array.isArray(raw.flights) || raw.flights.length > LIMITS.flights || !Array.isArray(raw.log) || raw.log.length > 60) throw Error('Campaign record exceeds its size limit.');
  const nextService=legacy?1:num(raw.nextService,1,1e9,true);
  if(!legacy&&(!Array.isArray(raw.services)||raw.services.length>LIMITS.services)) throw Error('Invalid service list.');
  const serviceIds=new Set<number>();
  const services: Service[]=legacy?[]:(raw.services as unknown[]).map(v=>{
    const s=object(v), id=num(s.id,1,nextService-1,true), from=site(s.from), to=site(s.to);routeFor(from,to);
    if(migrate&&(from==='mercury'||to==='mercury'))throw Error('Invalid route for the saved campaign version.');
    if(serviceIds.has(id))throw Error('Duplicate service in save.');serviceIds.add(id);
    if(s.mode!=='tug'&&s.mode!=='tether')throw Error('Invalid service mode.');
    const enabled=bool(s.enabled);
    return {id,from,to,kind:kind(s.kind),mode:s.mode,cargoT:num(s.cargoT,1,s.mode==='tug'?10:30,true),
      intervalDays:num(s.intervalDays,1,3650,true),nextDay:num(s.nextDay,enabled?day+1e-9:0,LIMITS.days+3650),enabled,
      dispatched:num(s.dispatched,0,1e9,true),deliveredT:num(s.deliveredT,0,1e9)};
  });
  const nextShipment = num(raw.nextShipment,1,1e9,true), ids = new Set<number>();
  const flights: Shipment[] = raw.flights.map((v): Shipment => {
    const f = object(v), from = site(f.from), to = site(f.to), route = routeFor(from,to);
    if((legacy&&route.id==='lunar-mars')||(migrate&&(from==='mercury'||to==='mercury')))throw Error('Invalid first-chapter route.');
    const id = num(f.id,1,nextShipment-1,true); if (ids.has(id)) throw Error('Duplicate flight in save.'); ids.add(id);
    const departed = num(f.departed,0,day), arrival = num(f.arrival,day+1e-9,LIMITS.days);
    if (Math.abs(arrival - departed - route.coastDays - route.handlingDays) > 1e-6) throw Error('Invalid flight timing in save.');
    if (f.mode !== 'tug' && f.mode !== 'tether') throw Error('Invalid transport mode.');
    const cargoT = num(f.cargoT,1,f.mode === 'tug' ? 10 : 30,true);
    return { id, from, to, cargoT, fuelT: num(f.fuelT,0,1000), mode: f.mode, departed, arrival,
      kind:legacy?'materials':kind(f.kind),serviceId:legacy||f.serviceId===null?null:num(f.serviceId,1,nextService-1,true) };
  });
  for(const id of SITES) for(const resource of ['materials','equipment'] as CargoKind[]) {
    const inbound=flights.filter(f=>f.to===id&&f.kind===resource).reduce((sum,f)=>sum+f.cargoT,0);
    if(ports[id][key(resource)]+inbound>LIMITS.stock+EPS) throw Error('Incoming cargo exceeds depot storage.');
  }
  let solar=freshSolar();
  if(!migrate) {
    const r=object(raw.solar), nextDeployment=num(r.nextDeployment,1,1e9,true);
    if(!Array.isArray(r.deployments)||r.deployments.length+flights.length>LIMITS.flights)throw Error('Too many active flights.');
    const deploymentIds=new Set<number>();
    const deployments=r.deployments.map(v=>{
      const d=object(v),id=num(d.id,1,nextDeployment-1,true);
      if(deploymentIds.has(id))throw Error('Duplicate mirror deployment.');deploymentIds.add(id);
      const departed=num(d.departed,0,day),arrival=num(d.arrival,day+1e-9,LIMITS.days);
      if(Math.abs(arrival-departed-SOLAR.deploymentDays)>1e-6)throw Error('Invalid mirror deployment timing.');
      return {id,departed,arrival,massT:num(d.massT,1,30,true)};
    });
    solar={unlocked:bool(r.unlocked),depositT:num(r.depositT,0,SOLAR.depositT),
      nextCycleDay:r.nextCycleDay===null?null:num(r.nextCycleDay,day+1e-9,LIMITS.days+1),
      mirrorWorks:bool(r.mirrorWorks),launchArray:bool(r.launchArray),mirrorsT:num(r.mirrorsT,0,LIMITS.stock),
      manufacturedT:num(r.manufacturedT,0,1e9),deployedT:num(r.deployedT,0,1e9),autoLaunch:bool(r.autoLaunch),
      nextLaunchDay:r.nextLaunchDay===null?null:num(r.nextLaunchDay,day+1e-9,LIMITS.days+SOLAR.intervalDays),
      nextDeployment,deployments};
    if(ports.mercury.industry!==(solar.nextCycleDay!==null)||solar.autoLaunch!==(solar.nextLaunchDay!==null))throw Error('Invalid Mercury production clock.');
    if(solar.mirrorWorks&&!ports.mercury.industry||solar.launchArray&&!solar.mirrorWorks||solar.autoLaunch&&!solar.launchArray)throw Error('Invalid solar facility progression.');
    if((solar.manufacturedT>0&&!solar.mirrorWorks)||(solar.nextDeployment>1&&!solar.launchArray))throw Error('Solar progress requires installed facilities.');
    if(Math.abs(solar.manufacturedT-solar.mirrorsT-solar.deployedT-solar.deployments.reduce((n,d)=>n+d.massT,0))>1e-5)throw Error('Mirror mass ledger does not balance.');
    if(!solar.unlocked&&(ports.mercury.level||ports.mercury.materialsT||ports.mercury.equipmentT||solar.depositT!==SOLAR.depositT||
      services.some(s=>s.from==='mercury'||s.to==='mercury')||flights.some(f=>f.from==='mercury'||f.to==='mercury')))throw Error('Mercury requires an open expedition.');
  }
  const log = raw.log.map(v => { const e = object(v); return { day: num(e.day,0,day), text: str(e.text,300) }; });
  return { schema:3, model:CAMPAIGN_MODEL, id:str(raw.id,80), name:str(raw.name,48), revision:num(raw.revision,0,1e9,true), day,
    fuelT:num(raw.fuelT,0,LIMITS.stock), nextShipment, nextSupplyDay:num(raw.nextSupplyDay,0,LIMITS.days+30), lunarReturnedT:num(raw.lunarReturnedT,0,1e9), ports, flights, log,
    solar,services,nextService,marsOperations:legacy?0:num(raw.marsOperations,0,1e9),lunarPhobosDeliveredT:legacy?0:num(raw.lunarPhobosDeliveredT,0,1e9) };
}
export function exportCampaign(world: Campaign) { return JSON.stringify({ format:'skyhook-campaign', version:3, state:validateCampaign(world) },null,2); }
export function importCampaign(text: string, id: string): Campaign {
  if (new TextEncoder().encode(text).length > LIMITS.fileBytes) throw Error('Campaign file exceeds 512 KB.');
  const envelope = JSON.parse(text);
  if (envelope?.format !== 'skyhook-campaign' || ![1,2,3].includes(envelope?.version)) throw Error('Choose a Skyhook campaign backup. Flight Studio design files are separate.');
  // Validate state first to give the useful "different campaign version" message.
  const world = validateCampaign(envelope.state);
  if(envelope.version!==envelope.state.schema)throw Error('Backup envelope and campaign version do not match.');
  world.id = id; world.revision = 0; return world;
}
