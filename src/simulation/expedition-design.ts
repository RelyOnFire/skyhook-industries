import { MODEL, validate, type Design, type Result } from './engine.js';

/** A small, versioned record of a local Earth experiment, not a route certificate. */
export interface EarthDesignReport {
  version: 1; model: typeof MODEL; design: Design;
  payloadT: number; deliveryIntervalS: number; minClearanceKm: number;
  minMargin: number; fuelUsedT: number; minEnergyGainKJkg: number;
}
export function earthDesignReason(result: Result): string {
  if (result.model !== MODEL || result.design.architecture !== 'single-stage-rotovator') return 'Use a current Earth rotovator experiment.';
  if (result.outcome !== 'complete' || result.deliveries.length !== 2 || result.rendezvous.length !== 2 || result.rendezvous.some(r => !r.accepted)) return 'Complete two successful deliveries, including recovery and both captures, first.';
  if (result.minClearance < 120000 || result.minMargin < 1 || result.deliveries.some(d => d.gain <= 0 || d.perigee < 120000)) return 'Both deliveries must pass the clearance, load and orbit checks.';
  return '';
}
export function earthDesignReport(result: Result): EarthDesignReport {
  const reason = earthDesignReason(result); if (reason) throw Error(reason);
  return validateEarthDesignReport({version:1,model:MODEL,design:result.design,payloadT:result.design.payloadT,
    deliveryIntervalS:result.deliveries[1].t-result.deliveries[0].t,minClearanceKm:result.minClearance/1000,
    minMargin:result.minMargin,fuelUsedT:result.fuelUsed/1000,minEnergyGainKJkg:Math.min(...result.deliveries.map(d=>d.gain))/1000});
}
export function validateEarthDesignReport(value: unknown): EarthDesignReport {
  if (!value || typeof value !== 'object') throw Error('Invalid Earth design report.');
  const r = value as EarthDesignReport;
  if (r.version !== 1 || r.model !== MODEL) throw Error('Unsupported Earth design report.');
  const design = validate(r.design);
  if (design.architecture !== 'single-stage-rotovator' || design.model !== MODEL || r.payloadT !== design.payloadT) throw Error('Earth design and tested payload do not match.');
  const bound = (n:number,lo:number,hi:number) => {if (!Number.isFinite(n) || n < lo || n > hi) throw Error('Invalid Earth design measurement.');return n;};
  return {version:1,model:MODEL,design,payloadT:design.payloadT,deliveryIntervalS:bound(r.deliveryIntervalS,1,21600),
    minClearanceKm:bound(r.minClearanceKm,120,100000),minMargin:bound(r.minMargin,1,1e9),
    fuelUsedT:bound(r.fuelUsedT,0,design.fuelT),minEnergyGainKJkg:bound(r.minEnergyGainKJkg,Number.EPSILON,1e9)};
}
/** Carry inputs only. Expeditions recomputes the report in its own worker. */
export function earthDesignUrl(result: Result) {
  earthDesignReport(result);
  return '/lab/campaign/#earth-design='+encodeURIComponent(JSON.stringify(validate(result.design)));
}
