import { useMemo, useRef, useState } from 'react';
import type { PhobosDesign } from '../simulation/phobos.js';
import { exportPhobosStudy, phobosStudyMatches, phobosStudyValue, phobosTrialLabel, recommendPhobosTrial, type PhobosStudy as Study } from '../simulation/phobos-study.js';

const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
const signed=(n:number,d=2)=>`${n<0?'−':n>0?'+':''}${fmt(Math.abs(n),d)}`;

export default function PhobosStudy({study,design,busy,invalid,onStart,onCancel,onInspect}:{study:Study|null;design:PhobosDesign;busy:''|'run'|'study';invalid:boolean;onStart:(spacing:number)=>void;onCancel:()=>void;onInspect:(design:PhobosDesign)=>void}){
  const [spacing,setSpacing]=useState<number|null>(null),[choice,setChoice]=useState<{plan:Study['plan'];index:number}|null>(null);
  const plot=useRef<HTMLDivElement>(null),step=spacing??(design.release==='inward'?100:250);
  const running=study?.status==='running',inward=study?.plan.design.release==='inward';
  const selected=study?.rows.find(r=>choice?.plan===study.plan&&r.index===choice.index)??study?.rows[0];
  const recommended=study?recommendPhobosTrial(study.rows):null,changed=study&&(invalid||!phobosStudyMatches(study.plan,design));
  const values=useMemo(()=>study?.rows.map(phobosStudyValue).filter((n):n is number=>n!==null)??[],[study]);
  const threshold=inward?150:0,low=Math.min(threshold,...values),high=Math.max(threshold,...values),pad=Math.max((high-low)*.12,inward?25:.05);
  const bottom=low-pad,top=high+pad,y=(n:number)=>235-(n-bottom)/(top-bottom)*185;
  const x=(index:number)=>90+index/Math.max(1,(study?.plan.samples.length??1)-1)*520;
  const measure=inward?'Lowest simulated Mars altitude · km':'Mars-centered release energy · MJ/kg';
  function selectRecommended(){if(!study||!recommended)return;setChoice({plan:study.plan,index:recommended.index});
    const root=plot.current,point=root?.querySelector<SVGGElement>(`[data-index="${recommended.index}"]`);if(!root||!point)return;
    const a=root.getBoundingClientRect(),b=point.getBoundingClientRect();if(b.left<a.left)root.scrollLeft+=b.left-a.left-8;else if(b.right>a.right)root.scrollLeft+=b.right-a.right+8;
  }
  function download(){if(!study)return;const url=URL.createObjectURL(new Blob([JSON.stringify(exportPhobosStudy(study),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='phobos-arm-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="lab-panel phobos-study" aria-label="Phobos arm study" aria-busy={!!running}>
    <div className="panel-heading"><div><h2>Find the reach that works.</h2><p>Compare one arm. Keep the cargo, cable and other arm fixed.</p></div><div className="phobos-study-actions"><label>Length spacing<select aria-label="Arm study spacing" value={step} disabled={!!busy} onChange={e=>setSpacing(+e.target.value)}>{[50,100,250,500].map(n=><option key={n} value={n}>{n} km</option>)}</select></label><button className="primary" disabled={!!busy||invalid} onClick={()=>onStart(step)}>Compare arm lengths →</button></div></div>
    {study&&<><div className="phobos-study-status"><p role="status">{running?'Calculating':study.status==='complete'?'Complete':study.status==='cancelled'?'Stopped':'Interrupted'} · {study.rows.length} / {study.plan.samples.length} flights · {study.rows.filter(r=>r.clear).length} clear both bodies</p>{running?<button onClick={onCancel}>Stop study</button>:study.status==='complete'?<button onClick={download}>Export arm study ↗</button>:<span>Completed samples remain available.</span>}</div>
      <p className="phobos-study-design" data-stale={!!changed}>{inward?'Inward':'Outward'} arm · {fmt(study.plan.design.payloadT,3)} t cargo · {fmt(study.plan.design.areaMm2,3)} mm² · {study.plan.design.material==='zylon'?'Zylon HM':'Kevlar 49'}. {invalid?'Correct the current inputs before starting another study.':changed?'Fixed inputs have changed. Run another study to compare them.':'Opening a sample restores all its exact settings.'}</p>
      <div className="phobos-study-body"><div className="phobos-study-chart"><h3>{measure}</h3>
        <div className="phobos-study-plot" ref={plot} role="region" aria-label="Arm length samples" tabIndex={0}><svg viewBox="0 0 680 345" role="group" aria-label={`${measure}. Select a numbered sample. Length columns are evenly spaced.`}>
          {values.length?Array.from({length:4},(_,i)=>bottom+(top-bottom)*i/3).map(n=><g key={n} className="phobos-study-grid"><line x1="65" y1={y(n)} x2="640" y2={y(n)}/><text x="55" y={y(n)+4} textAnchor="end">{fmt(n,inward?0:2)}</text></g>):<text x="340" y="145" textAnchor="middle">{running?'Calculated samples will appear here.':'No released flight in these samples.'}</text>}
          {!!values.length&&<line x1="65" y1={y(threshold)} x2="640" y2={y(threshold)} className="phobos-study-threshold"/>}
          <line x1="65" y1="278" x2="640" y2="278" className="phobos-study-blocked-line"/><text x="65" y="264" className="phobos-study-rail-label">No release / pending</text>
          {study.plan.samples.map((d,index)=>{const row=study.rows.find(r=>r.index===index),value=row?phobosStudyValue(row):null,label=row?phobosTrialLabel(row):'Pending';
            const state=!row?'pending':!row.clear?'limit':row.target||(!inward&&row.orbit!.energy>0)?'target':'clear',select=()=>{if(row)setChoice({plan:study.plan,index});};
            return <g key={index}>
              <g className="phobos-study-point" data-index={index} data-result={state} transform={`translate(${x(index)},${value===null?278:y(value)})`} role="button" tabIndex={row?0:-1} aria-disabled={!row} aria-pressed={selected?.index===index} aria-controls="phobos-selected-sample" aria-label={`Sample ${index+1}, ${String(d[study.plan.axis])} km ${study.plan.design.release} arm. ${label}${value===null?'':`; ${fmt(value,inward?2:4)} ${inward?'km minimum Mars altitude':'MJ/kg release energy'}`}.`} onClick={select} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}}}>
                <title>{`${String(d[study.plan.axis])} km · ${label}`}</title><circle className="phobos-study-hit" r="26"/><circle className="phobos-study-selection" r="17"/>
                {state==='limit'?<path d="M -6 -6 L 6 6 M -6 6 L 6 -6" className="phobos-study-cross"/>:<circle className="phobos-study-dot" r="6"/>}<text y="-24" textAnchor="middle">{index+1}</text>
              </g><text x={x(index)} y="319" textAnchor="middle">{fmt(d[study.plan.axis],2)}</text>
            </g>;
          })}<text x="350" y="340" textAnchor="middle">Sampled arm lengths · km</text>
        </svg></div>
        <div className="phobos-study-key"><span>● {inward?'Low-pass target':'Escape energy'}</span><span>○ Clear flight</span><span>× Stopped or blocked</span></div>
        <p>{inward?'Dashed line: 150 km Mars stop boundary.':'Dashed line: zero release energy. Below zero is bound; above zero is escape energy, without a targeted destination.'} Each point is a full model run, including any early stop. Columns represent discrete lengths; gaps are untested.</p><p className="phobos-study-scroll">Scroll the plot to see every length →</p>
      </div>
      <aside className="phobos-study-detail" id="phobos-selected-sample" aria-label="Selected arm sample">{selected?<><span className="micro">{inward?'INWARD':'OUTWARD'} ARM · SAMPLE {selected.index+1}</span><h3>{String(selected.design[study.plan.axis])} <small>km</small></h3><p className="phobos-study-outcome" data-clear={selected.clear}>{phobosTrialLabel(selected)}</p>
        <dl><div><dt>Lowest Mars altitude</dt><dd>{selected.minMarsAltitudeM===null?'—':`${fmt(selected.minMarsAltitudeM/1000,2)} km`}</dd></div><div><dt>{inward?'Release periapsis':'Release escape excess'}</dt><dd>{!selected.orbit?'—':inward?`${fmt(selected.orbit.periapsis/1000,2)} km`:selected.orbit.energy<0?'Bound orbit':`${fmt(selected.orbit.vInfinity)} m/s`}</dd></div><div><dt>Lowest cable margin</dt><dd>{fmt(selected.margin,2)} ×</dd></div><div><dt>Cable + terminals</dt><dd>{fmt(selected.massKg/1000,1)} t</dd></div><div><dt>Simulated time</dt><dd>{fmt(selected.duration/3600,2)} h</dd></div><div><dt>Ideal anchor work</dt><dd>{signed(selected.budget.anchorWorkJ/1e9)} GJ</dd></div></dl>
        <p>{selected.issues.length?selected.issues.join(' '):selected.outcome==='mars-limit'?'Stopped at the 150 km Mars boundary.':selected.outcome==='phobos-impact'?'Stopped at the spherical Phobos surface.':'Both exclusion boundaries cleared for two Phobos periods.'}</p><button className="primary" disabled={busy==='run'} onClick={()=>onInspect(selected.design)}>Open this flight →</button>
        <div className="phobos-study-suggestion">{recommended?<button onClick={selectRecommended}>Select closest to 450 km periapsis</button>:inward?<p>No completed sample meets the low-pass target yet.</p>:<p>Compare escape energy with mass and cable margin.</p>}</div><p>Anchor work is a separate ideal positioning budget; Phobos’ orbit is held fixed.</p>
      </>:<p>Inspect each completed sample while the study runs. The current flight stays available above.</p>}</aside>
      </div>
    </>}
  </section>;
}
