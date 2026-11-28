/** Compare accepted P1 results without running or changing either flight. */
import { MARS, PHOBOS, PHOBOS_MODEL, PERIOD, TERMINAL_KG, marsState, type PhobosDesign, type PhobosResult } from './phobos.js';

const INPUTS = [
  ['release','Release arm',''], ['inwardKm','Inward arm','km'], ['outwardKm','Outward arm','km'],
  ['payloadT','Cargo','t'], ['areaMm2','Cable area','mm²'],
  ['material','Fiber profile',''], ['safetyFactor','Safety factor','×'],
] as const satisfies readonly (readonly [keyof PhobosDesign,string,string])[];

export function phobosDesignChanges(pinned:PhobosDesign,current:PhobosDesign){
  return INPUTS.filter(([key])=>pinned[key]!==current[key]).map(([key,label,unit])=>({key,label,unit,pinned:pinned[key],current:current[key]}));
}
export function phobosFlightVerdict(r:PhobosResult){
  if(r.outcome==='structure-limit')return 'Release blocked';
  if(r.outcome==='mars-limit')return 'Mars boundary reached';
  if(r.outcome==='phobos-impact')return 'Phobos boundary reached';
  if(r.duration!==2*PERIOD)return 'Incomplete flight';
  if(r.design.release==='inward'&&r.orbit.periapsis>=150000&&r.orbit.periapsis<=750000&&r.loads.every(l=>l.margin>=1&&l.minTensionN>=0))return 'Low-pass target';
  return r.orbit.energy>0?'Clear flight · escape energy':'Clear flight · bound at release';
}
export function phobosComparisonMetrics(pinned:PhobosResult,current:PhobosResult){
  const orbit=(r:PhobosResult,key:keyof PhobosResult['orbit'],scale:number)=>r.outcome==='structure-limit'||r.orbit[key]===null?null:r.orbit[key]!/scale;
  const altitude=(r:PhobosResult)=>r.outcome==='structure-limit'?null:r.minMarsAltitudeM/1000;
  const margin=(r:PhobosResult)=>Math.min(...r.loads.map(l=>l.margin));
  const mass=(r:PhobosResult)=>(r.loads.reduce((total,l)=>total+l.massKg,2*TERMINAL_KG))/1000;
  const rows:[string,string,string,number,number|null,number|null][]=[
    ['altitude','Lowest Mars altitude','km',2,altitude(pinned),altitude(current)],
    ['periapsis','Release periapsis','km',2,orbit(pinned,'periapsis',1000),orbit(current,'periapsis',1000)],
    ['apoapsis','Release apoapsis','km',0,orbit(pinned,'apoapsis',1000),orbit(current,'apoapsis',1000)],
    ['energy','Release energy','MJ/kg',3,orbit(pinned,'energy',1e6),orbit(current,'energy',1e6)],
    ['margin','Lowest cable margin','×',2,margin(pinned),margin(current)],
    ['mass','Cable + terminals','t',2,mass(pinned),mass(current)],
    ['anchor','Ideal anchor work','GJ',3,pinned.budget.anchorWorkJ/1e9,current.budget.anchorWorkJ/1e9],
    ['winch','Ideal winch work','GJ',3,pinned.budget.winchWorkJ/1e9,current.budget.winchWorkJ/1e9],
    ['duration','Simulated duration','h',2,pinned.duration/3600,current.duration/3600],
  ];
  return rows.map(([id,label,unit,digits,a,b])=>({id,label,unit,digits,pinned:a,current:b,delta:a===null||b===null?null:b-a}));
}
/** Transform every stored frame at its own time into the common inertial plane. */
export function phobosCargoPath(r:PhobosResult){
  return r.outcome==='structure-limit'?[]:r.frames.map(f=>({t:f.t,state:marsState(f.state,f.t)}));
}
export function phobosComparisonPaths(pinned:PhobosResult,current:PhobosResult){
  const paths={pinned:phobosCargoPath(pinned),current:phobosCargoPath(current)};
  const extent=1.15*Math.max(PHOBOS.separation,MARS.radius+MARS.cutoff,...Object.values(paths).flatMap(path=>path.map(p=>Math.hypot(p.state[0],p.state[1]))));
  return {...paths,extent};
}
export function exportPhobosComparison(pinned:PhobosResult,current:PhobosResult){
  return {format:'skyhook-phobos-comparison',version:1,model:PHOBOS_MODEL,pinned,current,
    changes:phobosDesignChanges(pinned.design,current.design),metrics:phobosComparisonMetrics(pinned,current),
    scope:'Two calculated P1 results, including early stops. Full result frames are rotating barycentric SI states; displayed paths transform each frame to Mars-centered inertial coordinates at its own time, through the actual end. Signed deltas are current minus pinned; blocked releases have no flight path or numerical orbit/clearance metrics. Unbound apoapsis has no numerical delta. Raw blocked-result orbit fields describe an unflown terminal state. Loads are static checks; work is a separate ideal positioning budget, not work performed by a blocked flight. Phobos follows a prescribed circular orbit. Release elements do not establish a long-term orbit, destination or repeatable service.'};
}
