/** T4p: two planar rigid stages joined at an ideal torque-free pivot.
 * Finite distributed masses; no prescribed pivot trajectory or motor torque.
 * Equations and limits: docs/tether-lab/t4-flight-studio.md. SI internally.
 */
import { EARTH, MU, MATERIALS } from './engine.js';
export const T4_MODEL='T4p-0.1.0';
export const T4_CUTOFF=120000, T4_DURATION=7200;
export const T4_HUB=120000, T4_PIVOT=6000, T4_TIP=2000;
export interface T4Design {
  schema:1;model:typeof T4_MODEL;architecture:'t4';
  primaryKm:number;secondaryKm:number;altitudeKm:number;
  primarySpeedKms:number;secondarySpeedKms:number;phaseDeg:number;releaseMin:number;
  primaryAreaMm2:number;secondaryAreaMm2:number;payloadT:number;
  material:'zylon'|'kevlar';safetyFactor:number;
}
export const T4_DEFAULT:T4Design={schema:1,model:T4_MODEL,architecture:'t4',primaryKm:300,secondaryKm:50,altitudeKm:1800,
  primarySpeedKms:1,secondarySpeedKms:.8,phaseDeg:180,releaseMin:2,primaryAreaMm2:150,secondaryAreaMm2:80,payloadT:3,material:'zylon',safetyFactor:2};
export const T4_BOUNDS={primaryKm:[100,800],secondaryKm:[20,200],altitudeKm:[400,4000],primarySpeedKms:[.15,1.5],
  secondarySpeedKms:[-1.5,1.5],phaseDeg:[0,360],releaseMin:[0,30],primaryAreaMm2:[10,1500],secondaryAreaMm2:[5,1000],payloadT:[.1,20],safetyFactor:[1.2,5]} as const;
export function validateT4(raw:unknown):T4Design {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a T4 design.');
  const d=raw as T4Design;
  if(d.schema!==1||d.model!==T4_MODEL||d.architecture!=='t4')throw Error('Open this design in its own experiment. T4 accepts T4p-0.1.0 designs only.');
  if(!['zylon','kevlar'].includes(d.material))throw Error('Unknown fiber profile.');
  const clean:Record<string,unknown>={schema:1,model:T4_MODEL,architecture:'t4',material:d.material};
  for(const [key,[min,max]] of Object.entries(T4_BOUNDS)){
    const n=d[key as keyof typeof T4_BOUNDS];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${key} must be between ${min} and ${max}.`);clean[key]=n;
  }
  if(d.secondaryKm>d.primaryKm/2)throw Error('Each secondary arm must be no longer than half the primary arm.');
  return clean as unknown as T4Design;
}
export function readT4(text:string){if(text.length>6000)throw Error('Design exceeds the 6 KB limit.');return validateT4(JSON.parse(text));}
export const t4Fragment=(d:T4Design)=>`#t4=${encodeURIComponent(JSON.stringify(validateT4(d)))}`;
export type T4State=number[]; // pivot x,y, theta1,theta2, pivot vx,vy, omega1,omega2
export interface Node {stage:0|1;u:number;m:number}
export interface T4Body {nodes:Node[];mass:number;first:number[];inertia:number[];stageMass:number[];cells:number}
export function compileT4(d:T4Design,attached=true,cells=32):T4Body {
  if(!Number.isInteger(cells)||cells<8||cells>128)throw Error('Cable quadrature must use 8–128 cells per arm.');
  const rho=MATERIALS.find(m=>m.id===d.material)!.density,L=d.primaryKm*1000,l=d.secondaryKm*1000;
  const nodes:Node[]=[{stage:0,u:-L,m:T4_HUB},{stage:1,u:0,m:T4_PIVOT},{stage:1,u:-l,m:T4_TIP},{stage:1,u:l,m:T4_TIP}];
  // Two-point Gauss cells integrate uniform cable mass, first moment and inertia
  // exactly. The same nodes approximate gravity and potential consistently.
  for(const stage of [0,1] as const){const start=stage===0?-L:-l,end=stage===0?0:l,n=stage===0?cells:2*cells,du=(end-start)/n,area=(stage===0?d.primaryAreaMm2:d.secondaryAreaMm2)*1e-6;
    for(let i=0;i<n;i++)for(const s of [-1,1])nodes.push({stage,u:start+(i+.5)*du+s*du/(2*Math.sqrt(3)),m:rho*area*du/2});
  }
  if(attached)nodes.push({stage:1,u:l,m:d.payloadT*1000});
  const first=[0,0],inertia=[0,0],stageMass=[0,0];let mass=0;
  for(const p of nodes){mass+=p.m;first[p.stage]+=p.m*p.u;inertia[p.stage]+=p.m*p.u*p.u;stageMass[p.stage]+=p.m;}
  return {nodes,mass,first,inertia,stageMass,cells};
}
export function t4Point(s:T4State,stage:0|1,u:number):number[]{const a=s[2+stage],w=s[6+stage],c=Math.cos(a),z=Math.sin(a);return[s[0]+u*c,s[1]+u*z,s[4]-u*w*z,s[5]+u*w*c];}
export function t4Initial(d:T4Design,b=compileT4(d)):T4State {
  const a=[0,d.phaseDeg*Math.PI/180],w=[d.primarySpeedKms/d.primaryKm,d.secondarySpeedKms/d.secondaryKm],r=EARTH+d.altitudeKm*1000;
  let x=r,y=0,vx=0,vy=Math.sqrt(MU/r);
  for(let i=0;i<2;i++){x-=b.first[i]*Math.cos(a[i])/b.mass;y-=b.first[i]*Math.sin(a[i])/b.mass;vx+=b.first[i]*w[i]*Math.sin(a[i])/b.mass;vy-=b.first[i]*w[i]*Math.cos(a[i])/b.mass;}
  return [x,y,...a,vx,vy,...w];
}
const grav=(x:number,y:number,mu=MU)=>{const r=Math.hypot(x,y),f=-mu/r**3;return [f*x,f*y];};
/** Schur complement of the full 4×4 generalized mass matrix. Angular units are
 * scaled analytically instead of applying an ill-conditioned generic solver. */
export function t4Dynamics(s:T4State,b:T4Body,mu=MU){
  const e=[[Math.cos(s[2]),Math.sin(s[2])],[Math.cos(s[3]),Math.sin(s[3])]],f=[0,0],torque=[0,0];
  const gravity=b.nodes.map(p=>{const g=grav(s[0]+p.u*e[p.stage][0],s[1]+p.u*e[p.stage][1],mu);f[0]+=p.m*g[0];f[1]+=p.m*g[1];torque[p.stage]+=p.m*p.u*(e[p.stage][0]*g[1]-e[p.stage][1]*g[0]);return g;});
  const rhs=[...f];for(let i=0;i<2;i++){rhs[0]+=b.first[i]*s[6+i]**2*e[i][0];rhs[1]+=b.first[i]*s[6+i]**2*e[i][1];}
  const A=b.first,I=b.inertia,M=b.mass,dot=e[0][0]*e[1][0]+e[0][1]*e[1][1];
  const aa=I[0]-A[0]**2/M,bb=I[1]-A[1]**2/M,ab=-A[0]*A[1]*dot/M;
  const q=torque.map((v,i)=>v-A[i]*(-e[i][1]*rhs[0]+e[i][0]*rhs[1])/M),det=aa*bb-ab*ab;
  if(!(det>0))throw Error('Degenerate compound inertia.');
  const alpha=[(bb*q[0]-ab*q[1])/det,(aa*q[1]-ab*q[0])/det];
  const accel=[rhs[0]/M,rhs[1]/M];for(let i=0;i<2;i++){accel[0]+=A[i]*e[i][1]*alpha[i]/M;accel[1]-=A[i]*e[i][0]*alpha[i]/M;}
  return {derivative:[s[4],s[5],s[6],s[7],...accel,...alpha],accel,alpha,gravity,e};
}
export function t4Step(s:T4State,b:T4Body,h:number,mu=MU):T4State {
  const add=(k:number[],f:number)=>s.map((v,i)=>v+h*f*k[i]);const a=t4Dynamics(s,b,mu).derivative,bb=t4Dynamics(add(a,.5),b,mu).derivative,c=t4Dynamics(add(bb,.5),b,mu).derivative,d=t4Dynamics(add(c,1),b,mu).derivative;
  return s.map((v,i)=>v+h*(a[i]+2*bb[i]+2*c[i]+d[i])/6);
}
export function t4Invariants(s:T4State,b:T4Body,cargo:number[]|null=null,payloadKg=0,mu=MU){
  let energy=0,angular=0;const momentum=[0,0],center=[0,0];let mass=0;
  const add=(p:number[],m:number)=>{energy+=m*((p[2]**2+p[3]**2)/2-mu/Math.hypot(p[0],p[1]));angular+=m*(p[0]*p[3]-p[1]*p[2]);momentum[0]+=m*p[2];momentum[1]+=m*p[3];center[0]+=m*p[0];center[1]+=m*p[1];mass+=m;};
  b.nodes.forEach(n=>add(t4Point(s,n.stage,n.u),n.m));if(cargo)add(cargo,payloadKg);
  return {energy,angular,momentum,center:center.map(x=>x/mass),mass};
}
export function segmentAltitude(a:number[],b:number[]){const dx=b[0]-a[0],dy=b[1]-a[1],q=dx*dx+dy*dy,u=q?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/q)):0;return Math.hypot(a[0]+u*dx,a[1]+u*dy)-EARTH;}
export function t4Geometry(s:T4State,d:T4Design){return {hub:t4Point(s,0,-d.primaryKm*1000),pivot:[s[0],s[1],s[4],s[5]],minus:t4Point(s,1,-d.secondaryKm*1000),plus:t4Point(s,1,d.secondaryKm*1000)};}
export interface T4Loads {stress:number[];minTension:number;transverse:number[];pivotForce:number;clearance:number}
export function t4Loads(s:T4State,b:T4Body,d:T4Design):T4Loads {
  const f=t4Dynamics(s,b),reaction=[0,0],cuts:[number,number,number][][]=[[],[]];
  b.nodes.forEach((p,i)=>{const e=f.e[p.stage],w=s[6+p.stage],alpha=f.alpha[p.stage],fx=p.m*(f.accel[0]-p.u*(alpha*e[1]+w*w*e[0])-f.gravity[i][0]),fy=p.m*(f.accel[1]+p.u*(alpha*e[0]-w*w*e[1])-f.gravity[i][1]);
    cuts[p.stage].push([p.u,fx,fy]);if(p.stage===1){reaction[0]+=fx;reaction[1]+=fy;}
  });
  const stress=[0,0],transverse=[0,0];let minTension=Infinity;
  for(const stage of [0,1] as const){const e=f.e[stage],area=(stage===0?d.primaryAreaMm2:d.secondaryAreaMm2)*1e-6,rows=cuts[stage].sort((a,b)=>a[0]-b[0]);
    // Outboard free-body cuts at each quadrature mass, never across the hinge.
    for(const sign of (stage===0?[-1]:[-1,1])){
      const ordered=rows.filter(p=>sign*p[0]>0).sort((a,b)=>sign*(b[0]-a[0]));let fx=0,fy=0;
      for(const p of ordered){fx+=p[1];fy+=p[2];const tension=-sign*(fx*e[0]+fy*e[1]);minTension=Math.min(minTension,tension);stress[stage]=Math.max(stress[stage],tension/area);transverse[stage]=Math.max(transverse[stage],Math.abs(-fx*e[1]+fy*e[0]));}
    }
  }
  const p=t4Geometry(s,d),clearance=Math.min(segmentAltitude(p.hub,p.pivot),segmentAltitude(p.minus,p.plus));
  return {stress,minTension,transverse,pivotForce:Math.hypot(...reaction),clearance};
}
export function t4Orbit(p:number[]){const r=Math.hypot(p[0],p[1]),v2=p[2]**2+p[3]**2,h=p[0]*p[3]-p[1]*p[2],energy=v2/2-MU/r,e=Math.sqrt(Math.max(0,1+2*energy*h*h/MU**2));return{energy,periapsis:h*h/(MU*(1+e))-EARTH,apoapsis:energy<0?-MU/(2*energy)*(1+e)-EARTH:null};}
function particleStep(p:number[],h:number){const rhs=(a:number[])=>[a[2],a[3],...grav(a[0],a[1])],add=(k:number[],f:number)=>p.map((v,i)=>v+h*f*k[i]);const a=rhs(p),b=rhs(add(a,.5)),c=rhs(add(b,.5)),d=rhs(add(c,1));return p.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
export interface T4Frame {t:number;s:T4State;cargo:number[]|null;loads:T4Loads}
export interface T4Result {
  design:T4Design;frames:T4Frame[];outcome:'complete'|'clearance'|'stress'|'compression';reason:string;duration:number;
  release:{t:number;state:number[];orbit:ReturnType<typeof t4Orbit>;closure:{energy:number;angular:number;momentum:number};velocityParts:number[][]}|null;
  peakStress:number[];peakPivotForce:number;peakTransverse:number[];minClearance:number;energyError:number;angularError:number;dryMass:number;
}
export function runT4(input:T4Design,options:{step?:number;cells?:number;duration?:number}={}):T4Result {
  const d=validateT4(input),maxStep=options.step??1,duration=options.duration??T4_DURATION;
  if(!Number.isFinite(maxStep)||maxStep<=0||maxStep>2||!Number.isFinite(duration)||duration<d.releaseMin*60||duration>T4_DURATION)throw Error('Invalid integration limits.');
  const wet=compileT4(d,true,options.cells),dry=compileT4(d,false,options.cells),allowable=MATERIALS.find(m=>m.id===d.material)!.ultimate/d.safetyFactor;
  let b=wet,s=t4Initial(d,b),cargo:number[]|null=null,t=0,nextFrame=0;const reference=t4Invariants(s,b),releaseTime=d.releaseMin*60;
  const result:T4Result={design:d,frames:[],outcome:'complete',reason:'Two-hour trajectory completed.',duration:0,release:null,peakStress:[0,0],peakPivotForce:0,peakTransverse:[0,0],minClearance:Infinity,energyError:0,angularError:0,dryMass:dry.mass};
  const violation=(loads:T4Loads,p:number[]|null):[T4Result['outcome'],string]=>{
    const altitude=p?Math.hypot(p[0],p[1])-EARTH:Infinity;
    if(Math.min(loads.clearance,altitude)<T4_CUTOFF)return ['clearance',altitude<T4_CUTOFF?'Released cargo crosses the 120 km Earth boundary.':'A stage crosses the 120 km Earth boundary.'];
    if(loads.stress.some(v=>v>allowable))return ['stress','A stage exceeds the axial material allowable.'];
    if(loads.minTension< -1)return ['compression','A cable segment needs compression; the straight tether approximation stops.'];
    return ['complete','Two-hour trajectory completed.'];
  };
  const assess=()=>{
    const loads=t4Loads(s,b,d),cargoAlt=cargo?Math.hypot(cargo[0],cargo[1])-EARTH:Infinity;
    result.minClearance=Math.min(result.minClearance,loads.clearance,cargoAlt);result.peakPivotForce=Math.max(result.peakPivotForce,loads.pivotForce);
    for(let i=0;i<2;i++){result.peakStress[i]=Math.max(result.peakStress[i],loads.stress[i]);result.peakTransverse[i]=Math.max(result.peakTransverse[i],loads.transverse[i]);}
    const inv=t4Invariants(s,b,cargo,d.payloadT*1000);result.energyError=Math.max(result.energyError,Math.abs(inv.energy-reference.energy)/Math.abs(reference.energy));result.angularError=Math.max(result.angularError,Math.abs(inv.angular-reference.angular)/Math.abs(reference.angular));
    [result.outcome,result.reason]=violation(loads,cargo);
    return loads;
  };
  let loads=assess();result.frames.push({t,s:[...s],cargo:null,loads});
  while(result.outcome==='complete'){
    if(!result.release&&t>=releaseTime-1e-8){
      const before=t4Invariants(s,b),p=t4Point(s,1,d.secondaryKm*1000);b=dry;cargo=p;
      const after=t4Invariants(s,b,cargo,d.payloadT*1000),first=-wet.first[0]/wet.mass,second=d.secondaryKm*1000-wet.first[1]/wet.mass;
      // Exact decomposition about the loaded system COM: translation plus both
      // stage contributions, using their actual coupled angles and spin rates.
      result.release={t,state:[...p],orbit:t4Orbit(p),closure:{energy:after.energy-before.energy,angular:after.angular-before.angular,momentum:Math.hypot(after.momentum[0]-before.momentum[0],after.momentum[1]-before.momentum[1])},velocityParts:[before.momentum.map(v=>v/wet.mass),[-first*s[6]*Math.sin(s[2]),first*s[6]*Math.cos(s[2])],[-second*s[7]*Math.sin(s[3]),second*s[7]*Math.cos(s[3])]]};
      loads=assess();result.frames.push({t,s:[...s],cargo:[...cargo],loads});if(result.outcome!=='complete')break;
    }
    if(t>=duration-1e-8)break;
    let h=Math.min(maxStep,.02/Math.max(.001,Math.abs(s[6]),Math.abs(s[7])),duration-t,result.release?Infinity:releaseTime-t);
    let next=t4Step(s,b,h),p:number[]|null=cargo?particleStep(cargo,h):null;
    if(violation(t4Loads(next,b,d),p)[0]!=='complete'){
      let lo=0,hi=h;for(let i=0;i<24;i++){const mid=(lo+hi)/2,q=t4Step(s,b,mid),c=cargo?particleStep(cargo,mid):null;violation(t4Loads(q,b,d),c)[0]==='complete'?lo=mid:hi=mid;}
      h=hi;next=t4Step(s,b,h);p=cargo?particleStep(cargo,h):null;
    }
    s=next;cargo=p;t+=h;loads=assess();
    if(t>=nextFrame||t>=duration-1e-8||result.outcome!=='complete'||(!result.release&&t>=releaseTime-1e-8)){
      result.frames.push({t,s:[...s],cargo:cargo?[...cargo]:null,loads});nextFrame=t+10;
    }
  }
  result.duration=t;return result;
}
export function t4Gates(r:T4Result){return [r.outcome==='complete'&&r.duration===T4_DURATION,!!r.release&&r.release.orbit.periapsis>=T4_CUTOFF,!!r.release&&r.release.orbit.apoapsis!==null&&r.release.orbit.apoapsis>=8000000&&r.release.orbit.apoapsis<=12000000];}
export function t4Summary(r:T4Result){return {design:r.design,outcome:r.outcome,apoapsis:r.release?.orbit.apoapsis??null,periapsis:r.release?.orbit.periapsis??null,released:!!r.release,pass:t4Gates(r).every(Boolean),peakStress:r.peakStress};}
export function t4Sample(r:T4Result,t:number):T4Frame {
  let lo=0,hi=r.frames.length-1;
  while(hi-lo>1){const m=(hi+lo)>>1;r.frames[m].t>t?hi=m:lo=m;}
  while(lo<r.frames.length-1&&r.frames[lo+1].t<=t)lo++;
  const a=r.frames[lo],b=r.frames[Math.min(lo+1,r.frames.length-1)],dt=b.t-a.t;
  if(dt<=0||t<=a.t)return a;
  const u=(t-a.t)/dt,u2=u*u,u3=u2*u;
  const hermite=(x:number[],y:number[],n:number)=>Array.from({length:2*n},(_,i)=>{const k=i%n;return i<n?(2*u3-3*u2+1)*x[k]+(u3-2*u2+u)*dt*x[k+n]+(-2*u3+3*u2)*y[k]+(u3-u2)*dt*y[k+n]:(6*u2-6*u)/dt*x[k]+(3*u2-4*u+1)*x[k+n]+(-6*u2+6*u)/dt*y[k]+(3*u2-2*u)*y[k+n];});
  return {t,s:hermite(a.s,b.s,4),cargo:a.cargo&&b.cargo?hermite(a.cargo,b.cargo,2):a.cargo,loads:a.loads};
}
