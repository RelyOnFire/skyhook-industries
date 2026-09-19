import { useEffect, useRef, useState } from 'react';
import PhobosScene from './PhobosScene.js';
import PhobosStudy from './PhobosStudy.js';
import PhobosComparison from './PhobosComparison.js';
import NumericField from './StudioField.js';
import { PHOBOS_DEFAULT, PHOBOS_MODEL, PHOBOS_BOUNDS, PERIOD, MARS, MARS_X, PHOBOS, TERMINAL_KG, phobosFragment, readPhobos, validatePhobos, phobosSample, type PhobosDesign, type PhobosResult, type Arm } from '../simulation/phobos.js';
import { planPhobosStudy,type PhobosStudy as Study } from '../simulation/phobos-study.js';
import './phobos.css';
import './phobos-study.css';
import './phobos-comparison.css';

const KEY='skyhook-lab-phobos-design-v1';
const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const duration=(seconds:number)=>`${Math.floor(seconds/3600)}h ${String(Math.floor(seconds%3600/60)).padStart(2,'0')}m`;
const signed=(n:number,d=2)=>`${n>=0?'+':'−'}${fmt(Math.abs(n),d)}`;
function download(name:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}


export default function PhobosLab(){
  const [design,setDesign]=useState<PhobosDesign>({...PHOBOS_DEFAULT}),[result,setResult]=useState<PhobosResult|null>(null);
  const [pinned,setPinned]=useState<PhobosResult|null>(null),pinButton=useRef<HTMLButtonElement>(null);
  const [busy,setBusy]=useState<''|'run'|'study'>('run'),[study,setStudy]=useState<Study|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[share,setShare]=useState('');
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(600),[inspected,setInspected]=useState<Arm>('inward');
  const [bad,setBad]=useState<string[]>([]),[fieldKey,setFieldKey]=useState(0);
  const clock=useRef(0),worker=useRef<Worker|null>(null),request=useRef(0),file=useRef<HTMLInputElement>(null),runRef=useRef(result),flight=useRef<HTMLElement>(null);
  const playingRef=useRef(playing),speedRef=useRef(speed);runRef.current=result;playingRef.current=playing;speedRef.current=speed;
  const dirty=!!result&&(!!bad.length||JSON.stringify(result.design)!==JSON.stringify(design));
  function run(candidate:PhobosDesign,auto=false,kind:'run'|'study'='run',spacingKm=100,focusFlight=false){
    try{
      const d=validatePhobos(candidate),plan=kind==='study'?planPhobosStudy(d,spacingKm):null;worker.current?.terminate();setBusy(kind);setPlaying(false);setError('');setNotice('');setShare('');
      setStudy(old=>plan?{plan,rows:[],status:'running'}:old?.status==='running'?{...old,status:'cancelled'}:old);
      const id=++request.current,w=new Worker(new URL('./phobos-worker.ts',import.meta.url),{type:'module'});worker.current=w;
      const fail=(message:string)=>{request.current++;w.terminate();worker.current=null;setBusy('');setError(message);setStudy(old=>old?.status==='running'?{...old,status:'error'}:old);};
      w.onerror=()=>{if(id!==request.current)return;fail('The calculation worker could not start. Try running the flight again.');};
      w.onmessage=e=>{if(id!==request.current)return;
        if(e.data.row){setStudy(old=>old?{...old,rows:[...old.rows,e.data.row]}:old);return;}
        if(e.data.error){fail(e.data.error);return;}
        setBusy('');w.terminate();worker.current=null;
        if(e.data.complete){setStudy(old=>old?{...old,status:'complete'}:old);setNotice('Arm study complete. Open a sample to inspect its flight.');return;}
        setResult(e.data.result);clock.current=0;setTime(0);setPlaying(auto&&!document.hidden&&e.data.result.duration>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
        if(focusFlight){flight.current?.scrollIntoView({block:'start',behavior:'instant'});flight.current?.focus({preventScroll:true});}
      };w.postMessage({id,design:d,kind,spacingKm});
    }catch(e){request.current++;worker.current?.terminate();worker.current=null;setBusy('');setStudy(old=>old?.status==='running'?{...old,status:'error'}:old);setError((e as Error).message);}
  }
  function cancel(){request.current++;worker.current?.terminate();worker.current=null;setBusy('');setStudy(old=>old?.status==='running'?{...old,status:'cancelled'}:old);setNotice(result?'Calculation stopped. Your last completed flight remains available.':'Calculation stopped. Choose Run release to try again.');}
  function adopt(d:PhobosDesign,auto=false,keepLink=false,focusFlight=false){if(!keepLink)history.replaceState(null,'','/lab/phobos/');setDesign(d);setBad([]);setFieldKey(k=>k+1);setInspected(d.release);run(d,auto,'run',100,focusFlight);}
  useEffect(()=>{
    let initial={...PHOBOS_DEFAULT},message='';
    try {const raw=new URLSearchParams(location.hash.slice(1)).get('p');if(raw)initial=readPhobos(raw);}
    catch(e){message=`Shared design rejected: ${(e as Error).message}`;}
    adopt(initial,false,true);if(message)setError(message);
    return()=>worker.current?.terminate();
  },[]);
  useEffect(()=>{
    let raf=0,last=0,paint=0;
    const tick=(now:number)=>{raf=requestAnimationFrame(tick);const r=runRef.current;
      if(playingRef.current&&r&&!document.hidden){clock.current=Math.min(r.duration,clock.current+Math.min((now-last)/1000,.1)*speedRef.current);if(now-paint>60||clock.current===r.duration){setTime(clock.current);paint=now;}if(clock.current>=r.duration)setPlaying(false);}
      last=now;
    };raf=requestAnimationFrame(tick);
    const pause=()=>{if(document.hidden)setPlaying(false);},motion=matchMedia('(prefers-reduced-motion: reduce)'),reduce=()=>{if(motion.matches)setPlaying(false);};
    document.addEventListener('visibilitychange',pause);motion.addEventListener('change',reduce);
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',pause);motion.removeEventListener('change',reduce);};
  },[]);
  function seek(t:number){setPlaying(false);clock.current=t;setTime(t);}
  function clearPin(){setPinned(null);requestAnimationFrame(()=>{const button=pinButton.current;if(button&&!button.disabled)button.focus();else flight.current?.focus();});}
  function save(){try{if(bad.length)throw Error('Correct the highlighted fields before saving.');localStorage.setItem(KEY,JSON.stringify(validatePhobos(design)));setNotice('Phobos design saved in this browser.');setError('');}catch(e){setError((e as Error).message);}}
  function load(){try{const raw=localStorage.getItem(KEY);if(!raw)throw Error('No Phobos design has been saved in this browser.');adopt(readPhobos(raw));setNotice('Loaded your Phobos design.');}catch(e){setError((e as Error).message);}}
  async function importFile(f:File){try{if(f.size>6000)throw Error('Design exceeds the 6 KB limit.');adopt(readPhobos(await f.text()));setNotice('Phobos design imported. Use Save to keep it in this browser.');}catch(e){setError((e as Error).message);}}
  function field(key:keyof typeof PHOBOS_BOUNDS,label:string,unit:string,step:number){const [min,max]=PHOBOS_BOUNDS[key];
    return <NumericField key={`${fieldKey}-${key}`} name={key} label={label} unit={unit} min={min} max={max} value={design[key]} step={step} onChange={n=>setDesign(old=>({...old,[key]:n}))} onValidity={invalid=>setBad(old=>invalid?[...new Set([...old,key])]:old.filter(x=>x!==key))}/>;
  }
  const failed=result&&result.outcome!=='clear',state=result?phobosSample(result,time):null;
  const currentAltitude=state?Math.hypot(state[0]-MARS_X,state[1])-MARS.radius:0;
  const loads=result?.loads.find(l=>l.arm===inspected);
  const gates=result?[result.loads.every(l=>l.margin>=1&&l.minTensionN>=0),result.outcome==='clear',result.design.release==='inward'&&result.orbit.periapsis>=150000&&result.orbit.periapsis<=750000]:[];
  const presets=[{name:'Low Mars orbit',d:PHOBOS_DEFAULT},{name:'Outbound release',d:{...PHOBOS_DEFAULT,release:'outward' as const}},{name:'Tune a low pass',d:{...PHOBOS_DEFAULT,inwardKm:1500}}];
  return <main className="lab-app phobos-app" id="lab-content">
    <header className="workbench-bar"><div><p className="micro">MARS / PHOBOS ANCHOR</p><h1>Tether Lab <span className="model-tag">{PHOBOS_MODEL}</span></h1></div><div className="workbench-actions"><button onClick={save} disabled={!!bad.length}>Save</button><button onClick={load}>Load</button><button className="share-design" disabled={!!bad.length} onClick={()=>setShare(`${location.origin}/lab/phobos/${phobosFragment(design)}`)}>Share design ↗</button></div></header>
    <div className="studio-worlds" role="group" aria-label="Flight environment"><span>FLIGHT STUDIO</span><a className="studio-world-link" href="/lab/">Earth <small>Orbital rotovator</small></a><a className="studio-world-link" href="/lab/lunar/">Moon <small>Lunavator experiment</small></a><a className="studio-world-link" aria-current="page" href="/lab/phobos/">Phobos <small>Anchored tethers</small></a><a className="studio-world-link" href="/lab/t4/">T4 <small>Two-tier rotor</small></a><a href="/lab/phobos/method/">Phobos model & assumptions ↗</a></div>
    <div className="experiment-strip" aria-label="Experiment presets"><span>START WITH</span>{presets.map((p,i)=><button key={p.name} onClick={()=>adopt({...p.d},true)}><span className="preset-number">0{i+1}</span>{p.name}<span aria-hidden="true">↗</span></button>)}<a href="/lab/architectures/">Architecture catalogue →</a></div>
    <section className="phobos-intro"><div><span className="micro">ONE MOON. TWO DIRECTIONS.</span><h2>Make Phobos the anchor.</h2><p>Release inward toward Mars or outward to a higher orbit. Change the reach. Watch the cost.</p></div><span className="phobos-orbit-fact"><strong>{fmt(PERIOD/3600,2)} h</strong> one Phobos orbit</span></section>
    <div className="phobos-feedback" aria-live="polite">{error?<p role="alert" className="field-error">{error}</p>:notice?<p>{notice}</p>:<p>Payload starts at the terminal. The climb and arrival capture are outside this experiment.</p>}</div>
    {share&&<div className="share-output"><label>Shareable design<input aria-label="Shareable design link" readOnly value={share} onFocus={e=>e.target.select()}/></label><button onClick={()=>setShare('')} aria-label="Close share link">×</button></div>}
    <div className="phobos-workspace">
      <aside className="lab-panel phobos-design" aria-label="Phobos design controls"><div className="panel-heading"><h2>Design bay</h2><span className="tag">{dirty?'UNRUN CHANGES':'RADIAL ARMS'}</span></div>
        <div className="phobos-design-content"><p className="phobos-help">Lengths begin at Phobos’ surface. Both arms turn with the moon around Mars.</p>
          {field('inwardKm','Inward arm','km',1)}{field('outwardKm','Outward arm','km',1)}
          <div className="phobos-release" role="group" aria-label="Release terminal"><button aria-pressed={design.release==='inward'} onClick={()=>setDesign({...design,release:'inward'})}>↓ Inward</button><button aria-pressed={design.release==='outward'} onClick={()=>setDesign({...design,release:'outward'})}>↑ Outward</button></div>
          {field('payloadT','Payload','t',.1)}{field('areaMm2','Cable area','mm²',5)}
          <details className="phobos-material"><summary>Material & safety factor</summary><label>Fiber profile<select aria-label="Fiber profile" value={design.material} onChange={e=>setDesign({...design,material:e.target.value as PhobosDesign['material']})}><option value="zylon">Zylon HM · 5.8 GPa</option><option value="kevlar">Kevlar 49 · 3.0 GPa</option></select></label>{field('safetyFactor','Safety factor','×',.1)}<p>Uniform cable. Published fiber values divided by your safety factor; no flight qualification. <a href="/lab/method/#materials">Sources ↗</a></p></details>
          <button className="primary phobos-run" disabled={!!busy||!!bad.length} onClick={()=>run(design,true)}>{busy==='run'?'Calculating…':'Run release →'}</button>
          {busy==='run'&&<button className="phobos-cancel" onClick={cancel}>Cancel calculation</button>}
          <div className="phobos-files"><button disabled={!!bad.length} onClick={()=>download('phobos-design.json',validatePhobos(design))}>Export design</button><button onClick={()=>file.current?.click()}>Import</button><input ref={file} type="file" accept=".json,application/json" hidden aria-label="Import Phobos design" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value='';}}/></div>
        </div>
      </aside>
      <section className="lab-panel phobos-flight" ref={flight} tabIndex={-1} aria-label="Phobos release flight" aria-busy={busy==='run'}>
        {result?<><PhobosScene result={result} clock={clock} time={time}/>
          <div className="phobos-flight-readout"><div><span>{result.design.release==='inward'?'INWARD':'OUTWARD'} RELEASE {dirty?'· PREVIOUS RUN':''}</span><strong>{duration(time)} <small>/ {duration(result.duration)}</small></strong></div><div><span>CARGO ABOVE MARS</span><strong>{fmt(currentAltitude/1000)} <small>km</small></strong></div><div><span>REPLAY</span><strong>{result.outcome==='structure-limit'?'Blocked':time>=result.duration?'Finished':time===0?'At release':'In flight'}</strong></div></div>
          <div className="phobos-playback"><button className="primary" disabled={!!busy||result.duration===0} onClick={()=>{if(time>=result.duration){clock.current=0;setTime(0);}setPlaying(!playing);}} aria-label={playing?'Pause replay':'Play replay'}>{playing?'Ⅱ':'▶'}</button><input type="range" aria-label="Flight time" min="0" max={result.duration||1} step="1" value={time} disabled={result.duration===0} onChange={e=>seek(+e.target.value)}/><label>Speed<select aria-label="Replay speed" value={speed} onChange={e=>setSpeed(+e.target.value)}>{[120,600,1800].map(s=><option key={s} value={s}>{s}×</option>)}</select></label><button onClick={()=>seek(0)}>Restart</button></div>
        </>:<div className="phobos-loading">{busy==='run'?'Calculating the Mars–Phobos flight…':'Choose Run release to calculate a flight.'}</div>}
      </section>
      <aside className="lab-panel phobos-results" aria-label="Release results" aria-busy={busy==='run'}>
        <div className="panel-heading"><h2>Flight brief</h2><span className={`tag${failed?' tag-amber':''}`}>{busy==='run'?'CALCULATING':dirty?'PREVIOUS RUN':failed?'LIMIT REACHED':'CALCULATED'}</span></div>
        {result&&<><div className="phobos-verdict"><span className="micro">{result.design.release==='inward'?'TOWARD MARS':'AWAY FROM MARS'}</span><h3>{result.outcome==='structure-limit'?'Revise the tether.':result.outcome==='mars-limit'?'This pass is too low.':result.outcome==='phobos-impact'?'Cargo returns to Phobos.':result.orbit.apoapsis===null?'An outbound trajectory.':result.design.release==='inward'?'A lower orbit, without a burn.':'A higher Mars orbit.'}</h3><p>{result.outcome==='structure-limit'?result.issues.join(' '):result.outcome==='mars-limit'?'The flight stops at 150 km above Mars. Shorten the inward arm to raise the next pass.':result.outcome==='phobos-impact'?'The flight reaches the spherical Phobos surface. Change the release reach.':`Clear of both exclusion boundaries for ${fmt(result.duration/3600,1)} simulated hours. ${result.orbit.apoapsis===null?'Escape energy at release; no interplanetary destination is targeted.':result.design.release==='inward'?'The released cargo falls inward while Phobos continues along its orbit.':'The released cargo climbs outward while Phobos continues along its orbit.'}`}</p></div>
          <dl className="phobos-metrics"><div><dt>{result.orbit.apoapsis===null?'Mars escape excess':'Release orbit periapsis'}</dt><dd>{result.orbit.apoapsis===null?fmt(result.orbit.vInfinity,0):fmt(result.orbit.periapsis/1000)} <small>{result.orbit.apoapsis===null?'m/s':'km'}</small></dd></div><div><dt>Lowest cable margin</dt><dd>{fmt(Math.min(...result.loads.map(l=>l.margin)),2)} <small>×</small></dd></div><div><dt>Cable + terminal mass</dt><dd>{fmt((result.loads.reduce((sum,l)=>sum+l.massKg,0)+2*TERMINAL_KG)/1000,1)} <small>t</small></dd></div></dl>
          <div className="phobos-challenge"><span className="micro">LOW MARS ORBIT CHECK</span><ul>{['Both arms carry their loads','Full flight clears both bodies','Inward periapsis: 150–750 km'].map((label,i)=><li key={label} data-pass={gates[i]}><span>{gates[i]?'✓':'○'}</span>{label}</li>)}</ul><button onClick={()=>adopt({...PHOBOS_DEFAULT,inwardKm:1500},true)}>Try the low-pass challenge →</button></div>
          <div className="phobos-flight-actions"><button className="phobos-pin" ref={pinButton} disabled={!!busy||pinned===result} onClick={()=>{setPlaying(false);setPinned(result);}}>{pinned===result?'Flight pinned':pinned?'Replace pinned flight':'Pin calculated flight'}</button><button className="phobos-report" onClick={()=>download('phobos-flight-report.json',{...result,constants:{MARS,PHOBOS,PERIOD,TERMINAL_KG},scope:'Prescribed circular binary; prepositioned payload; static uniform cables before/after release; no capture, climb dynamics, anchor geology or orbit recovery.'})}>Export flight report ↗</button></div>
        </>}
      </aside>
    </div>
    {pinned&&result&&<PhobosComparison pinned={pinned} current={result} dirty={dirty} busy={!!busy} onRestore={()=>adopt(pinned.design,false,false,true)} onClear={clearPin}/>}
    <PhobosStudy study={study} design={design} busy={busy} invalid={!!bad.length} onStart={spacing=>run(design,false,'study',spacing)} onCancel={cancel} onInspect={d=>adopt(d,false,false,true)}/>
    {result&&<div className="phobos-analysis">
      <section className="lab-panel phobos-loads" aria-label="Anchored cable loads"><div className="panel-heading"><h2>What the anchor carries</h2><div className="phobos-arm-switch" role="group" aria-label="Inspected arm">{(['inward','outward'] as const).map(a=><button key={a} aria-pressed={inspected===a} onClick={()=>setInspected(a)}>{a==='inward'?'Inward':'Outward'}</button>)}</div></div>
        {loads&&<><p>Static tension: <span style={{color:"#efa477"}}>dashed copper = loaded</span>; <span style={{color:"#abc2c2"}}>solid pale = empty</span>. Each terminal retains {TERMINAL_KG/1000} t.</p><svg viewBox="0 0 620 145" role="img" aria-label={`${inspected} cable tension from Phobos surface to terminal, loaded and empty`}>
          {(()=>{const allowable=loads.allowablePa*result.design.areaMm2*1e-6,max=Math.max(1,...loads.sections.map(s=>s.loadedN))*1.2,min=Math.min(0,loads.minTensionN)*1.1,length=loads.sections.at(-1)!.distanceM,y=(n:number)=>110-(n-min)/(max-min)*92;
            const points=(field:'loadedN'|'emptyN')=>loads.sections.map(s=>`${45+s.distanceM/length*550},${y(s[field])}`).join(' ');
            return <><line x1="45" y1={y(0)} x2="595" y2={y(0)} stroke="#63747b"/>{allowable<=max&&<line x1="45" y1={y(allowable)} x2="595" y2={y(allowable)} stroke="#b77f64" strokeDasharray="3 5"/>}<polyline points={points('emptyN')} fill="none" stroke="#abc2c2" strokeWidth="2"/><polyline points={points('loadedN')} fill="none" stroke="#efa477" strokeWidth="2" strokeDasharray="5 3"/><text x="45" y="139">Phobos surface</text><text x="595" y="139" textAnchor="end">Terminal · {fmt(length/1000)} km</text><text x="45" y="12">{fmt(max/1000,1)} kN scale · allowable {fmt(allowable/1000,1)} kN</text></>;
          })()}
        </svg><div className="phobos-load-stats"><span>Loaded anchor <strong>{fmt(loads.rootLoadedN/1000,2)} kN</strong></span><span>Empty anchor <strong>{fmt(loads.rootEmptyN/1000,2)} kN</strong></span><span>Peak stress <strong>{fmt(loads.maxStressPa/1e6)} MPa</strong></span></div></>}
      </section>
      <section className="lab-panel phobos-energy" aria-label="Transfer energy accounting"><div className="panel-heading"><h2>Where the energy comes from</h2><span className="tag">IDEAL CLIMB</span></div><p>A surface-to-tip transfer exchanges momentum with Phobos. Here its orbit is held fixed.</p>
        <dl><div><dt>From the anchor’s orbital reservoir</dt><dd>{signed(result.budget.anchorWorkJ/1e9)} GJ</dd></div><div><dt>Ideal winch work</dt><dd>{signed(result.budget.winchWorkJ/1e9)} GJ</dd></div><div><dt>Payload energy change</dt><dd>{signed(result.budget.deltaEnergyJ/1e9)} GJ</dd></div></dl>
        <p className="phobos-energy-note">Negative work returns energy. These are ideal net values; motor losses, peak climb power and Phobos’ response are not calculated.</p><a href="/lab/phobos/method/#energy">Energy, angular momentum & limits ↗</a>
      </section>
    </div>}
    <footer className="phobos-boundary">Circular Mars–Phobos gravity · uniform static cables · one impulse-free release. <a href="/lab/phobos/method/">Read the model</a>. <a href="/lab/campaign/">Return to Expeditions →</a></footer>
  </main>;
}
