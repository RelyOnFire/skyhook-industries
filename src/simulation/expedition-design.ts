import { MODEL, validate, compile, type Design, type Result } from './engine.js';

/** A small, versioned record of a local Earth experiment, not a route certificate. */
interface ReportMeasurements {
  model: typeof MODEL; design: Design;
  payloadT: number; deliveryIntervalS: number; minClearanceKm: number;
  minMargin: number; fuelUsedT: number; minEnergyGainKJkg: number;
}
export type EarthDesignReport = ReportMeasurements & ({version:1} | {version:2;dryMassT:number});
export type PerformanceDesignReport = EarthDesignReport & {version:2};
export function earthDesignReason(result: Result): string {
  if (result.model !== MODEL || result.design.architecture !== 'single-stage-rotovator') return 'Use a current Earth rotovator experiment.';
  if (result.outcome !== 'complete' || result.deliveries.length !== 2 || result.rendezvous.length !== 2 || result.rendezvous.some(r => !r.accepted)) return 'Complete two successful deliveries, including recovery and both captures, first.';
  if (result.minClearance < 120000 || result.minMargin < 1 || result.deliveries.some(d => d.gain <= 0 || d.perigee < 120000)) return 'Both deliveries must pass the clearance, load and orbit checks.';
  return '';
}
export function earthDesignReport(result: Result): PerformanceDesignReport {
  const reason = earthDesignReason(result); if (reason) throw Error(reason);
  return validateEarthDesignReport({version:2,dryMassT:compile(result.design,0,false,48).mass/1000,model:MODEL,design:result.design,payloadT:result.design.payloadT,
    deliveryIntervalS:result.deliveries[1].t-result.deliveries[0].t,minClearanceKm:result.minClearance/1000,
    minMargin:result.minMargin,fuelUsedT:result.fuelUsed/1000,minEnergyGainKJkg:Math.min(...result.deliveries.map(d=>d.gain))/1000}) as PerformanceDesignReport;
}
export function validateEarthDesignReport(value: unknown): EarthDesignReport {
  if (!value || typeof value !== 'object') throw Error('Invalid Earth design report.');
  const r = value as EarthDesignReport;
  if ((r.version !== 1 && r.version !== 2) || r.model !== MODEL) throw Error('Unsupported Earth design report.');
  const design = validate(r.design);
  if (design.architecture !== 'single-stage-rotovator' || design.model !== MODEL || r.payloadT !== design.payloadT) throw Error('Earth design and tested payload do not match.');
  const bound = (n:number,lo:number,hi:number) => {if (!Number.isFinite(n) || n < lo || n > hi) throw Error('Invalid Earth design measurement.');return n;};
  const clean:ReportMeasurements = {model:MODEL,design,payloadT:design.payloadT,deliveryIntervalS:bound(r.deliveryIntervalS,1,21600),
    minClearanceKm:bound(r.minClearanceKm,120,100000),minMargin:bound(r.minMargin,1,1e9),
    fuelUsedT:bound(r.fuelUsedT,0,design.fuelT),minEnergyGainKJkg:bound(r.minEnergyGainKJkg,Number.EPSILON,1e9)};
  if(r.version===1)return {version:1,...clean};
  const dryMassT=compile(design,0,false,48).mass/1000;
  if(!Number.isFinite(r.dryMassT)||Math.abs(r.dryMassT-dryMassT)>1e-6)throw Error('Earth design hardware mass does not match its structure.');
  return {version:2,...clean,dryMassT};
}
/** Carry inputs only. Expeditions recomputes the report in its own worker. */
export function earthDesignUrl(result: Result) {
  earthDesignReport(result);
  return '/lab/campaign/#earth-design='+encodeURIComponent(JSON.stringify(validate(result.design)));
}
