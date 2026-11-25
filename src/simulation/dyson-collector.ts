// IAU 2015 Resolution B3 (nominal irradiance at 1 au) and NIST CODATA 2022.
export const SOLAR_IRRADIANCE_W_M2 = 1361;
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8;
// IAU nominal solar radius in metres divided by the defined astronomical unit.
const SOLAR_RADIUS_AU = 695700000 / 149597870700;

export const COLLECTOR_FIELDS = [
  { key: 'radiusAU', label: 'Distance from the Sun', unit: 'AU', min: .2, max: 2, initial: .4 },
  { key: 'limitC', label: 'Operating temperature ceiling', unit: '°C', min: 0, max: 200, initial: 100 },
  { key: 'efficiencyPct', label: 'Electrical efficiency', unit: '%', min: 1, max: 50, initial: 25 },
  { key: 'absorptancePct', label: 'Solar absorptance', unit: '%', min: 1, max: 100, initial: 85 },
  { key: 'emissivityPct', label: 'Infrared emissivity of each face', unit: '%', min: 1, max: 100, initial: 80 },
  { key: 'densityKgM2', label: 'Deployed panel mass per area', unit: 'kg/m²', min: .1, max: 50, initial: 3 },
] as const;

export type CollectorInputs = Record<(typeof COLLECTOR_FIELDS)[number]['key'], number>;
export const COLLECTOR_DEFAULTS = Object.fromEntries(COLLECTOR_FIELDS.map(field => [field.key, field.initial])) as CollectorInputs;

export function screenCollector(inputs: CollectorInputs) {
  for (const field of COLLECTOR_FIELDS) {
    const value = inputs[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      throw new RangeError(`Enter ${field.label.toLowerCase()} between ${field.min} and ${field.max} ${field.unit}.`);
    }
  }
  if (inputs.efficiencyPct >= inputs.absorptancePct) {
    throw new RangeError('Solar absorptance must exceed electrical efficiency for this heat-producing panel model.');
  }

  // Both fractions refer to incident sunlight over the full panel aperture.
  const efficiency = inputs.efficiencyPct / 100;
  const heatFraction = (inputs.absorptancePct - inputs.efficiencyPct) / 100;
  const emissionFactor = 2 * (inputs.emissivityPct / 100) * STEFAN_BOLTZMANN_W_M2_K4;
  const limitK = inputs.limitC + 273.15;
  const solarWm2 = SOLAR_IRRADIANCE_W_M2 / inputs.radiusAU ** 2;
  const heatLimitWm2 = emissionFactor * limitK ** 4;
  const incidentWm2 = Math.min(solarWm2, heatLimitWm2 / heatFraction);
  const dcWm2 = incidentWm2 * efficiency;
  const panelAreaM2 = 1e6 / dcWm2;
  const tiltRad = Math.acos(incidentWm2 / solarWm2);
  const sunAngularRadiusRad = Math.asin(SOLAR_RADIUS_AU / inputs.radiusAU);
  return {
    solarWm2, incidentWm2, dcWm2, panelAreaM2,
    panelMassKg: panelAreaM2 * inputs.densityKgM2,
    heatWm2: incidentWm2 * heatFraction,
    faceOnC: (solarWm2 * heatFraction / emissionFactor) ** .25 - 273.15,
    tiltDeg: tiltRad * 180 / Math.PI,
    wholeSunInFront: tiltRad + sunAngularRadiusRad < Math.PI / 2,
    crossoverAU: Math.sqrt(SOLAR_IRRADIANCE_W_M2 * heatFraction / heatLimitWm2),
    thermalLimited: incidentWm2 < solarWm2,
  };
}
