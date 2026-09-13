import { diagnose, deliveries, challengeGates, readiness, FIELD_NAMES, designChanges, type Challenge } from '../simulation/insights.js';
import { type Result } from '../simulation/engine.js';
import { elapsed } from './view.js';
import { Modal } from './Missions.js';
const f=(n:number,d=1)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
export default function Debrief({result:r,baseline,challenge,onClose,onEdit,onJump,onPin,onCompare,onRestore,canStudy}:{
  canStudy:boolean;result:Result;baseline:Result|null;challenge:Challenge|null;onClose:()=>void;
  onEdit:(tab:'structure'|'mission'|'recovery')=>void;onJump:(t:number)=>void;onPin:()=>void;onCompare:()=>void;onRestore:(r:Result)=>void;
}) {
  const diagnosis=diagnose(r),gates=challenge?challengeGates(challenge,r):[], good=deliveries(r),passed=!!gates.length&&gates.every(g=>g.pass);
  const delta=baseline?designChanges(baseline.design,r.design):[];
  const download=()=>{
    const report={format:'tether-lab-flight-report',version:3,model:r.model,design:r.design,numerics:{stepSeconds:r.maxStep,cells:r.cells},outcome:r.outcome,reason:r.reason,deliveries:r.deliveries,approaches:r.approaches,rendezvous:r.rendezvous,dryMassKg:r.dryMass,propellantUsedKg:r.fuelUsed,electrical:{model:r.design.recovery==='electrodynamic'?'E0-equatorial':null,busEnergyJ:r.electricalEnergyJ,mechanicalWorkJ:r.electricalWorkJ,heatAndDumpJ:r.electricalHeatJ,environmentExchangeJ:r.environmentEnergyJ,conductorMassKg:r.conductorMass,hardwareBudgetKg:r.electricalHardwareMass},minClearanceM:r.minClearance,minAxialMargin:r.minMargin,events:r.events,challenge:challenge?{id:challenge.id,passed,gates}:null,limitations:'Planar rigid-body educational model. Constructed, independently propagated ideal approaches with numerical capture checks; no atmosphere, elasticity, guidance, debris or return-traffic recovery. E0 electrodynamics assumes equatorial dipole, corotating plasma closure and constant electrical supply; no plasma, thermal, eclipse or power-system sizing prediction.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tether-lab-flight-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <Modal title="Flight debrief" onClose={onClose} wide>
    <div className="debrief-lead"><span className={`result-label ${r.outcome==='complete'?'result-good':''}`}>{r.outcome==='complete'?'MISSION COMPLETE':r.outcome==='limit'?'MODELED LIMIT':'MISSION INCOMPLETE'}</span><h3>{diagnosis.title}</h3><p>{diagnosis.explanation}</p></div>
    <div className="receipt"><div><span>Delivered</span><strong>{good.length}<small> / 2</small></strong></div><div><span>{r.design.recovery==='electrodynamic'?'Electrical input':'Propellant spent'}</span><strong>{r.design.recovery==='electrodynamic'?f(r.electricalEnergyJ/3.6e9,3):f(r.fuelUsed/1000,2)}<small>{r.design.recovery==='electrodynamic'?' MWh':' t'}</small></strong></div><div><span>Dry facility</span><strong>{f(r.dryMass/1000)}<small> t</small></strong></div><div><span>Simulated duration</span><strong>{elapsed(r.frames.at(-1)?.t??0)}</strong></div></div>
    {r.design.recovery==='electrodynamic'&&<section className="electrical-ledger"><h4>Where the electrical energy went</h4><dl>
      <div><dt>Bus input</dt><dd>{f(r.electricalEnergyJ/1e9,3)} GJ</dd></div>
      <div><dt>Environment → facility (signed)</dt><dd>{f(r.environmentEnergyJ/1e9,3)} GJ</dd></div>
      <div><dt>Lorentz work on orbit + spin (signed)</dt><dd>{f(r.electricalWorkJ/1e9,3)} GJ</dd></div>
      <div><dt>Resistive, contact, conversion & dump losses</dt><dd>{f(r.electricalHeatJ/1e9,3)} GJ</dd></div>
    </dl><p>Bus input + environment exchange = mechanical work + losses. This is accumulated actuator work, not payload energy gain or a temperature prediction. Electrical system: {f(r.conductorMass/1000,2)} t conductor + {f(r.electricalHardwareMass/1000,2)} t user-budgeted hardware.</p><a href="/lab/method/#electrodynamic">Read the circuit assumptions ↗</a></section>}
    <div className="debrief-columns"><section><h4>The next experiment</h4><p>{diagnosis.action}</p><div className="debrief-buttons"><button className="primary" onClick={()=>onEdit(diagnosis.tab)}>Open {diagnosis.tab} controls →</button><button onClick={()=>onJump(diagnosis.time)}>Inspect this moment</button></div>
      <h4>Numerical rendezvous checks</h4>
      <div className="rendezvous-checks">{r.rendezvous.map(check=><div key={check.payloadId}>
        <b>Payload {check.payloadId} · {check.accepted?'matched':'rejected'}</b>
        <span>{f(check.leadInSeconds,1)} s calculated approach</span>
        <small>Position error: {check.positionErrorM<.001?'less than 0.001':f(check.positionErrorM,3)} m · velocity error: {check.velocityErrorMs<.00001?'less than 0.00001':f(check.velocityErrorMs,5)} m/s</small>
      </div>)}</div>
      <p className="modal-footnote">Both approaches are constructed to match a predicted tip state. These residuals check the calculation, not real navigation or capture hardware. The second shipment is not Payload 1 returning.</p>
      <h4>Delivered trajectories</h4>{r.deliveries.length?<div className="delivered-orbits">{r.deliveries.map(d=><div key={d.number}><b>Payload {d.number}</b><span>{f(d.perigee/1000,0)} km perigee / {d.apogee===null?'escape':`${f(d.apogee/1000,0)} km apogee`}</span><small>{f(d.gain/1e6,2)} MJ/kg energy gain · {d.perigee>=120000&&d.gain>0?'delivery criterion met':'delivery criterion not met'}</small></div>)}</div>:<p>No payload reached release in this run.</p>}
      {r.outcome==='incomplete'&&<details className="readiness-details"><summary>Final readiness errors</summary><p>Readiness before capture 2 needs all four tolerances held for 60 seconds, then maintained at the next pass. These are final values, not minima.</p><dl>{readiness(r).map(v=><div key={v.label}><dt>{v.label}</dt><dd>{f(v.value,2)} {v.unit} <small>/ &lt; {v.limit} {v.unit}</small></dd></div>)}</dl></details>}
    </section><section><h4>{challenge?`${challenge.title} · ${passed?'passed':'objectives'}`:'What this run established'}</h4>
      {challenge?<ul className="objective-list">{gates.map(g=><li key={g.label} className={g.pass?'gate-passed':'gate-open'}><span aria-label={g.pass?'Passed':'Not met'}>{g.pass?'✓':'○'}</span><div><b>{g.label}</b><small>{g.value}</small></div></li>)}</ul>:<p>Minimum tether clearance: <b>{f(r.minClearance/1000)} km</b>. Minimum axial load margin: <b>{f(r.minMargin,2)}×</b>. These are model outputs, not safety certification.</p>}
      <p className="debrief-boundary">All results describe the calculated six-hour-or-shorter experiment. A released object is not counted as a successful delivery unless its energy increases and its perigee remains above 120 km.</p>
    </section></div>
    {baseline&&<section className="debrief-comparison"><div><h4>Against your pinned flight</h4><p>{delta.length?delta.map(k=>`${FIELD_NAMES[k]}: ${baseline.design[k]} → ${r.design[k]}`).join(' · '):'Identical design inputs. Repeatability comparison.'}</p></div><div className="comparison-table-wrap"><table><thead><tr><th>Full-run metric</th><th>Pinned</th><th>This run</th><th>Change</th></tr></thead><tbody>{[
      ['Successful deliveries',deliveries(baseline).length,good.length,''],['Dry facility',baseline.dryMass/1000,r.dryMass/1000,'t'],['Fuel used',baseline.fuelUsed/1000,r.fuelUsed/1000,'t'],['Bus energy',baseline.electricalEnergyJ/3.6e9,r.electricalEnergyJ/3.6e9,'MWh'],['Minimum clearance',baseline.minClearance/1000,r.minClearance/1000,'km'],['Minimum load margin',baseline.minMargin,r.minMargin,'×']
    ].map(([label,a,b,unit])=><tr key={String(label)}><th>{label}</th><td>{f(Number(a),2)} {unit}</td><td>{f(Number(b),2)} {unit}</td><td>{Number(b)>Number(a)?'+':''}{f(Number(b)-Number(a),2)} {unit}</td></tr>)}</tbody></table></div><p className="debrief-boundary">Runs can have different durations and delivered energy. These deltas are observations, not an efficiency ranking. Coast carries no fuel; E0 adds conductors and a hardware budget. Recovery comparisons also change initial mass.</p><button onClick={()=>onRestore(baseline)}>Restore pinned flight</button></section>}
    <div className="debrief-footer"><button onClick={onPin}>Pin this flight</button><button onClick={onCompare} disabled={!canStudy}>Run a trade study</button><button onClick={download}>Export flight report</button><span>{r.model} · {r.cells} cells · ≤ {r.maxStep} s steps</span></div>
  </Modal>;
}
