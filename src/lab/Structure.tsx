import { useMemo, useState } from 'react';
import { compile, loadProfile, properties, type Result } from '../simulation/engine.js';
import { sample, elapsed } from './view.js';
/** Inspect the same axial-load cuts used by the numerical stop condition. */
export default function Structure({result,time}:{result:Result;time:number}) {
  const [selected,setSelected]=useState(25);
  const {cuts,body,allow}=useMemo(()=>{const frame=sample(result,time),body=compile(result.design,frame.fuel,frame.loaded,result.cells);return {body,cuts:loadProfile(frame.state,body,result.design,frame.burn),allow:properties(result.design).allowable};},[result,time]);
  const cut=cuts[Math.min(selected,cuts.length-1)],peak=cuts.reduce((a,c)=>c.stress>a.stress?c:a,cuts[0]);
  const x=(s:number)=>45+(s+body.half)/(2*body.half)*630;
  const top=Math.max(allow*1.12,peak.stress*1.1),y=(stress:number)=>175-Math.max(0,stress)/top*110;
  return <section className="structure-inspector" aria-label="Tether structural inspector">
    <div className="structure-title"><span className="micro">STRUCTURE / AT REPLAY TIME {elapsed(time)}</span><h3>See where the load goes.</h3><p>Choose a section along the tether. Cross-section thickness is enlarged; length position is linear.</p></div>
    <svg viewBox="0 0 720 290" role="img" aria-label={`Axial stress along the tether. Peak ${(peak.stress/1e9).toFixed(2)} GPa; allowable ${(allow/1e9).toFixed(2)} GPa.`}>
      <line x1="45" x2="675" y1={y(allow)} y2={y(allow)} className="stress-limit"/><text x="675" y={y(allow)-8} textAnchor="end">Allowable {(allow/1e9).toFixed(2)} GPa</text>
      <path d={`M45,175 ${cuts.map(c=>`L${x(c.s)},${y(c.stress)}`).join(' ')} L675,175Z`} className="stress-fill"/>
      <polyline points={cuts.map(c=>`${x(c.s)},${y(c.stress)}`).join(' ')} className="stress-line"/>
      {cuts.map((c,i)=><line key={i} x1={x(c.s)-6} x2={x(c.s)+6} y1="225" y2="225" strokeWidth={Math.sqrt(c.area/body.area)*16} className="cable-profile"/>)}
      <line x1={x(cut.s)} x2={x(cut.s)} y1="58" y2="248" className="selected-cut"/><circle cx={x(cut.s)} cy={y(cut.stress)} r="5" fill="var(--lab-amber)"/>
      <text x="45" y="277">Opposite tip</text><text x="360" y="277" textAnchor="middle">Hub</text><text x="675" y="277" textAnchor="end">Working tip</text>
    </svg>
    <label className="section-selector">Section along tether <input type="range" aria-label="Inspected tether section" min="0" max={cuts.length-1} step="1" value={selected} onChange={e=>setSelected(Number(e.target.value))}/></label>
    <dl className="section-readout"><div><dt>Position from hub</dt><dd>{(cut.s/1000).toFixed(1)} <small>km</small></dd></div><div><dt>Section area</dt><dd>{(cut.area*1e6).toFixed(1)} <small>mm²</small></dd></div><div><dt>Axial stress</dt><dd>{(cut.stress/1e9).toFixed(2)} <small>GPa</small></dd></div><div><dt>Tension</dt><dd>{(cut.tension/1000).toFixed(1)} <small>kN</small></dd></div></dl>
    <p className="inspector-note">Rigid-body axial-load screening only. No elastic vibration, fracture or transverse cable deformation is modeled.</p>
  </section>;
}
