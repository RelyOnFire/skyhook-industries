import { flightPlan, ROUTES, SITES, siteLocked, tetherCapacity, waterRoute, type Campaign, type CargoKind, type SiteId } from './model.js';

/** A form suggestion only: prefer a ready stocked route, never move resources. */
export function suggestSupply(world:Campaign,to:SiteId,kind:CargoKind,requestedT=10) {
  if(!Number.isInteger(requestedT)||requestedT<1)throw Error('Choose a positive whole-tonne supply request.');
  if(siteLocked(world,to))return null;
  const candidates=SITES.filter(from=>from!==to&&!siteLocked(world,from)&&
    ROUTES.some(route=>route.a===from&&route.b===to||route.b===from&&route.a===to)&&
    (kind!=='water'||waterRoute(from,to))).map(from=>{
    const mode=world.ports[from].level&&world.ports[to].level?'tether' as const:'tug' as const;
    const capacity=mode==='tether'?Math.min(tetherCapacity(world,from),tetherCapacity(world,to)):10;
    const stock=world.ports[from][kind==='materials'?'materialsT':kind==='equipment'?'equipmentT':'waterT'];
    const available=Math.max(0,Math.min(requestedT,capacity,Math.floor(stock+1e-8)));
    const cargoT=Math.max(1,available),plan=flightPlan(world,from,to,cargoT,mode,kind);
    return {from,to,kind,mode,cargoT,available,...plan};
  });
  if(!candidates.length)return null;
  // With no whole tonne anywhere, keep the familiar replenishment source.
  if(candidates.every(candidate=>candidate.available===0)) {
    const fallback=candidates.find(candidate=>candidate.from===(to==='ceres'?'phobos':kind==='water'?'ceres':'earth'))??candidates[0];
    const cargoT=Math.min(requestedT,fallback.capacity);
    return {...fallback,cargoT,...flightPlan(world,fallback.from,to,cargoT,fallback.mode,kind)};
  }
  return candidates.sort((a,b)=>Number(!!a.reason)-Number(!!b.reason)||b.available-a.available||
    a.fuelT/a.cargoT-b.fuelT/b.cargoT||a.duration-b.duration||SITES.indexOf(a.from)-SITES.indexOf(b.from))[0];
}
