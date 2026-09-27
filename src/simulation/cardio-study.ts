import {validateCardio,type CardioDesign} from './cardio.js';
import {CARDIO_RELEASE_MODEL,cardioCargoCrossesCutoff,type CardioRelease} from './cardio-release.js';

export function cardioTimingPlan(current:number):number[]{
  if(!Number.isFinite(current)||current<.05||current>.9)throw Error('Select a release timing between 5% and 90%.');
  // Include the exact draft, even when it is close to a grid sample.
  return [...new Set([...Array.from({length:18},(_,i)=>(i+1)/20),current])].sort((a,b)=>a-b);
}
export function cardioTimingOutcome(r:CardioRelease){
  if(!r.release)return {clear:false,label:'Release blocked'};
  if(r.status==='clearance')return {clear:false,label:'Tether cutoff'};
  if(r.status==='load')return {clear:false,label:'Tether load limit'};
  if(r.status==='compression')return {clear:false,label:'Tether compression'};
  if(r.status==='cargo-clearance'||cardioCargoCrossesCutoff(r.release.cargo,r.release.cargoOrbit))return {clear:false,label:'Cargo crosses cutoff'};
  return {clear:true,label:r.release.cargoOrbit.apogee===null?'Clear escape coast':'Clear bound coast'};
}
export function cardioTimingReport(design:CardioDesign,plan:number[],results:CardioRelease[]){
  const clean=validateCardio(design);
  if(!plan.length||plan.length>19||plan.some((v,i)=>!Number.isFinite(v)||v<.05||v>.9||(i>0&&v<=plan[i-1])))throw Error('Invalid timing plan.');
  if(results.length>plan.length||results.some((r,i)=>r.model!==CARDIO_RELEASE_MODEL||r.fraction!==plan[i]||JSON.stringify(validateCardio(r.design))!==JSON.stringify(clean)))throw Error('Study results do not match their design and timing plan.');
  return {format:'skyhook-cardio-timing-study',version:1,model:CARDIO_RELEASE_MODEL,design:clean,plan,
    complete:results.length===plan.length,limitations:'Discrete timing samples only; unsampled gaps, repeatable operation and destination targeting are not established.',
    results:results.map(r=>({fraction:r.fraction,status:r.status,outcome:cardioTimingOutcome(r),duration:r.duration,
      release:r.release?{t:r.release.t,cargoOrbit:r.release.cargoOrbit,tetherOrbit:r.release.tetherOrbit}:null,
      minClearance:r.minClearance,minCargoClearance:r.minCargoClearance,peakStress:r.peakStress,energyDrift:r.energyDrift,angularDrift:r.angularDrift}))};
}
