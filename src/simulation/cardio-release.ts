/** C1r: ideal impulse-free release from the C1p matched-pickup experiment. */
import {EARTH, MU, orbit} from './engine.js';
import {CARDIO_ALLOWABLE, CARDIO_CUTOFF, validateCardio, cardioBody, cardioInitial,
  cardioCapture, cardioPoint, cardioStep, cardioClearance, cardioLoads, cardioInvariants,
  type CardioDesign, type CardioState, type CardioBody} from './cardio.js';

export const CARDIO_RELEASE_MODEL = 'C1r-0.1.1';
export type CargoState = [number, number, number, number];
export type ReleaseStatus = 'complete' | 'clearance' | 'load' | 'compression' | 'cargo-clearance';
export interface ReleaseFrame {t:number; state:CardioState; cargo:CargoState|null; released:boolean}
export interface CardioRelease {
  model:typeof CARDIO_RELEASE_MODEL; design:CardioDesign; fraction:number; period:number;
  duration:number; status:ReleaseStatus; frames:ReleaseFrame[];
  release:null|{t:number; before:CardioState; after:CardioState; cargo:CargoState;
    cargoOrbit:ReturnType<typeof orbit>; tetherOrbit:ReturnType<typeof orbit>;
    energyResidual:number; angularResidual:number};
  minClearance:number; minCargoClearance:number|null; peakStress:number;
  energyDrift:number; angularDrift:number;
}
/** A bound orbit returns to perigee. On an unbound coast, a lower perigee is
 * still ahead only while cargo is inbound; outbound escape does not return.
 * Already being below the cutoff also disqualifies the cargo state. */
export function cardioCargoCrossesCutoff(cargo:CargoState,elements=orbit(cargo)):boolean {
  if(Math.hypot(cargo[0],cargo[1])-EARTH<CARDIO_CUTOFF)return true;
  const inward=cargo[0]*cargo[2]+cargo[1]*cargo[3]<0;
  return elements.perigee<CARDIO_CUTOFF&&(elements.energy<0||inward);
}
export function cardioCargoStep(y:CargoState,h:number):CargoState {
  const f=(q:CargoState):CargoState=>{const k=-MU/Math.hypot(q[0],q[1])**3;return [q[2],q[3],q[0]*k,q[1]*k];};
  const add=(a:CargoState,b:CargoState,s:number)=>a.map((v,i)=>v+s*b[i]) as CargoState;
  const a=f(y),b=f(add(y,a,h/2)),c=f(add(y,b,h/2)),d=f(add(y,c,h));
  return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6) as CargoState;
}
function cargoInvariants(q:CargoState,mass:number){return {
  energy:mass*((q[2]**2+q[3]**2)/2-MU/Math.hypot(q[0],q[1])),
  angular:mass*(q[0]*q[3]-q[1]*q[2])
};}
export function simulateCardioRelease(input:unknown,fraction:number,options:{step?:number;cells?:number}={}):CardioRelease {
  const design=validateCardio(input),step=options.step??5,cells=options.cells??48;
  if(!Number.isFinite(fraction)||fraction<.05||fraction>.9)throw Error('Release must be between 5% and 90% of the nominal period.');
  if(!Number.isFinite(step)||step<.25||step>10||!Number.isInteger(cells)||cells<16||cells>192)throw Error('Invalid integration resolution.');
  const empty=cardioBody(design,false,cells),loaded=cardioBody(design,true,cells);
  const initial=cardioInitial(design,empty),period=initial.period,target=fraction*period;
  let state=cardioCapture(initial.state,empty,loaded),body=loaded,cargo:CargoState|null=null,t=0,nextSample=0;
  let release:CardioRelease['release']=null,status:ReleaseStatus='complete';
  let minClearance=Infinity,minCargoClearance:number|null=null,peakStress=0,energyDrift=0,angularDrift=0;
  const frames:ReleaseFrame[]=[],reference=cardioInvariants(state,loaded),mass=design.payloadT*1000;
  const fault=(y:CardioState,b:CardioBody,q:CargoState|null):Exclude<ReleaseStatus,'complete'>|null=>{
    if(cardioClearance(y,b)<CARDIO_CUTOFF)return 'clearance';
    if(q&&Math.hypot(q[0],q[1])-EARTH<CARDIO_CUTOFF)return 'cargo-clearance';
    const loads=cardioLoads(y,b);
    return loads.stress>CARDIO_ALLOWABLE?'load':loads.minTension< -100?'compression':null;
  };
  const record=()=>{frames.push({t,state:[...state],cargo:cargo?[...cargo]:null,released:!!release});nextSample=t+period/600;};
  while(true){
    const loads=cardioLoads(state,body),iv=cardioInvariants(state,body),cv=cargo?cargoInvariants(cargo,mass):{energy:0,angular:0};
    minClearance=Math.min(minClearance,cardioClearance(state,body));peakStress=Math.max(peakStress,loads.stress);
    if(cargo)minCargoClearance=Math.min(minCargoClearance??Infinity,Math.hypot(cargo[0],cargo[1])-EARTH);
    energyDrift=Math.max(energyDrift,Math.abs(iv.energy+cv.energy-reference.energy)/Math.max(1,Math.abs(reference.energy)));
    angularDrift=Math.max(angularDrift,Math.abs(iv.angular+cv.angular-reference.angular)/Math.max(1,Math.abs(reference.angular)));
    const fail=fault(state,body,cargo),end=t>=period-1e-7;
    if(fail||end){record();if(fail)status=fail;break;}
    if(!release&&t>=target-1e-7){
      // Duplicate event time preserves both exact states. Replay selects the post-release frame.
      record();const before=[...state] as CardioState;
      cargo=cardioPoint(state,loaded,loaded.length);state=cardioCapture(state,loaded,empty);body=empty;
      const post=cardioInvariants(state,empty),payload=cargoInvariants(cargo,mass);
      release={t,before,after:[...state],cargo:[...cargo],cargoOrbit:orbit(cargo),tetherOrbit:orbit(state),
        energyResidual:post.energy+payload.energy-iv.energy,angularResidual:post.angular+payload.angular-iv.angular};
      record();continue; // Check the unloaded tether immediately, before further propagation.
    }
    if(t>=nextSample-1e-7)record();
    let h=Math.min(step,.01/Math.max(Math.abs(state[5]),1e-9),period-t,release?Infinity:target-t);
    const advance=(dt:number)=>({y:cardioStep(state,dt,body),q:cargo?cardioCargoStep(cargo,dt):null});
    let next=advance(h);
    if(fault(next.y,body,next.q)){
      let lo=0,hi=h;for(let i=0;i<24;i++){const mid=(lo+hi)/2,v=advance(mid);if(fault(v.y,body,v.q))hi=mid;else lo=mid;}
      h=hi;next=advance(h);
    }
    state=next.y;cargo=next.q;t+=h;
    if(h<=0||![...state,...(cargo??[])].every(Number.isFinite))throw Error('Release integration failed.');
  }
  return {model:CARDIO_RELEASE_MODEL,design,fraction,period,duration:t,status,frames,release,
    minClearance,minCargoClearance,peakStress,energyDrift,angularDrift};
}
export function cardioReleaseSample(result:CardioRelease,time:number):ReleaseFrame {
  const frames=result.frames,t=Math.max(0,Math.min(result.duration,time));
  // Upper-bound search makes the mass/COM change right-continuous at release.
  let lo=0,hi=frames.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(frames[mid].t<=t)lo=mid+1;else hi=mid;}
  const a=frames[Math.max(0,lo-1)],b=frames[lo];if(!b||a.t===t)return a;
  const f=(t-a.t)/(b.t-a.t),mix=(x:number,y:number)=>x+(y-x)*f;
  return {t,state:a.state.map((v,i)=>mix(v,b.state[i])) as CardioState,released:a.released,
    cargo:a.cargo&&b.cargo?a.cargo.map((v,i)=>mix(v,b.cargo![i])) as CargoState:null};
}
