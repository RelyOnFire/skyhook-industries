import { compile, type Design } from './engine.js';

export type CaptureAxis = 'along' | 'across';
export interface CaptureCase {
  speedMs: number;
  strokeM: number;
  forceKN: number;
  axis: CaptureAxis;
}

export const EXAMPLE_CAPTURE: CaptureCase = { speedMs: 8, strokeM: 1, forceKN: 60, axis: 'along' };

/** A local, one-axis, perfectly inelastic capture. All returned quantities are SI. */
export function captureScreen(design: Design, input: CaptureCase) {
  if (design.architecture !== 'single-stage-rotovator') throw Error('Choose an Earth single-stage design.');
  const { speedMs, strokeM, forceKN, axis } = input;
  if (![speedMs, strokeM, forceKN].every(Number.isFinite) || speedMs < 0 || strokeM <= 0 || forceKN <= 0 ||
      (axis !== 'along' && axis !== 'across')) throw Error('Enter a nonnegative speed, a positive stroke and a positive force limit.');
  // Before the first capture the incoming payload is free and the facility still has its initial fuel.
  const body = compile(design, design.fuelT * 1000, false);
  const payloadKg = design.payloadT * 1000;
  const armM = body.half - body.center;
  const rotation = axis === 'across' ? armM ** 2 / body.inertia : 0;
  const effectiveKg = 1 / (1 / payloadKg + 1 / body.mass + rotation);
  const energyJ = 0.5 * effectiveKg * speedMs ** 2;
  const forceN = forceKN * 1000;
  const idealCapacityJ = forceN * strokeM;
  const meanForceN = energyJ / strokeM;
  const minStrokeM = energyJ / forceN;
  const speedLimitMs = Math.sqrt(2 * idealCapacityJ / effectiveKg);
  if (![energyJ, idealCapacityJ, meanForceN, minStrokeM, speedLimitMs].every(Number.isFinite)) {
    throw Error('These inputs exceed the numerical range of the calculation.');
  }
  return { facilityKg: body.mass, inertia: body.inertia, armM, payloadKg, effectiveKg,
    energyJ, idealCapacityJ, meanForceN, minStrokeM, speedLimitMs, exceedsBudget: energyJ > idealCapacityJ };
}
