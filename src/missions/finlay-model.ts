/** A mass-and-energy workbench, not a rendezvous or capture trajectory solution. */
export interface FinlayInputs {
  radiusKm: number;
  densityKgM3: number;
  waterFraction: number;
  exhaustKmS: number;
  powerGW: number;
  deltaVKmS: number;
}

export const FINLAY_DEFAULTS: Readonly<FinlayInputs> = Object.freeze({
  radiusKm: .9, densityKgM3: 500, waterFraction: .5,
  exhaustKmS: 3, powerGW: 10, deltaVKmS: 1,
});

/** Numerical scenario bounds; these are not certified engineering operating limits. */
export const FINLAY_LIMITS = Object.freeze({
  radiusKm: Object.freeze({min: .2, max: 1.5}),
  densityKgM3: Object.freeze({min: 200, max: 1000}),
  waterFraction: Object.freeze({min: 0, max: .9}),
  exhaustKmS: Object.freeze({min: .5, max: 10}),
  powerGW: Object.freeze({min: .01, max: 1000}),
  deltaVKmS: Object.freeze({min: 0, max: 15}),
});

export const FINLAY_ASSUMPTIONS = Object.freeze({
  // A scenario allowance for heating, sublimation and extraction losses, not a
  // measured Finlay material property. Propulsion has a separate energy cost.
  extractionJPerKg: 3e6,
  jetEfficiency: .6,
  dutyCycle: .7,
  secondsPerYear: 365.25 * 86400,
});

export interface FinlayEstimate {
  massKg: number;
  availableWaterKg: number;
  requiredPropellantKg: number;
  consumedWaterKg: number;
  remainingWaterKg: number;
  waterShortfallKg: number;
  finalMassKg: number;
  maxDeltaVKmS: number;
  feasible: boolean;
  exhaustMS: number;
  massFlowKgS: number;
  thrustN: number;
  extractionPowerW: number;
  /** Plant power allocated to propulsion, including its conversion losses. */
  propulsionInputPowerW: number;
  /** Kinetic power actually carried away by the exhaust. */
  jetPowerW: number;
  extractionPowerFraction: number;
  jetPowerFraction: number;
  operatingSeconds: number | null;
  elapsedYears: number | null;
}

export function estimateFinlay(inputs: FinlayInputs): FinlayEstimate {
  if (!inputs || typeof inputs !== 'object') throw new RangeError('Supply finite Finlay workbench inputs.');
  for (const key of Object.keys(FINLAY_LIMITS) as (keyof FinlayInputs)[]) {
    const value = inputs[key], {min, max} = FINLAY_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${key} must be a finite number between ${min} and ${max}.`);
    }
  }

  const massKg = 4 / 3 * Math.PI * (inputs.radiusKm * 1000) ** 3 * inputs.densityKgM3;
  const availableWaterKg = massKg * inputs.waterFraction;
  // expm1 preserves accuracy for a small requested velocity change.
  const requiredPropellantKg = Math.max(0, -massKg * Math.expm1(-inputs.deltaVKmS / inputs.exhaustKmS));
  const consumedWaterKg = Math.min(requiredPropellantKg, availableWaterKg);
  const remainingWaterKg = Math.max(0, availableWaterKg - requiredPropellantKg);
  const waterShortfallKg = Math.max(0, requiredPropellantKg - availableWaterKg);
  const maxDeltaVKmS = Math.max(0, -inputs.exhaustKmS * Math.log1p(-inputs.waterFraction));
  const feasible = inputs.deltaVKmS <= maxDeltaVKmS;

  const exhaustMS = inputs.exhaustKmS * 1000;
  const kineticJPerKg = exhaustMS ** 2 / 2;
  const propulsionJPerKg = kineticJPerKg / FINLAY_ASSUMPTIONS.jetEfficiency;
  const totalJPerKg = FINLAY_ASSUMPTIONS.extractionJPerKg + propulsionJPerKg;
  const powerW = inputs.powerGW * 1e9;
  const massFlowKgS = powerW / totalJPerKg;
  const extractionPowerFraction = FINLAY_ASSUMPTIONS.extractionJPerKg / totalJPerKg;
  const jetPowerFraction = propulsionJPerKg / totalJPerKg;
  const operatingSeconds = feasible ? requiredPropellantKg / massFlowKgS : null;
  return {
    massKg, availableWaterKg, requiredPropellantKg, consumedWaterKg,
    remainingWaterKg, waterShortfallKg, finalMassKg: massKg - consumedWaterKg,
    maxDeltaVKmS, feasible, exhaustMS, massFlowKgS,
    thrustN: massFlowKgS * exhaustMS,
    extractionPowerW: powerW * extractionPowerFraction,
    propulsionInputPowerW: powerW * jetPowerFraction,
    jetPowerW: massFlowKgS * kineticJPerKg,
    extractionPowerFraction, jetPowerFraction, operatingSeconds,
    elapsedYears: operatingSeconds === null ? null
      : operatingSeconds / FINLAY_ASSUMPTIONS.secondsPerYear / FINLAY_ASSUMPTIONS.dutyCycle,
  };
}

/** Frozen JPL SBDB solution, retrieved 2026-10-08. Not a current ephemeris. */
export const FINLAY_ORBIT = Object.freeze({
  designation: '15P/Finlay',
  aAU: 3.490479431490757,
  e: .7201854360264079,
  perihelionAU: .9766869801813776,
  aphelionAU: 6.004271882800135,
  inclinationDeg: 6.800480403047977,
  ascendingNodeDeg: 13.75387475146649,
  argumentPerihelionDeg: 347.6257499652587,
  meanAnomalyDeg: 46.69096226287624,
  periodDays: 2381.913860522549,
  epochJD: 2457327.5,
  epochScale: 'TDB',
  equinox: 'J2000',
  solutionId: 'K213/18',
  solutionDate: '2024-04-16 11:19:30',
  sourceUrl: 'https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=15P&full-prec=true&phys-par=true',
});

const AU_KM = 149597870.7;
const SOLAR_MU_KM3_S2 = 1.32712440018e11;
const DEG = Math.PI / 180;
const omega = FINLAY_ORBIT.argumentPerihelionDeg * DEG;
const nodeLongitude = FINLAY_ORBIT.ascendingNodeDeg * DEG;
const inclination = FINLAY_ORBIT.inclinationDeg * DEG;
const parameterAU = FINLAY_ORBIT.aAU * (1 - FINLAY_ORBIT.e ** 2);

export interface FinlayVector {x: number; y: number; z: number}

function rotatePerifocal(x: number, y: number, tilt = inclination): FinlayVector {
  const along = x * Math.cos(omega) - y * Math.sin(omega);
  const across = x * Math.sin(omega) + y * Math.cos(omega);
  return {
    x: along * Math.cos(nodeLongitude) - across * Math.cos(tilt) * Math.sin(nodeLongitude),
    y: along * Math.sin(nodeLongitude) + across * Math.cos(tilt) * Math.cos(nodeLongitude),
    z: across * Math.sin(tilt),
  };
}

/** Heliocentric ecliptic coordinates in AU on the frozen two-body reference ellipse. */
export function finlayOrbitPoint(trueAnomalyRad: number): FinlayVector & {radiusAU: number} {
  if (!Number.isFinite(trueAnomalyRad)) throw new RangeError('True anomaly must be finite.');
  const radiusAU = parameterAU / (1 + FINLAY_ORBIT.e * Math.cos(trueAnomalyRad));
  return {...rotatePerifocal(radiusAU * Math.cos(trueAnomalyRad), radiusAU * Math.sin(trueAnomalyRad)), radiusAU};
}

export interface FinlayNode {
  kind: 'ascending' | 'descending';
  trueAnomalyRad: number;
  radiusAU: number;
  radialKmS: number;
  transverseKmS: number;
  speedKmS: number;
  planeChangeKmS: number;
  positionAU: Readonly<FinlayVector>;
  velocityKmS: Readonly<FinlayVector>;
  coplanarVelocityKmS: Readonly<FinlayVector>;
}

function referenceNode(kind: FinlayNode['kind']): Readonly<FinlayNode> {
  // An ecliptic node occurs at argument of latitude omega + f = 0 or pi.
  // Neither node generally coincides with perihelion or aphelion.
  const raw = (kind === 'ascending' ? 0 : Math.PI) - omega;
  const trueAnomalyRad = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const k = Math.sqrt(SOLAR_MU_KM3_S2 / (parameterAU * AU_KM));
  const radialKmS = k * FINLAY_ORBIT.e * Math.sin(trueAnomalyRad);
  const transverseKmS = k * (1 + FINLAY_ORBIT.e * Math.cos(trueAnomalyRad));
  const vx = -k * Math.sin(trueAnomalyRad);
  const vy = k * (FINLAY_ORBIT.e + Math.cos(trueAnomalyRad));
  const point = finlayOrbitPoint(trueAnomalyRad);
  return Object.freeze({
    kind, trueAnomalyRad, radiusAU: point.radiusAU, radialKmS, transverseKmS,
    speedKmS: Math.hypot(radialKmS, transverseKmS),
    // Rotation about the radius leaves radial velocity unchanged. Using total
    // speed here would overestimate the pure plane-change screening impulse.
    planeChangeKmS: 2 * transverseKmS * Math.sin(inclination / 2),
    positionAU: Object.freeze({x: point.x, y: point.y, z: point.z}),
    velocityKmS: Object.freeze(rotatePerifocal(vx, vy)),
    coplanarVelocityKmS: Object.freeze(rotatePerifocal(vx, vy, 0)),
  });
}

const ascending = referenceNode('ascending'), descending = referenceNode('descending');
/** Ideal instantaneous ecliptic alignment only: no rendezvous, timing or capture. */
export const FINLAY_NODES = Object.freeze({
  near: ascending.radiusAU < descending.radiusAU ? ascending : descending,
  far: ascending.radiusAU < descending.radiusAU ? descending : ascending,
});
