/** HASTOL-inspired visual example, in km and seconds. This is not a campaign
 * trajectory or an aircraft/finite-mass tether solver. The powered ascent is
 * prescribed; the aircraft's high-altitude coast and released cargo use central
 * gravity. Rendezvous matches position and velocity. Hardware is drawn enlarged.
 * Reference: NIAC HASTOL Phase II report, chapter 1 (391Grant.pdf).
 */
export type LaunchPoint = {x:number;y:number};
type State = {position:LaunchPoint;velocity:LaunchPoint};
export const LAUNCH = {radius:6371,mu:398600.4418,hubAltitude:1100,pickupAltitude:150,aircraftSpeed:4.5,arm:950,coastStart:-180,captureStart:-6,captureEnd:20,coastDuration:360} as const;
export const LAUNCH_LABELS = ['Climb','Rendezvous','Lift','Release'];
export const LAUNCH_MS = [9000,7000,9000,7000];
export const LAUNCH_STILLS = [.62,.51,.48,.45];
const r=LAUNCH.radius+LAUNCH.hubAltitude;
const orbitRate=Math.sqrt(LAUNCH.mu/r**3),orbitSpeed=r*orbitRate;
const spinRate=(orbitSpeed-LAUNCH.aircraftSpeed)/LAUNCH.arm;
export const LAUNCH_RELEASE_TIME=Math.PI/(spinRate-orbitRate);
const clamp=(p:number)=>Math.max(0,Math.min(1,p));
const smooth=(p:number)=>{const t=clamp(p);return t*t*(3-2*t);};
const add=(a:LaunchPoint,b:LaunchPoint):LaunchPoint=>({x:a.x+b.x,y:a.y+b.y});
const scale=(p:LaunchPoint,s:number):LaunchPoint=>({x:p.x*s,y:p.y*s});
const mix=(a:LaunchPoint,b:LaunchPoint,p:number):LaunchPoint=>add(scale(a,1-p),scale(b,p));
export const launchAltitude=(p:LaunchPoint)=>Math.hypot(p.x,p.y)-LAUNCH.radius;
export const launchSpeed=(v:LaunchPoint)=>Math.hypot(v.x,v.y);

export function launchTetherAt(time:number) {
  const phi=orbitRate*time,angle=-spinRate*time;
  const hub={x:r*Math.sin(phi),y:r*Math.cos(phi)};
  const arm={x:-LAUNCH.arm*Math.sin(spinRate*time),y:-LAUNCH.arm*Math.cos(spinRate*time)};
  const hubVelocity={x:r*orbitRate*Math.cos(phi),y:-r*orbitRate*Math.sin(phi)};
  const spinVelocity={x:-LAUNCH.arm*spinRate*Math.cos(spinRate*time),y:LAUNCH.arm*spinRate*Math.sin(spinRate*time)};
  return {hub,tip:add(hub,arm),otherTip:add(hub,scale(arm,-1)),angle,velocity:add(hubVelocity,spinVelocity),hubVelocity,spinVelocity};
}
function derivative(s:State):State {
  const factor=-LAUNCH.mu/Math.hypot(s.position.x,s.position.y)**3;
  return {position:s.velocity,velocity:scale(s.position,factor)};
}
function step(s:State,dt:number):State {
  const shift=(d:State,t:number):State=>({position:add(s.position,scale(d.position,t)),velocity:add(s.velocity,scale(d.velocity,t))});
  const a=derivative(s),b=derivative(shift(a,dt/2)),c=derivative(shift(b,dt/2)),d=derivative(shift(c,dt));
  const sum=(key:keyof State)=>scale(add(add(a[key],scale(b[key],2)),add(scale(c[key],2),d[key])),dt/6);
  return {position:add(s.position,sum('position')),velocity:add(s.velocity,sum('velocity'))};
}
function table(initial:State,seconds:number) {
  const values=[initial],count=Math.ceil(Math.abs(seconds)*2),dt=seconds/count;
  for(let i=0;i<count;i++)values.push(step(values[i],dt));
  return (p:number):State=>{const n=clamp(p)*count,i=Math.min(count-1,Math.floor(n)),t=n-i;return {position:mix(values[i].position,values[i+1].position,t),velocity:mix(values[i].velocity,values[i+1].velocity,t)};};
}
const pickup=launchTetherAt(0);
const aircraftInitial={position:pickup.tip,velocity:pickup.velocity};
const aircraftBefore=table(aircraftInitial,LAUNCH.coastStart),aircraftAfter=table(aircraftInitial,210);
export const launchAircraftAt=(time:number)=>time<=0?aircraftBefore(time/LAUNCH.coastStart):aircraftAfter(time/210);
const ascentEnd=launchAircraftAt(LAUNCH.coastStart);
const ascentPhi=Math.atan2(ascentEnd.position.x,ascentEnd.position.y)-.025;
const ascentStart={x:(LAUNCH.radius+25)*Math.sin(ascentPhi),y:(LAUNCH.radius+25)*Math.cos(ascentPhi)};
const ascentDuration=60;
const ascentInitialVelocity={x:.3*Math.cos(ascentPhi),y:-.3*Math.sin(ascentPhi)};
function poweredAscent(p:number):State {
  const h=[2*p**3-3*p*p+1,p**3-2*p*p+p,-2*p**3+3*p*p,p**3-p*p];
  const dh=[6*p*p-6*p,3*p*p-4*p+1,-6*p*p+6*p,3*p*p-2*p];
  const values=[ascentStart,scale(ascentInitialVelocity,ascentDuration),ascentEnd.position,scale(ascentEnd.velocity,ascentDuration)];
  const total=(weights:number[])=>values.reduce((sum,v,i)=>add(sum,scale(v,weights[i])),{x:0,y:0});
  return {position:total(h),velocity:scale(total(dh),1/ascentDuration)};
}
export const LAUNCH_RELEASE=launchTetherAt(LAUNCH_RELEASE_TIME);
const cargoCoast=table({position:LAUNCH_RELEASE.tip,velocity:LAUNCH_RELEASE.velocity},LAUNCH.coastDuration);
export const launchCargoCoast=(p:number)=>cargoCoast(p);
export function earthLaunchFrame(stage:number,progress:number) {
  const p=clamp(progress);
  const time=stage===0?p<.32?LAUNCH.coastStart-ascentDuration+ascentDuration*p/.32:LAUNCH.coastStart+(LAUNCH.captureStart-LAUNCH.coastStart)*(p-.32)/.68
    :stage===1?p<=.45?LAUNCH.captureStart*(1-p/.45):LAUNCH.captureEnd*(p-.45)/.55
    :stage===2?LAUNCH.captureEnd+(LAUNCH_RELEASE_TIME-LAUNCH.captureEnd)*p*p
    :LAUNCH_RELEASE_TIME+LAUNCH.coastDuration*p;
  const tether=launchTetherAt(time);
  const aircraft=stage===0&&p<.32?poweredAscent(p/.32):launchAircraftAt(Math.min(time,210));
  const latched=stage>=2||stage===1&&p>=.45;
  const payload=stage===3?cargoCoast(p):latched?{position:tether.tip,velocity:tether.velocity}:aircraft;
  const aircraftAngle=Math.atan2(aircraft.velocity.y,aircraft.velocity.x);
  const aircraftVisible=stage<2||stage===2&&time<160;
  const aircraftPosition=add(aircraft.position,{x:16*Math.sin(aircraftAngle),y:-16*Math.cos(aircraftAngle)});
  const payloadAngle=latched?(stage===3?LAUNCH_RELEASE.angle:tether.angle):aircraftAngle;
  const jawAngle=stage===0?36:stage===1?36*(1-smooth((p-.12)/.33)):stage===2?0:36*smooth(p/.1);
  // Start near the carrier, show the grapple in the aircraft's moving frame,
  // then smoothly widen to include both tether ends and the released cargo.
  const carrierCamera={center:add(aircraftPosition,{x:35,y:65}),width:620};
  const captureCamera={center:add(aircraft.position,{x:7,y:-10}),width:130};
  const points=[tether.tip,tether.otherTip,tether.hub,payload.position];
  const bounds=(axis:'x'|'y')=>[Math.min(...points.map(v=>v[axis])),Math.max(...points.map(v=>v[axis]))];
  const [x0,x1]=bounds('x'),[y0,y1]=bounds('y');
  const wideCamera={center:{x:(x0+x1)/2,y:(y0+y1)/2},width:Math.max(2450,x1-x0+180,(y1-y0+180)/.62)};
  const blend=(a:typeof carrierCamera,b:typeof carrierCamera,t:number)=>({center:mix(a.center,b.center,t),width:a.width+(b.width-a.width)*t});
  const camera=stage===0?carrierCamera:stage===1?blend(carrierCamera,captureCamera,smooth(p/.2))
    :stage===2?blend(captureCamera,wideCamera,smooth(p/.28))
    :wideCamera;
  return {time,...tether,aircraft:aircraftPosition,aircraftAngle,aircraftVisible,payload:payload.position,payloadAngle,payloadSpeed:launchSpeed(payload.velocity),altitude:launchAltitude(payload.position),powered:stage===0&&p<.32,latched:latched&&stage!==3,jawAngle,camera};
}
export function launchPath(kind:'aircraft'|'cargo') {
  return Array.from({length:100},(_,i)=>kind==='aircraft'?earthLaunchFrame(0,i/99).payload:launchCargoCoast(i/99).position);
}
