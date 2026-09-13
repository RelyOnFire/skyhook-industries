/** OPS-0.1: finite operations on the unchanged D1p-0.4 rigid-body core.
 * SI units. Finite manifest, explicit ideal encounters, no state/fuel resets.
 * Arrival windows are immutable; arrival ORBITS are still constructed, not
 * autonomously targeted from pre-existing departure orbits. See ops Method.
 */
import { DEFAULT, EDT_PRESET, MODEL, EARTH, MU, TAU, validate, compile, initial,
  forces, pointState, particleStep, reframe, invariants, orbit,
  clearance, loadCheck, ready, rendezvousResidual, type Design, type State } from './engine.js';
export const OPS_MODEL = 'OPS-0.1.0';
export type Direction = 'outbound' | 'inbound';
export interface Shipment { id:string; direction:Direction; massT:number; atMinutes:number }
export interface OpsPlan {
  schema:1; model:typeof OPS_MODEL; design:Design; mode:'capacity'|'schedule';
  assistance:'immediate'|'after-return'; horizonHours:number; windowMinutes:number;
  outboundPhase:number; inboundPhase:number; minOutboundApogeeKm:number; maxInboundApogeeKm:number;
  manifest:Shipment[];
}
export type Status = 'queued'|'reserved'|'approach'|'attached'|'delivered'|'returned'|'invalid-release'|'missed'|'unserved';
export interface Encounter { start:number; capture:number; initialState:number[]; positionErrorM?:number; velocityErrorMs?:number; accepted?:boolean }
export interface ShipmentResult extends Shipment {
  status:Status; reason:string; encounter?:Encounter; releasedAt?:number;
  capturedState?:number[]; releasedState?:number[]; energyGainJ?:number; angularGain?:number;
  perigeeKm?:number; apogeeKm?:number|null; eventEnergyResidualJ?:number; eventAngularResidual?:number;
}
export interface Cargo { id:string; phase:'approach'|'attached'|'released'|'flyby'|'cutoff'; state:number[] }
export interface OpsEvent { t:number; kind:string; title:string; detail:string; shipmentId?:string }
export interface OpsFrame {
  t:number; state:State; attachedId:string|null; cargo:Cargo[]; powered:boolean;
  clearanceM:number; margin:number; outbound:number; inbound:number; missed:number;
  dryEnergyJ:number; dryAngular:number; orbitEnergyJ:number; spinEnergyJ:number; spinAngular:number;
  energyResidualJ:number; angularResidual:number;
}
export interface OpsResult {
  model:typeof OPS_MODEL; core:typeof MODEL; plan:OpsPlan; rows:ShipmentResult[];
  frames:OpsFrame[]; events:OpsEvent[]; stop:'horizon'|'limit'; reason:string; stepSeconds:number; cells:number;
  initialDryEnergyJ:number; initialDryAngular:number; dryMassKg:number;
  outbound:number; inbound:number; missed:number; unserved:number; fuelUsedKg:number; busEnergyJ:number;
  actuatorWorkJ:number; actuatorAngular:number; exhaustEnergyJ:number; exhaustAngular:number;
  importedEnergyJ:number; exportedEnergyJ:number; importedAngular:number; exportedAngular:number;
  energyResidualJ:number; angularResidual:number; maxEnergyResidualJ:number; maxAngularResidual:number;
  minClearanceM:number; minMargin:number;
}
export function makeManifest(outbound:number,inbound:number,massT:number,interval=90):Shipment[] {
  if(!Number.isInteger(outbound)||!Number.isInteger(inbound)||outbound<0||inbound<0||outbound>10||inbound>10||outbound+inbound<1||!Number.isFinite(massT)||massT<.1||massT>250||!Number.isFinite(interval)||interval<1||interval>144)throw Error('Choose 1–20 total shipments, at most 10 each way, with finite mass and interval.');
  const rows:Shipment[]=[];
  for(let i=0;i<Math.max(outbound,inbound);i++) {
    if(i<outbound)rows.push({id:`OUT-${String(i+1).padStart(2,'0')}`,direction:'outbound',massT,atMinutes:2+i*interval});
    if(i<inbound)rows.push({id:`IN-${String(i+1).padStart(2,'0')}`,direction:'inbound',massT,atMinutes:2+(i+.5)*interval});
  }
  return rows;
}
export const OPS_DEFAULT:OpsPlan={schema:1,model:OPS_MODEL,design:{...DEFAULT,fuelT:40},mode:'capacity',assistance:'after-return',horizonHours:12,windowMinutes:8,outboundPhase:180,inboundPhase:90,minOutboundApogeeKm:5000,maxInboundApogeeKm:6000,manifest:makeManifest(6,0,3)};
export const OPS_PRESETS = [
  {id:'service',title:'Keep flying',detail:'Six outbound shipments. One finite tank.',plan:OPS_DEFAULT},
  {id:'traffic',title:'Make the return trip count',detail:'Six loads each way. No powered recovery.',plan:{...OPS_DEFAULT,design:{...DEFAULT,recovery:'none' as const,fuelT:0},manifest:makeManifest(6,6,3)}},
  {id:'electrical',title:'Power a longer shift',detail:'Ten small shipments. Electrical hardware included.',plan:{...OPS_DEFAULT,design:{...EDT_PRESET},outboundPhase:180,minOutboundApogeeKm:2000,manifest:makeManifest(10,0,.5,60)}},
];
export function validateOps(input:unknown):OpsPlan {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('An operations plan must be an object.');
  const p=input as OpsPlan;
  if(p.schema!==1||p.model!==OPS_MODEL)throw Error('Unsupported operations version. No old result was reused.');
  const design=validate(p.design);
  if(!['capacity','schedule'].includes(p.mode)||!['immediate','after-return'].includes(p.assistance))throw Error('Unknown scheduler or assistance policy.');
  for(const [key,lo,hi] of [['horizonHours',.25,24],['windowMinutes',.5,30],['outboundPhase',70,210],['inboundPhase',40,180],['minOutboundApogeeKm',120,100000],['maxInboundApogeeKm',120,100000]] as [keyof OpsPlan,number,number][])
    if(typeof p[key]!=='number'||!Number.isFinite(p[key])||Number(p[key])<lo||Number(p[key])>hi)throw Error(`${key} must be between ${lo} and ${hi}.`);
  if(!Array.isArray(p.manifest)||!p.manifest.length||p.manifest.length>20)throw Error('Use a finite manifest of 1–20 shipments.');
  const ids=new Set<string>();
  const manifest=p.manifest.map(row=>{
    if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[A-Za-z0-9-]{1,16}$/.test(row.id)||ids.has(row.id))throw Error('Shipment IDs must be unique letters, numbers or hyphens (1–16 characters).');
    ids.add(row.id);
    if(!['outbound','inbound'].includes(row.direction))throw Error('Unknown shipment direction.');
    if(!Number.isFinite(row.massT)||row.massT<.1||row.massT>250)throw Error('Every shipment mass must be 0.1–250 t.');
    if(!Number.isFinite(row.atMinutes)||row.atMinutes<0||row.atMinutes>1440)throw Error('Window centers must be 0–1,440 minutes.');
    return {id:row.id,direction:row.direction,massT:row.massT,atMinutes:row.atMinutes};
  });
  if(p.mode==='schedule'&&manifest.some((r,i)=>i>0&&r.atMinutes<manifest[i-1].atMinutes))throw Error('Put scheduled rows in chronological order. Edit times or regenerate the manifest.');
  return {schema:1,model:OPS_MODEL,design,mode:p.mode,assistance:p.assistance,horizonHours:p.horizonHours,windowMinutes:p.windowMinutes,outboundPhase:p.outboundPhase,inboundPhase:p.inboundPhase,minOutboundApogeeKm:p.minOutboundApogeeKm,maxInboundApogeeKm:p.maxInboundApogeeKm,manifest};
}
export function readOps(text:string):OpsPlan {if(text.length>32000)throw Error('Operations input exceeds 32 KB.');return validateOps(JSON.parse(text));}
export function opsFragment(p:OpsPlan):string{return '#ops='+encodeURIComponent(JSON.stringify(validateOps(p)));}
export function unpoweredCopy(p:OpsPlan):OpsPlan {
  if(p.design.recovery!=='electrodynamic')throw Error('Load an electrical plan to compare the same hardware without power.');
  return validateOps({...p,design:{...p.design,edPowerKw:0}});
}
export function qualifies(s:Shipment,gain:number,apogee:number|null,perigee:number,p:OpsPlan):boolean {
  if(perigee<120||apogee===null)return false;
  return s.direction==='outbound'?gain>0&&apogee>=p.minOutboundApogeeKm:gain<0&&apogee<=p.maxInboundApogeeKm;
}
// Core slots 0–11 retained. Extra integrals: mechanical actuator work (12),
// external angular impulse (13), signed removed-fuel energy (14)/momentum (15).
export function opsDerivative(y:State,d:Design,loaded:boolean,on:boolean,cells:number):State {
  const b=compile(d,y[6],loaded,cells),f=forces(y,b,d,on),hub=pointState(y,b,0);
  return [y[2],y[3],f.ax,f.ay,y[5],f.alpha,-f.flow,(y[0]*y[3]-y[1]*y[2])/(y[0]**2+y[1]**2),f.electrical?.busW??0,f.electrical?.mechanicalW??0,f.electrical?.heatW??0,f.electrical?.environmentW??0,y[2]*f.tx+y[3]*f.ty+y[5]*f.tt,y[0]*f.ty-y[1]*f.tx+f.tt,
    f.flow*orbit(hub).energy,f.flow*(hub[0]*hub[3]-hub[1]*hub[2])];
}
export function opsStep(y:State,h:number,d:Design,loaded=false,on=false,cells=48):State {
  const f=(z:State)=>opsDerivative(z,d,loaded,on,cells);
  const a=f(y),b=f(y.map((v,i)=>v+h*a[i]/2)),c=f(y.map((v,i)=>v+h*b[i]/2)),e=f(y.map((v,i)=>v+h*c[i]));
  return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+e[i])/6);
}
const phase=(y:State)=>y[4]-y[7];
const angular=(p:number[])=>p[0]*p[3]-p[1]*p[2];
function limit(y:State,d:Design,loaded:boolean,on:boolean,cells:number,observe?:(clearanceM:number,margin:number)=>void):string|null {
  if(y.some(v=>!Number.isFinite(v)))throw Error('Non-finite state. Operations stopped.');
  const b=compile(d,y[6],loaded,cells),l=loadCheck(y,b,d,on);
  const low=clearance(y,b);observe?.(low,l.margin);
  if(low<120000)return 'Part of the tether crossed the 120 km model cutoff.';
  if(l.margin<1)return 'The strength tether exceeded its assumed axial allowable.';
  if(l.minTension<-100)return 'A cable section requires compression. The rigid taut-cable model stops here.';
  return null;
}
/** Forecast coast only. Scheduled window never moves; arrival orbit IS constructed.
 * A full 90-second approach is required for every shipment. */
export function forecast(y:State,d:Design,s:Shipment,now:number,step:number,cells:number,earliest:number,deadline:number):Encounter|null {
  if(deadline-now<90)return null;
  const base=s.direction==='outbound'?Math.PI:0;
  let target=base+TAU*(Math.floor((phase(y)-base)/TAU)+1),v=[...y],dt=0,nextCheck=0;
  const budget=Math.min(deadline-now,7200);
  for(let count=0;dt<budget-1e-8&&count<15000;count++) {
    let h=Math.min(step,budget-dt),n=opsStep(v,h,d,false,false,cells);
    if(phase(v)<target&&phase(n)>=target){let lo=0,hi=h;for(let k=0;k<25;k++){const mid=(lo+hi)/2;if(phase(opsStep(v,mid,d,false,false,cells))>=target)hi=mid;else lo=mid;}h=hi;n=opsStep(v,h,d,false,false,cells);}
    dt+=h;v=n;
    if(dt>=nextCheck){if(limit(v,d,false,false,cells))return null;nextCheck=dt+30;}
    if(phase(v)>=target-1e-8){
      if(now+dt>=earliest-1e-6&&dt>=90-1e-6){
        if(s.direction==='outbound'&&!ready(v,d))return null;
        let incoming=pointState(v,compile(d,v[6],false,cells),d.spanKm*500);
        for(let back=0;back<90;){const h=Math.min(step,90-back);incoming=particleStep(incoming,-h);back+=h;if(Math.hypot(incoming[0],incoming[1])<EARTH+120000)return null;}
        return {start:now+dt-90,capture:now+dt,initialState:incoming};
      }
      target+=TAU;
    }
  }
  return null;
}

export function simulateOps(input:unknown,options:{step?:number;cells?:number;progress?:(fraction:number)=>void}={}):OpsResult {
  const p=validateOps(input),d=p.design,step=options.step??2,cells=options.cells??48,horizon=p.horizonHours*3600;
  if(!Number.isFinite(step)||step<.5||step>4||!Number.isInteger(cells)||cells<24||cells>192)throw Error('Invalid operations integration budget.');
  const w=d.tipSpeedKms*1000/(d.spanKm*500),n=Math.sqrt(MU/(EARTH+d.altitudeKm*1000)**3);
  if(w-n<=Math.sqrt(3)*n)throw Error('This operations model needs continuous prograde rotation. Increase spin speed, shorten span or raise altitude.');
  const rows:ShipmentResult[]=p.manifest.map(s=>({...s,status:'queued',reason:''})),frames:OpsFrame[]=[],events:OpsEvent[]=[];
  let y=[...initial(d),0,0,0,0];
  for(let back=0;back<90;){const h=Math.min(step,90-back);y=opsStep(y,-h,d,false,false,cells);back+=h;}
  // The experiment begins 90 seconds before the supplied initial radial state.
  let t=0,attached:ShipmentResult|null=null,reserved:ShipmentResult|null=null,incoming:number[]|null=null;
  let powered=false,stable=0,nextDecision=0,nextSample=0,nextProgress=0,releasePhase=Infinity;
  let stop:'horizon'|'limit'='horizon',reason='Observation horizon reached. A finite run is not proof of indefinite service.';
  const free:Cargo[]=[];
  let importedE=0,exportedE=0,importedH=0,exportedH=0,maxER=0,maxHR=0,minC=Infinity,minM=Infinity;
  const initialInventory=invariants(y,compile(d,y[6],false,cells));
  const dry=compile(d,0,false,cells),initialDry=invariants(y,dry);
  const workingDesign=():Design=>attached?{...d,payloadT:attached.massT}:d;
  const emit=(kind:string,title:string,detail:string,shipmentId?:string)=>events.push({t,kind,title,detail,...(shipmentId?{shipmentId}:{})});
  const totals=()=>({outbound:rows.filter(r=>r.status==='delivered').length,inbound:rows.filter(r=>r.status==='returned').length,missed:rows.filter(r=>r.status==='missed').length});
  const save=()=>{
    const active=workingDesign(),body=compile(active,y[6],!!attached,cells),load=loadCheck(y,body,active,powered),low=clearance(y,body);
    minC=Math.min(minC,low);minM=Math.min(minM,load.margin);
    const inventory=invariants(y,body),dryState=reframe(y,body,dry),dryNow=invariants(dryState,dry);
    const er=inventory.energy-initialInventory.energy-importedE+exportedE-y[12]+y[14];
    const hr=inventory.angular-initialInventory.angular-importedH+exportedH-y[13]+y[15];
    maxER=Math.max(maxER,Math.abs(er));maxHR=Math.max(maxHR,Math.abs(hr));
    const cargo=free.map(c=>({...c,state:[...c.state]}));
    if(reserved&&incoming)cargo.push({id:reserved.id,phase:'approach',state:[...incoming]});
    if(attached)cargo.push({id:attached.id,phase:'attached',state:pointState(y,body,body.half)});
    frames.push({t,state:[...y],attachedId:attached?.id??null,cargo,powered,clearanceM:low,margin:load.margin,...totals(),
      dryEnergyJ:dryNow.energy,dryAngular:dryNow.angular,orbitEnergyJ:dry.mass*orbit(dryState).energy,
      spinEnergyJ:.5*dry.inertia*y[5]**2,spinAngular:dry.inertia*y[5],energyResidualJ:er,angularResidual:hr});
  };
  emit('start','Start a finite shift',p.mode==='capacity'?'Queue order is fixed; dispatch occurs when the facility can accept the next ideal encounter.':'Arrival windows are fixed before propagation. Missed windows are not moved. Arrival orbits remain constructed ideal examples.');
  save();
  for(let iterations=0;t<=horizon+1e-8&&iterations<250000;iterations++) {
    const active=workingDesign();
    const violation=limit(y,active,!!attached,powered,cells,(low,margin)=>{minC=Math.min(minC,low);minM=Math.min(minM,margin);});
    if(violation){stop='limit';reason=violation;emit('limit','Operations stopped at a model limit',violation);save();break;}
    // Expire queued rows even while a different shipment occupies the tether.
    if(p.mode==='schedule')for(const row of rows){
      if(row.status==='queued'&&t>=(row.atMinutes+p.windowMinutes)*60-1e-7){
        row.status='missed';row.reason=attached?'The capture window closed while the tether carried another shipment.':'No qualified encounter was reserved inside the original capture window.';
        emit('miss',`${row.id} missed its window`,row.reason,row.id);save();
      }
    }
    if(reserved&&reserved.encounter&&!incoming&&t>=reserved.encounter.start-1e-7){
      save();incoming=[...reserved.encounter.initialState];reserved.status='approach';
      emit('approach',`${reserved.id} approaching`,`A distinct ${reserved.direction} shipment follows an independently propagated 90-second approach. The orbit was constructed; no launch or guidance is modeled.`,reserved.id);save();
    }
    if(reserved&&reserved.encounter&&t>=reserved.encounter.capture-1e-7){
      if(!incoming)throw Error('No incoming particle for this encounter.');
      const row=reserved,b=compile(d,y[6],false,cells),tip=pointState(y,b,b.half),check=rendezvousResidual(tip,incoming);
      const inside=p.mode==='capacity'||(t>=Math.max(0,row.atMinutes-p.windowMinutes)*60-1e-6&&t<=(row.atMinutes+p.windowMinutes)*60+1e-6);
      const accepted=check.matched&&inside&&(row.direction==='inbound'||ready(y,d));
      Object.assign(row.encounter!,{positionErrorM:check.positionErrorM,velocityErrorMs:check.velocityErrorMs,accepted});save();
      if(!accepted){row.status='missed';row.reason='Position, velocity, readiness or the original window failed. No attachment was made.';free.push({id:row.id,phase:'flyby',state:[...incoming]});emit('miss',`${row.id} encounter rejected`,row.reason,row.id);}
      else {
        const before=invariants(y,b),ld={...d,payloadT:row.massT},nb=compile(ld,y[6],true,cells);
        row.capturedState=[...tip];importedE+=row.massT*1000*orbit(tip).energy;importedH+=row.massT*1000*angular(tip);
        y=reframe(y,b,nb);attached=row;row.status='attached';const after=invariants(y,nb);
        row.eventEnergyResidualJ=after.energy-before.energy-row.massT*1000*orbit(tip).energy;
        row.eventAngularResidual=after.angular-before.angular-row.massT*1000*angular(tip);
        releasePhase=phase(y)+(row.direction==='outbound'?p.outboundPhase:p.inboundPhase)*Math.PI/180;
        emit('capture',`${row.id} captured`,`${row.massT} t, ${row.direction}. Numerical match ${check.positionErrorM.toFixed(4)} m / ${check.velocityErrorMs.toFixed(6)} m/s. Existing cargo is never reused.`,row.id);
      }
      reserved=null;incoming=null;powered=false;stable=0;nextDecision=t;save();continue;
    }
    if(attached&&phase(y)>=releasePhase-1e-8){
      save();const row=attached,b=compile(active,y[6],true,cells),tip=pointState(y,b,b.half),o=orbit(tip),before=invariants(y,b);
      exportedE+=row.massT*1000*o.energy;exportedH+=row.massT*1000*angular(tip);
      const nb=compile(d,y[6],false,cells);y=reframe(y,b,nb);const after=invariants(y,nb);
      row.eventEnergyResidualJ=(row.eventEnergyResidualJ??0)+after.energy-before.energy+row.massT*1000*o.energy;
      row.eventAngularResidual=(row.eventAngularResidual??0)+after.angular-before.angular+row.massT*1000*angular(tip);
      row.releasedAt=t;row.releasedState=[...tip];row.perigeeKm=o.perigee/1000;row.apogeeKm=o.apogee===null?null:o.apogee/1000;
      row.energyGainJ=row.massT*1000*(o.energy-orbit(row.capturedState!).energy);
      row.angularGain=row.massT*1000*(angular(tip)-angular(row.capturedState!));
      const good=qualifies(row,row.energyGainJ,row.apogeeKm,row.perigeeKm,p);
      row.status=good?(row.direction==='outbound'?'delivered':'returned'):'invalid-release';
      row.reason=good?'Transfer energy direction, bound destination and perigee criteria met.':'Release did not meet its energy-direction or destination-orbit criteria. Physical exchange is still counted.';
      free.push({id:row.id,phase:'released',state:[...tip]});
      emit('release',`${row.id} ${good?(row.direction==='outbound'?'delivered':'returned'):'release outside target'}`,`${(row.energyGainJ/1e9).toFixed(3)} GJ to payload (signed). ${(row.angularGain/1e12).toFixed(4)} ×10¹² kg·m²/s to payload. ${row.reason}`,row.id);
      attached=null;stable=0;nextDecision=t;save();continue;
    }
    if(t>=horizon-1e-8){save();break;}
    const next=rows.find(r=>r.status==='queued');
    if(!attached&&!reserved&&next&&t>=nextDecision-1e-7){
      nextDecision=t+60; // deterministic scheduler, independent of render FPS
      const first=rows.every(r=>!r.capturedState),allowed=next.direction==='inbound'||stable>=60||first;
      const open=p.mode==='schedule'?Math.max(0,next.atMinutes-p.windowMinutes)*60:0;
      const close=p.mode==='schedule'?Math.min(horizon,(next.atMinutes+p.windowMinutes)*60):horizon;
      // Do not shut down recovery hours before a future fixed window.
      const estimate=TAU/Math.max(.00001,y[5]-(y[0]*y[3]-y[1]*y[2])/(y[0]**2+y[1]**2));
      if(allowed&&open-t<Math.min(7200,estimate*2+90)){
        const found=forecast(y,d,next,t,step,cells,Math.max(t+90,open),close);
        if(found){save();reserved=next;next.encounter=found;next.status='reserved';powered=false;
          emit('reserve',`${next.id} encounter reserved`,`Capture at T+${(found.capture/60).toFixed(2)} min. Recovery is paused for the coast forecast and checked approach. ${p.mode==='schedule'?'The original arrival window is unchanged.':'This is capacity scheduling, not a promised appointment.'}`,next.id);save();continue;}
      }
    }
    const canPower=d.recovery==='electrodynamic'||(d.recovery==='chemical'&&y[6]>1e-7);
    const defer=p.assistance==='after-return'&&next?.direction==='inbound';
    const shouldPower=canPower&&!attached&&!reserved&&!defer&&(!!next||stable<60);
    if(powered!==shouldPower){save();powered=shouldPower;save();}
    if(t>=nextSample-1e-7){save();nextSample=t+30;}
    if(t>=nextProgress){options.progress?.(t/horizon);nextProgress=t+300;}
    let h=Math.min(step,horizon-t);
    if(!attached&&!reserved&&nextDecision>t+1e-7)h=Math.min(h,nextDecision-t);
    if(reserved?.encounter){const e=reserved.encounter;h=Math.min(h,e.capture-t);if(!incoming&&e.start>t+1e-7)h=Math.min(h,e.start-t);}
    if(p.mode==='schedule')for(const r of rows)if(r.status==='queued'){const close=(r.atMinutes+p.windowMinutes)*60;if(close>t+1e-7)h=Math.min(h,close-t);}
    const ad=workingDesign();
    if(powered&&d.recovery==='chemical'){const flow=forces(y,compile(ad,y[6],false,cells),ad,true).flow;if(flow>0)h=Math.min(h,y[6]/flow);}
    let yn=opsStep(y,h,ad,!!attached,powered,cells);
    if(attached&&phase(y)<releasePhase&&phase(yn)>=releasePhase){let lo=0,hi=h;for(let k=0;k<25;k++){const mid=(lo+hi)/2;if(phase(opsStep(y,mid,ad,true,powered,cells))>=releasePhase)hi=mid;else lo=mid;}h=hi;yn=opsStep(y,h,ad,true,powered,cells);}
    if(limit(yn,ad,!!attached,powered,cells)){let lo=0,hi=h;for(let k=0;k<20;k++){const mid=(lo+hi)/2;if(limit(opsStep(y,mid,ad,!!attached,powered,cells),ad,!!attached,powered,cells))hi=mid;else lo=mid;}h=hi;yn=opsStep(y,h,ad,!!attached,powered,cells);}
    if(!Number.isFinite(h)||h<1e-9){if(y[6]<1e-5&&powered&&d.recovery==='chemical'){y[6]=0;powered=false;continue;}throw Error('Operations event step stalled.');}
    if(incoming)incoming=particleStep(incoming,h);
    for(const c of free)if(c.phase!=='cutoff'){c.state=particleStep(c.state,h);if(Math.hypot(c.state[0],c.state[1])<EARTH+120000)c.phase='cutoff';}
    const previousStable=stable;stable=!attached&&ready(yn,d)?stable+h:0;
    if(previousStable<60&&stable>=60)nextDecision=t+h;
    y=yn;t+=h;
    if(d.recovery==='chemical'&&y[6]<1e-5&&powered){y[6]=0;powered=false;emit('fuel','Tank exhausted','No further chemical thrust or torque is available.');}
  }
  for(const row of rows)if(['queued','reserved','approach','attached'].includes(row.status)){
    row.reason=row.status==='attached'?'Observation ended before this shipment was released.':stop==='limit'?'Facility reached a model limit before service.':'Not served before the chosen observation horizon.';
    // Keep an attached/approaching identity visible in the final frame.
    if(row.status!=='attached'&&row.status!=='approach')row.status='unserved';
  }
  save();emit('end','Shift complete',reason);options.progress?.(1);
  const last=frames.at(-1)!;
  return {model:OPS_MODEL,core:MODEL,plan:p,rows,frames,events,stop,reason,stepSeconds:step,cells,
    initialDryEnergyJ:initialDry.energy,initialDryAngular:initialDry.angular,dryMassKg:dry.mass,...totals(),
    unserved:rows.filter(r=>['unserved','attached','approach'].includes(r.status)).length,
    fuelUsedKg:d.fuelT*1000-y[6],busEnergyJ:y[8],actuatorWorkJ:y[12],actuatorAngular:y[13],exhaustEnergyJ:y[14],exhaustAngular:y[15],
    importedEnergyJ:importedE,exportedEnergyJ:exportedE,importedAngular:importedH,exportedAngular:exportedH,
    energyResidualJ:last.energyResidualJ,angularResidual:last.angularResidual,maxEnergyResidualJ:maxER,maxAngularResidual:maxHR,minClearanceM:minC,minMargin:minM};
}

/** Replay never blends identities or attachment/actuation event states. */
export function sampleOps(r:OpsResult,t:number):OpsFrame {
  const a=r.frames;let lo=0,hi=a.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(a[m].t<=t)lo=m;else hi=m-1;}
  const f=a[lo],n=a[lo+1];
  if(!n||n.t===f.t||f.attachedId!==n.attachedId||f.powered!==n.powered||f.cargo.length!==n.cargo.length||f.cargo.some((c,i)=>c.id!==n.cargo[i].id||c.phase!==n.cargo[i].phase))return f;
  const u=Math.max(0,Math.min(1,(t-f.t)/(n.t-f.t))),mix=(x:number[],y:number[])=>x.map((v,i)=>v+(y[i]-v)*u);
  return {...f,t,state:mix(f.state,n.state),cargo:f.cargo.map((c,i)=>({...c,state:mix(c.state,n.cargo[i].state)})),dryEnergyJ:f.dryEnergyJ+(n.dryEnergyJ-f.dryEnergyJ)*u,dryAngular:f.dryAngular+(n.dryAngular-f.dryAngular)*u};
}
