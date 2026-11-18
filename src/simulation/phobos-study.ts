/** Discrete arm-length studies of the unchanged P1 release model. */
import { PHOBOS_MODEL, PHOBOS_BOUNDS, PERIOD, TERMINAL_KG, runPhobos, validatePhobos, type PhobosDesign } from './phobos.js';

export interface PhobosStudyPlan {
  design:PhobosDesign;axis:'inwardKm'|'outwardKm';spacingKm:number;lengthsKm:number[];samples:PhobosDesign[];
}
export function planPhobosStudy(input:PhobosDesign,spacingKm:number):PhobosStudyPlan {
  const design=validatePhobos(input),axis=design.release==='inward'?'inwardKm':'outwardKm';
  if(![50,100,250,500].includes(spacingKm))throw Error('Arm spacing must be 50, 100, 250 or 500 km.');
  const [min,max]=PHOBOS_BOUNDS[axis];
  const lengthsKm=[...new Set([-3,-2,-1,0,1,2,3].map(i=>Math.max(min,Math.min(max,design[axis]+i*spacingKm))))];
  return {design,axis,spacingKm,lengthsKm,samples:lengthsKm.map(length=>({...design,[axis]:length}))};
}
export function runPhobosTrial(design:PhobosDesign,index:number){
  const r=runPhobos(design),released=r.outcome!=='structure-limit';
  const margin=Math.min(...r.loads.map(l=>l.margin)),minTensionN=Math.min(...r.loads.map(l=>l.minTensionN));
  const clear=r.outcome==='clear'&&r.duration===2*PERIOD;
  const target=clear&&margin>=1&&minTensionN>=0&&r.design.release==='inward'&&r.orbit.periapsis>=150000&&r.orbit.periapsis<=750000;
  return {index,design:r.design,outcome:r.outcome,issues:r.issues,duration:r.duration,released,clear,target,
    orbit:released?r.orbit:null,minMarsAltitudeM:released?r.minMarsAltitudeM:null,minPhobosAltitudeM:released?r.minPhobosAltitudeM:null,
    margin,minTensionN,massKg:r.loads.reduce((mass,l)=>mass+l.massKg,2*TERMINAL_KG),budget:r.budget,jacobiRelativeError:r.jacobiRelativeError};
}
export type PhobosTrial=ReturnType<typeof runPhobosTrial>;
export interface PhobosStudy {plan:PhobosStudyPlan;rows:PhobosTrial[];status:'running'|'complete'|'cancelled'|'error'}
export function phobosTrialLabel(row:PhobosTrial){
  if(row.outcome==='structure-limit')return 'Release blocked';
  if(row.outcome==='mars-limit')return 'Mars boundary';
  if(row.outcome==='phobos-impact')return 'Phobos boundary';
  if(row.target)return 'Low-pass target';
  if(row.design.release==='outward'&&row.orbit!.energy>0)return 'Escape energy';
  return 'Clear flight';
}
export function phobosStudyValue(row:PhobosTrial){
  return row.design.release==='inward'?row.minMarsAltitudeM===null?null:row.minMarsAltitudeM/1000:row.orbit===null?null:row.orbit.energy/1e6;
}
export function recommendPhobosTrial(rows:PhobosTrial[]){
  return rows.filter(r=>r.target).sort((a,b)=>Math.abs(a.orbit!.periapsis-450000)-Math.abs(b.orbit!.periapsis-450000)||a.index-b.index)[0]??null;
}
export function phobosStudyMatches(plan:PhobosStudyPlan,input:PhobosDesign){
  try{
    const fixed=(d:PhobosDesign)=>({...validatePhobos(d),[plan.axis]:0});
    return JSON.stringify(fixed(plan.design))===JSON.stringify(fixed(input));
  }catch{return false;}
}
export function exportPhobosStudy(study:PhobosStudy){
  if(study.status!=='complete'||study.rows.length!==study.plan.samples.length)throw Error('Finish the arm study before exporting it.');
  return {format:'skyhook-phobos-study',version:1,model:PHOBOS_MODEL,plan:study.plan,rows:study.rows,
    scope:'Discrete P1 full-flight calculations, including structural blocks and early boundary stops. SI result fields; design lengths in km, areas in mm² and payload in t. Blocked releases have no flight orbit or clearance values. Release energy is a Mars-centered two-body value, not a solved interplanetary destination. Gaps are untested; no continuous operating range or optimum is established.'};
}
