import { validateEarthDesignReport, type EarthDesignReport } from '../simulation/expedition-design.js';
/** Persistent event-driven logistics. Rates and recipes are game rules.
 * This does not dispatch the Earth solver for lunar or Phobos operations. */
export const CAMPAIGN_MODEL = 'network-0.9.0';
export const SITES = ['earth', 'moon', 'phobos', 'mercury', 'ceres'] as const;
export type SiteId = typeof SITES[number];
export const SITE = {
  earth: { name: 'Earth', facility: 'Orbital rotovator', description: 'Manufacture equipment and allocate support propellant for the network.', color: '#8ebbc6' },
  moon: { name: 'Moon', facility: 'Lunavator', description: 'A freely orbiting lunar rotor. Supply its processor with equipment to export lunar construction material.', color: '#d7d1bf' },
  mercury: { name: 'Mercury', facility: 'Mercury rotovator', description: 'An orbital transfer port above a surface refinery and mirror works. Supply equipment to turn local material into the first solar swarm.', color: '#c6b69a' },
  phobos: { name: 'Phobos', facility: 'Phobos anchor hub', description: 'Phobos is the central anchor, with an inward Mars-facing tether and an outward transfer arm.', color: '#e3a782' },
  ceres: { name: 'Ceres', facility: 'Ceres rotovator', description: 'A freely orbiting transfer port serving a surface water works. Ship equipment from Phobos and return water for network propellant.', color: '#a0ccd4' },
} as const;
export const DAY = 86400;
export const EARTH_EQUIPMENT_PER_DAY = .5;
const AU = 149597870700, SUN_GM = 1.32712440018e20, EARTH_GM = 3.986004418e14;
const EPS = 1e-8;
export const MERCURY_AU = .38709927;
// Rounded mean distance from NASA Ceres Facts, frozen for this scenario.
export const CERES_AU = 2.8;
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
  { id: 'phobos-ceres', a: 'phobos', b: 'ceres', name: 'Belt supply corridor', coastDays: hohmannDays(SUN_GM, AU * 1.523679, AU * CERES_AU), handlingDays: 6, fuelPerT: .5 },
] as const;
export const SOLAR = {
  depositT: 100000, unlockMaterialsT: 60, unlockEquipmentT: 20, unlockOperations: 100,
  worksMaterialsT: 40, worksEquipmentT: 10, arrayMaterialsT: 40, arrayEquipmentT: 10,
  mineTPerDay: 2, mineEquipmentPerT: .05, mirrorsTPerDay: 1, mirrorEquipmentPerT: .05,
  launchT: 10, intervalDays: 10, fuelPerT: .1, radiusAU: .5, areaKm2PerT: .1,
  deploymentDays: hohmannDays(SUN_GM, AU * MERCURY_AU, AU * .5) + 2,
} as const;
/** Flux has a physical reference; conversion, recipes and capacity are game assumptions. */
export const POWER = {
  linkMaterialsT: 60, linkEquipmentT: 10, minDeployedT: 100,
  irradianceWm2: 1361, returnedFraction: .2, capacityGW: 20,
} as const;
export const BELT = {
  depositT:100000, minSwarmT:2000, unlockMaterialsT:60, unlockEquipmentT:20,
  plantMaterialsT:40, plantEquipmentT:10, waterTPerDay:2, mineEquipmentPerT:.01,
  fuelTPerDay:2, plantEquipmentPerT:.005,
} as const;
/** Finite industrial projects and their local construction costs are scenario rules. */
export const DEVELOPMENT = {
  maxLevel:3, maxTracts:8, tractT:100000,
  launchMaterialsT:300, launchEquipmentT:20, worksMaterialsT:100, worksEquipmentT:10,
  mercuryTractMaterialsT:500, mercuryTractEquipmentT:20, ceresTractMaterialsT:150, ceresTractEquipmentT:10,
} as const;
export type DevelopmentProject = 'launch' | 'water' | 'fuel' | 'mercuryTract' | 'ceresTract';
export interface Development { launchLevel:number; waterLevel:number; fuelLevel:number; mercuryTracts:number; ceresTracts:number; fuelReserveT:number }
function freshDevelopment():Development {return {launchLevel:0,waterLevel:0,fuelLevel:0,mercuryTracts:0,ceresTracts:0,fuelReserveT:0};}
export type CargoKind = 'materials' | 'equipment' | 'water';
export const CARGO = { materials: 'Construction material', equipment: 'Equipment', water:'Water' } as const;
export const INDUSTRY = {
  mercury: { name: 'Mercury refinery', detail: 'Up to 2 t construction material / daily cycle, using 0.1 t equipment and 2 t of the local deposit.' },
  earth: { name: 'Earth manufacturing', detail: '+0.5 t equipment and +1 t pooled support propellant / day. Surface supply is included.' },
  moon: { name: 'Lunar processor', detail: '+1 t construction material / day, using 0.05 t equipment / day for maintenance.' },
  phobos: { name: 'Mars staging depot', detail: '+1 Mars operations point / day, using 0.5 t construction material and 0.02 t equipment / day.' },
  ceres: { name: 'Ceres water works', detail: 'Up to 2 t water / daily cycle, using 0.01 t equipment per tonne from a finite local deposit.' },
} as const;
export interface Port { materialsT: number; equipmentT: number; waterT:number; industry: boolean; level: number; readyDay: number; receivedT: number; sentT: number }
export interface Shipment { id: number; from: SiteId; to: SiteId; cargoT: number; fuelT: number; mode: 'tug' | 'tether'; departed: number; arrival: number; kind: CargoKind; serviceId: number | null; contractId: number | null }
export interface Service { id: number; from: SiteId; to: SiteId; cargoT: number; kind: CargoKind; mode: Shipment['mode']; intervalDays: number; nextDay: number; enabled: boolean; dispatched: number; deliveredT: number; contractId: number | null }
export const CONTRACT_OFFERS = [
  {id:'lunar-return',name:'Lunar construction imports',buyer:'Terran Orbital Works',from:'moon',to:'earth',kind:'materials',rate:4},
  {id:'mars-build',name:'Mars habitat construction',buyer:'Ares Habitat Cooperative',from:'moon',to:'phobos',kind:'materials',rate:8},
  {id:'mercury-tooling',name:'Mercury industrial tooling',buyer:'Helion Research Industries',from:'earth',to:'mercury',kind:'equipment',rate:20},
] as const;
export type ContractOfferId = typeof CONTRACT_OFFERS[number]['id'];
export type ContractSize = 'standard' | 'industrial';
export type ProcurementKind = 'materials' | 'equipment' | 'fuel';
export const PROCUREMENT_PRICES = {materials:12,equipment:30,fuel:2} as const;
const CONTRACT_TERMS = {standard:{quantityT:30,loadingWindowDays:30},industrial:{quantityT:300,loadingWindowDays:120}} as const;
const CONTRACT_COOLDOWN = 90, CONTRACT_HISTORY = 20;
export interface Contract {
  id:number; offerId:ContractOfferId; size:ContractSize; acceptedDay:number; dueDay:number;
  quantityT:number; deliveredT:number; earnedCredits:number;
  status:'active'|'completed'|'expired'|'cancelled'; settledDay:number|null;
}
export interface Commerce {
  credits:number; earnedCredits:number; spentCredits:number; nextContract:number;
  contracts:Contract[]; cooldowns:Record<ContractOfferId,number>;
}
function freshCommerce():Commerce {return {credits:0,earnedCredits:0,spentCredits:0,nextContract:1,contracts:[],cooldowns:{'lunar-return':0,'mars-build':0,'mercury-tooling':0}};}
export interface Deployment { id: number; massT: number; departed: number; arrival: number }
export interface SolarIndustry {
  unlocked: boolean; depositT: number; nextCycleDay: number | null; mirrorWorks: boolean;
  launchArray: boolean; powerLink: boolean; mirrorsT: number; manufacturedT: number; deployedT: number;
  autoLaunch: boolean; nextLaunchDay: number | null; nextDeployment: number; deployments: Deployment[];
}
function freshSolar(): SolarIndustry {
  return {unlocked:false,depositT:SOLAR.depositT,nextCycleDay:null,mirrorWorks:false,launchArray:false,powerLink:false,
    mirrorsT:0,manufacturedT:0,deployedT:0,autoLaunch:false,nextLaunchDay:null,nextDeployment:1,deployments:[]};
}
export interface BeltIndustry { unlocked:boolean; depositT:number; extractedT:number; returnedWaterT:number; refinedT:number; propellantWorks:boolean; nextCycleDay:number|null }
function freshBelt():BeltIndustry {return {unlocked:false,depositT:BELT.depositT,extractedT:0,returnedWaterT:0,refinedT:0,propellantWorks:false,nextCycleDay:null};}
function emptyPort(): Port {return {materialsT:0,equipmentT:0,waterT:0,industry:false,level:0,readyDay:0,receivedT:0,sentT:0};}
export interface Entry { day: number; text: string }
export interface Campaign {
  schema: 9; model: typeof CAMPAIGN_MODEL; id: string; name: string; revision: number;
  day: number; fuelT: number; nextShipment: number; nextSupplyDay: number; lunarReturnedT: number;
  ports: Record<SiteId, Port>; flights: Shipment[]; log: Entry[];
  earthDesign: EarthDesignReport | null; solar: SolarIndustry; belt:BeltIndustry; development:Development; commerce:Commerce; services: Service[]; nextService: number; marsOperations: number; lunarPhobosDeliveredT: number;
}
// Independent transit budgets keep the growing swarm from crowding out supply lines.
export const LIMITS = { days: 100000, stock: 1000000, cargoFlights: 256, mirrorDeployments: 128, services: 12, fileBytes: 512000 };
export function createCampaign(id: string, name: string): Campaign {
  const port = (materialsT: number, level = 0): Port => ({ materialsT, equipmentT: level ? 20 : 0, waterT:0, industry: !!level, level, readyDay: 0, receivedT: 0, sentT: 0 });
  return { schema: 9, model: CAMPAIGN_MODEL, id, name: name.trim().slice(0,48) || 'First light', revision: 0,
    day: 0, fuelT: 100, nextShipment: 1, nextSupplyDay: 0, lunarReturnedT: 0,
    ports: { earth: port(160,1), moon: port(0), phobos: port(0), mercury: emptyPort(), ceres:emptyPort() }, flights: [],
    earthDesign:null, solar:freshSolar(), belt:freshBelt(), development:freshDevelopment(), commerce:freshCommerce(), services: [], nextService: 1, marsOperations: 0, lunarPhobosDeliveredT: 0,
    log: [{ day: 0, text: 'Earth depot commissioned. Deliver 30 t of construction cargo to the Moon to build your first lunavator.' }] };
}
export function routeFor(from: SiteId, to: SiteId) {
  const route = ROUTES.find(r => (r.a === from && r.b === to) || (r.b === from && r.a === to));
  if (!route) throw Error(from==='ceres'||to==='ceres'?'Ceres connects through the Phobos hub.':'Choose two different destinations.');
  return route;
}
const key = (kind: CargoKind) => kind === 'materials' ? 'materialsT' : kind==='equipment'?'equipmentT':'waterT';
export const waterRoute = (from:SiteId,to:SiteId) => from==='ceres'&&to==='phobos';
export const siteLocked = (w:Campaign,id:SiteId) => id==='mercury'&&!w.solar.unlocked||id==='ceres'&&!w.belt.unlocked;
const stock = (w: Campaign, site: SiteId, kind: CargoKind) => w.ports[site][key(kind)];
function room(w: Campaign, site: SiteId, kind: CargoKind) {
  return Math.max(0,LIMITS.stock-stock(w,site,kind)-w.flights.filter(f=>f.to===site&&f.kind===kind).reduce((n,f)=>n+f.cargoT,0));
}
export function flightPlan(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind = 'materials') {
  const route = routeFor(from,to), origin = world.ports[from], destination = world.ports[to];
  const capacity = mode === 'tether' ? Math.min(tetherCapacity(world,from),tetherCapacity(world,to)) : 10;
  // Support/targeting/recovery allocations, not delta-v or demonstrated fuel savings.
  const fuelT = Math.round(cargoT * route.fuelPerT * (mode === 'tether' ? .4 * earthRouteFuelFactor(world,from,to) : 1) * 1000) / 1000;
  const duration = route.coastDays + route.handlingDays;
  let reason = '';
  if ((from==='mercury'||to==='mercury')&&!world.solar.unlocked) reason = 'Open the Mercury expedition in Chapter 03 first.';
  else if ((from==='ceres'||to==='ceres')&&!world.belt.unlocked) reason = 'Open the Ceres expedition in Chapter 05 first.';
  else if (!Object.hasOwn(CARGO,kind)) reason = 'Choose a cargo type.';
  else if (kind==='water'&&!waterRoute(from,to)) reason = 'Water returns from Ceres to the Phobos propellant works.';
  else if (!['tug','tether'].includes(mode)) reason = 'Choose a transport mode.';
  else if (!Number.isFinite(cargoT) || cargoT < 1 || !Number.isInteger(cargoT)) reason = 'Cargo must be a whole number of tonnes, at least 1.';
  else if (mode === 'tether' && (!origin.level || !destination.level)) reason = 'Commission a tether at both ends first. Use a bootstrap tug to deliver construction cargo.';
  else if (cargoT > capacity) reason = 'This service carries up to '+capacity+' t per flight.';
  else if (stock(world,from,kind) + EPS < cargoT) {
    reason = 'Not enough '+CARGO[kind].toLowerCase()+' at '+SITE[from].name+'.';
    if(from==='earth'&&kind==='equipment'&&origin.industry) reason += ' Earth manufactures '+EARTH_EQUIPMENT_PER_DAY+' t per simulation day. Press Play or advance time to replenish it.';
  }
  else if (room(world,to,kind) + EPS < cargoT) reason = 'The destination has no storage space after incoming deliveries.';
  else if (world.fuelT + EPS < fuelT) reason = 'Support propellant is low. Request an Earth supply allocation.'+(world.belt.propellantWorks?' Returned Ceres water also feeds the Phobos plant.':'');
  else if (mode === 'tether' && Math.max(origin.readyDay,destination.readyDay) > world.day + EPS) reason = 'The tether service is recovering. Advance time before booking another slot.';
  else if (world.flights.length >= LIMITS.cargoFlights) reason = 'Cargo traffic is full ('+LIMITS.cargoFlights+' active flights). Advance to a cargo arrival.';
  else if (world.day + duration > LIMITS.days) reason = 'This campaign has reached its simulation horizon. Export it and start a new network.';
  return { route, capacity, fuelT, duration, reason };
}
/** Frozen campaign scaling against the default D1p-0.4.0 two-delivery run.
 * These are dimensionless scenario ratios, not solved interplanetary transfers. */
export const EARTH_REFERENCE = {payloadT:3,intervalS:17319.84471845627,fuelT:13.615127521277605,dryMassT:108.88};
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function earthDesignPerformance(report:EarthDesignReport,level:number) {
  if(report.version===1)return {capacity:10*level,recoveryDays:1.6/level,fuelFactor:1,materialsT:40,equipmentT:10};
  return {
    capacity:Math.max(1,Math.floor(10*level*Math.min(3,report.payloadT/EARTH_REFERENCE.payloadT)+EPS)),
    recoveryDays:2/level*clamp(report.deliveryIntervalS/EARTH_REFERENCE.intervalS,.25,4),
    // Only Earth's half of the corridor support allocation varies.
    fuelFactor:(1+clamp((report.fuelUsedT/report.payloadT)/(EARTH_REFERENCE.fuelT/EARTH_REFERENCE.payloadT),0,4))/2,
    materialsT:Math.max(1,Math.ceil(40*report.dryMassT/EARTH_REFERENCE.dryMassT-EPS)),
    equipmentT:Math.max(1,Math.ceil(10*report.dryMassT/EARTH_REFERENCE.dryMassT-EPS)),
  };
}
export function tetherCapacity(world:Campaign,site:SiteId) {
  const level=world.ports[site].level;
  return !level?0:site==='earth'&&world.earthDesign?earthDesignPerformance(world.earthDesign,level).capacity:10*level;
}
export function tetherRecoveryDays(world:Campaign,site:SiteId) {
  return site==='earth'&&world.earthDesign?earthDesignPerformance(world.earthDesign,world.ports[site].level).recoveryDays:2/world.ports[site].level;
}
export function earthRouteFuelFactor(world:Campaign,from:SiteId,to:SiteId) {
  return (from==='earth'||to==='earth')&&world.earthDesign?earthDesignPerformance(world.earthDesign,world.ports.earth.level).fuelFactor:1;
}
export function earthDesignCost(world:Campaign,report:EarthDesignReport) {
  const p=earthDesignPerformance(report,world.ports.earth.level),credit=world.earthDesign?.version===1;
  return {materialsT:Math.max(0,p.materialsT-(credit?40:0)),equipmentT:Math.max(0,p.equipmentT-(credit?10:0)),credit};
}
export function earthDesignCommissionReason(world:Campaign,report:EarthDesignReport) {
  if(report.version!==2)return 'Recalculate this design in Flight Studio before commissioning its measured performance.';
  if(!world.ports.earth.level)return 'Commission the Earth tether first.';
  if(JSON.stringify(world.earthDesign)===JSON.stringify(report))return 'This exact design is already commissioned.';
  const cost=earthDesignCost(world,report);
  if(world.ports.earth.materialsT+EPS<cost.materialsT||world.ports.earth.equipmentT+EPS<cost.equipmentT)return 'Requires '+cost.materialsT+' t construction material and '+cost.equipmentT+' t equipment at Earth.';
  return '';
}
export function commissionEarthDesign(world:Campaign,report:EarthDesignReport):Campaign {
  const clean=validateEarthDesignReport(report),reason=earthDesignCommissionReason(world,clean);if(reason)throw Error(reason);
  const next=edit(world),cost=earthDesignCost(world,clean);next.earthDesign=clean;
  next.ports.earth.materialsT=Math.max(0,next.ports.earth.materialsT-cost.materialsT);next.ports.earth.equipmentT=Math.max(0,next.ports.earth.equipmentT-cost.equipmentT);
  const p=earthDesignPerformance(clean,next.ports.earth.level);
  note(next,'Earth design commissioned: '+p.capacity+' t capacity, '+p.recoveryDays.toFixed(2)+' day recovery, '+p.fuelFactor.toFixed(2)+'× Earth corridor support fuel. Current reservations and flights remain unchanged.');
  return next;
}
export function restoreStandardEarth(world:Campaign):Campaign {
  if(!world.earthDesign)return world;
  const next=edit(world);next.earthDesign=null;
  note(next,'Earth returned to the standard fleet. Existing reservations, services and cargo remain unchanged. No construction refund.');
  return next;
}
function edit(world: Campaign) { const next = structuredClone(world); next.revision++; return next; }
function note(world: Campaign, text: string) { world.log.push({ day: world.day, text }); world.log = world.log.slice(-60); }
function launch(next: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind, serviceId: number | null, contractId: number | null = null) {
  const plan = flightPlan(next,from,to,cargoT,mode,kind); if (plan.reason) throw Error(plan.reason);
  next.ports[from][key(kind)] = Math.max(0,stock(next,from,kind)-cargoT);
  next.ports[from].sentT += cargoT; next.fuelT = Math.max(0,next.fuelT-plan.fuelT);
  if (mode === 'tether') for (const id of [from,to]) next.ports[id].readyDay = next.day + tetherRecoveryDays(next,id);
  const flight: Shipment = { id: next.nextShipment++, from, to, cargoT, fuelT: plan.fuelT, mode, kind, serviceId, contractId, departed: next.day, arrival: next.day + plan.duration };
  next.flights.push(flight);
  note(next,'Flight '+flight.id+': '+cargoT+' t '+CARGO[kind].toLowerCase()+' dispatched from '+SITE[from].name+' to '+SITE[to].name+(serviceId?' by service '+serviceId:'')+'.');
}
export function dispatch(world: Campaign, from: SiteId, to: SiteId, cargoT: number, mode: Shipment['mode'], kind: CargoKind = 'materials'): Campaign {
  const next = edit(world); launch(next,from,to,cargoT,mode,kind,null); return next;
}

function contractOffer(id:ContractOfferId) {
  const offer=CONTRACT_OFFERS.find(candidate=>candidate.id===id);
  if(!offer)throw Error('Unknown commercial contract.');
  return offer;
}
function contractById(w:Campaign,id:number) {
  const contract=w.commerce.contracts.find(candidate=>candidate.id===id);
  if(!contract)throw Error('Contract not found.');
  return contract;
}
export function activeContract(w:Campaign) {return w.commerce.contracts.find(contract=>contract.status==='active')??null;}
function contractEligibility(w:Campaign,offerId:ContractOfferId,size:ContractSize) {
  const offer=contractOffer(offerId);
  if(siteLocked(w,offer.from)||siteLocked(w,offer.to))return 'Open both route destinations first.';
  if(!w.ports[offer.from].level||!w.ports[offer.to].level)return 'Commission tethers at both route endpoints first.';
  if(!w.ports[offer.from].industry)return 'Install '+INDUSTRY[offer.from].name.toLowerCase()+' at the cargo origin first.';
  if(size==='industrial'&&developmentUnlockReason(w))return 'Industrial orders require an established Mercury and Ceres industrial network.';
  return '';
}
export function contractQuote(w:Campaign,offerId:ContractOfferId,size:ContractSize) {
  const offer=contractOffer(offerId);
  if(size!=='standard'&&size!=='industrial')throw Error('Choose a standard or industrial contract.');
  const terms=CONTRACT_TERMS[size],route=routeFor(offer.from,offer.to),duration=route.coastDays+route.handlingDays;
  const lastDepartureDay=w.day+terms.loadingWindowDays,dueDay=lastDepartureDay+duration;
  const baseCredits=terms.quantityT*offer.rate,bonusCredits=baseCredits/4;
  const reason=contractEligibility(w,offerId,size)||(activeContract(w)?'Finish or cancel your active contract first.':'')||
    (w.commerce.cooldowns[offerId]>w.day+EPS?'This buyer will offer another order on day '+w.commerce.cooldowns[offerId].toFixed(1)+'.':'')||
    (dueDay>LIMITS.days?'This order would finish beyond the campaign horizon.':'');
  return {...offer,...terms,size,duration,acceptedDay:w.day,lastDepartureDay,dueDay,baseCredits,bonusCredits,totalCredits:baseCredits+bonusCredits,reason};
}
export function contractRemaining(w:Campaign,id:number) {
  const contract=contractById(w,id),inFlightT=w.flights.filter(f=>f.contractId===id).reduce((sum,f)=>sum+f.cargoT,0);
  return {unassignedT:Math.max(0,contract.quantityT-contract.deliveredT-inFlightT),inFlightT};
}
/** Customer freight reserves fallback storage but is not usable depot supply. */
export function isCustomerFreight(w:Campaign,flight:Shipment) {
  const contract=flight.contractId===null?null:w.commerce.contracts.find(c=>c.id===flight.contractId);
  return !!contract&&contract.status==='active'&&flight.arrival<=contract.dueDay+EPS;
}
function pruneContracts(w:Campaign) {
  const referenced=new Set([...w.flights.map(f=>f.contractId),...w.services.map(s=>s.contractId)]);
  const recent=new Set(w.commerce.contracts.filter(c=>c.status!=='active').slice(-CONTRACT_HISTORY).map(c=>c.id));
  w.commerce.contracts=w.commerce.contracts.filter(c=>c.status==='active'||referenced.has(c.id)||recent.has(c.id));
}
function stopContractServices(w:Campaign,id:number) {
  for(const service of w.services)if(service.contractId===id)service.enabled=false;
}
function settleContract(w:Campaign,contract:Contract,status:'completed'|'expired'|'cancelled') {
  contract.status=status;contract.settledDay=w.day;
  w.commerce.cooldowns[contract.offerId]=w.day+CONTRACT_COOLDOWN;
  stopContractServices(w,contract.id);
  note(w,'Contract '+contract.id+' '+status+'. '+contract.deliveredT+' / '+contract.quantityT+' t delivered; '+contract.earnedCredits+' credits earned.');
}
export function acceptContract(w:Campaign,offerId:ContractOfferId,size:ContractSize):Campaign {
  const quote=contractQuote(w,offerId,size);if(quote.reason)throw Error(quote.reason);
  const next=edit(w),id=next.commerce.nextContract++;
  next.commerce.contracts.push({id,offerId,size,acceptedDay:w.day,dueDay:quote.dueDay,quantityT:quote.quantityT,deliveredT:0,earnedCredits:0,status:'active',settledDay:null});
  pruneContracts(next);
  note(next,'Contract '+id+' accepted: '+quote.quantityT+' t '+CARGO[quote.kind].toLowerCase()+' for '+quote.buyer+', due day '+quote.dueDay.toFixed(1)+'.');
  return next;
}
export function cancelContract(w:Campaign,id:number):Campaign {
  if(contractById(w,id).status!=='active')throw Error('This contract is already settled.');
  const next=edit(w);settleContract(next,contractById(next,id),'cancelled');pruneContracts(next);return next;
}
export function contractFlightPlan(w:Campaign,id:number,cargoT:number,mode:Shipment['mode']) {
  const contract=contractById(w,id),offer=contractOffer(contract.offerId),plan=flightPlan(w,offer.from,offer.to,cargoT,mode,offer.kind);
  const remaining=contractRemaining(w,id);
  const reason=contract.status!=='active'?'This contract is already settled.':
    remaining.unassignedT===0?'All remaining contract cargo is already in flight.':
    cargoT>remaining.unassignedT?'Only '+remaining.unassignedT+' t remain unassigned to this contract.':
    w.day+plan.duration>contract.dueDay+EPS?'A new departure would arrive after the contract deadline.':plan.reason;
  return {...plan,reason};
}
export function dispatchContract(w:Campaign,id:number,cargoT:number,mode:Shipment['mode']):Campaign {
  const plan=contractFlightPlan(w,id,cargoT,mode);if(plan.reason)throw Error(plan.reason);
  const next=edit(w),offer=contractOffer(contractById(next,id).offerId);
  launch(next,offer.from,offer.to,cargoT,mode,offer.kind,null,id);
  if(contractRemaining(next,id).unassignedT===0)stopContractServices(next,id);
  return next;
}
export function addContractService(w:Campaign,id:number,cargoT:number,mode:Shipment['mode'],intervalDays:number):Campaign {
  const contract=contractById(w,id),offer=contractOffer(contract.offerId),route=routeFor(offer.from,offer.to);
  if(contract.status!=='active')throw Error('This contract is already settled.');
  if(contractRemaining(w,id).unassignedT===0)throw Error('All remaining contract cargo is already in flight.');
  if(w.day+1+route.coastDays+route.handlingDays>contract.dueDay+EPS)throw Error('The first service departure would miss the contract deadline.');
  const next=addService(w,offer.from,offer.to,cargoT,mode,offer.kind,intervalDays);
  next.services[next.services.length-1].contractId=id;
  return next;
}
export function serviceFlightPlan(w:Campaign,service:Service) {
  if(service.contractId===null)return {...flightPlan(w,service.from,service.to,service.cargoT,service.mode,service.kind),cargoT:service.cargoT};
  const cargoT=Math.min(service.cargoT,contractRemaining(w,service.contractId).unassignedT);
  return {...contractFlightPlan(w,service.contractId,cargoT,service.mode),cargoT};
}
export function procurementReason(w:Campaign,kind:ProcurementKind,amountT:number) {
  if(!Object.hasOwn(PROCUREMENT_PRICES,kind))return 'Choose material, equipment or support fuel.';
  if(!Number.isInteger(amountT)||amountT<1||amountT>LIMITS.stock)return 'Choose a whole procurement quantity from 1 to 1,000,000 tonnes.';
  if(w.commerce.credits<amountT*PROCUREMENT_PRICES[kind])return 'Not enough commercial credits.';
  if((kind==='fuel'?LIMITS.stock-w.fuelT:room(w,'earth',kind))+EPS<amountT)return kind==='fuel'?'The support fuel pool has no room.':'Earth storage has no room after incoming deliveries.';
  return '';
}
export function procure(w:Campaign,kind:ProcurementKind,amountT:number):Campaign {
  const reason=procurementReason(w,kind,amountT);if(reason)throw Error(reason);
  const next=edit(w),cost=amountT*PROCUREMENT_PRICES[kind];
  next.commerce.credits-=cost;next.commerce.spentCredits+=cost;
  if(kind==='fuel')next.fuelT+=amountT;else next.ports.earth[key(kind)]+=amountT;
  note(next,'Purchased '+amountT+' t '+(kind==='fuel'?'pooled support fuel':CARGO[kind].toLowerCase()+' at Earth')+' for '+cost+' credits.');
  return next;
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
export function swarmPower(w: Campaign) {
  const areaKm2=w.solar.deployedT*SOLAR.areaKm2PerT;
  const sunlightGW=areaKm2*1e6*POWER.irradianceWm2/(SOLAR.radiusAU**2)/1e9;
  const returnedGW=w.solar.powerLink?sunlightGW*POWER.returnedFraction:0;
  return {areaKm2,sunlightGW,returnedGW,multiplier:1+returnedGW/POWER.capacityGW};
}
/** Preview and execute the same daily recipe: local tooling, refinery, mirrors.
 * Tooling consumes existing construction, never tomorrow's production. */
export function mercuryProduction(w: Campaign) {
  const p=w.ports.mercury,s=w.solar,{multiplier}=swarmPower(w);
  const mineCapacity=p.industry?SOLAR.mineTPerDay*multiplier:0;
  const mirrorCapacity=s.mirrorWorks?SOLAR.mirrorsTPerDay*multiplier:0;
  const equipmentDemand=mineCapacity*SOLAR.mineEquipmentPerT+mirrorCapacity*SOLAR.mirrorEquipmentPerT;
  // Replenish a two-cycle working buffer; do not accumulate unwanted tooling.
  const toolingT=s.powerLink?Math.max(0,Math.min(equipmentDemand,equipmentDemand*2-p.equipmentT,p.materialsT,room(w,'mercury','equipment'))):0;
  const equipment=p.equipmentT+toolingT,materials=p.materialsT-toolingT;
  const minedT=Math.max(0,Math.min(mineCapacity,s.depositT,equipment/SOLAR.mineEquipmentPerT,room(w,'mercury','materials')+toolingT));
  const madeT=Math.max(0,Math.min(mirrorCapacity,materials+minedT,(equipment-minedT*SOLAR.mineEquipmentPerT)/SOLAR.mirrorEquipmentPerT,LIMITS.stock-s.mirrorsT));
  return {multiplier,mineCapacity,mirrorCapacity,equipmentDemand,toolingT,minedT,madeT};
}
function mercuryCycle(w: Campaign) {
  const p=w.ports.mercury,s=w.solar,{toolingT,minedT,madeT}=mercuryProduction(w);
  p.materialsT=Math.max(0,p.materialsT-toolingT+minedT-madeT);
  p.equipmentT=Math.max(0,p.equipmentT+toolingT-minedT*SOLAR.mineEquipmentPerT-madeT*SOLAR.mirrorEquipmentPerT);
  s.depositT=Math.max(0,s.depositT-minedT);s.mirrorsT+=madeT;s.manufacturedT+=madeT;
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
    const contract=f.contractId===null?null:contractById(w,f.contractId);
    if(contract?.status==='active'&&f.arrival<=contract.dueDay+EPS) {
      const offer=contractOffer(contract.offerId);
      contract.deliveredT+=f.cargoT;
      const complete=contract.deliveredT===contract.quantityT;
      const payment=f.cargoT*offer.rate+(complete?contract.quantityT*offer.rate/4:0);
      contract.earnedCredits+=payment;w.commerce.earnedCredits+=payment;w.commerce.credits+=payment;
      note(w,'Flight '+f.id+': '+f.cargoT+' t received by '+offer.buyer+' for contract '+contract.id+'. '+payment+' credits paid; cargo consumed by the customer.');
      if(complete)settleContract(w,contract,'completed');
    } else {
      w.ports[f.to][key(f.kind)] += f.cargoT; w.ports[f.to].receivedT += f.cargoT;
      if(f.from==='moon'&&f.to==='earth') w.lunarReturnedT += f.cargoT;
      if(f.from==='moon'&&f.to==='phobos'&&f.kind==='materials') w.lunarPhobosDeliveredT += f.cargoT;
      if(f.kind==='water')w.belt.returnedWaterT+=f.cargoT;
      note(w,'Flight '+f.id+' arrived at '+SITE[f.to].name+'. '+f.cargoT+' t '+CARGO[f.kind].toLowerCase()+' added to the depot.');
    }
    const service=w.services.find(s=>s.id===f.serviceId); if(service) service.deliveredT += f.cargoT;
  }
  w.flights=w.flights.filter(f=>f.arrival>w.day+EPS);
  pruneContracts(w);
}
export type BlockedDeparture =
  | { kind:'service'; serviceId:number; day:number; reason:string }
  | { kind:'mirrors'; day:number; reason:string };

export function advance(world: Campaign, days: number, onBlocked?: (departure:BlockedDeparture)=>void): Campaign {
  if (!Number.isFinite(days) || days <= 0 || world.day + days > LIMITS.days) throw Error('Choose a positive time step within the campaign horizon.');
  const next=edit(world), target=world.day+days;
  // Arrivals precede bookings at the same instant; older services get first use.
  while(next.day<target) {
    const events=[target,...next.flights.map(f=>f.arrival),...next.services.filter(s=>s.enabled).map(s=>s.nextDay),
      ...next.commerce.contracts.filter(c=>c.status==='active').map(c=>c.dueDay),
      ...next.solar.deployments.map(d=>d.arrival),
      ...(next.solar.nextCycleDay===null?[]:[next.solar.nextCycleDay]),
      ...(next.belt.nextCycleDay===null?[]:[next.belt.nextCycleDay]),
      ...(next.solar.autoLaunch&&next.solar.nextLaunchDay!==null?[next.solar.nextLaunchDay]:[])];
    const at=Math.min(...events); produce(next,Math.max(0,at-next.day)); next.day=at;
    arrive(next); deploy(next);
    for(const contract of next.commerce.contracts)if(contract.status==='active'&&contract.dueDay<=at+EPS)settleContract(next,contract,'expired');
    pruneContracts(next);
    if(next.solar.nextCycleDay!==null&&next.solar.nextCycleDay<=at+EPS)mercuryCycle(next);
    if(next.belt.nextCycleDay!==null&&next.belt.nextCycleDay<=at+EPS)beltCycle(next);
    for(const service of [...next.services].sort((a,b)=>a.id-b.id)) {
      if(!service.enabled||service.nextDay>at+EPS) continue;
      if(service.contractId!==null&&(contractById(next,service.contractId).status!=='active'||contractRemaining(next,service.contractId).unassignedT===0)){service.enabled=false;continue;}
      const plan=serviceFlightPlan(next,service);
      if(!plan.reason) {
        launch(next,service.from,service.to,plan.cargoT,service.mode,service.kind,service.id,service.contractId);
        service.dispatched++; service.nextDay=at+service.intervalDays;
        if(service.contractId!==null&&contractRemaining(next,service.contractId).unassignedT===0)stopContractServices(next,service.contractId);
      } else {
        onBlocked?.({kind:'service',serviceId:service.id,day:at,reason:plan.reason});
        service.nextDay=at+1; // No backlog or log spam: retry tomorrow.
      }
    }
    if(next.solar.autoLaunch&&next.solar.nextLaunchDay!==null&&next.solar.nextLaunchDay<=at+EPS) {
      const launch=automaticMirrorPlan(next);
      const reason=automaticMirrorLaunchReason(next);
      if(!reason) {
        launchMirrorsInto(next,launch.massT); next.solar.nextLaunchDay=at+launch.intervalDays;
      } else {
        onBlocked?.({kind:'mirrors',day:at,reason});
        next.solar.nextLaunchDay=at+1;
      }
    }
  }
  return next;
}
export function nextEventDay(world: Campaign) {
  const days = [...world.flights.map(f => f.arrival), ...SITES.map(s => world.ports[s].readyDay), world.nextSupplyDay,
    ...world.commerce.contracts.filter(c=>c.status==='active').map(c=>c.dueDay),
    ...world.services.filter(s=>s.enabled).map(s=>s.nextDay),...world.solar.deployments.map(d=>d.arrival),
    ...(world.solar.nextCycleDay===null?[]:[world.solar.nextCycleDay]),
    ...(world.belt.nextCycleDay===null?[]:[world.belt.nextCycleDay]),
    ...(world.solar.autoLaunch&&world.solar.nextLaunchDay!==null?[world.solar.nextLaunchDay]:[])].filter(d => d > world.day + EPS && d <= LIMITS.days);
  return days.length ? Math.min(...days) : null;
}
export function buildCost(world: Campaign, site: SiteId) { return 30 * (world.ports[site].level + 1); }
export function build(world: Campaign, site: SiteId): Campaign {
  if(site==='mercury'&&!world.solar.unlocked)throw Error('Open the Mercury expedition first.');
  if(site==='ceres'&&!world.belt.unlocked)throw Error('Open the Ceres expedition first.');
  const port = world.ports[site], cost = buildCost(world,site);
  if (port.level >= 3) throw Error('This facility is already at the highest campaign tier.');
  if (port.materialsT + EPS < cost) throw Error('Deliver '+(cost-port.materialsT)+' t more construction cargo to '+SITE[site].name+'.');
  const next = edit(world); next.ports[site].materialsT = Math.max(0,port.materialsT-cost); next.ports[site].level++;
  note(next,SITE[site].facility+' '+(port.level?'upgraded':'commissioned')+' at '+SITE[site].name+'. Tier '+next.ports[site].level+' / '+tetherCapacity(next,site)+' t service rating.');
  return next;
}
export function installIndustry(world: Campaign, site: SiteId): Campaign {
  if(site==='mercury'&&!world.solar.unlocked)throw Error('Open the Mercury expedition first.');
  if(site==='ceres'&&!world.belt.unlocked)throw Error('Open the Ceres expedition first.');
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
  if(site==='ceres')return w.belt.depositT<EPS?'Local water deposit exhausted':p.equipmentT<EPS?'Waiting for equipment':room(w,site,'water')<EPS?'Water storage full':'Extracting water each simulation day';
  if(site==='mercury'&&w.solar.depositT<EPS)return 'Local deposit exhausted';
  if(site==='mercury'&&mercuryProduction(w).minedT>EPS)return 'Refining local material each simulation day';
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
  if((from==='ceres'||to==='ceres')&&!world.belt.unlocked)throw Error('Open the Ceres expedition first.');
  if(kind==='water'&&!waterRoute(from,to))throw Error('Water returns from Ceres to the Phobos propellant works.');
  if(world.services.length>=LIMITS.services) throw Error('The network supports up to 12 scheduled services.');
  if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>3650) throw Error('Choose an interval from 1 to 3,650 whole days.');
  if(!['tug','tether'].includes(mode)||!Object.hasOwn(CARGO,kind)||!Number.isInteger(cargoT)||cargoT<1||cargoT>(mode==='tug'?10:30)) throw Error('Choose a valid cargo type, service and payload.');
  if(world.day+1>LIMITS.days) throw Error('This campaign has reached its simulation horizon.');
  const next=edit(world), id=next.nextService++;
  next.services.push({id,from,to,cargoT,mode,kind,intervalDays,nextDay:world.day+1,enabled:true,dispatched:0,deliveredT:0,contractId:null});
  note(next,'Service '+id+' scheduled: '+cargoT+' t '+CARGO[kind].toLowerCase()+', '+SITE[from].name+' → '+SITE[to].name+', every '+intervalDays+' days.'); return next;
}
export function toggleService(world: Campaign, id: number): Campaign {
  const next=edit(world), service=next.services.find(s=>s.id===id);
  if(!service) throw Error('Service not found.');
  if(!service.enabled&&service.contractId!==null) {
    if(contractById(next,service.contractId).status!=='active')throw Error('This contract is already settled.');
    if(contractRemaining(next,service.contractId).unassignedT===0)throw Error('All remaining contract cargo is already in flight.');
  }
  service.enabled=!service.enabled; service.nextDay=Math.max(next.day+1,service.nextDay);
  note(next,'Service '+id+' '+(service.enabled?'resumed':'paused')+'.'); return next;
}
export function removeService(world: Campaign, id: number): Campaign {
  if(!world.services.some(s=>s.id===id)) throw Error('Service not found.');
  const next=edit(world); next.services=next.services.filter(s=>s.id!==id);
  pruneContracts(next);
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
export function powerLinkReason(w: Campaign) {
  if(w.solar.powerLink)return 'Swarm power is already connected.';
  if(!w.solar.launchArray||w.solar.deployedT+EPS<POWER.minDeployedT)return 'Deploy 100 t of mirrors to connect swarm power.';
  if(w.ports.mercury.materialsT+EPS<POWER.linkMaterialsT||w.ports.mercury.equipmentT+EPS<POWER.linkEquipmentT)
    return 'The power link needs 60 t material and 10 t equipment at Mercury.';
  return '';
}
export function connectSwarmPower(w: Campaign): Campaign {
  const reason=powerLinkReason(w);if(reason)throw Error(reason);
  const next=edit(w);next.ports.mercury.materialsT=Math.max(0,next.ports.mercury.materialsT-POWER.linkMaterialsT);
  next.ports.mercury.equipmentT=Math.max(0,next.ports.mercury.equipmentT-POWER.linkEquipmentT);next.solar.powerLink=true;
  note(next,'Swarm power connected to Mercury. Automatic reinvestment scales refining, mirror works and local equipment fabrication from the next daily cycle.');return next;
}
export function automaticMirrorPlan(w: Campaign) {
  const massT=w.solar.powerLink?mirrorCapacity(w):SOLAR.launchT;
  const intervalDays=w.solar.powerLink?Math.max(2/Math.max(1,w.ports.mercury.level),massT/(SOLAR.mirrorsTPerDay*swarmPower(w).multiplier)):SOLAR.intervalDays;
  return {massT,intervalDays};
}
export function mirrorCapacity(w:Campaign) {return Math.max(1,w.ports.mercury.level)*10*2**w.development.launchLevel;}
export function automaticMirrorLaunchReason(w:Campaign) {
  const {massT}=automaticMirrorPlan(w),plan=mirrorLaunchPlan(w,massT);
  return plan.reason||(w.fuelT-plan.fuelT+EPS<w.development.fuelReserveT?'Automatic launches are holding '+w.development.fuelReserveT+' t of support propellant for cargo.':'');
}
export function mirrorLaunchPlan(w: Campaign, massT: number) {
  const fuelT=massT*SOLAR.fuelPerT,p=w.ports.mercury;
  let reason='';
  if(!w.solar.unlocked||!w.solar.launchArray||!p.level)reason='Build the mirror launch array at Mercury first.';
  else if(!Number.isInteger(massT)||massT<1||massT>mirrorCapacity(w))reason='Choose a whole payload from 1 to '+mirrorCapacity(w)+' t.';
  else if(w.solar.mirrorsT+EPS<massT)reason='Mirror stock is low. Supply Mercury with equipment and advance time.';
  else if(w.fuelT+EPS<fuelT)reason='Support propellant is low. Advance time or request an Earth supply allocation.';
  else if(p.readyDay>w.day+EPS)reason='Mercury transfer service is recovering.';
  else if(w.solar.deployments.length>=LIMITS.mirrorDeployments)reason='Mirror traffic is full ('+LIMITS.mirrorDeployments+' active batches). Advance to a mirror arrival.';
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
export function launchMirrors(w: Campaign, massT:number=SOLAR.launchT): Campaign {
  const next=edit(w);launchMirrorsInto(next,massT);return next;
}
export function toggleMirrorLaunches(w: Campaign): Campaign {
  if(!w.solar.launchArray)throw Error('Install the mirror launch array first.');
  const next=edit(w);next.solar.autoLaunch=!next.solar.autoLaunch;next.solar.nextLaunchDay=next.solar.autoLaunch?next.day+1:null;
  note(next,'Automatic mirror launches '+(next.solar.autoLaunch?(w.solar.powerLink?'enabled at the power-driven production rate, retrying tomorrow when blocked.':'enabled: 10 t every 10 days, retrying tomorrow when blocked.'):'paused. Existing deployments continue.'));return next;
}
export function solarObjectives(w: Campaign) {
  return [
    {name:'Establish the Mercury base',detail:'Open the expedition, commission its rotovator and install a refinery.',done:w.ports.mercury.industry},
    {name:'Build the mirror pipeline',detail:'Install mirror works and a mirror launch array at Mercury.',done:w.solar.mirrorWorks&&w.solar.launchArray},
    {name:'First light',detail:'Launch mirrors and wait for at least 10 t to join the swarm.',done:w.solar.deployedT>=10-EPS},
    {name:'A growing solar swarm',detail:'Deploy 100 t of mirrors: 10 km² under the scenario area assumption.',done:w.solar.deployedT>=100-EPS},
  ];
}
export function powerObjectives(w: Campaign) {
  const power=swarmPower(w);
  return [
    {name:'Close the power loop',detail:'Connect swarm power at Mercury: 60 t local material + 10 t equipment. Your existing swarm becomes the starting capacity.',done:w.solar.powerLink},
    {name:'Double the Mercury works',detail:'Return 20 GW to Mercury for at least 2× refinery, tooling and mirror capacity.',done:power.multiplier>=2-EPS},
    {name:'A hundred gigawatts',detail:'Return 100 GW to Mercury. New deployments automatically expand production.',done:power.returnedGW>=100-EPS},
    {name:'A self-expanding swarm',detail:'Reach 2,000 t deployed with the power link online. Keep launches and the wider network supplied.',done:w.solar.powerLink&&w.solar.deployedT>=2000-EPS},
  ];
}

export function ceresUnlockReason(w:Campaign) {
  if(w.belt.unlocked)return 'Ceres expedition already open.';
  if(!w.solar.powerLink||w.solar.deployedT+EPS<BELT.minSwarmT)return 'Connect swarm power and deploy 2,000 t of mirrors to open Chapter 05.';
  if(w.ports.phobos.level<2||!w.ports.phobos.industry)return 'Prepare a tier-2 Phobos anchor and its Mars staging depot.';
  if(w.ports.phobos.materialsT+EPS<BELT.unlockMaterialsT||w.ports.phobos.equipmentT+EPS<BELT.unlockEquipmentT)return 'Stage 60 t construction material and 20 t equipment at Phobos for the expedition.';
  return '';
}
export function unlockCeres(w:Campaign):Campaign {
  const reason=ceresUnlockReason(w);if(reason)throw Error(reason);
  const next=edit(w);next.ports.phobos.materialsT=Math.max(0,next.ports.phobos.materialsT-BELT.unlockMaterialsT);
  next.ports.phobos.equipmentT=Math.max(0,next.ports.phobos.equipmentT-BELT.unlockEquipmentT);
  next.belt.unlocked=true;next.belt.nextCycleDay=next.day+1;
  note(next,'Ceres expedition opened from Phobos. Staging consumed 60 t material and 20 t equipment. Send construction and working supplies to Ceres next.');return next;
}
export function propellantBuildReason(w:Campaign) {
  if(w.belt.propellantWorks)return 'Phobos propellant works already installed.';
  if(!w.belt.unlocked)return 'Open the Ceres expedition first.';
  if(w.ports.phobos.materialsT+EPS<BELT.plantMaterialsT||w.ports.phobos.equipmentT+EPS<BELT.plantEquipmentT)return 'The plant needs 40 t construction material and 10 t equipment at Phobos.';
  return '';
}
export function buildPropellantWorks(w:Campaign):Campaign {
  const reason=propellantBuildReason(w);if(reason)throw Error(reason);
  const next=edit(w);next.ports.phobos.materialsT=Math.max(0,next.ports.phobos.materialsT-BELT.plantMaterialsT);
  next.ports.phobos.equipmentT=Math.max(0,next.ports.phobos.equipmentT-BELT.plantEquipmentT);next.belt.propellantWorks=true;
  note(next,'Phobos propellant works installed. Returned Ceres water becomes pooled support propellant on the next belt cycle, using equipment.');return next;
}
/** Separate depot recipes. Water must arrive at Phobos before it can fuel a flight. */
export function beltProduction(w:Campaign) {
  const c=w.ports.ceres,p=w.ports.phobos,b=w.belt;
  const waterCapacity=BELT.waterTPerDay*2**w.development.waterLevel,fuelCapacity=BELT.fuelTPerDay*2**w.development.fuelLevel;
  const waterT=b.unlocked&&c.industry?Math.max(0,Math.min(waterCapacity,b.depositT,c.equipmentT/BELT.mineEquipmentPerT,room(w,'ceres','water'))):0;
  const fuelT=b.propellantWorks?Math.max(0,Math.min(fuelCapacity,p.waterT,p.equipmentT/BELT.plantEquipmentPerT,LIMITS.stock-w.fuelT)):0;
  const mineStatus=!c.industry?'Install the Ceres water works':b.depositT<EPS?'Local water deposit exhausted':c.equipmentT<EPS?'Waiting for Ceres equipment':room(w,'ceres','water')<EPS?'Water storage full':'Water extraction active';
  const plantStatus=!b.propellantWorks?'Install the Phobos propellant works':w.fuelT>=LIMITS.stock-EPS?'Support fuel storage full':p.waterT<EPS?'Waiting for returned water':p.equipmentT<EPS?'Waiting for Phobos equipment':'Returned water feeding the network';
  return {waterT,fuelT,waterCapacity,fuelCapacity,mineStatus,plantStatus};
}
function beltCycle(w:Campaign) {
  const {waterT,fuelT}=beltProduction(w),b=w.belt;
  w.ports.ceres.waterT+=waterT;w.ports.ceres.equipmentT=Math.max(0,w.ports.ceres.equipmentT-waterT*BELT.mineEquipmentPerT);
  b.depositT=Math.max(0,b.depositT-waterT);b.extractedT+=waterT;
  w.ports.phobos.waterT=Math.max(0,w.ports.phobos.waterT-fuelT);w.ports.phobos.equipmentT=Math.max(0,w.ports.phobos.equipmentT-fuelT*BELT.plantEquipmentPerT);
  w.fuelT=Math.min(LIMITS.stock,w.fuelT+fuelT);b.refinedT+=fuelT;b.nextCycleDay=w.day+1;
}
export function beltObjectives(w:Campaign) {
  return [
    {name:'Prepare the belt expedition',detail:'Connect swarm power, deploy 2,000 t, then fund Ceres from a tier-2 Phobos staging hub.',done:w.belt.unlocked},
    {name:'Establish the Ceres works',detail:'Deliver supplies from Phobos, commission the Ceres rotovator and install water extraction.',done:w.ports.ceres.industry},
    {name:'Fuel from the belt',detail:'Install the Phobos propellant works and process at least 10 t of returned Ceres water.',done:w.belt.refinedT>=10-EPS},
    {name:'Make the belt a regular supplier',detail:'Process 100 t of Ceres water; keep a return service with three departures and a delivery.',done:w.belt.refinedT>=100-EPS&&w.services.some(s=>waterRoute(s.from,s.to)&&s.kind==='water'&&s.dispatched>=3&&s.deliveredT>0)},
  ];
}

export function developmentUnlockReason(w:Campaign) {
  if(!w.solar.powerLink||!w.belt.unlocked||!w.ports.ceres.industry||!w.belt.propellantWorks||w.belt.refinedT+EPS<100)
    return 'Connect swarm power, install the Ceres water works and Phobos propellant works, then refine 100 t of returned water.';
  return '';
}
export function mercuryReserveT(w:Campaign) {return SOLAR.depositT+w.development.mercuryTracts*DEVELOPMENT.tractT;}
export function ceresReserveT(w:Campaign) {return BELT.depositT+w.development.ceresTracts*DEVELOPMENT.tractT;}
export function developmentProjects(w:Campaign) {
  const d=w.development;
  const specs:{id:DevelopmentProject;name:string;site:SiteId;level:number;maxLevel:number;materialsT:number;equipmentT:number;description:string;benefit:string;dependency:string}[]=[
    {id:'launch',name:'Mercury launch array',site:'mercury',level:d.launchLevel,maxLevel:DEVELOPMENT.maxLevel,
      materialsT:DEVELOPMENT.launchMaterialsT*3**d.launchLevel,equipmentT:DEVELOPMENT.launchEquipmentT*2**d.launchLevel,
      description:'Larger mirror batches share the existing Mercury transfer service. Fuel per tonne and recovery stay the same.',
      benefit:mirrorCapacity(w)+' → '+mirrorCapacity(w)*2+' t per mirror launch',dependency:w.solar.launchArray?'':'Install the Mercury mirror launch array first.'},
    {id:'water',name:'Ceres water works',site:'ceres',level:d.waterLevel,maxLevel:DEVELOPMENT.maxLevel,
      materialsT:DEVELOPMENT.worksMaterialsT*2**d.waterLevel,equipmentT:DEVELOPMENT.worksEquipmentT*2**d.waterLevel,
      description:'Extract more water each cycle. Equipment demand grows with completed output; water still needs transport to Phobos.',
      benefit:BELT.waterTPerDay*2**d.waterLevel+' → '+BELT.waterTPerDay*2**(d.waterLevel+1)+' t water / day',dependency:w.ports.ceres.industry?'':'Install the Ceres water works first.'},
    {id:'fuel',name:'Phobos propellant works',site:'phobos',level:d.fuelLevel,maxLevel:DEVELOPMENT.maxLevel,
      materialsT:DEVELOPMENT.worksMaterialsT*2**d.fuelLevel,equipmentT:DEVELOPMENT.worksEquipmentT*2**d.fuelLevel,
      description:'Process more delivered water into support propellant. Ceres stocks and water in flight cannot feed this plant.',
      benefit:BELT.fuelTPerDay*2**d.fuelLevel+' → '+BELT.fuelTPerDay*2**(d.fuelLevel+1)+' t fuel / day',dependency:w.belt.propellantWorks?'':'Install the Phobos propellant works first.'},
    {id:'mercuryTract',name:'Mercury mining tract',site:'mercury',level:d.mercuryTracts,maxLevel:DEVELOPMENT.maxTracts,
      materialsT:DEVELOPMENT.mercuryTractMaterialsT*(d.mercuryTracts+1),equipmentT:DEVELOPMENT.mercuryTractEquipmentT*(d.mercuryTracts+1),
      description:'Open another finite local tract for the existing refinery. This pays for access; material must still be mined.',
      benefit:'+100,000 t local material reserve',dependency:w.ports.mercury.industry?'':'Install the Mercury refinery first.'},
    {id:'ceresTract',name:'Ceres ice tract',site:'ceres',level:d.ceresTracts,maxLevel:DEVELOPMENT.maxTracts,
      materialsT:DEVELOPMENT.ceresTractMaterialsT*(d.ceresTracts+1),equipmentT:DEVELOPMENT.ceresTractEquipmentT*(d.ceresTracts+1),
      description:'Open another finite local ice tract. Water extraction, equipment and return flights are still required.',
      benefit:'+100,000 t local water reserve',dependency:w.ports.ceres.industry?'':'Install the Ceres water works first.'},
  ];
  return specs.map(({dependency,...project})=>{
    const p=w.ports[project.site];
    const reason=developmentUnlockReason(w)||dependency||(project.level>=project.maxLevel?'This project has reached its limit.':'')||
      (p.materialsT+EPS<project.materialsT||p.equipmentT+EPS<project.equipmentT?'Prepare '+project.materialsT+' t material and '+project.equipmentT+' t equipment at '+SITE[project.site].name+'.':'');
    return {...project,reason};
  });
}
export function upgradeDevelopment(w:Campaign,id:DevelopmentProject):Campaign {
  const project=developmentProjects(w).find(p=>p.id===id);
  if(!project)throw Error('Unknown industrial development project.');
  if(project.reason)throw Error(project.reason);
  const next=edit(w),p=next.ports[project.site];
  p.materialsT=Math.max(0,p.materialsT-project.materialsT);p.equipmentT=Math.max(0,p.equipmentT-project.equipmentT);
  if(id==='launch')next.development.launchLevel++;
  else if(id==='water')next.development.waterLevel++;
  else if(id==='fuel')next.development.fuelLevel++;
  else if(id==='mercuryTract'){next.development.mercuryTracts++;next.solar.depositT+=DEVELOPMENT.tractT;}
  else {next.development.ceresTracts++;next.belt.depositT+=DEVELOPMENT.tractT;}
  note(next,project.name+' expanded at '+SITE[project.site].name+'. '+project.materialsT+' t material and '+project.equipmentT+' t equipment used. '+project.benefit+'.');
  return next;
}
export function setMirrorFuelReserve(w:Campaign,tonnes:number):Campaign {
  const reason=developmentUnlockReason(w);if(reason)throw Error(reason);
  if(!Number.isInteger(tonnes)||tonnes<0||tonnes>LIMITS.stock)throw Error('Choose a fuel reserve from 0 to 1,000,000 whole tonnes.');
  if(w.development.fuelReserveT===tonnes)return w;
  const next=edit(w);next.development.fuelReserveT=tonnes;
  note(next,'Automatic mirror launches will leave '+tonnes+' t support propellant for cargo. Manual mirror launches can use this reserve.');return next;
}
export function developmentObjectives(w:Campaign) {
  const d=w.development;
  return [
    {name:'Expand the launch array',detail:'Build the first Mercury launch-array expansion for larger mirror batches.',done:d.launchLevel>=1},
    {name:'Scale the water-to-fuel chain',detail:'Expand both Ceres extraction and Phobos refining, then keep the plants supplied.',done:d.waterLevel>=1&&d.fuelLevel>=1},
    {name:'Open the next Mercury tract',detail:'Pay for access to another finite local material reserve.',done:d.mercuryTracts>=1},
    {name:'An industrial solar swarm',detail:'Deploy 50,000 t of mirrors with expanded launch, water and fuel works.',done:w.solar.deployedT>=50000-EPS&&d.launchLevel>=1&&d.waterLevel>=1&&d.fuelLevel>=1},
  ];
}

/** Construct clean bounded state, migrating known previous campaign schemas.
 * No catch-up production: the new economy starts at the saved simulation day. */
export function validateCampaign(value: unknown): Campaign {
  const object = (v: unknown): Record<string,unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid campaign object.'); return v as Record<string,unknown>; };
  const num = (v: unknown, lo: number, hi: number, integer=false): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) throw Error('Invalid campaign number.'); return v; };
  const str = (v: unknown, max: number): string => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid campaign text.'); return v; };
  const site = (v: unknown): SiteId => { if (!SITES.includes(v as SiteId)) throw Error('Unknown destination in save.'); return v as SiteId; };
  const bool=(v: unknown): boolean=>{if(typeof v!=='boolean')throw Error('Invalid campaign flag.');return v;};
  const kind=(v: unknown): CargoKind=>{if(v!=='materials'&&v!=='equipment'&&!(v==='water'&&!oldSchema))throw Error('Invalid cargo type.');return v as CargoKind;};
  const raw = object(value), legacy=raw.schema===1 && raw.model==='network-0.1.0', previous=raw.schema===2 && raw.model==='network-0.2.0', migrate=legacy||previous;
  const firstLight=raw.schema===3&&raw.model==='network-0.3.0';
  const powerLoop=raw.schema===4&&raw.model==='network-0.4.0',oldSchema=migrate||firstLight||powerLoop;
  const firstBelt=raw.schema===5&&raw.model==='network-0.5.0',expandedTraffic=raw.schema===5&&raw.model==='network-0.5.1',oldTraffic=oldSchema||firstBelt;
  const beforeDevelopment=oldTraffic||expandedTraffic;
  const beforeDesign=beforeDevelopment||raw.schema===6&&raw.model==='network-0.6.0';
  const fixedDesign=raw.schema===7&&raw.model==='network-0.7.0';
  const beforeCommerce=beforeDesign||fixedDesign||raw.schema===8&&raw.model==='network-0.8.0';
  if (!beforeCommerce && (raw.schema !== 9 || raw.model !== CAMPAIGN_MODEL)) throw Error('This save uses a different campaign version. Keep your backup; it has not been changed.');
  let development=freshDevelopment();
  if(!beforeDevelopment){const d=object(raw.development);development={
    launchLevel:num(d.launchLevel,0,DEVELOPMENT.maxLevel,true),waterLevel:num(d.waterLevel,0,DEVELOPMENT.maxLevel,true),fuelLevel:num(d.fuelLevel,0,DEVELOPMENT.maxLevel,true),
    mercuryTracts:num(d.mercuryTracts,0,DEVELOPMENT.maxTracts,true),ceresTracts:num(d.ceresTracts,0,DEVELOPMENT.maxTracts,true),fuelReserveT:num(d.fuelReserveT,0,LIMITS.stock,true),
  };}
  const mercuryReserve=SOLAR.depositT+development.mercuryTracts*DEVELOPMENT.tractT,ceresReserve=BELT.depositT+development.ceresTracts*DEVELOPMENT.tractT;
  const day = num(raw.day,0,LIMITS.days), rawPorts = object(raw.ports), ports = {} as Record<SiteId,Port>;
  for (const id of SITES) {
    if(id==='mercury'&&migrate){ports.mercury=emptyPort();continue;}
    if(id==='ceres'&&oldSchema){ports.ceres=emptyPort();continue;}
    const p = object(rawPorts[id]); ports[id] = {
      materialsT: num(p.materialsT,0,LIMITS.stock), equipmentT:legacy?(id==='earth'?20:0):num(p.equipmentT,0,LIMITS.stock),
      waterT:oldSchema?0:num(p.waterT,0,LIMITS.stock),
      industry:legacy?id==='earth':bool(p.industry), level: num(p.level,0,3,true), readyDay: num(p.readyDay,0,LIMITS.days+30),
      receivedT: num(p.receivedT,0,1e9), sentT: num(p.sentT,0,1e9) };
    if(ports[id].industry&&!ports[id].level) throw Error('Industry requires a commissioned facility.');
  }
  if (!Array.isArray(raw.flights) || raw.flights.length > (oldTraffic?32:LIMITS.cargoFlights) || !Array.isArray(raw.log) || raw.log.length > 60) throw Error('Campaign record exceeds its size limit.');
  const nextService=legacy?1:num(raw.nextService,1,1e9,true);
  if(!legacy&&(!Array.isArray(raw.services)||raw.services.length>LIMITS.services)) throw Error('Invalid service list.');
  const serviceIds=new Set<number>();
  const services: Service[]=legacy?[]:(raw.services as unknown[]).map(v=>{
    const s=object(v), id=num(s.id,1,nextService-1,true), from=site(s.from), to=site(s.to);routeFor(from,to);
    if(migrate&&(from==='mercury'||to==='mercury'))throw Error('Invalid route for the saved campaign version.');
    if(oldSchema&&(from==='ceres'||to==='ceres'))throw Error('Invalid route for the saved campaign version.');
    if(serviceIds.has(id))throw Error('Duplicate service in save.');serviceIds.add(id);
    if(s.mode!=='tug'&&s.mode!=='tether')throw Error('Invalid service mode.');
    const enabled=bool(s.enabled),cargoKind=kind(s.kind);
    if(cargoKind==='water'&&!waterRoute(from,to))throw Error('Invalid water route.');
    return {id,from,to,kind:cargoKind,mode:s.mode,cargoT:num(s.cargoT,1,s.mode==='tug'?10:30,true),
      intervalDays:num(s.intervalDays,1,3650,true),nextDay:num(s.nextDay,enabled?day+1e-9:0,LIMITS.days+3650),enabled,
      dispatched:num(s.dispatched,0,1e9,true),deliveredT:num(s.deliveredT,0,1e9),contractId:beforeCommerce||s.contractId===null?null:num(s.contractId,1,1e9,true)};
  });
  const nextShipment = num(raw.nextShipment,1,1e9,true), ids = new Set<number>();
  const flights: Shipment[] = raw.flights.map((v): Shipment => {
    const f = object(v), from = site(f.from), to = site(f.to), route = routeFor(from,to);
    if((legacy&&route.id==='lunar-mars')||(migrate&&(from==='mercury'||to==='mercury')))throw Error('Invalid first-chapter route.');
    if(oldSchema&&(from==='ceres'||to==='ceres'))throw Error('Invalid route for the saved campaign version.');
    const id = num(f.id,1,nextShipment-1,true); if (ids.has(id)) throw Error('Duplicate flight in save.'); ids.add(id);
    const departed = num(f.departed,0,day), arrival = num(f.arrival,day+1e-9,LIMITS.days);
    if (Math.abs(arrival - departed - route.coastDays - route.handlingDays) > 1e-6) throw Error('Invalid flight timing in save.');
    if (f.mode !== 'tug' && f.mode !== 'tether') throw Error('Invalid transport mode.');
    const cargoT = num(f.cargoT,1,f.mode === 'tug' ? 10 : 30,true);
    const cargoKind=legacy?'materials':kind(f.kind);
    if(cargoKind==='water'&&!waterRoute(from,to))throw Error('Invalid water route.');
    return { id, from, to, cargoT, fuelT: num(f.fuelT,0,1000), mode: f.mode, departed, arrival,
      kind:cargoKind,serviceId:legacy||f.serviceId===null?null:num(f.serviceId,1,nextService-1,true),contractId:beforeCommerce||f.contractId===null?null:num(f.contractId,1,1e9,true) };
  });
  for(const id of SITES) for(const resource of ['materials','equipment','water'] as CargoKind[]) {
    const inbound=flights.filter(f=>f.to===id&&f.kind===resource).reduce((sum,f)=>sum+f.cargoT,0);
    if(ports[id][key(resource)]+inbound>LIMITS.stock+EPS) throw Error('Incoming cargo exceeds depot storage.');
  }
  let solar=freshSolar();
  if(!migrate) {
    const r=object(raw.solar), nextDeployment=num(r.nextDeployment,1,1e9,true);
    if(!Array.isArray(r.deployments)||(oldTraffic?r.deployments.length+flights.length>32:r.deployments.length>LIMITS.mirrorDeployments))throw Error('Too many active mirror deployments.');
    const deploymentIds=new Set<number>();
    const deployments=r.deployments.map(v=>{
      const d=object(v),id=num(d.id,1,nextDeployment-1,true);
      if(deploymentIds.has(id))throw Error('Duplicate mirror deployment.');deploymentIds.add(id);
      const departed=num(d.departed,0,day),arrival=num(d.arrival,day+1e-9,LIMITS.days);
      if(Math.abs(arrival-departed-SOLAR.deploymentDays)>1e-6)throw Error('Invalid mirror deployment timing.');
      // Earlier validators accepted any existing batch up to 30 t. Preserve
      // those imports even if its saved port tier could not launch it today.
      return {id,departed,arrival,massT:num(d.massT,1,beforeDevelopment?30:Math.max(30,ports.mercury.level*10*2**development.launchLevel),true)};
    });
    solar={unlocked:bool(r.unlocked),depositT:num(r.depositT,0,mercuryReserve),
      nextCycleDay:r.nextCycleDay===null?null:num(r.nextCycleDay,day+1e-9,LIMITS.days+1),
      mirrorWorks:bool(r.mirrorWorks),launchArray:bool(r.launchArray),powerLink:firstLight?false:bool(r.powerLink),mirrorsT:num(r.mirrorsT,0,LIMITS.stock),
      manufacturedT:num(r.manufacturedT,0,1e9),deployedT:num(r.deployedT,0,1e9),autoLaunch:bool(r.autoLaunch),
      nextLaunchDay:r.nextLaunchDay===null?null:num(r.nextLaunchDay,day+1e-9,LIMITS.days+(firstLight?SOLAR.intervalDays:30)),
      nextDeployment,deployments};
    if(ports.mercury.industry!==(solar.nextCycleDay!==null)||solar.autoLaunch!==(solar.nextLaunchDay!==null))throw Error('Invalid Mercury production clock.');
    if(solar.mirrorWorks&&!ports.mercury.industry||solar.launchArray&&!solar.mirrorWorks||solar.autoLaunch&&!solar.launchArray)throw Error('Invalid solar facility progression.');
    if(solar.powerLink&&(!solar.launchArray||solar.deployedT+EPS<POWER.minDeployedT))throw Error('Invalid swarm power progression.');
    if((solar.manufacturedT>0&&!solar.mirrorWorks)||(solar.nextDeployment>1&&!solar.launchArray))throw Error('Solar progress requires installed facilities.');
    if(Math.abs(solar.manufacturedT-solar.mirrorsT-solar.deployedT-solar.deployments.reduce((n,d)=>n+d.massT,0))>1e-5)throw Error('Mirror mass ledger does not balance.');
    if(!solar.unlocked&&(ports.mercury.level||ports.mercury.materialsT||ports.mercury.equipmentT||solar.depositT!==SOLAR.depositT||
      services.some(s=>s.from==='mercury'||s.to==='mercury')||flights.some(f=>f.from==='mercury'||f.to==='mercury')))throw Error('Mercury requires an open expedition.');
  }
  let belt=freshBelt();
  if(!oldSchema){const b=object(raw.belt);
    belt={unlocked:bool(b.unlocked),depositT:num(b.depositT,0,ceresReserve),extractedT:num(b.extractedT,0,ceresReserve),returnedWaterT:num(b.returnedWaterT,0,ceresReserve),refinedT:num(b.refinedT,0,ceresReserve),propellantWorks:bool(b.propellantWorks),nextCycleDay:b.nextCycleDay===null?null:num(b.nextCycleDay,day+1e-9,LIMITS.days+1)};
    if(belt.unlocked!==(belt.nextCycleDay!==null))throw Error('Invalid belt production clock.');
    if(belt.unlocked&&(!solar.powerLink||solar.deployedT+EPS<BELT.minSwarmT||ports.phobos.level<2||!ports.phobos.industry))throw Error('Ceres requires an established swarm and Phobos staging hub.');
    if(!belt.unlocked&&(belt.propellantWorks||ports.ceres.level||ports.ceres.materialsT||ports.ceres.equipmentT||ports.ceres.receivedT||ports.ceres.sentT||belt.extractedT||services.some(s=>s.from==='ceres'||s.to==='ceres')||flights.some(f=>f.from==='ceres'||f.to==='ceres')))throw Error('Ceres requires an open expedition.');
    if(belt.extractedT>0&&!ports.ceres.industry||belt.refinedT>0&&!belt.propellantWorks)throw Error('Belt production requires installed facilities.');
    if(SITES.some(id=>id!=='ceres'&&id!=='phobos'&&ports[id].waterT!==0))throw Error('Water is stored at Ceres and Phobos only.');
    const transit=flights.filter(f=>f.kind==='water').reduce((n,f)=>n+f.cargoT,0);
    if(Math.abs(ceresReserve-belt.depositT-belt.extractedT)>1e-5||Math.abs(belt.extractedT-ports.ceres.waterT-ports.phobos.waterT-transit-belt.refinedT)>1e-5||Math.abs(belt.returnedWaterT-ports.phobos.waterT-belt.refinedT)>1e-5)throw Error('Water mass ledger does not balance.');
  }
  const log = raw.log.map(v => { const e = object(v); return { day: num(e.day,0,day), text: str(e.text,300) }; });
  let commerce=freshCommerce();
  if(!beforeCommerce) {
    const c=object(raw.commerce),cooldowns=object(c.cooldowns),nextContract=num(c.nextContract,1,1e9,true);
    if(!Array.isArray(c.contracts)||c.contracts.length>CONTRACT_HISTORY+LIMITS.cargoFlights+LIMITS.services+1)throw Error('Invalid commercial contract history.');
    const contractIds=new Set<number>();
    const contracts=c.contracts.map((value):Contract=>{
      const record=object(value),id=num(record.id,1,nextContract-1,true);
      if(contractIds.has(id))throw Error('Duplicate contract in save.');contractIds.add(id);
      const offer=contractOffer(record.offerId as ContractOfferId);
      if(record.size!=='standard'&&record.size!=='industrial')throw Error('Invalid contract size.');
      const size=record.size,terms=CONTRACT_TERMS[size],acceptedDay=num(record.acceptedDay,0,day),dueDay=num(record.dueDay,acceptedDay,LIMITS.days);
      const route=routeFor(offer.from,offer.to);
      if(Math.abs(dueDay-acceptedDay-terms.loadingWindowDays-route.coastDays-route.handlingDays)>1e-6)throw Error('Invalid contract deadline.');
      const quantityT=num(record.quantityT,terms.quantityT,terms.quantityT,true),deliveredT=num(record.deliveredT,0,quantityT,true);
      if(!['active','completed','expired','cancelled'].includes(record.status as string))throw Error('Invalid contract status.');
      const status=record.status as Contract['status'],settledDay=record.settledDay===null?null:num(record.settledDay,acceptedDay,day);
      if(status==='active'?(settledDay!==null||dueDay<=day||deliveredT===quantityT):(settledDay===null||settledDay>dueDay+EPS))throw Error('Invalid contract settlement.');
      if(status==='completed'&&deliveredT!==quantityT||status!=='completed'&&deliveredT===quantityT)throw Error('Invalid contract progress.');
      if(status==='expired'&&(settledDay===null||Math.abs(settledDay-dueDay)>EPS))throw Error('Invalid contract expiry.');
      const expected=deliveredT*offer.rate+(status==='completed'?quantityT*offer.rate/4:0);
      const earnedCredits=num(record.earnedCredits,expected,expected,true);
      return {id,offerId:offer.id,size,acceptedDay,dueDay,quantityT,deliveredT,earnedCredits,status,settledDay};
    });
    const money=(value:unknown)=>num(value,0,Number.MAX_SAFE_INTEGER,true);
    commerce={credits:money(c.credits),earnedCredits:money(c.earnedCredits),spentCredits:money(c.spentCredits),nextContract,contracts,cooldowns:{
      'lunar-return':num(cooldowns['lunar-return'],0,day+CONTRACT_COOLDOWN),
      'mars-build':num(cooldowns['mars-build'],0,day+CONTRACT_COOLDOWN),
      'mercury-tooling':num(cooldowns['mercury-tooling'],0,day+CONTRACT_COOLDOWN),
    }};
    if(commerce.earnedCredits-commerce.spentCredits!==commerce.credits||commerce.earnedCredits<contracts.reduce((sum,c)=>sum+c.earnedCredits,0)||commerce.earnedCredits>(nextContract-1)*7500)throw Error('Commercial credit ledger does not balance.');
  }
  const world:Campaign={ schema:9, model:CAMPAIGN_MODEL, id:str(raw.id,80), name:str(raw.name,48), revision:num(raw.revision,0,1e9,true), day,
    fuelT:num(raw.fuelT,0,LIMITS.stock), nextShipment, nextSupplyDay:num(raw.nextSupplyDay,0,LIMITS.days+30), lunarReturnedT:num(raw.lunarReturnedT,0,1e9), ports, flights, log,
    earthDesign:beforeDesign?null:raw.earthDesign===null?null:validateEarthDesignReport(raw.earthDesign),solar,belt,development,commerce,services,nextService,marsOperations:legacy?0:num(raw.marsOperations,0,1e9),lunarPhobosDeliveredT:legacy?0:num(raw.lunarPhobosDeliveredT,0,1e9) };
  if(Object.values(development).some(v=>v>0)&&developmentUnlockReason(world))throw Error('Industrial development requires the established Mercury and Ceres network.');
  if(fixedDesign&&world.earthDesign&&world.earthDesign.version!==1)throw Error('Invalid design report for the saved campaign version.');
  if(world.earthDesign&&!ports.earth.level)throw Error('An Earth design requires a commissioned tether.');
  if(commerce.contracts.filter(c=>c.status==='active').length>1)throw Error('Only one commercial contract can be active.');
  let prior:Contract|undefined;
  for(const contract of commerce.contracts) {
    if(prior&&(contract.id<=prior.id||prior.settledDay===null||contract.acceptedDay+EPS<prior.settledDay))throw Error('Invalid contract chronology.');
    prior=contract;
    if(contractEligibility(world,contract.offerId,contract.size))throw Error('Contract requires its commissioned route and industry.');
    const offer=contractOffer(contract.offerId),related=flights.filter(f=>f.contractId===contract.id);
    if(contract.deliveredT+related.reduce((sum,f)=>sum+f.cargoT,0)>contract.quantityT)throw Error('Contract cargo exceeds its order quantity.');
    const route=routeFor(offer.from,offer.to),duration=route.coastDays+route.handlingDays;
    if(contract.deliveredT>0&&(contract.settledDay??day)+EPS<contract.acceptedDay+duration)throw Error('Contract paid before cargo could arrive.');
    for(const f of related) {
      if(f.from!==offer.from||f.to!==offer.to||f.kind!==offer.kind||f.departed+EPS<contract.acceptedDay||f.arrival>contract.dueDay+EPS||contract.settledDay!==null&&f.departed>contract.settledDay+EPS)throw Error('Invalid contract shipment.');
    }
    const previous=commerce.contracts.filter(c=>c.offerId===contract.offerId&&c.id<contract.id).at(-1);
    if(previous&&(previous.settledDay===null||contract.acceptedDay+EPS<previous.settledDay+CONTRACT_COOLDOWN))throw Error('Contract buyer cooldown was bypassed.');
  }
  for(const offer of CONTRACT_OFFERS) {
    const latest=commerce.contracts.filter(c=>c.offerId===offer.id).at(-1);
    if(latest?.status==='active'&&commerce.cooldowns[offer.id]>latest.acceptedDay+EPS)throw Error('Contract accepted during buyer cooldown.');
    const settled=commerce.contracts.filter(c=>c.offerId===offer.id&&c.settledDay!==null).at(-1);
    if(settled&&Math.abs(commerce.cooldowns[offer.id]-settled.settledDay!-CONTRACT_COOLDOWN)>EPS)throw Error('Invalid contract buyer cooldown.');
  }
  for(const f of flights) {
    if(f.contractId!==null&&!commerce.contracts.some(c=>c.id===f.contractId))throw Error('Shipment refers to a missing contract.');
    const service=services.find(s=>s.id===f.serviceId);
    if(service&&service.contractId!==f.contractId)throw Error('Shipment and service have different customers.');
  }
  for(const service of services)if(service.contractId!==null) {
    const contract=commerce.contracts.find(c=>c.id===service.contractId);
    if(!contract)throw Error('Service refers to a missing contract.');
    const offer=contractOffer(contract.offerId);
    if(service.from!==offer.from||service.to!==offer.to||service.kind!==offer.kind||service.deliveredT>contract.quantityT||service.dispatched>contract.quantityT)throw Error('Invalid contract service.');
    if(service.enabled&&(contract.status!=='active'||contractRemaining(world,contract.id).unassignedT===0))throw Error('Settled or fully assigned contract service must be paused.');
  }
  const references=new Set([...flights.map(f=>f.contractId),...services.map(s=>s.contractId)]);
  if(commerce.contracts.filter(c=>c.status!=='active'&&!references.has(c.id)).length>CONTRACT_HISTORY)throw Error('Contract history exceeds its retained limit.');
  return world;
}
export function exportCampaign(world: Campaign) { return JSON.stringify({ format:'skyhook-campaign', version:9, state:validateCampaign(world) },null,2); }
export function importCampaign(text: string, id: string): Campaign {
  if (new TextEncoder().encode(text).length > LIMITS.fileBytes) throw Error('Campaign file exceeds 512 KB.');
  const envelope = JSON.parse(text);
  if (envelope?.format !== 'skyhook-campaign' || ![1,2,3,4,5,6,7,8,9].includes(envelope?.version)) throw Error('Choose a Skyhook campaign backup. Flight Studio design files are separate.');
  // Validate state first to give the useful "different campaign version" message.
  const world = validateCampaign(envelope.state);
  if(envelope.version!==envelope.state.schema)throw Error('Backup envelope and campaign version do not match.');
  world.id = id; world.revision = 0; return world;
}
