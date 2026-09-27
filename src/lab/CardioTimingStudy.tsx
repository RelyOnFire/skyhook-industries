import {useEffect,useRef,useState} from 'react';
import type {CardioDesign} from '../simulation/cardio.js';
import type {CardioRelease} from '../simulation/cardio-release.js';
import {cardioTimingPlan,cardioTimingOutcome,cardioTimingReport} from '../simulation/cardio-study.js';
import type {StudioUnits} from './StudioUnits.js';

export default function CardioTimingStudy({design,current,disabled,units,onSelect,onBusy}:{design:CardioDesign;current:number;disabled:boolean;units:StudioUnits;onSelect:(r:CardioRelease)=>void;onBusy:(busy:boolean)=>void}){
  const [rows,setRows]=useState<CardioRelease[]>([]),[plan,setPlan]=useState<number[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const worker=useRef<Worker|null>(null),generation=useRef(0),runButton=useRef<HTMLButtonElement>(null);
  function stop(){generation.current++;worker.current?.terminate();worker.current=null;setBusy(false);onBusy(false);}
  useEffect(()=>()=>{generation.current++;worker.current?.terminate();},[]);
  useEffect(()=>{if(disabled){stop();setMessage('Comparison paused. Recalculate the current pickup design or correct invalid inputs to continue.');}},[disabled]);
  function run(){
    stop();setError('');setMessage('');setRows([]);
    try{
      const timings=cardioTimingPlan(current);setPlan(timings);setBusy(true);onBusy(true);
      const id=++generation.current,w=new Worker(new URL('./cardio-study-worker.ts',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=e=>{
        if(id!==generation.current)return;
        if(e.data.error){stop();setError(e.data.error);return;}
        if(e.data.result)setRows(old=>[...old,e.data.result]);
        if(e.data.complete){stop();setMessage('Comparison complete. Open a timing to inspect its calculated flight.');}
      };
      w.onerror=()=>{if(id!==generation.current)return;stop();setError('Timing comparison failed. Completed samples remain available; try again.');};
      w.postMessage({design,current});
    }catch{stop();setError('Timing comparison could not start. Try again.');}
  }
  function download(){
    const report=cardioTimingReport(design,plan,rows),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='cardiorotovator-timing-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const n=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:1});
  const distance=(v:number)=>`${n(v/(units.distance==='km'?1000:1))} ${units.distance}`;
  const clear=rows.filter(r=>cardioTimingOutcome(r).clear).length;
  return <section className="cardio-timing" aria-label="Release timing comparison">
    <div className="cardio-timing-heading"><div><h3>Find a useful release time</h3><p>Compare 5–90% of the orbit in 5% steps, plus your exact selected timing. The tether design stays fixed.</p></div>
      <button ref={runButton} disabled={disabled||busy} onClick={run}>Compare release times</button>
      {busy&&<button onClick={()=>{stop();setMessage('Comparison stopped. Completed samples are available.');}}>Stop timing comparison</button>}
    </div>
    {error&&<p role="alert">{error}</p>}
    {!!plan.length&&<>
      <p role="status">{rows.length} / {plan.length} timings calculated · {clear} complete coasts with clear cargo orbits. {busy?'Calculating…':message}</p>
      <div className="cardio-timing-grid">{rows.map(r=>{
        const outcome=cardioTimingOutcome(r),event=r.release;
        return <button key={r.fraction} className={outcome.clear?'clear':'limited'} disabled={disabled||busy} title={`Release at ${r.fraction*100}% of the nominal orbit`} aria-label={`Open release at ${r.fraction*100}%: ${outcome.label}`} onClick={()=>onSelect(r)}>
          <strong>{(r.fraction*100).toLocaleString('en-US',{maximumFractionDigits:3})}%</strong>{!Array.from({length:18},(_,i)=>(i+1)/20).includes(r.fraction)&&<small>Selected timing</small>}<span>{outcome.label}</span>
          {event?<><small className="cardio-timing-quantity"><span>Perigee</span><span>{distance(event.cargoOrbit.perigee)}</span></small><small className="cardio-timing-quantity">{event.cargoOrbit.apogee===null?'Unbound orbit':<><span>Apogee</span><span>{distance(event.cargoOrbit.apogee)}</span></>}</small></>:<small>{r.status==='load'?'Axial load limit':r.status==='compression'?'Cable requires compression':'Tether clearance limit'}</small>}
        </button>;
      })}</div>
      <p>Clear means this sampled coast completed and the cargo orbit stays above 120 km. Gaps between samples are untested; this does not establish a repeatable service.</p>
      <div className="cardio-timing-actions"><button disabled={!rows.length||disabled||busy} onClick={download}>Export timing comparison</button><button disabled={busy} onClick={()=>{setRows([]);setPlan([]);setError('');setMessage('');runButton.current?.focus();}}>Clear comparison</button></div>
    </>}
  </section>;
}
