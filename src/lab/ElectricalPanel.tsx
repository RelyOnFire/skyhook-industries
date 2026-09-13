import type { Frame, Result } from '../simulation/engine.js';
const show=(n:number,d=1)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
export default function ElectricalPanel({result,frame}:{result:Result;frame:Frame}) {
  const e=frame.electrical;
  if(!e||result.design.recovery!=='electrodynamic')return null;
  return <section className="electrical-recorder" aria-label="Electrodynamic power recorder">
    <div className="electrical-heading"><span className="micro">FIELD & POWER / E0</span><b>{frame.burn?'Controller active':'Circuits open'}</b></div>
    <p className="electrical-boundary">Equatorial dipole experiment. Plasma current is an assumption, not a prediction.</p>
    <dl>
      <div><dt>Bus draw</dt><dd>{show(e.busW/1000)} <small>/ {show(result.design.edPowerKw)} kW</small></dd></div>
      <div><dt>Circuit A / B</dt><dd>{show(e.circuits[0].current)} / {show(e.circuits[1].current)} <small>A</small></dd></div>
      <div><dt>Net Lorentz force</dt><dd>{show(Math.hypot(e.fx,e.fy))} <small>N</small></dd></div>
      <div><dt>Heat + dumped power</dt><dd>{show(e.heatW/1000)} <small>kW</small></dd></div>
      <div><dt>Electrical energy used</dt><dd>{show(frame.state[8]/3.6e9,3)} <small>MWh</small></dd></div>
    </dl>
    <p className="electrical-limits">{!frame.burn?'No electrical actuation at this replay time.':e.limitedBy.length?`Controller limited by ${e.limitedBy.join(' + ')}.`:'Within current, voltage and bus caps.'}</p>
    <a href="/lab/method/#electrodynamic">Circuit model & energy balance ↗</a>
  </section>;
}
