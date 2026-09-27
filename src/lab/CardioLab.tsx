import {useEffect,useRef,useState} from 'react';
import CardioScene from './CardioScene.js';
import NumericField from './StudioField.js';
import UnitPicker,{displayNumber,modelNumber,useStudioUnits} from './StudioUnits.js';
import {CARDIO_DEFAULT,CARDIO_MODEL,CARDIO_BOUNDS,CARDIO_ALLOWABLE,cardioFragment,readCardio,validateCardio,cardioSample,type CardioDesign,type CardioResult} from '../simulation/cardio.js';
import './phobos.css';
import './cardio.css';
const KEY='skyhook-lab-cardio-design-v1';
const n=(v:number,d=1)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
const statuses={complete:'One nominal orbit completed',clearance:'Stopped at the 120 km cutoff',load:'Stopped at the axial load limit',compression:'Stopped: a section needs compression'};
function download(name:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function CardioLab(){
  const [design,setDesign]=useState<CardioDesign>({...CARDIO_DEFAULT}),[result,setResult]=useState<CardioResult|null>(null),[busy,setBusy]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[share,setShare]=useState(''),[bad,setBad]=useState<string[]>([]),[fieldKey,setFieldKey]=useState(0);
  const [loaded,setLoaded]=useState(true),[reference,setReference]=useState(true),[time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [units,setUnits]=useStudioUnits(),worker=useRef<Worker|null>(null),request=useRef(0),upload=useRef<HTMLInputElement>(null);
  let validation='';try{validateCardio(design);}catch(e){validation=(e as Error).message;}
  const invalid=!!bad.length||!!validation,dirty=!!result&&(invalid||JSON.stringify(design)!==JSON.stringify(result.design));
  const coast=result?(loaded?result.loaded:result.empty):null,frame=coast?cardioSample(coast,time):null;
  const distance=(m:number)=>n(m/(units.distance==='km'?1000:1)),speed=(v:number)=>n(v/(units.speed==='km/s'?1000:1),2);
  function run(d:CardioDesign){try{const clean=validateCardio(d);worker.current?.terminate();setBusy(true);setPlaying(false);setError('');setNotice('');const id=++request.current,w=new Worker(new URL('./cardio-worker.ts',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=e=>{if(id!==request.current)return;w.terminate();worker.current=null;setBusy(false);if(e.data.error){setError(e.data.error);return;}setResult(e.data.result);setTime(0);};
    w.onerror=()=>{if(id!==request.current)return;w.terminate();worker.current=null;setBusy(false);setError('The calculation worker could not start. Reload or try again.');};w.postMessage(clean);
  }catch(e){setBusy(false);setError((e as Error).message);}}
  function adopt(d:CardioDesign){setDesign(d);setBad([]);setFieldKey(k=>k+1);setShare('');run(d);}
  useEffect(()=>{let d={...CARDIO_DEFAULT},message='';try{const raw=new URLSearchParams(location.hash.slice(1)).get('cardio');if(raw)d=readCardio(raw);}catch(e){message='Shared design rejected: '+(e as Error).message;}adopt(d);if(message)setError(message);return()=>worker.current?.terminate();},[]);
  useEffect(()=>{if(!playing||!coast)return;let raf=0,last=performance.now(),elapsed=time,paint=0;const tick=(now:number)=>{const dt=Math.min(.1,(now-last)/1000);last=now;if(!document.hidden)elapsed=Math.min(coast.duration,elapsed+dt*240);if(now-paint>60||elapsed>=coast.duration){setTime(elapsed);paint=now;}if(elapsed>=coast.duration){setPlaying(false);return;}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[playing,coast]);
  useEffect(()=>{const hide=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
  const field=(key:keyof typeof CARDIO_BOUNDS,label:string,unit:string,step:number)=>{const [lo,hi]=CARDIO_BOUNDS[key],scale=unit==='km'&&units.distance==='m'?1000:1;return <NumericField key={key+'-'+fieldKey+'-'+scale} name={'cardio-'+key} label={label} unit={unit==='km'?units.distance:unit} min={displayNumber(lo,scale)} max={displayNumber(hi,scale)} step={step*scale} value={displayNumber(design[key],scale)} onChange={v=>{setPlaying(false);setDesign(d=>({...d,[key]:modelNumber(v,scale)}));}} onValidity={v=>setBad(old=>v?[...new Set([...old,key])]:old.filter(k=>k!==key))}/>;};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(validateCardio(design)));setNotice('CardioRotovator design saved in this browser.');}catch(e){setError((e as Error).message);}};
  const load=()=>{try{const raw=localStorage.getItem(KEY);if(!raw)throw Error('No saved CardioRotovator design here yet.');adopt(readCardio(raw));}catch(e){setError((e as Error).message);}};
  const shareDesign=async()=>{const url=location.origin+'/lab/cardio/'+cardioFragment(design);setShare(url);history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url);setNotice('Design link copied.');}catch{setNotice('Copy the design link below.');}};
  const acceptFile=async(file?:File)=>{if(!file)return;try{if(file.size>16000)throw Error('Design exceeds 16 KB.');adopt(readCardio(await file.text()));}catch(e){setError((e as Error).message);}finally{if(upload.current)upload.current.value='';}};
  return <main className="lab-app phobos-app cardio-app" id="lab-content">
    <div className="workbench-bar"><div><p className="micro">EARTH / ECCENTRIC SINGLE-ARM ROTOR</p><h1>CardioRotovator <span className="model-tag">{CARDIO_MODEL}</span></h1></div><div className="workbench-actions"><button disabled={invalid} onClick={save}>Save</button><button onClick={load}>Load</button><button disabled={invalid} onClick={shareDesign}>Share design ↗</button></div></div>
    <div className="studio-worlds" role="group" aria-label="Flight environment"><span>FLIGHT STUDIO</span><a href="/lab/">Earth</a><a href="/lab/lunar/">Moon</a><a href="/lab/phobos/">Phobos</a><a href="/lab/t4/">T4</a><a href="/lab/cardio/" aria-current="page">CardioRotovator</a><a href="/lab/cardio/method/">Model & assumptions ↗</a></div>
    <UnitPicker units={units} onChange={next=>{setUnits(next);setBad([]);setFieldKey(k=>k+1);}}/>
    <div className="cardio-intro"><p className="micro">PICK UP AT APOGEE. KEEP CLEAR AT PERIGEE.</p><h2>Timing is part of the structure.</h2><p>A long, single arm starts with two spins per orbit. Compare its empty coast with a payload already matched to the tip. Gravity changes the spin; there is no controller keeping the pattern in sync.</p></div>
    {error&&<p className="cardio-message error" role="alert">{error}</p>}{notice&&<p className="cardio-message" role="status">{notice}</p>}{share&&<label className="cardio-share">Shareable design<input readOnly value={share} onFocus={e=>e.target.select()}/></label>}
    <div className="cardio-workspace">
      <aside className="lab-panel cardio-controls"><div className="panel-heading"><h2>Orbit & timing</h2></div><div className="cardio-fields">
        {field('perigeeKm','Initial COM perigee','km',50)}{field('apogeeKm','Initial COM apogee','km',50)}{field('lengthKm','Station-to-tip length','km',50)}{field('spinRatio','Initial spins per orbit','×',.05)}{field('phaseDeg','Apogee phase offset','°',1)}{field('payloadT','Matched payload','t',1)}
        <details><summary>Station & tapered cable</summary>{field('stationT','Station mass','t',100)}{field('areaMm2','Tip cable area','mm²',50)}{field('taper','Station-to-tip area ratio','×',.5)}<p>Zylon HM · safety factor 2 · 2 t grapple. A linear area taper is a scenario geometry, not an optimized historical design.</p></details>
        {validation&&<p className="field-error">{validation}</p>}
        <button className="primary phobos-run" disabled={busy||invalid} onClick={()=>run(design)}>Compare pickup</button>{busy&&<button className="phobos-run" onClick={()=>{request.current++;worker.current?.terminate();worker.current=null;setBusy(false);setNotice('Calculation cancelled.');}}>Cancel calculation</button>}
        <div className="phobos-files"><button disabled={invalid} onClick={()=>download('cardiorotovator-design.json',validateCardio(design))}>Export design</button><button onClick={()=>upload.current?.click()}>Import design</button></div><input hidden type="file" accept=".json,application/json" ref={upload} onChange={e=>acceptFile(e.target.files?.[0])}/>
        <button className="cardio-reset" onClick={()=>{history.replaceState(null,'','/lab/cardio/');adopt({...CARDIO_DEFAULT});}}>Reference scenario</button>
      </div></aside>
      <section className="lab-panel cardio-flight" aria-label="CardioRotovator replay"><div className="cardio-toolbar"><div role="group" aria-label="Replay comparison"><button aria-pressed={!loaded} onClick={()=>{setLoaded(false);setPlaying(false);setTime(0);}}>Empty coast</button><button aria-pressed={loaded} onClick={()=>{setLoaded(true);setPlaying(false);setTime(0);}}>After pickup</button></div><label><input type="checkbox" checked={reference} onChange={e=>setReference(e.target.checked)}/>Reference path</label></div>
        {result?<CardioScene result={result} loaded={loaded} time={time} reference={reference}/>:<div className="cardio-loading" role="status">Calculating both coasts…</div>}
        <div className="cardio-playback"><button disabled={!coast||busy||dirty||coast.duration===0} aria-label={playing?'Pause CardioRotovator replay':'Play CardioRotovator replay'} onClick={()=>{if(coast&&time>=coast.duration)setTime(0);setPlaying(p=>!p);}}>{playing?'Ⅱ Pause':'▶ Play'}</button><input type="range" aria-label="CardioRotovator replay time" min={0} max={coast?.duration||1} step="any" value={time} disabled={!coast||busy||dirty} onChange={e=>{setPlaying(false);setTime(+e.target.value);}}/><span>{n(time/60)} min</span></div>
        {dirty&&<p className="cardio-message">Inputs changed. The replay shows the previous calculation; compare again to update it.</p>}
        {frame&&<dl className="cardio-live"><div><dt>Closest cable point</dt><dd>{distance(frame.clearance)} {units.distance}</dd></div><div><dt>Tip inertial speed</dt><dd>{speed(frame.tipSpeed)} {units.speed}</dd></div><div><dt>Unwrapped spin drift</dt><dd>{n(frame.phaseErrorDeg)}°</dd></div></dl>}
        <p className="cardio-caption">Square: station · ring: center of mass · copper dot: matched payload. Dashed reference prescribes Kepler motion and constant spin; solid paths integrate the free rigid body. Pickup is an ideal initial condition, not a simulated approach or grapple.</p>
      </section>
    </div>
    {result&&<section className="lab-panel cardio-results" aria-label="Pickup comparison"><div className="panel-heading"><h2>What the payload changes</h2><span className="tag">FULL CALCULATED COAST</span></div><div className="cardio-results-body">
      <div className="cardio-summary"><div><span>FACILITY MASS BEFORE PICKUP</span><strong>{n(result.massT)} t</strong></div><div><span>INITIAL COM PERIGEE CHANGE</span><strong>{distance(result.loaded.initialPerigee-result.empty.initialPerigee)} {units.distance}</strong></div><div><span>NOMINAL ORBIT PERIOD</span><strong>{n(result.period/60)} min</strong></div></div>
      <div className="cardio-table-wrap"><table><thead><tr><th>Measure</th><th>Empty</th><th>After pickup</th></tr></thead><tbody>
        <tr><th>Status</th><td data-testid="cardio-empty-status">{statuses[result.empty.status]}</td><td data-testid="cardio-loaded-status">{statuses[result.loaded.status]}</td></tr>
        <tr><th>Calculated coast duration</th><td>{n(result.empty.duration/60)} min</td><td>{n(result.loaded.duration/60)} min</td></tr>
        <tr><th>Initial osculating COM perigee</th><td>{distance(result.empty.initialPerigee)} {units.distance}</td><td>{distance(result.loaded.initialPerigee)} {units.distance}</td></tr>
        <tr><th>Lowest cable clearance</th><td>{distance(result.empty.minClearance)} {units.distance}</td><td>{distance(result.loaded.minClearance)} {units.distance}</td></tr>
        <tr><th>Peak axial stress</th><td>{n(result.empty.peakStress/1e9,3)} GPa</td><td>{n(result.loaded.peakStress/1e9,3)} GPa</td></tr>
        <tr><th>Unwrapped spin drift at stop</th><td>{n(result.empty.frames.at(-1)!.phaseErrorDeg)}°</td><td>{n(result.loaded.frames.at(-1)!.phaseErrorDeg)}°</td></tr>
      </tbody></table></div>
      <p>Axial allowable: {n(CARDIO_ALLOWABLE/1e9)} GPa. Each coast stops at clearance, load or compression limits. Completion means surviving one nominal orbit, not a repeatable pickup. Perigee is a point-orbit diagnostic of the center of mass; cable clearance is checked separately.</p>
      <details><summary>Numerical accounting & report</summary><p>Matched attachment adds the incoming payload's energy and angular momentum without an impulse. Closure residuals: {n(result.captureEnergyResidual,3)} J and {n(result.captureAngularResidual,2)} kg·m²/s. Maximum relative energy drift: {Math.max(result.empty.energyDrift,result.loaded.energyDrift).toExponential(2)}; angular momentum drift: {Math.max(result.empty.angularDrift,result.loaded.angularDrift).toExponential(2)}.</p><p>Peak transverse constraint force: {n(Math.max(result.empty.peakTransverse,result.loaded.peakTransverse)/(units.force==='kN'?1000:1))} {units.force}. A straight rigid arm needs these forces; the axial check does not establish flexible-cable stability or bending strength.</p><button onClick={()=>download('cardiorotovator-report.json',result)}>Export comparison report</button></details>
    </div></section>}
    <footer className="phobos-boundary">C1p · planar single-arm experiment · no atmospheric pickup, release, reeling or reboost. <a href="/lab/cardio/method/">Read the equations & source ↗</a>. This experiment does not commission a campaign design.</footer>
  </main>;
}
