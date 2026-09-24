import { useEffect, useRef, useState } from 'react';
import T4Scene from './T4Scene.js';
import T4Study from './T4Study.js';
import T4Comparison from './T4Comparison.js';
import NumericField from './StudioField.js';
import UnitPicker, { displayNumber, modelNumber, unitScale, useStudioUnits } from './StudioUnits.js';
import { EARTH, MU, MATERIALS } from '../simulation/engine.js';
import { T4_DEFAULT, T4_MODEL, T4_BOUNDS, T4_HUB, T4_PIVOT, T4_TIP, T4_CUTOFF, t4Fragment, readT4, validateT4, t4Sample, t4Gates, type T4Design, type T4Result } from '../simulation/t4.js';
import { planT4Study, type T4Study as Study, type T4StudyMode } from '../simulation/t4-study.js';
import './phobos.css';
import './t4.css';

const KEY='skyhook-lab-t4-design-v1';
const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const duration=(n:number)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const signed=(n:number)=>`${n<0?'−':'+'}${fmt(Math.abs(n),3)}`;
function download(name:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function T4Lab(){
  const [design,setDesign]=useState<T4Design>({...T4_DEFAULT}),[result,setResult]=useState<T4Result|null>(null);
  const [busy,setBusy]=useState<''|'run'|T4StudyMode>('run'),[study,setStudy]=useState<Study|null>(null);
  const [pinned,setPinned]=useState<T4Result|null>(null),pinButton=useRef<HTMLButtonElement>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[share,setShare]=useState('');
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(120);
  const [bad,setBad]=useState<string[]>([]),[fieldKey,setFieldKey]=useState(0);
  const [units,setUnits]=useStudioUnits();
  const clock=useRef(0),worker=useRef<Worker|null>(null),request=useRef(0),file=useRef<HTMLInputElement>(null),flight=useRef<HTMLElement>(null);
  const runRef=useRef(result),playingRef=useRef(playing),speedRef=useRef(speed);runRef.current=result;playingRef.current=playing;speedRef.current=speed;
  let validation='';try{validateT4(design);}catch(e){validation=(e as Error).message;}
  const invalid=!!bad.length||!!validation,dirty=!!result&&(invalid||JSON.stringify(validateT4(result.design))!==JSON.stringify(validateT4(design)));
  function calculate(candidate:T4Design,kind:'run'|T4StudyMode='run',auto=false,spacing=1,focusFlight=false){
    try{
      const d=validateT4(candidate),plan=kind==='run'?null:planT4Study(d,kind,spacing);worker.current?.terminate();setBusy(kind);setPlaying(false);setError('');setNotice('');setShare('');
      setStudy(old=>plan?{plan,rows:[],status:'running'}:old?.status==='running'?{...old,status:'cancelled'}:old);
      const id=++request.current,w=new Worker(new URL('./t4-worker.ts',import.meta.url),{type:'module'});worker.current=w;
      const fail=(message:string)=>{setBusy('');setError(message);setStudy(old=>old?.status==='running'?{...old,status:'error'}:old);w.terminate();worker.current=null;};
      w.onerror=()=>{if(id!==request.current)return;fail('The calculation worker could not start. Reload to try again.');};
      w.onmessage=e=>{if(id!==request.current)return;
        if(e.data.row){setStudy(old=>old?{...old,rows:[...old.rows,e.data.row]}:old);return;}
        if(e.data.error){fail(e.data.error);return;}
        setBusy('');w.terminate();worker.current=null;
        if(e.data.complete){setStudy(old=>old?{...old,status:'complete'}:old);setNotice('Study complete. Open a sample to inspect its flight.');return;}
        setResult(e.data.result);clock.current=0;setTime(0);setPlaying(auto&&!document.hidden&&e.data.result.duration>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
        if(focusFlight){flight.current?.scrollIntoView({block:'start',behavior:'instant'});flight.current?.focus({preventScroll:true});}
      };w.postMessage({id,design:d,kind,spacing});
    }catch(e){request.current++;worker.current?.terminate();worker.current=null;setBusy('');setStudy(old=>old?.status==='running'?{...old,status:'error'}:old);setError((e as Error).message);}
  }
  function cancel(){request.current++;worker.current?.terminate();worker.current=null;setBusy('');setStudy(old=>old?.status==='running'?{...old,status:'cancelled'}:old);setNotice(result?'Calculation stopped. Your last completed flight is still available.':'Calculation stopped. Choose Run release to start again.');}
  function adopt(d:T4Design,auto=false,keepLink=false,focusFlight=false){if(!keepLink)history.replaceState(null,'','/lab/t4/');setDesign(d);setBad([]);setFieldKey(k=>k+1);calculate(d,'run',auto,1,focusFlight);}
  useEffect(()=>{
    let d={...T4_DEFAULT},message='';try{const raw=new URLSearchParams(location.hash.slice(1)).get('t4');if(raw)d=readT4(raw);}catch(e){message=`Shared design rejected: ${(e as Error).message}`;}
    adopt(d,false,true);if(message)setError(message);return()=>worker.current?.terminate();
  },[]);
  useEffect(()=>{
    let raf=0,last=0,paint=0;const tick=(now:number)=>{raf=requestAnimationFrame(tick);const r=runRef.current;
      if(playingRef.current&&r&&!document.hidden){clock.current=Math.min(r.duration,clock.current+Math.min((now-last)/1000,.1)*speedRef.current);if(now-paint>60||clock.current===r.duration){setTime(clock.current);paint=now;}if(clock.current>=r.duration)setPlaying(false);}last=now;
    };raf=requestAnimationFrame(tick);
    const pause=()=>{if(document.hidden)setPlaying(false);},motion=matchMedia('(prefers-reduced-motion: reduce)'),reduce=()=>{if(motion.matches)setPlaying(false);};
    document.addEventListener('visibilitychange',pause);motion.addEventListener('change',reduce);
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',pause);motion.removeEventListener('change',reduce);};
  },[]);
  function seek(t:number){setPlaying(false);clock.current=t;setTime(t);}
  function clearPin(){setPinned(null);requestAnimationFrame(()=>{const button=pinButton.current;if(button&&!button.disabled)button.focus();else flight.current?.focus();});}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(validateT4(design)));setNotice('T4 design saved in this browser.');setError('');}catch(e){setError((e as Error).message);}}
  function load(){try{const raw=localStorage.getItem(KEY);if(!raw)throw Error('No T4 design has been saved in this browser.');adopt(readT4(raw));setNotice('Loaded your T4 design.');}catch(e){setError((e as Error).message);}}
  async function importFile(f:File){try{if(f.size>6000)throw Error('Design exceeds the 6 KB limit.');adopt(readT4(await f.text()));setNotice('T4 design imported. Use Save to keep it in this browser.');}catch(e){setError((e as Error).message);}}
  function field(key:keyof typeof T4_BOUNDS,label:string,unit:string,step:number){const [min,max]=T4_BOUNDS[key],shownUnit=unit==='km'?units.distance:unit==='km/s'?units.speed:unit,scale=shownUnit===unit?1:unitScale(shownUnit);return <NumericField key={`${fieldKey}-${key}-${shownUnit}`} name={key} label={label} unit={shownUnit} min={displayNumber(min,scale)} max={displayNumber(max,scale)} value={displayNumber(design[key],scale)} step={displayNumber(step,scale)} onChange={n=>{setShare('');setDesign(old=>({...old,[key]:modelNumber(n,scale)}));}} onValidity={invalid=>setBad(old=>invalid?[...new Set([...old,key])]:old.filter(x=>x!==key))}/>;}
  const f=result?t4Sample(result,time):null,gates=result?t4Gates(result):[],orbit=result?.release?.orbit;
  const allowable=result?MATERIALS.find(m=>m.id===result.design.material)!.ultimate/result.design.safetyFactor:1;
  const phase=f?((f.s[3]-f.s[2])*180/Math.PI%360+360)%360:0;
  return <main className="lab-app phobos-app t4-app" id="lab-content">
    <header className="workbench-bar"><div><p className="micro">EARTH / COMPOUND ROTOR</p><h1>Tether Lab <span className="model-tag">{T4_MODEL}</span></h1></div><div className="workbench-actions"><button onClick={save} disabled={invalid}>Save</button><button onClick={load}>Load</button><button className="share-design" disabled={invalid} onClick={()=>setShare(`${location.origin}/lab/t4/${t4Fragment(design)}`)}>Share design ↗</button></div></header>
    <div className="studio-worlds" role="group" aria-label="Flight environment"><span>FLIGHT STUDIO</span><a className="studio-world-link" href="/lab/">Earth <small>Orbital rotovator</small></a><a className="studio-world-link" href="/lab/lunar/">Moon <small>Lunavator experiment</small></a><a className="studio-world-link" href="/lab/phobos/">Phobos <small>Anchored tethers</small></a><a className="studio-world-link" aria-current="page" href="/lab/t4/">T4 <small>Two-tier rotor</small></a><a href="/lab/t4/method/">T4 model & assumptions ↗</a></div>
    <UnitPicker units={units} onChange={next=>{setBad([]);setUnits(next);}}/>
    <div className="experiment-strip" aria-label="Experiment presets"><span>START WITH</span>{[{name:'Working release',d:T4_DEFAULT},{name:'Find the phase',d:{...T4_DEFAULT,phaseDeg:60}},{name:'Thin secondary',d:{...T4_DEFAULT,secondaryAreaMm2:15,payloadT:8}}].map((p,i)=><button key={p.name} onClick={()=>adopt({...p.d},true)}><span className="preset-number">0{i+1}</span>{p.name}<span aria-hidden="true">↗</span></button>)}<a href="/lab/architectures/">Architecture catalogue →</a></div>
    <section className="phobos-intro"><div><span className="micro">A ROTOR ON A ROTOR.</span><h2>Two rotations. One release.</h2><p>Turn the secondary rotor into position. Let its moving pivot carry the cargo higher.</p></div><span className="phobos-orbit-fact"><strong>2 stages</strong> one freely moving system</span></section>
    <div className="phobos-feedback" aria-live="polite">{error?<p role="alert" className="field-error">{error}</p>:notice?<p>{notice}</p>:<p>Start with cargo attached. Explore a passive hinge and finite masses over two hours.</p>}</div>
    {share&&<div className="share-output"><label>Shareable design<input aria-label="Shareable design link" readOnly value={share} onFocus={e=>e.target.select()}/></label><button onClick={()=>setShare('')} aria-label="Close share link">×</button></div>}
    <div className="phobos-workspace">
      <aside className="lab-panel phobos-design" aria-label="T4 design controls"><div className="panel-heading"><h2>Design bay</h2><span className="tag">{dirty?'UNRUN CHANGES':'FREE HINGE'}</span></div><div className="phobos-design-content">
        <p className="phobos-help">Phase sets the secondary’s starting angle relative to the primary. Both rotations then evolve together.</p>
        {field('phaseDeg','Initial phase','°',1)}{field('releaseMin','Release after','min',.1)}{field('payloadT','Payload','t',.1)}
        <details className="phobos-material"><summary>Geometry & initial rotation</summary><p>The primary runs from station to pivot. The secondary has two equal arms.</p>{field('primaryKm','Primary length','km',10)}{field('secondaryKm','Each secondary arm','km',5)}{field('altitudeKm','Initial COM altitude','km',50)}{field('primarySpeedKms','Primary spin × length','km/s',.05)}{field('secondarySpeedKms','Secondary spin × arm','km/s',.05)}<p>These specify initial angular rates, not ground speeds. A negative secondary rate reverses its rotation.</p></details>
        <details className="phobos-material"><summary>Cables & material</summary>{field('primaryAreaMm2','Primary area','mm²',5)}{field('secondaryAreaMm2','Secondary area','mm²',5)}<label>Fiber profile<select aria-label="Fiber profile" value={design.material} onChange={e=>setDesign({...design,material:e.target.value as T4Design['material']})}><option value="zylon">Zylon HM · 5.8 GPa</option><option value="kevlar">Kevlar 49 · 3.0 GPa</option></select></label>{field('safetyFactor','Safety factor','×',.1)}<p>Uniform sections; axial screening only. Flexible motion and bending strength are not solved. <a href="/lab/method/#materials">Fiber sources ↗</a></p></details>
        {validation&&<p role="alert" className="field-error">{validation}</p>}
        <button className="primary phobos-run" disabled={!!busy||invalid} onClick={()=>calculate(design,'run',true)}>{busy==='run'?'Calculating…':'Run release →'}</button>
        {busy&&<button className="t4-cancel" onClick={cancel}>Cancel calculation</button>}
        <div className="phobos-files"><button disabled={invalid} onClick={()=>download('t4-design.json',validateT4(design))}>Export design</button><button onClick={()=>file.current?.click()}>Import</button><input ref={file} type="file" accept=".json,application/json" hidden aria-label="Import T4 design" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value='';}}/></div>
      </div></aside>
      <section className="lab-panel phobos-flight" ref={flight} tabIndex={-1} aria-label="Two-stage flight" aria-busy={busy==='run'}>
        {result&&f?<><T4Scene result={result} clock={clock} time={time}/><div className="phobos-flight-readout"><div><span>{f.cargo?'CARGO RELEASED':'CARGO ATTACHED'}{dirty?' · PREVIOUS RUN':''}</span><strong>{duration(time)} <small>/ {duration(result.duration)}</small></strong></div><div><span>RELATIVE PHASE</span><strong>{fmt(phase,1)}<small> °</small></strong></div><div><span>ANGULAR RATES · °/s</span><strong>{fmt(f.s[6]*180/Math.PI,2)} <small>/</small> {fmt(f.s[7]*180/Math.PI,2)}</strong></div></div>
        <div className="phobos-playback"><button className="primary" disabled={!!busy||!result.duration} aria-label={playing?'Pause replay':'Play replay'} onClick={()=>{if(time>=result.duration){clock.current=0;setTime(0);}setPlaying(!playing);}}>{playing?'Ⅱ':'▶'}</button><input type="range" aria-label="Flight time" min="0" max={result.duration||1} step=".1" value={time} disabled={!result.duration} onChange={e=>seek(+e.target.value)}/><label>Speed<select aria-label="Replay speed" value={speed} onChange={e=>setSpeed(+e.target.value)}>{[120,600,1800].map(s=><option key={s} value={s}>{s}×</option>)}</select></label><button disabled={!result.release} onClick={()=>seek(result.release!.t)}>At release</button></div></>:<div className="phobos-loading">{busy?'Calculating the coupled flight…':'Choose Run release to calculate a flight.'}</div>}
      </section>
      <aside className="lab-panel phobos-results" aria-label="Release results" aria-busy={busy==='run'}><div className="panel-heading"><h2>Flight brief</h2><span className="tag">{busy==='run'?'CALCULATING':!result?'READY':dirty?'PREVIOUS RUN':result.outcome==='complete'?'CALCULATED':'LIMIT REACHED'}</span></div>
        {result&&<><div className="phobos-verdict"><span className="micro">{fmt(result.design.phaseDeg)}° INITIAL PHASE</span><h3>{result.outcome!=='complete'?'A stage reaches its limit.':gates.every(Boolean)?'The rotations line up.':'Timing changes the orbit.'}</h3><p>{result.outcome!=='complete'?result.reason:`Cargo separates at ${duration(result.release!.t)} with the tip’s current velocity. ${gates[2]?'Its release orbit reaches the target altitude band.':'Adjust the phase or compare six starting angles to reach the target band.'}`}</p></div>
        <dl className="phobos-metrics"><div><dt>Release orbit apoapsis</dt><dd>{orbit?orbit.apoapsis===null?'Escape':fmt(orbit.apoapsis/(units.distance==='km'?1000:1)):'—'} <small>{orbit?.apoapsis!=null?units.distance:''}</small></dd></div><div><dt>Release orbit periapsis</dt><dd>{orbit?fmt(orbit.periapsis/(units.distance==='km'?1000:1)):'—'} <small>{orbit?units.distance:''}</small></dd></div><div><dt>Lowest axial margin</dt><dd>{fmt(allowable/Math.max(...result.peakStress),2)} <small>×</small></dd></div></dl>
        <div className="phobos-challenge"><span className="micro">FIND THE PHASE</span><ul>{['Complete the two-hour model checks','Cargo periapsis above 120 km','Cargo apoapsis: 8,000–12,000 km'].map((text,i)=><li key={text} data-pass={gates[i]}><span>{gates[i]?'✓':'○'}</span>{text}</li>)}</ul><button onClick={()=>adopt({...T4_DEFAULT,phaseDeg:60},true)}>Try the phase challenge →</button></div>
        <button className="t4-pin" ref={pinButton} disabled={!!busy||pinned===result} onClick={()=>{setPlaying(false);setPinned(result);}}>{pinned===result?'Flight pinned':pinned?'Replace pinned flight':'Pin calculated flight'}</button>
        <button className="phobos-report" onClick={()=>download('t4-flight-report.json',{...result,constants:{EARTH,MU,T4_HUB,T4_PIVOT,T4_TIP,T4_CUTOFF},scope:'Planar uniform rigid stages, finite masses, passive ideal hinge; pre-attached cargo and one impulse-free release. Axial screen only; no bending, cable flexure, physical crossover clearance, capture, atmosphere or reboost.'})}>Export flight report ↗</button></>}
      </aside>
    </div>
    {pinned&&result&&<T4Comparison pinned={pinned} current={result} dirty={dirty} busy={!!busy} units={units} onRestore={()=>adopt(pinned.design,false,false,true)} onClear={clearPin}/>}
    <T4Study study={study} design={design} busy={busy} invalid={invalid} units={units} onStart={(mode,spacing)=>calculate(design,mode,false,spacing)} onCancel={cancel} onInspect={d=>adopt(d,false,false,true)}/>
    {result&&<div className="phobos-analysis"><section className="lab-panel phobos-loads" aria-label="Two-stage loads"><div className="panel-heading"><h2>What the pivot carries</h2><span className="tag">RIGID STAGES</span></div><p>Peak axial stress through the replay: <span className="t4-primary-key">primary</span> and <span className="t4-secondary-key">secondary</span>. Dotted line: material allowable.</p><svg viewBox="0 0 620 170" role="img" aria-label="Primary and secondary axial stress over time">
      {(()=>{const top=Math.max(allowable,...result.peakStress)*1.15,y=(n:number)=>135-n/top*106,x=(t:number)=>45+t/(result.duration||1)*550;return <><line x1="45" y1="135" x2="595" y2="135" stroke="#63747b"/><line x1="45" y1={y(allowable)} x2="595" y2={y(allowable)} stroke="#a69781" strokeDasharray="3 5"/>{[0,1].map(stage=><polyline key={stage} points={result.frames.map(f=>`${x(f.t)},${y(f.loads.stress[stage])}`).join(' ')} fill="none" stroke={stage?'#efa477':'#b7cdcf'} strokeWidth="2"/>)}<line x1={x(time)} x2={x(time)} y1="24" y2="135" stroke="#e1e4da" opacity=".5"/><text x="45" y="15">{fmt(top/1e9,2)} GPa scale · allowable {fmt(allowable/1e9,2)} GPa</text><text x="45" y="160">Start</text><text x="595" y="160" textAnchor="end">{duration(result.duration)} min:sec</text></>;})()}
      </svg><div className="phobos-load-stats"><span>Peak pivot force<strong>{fmt(result.peakPivotForce/(units.force==='kN'?1000:1),units.force==='kN'?1:0)} {units.force}</strong></span><span>Transverse · primary<strong>{fmt(result.peakTransverse[0]/(units.force==='kN'?1000:1),units.force==='kN'?1:0)} {units.force}</strong></span><span>Transverse · secondary<strong>{fmt(result.peakTransverse[1]/(units.force==='kN'?1000:1),units.force==='kN'?1:0)} {units.force}</strong></span></div><p>The rigid model also needs transverse forces. An axial pass does not establish bending strength, cable stability or a viable pivot bearing.</p></section>
      <section className="lab-panel phobos-energy t4-velocity" aria-label="Release velocity accounting"><div className="panel-heading"><h2>How the velocities combine</h2><span className="tag">NO RELEASE IMPULSE</span></div><p>Direction matters. Cargo inherits the sum of system translation and both rotational contributions.</p>
        {result.release?<table><caption>Velocity components at release · Earth inertial axes · {units.speed}</caption><thead><tr><th scope="col">Contribution</th><th scope="col">X</th><th scope="col">Y</th></tr></thead><tbody>{result.release.velocityParts.map((v,i)=><tr key={i}><th scope="row">{['System translation','Primary rotation','Secondary rotation'][i]}</th><td>{signed(v[0]/(units.speed==='km/s'?1000:1))}</td><td>{signed(v[1]/(units.speed==='km/s'?1000:1))}</td></tr>)}<tr><th scope="row">Cargo velocity</th><td>{signed(result.release.state[2]/(units.speed==='km/s'?1000:1))}</td><td>{signed(result.release.state[3]/(units.speed==='km/s'?1000:1))}</td></tr></tbody></table>:<p>The run stopped before cargo could separate.</p>}
        <p>Station, stages and cargo all have finite mass. There is no motor maintaining their rotations.</p><a href="/lab/t4/method/">Coupled dynamics, energy checks & limits ↗</a>
      </section></div>}
    <footer className="phobos-boundary">T4-inspired planar experiment · ideal pivot with no physical crossing geometry · no capture or reboost. <a href="/lab/t4/method/">Read the model</a>. <a href="/lab/campaign/">Return to Expeditions →</a></footer>
  </main>;
}
