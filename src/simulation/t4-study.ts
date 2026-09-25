/** Discrete studies of the existing T4 solver; no interpolated or surrogate flights. */
import { MATERIALS } from './engine.js';
import { T4_MODEL, T4_BOUNDS, T4_CUTOFF, T4_DURATION, runT4, t4Summary, validateT4, type T4Design } from './t4.js';

export type T4StudyMode='phase'|'timing';
export interface T4StudyPlan {
  design:T4Design;mode:T4StudyMode;spacing:number;phases:number[];times:number[];samples:T4Design[];
}
export function planT4Study(input:T4Design,mode:T4StudyMode,spacing=1):T4StudyPlan {
  const design=validateT4(input);
  if(mode!=='phase'&&mode!=='timing')throw Error('Unknown T4 study.');
  if(![.5,1,2].includes(spacing))throw Error('Time spacing must be 0.5, 1 or 2 minutes.');
  const phases=[0,60,120,180,240,300],[min,max]=T4_BOUNDS.releaseMin;
  const times=mode==='phase'?[design.releaseMin]:[...new Set([-2,-1,0,1,2].map(i=>Math.max(min,Math.min(max,design.releaseMin+i*spacing))))];
  return {design,mode,spacing,phases,times,samples:times.flatMap(releaseMin=>phases.map(phaseDeg=>({...design,phaseDeg,releaseMin})))};
}
export function runT4Trial(design:T4Design,index:number){
  const r=runT4(design),peak=Math.max(...r.peakStress),allowable=MATERIALS.find(m=>m.id===r.design.material)!.ultimate/r.design.safetyFactor;
  return {...t4Summary(r),index,reason:r.reason,duration:r.duration,axialMargin:peak>0?allowable/peak:null,peakPivotForce:r.peakPivotForce,minClearance:r.minClearance};
}
export type T4Trial=ReturnType<typeof runT4Trial>;
export interface T4Study {plan:T4StudyPlan;rows:T4Trial[];status:'running'|'complete'|'cancelled'|'error'}
/** Recommend only passing, computed samples, closest to the center of the target band. */
export function recommendT4Trial(rows:T4Trial[]){
  return rows.filter(r=>r.pass&&r.apoapsis!==null).sort((a,b)=>Math.abs(a.apoapsis!-1e7)-Math.abs(b.apoapsis!-1e7)||a.index-b.index)[0]??null;
}
/** Ignore the axes this study deliberately varies; compare all fixed inputs. */
export function t4StudyMatches(plan:T4StudyPlan,input:T4Design){
  try{
    const fixed=(d:T4Design)=>({...validateT4(d),phaseDeg:0,...(plan.mode==='timing'?{releaseMin:0}:{})});
    return JSON.stringify(fixed(plan.design))===JSON.stringify(fixed(input));
  }catch{return false;}
}
export function exportT4Study(study:T4Study){
  if(study.status!=='complete'||study.rows.length!==study.plan.samples.length)throw Error('Finish the study before exporting it.');
  return {format:'skyhook-t4-study',version:1,model:T4_MODEL,plan:study.plan,rows:study.rows,
    target:{apoapsisM:[8e6,12e6],minimumPeriapsisM:T4_CUTOFF,fullDurationS:T4_DURATION},
    scope:'Discrete full-model samples only. No interpolation, continuous release window, optimum or timing tolerance is established. SI results; design lengths in km, areas in mm², mass in t, release delay in min.'};
}
