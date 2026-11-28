import { LAUNCH } from '../earth-launch-motion.js';

// Local expansion about the nominal lower-tip velocity match. All local units are SI.
const hubRadius = LAUNCH.radius + LAUNCH.hubAltitude;
const tipRadius = LAUNCH.radius + LAUNCH.pickupAltitude;
const spinSpeed = Math.sqrt(LAUNCH.mu / hubRadius) - LAUNCH.aircraftSpeed;
export const separationAcceleration = 1000 * (
  LAUNCH.mu / tipRadius ** 2 - LAUNCH.mu / hubRadius ** 2 + spinSpeed ** 2 / LAUNCH.arm
);
export const LIMIT = { lateral: .28, axial: .18, speed: 1.5, travel: 2, slew: 2.2 } as const;
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
export function encounter(pass: Pass, time: number, c: Carriage) {
  const p = passes[pass];
  const cargo = {x: p.x + time * p.vx, y: -.5 * separationAcceleration * time ** 2, z: p.z + time * p.vz};
  const lateral = Math.hypot(cargo.x - c.x, cargo.z - c.z);
  const speed = Math.hypot(p.vx - c.vx, separationAcceleration * time, p.vz - c.vz);
  const range = Math.hypot(lateral, cargo.y);
  const within = lateral <= LIMIT.lateral && -cargo.y <= LIMIT.axial && speed <= LIMIT.speed;
  return { cargo, lateral, range, speed, within };
}
export type Telemetry = ReturnType<typeof encounter>;
export type Outcome = 'secured' | 'offset' | 'speed' | 'early' | 'late';
export function closeJaws(f: Telemetry, t: number): Outcome {
  if (-f.cargo.y > LIMIT.axial) return t < 0 ? 'early' : 'late';
  if (f.lateral > LIMIT.lateral) return 'offset';
  if (f.speed > LIMIT.speed) return 'speed';
  return 'secured';
}
