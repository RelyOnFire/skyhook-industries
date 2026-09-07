import { useEffect, useRef, useState } from 'react';
import { type Design, type Result } from '../simulation/engine.js';
import { studyDesigns, STUDY_LABELS, deliveries, type StudyKind } from '../simulation/insights.js';
import { Modal } from './Missions.js';
export interface StudyRow { label:string; basis?:string; result?:Result; error?:string }
export default function Studies({design,rows,onRows,onClose,onSelect}:{design:Design;rows:StudyRow[];onRows:(r:StudyRow[])=>void;onClose:()=>void;onSelect:(r:Result)=>void}) {
  const [kind,setKind]=useState<StudyKind>('recovery'),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const job=useRef<Worker|null>(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;job.current?.terminate();},[]);
  const stop=()=>{generation.current++;job.current?.terminate();job.current=null;setBusy(false);setProgress('Stopped. Completed rows remain available.');};
  async function runStudy(){
    stop();const id=++generation.current,variants=studyDesigns(design,kind),completed:StudyRow[]=[];onRows([]);setBusy(true);
    for(let i=0;i<variants.length;i++) {
      if(generation.current!==id)return;
      const variant=variants[i];setProgress(`Calculating ${i+1} of ${variants.length}: ${variant.label}`);
      const row=await new Promise<StudyRow>(resolve=>{
        try {
          const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});job.current=worker;
          worker.onmessage=e=>{worker.terminate();resolve(e.data.error?{label:variant.label,error:e.data.error}:{label:variant.label,result:e.data.result});};
          worker.onerror=()=>{worker.terminate();resolve({label:variant.label,error:'The calculation worker failed. Retry this study.'});};
          worker.postMessage({id:i,design:variant.design});
        } catch(e){resolve({label:variant.label,error:(e as Error).message});}
      });
      if(generation.current!==id)return;
      row.basis=STUDY_LABELS[kind];completed.push(row);onRows([...completed]);
    }
    if(generation.current===id){setBusy(false);job.current=null;setProgress('Study complete. Select a row or a plotted point to inspect that calculated flight.');}
  }
  const results=rows.filter((r):r is StudyRow&{result:Result}=>!!r.result);
  const maxX=Math.max(1,...results.map(r=>r.result.fuelUsed/1000))*1.15;
  const maxY=Math.max(1,...results.map(r=>(r.result.deliveries[0]?.gain??0)/1e6))*1.15;
  const minY=Math.min(0,...results.map(r=>(r.result.deliveries[0]?.gain??0)/1e6));
  return <Modal title="One question. Several flights." onClose={()=>{stop();onClose();}} wide>
    <p className="modal-intro">Change one design variable. Run the actual mission for every candidate. Compare what it delivers, not just how it looks.</p>
    <div className="study-controls"><label>Study variable<select aria-label="Study variable" value={kind} onChange={e=>setKind(e.target.value as StudyKind)} disabled={busy}>{Object.entries(STUDY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="primary" onClick={runStudy} disabled={busy}>Run {studyDesigns(design,kind).length} variants →</button>{busy&&<button onClick={stop}>Cancel study</button>}</div>
    <p className="study-disclosure">{kind==='material'?'Dimensions stay fixed. Density, mass and the strength assumption change. Future carbon is hypothetical.':kind==='recovery'?'Coast removes propellant mass as well as thrust. Chemical runs use the same controller, thrust and specific impulse with different fuel budgets.':kind==='release'?'Only Earth-relative release phase changes. Payload, cable geometry, material and recovery stay fixed.':'Only payload mass changes. The structure is not resized. Loads that exceed the chosen allowable stop the run.'}</p>
    <p className="study-status" role="status">{progress||'Results below, when present, belong to your last study. Running a new study replaces them.'}</p>
    {!!results.length&&<div className="study-plot"><div><span className="micro">RECOVERY COST × FIRST PAYLOAD ENERGY GAIN</span><h3>Every point is a calculated flight.</h3><p>Filled circles complete both deliveries. Open circles do not. Crosses have no release. This is not a ranking: delivered orbit and elapsed time also matter.</p></div><svg viewBox="0 0 600 290" role="img" aria-label="Trade study: propellant used versus first payload energy gain. Exact results are also in the table below.">
      {[0,.25,.5,.75,1].map(u=><g key={u}><line x1="65" x2="555" y1={235-u*200} y2={235-u*200} className="study-gridline"/><text x="53" y={239-u*200} textAnchor="end">{(minY+u*(maxY-minY)).toFixed(0)}</text><text x={65+u*490} y="254" textAnchor="middle">{(maxX*u).toFixed(1)}</text></g>)}
      <text x="310" y="281" textAnchor="middle">Propellant used (t)</text><text x="10" y="18">MJ/kg</text>
      {results.map((row,i)=>{const r=row.result,x=65+r.fuelUsed/1000/maxX*490,y=235-(((r.deliveries[0]?.gain??0)/1e6)-minY)/(maxY-minY)*200;return <g key={i} role="button" tabIndex={0} aria-label={`Inspect ${row.label}`} className={`study-point ${r.outcome==='complete'?'point-complete':''}`} aria-disabled={busy} onClick={()=>{if(!busy)onSelect(r);}} onKeyDown={e=>{if(!busy&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(r);}}}><title>{row.label}: {deliveries(r).length} deliveries, {(r.fuelUsed/1000).toFixed(2)} t propellant</title><circle cx={x} cy={y} r="20" fill="transparent" stroke="none"/>{r.deliveries.length?<circle cx={x} cy={y} r="7"/>:<path d={`M${x-6},${y-6}l12,12m-12,0l12,-12`} />}<text x={x+12} y={y-9}>{i+1}</text></g>;})}
    </svg></div>}
    {!!rows.length&&<div className="study-table-scroll"><table className="study-table"><caption>{rows[0]?.basis??'Full-run results'} · last calculated study · select a row to restore its exact flight</caption><thead><tr><th>Variant</th><th>Delivered</th><th>Dry mass</th><th>Fuel used</th><th>Load margin</th><th>Outcome</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><th>{row.result?<button onClick={()=>onSelect(row.result!)} disabled={busy}>{i+1}. {row.label} ↗</button>:row.label}</th>{row.result?<><td>{deliveries(row.result).length} / 2</td><td>{(row.result.dryMass/1000).toFixed(1)} t</td><td>{(row.result.fuelUsed/1000).toFixed(2)} t</td><td>{row.result.minMargin.toFixed(2)}×</td><td>{row.result.outcome==='complete'?'Two deliveries':row.result.outcome==='limit'?'Modeled limit':row.result.outcome==='delivery-failed'?'Bad release':'Incomplete'}</td></>:<td colSpan={5}>{row.error}</td>}</tr>)}</tbody></table></div>}
    {!rows.length&&!busy&&<div className="study-empty"><span aria-hidden="true">↗</span><h3>Let the tradeoff show itself.</h3><p>Start with recovery to see why a first delivery and a reusable service are different problems.</p></div>}
    <p className="modal-footnote">Uses the current planar rigid-tether engine and its six-hour horizon. Model-limited and incomplete designs remain visible; they are not silently removed from the study.</p>
  </Modal>;
}
