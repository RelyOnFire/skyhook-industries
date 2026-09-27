import { useEffect, useRef, useState } from 'react';
import type { EarthDesignReport } from '../simulation/expedition-design.js';
import { designFragment } from '../simulation/design-io.js';
import { commissionEarthDesign, earthDesignCommissionReason, tetherRecoveryDays, type Campaign } from './model.js';
import type { Act } from './Operations.js';

const n=(v:number,digits=1)=>v.toLocaleString('en-US',{maximumFractionDigits:digits});
export default function EarthDesign({world,source,busy,saveError,act,onClose}:{world:Campaign;source:string|null;busy:boolean;saveError:string;act:Act;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [report,setReport]=useState<EarthDesignReport|null>(null),[error,setError]=useState('');
  const [calculating,setCalculating]=useState(!!source),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close();},[]);
  useEffect(()=>{
    if(!source)return;
    setCalculating(true);setReport(null);setError('');
    let worker:Worker;
    try {
      worker=new Worker(new URL('./earth-design-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=e=>{setCalculating(false);setReport(e.data.report??null);setError(e.data.error??'');worker.terminate();};
      worker.onerror=()=>{setCalculating(false);setError('The calculation worker could not start. Retry or return to Flight Studio.');worker.terminate();};
      worker.postMessage(source);
    } catch {setCalculating(false);setError('The calculation worker could not start. Retry or return to Flight Studio.');}
    return()=>worker?.terminate();
  },[source,attempt]);
  const installed=world.earthDesign,shown=installed??report,reason=earthDesignCommissionReason(world);
  return <dialog ref={dialog} className="earth-design-dialog" aria-labelledby="earth-design-heading" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><span className="campaign-eyebrow">EARTH / FLIGHT STUDIO</span><button onClick={onClose} aria-label="Close Earth design">×</button></header>
    <h2 id="earth-design-heading">{installed?'Your commissioned design':'From experiment to operations'}</h2>
    <p className="design-intro">{installed?'Earth’s turnaround upgrade is active.':'Commission a flown Earth design in '+world.name+'.'}</p>
    {saveError&&<p role="alert">{saveError} Return to the network to retry saving or export unsaved progress.</p>}
    {!installed&&calculating&&<p role="status">Rechecking both deliveries in Flight Studio’s numerical model…</p>}
    {!installed&&error&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(a=>a+1)}>Retry calculation</button></div>}
    {shown&&<section aria-label="Measured Lab results"><p className="campaign-eyebrow">MEASURED IN THE LAB · {shown.model}</p><h3>Two successful deliveries</h3>
      <dl className="design-measurements">
        <div><dt>Tested payload</dt><dd>{n(shown.payloadT)} t</dd></div>
        <div><dt>Between deliveries</dt><dd>{n(shown.deliveryIntervalS/60)} min</dd></div>
        <div><dt>Lowest clearance</dt><dd>{n(shown.minClearanceKm)} km</dd></div>
        <div><dt>Minimum load margin</dt><dd>{n(shown.minMargin,2)}×</dd></div>
        <div><dt>Recovery propellant used</dt><dd>{n(shown.fuelUsedT,2)} t</dd></div>
        <div><dt>Least specific energy gained</dt><dd>{n(shown.minEnergyGainKJkg)} kJ/kg</dd></div>
      </dl><a href={'/lab/'+designFragment(shown.design)}>Inspect this exact design in Flight Studio ↗</a></section>}
    <section aria-label="Campaign upgrade"><p className="campaign-eyebrow">EXPEDITIONS UPGRADE · GAME RULES</p><h3>20% shorter Earth recovery</h3>
      <p>Earth’s reservation after each new tether booking: <strong>{n(2/world.ports.earth.level,2)} → {n(2/world.ports.earth.level*.8,2)} days</strong> at tier {world.ports.earth.level}. The other endpoint must also be ready.</p>
      <p>The tested payload and recovery time describe the local experiment. Campaign capacity, support fuel and transfer times keep their existing rules. This fixed bonus does not scale with Lab measurements or validate a destination encounter.</p>
      <p className="design-cost">One-time construction: <strong>40 t material + 10 t equipment</strong> at Earth.</p>
      {installed?<p role="status">Commissioned · Earth recovery {n(tetherRecoveryDays(world,'earth'),2)} days. Existing reservations finish as booked.</p>:<>
        <button className="primary" disabled={busy||calculating||!report||!!reason} onClick={()=>{if(report)act(w=>commissionEarthDesign(w,report));}}>Commission Earth design</button>
        {reason&&<p>{reason}</p>}
        {!source&&<p>Complete two successful deliveries in the Earth Studio, then choose “Use this design in Expeditions.” <a href="/lab/">Open Earth Flight Studio ↗</a></p>}
        <p className="tiny">Reviewing a design spends nothing. Commissioning preserves cargo in flight and current recovery reservations.</p>
      </>}
    </section>
    <button onClick={onClose}>Back to network</button>
  </dialog>;
}
