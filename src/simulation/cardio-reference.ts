/** HASTOL CardioRotovator kinematic reference, not a controlled-flight solution.
 * The station follows a Kepler ellipse and the arm makes exactly two inertial
 * turns per orbit. No cable mass, pickup impulse, loads or controller is solved.
 * Source: HASTOL Phase I, Appendix A1-9, Figure 1 and p = P/2.
 * https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf#page=70
 */
import {EARTH, MU} from './engine.js';

export interface CardioReferenceDesign {perigeeKm:number; apogeeKm:number; pickupKm:number}
export const CARDIO_REFERENCE_DEFAULT:CardioReferenceDesign = {
  perigeeKm:200, apogeeKm:2200, pickupKm:100,
};
export const CARDIO_REFERENCE_BOUNDS = {
  perigeeKm:[150,2000], apogeeKm:[500,6000], pickupKm:[80,500],
} as const;

export function validateCardioReference(value:unknown):CardioReferenceDesign {
  if(!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Expected a CardioRotovator reference geometry.');
  const input=value as CardioReferenceDesign;
  const design={} as CardioReferenceDesign;
  for(const [key,[low,high]] of Object.entries(CARDIO_REFERENCE_BOUNDS)) {
    const field=key as keyof CardioReferenceDesign, n=input[field];
    if(typeof n !== 'number' || !Number.isFinite(n) || n<low || n>high)
      throw Error(`${key} must be between ${low} and ${high} km.`);
    design[field]=n;
  }
  if(design.apogeeKm<=design.perigeeKm) throw Error('Station apogee must be above perigee.');
  if(design.apogeeKm<=design.pickupKm) throw Error('Station apogee must be above the pickup altitude.');
  return design;
}

export interface CardioReferenceOrbit {
  period:number; length:number; semiMajor:number; eccentricity:number;
}
export function cardioReferenceOrbit(input:CardioReferenceDesign):CardioReferenceOrbit {
  const design=validateCardioReference(input);
  const apogee=EARTH+design.apogeeKm*1000, perigee=EARTH+design.perigeeKm*1000;
  const semiMajor=(apogee+perigee)/2;
  return {
    period:2*Math.PI*Math.sqrt(semiMajor**3/MU),
    length:(design.apogeeKm-design.pickupKm)*1000,
    semiMajor, eccentricity:(apogee-perigee)/(apogee+perigee),
  };
}

/** Coordinates and velocities are Earth-inertial SI. Angles are radians.
 * The station starts at +x apogee moving +y. The arm starts inward, at pi.
 * Orbital anomalies are measured from the -x perigee and wrapped to [0, 2pi).
 * Arm angle is unwrapped so one orbital period advances it by 4pi.
 */
export interface CardioReferenceSample {
  t:number; station:[number,number,number,number]; tip:[number,number,number,number];
  angle:number; spinRate:number; trueAnomaly:number; meanAnomaly:number;
  eccentricAnomaly:number; tipAltitude:number; tipSpeed:number; clearance:number;
}
const TAU=2*Math.PI;
const wrap=(angle:number)=>((angle%TAU)+TAU)%TAU;

function sample(orbit:CardioReferenceOrbit,t:number):CardioReferenceSample {
  if(!Number.isFinite(t)) throw Error('Reference time must be finite.');
  const {period,length,semiMajor:a,eccentricity:e}=orbit;
  const n=TAU/period, fraction=((t%period)+period)%period/period;
  const M=wrap(Math.PI+TAU*fraction);
  let E=M;
  for(let iteration=0;iteration<20;iteration++) {
    const correction=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
    E-=correction;
    if(Math.abs(correction)<1e-14) break;
  }
  const b=a*Math.sqrt(1-e*e), eccentricRate=n/(1-e*Math.cos(E));
  const station:[number,number,number,number]=[
    a*(e-Math.cos(E)), -b*Math.sin(E),
    a*Math.sin(E)*eccentricRate, -b*Math.cos(E)*eccentricRate,
  ];
  // p=P/2 gives omega=4pi/P, and the tip speed relative to the station is omega*L.
  // Derive this directly: the source's printed final tip-speed equality has a typo.
  const spinRate=2*n, angle=Math.PI+spinRate*t;
  const phase=Math.PI+2*TAU*fraction, c=Math.cos(phase), s=Math.sin(phase);
  const tip:[number,number,number,number]=[
    station[0]+length*c, station[1]+length*s,
    station[2]-length*spinRate*s, station[3]+length*spinRate*c,
  ];
  // Closest point on the complete station-to-tip segment, including its interior.
  const along=Math.max(0,Math.min(length,-station[0]*c-station[1]*s));
  return {
    t,station,tip,angle,spinRate,
    trueAnomaly:wrap(Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e)),
    meanAnomaly:M,eccentricAnomaly:wrap(E),
    tipAltitude:Math.hypot(tip[0],tip[1])-EARTH,tipSpeed:Math.hypot(tip[2],tip[3]),
    clearance:Math.hypot(station[0]+along*c,station[1]+along*s)-EARTH,
  };
}

export function cardioReferenceSample(design:CardioReferenceDesign,time:number):CardioReferenceSample {
  return sample(cardioReferenceOrbit(design),time);
}

export interface CardioReferenceSummary extends CardioReferenceOrbit {
  minClearance:number; minTipAltitude:number; minClearanceTime:number;
  pickupSpeed:number; perigeeTipAltitude:number; sampleCount:number;
}
/** Sampled geometric minimum, not a continuous clearance proof or flight check. */
export function cardioReferenceSummary(design:CardioReferenceDesign,samples=4096):CardioReferenceSummary {
  if(!Number.isInteger(samples)||samples<128||samples>32768)
    throw Error('Reference clearance needs between 128 and 32768 sample intervals.');
  const orbit=cardioReferenceOrbit(design),start=sample(orbit,0);
  let minClearance=start.clearance,minTipAltitude=start.tipAltitude,minClearanceTime=0;
  for(let i=1;i<=samples;i++) {
    const frame=sample(orbit,orbit.period*i/samples);
    if(frame.clearance<minClearance-1e-7) {minClearance=frame.clearance;minClearanceTime=frame.t;}
    minTipAltitude=Math.min(minTipAltitude,frame.tipAltitude);
  }
  return {...orbit,minClearance,minTipAltitude,minClearanceTime,
    pickupSpeed:start.tipSpeed,perigeeTipAltitude:sample(orbit,orbit.period/2).tipAltitude,
    sampleCount:samples+1};
}
