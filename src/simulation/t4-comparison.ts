/** Compare accepted T4 results without running or changing either flight. */
import { EARTH, MATERIALS } from './engine.js';
import { T4_MODEL, T4_DURATION, t4Gates, type T4Design, type T4Result } from './t4.js';

const INPUTS = [
  ['phaseDeg', 'Initial phase', '°'], ['releaseMin', 'Release delay', 'min'],
  ['payloadT', 'Cargo', 't'], ['primaryKm', 'Primary length', 'km'],
  ['secondaryKm', 'Each secondary arm', 'km'], ['altitudeKm', 'Initial COM altitude', 'km'],
  ['primarySpeedKms', 'Primary spin × length', 'km/s'], ['secondarySpeedKms', 'Secondary spin × arm', 'km/s'],
  ['primaryAreaMm2', 'Primary area', 'mm²'], ['secondaryAreaMm2', 'Secondary area', 'mm²'],
  ['material', 'Fiber profile', ''], ['safetyFactor', 'Safety factor', '×'],
] as const satisfies readonly (readonly [keyof T4Design, string, string])[];

export function t4DesignChanges(pinned:T4Design,current:T4Design){
  return INPUTS.filter(([key])=>pinned[key]!==current[key]).map(([key,label,unit])=>({key,label,unit,pinned:pinned[key],current:current[key]}));
}
export function t4FlightVerdict(r:T4Result){
  return r.outcome!=='complete'?'Model limit reached':r.duration!==T4_DURATION?'Incomplete run':t4Gates(r).every(Boolean)?'Target reached':'Outside target band';
}
function margin(r:T4Result){
  const peak=Math.max(...r.peakStress),allowable=MATERIALS.find(m=>m.id===r.design.material)!.ultimate/r.design.safetyFactor;
  return peak>0?allowable/peak:null;
}
export function t4ComparisonMetrics(pinned:T4Result,current:T4Result){
  const rows:[string,string,string,number,number|null,number|null][]=[
    ['apoapsis','Release apoapsis','km',0,pinned.release?.orbit.apoapsis==null?null:pinned.release.orbit.apoapsis/1000,current.release?.orbit.apoapsis==null?null:current.release.orbit.apoapsis/1000],
    ['periapsis','Release periapsis','km',0,pinned.release? pinned.release.orbit.periapsis/1000:null,current.release?current.release.orbit.periapsis/1000:null],
    ['margin','Lowest axial margin','×',2,margin(pinned),margin(current)],
    ['pivot','Peak pivot force','kN',1,pinned.peakPivotForce/1000,current.peakPivotForce/1000],
    ['clearance','Minimum clearance','km',0,pinned.minClearance/1000,current.minClearance/1000],
    ['mass','Dry facility mass','t',2,pinned.dryMass/1000,current.dryMass/1000],
    ['duration','Simulated duration','min',2,pinned.duration/60,current.duration/60],
  ];
  return rows.map(([id,label,unit,digits,a,b])=>({id,label,unit,digits,pinned:a,current:b,delta:a===null||b===null?null:b-a}));
}
/** Only the propagated post-release path, including the exact release and last frame. */
export function t4CargoPath(r:T4Result){
  if(!r.release)return [];
  return [{t:r.release.t,state:[...r.release.state]},...r.frames.filter(f=>f.cargo&&f.t>r.release!.t).map(f=>({t:f.t,state:[...f.cargo!]}))];
}
export function t4ComparisonPaths(pinned:T4Result,current:T4Result){
  const paths={pinned:t4CargoPath(pinned),current:t4CargoPath(current)};
  const extent=1.15*Math.max(EARTH,...Object.values(paths).flatMap(path=>path.map(p=>Math.hypot(p.state[0],p.state[1]))));
  return {...paths,extent};
}
export function exportT4Comparison(pinned:T4Result,current:T4Result){
  return {format:'skyhook-t4-comparison',version:1,model:T4_MODEL,pinned,current,
    changes:t4DesignChanges(pinned.design,current.design),metrics:t4ComparisonMetrics(pinned,current),
    scope:'Two calculated flights, including any early stops. Full result states use SI; metric units are declared per row. Signed deltas are current minus pinned; unavailable or unbound apoapsis has no numerical delta. Paths include only propagated cargo after release, through each run’s actual end. No longer-term orbit or efficiency ranking is inferred.'};
}
