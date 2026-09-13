/** Interpretation of recorded results. No independent physics or opaque scores. */
import { DEFAULT, EARTH, MU, spinReference, type Design, type Result } from './engine.js';

export type ChallengeId = 'second-delivery' | 'light-facility' | 'fuel-budget';
export interface Challenge {
  id: ChallengeId; number: string; title: string; question: string; brief: string;
  lesson: string; start: Design; editable: (keyof Design)[];
  payload: number; maxDryT: number; maxFuelT: number; minApogeeKm: number;
}
export const CHALLENGES: Challenge[] = [
  { id: 'second-delivery', number: '01', title: 'Make the second delivery',
    question: 'One throw is not a transport system.',
    brief: 'The first payload gets away. Without recovery, the facility misses its next operating window. Bring it back and deliver again.',
    lesson: 'Open Recovery, select Chemical, then run again. Compare the two flights: switching to Coast removes the fuel mass as well as thrust.',
    start: { ...DEFAULT, recovery: 'none', fuelT: 0 }, editable: ['recovery', 'fuelT', 'thrustN', 'isp'], payload: 3, maxDryT: 110, maxFuelT: 20, minApogeeKm: 8000 },
  { id: 'light-facility', number: '02', title: 'Carry more with less',
    question: 'Find the material–mass trade.',
    brief: 'Move two 5-tonne payloads with less than 100 tonnes of dry facility. Start with a cable that is too weak, then change the material or its section.',
    lesson: 'Keep the dimensions when comparing materials. “Resize for radial load” is an explicit sizing estimate, not a promise that the full flight passes.',
    start: { ...DEFAULT, payloadT: 5, material: 'kevlar', areaMm2: 35 }, editable: ['material', 'areaMm2', 'shape', 'fuelT', 'thrustN', 'isp'], payload: 5, maxDryT: 100, maxFuelT: 20, minApogeeKm: 8000 },
  { id: 'fuel-budget', number: '03', title: 'Spend less on the second flight',
    question: 'How much orbit do you really need?',
    brief: 'Deliver twice above an 8,000 km apogee using at most 12 tonnes of propellant. Change release timing, cable section or the recovery controller.',
    lesson: 'A later release is not automatically better. Sweep release phase, compare the delivered orbit with the propellant bill, and keep the run that meets the mission.',
    start: { ...DEFAULT, fuelT: 12 }, editable: ['releaseDeg', 'areaMm2', 'shape', 'fuelT', 'thrustN', 'isp'], payload: 3, maxDryT: 120, maxFuelT: 12, minApogeeKm: 8000 },
];
export function deliveries(r: Result) {
  return r.deliveries.filter(d => d.perigee >= 120000 && d.gain > 0);
}
export interface Gate { label: string; value: string; pass: boolean }
export function challengeGates(c: Challenge, r: Result): Gate[] {
  const good = deliveries(r);
  const fixed = (Object.keys(DEFAULT) as (keyof Design)[]).every(key => c.editable.includes(key) || r.design[key] === c.start[key]);
  // Existing challenges predate E0 and do not qualify assumed electrical hardware.
  const materialAllowed = ['zylon', 'kevlar'].includes(r.design.material) && r.design.recovery!=='electrodynamic';
  return [
    { label: 'Mission configuration', value: fixed && materialAllowed ? 'Within the stated rules' : 'Outside mission rules · still a valid sandbox experiment', pass: fixed && materialAllowed },
    { label: 'Two successful deliveries', value: `${good.length} / 2`, pass: good.length === 2 && r.outcome === 'complete' },
    { label: `Apogee ≥ ${c.minApogeeKm.toLocaleString('en-US')} km for both`, value: good.length ? good.map(d => d.apogee === null ? 'escape' : `${Math.round(d.apogee / 1000).toLocaleString('en-US')} km`).join(' / ') : 'No qualifying release', pass: good.length === 2 && good.every(d => d.apogee !== null && d.apogee / 1000 >= c.minApogeeKm) },
    { label: `Dry facility ≤ ${c.maxDryT} t`, value: `${(r.dryMass / 1000).toFixed(1)} t`, pass: r.dryMass <= c.maxDryT * 1000 },
    { label: `Loaded propellant ≤ ${c.maxFuelT} t`, value: `${r.design.fuelT.toFixed(1)} t loaded · ${(r.fuelUsed / 1000).toFixed(2)} t spent`, pass: r.design.fuelT <= c.maxFuelT && r.fuelUsed <= c.maxFuelT * 1000 + 0.01 },
    { label: 'Modeled structural & clearance limits', value: `${r.minMargin.toFixed(2)}× margin · ${Math.round(r.minClearance / 1000)} km clearance`, pass: r.minMargin >= 1 && r.minClearance >= 120000 && r.outcome !== 'limit' },
  ];
}
export interface Diagnosis { title: string; explanation: string; action: string; tab: 'structure'|'mission'|'recovery'; time: number }
export function diagnose(r: Result): Diagnosis {
  const cutoff = r.events.find(e => e.kind === 'limit');
  const time = cutoff?.t ?? r.frames.at(-1)?.t ?? 0;
  if (r.outcome === 'limit' && r.minClearance < 120000)
    return { title: 'The tether reaches the model boundary.', explanation: `The closest tether point reached ${(r.minClearance/1000).toFixed(1)} km. Below 120 km, this model stops rather than inventing atmospheric flight.`, action: 'Try a higher initial orbit or a shorter tether. Rerun to check the complete path.', tab:'mission', time };
  if (r.outcome === 'limit' && r.minMargin < 1)
    return { title: 'The cable runs out of load margin.', explanation: `Minimum allowable-to-stress ratio: ${r.minMargin.toFixed(2)}×. The first limiting state is where the assumed allowable was exceeded; no broken-cable motion is simulated.`, action: 'Increase section, compare a stronger material, or lower the payload. Resizing is explicit.', tab:'structure', time };
  if (r.outcome === 'limit')
    return { title: 'This rigid cable would need to push.', explanation:r.reason, action:'Change the orbit or spin and rerun. A flexible-tether model is needed beyond this limit.', tab:'mission', time };
  if (r.outcome === 'rendezvous-missed')
    return { title:'The incoming shipment did not meet the capture checks.', explanation:r.reason, action:'Inspect the approach and its numerical residuals. No payload was attached and no capture impulse was invented.', tab:'mission', time };
  if (r.outcome === 'delivery-failed')
    return { title: 'Release did not meet the delivery criterion.', explanation:r.reason, action:'Try another release phase. Use a release-phase study to compare actual resulting orbits.', tab:'mission', time };
  if (r.outcome === 'complete')
    return { title: 'Two deliveries. One reusable facility.', explanation:r.design.recovery==='electrodynamic'?`Two ideal transfers completed with ${(r.electricalEnergyJ/3.6e9).toFixed(3)} MWh of electrical input and no propellant. This is the E0 circuit experiment, not demonstrated plasma collection or a qualified power system.`:`Both payloads reached higher-energy orbits above the cutoff. The controller used ${(r.fuelUsed/1000).toFixed(2)} t of propellant before the second release.`, action:'Pin this flight, then change one variable. A lighter facility or smaller fuel bill is only useful if the mission still passes.', tab:'structure', time };
  const exhausted = r.events.find(e=>e.kind==='fuel');
  if (exhausted) return { title:'The recovery budget runs out.', explanation:`The thrusters consumed ${(r.fuelUsed/1000).toFixed(2)} t before the facility could complete a second delivery. Nothing refills the tank.`, action:'Try more propellant, different release timing, or a different thrust setting. More thrust is not always more fuel-efficient.', tab:'recovery', time:exhausted.t };
  if (r.design.recovery === 'none') return { title:'One delivery; no second operating window.', explanation:'The payload gained energy, but the coasting facility did not return to the required orbit and spin state within six simulated hours.', action:'Try Chemical recovery. Pin this Coast run first to compare fuel use, added fuel mass, and repeatability.', tab:'recovery', time };
  if(r.design.recovery==='electrodynamic')return {title:'The electrical design has not restored the next handoff.',explanation:`${(r.electricalEnergyJ/3.6e9).toFixed(3)} MWh supplied within the six-hour window. Force depends on orientation, current and voltage as well as power; more bus power alone is not a guarantee.`,action:'Inspect the field-and-power recorder, then run an electrical-power study. Current collection and hardware sizing remain assumptions.',tab:'recovery',time};
  return { title:'The next handoff remains out of reach.', explanation:r.reason, action:'Inspect readiness below and compare controller settings or a less energetic release. This is not a fuel-optimal controller.', tab:'recovery', time };
}
export function readiness(r: Result) {
  const y=r.final, radius=Math.hypot(y[0],y[1]),target=EARTH+r.design.altitudeKm*1000;
  return [
    { label:'Altitude error', value:Math.abs(radius-target)/1000, limit:15, unit:'km' },
    { label:'Radial speed', value:Math.abs((y[0]*y[2]+y[1]*y[3])/radius), limit:8, unit:'m/s' },
    { label:'Tangential-speed error', value:Math.abs((y[0]*y[3]-y[1]*y[2])/radius-Math.sqrt(MU/target)), limit:12, unit:'m/s' },
    { label:'Spin error', value:Math.abs(y[5]/spinReference(y,r.design).omega-1)*100, limit:.5, unit:'%' },
  ];
}
export const FIELD_NAMES: Partial<Record<keyof Design,string>> = { material:'Material',spanKm:'Span',altitudeKm:'Initial altitude',tipSpeedKms:'Spin-tip speed',areaMm2:'Cable section',shape:'Taper',payloadT:'Payload',fuelT:'Fuel budget',recovery:'Recovery',releaseDeg:'Release phase',safetyFactor:'Safety factor',thrustN:'Thrust',isp:'Specific impulse',density:'Density',ultimateGPa:'Ultimate stress',edLengthKm:'Conductor length / arm',edAreaMm2:'Conductor cross-section',edPowerKw:'Bus power cap',edCurrentA:'Circuit current cap',edVoltageKv:'Drive voltage cap',edHardwareT:'Electrical hardware mass' };
export function designChanges(a:Design,b:Design) {
  return (Object.keys(FIELD_NAMES) as (keyof Design)[]).filter(key=>a[key]!==b[key]);
}
export type StudyKind = 'electrical'|'recovery'|'material'|'release'|'payload';
export const STUDY_LABELS: Record<StudyKind,string> = { electrical:'Electrical power cap',recovery:'Recovery strategy',material:'Material at fixed dimensions',release:'Release phase',payload:'Payload mass' };
export function studyDesigns(d:Design,kind:StudyKind):{label:string;design:Design}[] {
  switch(kind) {
    case 'electrical': return [100,250,500,1000].map(edPowerKw=>({label:`${edPowerKw} kW bus`,design:{...d,recovery:'electrodynamic',fuelT:0,edPowerKw}}));
    case 'recovery': return [{label:'Coast · no fuel',design:{...d,recovery:'none',fuelT:0}}, {label:'Chemical · 20 t',design:{...d,recovery:'chemical',fuelT:20}}, {label:'Electrodynamic · E0',design:{...d,recovery:'electrodynamic',fuelT:0}}];
    case 'material': return ['kevlar','zylon','future'].map(material=>({label:material==='future'?'Hypothetical carbon':material==='kevlar'?'Kevlar 49':'Zylon HM',design:{...d,material}}));
    case 'release': return [120,150,180,210].map(releaseDeg=>({label:`${releaseDeg}° release`,design:{...d,releaseDeg}}));
    case 'payload': return [.5,1,1.5,2].map(f=>({label:`${Math.min(250,Math.max(.1,Math.round(d.payloadT*f*10)/10))} t`,design:{...d,payloadT:Math.min(250,Math.max(.1,Math.round(d.payloadT*f*10)/10))}})).filter((v,i,a)=>a.findIndex(x=>x.label===v.label)===i);
  }
}
