/** Lunar surface access illustration, km and seconds. A prescribed 60 m/s²
 * launcher feeds a Moon-central-gravity coast. Its exit is solved so the rail
 * starts above the mean sphere; pickup matches the moving rigid tip exactly.
 * Not a finite-mass tether, terrain, electromagnetic or destination solver. */
import { MOON_ENV } from '../simulation/environment.js';
export type LunarPoint={x:number;y:number};
export type LunarState={position:LunarPoint;velocity:LunarPoint};
export const LUNAR_LAUNCH={radius:MOON_ENV.radius/1000,mu:MOON_ENV.mu/1e9,hubAltitude:200,arm:150,pickupAltitude:50,pickupSpeed:.9,acceleration:.06,clearance:.7,coastDuration:600} as const;
export const LUNAR_LABELS=['Load','Accelerate','Coast','Capture','Swing','Release'];
export const LUNAR_MS=[4000,6000,7000,7000,8000,7000];
export const LUNAR_STILLS=[.65,.68,.6,.55,.45,.4];
const clamp=(p:number)=>Math.max(0,Math.min(1,p));
export const lunarEase=(p:number)=>{const t=clamp(p);return t*t*(3-2*t);};
const add=(a:LunarPoint,b:LunarPoint)=>({x:a.x+b.x,y:a.y+b.y});
const scale=(p:LunarPoint,s:number)=>({x:p.x*s,y:p.y*s});
const mix=(a:LunarPoint,b:LunarPoint,t:number)=>add(scale(a,1-t),scale(b,t));
export const lunarAltitude=(p:LunarPoint)=>Math.hypot(p.x,p.y)-LUNAR_LAUNCH.radius;
export const lunarSpeed=(p:LunarPoint)=>Math.hypot(p.x,p.y);
const r=LUNAR_LAUNCH.radius+LUNAR_LAUNCH.hubAltitude,n=Math.sqrt(LUNAR_LAUNCH.mu/r**3),spin=(r*n-LUNAR_LAUNCH.pickupSpeed)/LUNAR_LAUNCH.arm;
export const LUNAR_RELEASE_TIME=Math.PI/(spin-n);
export function lunarTetherAt(time:number){
 const phi=n*time,a=spin*time,hub={x:r*Math.sin(phi),y:r*Math.cos(phi)},arm={x:-LUNAR_LAUNCH.arm*Math.sin(a),y:-LUNAR_LAUNCH.arm*Math.cos(a)};
 return {hub,tip:add(hub,arm),otherTip:add(hub,scale(arm,-1)),angle:-a,velocity:{x:r*n*Math.cos(phi)-LUNAR_LAUNCH.arm*spin*Math.cos(a),y:-r*n*Math.sin(phi)+LUNAR_LAUNCH.arm*spin*Math.sin(a)}};
}
function step(s:LunarState,dt:number):LunarState{
 const derivative=(v:LunarState):LunarState=>({position:v.velocity,velocity:scale(v.position,-LUNAR_LAUNCH.mu/lunarSpeed(v.position)**3)});
 const shift=(v:LunarState,t:number):LunarState=>({position:add(s.position,scale(v.position,t)),velocity:add(s.velocity,scale(v.velocity,t))});
 const a=derivative(s),b=derivative(shift(a,dt/2)),c=derivative(shift(b,dt/2)),d=derivative(shift(c,dt));
 const sum=(key:keyof LunarState)=>scale(add(add(a[key],scale(b[key],2)),add(scale(c[key],2),d[key])),dt/6);
 return {position:add(s.position,sum('position')),velocity:add(s.velocity,sum('velocity'))};
}
const pickup=lunarTetherAt(0),initial={position:pickup.tip,velocity:pickup.velocity};
const before=[initial];
// Propagate backward from the matched apogee until the derived rail foot reaches
// its clearance. The straight inclined rail remains outside the mean sphere.
const railFoot=(s:LunarState)=>add(s.position,scale(s.velocity,-lunarSpeed(s.velocity)/(2*LUNAR_LAUNCH.acceleration)));
while(lunarAltitude(railFoot(before.at(-1)!))>LUNAR_LAUNCH.clearance){
 if(before.length>5000)throw new Error('Lunar launcher has no surface intersection');
 before.push(step(before.at(-1)!,-.5));
}
let lo=0,hi=.5;
const upper=before[before.length-2];
for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(lunarAltitude(railFoot(step(upper,-mid)))>LUNAR_LAUNCH.clearance)lo=mid;else hi=mid;}
export const LUNAR_EXIT_TIME=-(before.length-2)*.5-(lo+hi)/2;
export const LUNAR_EXIT=step(upper,-(lo+hi)/2);
export const LUNAR_RAIL={start:railFoot(LUNAR_EXIT),end:LUNAR_EXIT.position,direction:scale(LUNAR_EXIT.velocity,1/lunarSpeed(LUNAR_EXIT.velocity)),length:lunarSpeed(LUNAR_EXIT.velocity)**2/(2*LUNAR_LAUNCH.acceleration),duration:lunarSpeed(LUNAR_EXIT.velocity)/LUNAR_LAUNCH.acceleration};
/** Prescribed empty-sled braking, separate from the freely coasting cargo. */
export const LUNAR_BRAKE={distance:1.1,duration:2*1.1/lunarSpeed(LUNAR_EXIT.velocity),deceleration:lunarSpeed(LUNAR_EXIT.velocity)**2/(2*1.1)} as const;
export function lunarApproachAt(time:number):LunarState{
 const t=Math.max(LUNAR_EXIT_TIME,Math.min(0,time)),index=Math.min(before.length-2,Math.floor(-t*2));
 return step(before[index],t+index*.5);
}
export function lunarRailAt(p:number):LunarState{
 const t=clamp(p)*LUNAR_RAIL.duration,distance=LUNAR_LAUNCH.acceleration*t*t/2;
 return {position:add(LUNAR_RAIL.start,scale(LUNAR_RAIL.direction,distance)),velocity:scale(LUNAR_RAIL.direction,LUNAR_LAUNCH.acceleration*t)};
}
export const LUNAR_RELEASE=lunarTetherAt(LUNAR_RELEASE_TIME);
const after=[{position:LUNAR_RELEASE.tip,velocity:LUNAR_RELEASE.velocity}];
for(let i=0;i<LUNAR_LAUNCH.coastDuration*2;i++)after.push(step(after.at(-1)!,.5));
export function lunarCargoCoast(p:number):LunarState{
 const t=clamp(p)*LUNAR_LAUNCH.coastDuration,index=Math.min(after.length-2,Math.floor(t*2));return step(after[index],t-index*.5);
}
/** Keep the rail-exit clock continuous, then compress the long coast only
 * after widening the view. The polynomial integral has zero warp slope at both
 * ends. Gravity propagation is unchanged; camera scale offsets the time warp. */
const railRate=LUNAR_RAIL.duration/(LUNAR_MS[1]/1000),captureRate=8/(LUNAR_MS[3]/1000*.55),coastSeconds=LUNAR_MS[2]/1000;
const latchedSeconds=LUNAR_MS[3]/1000*.45,swingEntryRate=2*12/latchedSeconds-captureRate,releaseRate=LUNAR_LAUNCH.coastDuration/(LUNAR_MS[5]/1000);
const coastSpan=-8-LUNAR_EXIT_TIME,warpSpan=.62,warpStart=.24;
const extraCoast=coastSpan-coastSeconds*(railRate+captureRate)/2;
const coastWidth=7*(railRate+extraCoast/coastSeconds/warpSpan*1.875)/railRate;
// Integrate a smooth rate between the endpoints; a nonnegative middle bump
// fits the prescribed physical interval without a pause or playback-rate jump.
function phaseClock(progress:number,seconds:number,span:number,entryRate:number,exitRate:number){
 const p=clamp(progress),extra=span-seconds*(entryRate+exitRate)/2;
 return {elapsed:seconds*(entryRate*p+(exitRate-entryRate)*(p**3-p**4/2))+extra*p**3*(10-15*p+6*p*p),rate:entryRate+(exitRate-entryRate)*lunarEase(p)+extra/seconds*30*p*p*(1-p)**2};
}
export function lunarCoastClock(progress:number){
 const p=clamp(progress),q=clamp((p-warpStart)/warpSpan),integral=q*q*q*(10-15*q+6*q*q);
 return {elapsed:coastSeconds*(railRate*p+(captureRate-railRate)*p*p/2)+extraCoast*integral,rate:railRate+(captureRate-railRate)*p+extraCoast/coastSeconds/warpSpan*30*q*q*(1-q)**2};
}
export function lunarLaunchFrame(stage:number,progress:number){
 const p=clamp(progress),railProgress=p,coast=lunarCoastClock(p);
 const latchedClock=phaseClock((p-.55)/.45,latchedSeconds,12,captureRate,swingEntryRate),swingClock=phaseClock(p,LUNAR_MS[4]/1000,LUNAR_RELEASE_TIME-12,swingEntryRate,releaseRate);
 const time=stage===0?LUNAR_EXIT_TIME-LUNAR_RAIL.duration:stage===1?LUNAR_EXIT_TIME-LUNAR_RAIL.duration+railProgress*LUNAR_RAIL.duration:stage===2?LUNAR_EXIT_TIME+coast.elapsed:stage===3?p<=.55?-8*(1-p/.55):latchedClock.elapsed:stage===4?12+swingClock.elapsed:LUNAR_RELEASE_TIME+p*LUNAR_LAUNCH.coastDuration;
 const tether=lunarTetherAt(time),latched=stage===4||stage===3&&p>=.55;
 const state=stage===0?lunarRailAt(0):stage===1?lunarRailAt(railProgress):stage===2||stage===3&&!latched?lunarApproachAt(time):stage===5?lunarCargoCoast(p):{position:tether.tip,velocity:tether.velocity};
 const railAngle=Math.atan2(LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x)-Math.PI/2;
 const payloadAngle=stage<2?railAngle:stage===2?railAngle+(tether.angle-railAngle)*lunarEase(p/.85):stage===5?LUNAR_RELEASE.angle:tether.angle;
 const loadCamera={center:add(LUNAR_RAIL.start,scale(LUNAR_RAIL.direction,3)),width:13};
 const railCamera={center:add(state.position,{x:0,y:.9}),width:7};
 const coastZoom=stage===2?lunarEase((p-.1)/.3):1;
 const coastCamera={center:add(state.position,{x:0,y:.9+7.1*coastZoom}),width:7+(coastWidth-7)*coastZoom};
 const captureCamera={center:add(state.position,{x:0,y:.1}),width:5};
 const points=[tether.tip,tether.otherTip,state.position],xs=points.map(v=>v.x),ys=points.map(v=>v.y);
 const [x0,x1,y0,y1]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
 const wideCamera={center:{x:(x0+x1)/2,y:(y0+y1)/2},width:Math.max(700,x1-x0+80,(y1-y0+80)/.62)};
 const blend=(a:typeof loadCamera,b:typeof loadCamera,t:number)=>({center:mix(a.center,b.center,t),width:a.width+(b.width-a.width)*t});
 const camera=stage===0?loadCamera:stage===1?blend(loadCamera,railCamera,lunarEase(p/.25)):stage===2?coastCamera:stage===3?blend(coastCamera,captureCamera,lunarEase(p/.28)):stage===4?blend(captureCamera,wideCamera,lunarEase(p/.3)):wideCamera;
 const timeScale=stage===0?0:stage===1?railRate:stage===2?coast.rate:stage===3?p<=.55?captureRate:latchedClock.rate:stage===4?swingClock.rate:releaseRate;
 const brakeTime=Math.max(0,Math.min(LUNAR_BRAKE.duration,time-LUNAR_EXIT_TIME)),exitSpeed=lunarSpeed(LUNAR_EXIT.velocity);
 const sledDistance=stage===0?0:stage===1?railProgress**2*LUNAR_RAIL.length:LUNAR_RAIL.length+exitSpeed*brakeTime-LUNAR_BRAKE.deceleration*brakeTime**2/2;
 const sledSpeed=stage===0?0:stage===1?exitSpeed*railProgress:Math.max(0,exitSpeed-LUNAR_BRAKE.deceleration*brakeTime);
 const hardwareScale=stage<2?1:Math.max(1,camera.width/500*20);
 return {time,timeScale,...tether,payload:state.position,payloadVelocity:state.velocity,payloadAngle,payloadSpeed:lunarSpeed(state.velocity),altitude:lunarAltitude(state.position),latched,jawAngle:stage<3?35:stage===3?35*(1-lunarEase((p-.3)/.25)):stage===4?0:35*lunarEase(p/.12),railProgress:stage===0?0:stage===1?railProgress:1,sledDistance,sledSpeed,hardwareScale,camera};
}
export function lunarLaunchPath(kind:'approach'|'release'){
 return Array.from({length:160},(_,i)=>kind==='approach'?lunarApproachAt(LUNAR_EXIT_TIME*(1-i/159)).position:lunarCargoCoast(i/159).position);
}
