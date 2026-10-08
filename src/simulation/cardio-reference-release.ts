/** A massless test particle released from the prescribed Cardio reference.
 * The tether is not integrated or unloaded: this is a trajectory diagnostic,
 * not the finite-mass C1r experiment or a controlled delivery solution. */
import {EARTH,MU,orbit} from './engine.js';
import {CARDIO_CUTOFF} from './cardio.js';
import {cardioCargoStep,cardioCargoCrossesCutoff,type CargoState} from './cardio-release.js';
import {validateCardioReference,cardioReferenceOrbit,cardioReferenceSample,type CardioReferenceDesign} from './cardio-reference.js';

export const CARDIO_REFERENCE_RELEASE_MODEL='C1k-0.1.0';
export const CARDIO_REFERENCE_COAST_SECONDS=1800;
export interface CardioReferenceReleaseState {
  design:CardioReferenceDesign; fraction:number; releaseTime:number;
  initial:CargoState; elements:ReturnType<typeof orbit>;
  outcome:'below-cutoff'|'crosses-cutoff'|'bound'|'escape';
}
export interface CardioReferenceRelease extends CardioReferenceReleaseState {
  model:typeof CARDIO_REFERENCE_RELEASE_MODEL;
  status:'cutoff'|'horizon'; duration:number; horizon:number;
  frames:{t:number;state:CargoState}[];
  energyError:number; angularError:number;
}

/** Classify the future point orbit from the exact release state, without
 * integrating a finite coast or implying that the tether can maintain it. */
export function cardioReferenceReleaseState(input:unknown,fraction:number):CardioReferenceReleaseState {
  const design=validateCardioReference(input);
  if(!Number.isFinite(fraction)||fraction<0||fraction>1)throw Error('Select a release within one reference orbit.');
  const releaseTime=cardioReferenceOrbit(design).period*fraction;
  const initial:CargoState=[...cardioReferenceSample(design,releaseTime).tip];
  const elements=orbit(initial),below=Math.hypot(initial[0],initial[1])-EARTH<CARDIO_CUTOFF;
  const outcome=below?'below-cutoff':cardioCargoCrossesCutoff(initial,elements)?'crosses-cutoff':elements.energy<0?'bound':'escape';
  return {design,fraction,releaseTime,initial,elements,outcome};
}

/** Discrete samples only: no interpolation or inferred interval boundaries. */
export function compareCardioReferencePhases(input:unknown){
  const design=validateCardioReference(input);
  return {format:'skyhook-cardio-reference-phases' as const,version:1 as const,
    model:CARDIO_REFERENCE_RELEASE_MODEL,analysis:'release-state orbit elements' as const,
    design,period:cardioReferenceOrbit(design).period,
    samples:Array.from({length:21},(_,i)=>cardioReferenceReleaseState(design,i/20))};
}

export function traceCardioReferenceRelease(input:unknown,fraction:number,options:{step?:number}={}):CardioReferenceRelease {
  const launch=cardioReferenceReleaseState(input,fraction),{design,releaseTime,initial,elements,outcome}=launch;
  const step=options.step??2,altitude=(q:CargoState)=>Math.hypot(q[0],q[1])-EARTH,below=outcome==='below-cutoff';
  if(!Number.isFinite(step)||step<.25||step>10)throw Error('Invalid particle integration step.');
  const frames:CardioReferenceRelease['frames']=[{t:0,state:[...initial]}];
  const h0=initial[0]*initial[3]-initial[1]*initial[2];
  const energyScale=Math.max(MU/Math.hypot(initial[0],initial[1]),Math.abs(elements.energy),1);
  let state=initial,t=0,status:CardioReferenceRelease['status']=below?'cutoff':'horizon',energyError=0,angularError=0;
  while(!below&&t<CARDIO_REFERENCE_COAST_SECONDS-1e-9){
    let dt=Math.min(step,CARDIO_REFERENCE_COAST_SECONDS-t),next=cardioCargoStep(state,dt);
    if(altitude(next)<CARDIO_CUTOFF){
      let lo=0,hi=dt;
      for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(altitude(cardioCargoStep(state,mid))<CARDIO_CUTOFF)hi=mid;else lo=mid;}
      // Keep the last state above the cutoff; never draw an atmospheric coast.
      dt=lo;next=cardioCargoStep(state,dt);status='cutoff';
    }
    if(!next.every(Number.isFinite))throw Error('Particle integration failed.');
    state=next;t+=dt;frames.push({t,state:[...state]});
    const energy=(state[2]**2+state[3]**2)/2-MU/Math.hypot(state[0],state[1]);
    energyError=Math.max(energyError,Math.abs(energy-elements.energy)/energyScale);
    angularError=Math.max(angularError,Math.abs(state[0]*state[3]-state[1]*state[2]-h0)/Math.max(1,Math.abs(h0)));
    if(status==='cutoff')break;
  }
  return {model:CARDIO_REFERENCE_RELEASE_MODEL,design,fraction,releaseTime,initial,elements,outcome,status,duration:t,
    horizon:CARDIO_REFERENCE_COAST_SECONDS,frames,energyError,angularError};
}
