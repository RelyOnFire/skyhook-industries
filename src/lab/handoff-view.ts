import { EARTH, type Result } from '../simulation/engine.js';
import { positions, sample } from './view.js';

export const HUB = [260, 220] as const;
const PX_PER_M = .00050;
export function handoffFrame(result: Result, time: number) {
  const frame = sample(result, time);
  const { a, z, hub } = positions(result, frame);
  const radius = Math.hypot(hub[0], hub[1]);
  const upX = hub[0] / radius, upY = hub[1] / radius;
  // Hub-relative and prograde-right: attaching a load can move the center
  // of mass, but it must never make a fixed shot appear to jump.
  function project(point: number[]) {
    const dx = point[0] - hub[0], dy = point[1] - hub[1];
    return [HUB[0] + (-dx * upY + dy * upX) * PX_PER_M,
      HUB[1] - (dx * upX + dy * upY) * PX_PER_M] as const;
  }
  const cargo = frame.payloads[0] ?? (frame.loaded ? z : frame.incoming);
  const tip = project(z);
  return { a: project(a), tip, cargo: cargo ? project(cargo) : null,
    angle: Math.atan2(tip[1] - HUB[1], tip[0] - HUB[0]) * 180 / Math.PI,
    gap: cargo ? Math.hypot(cargo[0]-z[0], cargo[1]-z[1]) : 0,
    altitudeKm: cargo ? Math.round((Math.hypot(cargo[0], cargo[1])-EARTH)/1000) : null,
    phase: frame.payloads[0] ? 'released' as const : frame.loaded ? 'attached' as const : 'approach' as const };
}
export type HandoffFrame = ReturnType<typeof handoffFrame>;
