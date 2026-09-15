/** G1: a fixed-mass, freely coasting, asymmetric rigid tether.
 * SI units. Hardware coordinates originate at the hub; the propagated state is
 * the mass centroid. No capture, propulsion, flexible cable or atmosphere.
 * D1p and OPS contracts/controllers are intentionally left unchanged.
 */
import { EARTH, MU, MATERIALS, gravity } from './engine.js';
export const GEOMETRY_MODEL = 'G1-0.1.0';
export interface GeometryDesign {
  schema: 1; model: typeof GEOMETRY_MODEL; material: string;
  density: number; ultimateGPa: number; safetyFactor: number;
  armAKm: number; armBKm: number; hubT: number; endAT: number; endBT: number;
  areaMm2: number; shape: 'uniform' | 'tapered';
  perigeeKm: number; apogeeKm: number; anomalyDeg: number; attitudeDeg: number;
  spinPeriodMin: number; turns: number;
}
export const GEOMETRY_DEFAULT: GeometryDesign = {
  schema: 1, model: GEOMETRY_MODEL, material: 'zylon', density: 1500,
  ultimateGPa: 6, safetyFactor: 2, armAKm: 300, armBKm: 300, hubT: 30,
  endAT: 2, endBT: 2, areaMm2: 80, shape: 'uniform', perigeeKm: 1600,
  apogeeKm: 1600, anomalyDeg: 0, attitudeDeg: 180,
  spinPeriodMin: 2 * Math.PI / .004 / 60, turns: 1,
};
export const GEOMETRY_PRESETS: {name: string; description: string; design: GeometryDesign}[] = [
  {name: 'Symmetric reference', description: 'Equal arms. The original dry structure.', design: GEOMETRY_DEFAULT},
  {name: 'Unequal arms', description: 'A long reach opposite a short, heavier end.', design: {...GEOMETRY_DEFAULT, armAKm: 100, armBKm: 500, endAT: 40, areaMm2: 180, perigeeKm: 2000, apogeeKm: 2000, spinPeriodMin: 50}},
  {name: 'Elliptical explorer', description: 'Watch radius, speed and spin change together.', design: {...GEOMETRY_DEFAULT, armAKm: 100, armBKm: 400, endAT: 40, areaMm2: 120, perigeeKm: 1500, apogeeKm: 6000, spinPeriodMin: 40}},
];
export const GEOMETRY_BOUNDS = {
  density: [500,12000], ultimateGPa: [.1,100], safetyFactor: [1.2,5],
  armAKm: [10,3000], armBKm: [10,3000], hubT: [0,500], endAT: [.1,500], endBT: [.1,500],
  areaMm2: [5,2500], perigeeKm: [200,30000], apogeeKm: [200,50000],
  anomalyDeg: [0,360], attitudeDeg: [0,360], spinPeriodMin: [4,240], turns: [.25,2],
} as const;
export type GeometryNumberKey = keyof typeof GEOMETRY_BOUNDS;
export function validateGeometry(input: unknown): GeometryDesign {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('A geometry design must be an object.');
  const d = input as Record<string, unknown>;
  if (d.schema !== 1 || d.model !== GEOMETRY_MODEL) throw Error('Use a G1 geometry design. Flight Studio and Operations files have different models; nothing has been converted.');
  if (!MATERIALS.some(m => m.id === d.material) || !['uniform','tapered'].includes(String(d.shape))) throw Error('Unknown material or section profile.');
  const clean: Record<string, unknown> = {schema: 1, model: GEOMETRY_MODEL, material: d.material, shape: d.shape};
  for (const [key, [lo, hi]] of Object.entries(GEOMETRY_BOUNDS)) {
    if (typeof d[key] !== 'number' || !Number.isFinite(d[key]) || Number(d[key]) < lo || Number(d[key]) > hi) throw Error(`${key} must be between ${lo} and ${hi}.`);
    clean[key] = d[key];
  }
  const v = clean as unknown as GeometryDesign;
  if (v.armAKm + v.armBKm > 4000) throw Error('Combined arm length must not exceed 4,000 km. Neither arm was changed.');
  if (v.apogeeKm < v.perigeeKm) throw Error('Apogee must be at least perigee. The orbit was not silently made circular.');
  if (orbitReference(v).periodS * v.turns > 86400) throw Error('Reduce the observation length: this combination exceeds 24 simulated hours.');
  return v;
}
export function readGeometry(text: string): GeometryDesign {
  if (text.length > 16000) throw Error('Geometry file exceeds 16 KB.');
  return validateGeometry(JSON.parse(text));
}
export function geometryFragment(d: GeometryDesign): string { return '#g=' + encodeURIComponent(JSON.stringify(validateGeometry(d))); }
export function materialProperties(d: GeometryDesign) {
  const m = MATERIALS.find(m => m.id === d.material);
  if (!m) throw Error('Unknown material.');
  return {density: d.material === 'custom' ? d.density : m.density,
    allowable: (d.material === 'custom' ? d.ultimateGPa * 1e9 : m.ultimate) / d.safetyFactor};
}
export interface MassCell {s: number; m: number}
export interface GeometryBody {
  points: MassCell[]; mass: number; center: number; inertia: number;
  structuralMass: number; min: number; max: number; cells: number;
}
export function areaAt(d: GeometryDesign, s: number): number {
  const length = (s < 0 ? d.armAKm : d.armBKm) * 1000;
  return d.areaMm2 * 1e-6 * (d.shape === 'uniform' ? 1 : 1 - .7 * (s / length) ** 2);
}
export function compileGeometry(d: GeometryDesign, cells = 48): GeometryBody {
  if (!Number.isInteger(cells) || cells < 24 || cells > 192) throw Error('Use 24–192 quadrature cells.');
  const min = -d.armAKm * 1000, max = d.armBKm * 1000, {density} = materialProperties(d);
  const points: MassCell[] = [];
  // At least four cable cells per arm; never integrate across the hub's change
  // in taper scale. This reduces exactly to D1p's even, equal-arm quadrature.
  const countA = Math.max(4, Math.min(cells - 4, Math.round(cells * (-min) / (max - min))));
  for (const [start, length, count] of [[min,-min,countA], [0,max,cells-countA]]) {
    const ds = length / count;
    for (let i = 0; i < count; i++) { const s = start + (i + .5) * ds; points.push({s, m: density * areaAt(d,s) * ds}); }
  }
  const structuralMass = points.reduce((sum,p) => sum + p.m, 0);
  points.push({s:min,m:d.endAT*1000}, {s:0,m:d.hubT*1000}, {s:max,m:d.endBT*1000});
  points.sort((a,b) => a.s-b.s);
  const mass = points.reduce((sum,p) => sum+p.m, 0), center = points.reduce((sum,p) => sum+p.m*p.s, 0)/mass;
  return {points,mass,center,inertia:points.reduce((sum,p) => sum+p.m*(p.s-center)**2,0),structuralMass,min,max,cells};
}
export function orbitReference(d: GeometryDesign) {
  const rp=EARTH+d.perigeeKm*1000, ra=EARTH+d.apogeeKm*1000, a=(rp+ra)/2, e=(ra-rp)/(ra+rp), p=a*(1-e*e);
  return {rp,ra,a,e,p,periodS:2*Math.PI*Math.sqrt(a**3/MU)};
}
export function initialGeometry(d: GeometryDesign): number[] {
  const {e,p}=orbitReference(d), nu=d.anomalyDeg*Math.PI/180, r=p/(1+e*Math.cos(nu)), v=Math.sqrt(MU/p);
  return [r*Math.cos(nu),r*Math.sin(nu),-v*Math.sin(nu),v*(e+Math.cos(nu)),nu+d.attitudeDeg*Math.PI/180,2*Math.PI/(d.spinPeriodMin*60)];
}
export function geometryPoint(y: number[], b: GeometryBody, s: number): number[] {
  const q=s-b.center, c=Math.cos(y[4]), z=Math.sin(y[4]);
  return [y[0]+q*c,y[1]+q*z,y[2]-y[5]*q*z,y[3]+y[5]*q*c];
}
export function geometryForces(y: number[], b: GeometryBody) {
  const c=Math.cos(y[4]), s=Math.sin(y[4]); let fx=0,fy=0,torque=0;
  const g=b.points.map(p => {const q=p.s-b.center,[gx,gy]=gravity(y[0]+q*c,y[1]+q*s);
    fx+=p.m*gx;fy+=p.m*gy;torque+=p.m*q*(c*gy-s*gx);return [gx,gy];});
  return {ax:fx/b.mass,ay:fy/b.mass,alpha:torque/b.inertia,g};
}
export function geometryDerivative(y: number[], b: GeometryBody): number[] {
  const f=geometryForces(y,b); return [y[2],y[3],f.ax,f.ay,y[5],f.alpha];
}
export function geometryStep(y: number[], h: number, b: GeometryBody): number[] {
  const f=(v:number[])=>geometryDerivative(v,b),a=f(y),c=f(y.map((v,i)=>v+h*a[i]/2)),e=f(y.map((v,i)=>v+h*c[i]/2)),g=f(y.map((v,i)=>v+h*e[i]));
  return y.map((v,i)=>v+h*(a[i]+2*c[i]+2*e[i]+g[i])/6);
}
export function geometryInvariants(y: number[], b: GeometryBody) {
  let energy=0,angular=0;
  for (const p of b.points) {const v=geometryPoint(y,b,p.s);energy+=p.m*((v[2]**2+v[3]**2)/2-MU/Math.hypot(v[0],v[1]));angular+=p.m*(v[0]*v[3]-v[1]*v[2]);}
  return {energy,angular};
}
export function geometryClearance(y: number[], b: GeometryBody): number {
  const a=geometryPoint(y,b,b.min),z=geometryPoint(y,b,b.max),dx=z[0]-a[0],dy=z[1]-a[1];
  const u=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy)));
  return Math.hypot(a[0]+dx*u,a[1]+dy*u)-EARTH;
}
export interface GeometryCut {s: number; area: number; tension: number; stress: number}
export function geometryLoads(y: number[], b: GeometryBody, d: GeometryDesign) {
  const f=geometryForces(y,b),c=Math.cos(y[4]),s=Math.sin(y[4]),cuts:GeometryCut[]=[];
  let axial=0,stress=0,minTension=0,peak=0;
  for (let i=0;i<b.points.length-1;i++) {
    const p=b.points[i],q=p.s-b.center;
    axial+=p.m*((f.ax-y[5]**2*q*c-f.alpha*q*s-f.g[i][0])*c+(f.ay-y[5]**2*q*s+f.alpha*q*c-f.g[i][1])*s);
    // Tension is constant between these lumped quadrature points. For a
    // tapered section use the smaller boundary area, not the gap midpoint:
    // a heavy terminal's peak can occur exactly at the thinnest tip.
    const next=b.points[i+1].s;
    const at=d.shape==='uniform'?(p.s+next)/2:areaAt(d,p.s)<=areaAt(d,next)?p.s:next;
    const area=areaAt(d,at),load=axial/area;
    cuts.push({s:at,area,tension:axial,stress:load});minTension=Math.min(minTension,axial);
    if (load>stress) {stress=load;peak=at;}
  }
  return {cuts,stress,peak,minTension,margin:stress>0?materialProperties(d).allowable/stress:999};
}
export interface GeometryFrame {t:number;state:number[];clearance:number;margin:number;energy:number;angular:number}
export interface GeometryResult {
  model:typeof GEOMETRY_MODEL;design:GeometryDesign;body:GeometryBody;frames:GeometryFrame[];
  outcome:'observed'|'limit';reason:string;minClearance:number;minMargin:number;
  maxEnergyError:number;maxAngularError:number;initialEnergy:number;initialAngular:number;
  step:number;requestedSeconds:number;
}
export function simulateGeometry(input:unknown, options:{step?:number;cells?:number;progress?:(fraction:number)=>void}={}):GeometryResult {
  const d=validateGeometry(input), step=options.step??2, cells=options.cells??48;
  if (!Number.isFinite(step)||step<.25||step>4) throw Error('Numerical step must be 0.25–4 seconds.');
  const b=compileGeometry(d,cells),duration=orbitReference(d).periodS*d.turns;
  let y=initialGeometry(d),t=0,nextSave=0,nextProgress=0;
  let outcome:'observed'|'limit'='observed',reason='The observation reached its end without crossing a checked axial-load or clearance limit. This is not a delivery or hardware qualification.';
  let minClearance=Infinity,minMargin=Infinity,maxEnergyError=0,maxAngularError=0;
  const baseline=geometryInvariants(y,b),frames:GeometryFrame[]=[];
  const check=(v:number[])=>{
    if (v.some(n=>!Number.isFinite(n))) throw Error('Non-finite geometry state; calculation stopped.');
    const low=geometryClearance(v,b),load=geometryLoads(v,b,d);
    const reason=low<120000?'The cable crossed the 120 km model cutoff; atmosphere is not modeled.':load.margin<1?'The cable exceeded the chosen axial allowable; breakage is not simulated.':load.minTension < -100?'A section would require compression; the taut-cable approximation no longer applies.':'';
    return {low,load,reason};
  };
  while (t<=duration+1e-8) {
    const {low,load,reason:failure}=check(y),inv=geometryInvariants(y,b);
    minClearance=Math.min(minClearance,low);minMargin=Math.min(minMargin,load.margin);
    maxEnergyError=Math.max(maxEnergyError,Math.abs(inv.energy-baseline.energy));
    maxAngularError=Math.max(maxAngularError,Math.abs(inv.angular-baseline.angular));
    if (t>=nextSave-1e-8||failure||t>=duration-1e-8) {frames.push({t,state:[...y],clearance:low,margin:load.margin,...inv});nextSave=t+15;}
    if (failure) {outcome='limit';reason=failure;break;}
    if (t>=duration-1e-8) break;
    if (t>=nextProgress) {options.progress?.(t/duration);nextProgress=t+300;}
    let h=Math.min(step,duration-t),next=geometryStep(y,h,b);
    if (check(next).reason) {let lo=0,hi=h;for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(check(geometryStep(y,mid,b)).reason)hi=mid;else lo=mid;}h=hi;next=geometryStep(y,h,b);}
    if (h<=0 || !Number.isFinite(h)) throw Error('Coast event step stalled.');
    y=next;t+=h;
  }
  options.progress?.(1);
  return {model:GEOMETRY_MODEL,design:d,body:b,frames,outcome,reason,minClearance,minMargin,maxEnergyError,maxAngularError,initialEnergy:baseline.energy,initialAngular:baseline.angular,step,requestedSeconds:duration};
}
/** Replay states never feed back into the solver. Reintegrate from the previous
 * recorded frame, instead of drawing a chord through a curved coast trajectory. */
export function sampleGeometry(r:GeometryResult,t:number):GeometryFrame {
  if (!Number.isFinite(t)) throw Error('Replay time must be finite.');
  t=Math.max(0,Math.min(t,r.frames.at(-1)!.t));let lo=0,hi=r.frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.frames[mid].t<=t)lo=mid;else hi=mid-1;}
  const f=r.frames[lo];if(Math.abs(t-f.t)<1e-8)return f;
  let y=[...f.state],time=f.t;while(time<t-1e-8){const h=Math.min(r.step,t-time);y=geometryStep(y,h,r.body);time+=h;}
  return {t,state:y,clearance:geometryClearance(y,r.body),margin:geometryLoads(y,r.body,r.design).margin,...geometryInvariants(y,r.body)};
}
