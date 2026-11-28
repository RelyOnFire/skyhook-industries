import {PIN,bearingHeight,fittingClearance,type Point3} from '../../visuals/capture-fitting.js';
import { LAUNCH } from '../earth-launch-motion.js';

// Local expansion about the nominal lower-tip velocity match. All local units are SI.
const hubRadius = LAUNCH.radius + LAUNCH.hubAltitude;
const tipRadius = LAUNCH.radius + LAUNCH.pickupAltitude;
const spinSpeed = Math.sqrt(LAUNCH.mu / hubRadius) - LAUNCH.aircraftSpeed;
export const separationAcceleration = 1000 * (
  LAUNCH.mu / tipRadius ** 2 - LAUNCH.mu / hubRadius ** 2 + spinSpeed ** 2 / LAUNCH.arm
);
export const LIMIT = { speed: 1.5, travel: 2, slew: 2.2 } as const;
export const VIEW_LOCATION = {latitude:23.3, longitude:-75.5} as const;
export const START = -3, END = .65, PREVIEW_TIME = -.41;
export const passes = {
  offset: { name: 'Offset approach', x: .9, z: -.65, vx: 0, vz: 0 },
  drift: { name: 'Cross-track drift', x: -.72, z: .82, vx: -.37, vz: .60 },
} as const;
export type Pass = keyof typeof passes;
export type Carriage = { x: number; z: number; vx: number; vz: number };
export const neutral = (): Carriage => ({ x: 0, z: 0, vx: 0, vz: 0 });
export const bound = (v: number) => Math.max(-LIMIT.travel, Math.min(LIMIT.travel, v));

export function moveCarriage(c: Carriage, goal: {x: number; z: number}, dt: number): Carriage {
  if (dt <= 0) return c;
  const dx = bound(goal.x) - c.x, dz = bound(goal.z) - c.z;
  const step = Math.min(1, LIMIT.slew * dt / (Math.hypot(dx, dz) || 1));
  return { x: c.x + dx * step, z: c.z + dz * step, vx: dx * step / dt, vz: dz * step / dt };
}
function cargoAt(pass:Pass,t:number):Point3 {
  const p=passes[pass];
  return {x:p.x+t*p.vx,y:-.5*separationAcceleration*t*t,z:p.z+t*p.vz};
}
export function encounter(pass:Pass,time:number,c:Carriage) {
  const p=passes[pass],cargo=cargoAt(pass,time),clearance=fittingClearance(cargo,c);
  const axialRate=-separationAcceleration*time;
  const speed=Math.hypot(p.vx-c.vx,axialRate,p.vz-c.vz);
  const end=time+PIN.strokeSeconds;
  const endCargo=cargoAt(pass,end);
  const exit=fittingClearance(endCargo,c);
  // With the commanded carriage held and eye attitude fixed, X and Z are
  // linear in time; squared bore offset is a convex quadratic plus t^4.
  // The smallest clearance anywhere in the stroke is therefore at an end.
  const worstAtStart=clearance.bore<=exit.bore;
  const worstBore=worstAtStart?{x:clearance.dx,y:cargo.y,time}:{x:exit.dx,y:endCargo.y,time:end};
  const boreMargin=Math.min(clearance.bore,exit.bore)-PIN.guard;
  const forkMargin=Math.min(clearance.fork,exit.fork)-PIN.guard;
  const peakSpeed=Math.max(speed,Math.hypot(p.vx,axialRate,p.vz),Math.hypot(p.vx,separationAcceleration*end,p.vz));
  const within=boreMargin>=0&&forkMargin>=0&&peakSpeed<=LIMIT.speed;
  return {cargo,clearance,worstBore,boreMargin,forkMargin,speed,peakSpeed,axialRate,within,
    lateral:Math.hypot(clearance.dx,clearance.dz),range:Math.hypot(clearance.dx,cargo.y,clearance.dz)};
}
export type Telemetry = ReturnType<typeof encounter>;
export type Outcome = 'secured' | 'offset' | 'fork' | 'speed' | 'early' | 'late';
export function insertionOutcome(f:Telemetry):Outcome {
  if(f.forkMargin<0 && f.forkMargin<f.boreMargin)return 'fork';
  if(f.boreMargin<0 && Math.abs(f.worstBore.y)>Math.abs(f.worstBore.x))return f.worstBore.time<0?'early':'late';
  if(f.boreMargin<0)return 'offset';
  if(f.forkMargin<0)return 'fork';
  return f.peakSpeed<=LIMIT.speed?'secured':'speed';
}

export const lockDuration=PIN.strokeSeconds+PIN.seatSeconds;
export function latchPose(pass:Pass,commandTime:number,c:Carriage,elapsed:number) {
  const t=Math.max(0,Math.min(elapsed,lockDuration)),stroke=Math.min(1,t/PIN.strokeSeconds);
  const cargo=cargoAt(pass,commandTime+Math.min(t,PIN.strokeSeconds));
  // After insertion, show bounded kinematic take-up to the bearing surface.
  // No lateral snap. Impact forces and the settling transient are unmodelled.
  const u=Math.min(1,Math.max(0,(t-PIN.strokeSeconds)/PIN.seatSeconds));
  cargo.y+=(bearingHeight(cargo.x-c.x)-cargo.y)*u*u*(3-2*u);
  return {cargo,stroke,latched:t>=lockDuration};
}
