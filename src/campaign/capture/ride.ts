import {LAUNCH, LAUNCH_RELEASE_TIME, launchTetherAt, launchCargoCoast, launchAltitude, launchSpeed} from '../earth-launch-motion.js';
import type {Carriage,Telemetry} from './pass.js';

export const RIDE_SWING=36, RIDE_END=40;
/** The swing is accelerated, then the camera lingers for two physical seconds
 * after release. The graphics and instruments sample this same physical time. */
export function rideFrame(clock:number,carriage:Carriage){
  const t=Math.max(0,Math.min(clock,RIDE_END)),released=t>=RIDE_SWING;
  const coast=Math.max(0,(t-RIDE_SWING)*.5);
  const time=Math.min(t/RIDE_SWING,1)*LAUNCH_RELEASE_TIME+coast;
  const tether=launchTetherAt(time),free=released?launchCargoCoast(coast/LAUNCH.coastDuration):null;
  const position=free?.position??tether.tip, velocity=free?.velocity??tether.velocity;
  const dx=(position.x-tether.tip.x)*1000,dy=(position.y-tether.tip.y)*1000;
  const cos=Math.cos(tether.angle),sin=Math.sin(tether.angle);
  const cargo={x:carriage.x+cos*dx+sin*dy,y:-sin*dx+cos*dy,z:carriage.z};
  const data:Telemetry={cargo,lateral:Math.abs(cargo.x-carriage.x),range:Math.hypot(dx,dy),within:false,
    speed:Math.hypot(velocity.x-tether.velocity.x,velocity.y-tether.velocity.y)*1000};
  return {time,released,altitude:launchAltitude(position),inertialSpeed:launchSpeed(velocity),data};
}
