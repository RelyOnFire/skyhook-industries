import {useEffect,useRef,useState} from 'react';
import type {CardioResult} from '../simulation/cardio.js';
import {cardioCargoCrossesCutoff,cardioReleaseSample,type CardioRelease as ReleaseResult} from '../simulation/cardio-release.js';
import type {StudioUnits} from './StudioUnits.js';
import CardioScene from './CardioScene.js';
import NumericField from './StudioField.js';
import CardioTimingStudy from './CardioTimingStudy.js';

const descriptions={complete:'Reached the end of the nominal orbit.',clearance:'Stopped: tether reached the 120 km cutoff.',load:'Stopped: tether exceeded its axial load limit.',compression:'Stopped: a tether section requires compression.','cargo-clearance':'Stopped: cargo reached the 120 km cutoff.'};
export default function CardioRelease({source,disabled,units}:{source:CardioResult;disabled:boolean;units:StudioUnits}){
  const [percent,setPercent]=useState(25),[invalid,setInvalid]=useState(false),[busy,setBusy]=useState(false);
  const [result,setResult]=useState<ReleaseResult|null>(null),[error,setError]=useState('');
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[studyBusy,setStudyBusy]=useState(false),[fieldKey,setFieldKey]=useState(0);
  const verdictRef=useRef<HTMLDivElement>(null);
  const worker=useRef<Worker|null>(null),request=useRef(0);
  const stale=!!result&&(invalid||percent/100!==result.fraction),blocked=disabled||invalid||busy||studyBusy;
  const n=(v:number,d=1)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
  const distance=(v:number)=>`${n(v/(units.distance==='km'?1000:1))} ${units.distance}`;
  const speed=(v:number)=>`${n(v/(units.speed==='km/s'?1000:1),2)} ${units.speed}`;
  const event=result?.release,frame=result?cardioReleaseSample(result,time):null;
  const verdict=!event?'Release not reached':cardioCargoCrossesCutoff(event.cargo,event.cargoOrbit)?'Cargo orbit crosses the 120 km cutoff':event.cargoOrbit.energy>=0?'Cargo is on an escape trajectory':'Cargo orbit clears the 120 km cutoff';
  function cancel(){request.current++;worker.current?.terminate();worker.current=null;setBusy(false);}
  function run(){
    cancel();setPlaying(false);setError('');setBusy(true);
    try{const id=++request.current,w=new Worker(new URL('./cardio-release-worker.ts',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=e=>{if(id!==request.current)return;w.terminate();worker.current=null;setBusy(false);if(e.data.error)setError(e.data.error);else{setResult(e.data.result);setTime(0);}};
    w.onerror=()=>{if(id!==request.current)return;cancel();setError('Release calculation could not finish. Try again.');};
    w.postMessage({design:source.design,fraction:percent/100});
    }catch{cancel();setError('Release calculation could not start. Try again.');}
  }
  useEffect(()=>()=>{request.current++;worker.current?.terminate();},[]);
  useEffect(()=>{if(disabled){setPlaying(false);cancel();}},[disabled]);
  useEffect(()=>{
    if(!playing||!result)return;let raf=0,last=performance.now(),elapsed=time,paint=0;
    const tick=(now:number)=>{elapsed=Math.min(result.duration,elapsed+Math.min(.1,(now-last)/1000)*240);last=now;if(now-paint>60||elapsed>=result.duration){setTime(elapsed);paint=now;}if(elapsed>=result.duration){setPlaying(false);return;}raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[playing,result]);
  useEffect(()=>{const hide=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
  function exportReport(){
    if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='cardiorotovator-release.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="lab-panel cardio-results cardio-release" aria-label="Payload release experiment">
    <div className="panel-heading"><h2>Release from the uncontrolled rotor</h2><span className="tag">RELEASE / C1r</span></div>
    <div className="cardio-results-body">
      <p>Choose when to release after pickup. Cargo inherits the passive rotor’s tip velocity; the unloaded tether continues under gravity. This does not model synchronized CardioRotovator operation. Neither receives a thrust impulse.</p>
      <div className="cardio-release-controls">
        <NumericField key={fieldKey} name="release-percent" label="Release after pickup" unit="% of nominal orbit" min={5} max={90} step={1} value={percent} onChange={v=>{setPercent(v);setPlaying(false);}} onValidity={v=>{setInvalid(v);if(v)setPlaying(false);}}/>
        <div><button className="primary" disabled={blocked} onClick={run}>Calculate release</button>{busy&&<button onClick={cancel}>Cancel release calculation</button>}<p>{n(source.period*percent/6000)} minutes after pickup. Changing this timing does not alter the saved tether design; the release report includes it.</p></div>
      </div>
      {disabled&&<p className="cardio-message">Compare the current pickup design before calculating its release.</p>}
      {error&&<p role="alert">{error}</p>}
      <CardioTimingStudy design={source.design} current={percent/100} disabled={disabled||invalid||busy} units={units} onBusy={value=>{setStudyBusy(value);if(value)setPlaying(false);}} onSelect={r=>{cancel();setPercent(r.fraction*100);setInvalid(false);setFieldKey(k=>k+1);setResult(r);setTime(r.release?.t??0);setPlaying(false);requestAnimationFrame(()=>{verdictRef.current?.focus();verdictRef.current?.scrollIntoView({block:'nearest'});});}}/>
      {result&&<>
        <div ref={verdictRef} tabIndex={-1} className="cardio-release-verdict" role="status"><strong>{verdict}</strong><p>{descriptions[result.status]} {event?'Orbit clearance describes the ideal cargo path; it does not certify the tether or a destination encounter.':'The loaded tether hit a limit before the selected release time.'}</p></div>
        {(stale||disabled)&&<p className="cardio-message">Release inputs changed. These results belong to the previous calculation.</p>}
        <CardioScene result={source} release={result} time={time} loaded reference={false}/>
        <div className="cardio-playback">
          <button disabled={blocked||stale||result.duration===0} aria-label={playing?'Pause release replay':'Play release replay'} onClick={()=>{if(time>=result.duration)setTime(0);setPlaying(v=>!v);}}>{playing?'Ⅱ Pause':'▶ Play'}</button>
          <input type="range" aria-label="Payload release replay time" min="0" max={result.duration||1} step="any" value={time} disabled={blocked||stale} onChange={e=>{setPlaying(false);setTime(+e.target.value);}}/>
          <span>{n(time/60)} min</span>
        </div>
        <div className="cardio-release-stage"><span>{frame?.released?'Free cargo coast':'Payload attached'}</span>{event&&<button disabled={blocked||stale} onClick={()=>{setPlaying(false);setTime(event.t);}}>Jump to release</button>}</div>
        {event&&<div className="cardio-summary">
          <div><span>CARGO PERIGEE AT RELEASE</span><strong>{distance(event.cargoOrbit.perigee)}</strong></div>
          <div><span>CARGO APOGEE AT RELEASE</span><strong>{event.cargoOrbit.apogee===null?'Unbound':distance(event.cargoOrbit.apogee)}</strong></div>
          <div><span>TETHER COM PERIGEE AT RELEASE</span><strong>{distance(event.tetherOrbit.perigee)}</strong></div>
          <div><span>RELEASE SPEED</span><strong>{speed(Math.hypot(event.cargo[2],event.cargo[3]))}</strong></div>
        </div>}
        <p>Negative altitude means the mathematical orbit passes inside Earth. Propagation stops at the 120 km boundary; no atmospheric flight is drawn.</p>
        <details><summary>Release accounting & report</summary>
          <p>Lowest tether clearance: {distance(result.minClearance)}. Peak axial stress: {n(result.peakStress/1e9,3)} GPa. {event&&<>Remaining tether’s COM perigee at release: {distance(event.tetherOrbit.perigee)}; this is a point-orbit diagnostic, not a cable-clearance guarantee.</>}</p>
          {event&&<p>Separation closure: {n(event.energyResidual,3)} J and {n(event.angularResidual,2)} kg·m²/s. Maximum relative drift for tether plus cargo: energy {result.energyDrift.toExponential(2)}, angular momentum {result.angularDrift.toExponential(2)}.</p>}
          <button onClick={exportReport}>Export release report</button>
        </details>
      </>}
    </div>
  </section>;
}
