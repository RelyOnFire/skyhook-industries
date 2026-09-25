/** Frozen physical constants and explicit experiment limits, in SI units.
 * Moon GM: JPL DE440; mean radius and sidereal rotation: NASA Moon Fact Sheet.
 * The clearance/readiness tolerances are scenario choices, not terrain guarantees.
 */
export interface Environment {
  id: 'earth' | 'moon'; name: string; radius: number; mu: number;
  cutoff: number; rotationRate: number;
  radiusTolerance: number; radialTolerance: number; tangentialTolerance: number;
}
export const EARTH_ENV: Environment = {
  id:'earth',name:'Earth',radius:6371000,mu:3.986004418e14,cutoff:120000,
  rotationRate:7.292115e-5,radiusTolerance:15000,radialTolerance:8,tangentialTolerance:12,
};
export const MOON_ENV: Environment = {
  id:'moon',name:'Moon',radius:1737400,mu:4.902800118e12,cutoff:10000,
  rotationRate:2*Math.PI/(655.720*3600),radiusTolerance:2000,radialTolerance:2,tangentialTolerance:3,
};
export const environment = (design:{architecture:string}):Environment =>
  design.architecture==='lunar-rotovator'?MOON_ENV:EARTH_ENV;
