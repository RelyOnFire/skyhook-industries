import {LAUNCH, LAUNCH_RELEASE_TIME, launchTetherAt, launchCargoCoast, launchAltitude, launchSpeed} from '../earth-launch-motion.js';
import {EYE,PIN,bearingHeight,type Point3} from '../../visuals/capture-fitting.js';
import type {Carriage} from './pass.js';

export const RIDE_SWING=36, RIDE_END=40;
const unlockPlayback=1;
/** Slow the withdrawal to one playback second. Start free flight when the tip clears the near face of the acquired eye. */
export function rideFrame(clock:number,carriage:Carriage,retained?:Point3){
  const t=Math.max(0,Math.min(clock,RIDE_END)),released=t>=RIDE_SWING;
  const seat=retained??{x:carriage.x,y:bearingHeight(0),z:carriage.z};
  const clearTip=seat.z-carriage.z-EYE.tube;
  const clearFraction=(clearTip-PIN.openTip)/(PIN.lockedTip-PIN.openTip);
  const startUnlock=RIDE_SWING-(1-clearFraction)*unlockPlayback;
  const endUnlock=startUnlock+unlockPlayback;
  const swingRate=(LAUNCH_RELEASE_TIME-(1-clearFraction)*PIN.strokeSeconds)/startUnlock;
  const stroke=Math.min(1,Math.max(0,(endUnlock-t)/unlockPlayback));
  const time=t<startUnlock?t*swingRate:t<=endUnlock
    ?LAUNCH_RELEASE_TIME+(t-RIDE_SWING)*PIN.strokeSeconds/unlockPlayback
    :LAUNCH_RELEASE_TIME+clearFraction*PIN.strokeSeconds+(t-endUnlock)*.5;
  const coast=Math.max(0,time-LAUNCH_RELEASE_TIME);
  const tether=launchTetherAt(time),free=released?launchCargoCoast(coast/LAUNCH.coastDuration):null;
  const position=free?.position??tether.tip, velocity=free?.velocity??tether.velocity;
  const dx=(position.x-tether.tip.x)*1000,dy=(position.y-tether.tip.y)*1000;
  const cos=Math.cos(tether.angle),sin=Math.sin(tether.angle);
  const cargo={x:seat.x+cos*dx+sin*dy,y:seat.y-sin*dx+cos*dy,z:seat.z};
  const data={cargo,lateral:Math.abs(dx),range:Math.hypot(dx,dy),within:false,
    speed:Math.hypot(velocity.x-tether.velocity.x,velocity.y-tether.velocity.y)*1000};
  return {time,released,stroke,swingRate,altitude:launchAltitude(position),inertialSpeed:launchSpeed(velocity),data};
}
