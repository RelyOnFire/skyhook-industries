/** P1: a prescribed circular Mars–Phobos binary, radial static cables and one release.
 * SI internally. This is deliberately separate from the free-flying rotor solver.
 * Sources, equations and omitted dynamics: docs/tether-lab/phobos-flight-studio.md.
 */
import { MATERIALS } from './engine.js';

export const PHOBOS_MODEL = 'P1-0.1.0';
export const MARS = { radius:3389500, mu:4.282837362e13, cutoff:150000 } as const;
export const PHOBOS = { radius:11080, mu:708700, separation:9375000 } as const;
export const RATE = Math.sqrt((MARS.mu + PHOBOS.mu) / PHOBOS.separation ** 3);
export const PERIOD = 2 * Math.PI / RATE;
export const MARS_X = -PHOBOS.separation * PHOBOS.mu / (MARS.mu + PHOBOS.mu);
export const PHOBOS_X = MARS_X + PHOBOS.separation;
export const TERMINAL_KG = 2000;
export type Arm = 'inward' | 'outward';
export type State = [number, number, number, number]; // rotating barycentric x, y, vx, vy
export interface PhobosDesign {
  schema:1; model:typeof PHOBOS_MODEL; architecture:'phobos-anchored';
  inwardKm:number; outwardKm:number; areaMm2:number; payloadT:number;
  safetyFactor:number; material:'zylon'|'kevlar'; release:Arm;
}
export const PHOBOS_DEFAULT:PhobosDesign = {
  schema:1, model:PHOBOS_MODEL, architecture:'phobos-anchored',
  inwardKm:1250, outwardKm:3000, areaMm2:50, payloadT:3,
  safetyFactor:2, material:'zylon', release:'inward',
};
export const PHOBOS_BOUNDS = {
  inwardKm:[1,5900], outwardKm:[1,10000], areaMm2:[5,2000],
  payloadT:[.1,50], safetyFactor:[1,5],
} as const;
export function validatePhobos(raw:unknown):PhobosDesign {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Expected a Phobos design object.');
  const d = raw as PhobosDesign;
  if (d.schema !== 1 || d.model !== PHOBOS_MODEL || d.architecture !== 'phobos-anchored')
    throw Error('This experiment accepts P1 Phobos anchored designs only. Open Earth or Moon designs in their own experiment.');
  for (const [key,[min,max]] of Object.entries(PHOBOS_BOUNDS)) {
    const v=d[key as keyof typeof PHOBOS_BOUNDS];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(`${key} must be between ${min} and ${max}.`);
  }
  if (!['zylon','kevlar'].includes(d.material) || !['inward','outward'].includes(d.release)) throw Error('Unknown material or release arm.');
  // Pick known fields; never retain an imported prototype or unrelated state.
  return {schema:1,model:PHOBOS_MODEL,architecture:'phobos-anchored',inwardKm:d.inwardKm,outwardKm:d.outwardKm,
    areaMm2:d.areaMm2,payloadT:d.payloadT,safetyFactor:d.safetyFactor,material:d.material,release:d.release};
}
export function readPhobos(text:string):PhobosDesign {
  if (text.length > 6000) throw Error('Design exceeds the 6 KB limit.');
  return validatePhobos(JSON.parse(text));
}
export const phobosFragment = (d:PhobosDesign) => `#p=${encodeURIComponent(JSON.stringify(validatePhobos(d)))}`;
export const armSign = (arm:Arm) => arm === 'inward' ? -1 : 1;
export const tipX = (d:PhobosDesign, arm:Arm) => PHOBOS_X + armSign(arm) * (PHOBOS.radius + d[arm === 'inward' ? 'inwardKm' : 'outwardKm'] * 1000);

/** Rotating effective potential. The circular binary is an imposed reservoir. */
export function potential(x:number,y=0):number {
  return MARS.mu/Math.hypot(x-MARS_X,y) + PHOBOS.mu/Math.hypot(x-PHOBOS_X,y) + .5*RATE**2*(x*x+y*y);
}
export function gradient(x:number,y=0):[number,number] {
  const rm=Math.hypot(x-MARS_X,y), rp=Math.hypot(x-PHOBOS_X,y);
  return [RATE**2*x-MARS.mu*(x-MARS_X)/rm**3-PHOBOS.mu*(x-PHOBOS_X)/rp**3,
    RATE**2*y-MARS.mu*y/rm**3-PHOBOS.mu*y/rp**3];
}
export const jacobi = (s:State) => 2*potential(s[0],s[1])-s[2]**2-s[3]**2;
export function derivative(s:State):State {
  const g=gradient(s[0],s[1]);return [s[2],s[3],g[0]+2*RATE*s[3],g[1]-2*RATE*s[2]];
}
export function phobosStep(s:State,dt:number):State {
  const add=(v:State,k:State,h:number)=>v.map((x,i)=>x+k[i]*h) as State;
  const a=derivative(s),b=derivative(add(s,a,dt/2)),c=derivative(add(s,b,dt/2)),d=derivative(add(s,c,dt));
  return s.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6) as State;
}
/** Mars-centered inertial state, for drawing and instantaneous Kepler elements. */
export function marsState(s:State,t:number):State {
  const c=Math.cos(RATE*t),n=Math.sin(RATE*t),x=s[0]-MARS_X,y=s[1],vx=s[2]-RATE*y,vy=s[3]+RATE*x;
  return [c*x-n*y,n*x+c*y,c*vx-n*vy,n*vx+c*vy];
}
export function marsOrbit(s:State) {
  const p=marsState(s,0),r=Math.hypot(p[0],p[1]),v2=p[2]**2+p[3]**2,h=p[0]*p[3]-p[1]*p[2];
  const energy=v2/2-MARS.mu/r,e=Math.sqrt(Math.max(0,1+2*energy*h*h/MARS.mu**2));
  return {energy,eccentricity:e,periapsis:h*h/(MARS.mu*(1+e))-MARS.radius,
    apoapsis:energy<0 ? -MARS.mu/(2*energy)*(1+e)-MARS.radius : null,
    vInfinity:energy>0 ? Math.sqrt(2*energy) : 0};
}

export interface ArmLoads {
  arm:Arm; massKg:number; allowablePa:number; maxStressPa:number; margin:number;
  minTensionN:number; rootLoadedN:number; rootEmptyN:number; peakDistanceM:number;
  sections:{distanceM:number;loadedN:number;emptyN:number}[];
}
export function armLoads(d:PhobosDesign,arm:Arm):ArmLoads {
  const material=MATERIALS.find(m=>m.id===d.material)!,sign=armSign(arm),root=PHOBOS.radius;
  const end=root+d[arm==='inward'?'inwardKm':'outwardKm']*1000,area=d.areaMm2*1e-6;
  const outward=(u:number)=>sign*gradient(PHOBOS_X+sign*u)[0];
  const omegaTip=potential(PHOBOS_X+sign*end),accel=outward(end);
  const tension=(u:number,loaded:boolean)=>(TERMINAL_KG+(loaded&&d.release===arm?d.payloadT*1000:0))*accel+
    material.density*area*(omegaTip-potential(PHOBOS_X+sign*u));
  // Along either exterior radial arm d(a_out)/du > 0. The single zero is the
  // only possible interior extremum of tension, and is a maximum.
  let lo:number=root,hi=end;
  if (outward(root)<0 && accel>0) for(let i=0;i<60;i++){const mid=(lo+hi)/2;outward(mid)>0?hi=mid:lo=mid;}
  else lo=hi=accel<=0?end:root;
  const peak=(lo+hi)/2;
  const sections=Array.from({length:97},(_,i)=>root+(end-root)*i/96).concat(peak).sort((a,b)=>a-b)
    .map(u=>({distanceM:u-root,loadedN:tension(u,true),emptyN:tension(u,false)}));
  const values=sections.flatMap(s=>[s.loadedN,s.emptyN]),max=Math.max(...values),min=Math.min(...values);
  const allowable=material.ultimate/d.safetyFactor;
  return {arm,massKg:material.density*area*(end-root),allowablePa:allowable,maxStressPa:Math.max(0,max)/area,
    margin:max>0?allowable*area/max:0,minTensionN:min,rootLoadedN:tension(root,true),rootEmptyN:tension(root,false),peakDistanceM:peak-root,sections};
}
/** Ideal quasistatic surface-to-tip transfer. No motor, efficiency or climb dynamics.
 * E = 1/2 n² x² - U; L = n x²; W_winch = ΔE - nΔL = -ΔΩ.
 * Positive anchor work means energy supplied BY the prescribed anchor reservoir.
 */
export function transferBudget(d:PhobosDesign) {
  const surface=PHOBOS_X+armSign(d.release)*PHOBOS.radius,tip=tipX(d,d.release),m=d.payloadT*1000;
  const deltaAngularMomentum=m*RATE*(tip*tip-surface*surface);
  const anchorWorkJ=RATE*deltaAngularMomentum,winchWorkJ=-m*(potential(tip)-potential(surface));
  return {deltaAngularMomentum,anchorWorkJ,winchWorkJ,deltaEnergyJ:anchorWorkJ+winchWorkJ};
}
export interface PhobosFrame {t:number;state:State}
export interface PhobosResult {
  design:PhobosDesign; loads:ArmLoads[]; budget:ReturnType<typeof transferBudget>;
  orbit:ReturnType<typeof marsOrbit>; frames:PhobosFrame[];
  outcome:'clear'|'mars-limit'|'phobos-impact'|'structure-limit'; issues:string[];
  duration:number; minMarsAltitudeM:number; minPhobosAltitudeM:number; jacobiRelativeError:number;
}
export function runPhobos(input:PhobosDesign, options:{step?:number;duration?:number}={}):PhobosResult {
  const d=validatePhobos(input),step=options.step??2,duration=options.duration??2*PERIOD;
  if (!Number.isFinite(step)||step<=0||step>10||!Number.isFinite(duration)||duration<=0||duration>2*PERIOD) throw Error('Invalid integration limits.');
  const loads=([ 'inward','outward'] as Arm[]).map(a=>armLoads(d,a)),s0:State=[tipX(d,d.release),0,0,0];
  const issues:string[]=[];
  for(const l of loads){
    if(l.minTensionN < -1e-6) issues.push(`${l.arm==='inward'?'Inward':'Outward'} arm needs compression; a cable cannot hold this configuration.`);
    if(l.maxStressPa > l.allowablePa) issues.push(`${l.arm==='inward'?'Inward':'Outward'} arm exceeds the material allowable.`);
  }
  if(tipX(d,'inward')-MARS_X-MARS.radius<MARS.cutoff) issues.push('The inward terminal is below the 150 km Mars exclusion boundary.');
  const alt=(s:State)=>[Math.hypot(s[0]-MARS_X,s[1])-MARS.radius,Math.hypot(s[0]-PHOBOS_X,s[1])-PHOBOS.radius];
  let s=s0,t=0,minimum=alt(s),error=0,nextSample=30;
  const c0=jacobi(s),frames:PhobosFrame[]=[{t,state:[...s]}];
  let outcome:PhobosResult['outcome']=issues.length?'structure-limit':'clear';
  if(!issues.length) while(t<duration-1e-8) {
    const dt=Math.min(step,duration-t),next=phobosStep(s,dt),a=alt(next);
    // Segment test also catches a crossing whose endpoint is outside the sphere.
    const segmentDistance=(x:number)=>{
      const dx=next[0]-s[0],dy=next[1]-s[1],q=dx*dx+dy*dy;
      const f=q?Math.max(0,Math.min(1,-((s[0]-x)*dx+s[1]*dy)/q)):0;
      return Math.hypot(s[0]+f*dx-x,s[1]+f*dy);
    };
    const crossedMars=segmentDistance(MARS_X)<=MARS.radius+MARS.cutoff,crossedPhobos=segmentDistance(PHOBOS_X)<=PHOBOS.radius;
    const entry=(x:number,r:number)=>{
      const distance=(h:number)=>{const p=phobosStep(s,h);return Math.hypot(p[0]-x,p[1]);};
      // Confirm the curved path actually enters, including a grazing step with
      // two exterior endpoints. Find the minimum, then bisect the first entry.
      let left=0,right=dt;
      for(let i=0;i<36;i++){const a=left+(right-left)/3,b=right-(right-left)/3;distance(a)<distance(b)?right=b:left=a;}
      let high=distance(dt)<distance((left+right)/2)?dt:(left+right)/2,low=0;
      if(distance(high)>r)return Infinity;
      for(let i=0;i<36;i++){const h=(low+high)/2;distance(h)<=r?high=h:low=h;}
      return high;
    };
    const marsEntry=crossedMars?entry(MARS_X,MARS.radius+MARS.cutoff):Infinity,phobosEntry=crossedPhobos?entry(PHOBOS_X,PHOBOS.radius):Infinity;
    if(Number.isFinite(Math.min(marsEntry,phobosEntry))){
      const high=Math.min(marsEntry,phobosEntry);
      s=phobosStep(s,high);t+=high;outcome=marsEntry<=phobosEntry?'mars-limit':'phobos-impact';
      minimum=minimum.map((v,i)=>Math.min(v,alt(s)[i]));error=Math.max(error,Math.abs(jacobi(s)-c0)/Math.abs(c0));
      frames.push({t,state:[...s]});break;
    }
    s=next;t+=dt;minimum=minimum.map((v,i)=>Math.min(v,a[i]));error=Math.max(error,Math.abs(jacobi(s)-c0)/Math.abs(c0));
    if(t>=nextSample||t>=duration-1e-8){frames.push({t,state:[...s]});nextSample=t+30;}
  }
  return {design:d,loads,budget:transferBudget(d),orbit:marsOrbit(s0),frames,outcome,issues,duration:t,
    minMarsAltitudeM:minimum[0],minPhobosAltitudeM:minimum[1],jacobiRelativeError:error};
}
/** Hermite replay between stored states; exact frame endpoints are preserved. */
export function phobosSample(r:PhobosResult,t:number):State {
  if(t<=0)return r.frames[0].state;
  if(t>=r.duration)return r.frames.at(-1)!.state;
  let lo=0,hi=r.frames.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;r.frames[m].t>t?hi=m:lo=m;}
  const a=r.frames[lo],b=r.frames[hi],dt=b.t-a.t,u=(t-a.t)/dt,u2=u*u,u3=u2*u;
  const p=[0,1].map(i=>(2*u3-3*u2+1)*a.state[i]+(u3-2*u2+u)*dt*a.state[i+2]+(-2*u3+3*u2)*b.state[i]+(u3-u2)*dt*b.state[i+2]);
  const v=[0,1].map(i=>(6*u2-6*u)/dt*a.state[i]+(3*u2-4*u+1)*a.state[i+2]+(-6*u2+6*u)/dt*b.state[i]+(3*u2-2*u)*b.state[i+2]);
  return [...p,...v] as State;
}
