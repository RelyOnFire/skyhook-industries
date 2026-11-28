import { useEffect, useRef, useState } from 'react';
import type { EarthDesignReport } from '../simulation/expedition-design.js';
import { designFragment } from '../simulation/design-io.js';
import { commissionEarthDesign, earthDesignCommissionReason, earthDesignCost, earthDesignPerformance, earthRouteFuelFactor, restoreStandardEarth, tetherCapacity, tetherRecoveryDays, type Campaign } from './model.js';
import type { Act } from './Operations.js';

const n=(v:number,digits=2)=>v.toLocaleString('en-US',{maximumFractionDigits:digits});
export default function EarthDesign({world,source,busy,saveError,act,onClose}:{world:Campaign;source:string|null;busy:boolean;saveError:string;act:Act;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),installed=world.earthDesign;
  const inputs=source??(installed?.version===1?JSON.stringify(installed.design):null);
  const [report,setReport]=useState<EarthDesignReport|null>(null),[error,setError]=useState('');
  const [calculating,setCalculating]=useState(!!inputs),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close();},[]);
  useEffect(()=>{
    setReport(null);setError('');setCalculating(!!inputs);
    if(!inputs)return;
    let worker:Worker;
    try {
      worker=new Worker(new URL('./earth-design-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=e=>{setCalculating(false);setReport(e.data.report??null);setError(e.data.error??'');worker.terminate();};
      worker.onerror=()=>{setCalculating(false);setError('The calculation worker could not start. Retry or return to Flight Studio.');worker.terminate();};
      worker.postMessage(inputs);
    } catch {setCalculating(false);setError('The calculation worker could not start. Retry or return to Flight Studio.');}
    return()=>worker?.terminate();
  },[inputs,attempt]);
  const candidate=report&&JSON.stringify(report)!==JSON.stringify(installed)?report:null;
  const shown=candidate??installed,level=world.ports.earth.level;
  const reason=candidate?earthDesignCommissionReason(world,candidate):'';
  const proposed=shown?earthDesignPerformance(shown,level):null,cost=candidate?earthDesignCost(world,candidate):null;
  const affected=candidate?world.services.filter(s=>s.mode==='tether'&&(s.from==='earth'||s.to==='earth')&&s.cargoT>Math.min(proposed!.capacity,tetherCapacity(world,s.from==='earth'?s.to:s.from))):[];
  return <dialog ref={dialog} className="earth-design-dialog" aria-labelledby="earth-design-heading" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><span className="campaign-eyebrow">EARTH / FLIGHT STUDIO</span><button onClick={onClose} aria-label="Close Earth design">×</button></header>
    <h2 id="earth-design-heading">{candidate?'Compare your Earth design':installed?'Your commissioned design':'From experiment to operations'}</h2>
    <p className="design-intro">Payload, turnaround, operating fuel and construction cost come from the flown design. Compare the tradeoffs before commissioning in {world.name}.</p>
    {saveError&&<p role="alert">{saveError} Return to the network to retry saving or export unsaved progress.</p>}
    {installed?.version===1&&<p className="design-legacy">Your earlier 20% upgrade stays active until you choose a replacement. Its original 40 t material and 10 t equipment payment is credited once toward this conversion; unused credit is not refunded.</p>}
    {calculating&&<p role="status">Rechecking both deliveries in Flight Studio’s numerical model…</p>}
    {error&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(a=>a+1)}>Retry calculation</button></div>}
    {proposed&&<section aria-label="Campaign performance"><p className="campaign-eyebrow">EARTH TIER {level} / CAMPAIGN PERFORMANCE</p>
      <table className="design-comparison"><thead><tr><th scope="col">Capability</th><th scope="col">Current</th><th scope="col">{candidate?'Candidate':'Active'}</th></tr></thead><tbody>
        <tr><th scope="row">Cargo per booking</th><td>{n(tetherCapacity(world,'earth'))} t</td><td data-testid="design-capacity">{n(proposed.capacity)} t</td></tr>
        <tr><th scope="row">Recovery reservation</th><td>{n(tetherRecoveryDays(world,'earth'))} d</td><td data-testid="design-recovery">{n(proposed.recoveryDays)} d</td></tr>
        <tr><th scope="row">Earth corridor fuel</th><td>{n(earthRouteFuelFactor(world,'earth','moon'))}×</td><td data-testid="design-fuel">{n(proposed.fuelFactor)}×</td></tr>
      </tbody></table>
      <p>Each corridor is limited by its smaller endpoint. Both tethers must recover before another booking. Fuel is relative to the standard tether allocation on routes involving Earth; tugs and other corridors keep their rates.</p>
      {candidate&&proposed.capacity<=tetherCapacity(world,'earth')&&proposed.recoveryDays>=tetherRecoveryDays(world,'earth')&&proposed.fuelFactor>=earthRouteFuelFactor(world,'earth','moon')&&<p className="design-warning">This candidate offers no capacity, recovery or fuel improvement over your current fleet.</p>}
      {!!affected.length&&<p className="design-warning">Services {affected.map(s=>'#'+s.id).join(', ')} exceed the candidate corridor capacity and will wait until you reduce their payload or change the design. Their schedules and cargo already in flight will be preserved.</p>}
      {candidate&&cost?<><p className="design-cost">{installed?'Replacement':'Construction'} cost at Earth: <strong>{n(cost.materialsT)} t material + {n(cost.equipmentT)} t equipment</strong>{cost.credit?' · prior payment credited':''}.</p>
        <button className="primary" disabled={busy||calculating||!!reason} onClick={()=>act(w=>commissionEarthDesign(w,candidate))}>{installed?'Replace Earth design':'Commission Earth design'}</button>
        {reason&&<p>{reason}</p>}
      </>:installed&&<p role="status">Commissioned · Earth recovery {n(tetherRecoveryDays(world,'earth'))} days. Existing reservations finish as booked.</p>}
      <p className="tiny">Only commissioning changes the fleet. Existing flights, recovery reservations and transfer times stay intact. Replacements pay their displayed construction cost; there is no salvage refund.</p>
    </section>}
    {shown&&<details className="design-measured"><summary>Measured results & campaign scaling</summary>
      <p className="campaign-eyebrow">TWO SUCCESSFUL DELIVERIES · {shown.model}</p>
      <dl className="design-measurements">
        <div><dt>Tested payload</dt><dd>{n(shown.payloadT)} t</dd></div>
        <div><dt>Between deliveries</dt><dd>{n(shown.deliveryIntervalS/60,1)} min</dd></div>
        <div><dt>Lowest clearance</dt><dd>{n(shown.minClearanceKm,1)} km</dd></div>
        <div><dt>Minimum load margin</dt><dd>{n(shown.minMargin)}×</dd></div>
        <div><dt>Recovery propellant</dt><dd>{n(shown.fuelUsedT)} t</dd></div>
        {shown.version===2&&<div><dt>Dry structure & hardware</dt><dd>{n(shown.dryMassT)} t</dd></div>}
      </dl><p>We scale against the reference Earth design: 3 t payload, 288.7 min between deliveries, 13.615 t recovery propellant and 108.88 t dry mass. The reference gives standard performance, with no import bonus.</p>
      <p>Payload scales Earth’s tier rating (whole tonnes, minimum 1, maximum 3× the tier rating). The measured delivery interval scales recovery (¼–4× standard). Propellant per payload tonne scales Earth’s half of corridor fuel (0–4× that half). Dry mass scales the 40 t material / 10 t equipment reference cost, rounded up.</p>
      <p>These are campaign scaling rules applied to a local experiment. They do not solve interplanetary targeting or convert measured energy gain into a validated route. Electrical energy is not a campaign operating resource.</p>
      <a href={'/lab/'+designFragment(shown.design)}>Inspect this exact design in Flight Studio ↗</a>
    </details>}
    {!inputs&&!candidate&&<p>Fly a different design and choose “Use this design in Expeditions” to compare it here. <a href="/lab/">Open Earth Flight Studio ↗</a></p>}
    {installed&&<div className="design-restore"><p>Standard fleet: {level*10} t, {n(2/level)} d recovery, 1× corridor fuel. Switching back is free and preserves current reservations.</p><button disabled={busy} onClick={()=>{setReport(null);act(restoreStandardEarth);}}>Restore standard Earth fleet</button></div>}
    <button onClick={onClose}>Back to network</button>
  </dialog>;
}
