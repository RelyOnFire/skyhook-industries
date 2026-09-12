/** E0: deliberately bounded, equatorial electrodynamic actuator model.
 * Two separately driven, insulated conductor segments close through an assumed
 * corotating plasma. No plasma collection, thermal, eclipse or flexible dynamics.
 * All quantities SI. See docs/tether-lab/electrodynamic-recovery.md. */
export const ED_DEFAULTS = {
  edLengthKm: 50, edAreaMm2: 10, edPowerKw: 500,
  edCurrentA: 20, edVoltageKv: 30, edHardwareT: 8,
};
export type EDSettings = typeof ED_DEFAULTS;
// Reference assumptions, not qualified hardware specifications.
export const ED_DENSITY = 2700;
export const ED_RESISTIVITY = 2.82e-8;
export const ED_SURFACE_FIELD = 30e-6;
export const ED_EARTH_RADIUS = 6371000;
export const ED_EARTH_SPIN = 7.292115e-5;
export const ED_CONTACT_DROP = 100; // combined contacts in each plasma circuit
export const ED_EFFICIENCY = 0.9;
export interface ConductorNode { s:number; length:number; circuit:0|1 }
export interface EDState { x:number;y:number;vx:number;vy:number;theta:number;omega:number;center:number }
export interface EDTarget { fx:number;fy:number;torque:number }
export interface EDCircuit {
  current:number; voltage:number; backEmf:number; resistance:number;
  fx:number;fy:number;torque:number;mechanicalW:number;environmentW:number;
  busW:number;ohmicW:number;contactW:number;converterW:number;dumpW:number;
}
export interface EDReading {
  circuits:EDCircuit[]; nodeForces:[number,number][];
  fx:number;fy:number;torque:number;busW:number;mechanicalW:number;
  environmentW:number;heatW:number;limitedBy:string[];
}
export function dipoleField(x:number,y:number):number {
  const r=Math.hypot(x,y);
  if(!Number.isFinite(r)||r<=0) throw Error('Invalid magnetic-field position.');
  return -ED_SURFACE_FIELD*(ED_EARTH_RADIUS/r)**3;
}
export function conductorNodes(half:number,length:number,count:number):ConductorNode[] {
  if(length<=0||length>half||count<1||!Number.isInteger(count)) throw Error('Invalid conductor geometry.');
  const ds=length/count,nodes:ConductorNode[]=[];
  for(const circuit of [0,1] as const) {
    const start=circuit===0?-half:half-length;
    for(let i=0;i<count;i++) nodes.push({s:start+(i+.5)*ds,length:ds,circuit});
  }
  return nodes;
}
/** Equivalent circuit: U = R I + k + sign(I) V_contact.
 * k = integral((u x B) dot v_relative ds) = -motional EMF.
 * Any generated electricity is dumped, never credited to the power supply. */
export function circuitPower(current:number,backEmf:number,resistance:number) {
  const ohmicW=resistance*current*current,contactW=ED_CONTACT_DROP*Math.abs(current);
  const terminalW=backEmf*current+ohmicW+contactW;
  const busW=Math.max(0,terminalW)/ED_EFFICIENCY;
  const converterW=busW-Math.max(0,terminalW),dumpW=Math.max(0,-terminalW);
  const voltage=current===0?0:resistance*current+backEmf+Math.sign(current)*ED_CONTACT_DROP;
  return {busW,ohmicW,contactW,converterW,dumpW,voltage};
}
/** Projection controller: it cannot invent axial thrust or arbitrary torque.
 * Independently bounded currents produce transverse force and a real moment.
 * These are controller experiments, not an optimal or flight-proven law. */
export function electrodynamicForces(state:EDState,nodes:ConductorNode[],settings:EDSettings,target:EDTarget,enabled:boolean):EDReading {
  const u=[Math.cos(state.theta),Math.sin(state.theta)];
  const geometry=nodes.map(node=>{
    const q=node.s-state.center,x=state.x+q*u[0],y=state.y+q*u[1];
    const vx=state.vx-state.omega*q*u[1],vy=state.vy+state.omega*q*u[0];
    const field=dipoleField(x,y),fx=u[1]*field*node.length,fy=-u[0]*field*node.length;
    const torque=q*(u[0]*fy-u[1]*fx);
    const mechanical=fx*vx+fy*vy,environment=fx*(-ED_EARTH_SPIN*y)+fy*(ED_EARTH_SPIN*x);
    return {fx,fy,torque,mechanical,environment,circuit:node.circuit};
  });
  const coefficients=([0,1] as const).map(circuit=>geometry.filter(g=>g.circuit===circuit).reduce((a,g)=>({
    force:a.force+g.fx*u[1]-g.fy*u[0],torque:a.torque+g.torque,
    mechanical:a.mechanical+g.mechanical,environment:a.environment+g.environment,
  }),{force:0,torque:0,mechanical:0,environment:0}));
  const [a,b]=coefficients,det=a.force*b.torque-b.force*a.torque;
  // Twice the transverse projection compensates the rotating actuator's average
  // directional availability. Individual forces remain exactly perpendicular.
  const projected=2*(target.fx*u[1]-target.fy*u[0]);
  const demand=enabled&&Math.abs(det)>1e-12?[
    (projected*b.torque-b.force*target.torque)/det,
    (a.force*target.torque-projected*a.torque)/det,
  ]:[0,0];
  const limited=new Set<string>(),resistance=ED_RESISTIVITY*settings.edLengthKm*1000/(settings.edAreaMm2*1e-6);
  const currents=demand.map((wanted,i)=>{
    const emf=coefficients[i].mechanical-coefficients[i].environment;
    // Conservative triangle bound: no current is enabled when back-EMF alone
    // exceeds the drive rating. This is not an overvoltage insulation model.
    const voltageLimit=Math.max(0,(settings.edVoltageKv*1000-Math.abs(emf)-ED_CONTACT_DROP)/resistance);
    const cap=Math.min(settings.edCurrentA,voltageLimit);
    if(Math.abs(wanted)>cap+1e-8) {
      if(settings.edCurrentA<=voltageLimit) limited.add('current');
      if(voltageLimit<=settings.edCurrentA) limited.add('voltage');
    }
    return Math.max(-cap,Math.min(cap,wanted));
  });
  const powerAt=(scale:number)=>currents.reduce((p,i,j)=>p+circuitPower(i*scale,
    coefficients[j].mechanical-coefficients[j].environment,resistance).busW,0);
  let scale=1;
  if(settings.edPowerKw===0) { scale=0; if(enabled)limited.add('power'); }
  else if(powerAt(1)>settings.edPowerKw*1000) {
    limited.add('power');let lo=0,hi=1;
    for(let k=0;k<32;k++){const mid=(lo+hi)/2;if(powerAt(mid)>settings.edPowerKw*1000)hi=mid;else lo=mid;}
    scale=lo;
  }
  const circuits=coefficients.map((g,j):EDCircuit=>{
    const current=currents[j]*scale,backEmf=g.mechanical-g.environment;
    const force=g.force*current;
    return {current,backEmf,resistance,fx:force*u[1],fy:-force*u[0],torque:g.torque*current,
      mechanicalW:g.mechanical*current,environmentW:g.environment*current,...circuitPower(current,backEmf,resistance)};
  });
  const total=circuits.reduce((a,c)=>({fx:a.fx+c.fx,fy:a.fy+c.fy,torque:a.torque+c.torque,
    busW:a.busW+c.busW,mechanicalW:a.mechanicalW+c.mechanicalW,environmentW:a.environmentW+c.environmentW,
    heatW:a.heatW+c.ohmicW+c.contactW+c.converterW+c.dumpW}),
    {fx:0,fy:0,torque:0,busW:0,mechanicalW:0,environmentW:0,heatW:0});
  return {...total,circuits,limitedBy:[...limited],nodeForces:geometry.map(g=>[g.fx*circuits[g.circuit].current,g.fy*circuits[g.circuit].current])};
}
