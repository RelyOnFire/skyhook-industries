/** R1: supplied return-traffic rendezvous after the first outbound delivery.
 * Uses the existing distributed-gravity rigid body, with all actuators off.
 * The incoming orbit is constructed by backward propagation from an upper-tip
 * match, then propagated independently forward. It is not a lunar transfer solve.
 */
import { compile, environment, invariants, loadCheck, clearance, orbit, particleStep, pointState,
  ready, reframe, rendezvousResidual, rk4, spinReference, TAU, validate, type Result, type State } from './engine.js';
export const RETURN_MODEL = 'R1-0.1.0';
export interface ReturnSettings { massT: number; swingDeg: number }
export interface ReturnFrame { t: number; state: State; loaded: boolean; payload: number[] | null; phase: 'coast'|'approach'|'attached'|'released' }
export interface ReturnResult {
  model: typeof RETURN_MODEL; settings: ReturnSettings; status: 'complete'|'limit'|'miss'|'unsafe-release'|'incomplete'; reason: string;
  frames: ReturnFrame[]; captureTime: number | null; releaseTime: number | null;
  match: ReturnType<typeof rendezvousResidual> | null;
  incomingOrbit: ReturnType<typeof orbit> | null; releasedOrbit: ReturnType<typeof orbit> | null;
  payloadEnergyLostJ: number | null; facilityEnergyGainJ: number | null; angularGain: number | null;
  energyResidualJ: number | null; angularResidual: number | null; recoveredFraction: number | null;
  minClearance: number; minMargin: number; ready: boolean; radiusErrorM: number | null; speedErrorMs: number | null; spinErrorPct: number | null;
}
export function returnTraffic(outbound: Result, settings: ReturnSettings, options: {step?: number; cells?: number} = {}): ReturnResult {
  const source = validate(outbound.design), step = options.step ?? 2, cells = options.cells ?? outbound.cells;
  if (source.architecture !== 'single-stage-rotovator') throw Error('Return traffic currently uses the Earth experiment.');
  if (!Number.isFinite(settings.massT) || settings.massT < .1 || settings.massT > 250 || !Number.isFinite(settings.swingDeg) || settings.swingDeg < 20 || settings.swingDeg > 150) throw Error('Use 0.1–250 t and a 20–150° return swing.');
  if (!Number.isFinite(step) || step <= 0 || step > 4 || !Number.isInteger(cells) || cells < 8 || cells > 192) throw Error('Invalid return calculation budget.');
  const delivery = outbound.deliveries[0], start = outbound.frames.find(f => f.deliveries === 1 && !f.loaded);
  if (!delivery || !start || delivery.gain <= 0 || delivery.perigee < environment(source).cutoff) throw Error('Run a design that achieves a safe first outbound delivery before comparing return traffic.');
  const d = {...source, payloadT: settings.massT}, env = environment(d), initialFuel = start.state[6];
  let y = [...start.state], t = 0, loaded = false, incoming: number[] | null = null;
  const result: ReturnResult = {model: RETURN_MODEL, settings: {...settings}, status:'incomplete', reason:'No suitable upper-tip pass within six hours.', frames:[],captureTime:null,releaseTime:null,match:null,incomingOrbit:null,releasedOrbit:null,payloadEnergyLostJ:null,facilityEnergyGainJ:null,angularGain:null,energyResidualJ:null,angularResidual:null,recoveredFraction:null,minClearance:Infinity,minMargin:Infinity,ready:false,radiusErrorM:null,speedErrorMs:null,spinErrorPct:null};
  const check = (state:State, attached:boolean) => {
    const b=compile(d,state[6],attached,cells), low=clearance(state,b,env), load=loadCheck(state,b,d,false);
    result.minClearance=Math.min(result.minClearance,low); result.minMargin=Math.min(result.minMargin,load.margin);
    if (state.some(v=>!Number.isFinite(v))) throw Error('Return calculation produced a non-finite state.');
    if (low<env.cutoff || load.margin<1 || load.minTension < -100) {
      result.status='limit';result.reason=low<env.cutoff?'The tether crossed the 120 km clearance boundary.':load.margin<1?'The returning load exceeded the chosen material allowable.':'A cable section requires compression; the taut-cable model no longer applies.';return false;
    }
    return true;
  };
  const save = (phase:ReturnFrame['phase']) => result.frames.push({t,state:[...y],loaded,payload:incoming?[...incoming]:null,phase});
  // Predict the next upper pass sufficiently far ahead for a 90-second lead-in.
  const local=y[4]-y[7]; let target=TAU*(Math.floor(local/TAU)+1);
  let predicted=[...y], duration=0;
  while(duration<21600) {
    let h=Math.min(step,21600-duration), next=rk4(predicted,h,d,false,false,cells);
    if(predicted[4]-predicted[7]<target && next[4]-next[7]>=target) {
      let lo=0,hi=h;
      for(let k=0;k<28;k++){const mid=(lo+hi)/2,q=rk4(predicted,mid,d,false,false,cells);if(q[4]-q[7]>=target)hi=mid;else lo=mid;}
      h=hi;next=rk4(predicted,h,d,false,false,cells);
      if(duration+h>=90){predicted=next;duration+=h;break;}
      target+=TAU;
    }
    if(!check(next,false)) {y=next;t=duration+h;save('coast');return result;}
    predicted=next;duration+=h;
  }
  if(duration>=21600) return result;
  const captureAt=duration, approachAt=captureAt-90;
  let supplied=pointState(predicted,compile(d,predicted[6],false,cells),d.spanKm*500);
  for(let back=0;back<90;){const h=Math.min(step,90-back);supplied=particleStep(supplied,-h,env);back+=h;}
  // Replay from the actual post-delivery state, independently of the prediction.
  let nextSample=0;
  while(t<captureAt-1e-8) {
    if(!check(y,false)){save(incoming?'approach':'coast');return result;}
    if(t>=approachAt-1e-8&&!incoming) incoming=[...supplied];
    if(incoming&&Math.hypot(incoming[0],incoming[1])<env.radius+env.cutoff){result.status='limit';result.reason='The supplied approach crosses the 120 km boundary.';save('approach');return result;}
    if(t>=nextSample){save(incoming?'approach':'coast');nextSample=t+10;}
    const h=Math.min(step,captureAt-t,...(t<approachAt-1e-8?[approachAt-t]:[]));
    y=rk4(y,h,d,false,false,cells);if(incoming)incoming=particleStep(incoming,h,env);t+=h;
  }
  if(!check(y,false))return result;
  const bare=compile(d,y[6],false,cells), tip=pointState(y,bare,bare.half);
  result.match=rendezvousResidual(tip,incoming!); save('approach');
  if(!result.match.matched){result.status='miss';result.reason='The independently propagated return missed the position/velocity tolerances. No attachment was made.';return result;}
  result.captureTime=t;result.incomingOrbit=orbit(incoming!,env);
  const facilityBefore=invariants(y,bare,env), mass=settings.massT*1000;
  const payloadBeforeEnergy=mass*result.incomingOrbit.energy;
  const payloadBeforeAngular=mass*(incoming![0]*incoming![3]-incoming![1]*incoming![2]);
  const combinedBefore={energy:facilityBefore.energy+payloadBeforeEnergy,angular:facilityBefore.angular+payloadBeforeAngular};
  y=reframe(y,bare,compile(d,y[6],true,cells));loaded=true;incoming=pointState(y,compile(d,y[6],true,cells),bare.half);save('attached');
  target=y[4]-y[7]+settings.swingDeg*Math.PI/180;
  while(t<captureAt+10800) {
    if(!check(y,true)){save('attached');return result;}
    if(y[4]-y[7]>=target-1e-9)break;
    let h=Math.min(step,captureAt+10800-t), next=rk4(y,h,d,true,false,cells);
    if(next[4]-next[7]>=target){let lo=0,hi=h;for(let k=0;k<28;k++){const mid=(lo+hi)/2,q=rk4(y,mid,d,true,false,cells);if(q[4]-q[7]>=target)hi=mid;else lo=mid;}h=hi;next=rk4(y,h,d,true,false,cells);}
    y=next;t+=h;incoming=pointState(y,compile(d,y[6],true,cells),bare.half);
    if(t>=nextSample){save('attached');nextSample=t+10;}
  }
  if(y[4]-y[7]<target-1e-8){result.reason='The tether did not complete the requested return swing.';return result;}
  if(!check(y,true)){save('attached');return result;}
  save('attached');result.releaseTime=t;result.releasedOrbit=orbit(incoming!,env);
  const attached=compile(d,y[6],true,cells);y=reframe(y,attached,compile(d,y[6],false,cells));loaded=false;
  const facilityAfter=invariants(y,compile(d,y[6],false,cells),env);
  result.payloadEnergyLostJ=payloadBeforeEnergy-mass*result.releasedOrbit.energy;
  result.facilityEnergyGainJ=facilityAfter.energy-facilityBefore.energy;
  result.angularGain=facilityAfter.angular-facilityBefore.angular;
  result.energyResidualJ=facilityAfter.energy+mass*result.releasedOrbit.energy-combinedBefore.energy;
  result.angularResidual=facilityAfter.angular+mass*(incoming![0]*incoming![3]-incoming![1]*incoming![2])-combinedBefore.angular;
  result.recoveredFraction=result.facilityEnergyGainJ/(source.payloadT*1000*delivery.gain);
  const radius=Math.hypot(y[0],y[1]), desired=env.radius+d.altitudeKm*1000;
  result.radiusErrorM=radius-desired;result.speedErrorMs=(y[0]*y[3]-y[1]*y[2])/radius-Math.sqrt(env.mu/desired);
  result.spinErrorPct=(y[5]/spinReference(y,d).omega-1)*100;result.ready=ready(y,d);
  result.status=result.releasedOrbit.perigee>=env.cutoff&&result.facilityEnergyGainJ>0?'complete':'unsafe-release';
  result.reason=result.status==='complete'?'The return released into a lower-energy orbit above the cutoff and transferred energy to the facility.':result.releasedOrbit.perigee<env.cutoff?'The return release intersects the 120 km boundary; this is not a usable orbital delivery.':'This timing did not restore facility energy.';
  save('released');
  // A short independently propagated departure makes the handoff inspectable.
  const end=t+120;
  while(t<end-1e-8){const h=Math.min(step,end-t),nextPayload=particleStep(incoming!,h,env);if(Math.hypot(nextPayload[0],nextPayload[1])<env.radius+env.cutoff)break;y=rk4(y,h,d,false,false,cells);incoming=nextPayload;t+=h;if(!check(y,false))break;if(t>=nextSample){save('released');nextSample=t+10;}}
  if(y[6]!==initialFuel)throw Error('Return exchange must not consume propellant.');
  return result;
}
