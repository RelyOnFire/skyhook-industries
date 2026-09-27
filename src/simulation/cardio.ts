/** C1p: finite single-arm rigid rotor in an initially eccentric Earth orbit.
 * Free gravity-gradient dynamics; no imposed spin lock, reeling or controller. */
import { EARTH, MU, MATERIALS, orbit } from './engine.js';
export const CARDIO_MODEL='C1p-0.1.0';
export const CARDIO_CUTOFF=120000;
export interface CardioDesign {schema:1;model:typeof CARDIO_MODEL;architecture:'cardiorotovator';perigeeKm:number;apogeeKm:number;lengthKm:number;stationT:number;payloadT:number;areaMm2:number;taper:number;spinRatio:number;phaseDeg:number}
export const CARDIO_DEFAULT:CardioDesign={schema:1,model:CARDIO_MODEL,architecture:'cardiorotovator',perigeeKm:1200,apogeeKm:1800,lengthKm:800,stationT:5000,payloadT:10,areaMm2:500,taper:3,spinRatio:2,phaseDeg:0};
export const CARDIO_BOUNDS={perigeeKm:[150,2000],apogeeKm:[500,6000],lengthKm:[100,5000],stationT:[100,20000],payloadT:[.1,100],areaMm2:[50,3000],taper:[1,10],spinRatio:[1,3],phaseDeg:[-90,90]} as const;
export function validateCardio(value:unknown):CardioDesign {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a CardioRotovator design.');
  const d=value as CardioDesign;
  if(d.schema!==1||d.model!==CARDIO_MODEL||d.architecture!=='cardiorotovator')throw Error('This experiment accepts C1p-0.1.0 CardioRotovator designs only.');
  const clean:Record<string,unknown>={schema:1,model:CARDIO_MODEL,architecture:'cardiorotovator'};
  for(const [key,[lo,hi]] of Object.entries(CARDIO_BOUNDS)){const n=d[key as keyof typeof CARDIO_BOUNDS];if(typeof n!=='number'||!Number.isFinite(n)||n<lo||n>hi)throw Error(`${key} must be between ${lo} and ${hi}.`);clean[key]=n;}
  if(d.apogeeKm<=d.perigeeKm)throw Error('Apogee must be above perigee.');
  return clean as unknown as CardioDesign;
}
export function readCardio(text:string){if(text.length>16000)throw Error('Design exceeds 16 KB.');return validateCardio(JSON.parse(text));}
export const cardioFragment=(d:CardioDesign)=>'#cardio='+encodeURIComponent(JSON.stringify(validateCardio(d)));
export type CardioState=[number,number,number,number,number,number];
interface Node {s:number;m:number}
export interface CardioBody {nodes:Node[];mass:number;center:number;inertia:number;length:number;cuts:number[];areas:number[]}
const fiber=MATERIALS.find(m=>m.id==='zylon')!;
export const CARDIO_ALLOWABLE=fiber.ultimate/2;
export function cardioBody(d:CardioDesign,loaded:boolean,cells=48):CardioBody {
  const length=d.lengthKm*1000,ds=length/cells,nodes:Node[]=[{s:0,m:d.stationT*1000},{s:length,m:2000+(loaded?d.payloadT*1000:0)}];
  const area=(s:number)=>d.areaMm2*1e-6*(d.taper-(d.taper-1)*s/length);
  // Two-point Gauss quadrature integrates the linear taper's mass moments exactly.
  for(let i=0;i<cells;i++)for(const q of [-1,1]){const s=(i+.5+q/(2*Math.sqrt(3)))*ds;nodes.push({s,m:fiber.density*area(s)*ds/2});}
  nodes.sort((a,b)=>a.s-b.s);
  const mass=nodes.reduce((n,p)=>n+p.m,0),center=nodes.reduce((n,p)=>n+p.m*p.s,0)/mass;
  return {nodes,mass,center,inertia:nodes.reduce((n,p)=>n+p.m*(p.s-center)**2,0),length,cuts:Array.from({length:cells},(_,i)=>i*ds),areas:Array.from({length:cells},(_,i)=>area(i*ds))};
}
export function cardioPoint(y:CardioState,b:CardioBody,s:number):[number,number,number,number]{const u=s-b.center,c=Math.cos(y[4]),v=Math.sin(y[4]);return [y[0]+u*c,y[1]+u*v,y[2]-u*y[5]*v,y[3]+u*y[5]*c];}
export function cardioInitial(d:CardioDesign,b:CardioBody){
  const ra=EARTH+d.apogeeKm*1000,rp=EARTH+d.perigeeKm*1000,a=(ra+rp)/2,n=Math.sqrt(MU/a**3),period=2*Math.PI/n;
  const state:CardioState=[ra,0,0,Math.sqrt(MU*(2/ra-1/a)),Math.PI+d.phaseDeg*Math.PI/180,d.spinRatio*n];
  return {state,period};
}
export function cardioCapture(y:CardioState,empty:CardioBody,loaded:CardioBody):CardioState {
  // Incoming cargo already shares the tip's position and velocity. Every existing
  // material point keeps its velocity; reframe only to the new combined COM.
  const delta=loaded.center-empty.center,c=Math.cos(y[4]),s=Math.sin(y[4]);
  return [y[0]+delta*c,y[1]+delta*s,y[2]-delta*y[5]*s,y[3]+delta*y[5]*c,y[4],y[5]];
}
function motion(y:CardioState,b:CardioBody,mu:number){
  const c=Math.cos(y[4]),s=Math.sin(y[4]);let fx=0,fy=0,torque=0;
  const gravity=b.nodes.map(p=>{const u=p.s-b.center,x=y[0]+u*c,v=y[1]+u*s,k=-mu/Math.hypot(x,v)**3,gx=k*x,gy=k*v;fx+=p.m*gx;fy+=p.m*gy;torque+=p.m*u*(c*gy-s*gx);return [gx,gy];});
  return {ax:fx/b.mass,ay:fy/b.mass,alpha:torque/b.inertia,gravity};
}
export function cardioDerivative(y:CardioState,b:CardioBody,mu=MU):CardioState{const f=motion(y,b,mu);return [y[2],y[3],f.ax,f.ay,y[5],f.alpha];}
export function cardioStep(y:CardioState,h:number,b:CardioBody,mu=MU):CardioState{
  const plus=(v:number[],k:number[],f:number)=>v.map((n,i)=>n+f*k[i]) as CardioState;
  const a=cardioDerivative(y,b,mu),c=cardioDerivative(plus(y,a,h/2),b,mu),d=cardioDerivative(plus(y,c,h/2),b,mu),e=cardioDerivative(plus(y,d,h),b,mu);
  return y.map((v,i)=>v+h*(a[i]+2*c[i]+2*d[i]+e[i])/6) as CardioState;
}
export function cardioInvariants(y:CardioState,b:CardioBody,mu=MU){
  let energy=0,angular=0;for(const p of b.nodes){const [x,v,vx,vy]=cardioPoint(y,b,p.s);energy+=p.m*((vx*vx+vy*vy)/2-mu/Math.hypot(x,v));angular+=p.m*(x*vy-v*vx);}return {energy,angular};
}
export function cardioClearance(y:CardioState,b:CardioBody){const c=Math.cos(y[4]),s=Math.sin(y[4]),u=Math.max(-b.center,Math.min(b.length-b.center,-y[0]*c-y[1]*s));return Math.hypot(y[0]+u*c,y[1]+u*s)-EARTH;}
export function cardioLoads(y:CardioState,b:CardioBody,mu=MU){
  const f=motion(y,b,mu),c=Math.cos(y[4]),s=Math.sin(y[4]);let stress=0,minTension=Infinity,transverse=0,rx=0,ry=0,j=b.nodes.length-1;
  for(let i=b.cuts.length-1;i>=0;i--){
    while(j>=0&&b.nodes[j].s>b.cuts[i]){const p=b.nodes[j],u=p.s-b.center;rx+=p.m*(f.ax-u*y[5]**2*c-u*f.alpha*s-f.gravity[j][0]);ry+=p.m*(f.ay-u*y[5]**2*s+u*f.alpha*c-f.gravity[j][1]);j--;}
    const tension=-(rx*c+ry*s);minTension=Math.min(minTension,tension);stress=Math.max(stress,tension/b.areas[i]);transverse=Math.max(transverse,Math.abs(-rx*s+ry*c));
  }return {stress,minTension,transverse};
}
export interface CardioFrame {t:number;state:CardioState;clearance:number;stress:number;tipSpeed:number;phaseErrorDeg:number}
export interface CardioCoast {loaded:boolean;frames:CardioFrame[];status:'complete'|'clearance'|'load'|'compression';duration:number;minClearance:number;peakStress:number;peakTransverse:number;energyDrift:number;angularDrift:number;initialPerigee:number}
export interface CardioResult {model:typeof CARDIO_MODEL;design:CardioDesign;period:number;empty:CardioCoast;loaded:CardioCoast;massT:number;captureEnergyResidual:number;captureAngularResidual:number;tipCaptureSpeed:number}
export function simulateCardio(input:unknown,options:{step?:number;cells?:number}={}):CardioResult {
  const d=validateCardio(input),step=options.step??5,cells=options.cells??48;
  if(!Number.isFinite(step)||step<.25||step>10||!Number.isInteger(cells)||cells<16||cells>192)throw Error('Invalid integration resolution.');
  const empty=cardioBody(d,false,cells),loaded=cardioBody(d,true,cells),initial=cardioInitial(d,empty),after=cardioCapture(initial.state,empty,loaded);
  const coast=(body:CardioBody,start:CardioState,isLoaded:boolean):CardioCoast=>{
    let y=start,t=0,minClearance=Infinity,peakStress=0,peakTransverse=0,energyDrift=0,angularDrift=0,nextSample=0;
    const frames:CardioFrame[]=[],ref=cardioInvariants(y,body);let status:CardioCoast['status']='complete';
    const fault=(q:CardioState)=>{if(cardioClearance(q,body)<CARDIO_CUTOFF)return 'clearance';const l=cardioLoads(q,body);return l.stress>CARDIO_ALLOWABLE?'load':l.minTension< -100?'compression':null;};
    while(true){
      const clearance=cardioClearance(y,body),loads=cardioLoads(y,body),inv=cardioInvariants(y,body),tip=cardioPoint(y,body,body.length);
      minClearance=Math.min(minClearance,clearance);peakStress=Math.max(peakStress,loads.stress);peakTransverse=Math.max(peakTransverse,loads.transverse);
      energyDrift=Math.max(energyDrift,Math.abs(inv.energy-ref.energy)/Math.max(1,Math.abs(ref.energy)));angularDrift=Math.max(angularDrift,Math.abs(inv.angular-ref.angular)/Math.max(1,Math.abs(ref.angular)));
      const fail=fault(y),end=t>=initial.period-1e-7;
      if(t>=nextSample-1e-7||fail||end){const angle=y[4]-(initial.state[4]+d.spinRatio*2*Math.PI*t/initial.period);frames.push({t,state:[...y],clearance,stress:loads.stress,tipSpeed:Math.hypot(tip[2],tip[3]),phaseErrorDeg:angle*180/Math.PI});nextSample=t+initial.period/600;}
      if(fail){status=fail;break;}if(end)break;
      let h=Math.min(step,.01/Math.max(Math.abs(y[5]),1e-9),initial.period-t),yn=cardioStep(y,h,body);
      if(fault(yn)){let lo=0,hi=h;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(fault(cardioStep(y,mid,body)))hi=mid;else lo=mid;}h=hi;yn=cardioStep(y,h,body);}
      t+=h;y=yn;if(!y.every(Number.isFinite)||h<=0)throw Error('CardioRotovator integration failed.');
    }
    return {loaded:isLoaded,frames,status,duration:t,minClearance,peakStress,peakTransverse,energyDrift,angularDrift,initialPerigee:orbit(start.slice(0,4)).perigee};
  };
  const tip=cardioPoint(initial.state,empty,empty.length),cargoMass=d.payloadT*1000,pre=cardioInvariants(initial.state,empty),post=cardioInvariants(after,loaded);
  const cargoEnergy=cargoMass*((tip[2]**2+tip[3]**2)/2-MU/Math.hypot(tip[0],tip[1])),cargoAngular=cargoMass*(tip[0]*tip[3]-tip[1]*tip[2]);
  return {model:CARDIO_MODEL,design:d,period:initial.period,empty:coast(empty,initial.state,false),loaded:coast(loaded,after,true),massT:empty.mass/1000,captureEnergyResidual:post.energy-pre.energy-cargoEnergy,captureAngularResidual:post.angular-pre.angular-cargoAngular,tipCaptureSpeed:Math.hypot(tip[2],tip[3])};
}
export function cardioSample(coast:CardioCoast,t:number):CardioFrame {
  const frames=coast.frames;if(t<=0)return frames[0];if(t>=coast.duration)return frames.at(-1)!;
  let lo=0,hi=frames.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(frames[mid].t<=t)lo=mid;else hi=mid;}
  const a=frames[lo],b=frames[hi],f=(t-a.t)/(b.t-a.t),lerp=(x:number,y:number)=>x+(y-x)*f;
  return {t,state:a.state.map((v,i)=>lerp(v,b.state[i])) as CardioState,clearance:lerp(a.clearance,b.clearance),stress:lerp(a.stress,b.stress),tipSpeed:lerp(a.tipSpeed,b.tipSpeed),phaseErrorDeg:lerp(a.phaseErrorDeg,b.phaseErrorDeg)};
}
