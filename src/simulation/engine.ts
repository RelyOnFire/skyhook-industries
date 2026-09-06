/** Tether Lab D1p/0.2.0. Planar rigid extended-body educational model.
 * SI throughout. No atmosphere, elasticity, capture shock, or debris model.
 * Rendering is never an input to this module. */
export const MODEL = 'D1p-0.2.0';
export const PAYLOAD_LIMIT_T = 250;
export const STANDARD_PAYLOAD_T = 20;
export const ACTIVE_ARCHITECTURE = 'single-stage-rotovator' as const;
export const MU = 3.986004418e14;
export const EARTH = 6371000;
export const G0 = 9.80665;
export const TAU = 2 * Math.PI;
export interface Material { id: string; name: string; density: number; ultimate: number; basis: string; source: string; locator: string }
export const MATERIALS: Material[] = [
  {id:'zylon', name:'Zylon® HM', density:1560, ultimate:5.8e9, basis:'Published fiber data; not a flight allowable', source:'https://www.toyobo-global.com/seihin/kc/pbo/zylon-p/bussei-p/technical.pdf', locator:'Toyobo, Technical Information (2005), p. 3'},
  {id:'kevlar', name:'Kevlar® 49', density:1440, ultimate:3.0e9, basis:'Conditioned yarn test; not resin-impregnated strand', source:'https://www.r-g.de/wiki/images/e/ec/Td_en_Kevlar_guide.pdf', locator:'DuPont, Technical Guide, Table II-1, p. 5; manufacturer document hosted by R&G'},
  {id:'future', name:'Future carbon · hypothetical', density:1400, ultimate:20e9, basis:'Invented scenario properties, not a manufactured material', source:'', locator:'Exploration assumption; no material qualification claimed'},
  {id:'custom', name:'Custom material', density:1500, ultimate:6e9, basis:'User-defined hypothetical input', source:'', locator:'User assumption'},
];
export interface Design {
  schema: 2; model: typeof MODEL; architecture: typeof ACTIVE_ARCHITECTURE; material: string; spanKm: number; altitudeKm: number;
  tipSpeedKms: number; areaMm2: number; shape: 'uniform'|'tapered'; payloadT: number;
  fuelT: number; recovery: 'none'|'chemical'; releaseDeg: number; safetyFactor: number;
  density: number; ultimateGPa: number; thrustN: number; isp: number;
}
export const DEFAULT: Design = {schema:2,model:MODEL,architecture:ACTIVE_ARCHITECTURE,material:'zylon',spanKm:600,altitudeKm:1600,
  tipSpeedKms:1.2,areaMm2:80,shape:'uniform',payloadT:3,fuelT:20,recovery:'chemical',releaseDeg:180,
  safetyFactor:2,density:1500,ultimateGPa:6,thrustN:5000,isp:320};
export const PRESETS = [
  {id:'relay',name:'Orbital relay',description:'Make two deliveries. Recover the orbit between them.',design:{...DEFAULT}},
  {id:'coast',name:'What if we never reboost?',description:'Same dry structure and payload. No thrust or onboard propellant.',design:{...DEFAULT,recovery:'none' as const,fuelT:0}},
  {id:'light',name:'The material challenge',description:'Less cross-section. Does this fiber carry the load?',design:{...DEFAULT,material:'kevlar',areaMm2:35,payloadT:5}},
  {id:'future',name:'A longer reach',description:'Hypothetical carbon, 1,200 km span, more demanding transfer.',design:{...DEFAULT,material:'future',spanKm:1200,altitudeKm:2400,tipSpeedKms:1.7,areaMm2:100,fuelT:15,payloadT:5}},
];
const BOUNDS: Record<string,[number,number]> = {spanKm:[80,4000],altitudeKm:[400,8000],tipSpeedKms:[0.25,2.5],areaMm2:[5,2500],payloadT:[0.1,PAYLOAD_LIMIT_T],fuelT:[0,80],releaseDeg:[70,210],safetyFactor:[1.2,5],density:[500,12000],ultimateGPa:[0.1,100],thrustN:[100,10000],isp:[150,450]};
export function validate(input: unknown): Design {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Design must be an object.');
  const d = input as Record<string,unknown>;
  if (d.schema !== 2 || d.model !== MODEL) throw Error('This saved design needs a different model version. It has not been silently migrated.');
  if (d.architecture !== ACTIVE_ARCHITECTURE) throw Error('This architecture has no simulation engine in this build. Open the architecture catalogue for its status.');
  if (!MATERIALS.some(m=>m.id===d.material)) throw Error('Unknown material profile.');
  if (!['uniform','tapered'].includes(String(d.shape))) throw Error('Unsupported structure.');
  if (!['none','chemical'].includes(String(d.recovery))) throw Error('Unsupported recovery model.');
  const clean: Record<string,unknown> = {schema:2,model:MODEL,architecture:ACTIVE_ARCHITECTURE,material:d.material,shape:d.shape,recovery:d.recovery};
  for (const [key,[lo,hi]] of Object.entries(BOUNDS)) {
    if (typeof d[key] !== 'number' || !Number.isFinite(d[key]) || (d[key] as number)<lo || (d[key] as number)>hi) throw Error(`${key} must be between ${lo} and ${hi}.`);
    clean[key] = d[key];
  }
  // Coast is a no-propulsion scenario, not a tank of unused reaction mass.
  // Reject ambiguous imports rather than silently changing their mass.
  if (d.recovery === 'none' && d.fuelT !== 0) throw Error('Coast uses no onboard propellant. Set fuelT to 0 or select chemical recovery.');
  return clean as unknown as Design;
}
export function properties(d: Design) {
  const m = MATERIALS.find(m=>m.id===d.material)!;
  const density = d.material==='custom' ? d.density : m.density;
  const ultimate = d.material==='custom' ? d.ultimateGPa*1e9 : m.ultimate;
  return {density,ultimate,allowable:ultimate/d.safetyFactor};
}
export type State = number[]; // x,y,vx,vy,theta,omega,fuel,unwrapped polar angle
export interface Sample {s:number;m:number;area:number}
export interface Body {points:Sample[];mass:number;center:number;inertia:number;half:number;area:number;structural:number}
const HUB = 30000, TIP = 2000;
export function compile(d: Design, fuel: number, payload: boolean, cells=48): Body {
  const half=d.spanKm*500, ds=2*half/cells, area=d.areaMm2*1e-6, {density}=properties(d);
  const profile=(s:number)=>d.shape==='uniform'?1:1-0.7*(s/half)**2;
  const points:Sample[]=[];
  for(let i=0;i<cells;i++) {const s=-half+(i+0.5)*ds; points.push({s,m:density*area*profile(s)*ds,area:area*profile(s)});}
  const structural=points.reduce((a,p)=>a+p.m,0);
  points.push({s:-half,m:TIP,area:area*profile(-half)},{s:0,m:HUB+Math.max(0,fuel),area},{s:half,m:TIP+(payload?d.payloadT*1000:0),area:area*profile(half)});
  points.sort((a,b)=>a.s-b.s);
  const mass=points.reduce((a,p)=>a+p.m,0), center=points.reduce((a,p)=>a+p.s*p.m,0)/mass;
  const inertia=points.reduce((a,p)=>a+p.m*(p.s-center)**2,0);
  return {points,mass,center,inertia,half,area,structural};
}
export function pointState(y:State,b:Body,s:number):number[] {
  const q=s-b.center,c=Math.cos(y[4]),z=Math.sin(y[4]);
  return [y[0]+q*c,y[1]+q*z,y[2]-y[5]*q*z,y[3]+y[5]*q*c];
}
export function gravity(x:number,y:number):[number,number] {const r=Math.hypot(x,y),f=-MU/r**3;return [f*x,f*y];}
export function forces(y:State,b:Body,d:Design,burn=false) {
  const c=Math.cos(y[4]),s=Math.sin(y[4]);let fx=0,fy=0,torque=0;
  const grav=b.points.map(p=>{const q=p.s-b.center,[gx,gy]=gravity(y[0]+q*c,y[1]+q*s);fx+=p.m*gx;fy+=p.m*gy;torque+=p.m*q*(c*gy-s*gx);return [gx,gy];});
  let tx=0,ty=0,tt=0,flow=0;
  if(burn && y[6]>1e-7 && d.recovery==='chemical') {
    const r=Math.hypot(y[0],y[1]),ex=y[0]/r,ey=y[1]/r,vr=y[2]*ex+y[3]*ey,vt=-y[2]*ey+y[3]*ex;
    const targetR=EARTH+d.altitudeKm*1000,targetV=Math.sqrt(MU/targetR);
    // Feedback forces; the orbit and spin are never reset. Cancels only modeled gravity.
    const ar=-(r-targetR)/2500**2-vr/1200-vt*vt/r-(fx*ex+fy*ey)/b.mass;
    const at=(Math.sqrt(MU*targetR)/r-vt)/1200-(-fx*ey+fy*ex)/b.mass;
    tx=b.mass*(ar*ex-at*ey);ty=b.mass*(ar*ey+at*ex);
    const ref=spinReference(y,d);
    tt=b.inertia*((ref.omega-y[5])/350+ref.alpha)-torque;
    const bill=Math.hypot(tx,ty)+Math.abs(tt)/b.half, scale=Math.min(1,d.thrustN/Math.max(1e-20,bill));
    tx*=scale;ty*=scale;tt*=scale;flow=(Math.hypot(tx,ty)+Math.abs(tt)/b.half)/(d.isp*G0);
  }
  return {ax:(fx+tx)/b.mass,ay:(fy+ty)/b.mass,alpha:(torque+tt)/b.inertia,tx,ty,tt,flow,grav};
}
export function derivative(y:State,d:Design,loaded:boolean,burn:boolean,cells=48):State {
  const b=compile(d,y[6],loaded,cells),f=forces(y,b,d,burn);
  return [y[2],y[3],f.ax,f.ay,y[5],f.alpha,-f.flow,(y[0]*y[3]-y[1]*y[2])/(y[0]**2+y[1]**2)];
}
export function rk4(y:State,h:number,d:Design,loaded=false,burn=false,cells=48):State {
  const k1=derivative(y,d,loaded,burn,cells),k2=derivative(y.map((v,i)=>v+h*k1[i]/2),d,loaded,burn,cells),k3=derivative(y.map((v,i)=>v+h*k2[i]/2),d,loaded,burn,cells),k4=derivative(y.map((v,i)=>v+h*k3[i]),d,loaded,burn,cells);
  return y.map((v,i)=>v+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}
export function particleStep(p:number[],h:number):number[] {
  const f=(x:number[])=>[x[2],x[3],...gravity(x[0],x[1])];const a=f(p),b=f(p.map((v,i)=>v+h*a[i]/2)),c=f(p.map((v,i)=>v+h*b[i]/2)),e=f(p.map((v,i)=>v+h*c[i]));return p.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+e[i])/6);
}
export function reframe(y:State,old:Body,next:Body):State {
  const shift=next.center-old.center,c=Math.cos(y[4]),s=Math.sin(y[4]);
  const n=[...y];n[0]+=shift*c;n[1]+=shift*s;n[2]-=y[5]*shift*s;n[3]+=y[5]*shift*c;
  // Unwrap the new centroid's polar angle without changing the physical attitude.
  const delta=Math.atan2(n[1],n[0])-Math.atan2(y[1],y[0]);n[7]+=Math.atan2(Math.sin(delta),Math.cos(delta));return n;
}
export function invariants(y:State,b:Body) {
  let energy=0,angular=0,px=0,py=0;
  for(const p of b.points) {const q=pointState(y,b,p.s);energy+=p.m*(0.5*(q[2]**2+q[3]**2)-MU/Math.hypot(q[0],q[1]));angular+=p.m*(q[0]*q[3]-q[1]*q[2]);px+=p.m*q[2];py+=p.m*q[3];}
  return {energy,angular,px,py};
}
export function orbit(p:number[]) {
  const r=Math.hypot(p[0],p[1]),v2=p[2]**2+p[3]**2,e=v2/2-MU/r,h=p[0]*p[3]-p[1]*p[2];
  const ecc=Math.sqrt(Math.max(0,1+2*e*h*h/MU**2)),peri=h*h/(MU*(1+ecc))-EARTH;
  return {energy:e,ecc,perigee:peri,apogee:e<0?-MU/(2*e)*(1+ecc)-EARTH:null};
}
export function clearance(y:State,b:Body) {
  const a=pointState(y,b,-b.half),z=pointState(y,b,b.half),dx=z[0]-a[0],dy=z[1]-a[1],u=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy)));
  return Math.hypot(a[0]+u*dx,a[1]+u*dy)-EARTH;
}
export function loadCheck(y:State,b:Body,d:Design,burn:boolean) {
  const f=forces(y,b,d,burn),c=Math.cos(y[4]),s=Math.sin(y[4]),allow=properties(d).allowable;
  let axial=0,maxStress=0,minTension=0,peak=0;
  for(let i=0;i<b.points.length-1;i++) {
    const p=b.points[i],q=p.s-b.center;
    const tx=Math.abs(p.s)<1e-6?f.tx:0,ty=Math.abs(p.s)<1e-6?f.ty:0;
    // The ideal tip couple is transverse, and does not contribute to axial load.
    const rx=p.m*(f.ax-y[5]**2*q*c-f.alpha*q*s-f.grav[i][0])-tx;
    const ry=p.m*(f.ay-y[5]**2*q*s+f.alpha*q*c-f.grav[i][1])-ty;
    axial+=rx*c+ry*s;minTension=Math.min(minTension,axial);
    const pos=(p.s+b.points[i+1].s)/2, factor=d.shape==='uniform'?1:1-0.7*(pos/b.half)**2;
    const stress=axial/(b.area*factor);if(stress>maxStress){maxStress=stress;peak=pos;}
  }
  return {margin:maxStress>0?allow/maxStress:999,stress:maxStress,minTension,peak};
}
export function initial(d:Design):State {const r=EARTH+d.altitudeKm*1000;return [r,0,0,Math.sqrt(MU/r),Math.PI,d.tipSpeedKms*1000/(d.spanKm*500),d.fuelT*1000,0];}
export function spinReference(y:State,d:Design) {
  // Circular short-rod gravity-gradient reference for the guidance law only.
  // The actual motion still uses distributed gravity. Do not fight the natural
  // periodic spin variation as if a constant inertial spin were free.
  const r=EARTH+d.altitudeKm*1000,n=Math.sqrt(MU/r**3),w=d.tipSpeedKms*1000/(d.spanKm*500);
  const phase=y[4]-y[7],q=(w-n)**2+1.5*n*n*(Math.cos(2*phase)-1);
  const rel=Math.sqrt(Math.max(q,1e-12)),polar=(y[0]*y[3]-y[1]*y[2])/(y[0]**2+y[1]**2);
  return {omega:n+rel,alpha:-1.5*n*n*Math.sin(2*phase)*(y[5]-polar)/rel};
}
export function ready(y:State,d:Design) {
  const r=Math.hypot(y[0],y[1]),vr=(y[0]*y[2]+y[1]*y[3])/r,vt=(y[0]*y[3]-y[1]*y[2])/r,target=EARTH+d.altitudeKm*1000;
  return Math.abs(r-target)<15000 && Math.abs(vr)<8 && Math.abs(vt-Math.sqrt(MU/target))<12 && Math.abs(y[5]/spinReference(y,d).omega-1)<0.005;
}
export interface Frame {t:number;state:State;loaded:boolean;burn:boolean;payloads:number[][];incoming:number[]|null;clearance:number;margin:number;deliveries:number;fuel:number}
export interface MissionEvent {t:number;kind:string;title:string;detail:string}
export interface Delivery {number:number;t:number;gain:number;perigee:number;apogee:number|null;energy:number}
export interface Result {model:string;design:Design;frames:Frame[];events:MissionEvent[];deliveries:Delivery[];outcome:string;reason:string;dryMass:number;structuralMass:number;minClearance:number;minMargin:number;fuelUsed:number;final:State;maxStep:number;cells:number}
export function resize(d:Design):number {
  const {density,allowable}=properties(d),h=d.spanKm*500,r=EARTH+d.altitudeKm*1000,w=d.tipSpeedKms*1000/h;
  const a=(s:number)=>MU/(r-s)**2-MU/r**2+w*w*s;
  if(r-h<=EARTH+120000) throw Error('Raise the orbit before sizing: a tip starts outside the modeled environment.');
  const n=2000,ds=h/n,mt=d.payloadT*1000+TIP;let self=0,need=0;
  for(let i=n;i>=0;i--) {const s=i*ds,f=d.shape==='uniform'?1:1-0.7*(s/h)**2;
    if(i<n){const mid=s+ds/2;self+=density*(d.shape==='uniform'?1:1-0.7*(mid/h)**2)*a(mid)*ds;}
    const denom=allowable*f-self;if(denom<=0)throw Error('No area satisfies this radial sizing case. Reduce spin/span or choose a higher specific strength.');
    need=Math.max(need,mt*a(h)/denom);
  }
  const mm2=Math.ceil(need*1.15*1e6);if(mm2>2500)throw Error('Sizing exceeds the 2,500 mm² sandbox limit.');return Math.max(5,mm2);
}
export function simulate(input:unknown,options:{step?:number;cells?:number;horizon?:number}={}):Result {
  const d=validate(input),step=options.step??2,cells=options.cells??48,horizon=options.horizon??21600;
  if(!Number.isFinite(step)||step<=0||step>4||!Number.isInteger(cells)||cells<8||cells>192||!Number.isFinite(horizon)||horizon<0||horizon>21600)throw Error('Invalid numerical budget.');
  const w=d.tipSpeedKms*1000/(d.spanKm*500),n=Math.sqrt(MU/(EARTH+d.altitudeKm*1000)**3);
  if(w-n<=Math.sqrt(3)*n) throw Error('This scenario requires continuous prograde rotation relative to Earth. Increase tip speed, shorten the tether, or raise the orbit. Gravity-gradient libration is not included in this mission.');
  let y=initial(d),loaded=false,t=0,burn=false,nextCapture=90,phaseAtCapture=0,stable=0,checkTime=0,awaitingPass=false,passTarget=0;
  let capturedEnergy=0,stopAt=Infinity,minClearance=Infinity,minMargin=Infinity,outcome='incomplete',reason='Recovery did not meet the orbit and spin tolerances within six simulated hours.';
  const events:MissionEvent[]=[],frames:Frame[]=[],deliveries:Delivery[]=[],payloads:number[][]=[];
  const dry=compile(d,0,false,cells);
  const event=(kind:string,title:string,detail:string)=>events.push({t,kind,title,detail});
  // Start exactly at a supplied, velocity-matched rendezvous. The first 90 s
  // are an independently propagated lead-in, not a decorative approach arc.
  let incoming=pointState(y,compile(d,y[6],false,cells),d.spanKm*500);
  for(let back=0;back<90;){const h=Math.min(step,90-back);y=rk4(y,-h,d,false,false,cells);incoming=particleStep(incoming,-h);back+=h;}
  event('start','Rendezvous supplied','The incoming orbit was constructed to match the tip at capture. No rocket ascent or guidance is simulated.');
  let nextSample=0;
  for(let count=0;t<=Math.min(horizon,stopAt)+1e-8&&count<40000;count++) {
    let b=compile(d,y[6],loaded,cells),low=clearance(y,b),load=loadCheck(y,b,d,burn);
    minClearance=Math.min(minClearance,low);minMargin=Math.min(minMargin,load.margin);
    const save=()=>frames.push({t,state:[...y],loaded,burn,payloads:payloads.map(p=>[...p]),incoming:t<90?[...incoming]:null,clearance:low,margin:load.margin,deliveries:deliveries.length,fuel:Math.max(0,y[6])});
    if(low<120000||load.margin<1||load.minTension<-100) {
      outcome='limit';reason=low<120000?'A part of the tether crossed the 120 km model cutoff. Atmospheric flight is not modeled.':load.margin<1?'The axial stress exceeded the chosen fiber allowable. Elastic failure is not simulated.':'A cable section requires compression. A rigid tether is no longer a valid taut-cable approximation.';
      event('limit','Modeled limit reached',reason);save();break;
    }
    if(y.some(v=>!Number.isFinite(v))){throw Error('Non-finite state; numerical calculation stopped.');}
    if(t>=nextCapture-1e-7) {
      const tip=pointState(y,b,b.half);
      if(deliveries.length===0) {
        const positionError=Math.hypot(tip[0]-incoming[0],tip[1]-incoming[1]),velocityError=Math.hypot(tip[2]-incoming[2],tip[3]-incoming[3]);
        if(positionError>2||velocityError>0.02)throw Error('Supplied rendezvous failed its numerical position/velocity check.');
      }
      capturedEnergy=orbit(tip).energy;const nb=compile(d,y[6],true,cells);y=reframe(y,b,nb);loaded=true;burn=false;awaitingPass=false;stable=0;phaseAtCapture=y[4]-y[7];nextCapture=Infinity;
      event('capture',`Payload ${deliveries.length+1} captured`,'Ideal velocity match. Existing material points remain continuous; the combined center of mass is recomputed.');b=nb;checkTime=t;low=clearance(y,b);load=loadCheck(y,b,d,burn);save();continue;
    }
    const local=y[4]-y[7];
    if(loaded&&local>=phaseAtCapture+d.releaseDeg*Math.PI/180-1e-8) {
      const p=pointState(y,b,b.half),o=orbit(p);payloads.push(p);deliveries.push({number:deliveries.length+1,t,gain:o.energy-capturedEnergy,...o});
      const nb=compile(d,y[6],false,cells);y=reframe(y,b,nb);loaded=false;b=nb;
      event('release',`Payload ${deliveries.length} released`,o.perigee>=120000?`Released orbit: ${Math.round(o.perigee/1000)} km perigee; ${o.apogee===null?'Earth escape':Math.round(o.apogee/1000)+' km apogee'}.`:'The released payload orbit intersects the 120 km cutoff; this is not a successful delivery.');
      if(o.perigee<120000||o.energy<=capturedEnergy){outcome='delivery-failed';reason='The payload did not reach a higher-energy orbit with perigee above 120 km.';stopAt=t+120;}
      else if(deliveries.length===2){outcome='complete';reason='Two higher-energy deliveries, with orbit and spin readiness checked before the second supplied rendezvous.';stopAt=t+240;}
      else if(d.recovery==='chemical'&&y[6]>0){burn=true;event('recovery','Chemical recovery begins','Bounded thrust restores radius, orbital speed and spin; propellant is consumed continuously.');}
      else event('coast','Coasting without reboost','The second rendezvous waits for radius, radial/tangential speed and spin to return within the defined tolerances.');
      checkTime=t;low=clearance(y,b);load=loadCheck(y,b,d,burn);save();continue;
    }
    if(!loaded&&deliveries.length===1&&stopAt===Infinity) {
      stable=ready(y,d)?stable+Math.max(0,t-checkTime):0;checkTime=t;
      if(stable>=60&&!awaitingPass){burn=false;awaitingPass=true;passTarget=Math.PI+TAU*(Math.floor(((y[4]-y[7])-Math.PI)/TAU)+1);event('ready','Orbit and spin recovered','Readiness held for 60 s. A second supplied rendezvous will be attempted at the next working-tip lower radial pass.');}
      if(awaitingPass&&y[4]-y[7]>=passTarget-1e-8){if(ready(y,d)){nextCapture=t;continue;}awaitingPass=false;stable=0;burn=d.recovery==='chemical'&&y[6]>0;event('wait','Readiness drifted','Recovery resumes; the missed window does not count as a capture.');}
    }
    if(burn&&y[6]<=1e-7){y[6]=0;burn=false;event('fuel','Propellant exhausted','No further recovery thrust is applied.');}
    if(t>=nextSample-1e-8){save();nextSample=t+10;}
    if(t>=Math.min(horizon,stopAt)-1e-7)break;
    let h=Math.min(step,nextCapture-t,Math.min(horizon,stopAt)-t);
    // Split the step at a release/radial event; do not skip events at warp speed.
    let yn=rk4(y,h,d,loaded,burn,cells),target=loaded?phaseAtCapture+d.releaseDeg*Math.PI/180:awaitingPass?passTarget:Infinity;
    if(y[4]-y[7]<target&&yn[4]-yn[7]>=target){let lo=0,hi=h;for(let k=0;k<22;k++){const mid=(lo+hi)/2,v=rk4(y,mid,d,loaded,burn,cells);if(v[4]-v[7]>=target)hi=mid;else lo=mid;}h=hi;yn=rk4(y,h,d,loaded,burn,cells);}
    if(yn[6]<0&&burn){const flow=forces(y,b,d,true).flow;h=Math.min(h,y[6]/Math.max(flow,1e-20));yn=rk4(y,h,d,loaded,burn,cells);yn[6]=Math.max(0,yn[6]);}
    if(h<1e-10)throw Error('Numerical event step stalled.');
    const violates=(v:State)=>{const body=compile(d,v[6],loaded,cells),check=loadCheck(v,body,d,burn);return clearance(v,body)<120000||check.margin<1||check.minTension<-100;};
    if(violates(yn)){let lo=0,hi=h;for(let k=0;k<18;k++){const mid=(lo+hi)/2;if(violates(rk4(y,mid,d,loaded,burn,cells)))hi=mid;else lo=mid;}h=hi;yn=rk4(y,h,d,loaded,burn,cells);}
    // Limit crossings and mission commands are bracketed independently of render time.
    incoming=particleStep(incoming,h);
    for(let i=0;i<payloads.length;i++){if(Math.hypot(payloads[i][0],payloads[i][1])>EARTH+120000)payloads[i]=particleStep(payloads[i],h);}
    y=yn;t+=h;
  }
  if(outcome==='incomplete')event('end','Second delivery not achieved',reason);
  if(outcome==='complete')event('end','Two deliveries complete',reason);
  return {model:MODEL,design:d,frames,events,deliveries,outcome,reason,dryMass:dry.mass,structuralMass:dry.structural,minClearance,minMargin,fuelUsed:d.fuelT*1000-Math.max(0,y[6]),final:y,maxStep:step,cells};
}
