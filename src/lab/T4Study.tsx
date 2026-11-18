import { useRef, useState } from 'react';
import type { T4Design } from '../simulation/t4.js';
import { exportT4Study, recommendT4Trial, t4StudyMatches, type T4Study as Study, type T4StudyMode, type T4Trial } from '../simulation/t4-study.js';
import { shownValue, type StudioUnits } from './StudioUnits.js';

const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
const minutes=(n:number)=>String(Number(n.toPrecision(8)));
const outcome=(r:T4Trial)=>r.outcome!=='complete'?'Model limit reached':r.pass?'Target reached':'Outside target band';

export default function T4Study({study,design,busy,invalid,units,onStart,onCancel,onInspect}:{study:Study|null;design:T4Design;busy:''|'run'|T4StudyMode;invalid:boolean;units:StudioUnits;onStart:(mode:T4StudyMode,spacing:number)=>void;onCancel:()=>void;onInspect:(design:T4Design)=>void}){
  const [spacing,setSpacing]=useState(1),[choice,setChoice]=useState<{plan:Study['plan'];index:number}|null>(null);
  const map=useRef<HTMLDivElement>(null);
  const running=study?.status==='running',recommended=study?recommendT4Trial(study.rows):null;
  const chosen=study&&choice?.plan===study.plan?study.rows.find(r=>r.index===choice.index):null;
  const selected=chosen??recommended??study?.rows[0],changed=study&&(invalid||!t4StudyMatches(study.plan,design));
  const count=study?.rows.length??0,total=study?.plan.samples.length??0;
  const altitude=(n:number|null)=>n===null?'Escape':`${fmt(shownValue(n,'m',units))} ${units.distance}`;
  function selectRecommended(){if(!study||!recommended)return;setChoice({plan:study.plan,index:recommended.index});
    const root=map.current,cell=root?.querySelector<HTMLElement>(`button[data-index="${recommended.index}"]`);if(!root||!cell)return;
    const a=root.getBoundingClientRect(),b=cell.getBoundingClientRect();
    if(b.top<a.top+35)root.scrollTop+=b.top-a.top-35;else if(b.bottom>a.bottom-30)root.scrollTop+=b.bottom-a.bottom+30;
  }
  function download(){if(!study)return;const url=URL.createObjectURL(new Blob([JSON.stringify(exportT4Study(study),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='t4-release-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="lab-panel t4-sweep" aria-label="Release study" aria-busy={!!running}>
    <div className="panel-heading"><div><h2>Find the useful alignment.</h2><p>Compare starting angle and release time. Every cell is a calculated flight.</p></div>
      <div className="t4-study-actions"><button disabled={!!busy||invalid} onClick={()=>onStart('phase',spacing)}>Compare six phases →</button><button className="primary" disabled={!!busy||invalid} onClick={()=>onStart('timing',spacing)}>Map release timing →</button><label>Time spacing<select aria-label="Study time spacing" value={spacing} disabled={!!busy} onChange={e=>setSpacing(+e.target.value)}><option value="0.5">30 sec</option><option value="1">1 min</option><option value="2">2 min</option></select></label></div>
    </div>
    {study&&<><div className="t4-study-status"><p role="status">{running?'Calculating':study.status==='complete'?'Complete':study.status==='cancelled'?'Stopped':'Interrupted'} · {count} / {total} flights · {study.rows.filter(r=>r.pass).length} meet the target</p>{running?<button onClick={onCancel}>Stop study</button>:study.status==='complete'?<button onClick={download}>Export study ↗</button>:<span>Completed samples remain available.</span>}</div>
      <p className="t4-sweep-note" data-stale={!!changed}>Compared design: {fmt(shownValue(study.plan.design.primaryKm,'km',units))} / {fmt(shownValue(study.plan.design.secondaryKm,'km',units))} {units.distance} · {fmt(study.plan.design.payloadT,2)} t cargo · {study.plan.mode==='phase'?`release at ${minutes(study.plan.times[0])} min`:`release ${minutes(study.plan.times[0])}–${minutes(study.plan.times.at(-1)!)} min`}. {invalid?'Correct the current inputs before starting another study.':changed?'Fixed inputs have changed. Run a new study to compare them.':'Opening a sample restores its exact settings.'}</p>
      {study.plan.mode==='phase'?<div className="t4-trials">{study.rows.map(row=><article key={row.index} data-pass={row.pass}><span className="micro">{row.design.phaseDeg}° PHASE</span><strong>{row.released?altitude(row.apoapsis):'No release'}</strong><small>{outcome(row)}</small><button disabled={busy==='run'} onClick={()=>onInspect(row.design)}>Inspect {row.design.phaseDeg}° →</button></article>)}</div>:<div className="t4-timing-body">
        <div className="t4-timing-map" ref={map} role="region" aria-label="Release timing map" tabIndex={0}>
          <table><caption>Apoapsis by initial phase and release delay. ✓ Target · ○ Outside target · × Model limit · … Pending</caption><thead><tr><th scope="col">Release</th>{study.plan.phases.map(phase=><th scope="col" key={phase}>{phase}°</th>)}</tr></thead><tbody>
            {study.plan.times.map((time,ti)=><tr key={time}><th scope="row">{minutes(time)} min</th>{study.plan.phases.map((phase,pi)=>{
              const index=ti*study.plan.phases.length+pi,row=study.rows.find(r=>r.index===index),state=!row?'pending':row.outcome!=='complete'?'limit':row.pass?'target':'outside';
              return <td key={phase}><button disabled={!row} data-index={index} data-result={state} aria-controls="t4-selected-trial" aria-pressed={selected?.index===index} aria-label={`Phase ${phase}°, release after ${minutes(time)} min. ${row?`${outcome(row)}; ${row.released?altitude(row.apoapsis)+' apoapsis':'no release'}`:'Pending'}.`} onClick={()=>setChoice({plan:study.plan,index})}><span className="t4-cell-phase">{phase}°</span><span className="t4-cell-mark" aria-hidden="true">{!row?'…':row.outcome!=='complete'?'×':row.pass?'✓':'○'}</span><strong>{row?row.released?row.apoapsis===null?'Escape':fmt(shownValue(row.apoapsis,'m',units)):'Stopped':'—'}</strong><small>{row?.released&&row.apoapsis!==null?`${units.distance} apoapsis`:row?'':'Pending'}</small></button></td>;
            })}</tr>)}
          </tbody></table><p className="t4-map-scroll-hint">Scroll the map for more release times ↓</p>
        </div>
        <aside className="t4-trial-detail" id="t4-selected-trial" aria-label="Selected timing sample">
          {selected?<><span className="micro">SELECTED SAMPLE</span><h3>{selected.design.phaseDeg}° <span>at</span> {minutes(selected.design.releaseMin)} min</h3><p className="t4-sample-outcome" data-pass={selected.pass}>{outcome(selected)}</p><dl><div><dt>Apoapsis</dt><dd>{selected.released?altitude(selected.apoapsis):'—'}</dd></div><div><dt>Periapsis</dt><dd>{selected.periapsis===null?'—':`${fmt(shownValue(selected.periapsis,'m',units))} ${units.distance}`}</dd></div><div><dt>Lowest axial margin</dt><dd>{selected.axialMargin===null?'—':`${fmt(selected.axialMargin,2)} ×`}</dd></div><div><dt>Peak pivot force</dt><dd>{fmt(shownValue(selected.peakPivotForce,'N',units),units.force==='kN'?1:0)} {units.force}</dd></div></dl><p>{selected.reason}</p><button className="primary" disabled={busy==='run'} onClick={()=>onInspect(selected.design)}>Open this flight →</button>
          {recommended&&<button className="t4-recommend" onClick={selectRecommended}>Select closest to {fmt(shownValue(10000,'km',units))} {units.distance}</button>}
          <p className="t4-sampling-note">{recommended?'Suggestion uses passing samples only.':running?'No completed sample has met the target yet.':'No completed sample met the target.'} Values between samples are untested.</p></>:<p>Samples appear as each flight finishes. You can stop the study at any time.</p>}
        </aside>
      </div>}
    </>}
  </section>;
}
