import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MATERIALS} from '../../simulation/engine.js';
import {GEOMETRY_DEFAULT,GEOMETRY_PRESETS,GEOMETRY_BOUNDS,validateGeometry,readGeometry,geometryFragment,
  compileGeometry,orbitReference,geometryLoads,materialProperties,sampleGeometry,
  type GeometryNumberKey,type GeometryDesign,type GeometryBody,type GeometryResult,type GeometryCut} from '../../simulation/designer.js';
import {elapsed} from '../view.js';
import DesignerScene from './Scene.js';
import './designer.css';
const fmt=(n:number,d=1)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const KEY='skyhook-geometry-g1';
function Schematic({d,b}:{d:GeometryDesign;b:GeometryBody}) {
  const x=(s:number)=>80+(s-b.min)/(b.max-b.min)*680,hub=x(0),center=x(b.center);
  return <svg viewBox="0 0 840 265" role="img" aria-label={`Draft geometry: arm A ${d.armAKm} km, arm B ${d.armBKm} km. Center of mass ${fmt(b.center/1000,2)} km from the hub.`}>
    <line x1="80" x2="760" y1="50" y2="50" className="gd-dimension"/><path d={`M80 43v14 M${hub} 43v14 M760 43v14`} className="gd-dimension"/>
    <text x={(80+hub)/2} y="36" textAnchor="middle">A · {d.armAKm} km</text><text x={(hub+760)/2} y="36" textAnchor="middle">B · {d.armBKm} km</text>
    <path d={`M80 ${150-(d.shape==='tapered'?2:6)} L${hub} 144 L760 ${150-(d.shape==='tapered'?2:6)} V${150+(d.shape==='tapered'?2:6)} L${hub} 156 L80 ${150+(d.shape==='tapered'?2:6)}Z`} fill="#a6bec1"/>
    <circle cx="80" cy="150" r="10" fill="#c5b8fa"/><text x="80" y="110" textAnchor="middle">End A</text><text x="80" y="130" textAnchor="middle">{d.endAT} t</text>
    <circle cx="760" cy="150" r="10" fill="#f5bd85"/><text x="760" y="110" textAnchor="middle">End B</text><text x="760" y="130" textAnchor="middle">{d.endBT} t</text>
    <rect x={hub-10} y="140" width="20" height="20" fill="#e5edee"/><line x1={hub} x2={hub} y1="165" y2="188" stroke="#e5edee"/>
    <text x={Math.max(170,Math.min(670,hub))} y="207" textAnchor="middle">Hub · {d.hubT} t</text>
    <path d={`M${center-6} 85h12 M${center} 79v12 M${center} 93v46`} stroke="#7de7ee" fill="none"/>
    <text x={Math.max(200,Math.min(640,center))} y="73" textAnchor="middle" className="gd-centroid-label">CENTER OF MASS</text>
    <text x="420" y="252" textAnchor="middle">Arm lengths to scale. Cable width and hardware markers enlarged.</text>
  </svg>;
}
function LoadChart({cuts,r}:{cuts:GeometryCut[];r:GeometryResult}) {
  const limit=materialProperties(r.design).allowable/1e9;
  const max=Math.max(limit*1.15,...cuts.map(c=>c.stress/1e9)),min=Math.min(0,...cuts.map(c=>c.stress/1e9));
  const x=(s:number)=>45+(s-r.body.min)/(r.body.max-r.body.min)*620,y=(stress:number)=>155-(stress-min)/(max-min)*125;
  return <div className="gd-load-chart"><h3>Where the cable is working hardest</h3><div className="gd-small-scale"><span>{fmt(min,1)}–{fmt(max,1)} GPa</span><span>Allowable {fmt(limit,1)} GPa</span></div><svg preserveAspectRatio="none" viewBox="0 0 710 205" role="img" aria-label="Axial stress along the cable at this replay time, compared with the assumed allowable stress">
    {[0,.5,1].map(u=><g key={u}><line x1="45" x2="665" y1={155-u*125} y2={155-u*125} className="gd-grid"/><text x="37" y={160-u*125} textAnchor="end">{fmt(min+u*(max-min),1)}</text></g>)}
    <line x1="45" x2="665" y1={y(limit)} y2={y(limit)} className="gd-allowable"/>
    <text x="660" y={y(limit)-7} textAnchor="end">ASSUMED ALLOWABLE</text>
    <line x1={x(0)} x2={x(0)} y1="28" y2="160" className="gd-hub-line"/>
    <polyline fill="none" className="gd-stress" points={cuts.map(c=>`${x(c.s)},${y(c.stress/1e9)}`).join(' ')}/>
    <text x="45" y="185" textAnchor="start">A · −{r.design.armAKm} km</text><text x="355" y="201" textAnchor="middle">GPa · position measured from the hardware hub</text><text x="665" y="185" textAnchor="end">B · +{r.design.armBKm} km</text>
  </svg><div className="gd-small-scale"><span>A · −{r.design.armAKm} km</span><span>B · +{r.design.armBKm} km</span></div><p>Gray dashed line: hardware hub. This is an axial-load estimate, not a flexible-cable analysis.</p></div>;
}
export default function Designer() {
  const [draft,setDraft]=useState<GeometryDesign>({...GEOMETRY_DEFAULT}),[result,setResult]=useState<GeometryResult|null>(null);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [mobile,setMobile]=useState<'design'|'flight'>('flight'),[time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [plane,setPlane]=useState(false),[machine,setMachine]=useState(false),[share,setShare]=useState('');
  const worker=useRef<Worker|null>(null),sequence=useRef(0),file=useRef<HTMLInputElement>(null);
  const live=useRef({playing,result}),clock=useRef(0);live.current={playing,result};
  const valid=useMemo(()=>{try{const d=validateGeometry(draft);return {design:d,body:compileGeometry(d),error:''};}catch(e){return {design:null,body:null,error:(e as Error).message};}},[draft]);
  const dirty=!!result&&(!valid.design||JSON.stringify(valid.design)!==JSON.stringify(validateGeometry(result.design)));
  const frame=useMemo(()=>result?sampleGeometry(result,time):null,[result,time]);
  const load=useMemo(()=>result&&frame?geometryLoads(frame.state,result.body,result.design):null,[result,frame]);
  const end=result?.frames.at(-1)?.t??0;
  const change=(key:keyof GeometryDesign,value:number|string)=>{setDraft(d=>({...d,[key]:value}));setPlaying(false);setError('');};
  const run=(candidate:GeometryDesign)=>{
    try {
      const design=validateGeometry(candidate);worker.current?.terminate();const id=++sequence.current;
      setPlaying(false);setBusy(true);setProgress(0);setError('');
      const w=new Worker(new URL('./geometry-worker.ts',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=e=>{if(e.data.id!==sequence.current)return;if(e.data.fraction!==undefined){setProgress(e.data.fraction);return;}
        w.terminate();worker.current=null;setBusy(false);if(e.data.error){setError(e.data.error);return;}
        setResult(e.data.result);clock.current=0;setTime(0);setMobile('flight');};
      w.onerror=()=>{if(id===sequence.current){setBusy(false);setError('Coast calculation failed. The previous result is preserved.');}w.terminate();};
      w.postMessage({id,design});
    } catch(e) {setBusy(false);setError((e as Error).message);}
  };
  useEffect(()=>{
    let d={...GEOMETRY_DEFAULT},notice='';
    try{const text=new URLSearchParams(location.hash.slice(1)).get('g');if(text)d=readGeometry(text);}catch(e){notice=(e as Error).message;}
    setDraft(d);run(d);if(notice)setError(notice);
    return()=>{sequence.current++;worker.current?.terminate();};
  },[]);
  useEffect(()=>{
    let raf=0,last=performance.now(),lastUI=0;
    const tick=(now:number)=>{raf=requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;
      if(!live.current.playing||!live.current.result||document.hidden)return;
      const end=live.current.result.frames.at(-1)!.t;clock.current=Math.min(end,clock.current+dt*240);
      if(now-lastUI>80||clock.current===end){setTime(clock.current);lastUI=now;}if(clock.current===end)setPlaying(false);};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[]);
  const seek=(t:number)=>{setPlaying(false);clock.current=t;setTime(t);};
  const fallback=useCallback(()=>{setPlane(true);setMessage('Using the orbital-plane view. It shows the same calculated coast.');},[]);
  const field=(key:GeometryNumberKey,label:string,unit='',step=1)=><label className="gd-field" key={key}><span>{label}<small>{unit}</small></span><input aria-label={label} type="number" value={Number.isFinite(draft[key])?draft[key]:''} min={GEOMETRY_BOUNDS[key][0]} max={GEOMETRY_BOUNDS[key][1]} step={step} aria-invalid={!Number.isFinite(draft[key])||draft[key]<GEOMETRY_BOUNDS[key][0]||draft[key]>GEOMETRY_BOUNDS[key][1]||undefined} onChange={e=>change(key,e.target.value===''?NaN:Number(e.target.value))}/></label>;
  const download=(value:unknown,name:string)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <main className="gd-app" id="lab-content">
    <header className="gd-heading"><div><p className="micro">TETHER DESIGNER / G1</p><h1>Move the mass.<br/>Change the machine.</h1><p>Unequal arms, independent hardware masses, and a different way around Earth.</p></div><div className="gd-scope"><b>First step: coast analysis</b><p>See how the design moves without engines or payloads. Active recovery and cargo transfers stay in their existing labs for now.</p><a href="/lab/designer/method/">Read the model →</a></div></header>
    <div className="gd-presets" aria-label="Geometry presets">{GEOMETRY_PRESETS.map(p=><button key={p.name} disabled={busy} onClick={()=>{setDraft({...p.design});run(p.design);}}><b>{p.name} ↗</b><span>{p.description}</span></button>)}</div>
    {(error||message)&&<div className={`gd-feedback ${error?'gd-error':''}`} role={error?'alert':'status'}><span>{error||message}</span><button aria-label="Dismiss designer message" onClick={()=>{setError('');setMessage('');}}>×</button></div>}
    {busy&&<div className="gd-computing" role="status"><span>Calculating the coast · {Math.round(progress*100)}%</span><progress max={1} value={progress} aria-label="Coast calculation progress"/><button onClick={()=>{worker.current?.terminate();sequence.current++;setBusy(false);setMessage('Calculation cancelled; the previous coast remains intact.');}}>Cancel coast</button></div>}
    <nav className="gd-mobile-nav" aria-label="Designer panels"><button aria-pressed={mobile==='design'} onClick={()=>setMobile('design')}>Geometry & orbit</button><button aria-pressed={mobile==='flight'} onClick={()=>setMobile('flight')}>Calculated coast</button></nav>
    <div className={`gd-workspace mobile-${mobile}`}>
      <aside className="gd-controls" aria-label="Geometry controls"><p className="micro">DRAFT / PHYSICAL DIMENSIONS</p><h2>Two arms. One hub.</h2>
        <div className="gd-pair">{field('armAKm','Arm A length','km')}{field('armBKm','Arm B length','km')}{field('endAT','End A hardware','t',.1)}{field('endBT','End B hardware','t',.1)}</div>
        {field('hubT','Hub hardware','t',.1)}
        <label className="gd-field">Strength material<select aria-label="Designer material" value={draft.material} onChange={e=>change('material',e.target.value)}>{MATERIALS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {draft.material==='custom'&&<div className="gd-pair">{field('density','Custom density','kg/m³')}{field('ultimateGPa','Custom strength','GPa',.1)}</div>}
        <label className="gd-field">Section profile<select aria-label="Designer section profile" value={draft.shape} onChange={e=>change('shape',e.target.value)}><option value="uniform">Uniform</option><option value="tapered">Tapered · 30% at either tip</option></select></label>
        <div className="gd-pair">{field('areaMm2','Section at hub','mm²')}{field('safetyFactor','Strength factor','×',.1)}</div>
        <h2>Choose the orbit.</h2><p className="gd-note">The starting orbit locates the <strong>center of mass</strong>, not the hardware hub. Equal perigee and apogee give a circle.</p>
        <div className="gd-pair">{field('perigeeKm','Initial perigee','km')}{field('apogeeKm','Initial apogee','km')}{field('anomalyDeg','Starting orbital angle','°')}{field('attitudeDeg','Tether angle from radial','°')}{field('spinPeriodMin','Initial spin period','min',.1)}{field('turns','Observation periods','orbits',.25)}</div>
        <p className="gd-note">Orbital angle is measured from perigee. Tether angle points toward End B. Spin starts prograde; gravity then changes the motion.</p>
        {valid.error&&<p role="alert" className="gd-invalid">{valid.error}</p>}
        <button className="gd-primary" disabled={busy||!valid.design} onClick={()=>run(draft)}>{busy?'Calculating…':dirty?'Run edited geometry':'Run coast analysis'} ↗</button>
        <div className="gd-files"><button disabled={!valid.design} onClick={()=>{try{localStorage.setItem(KEY,JSON.stringify(valid.design));setMessage('Geometry saved in this browser.');}catch{setError('Browser storage is unavailable. Export the design instead.');}}}>Save design</button><button disabled={busy} onClick={()=>{try{const text=localStorage.getItem(KEY);if(!text)throw Error('No saved G1 design.');const d=readGeometry(text);setDraft(d);run(d);}catch(e){setError((e as Error).message);}}}>Load</button><button disabled={!valid.design} onClick={()=>download(valid.design,'skyhook-geometry-g1.json')}>Export design</button><button disabled={busy} onClick={()=>file.current?.click()}>Import</button><input hidden ref={file} type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];try{if(f){if(f.size>16000)throw Error('Design exceeds 16 KB.');const d=readGeometry(await f.text());setDraft(d);run(d);}}catch(e){setError((e as Error).message);}finally{if(file.current)file.current.value='';}}}/><button disabled={!valid.design} onClick={async()=>{const url=`${location.origin}${location.pathname}${geometryFragment(valid.design!)}`;setShare(url);history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url);setMessage('Geometry link copied.');}catch{setMessage('Copy the geometry link below.');}}}>Share</button></div>
        {share&&<label className="gd-field">Geometry link<input aria-label="Shareable geometry link" readOnly value={share} onFocus={e=>e.target.select()}/></label>}
      </aside>
      <div className="gd-main">
        <section className="gd-geometry" aria-label="Live draft geometry"><div className="gd-section-top"><h2>The balance point can move.</h2><span className="micro">LIVE DESIGN PREVIEW</span></div>{valid.design&&valid.body?<><div className="gd-diagram" tabIndex={0} aria-label="Geometry diagram; scroll horizontally on a narrow screen"><Schematic d={valid.design} b={valid.body}/></div><p className="gd-diagram-scroll">The diagram scrolls sideways to show both ends.</p><dl className="gd-summary"><div><dt>Dry mass</dt><dd>{fmt(valid.body.mass/1000,2)} t</dd></div><div><dt>Center of mass from hub</dt><dd data-centroid>{fmt(valid.body.center/1000,2)} km</dd></div><div><dt>Moment of inertia</dt><dd>{valid.body.inertia.toExponential(3)} kg·m²</dd></div><div><dt>Initial eccentricity</dt><dd>{fmt(orbitReference(valid.design).e,4)}</dd></div></dl><p className="gd-note">Positive offset is toward End B. Moving mass changes the moment arms; it does not resize the cable. This preview updates before you run.</p></>:<p>Correct the input to rebuild the geometry preview.</p>}</section>
        <section className="gd-flight" aria-label="Designer coast results"><div className="gd-section-top"><div><p className="micro">{dirty?'LAST CALCULATED DESIGN · UNRUN EDITS':'CALCULATED COAST'}</p><h2>Let gravity do the talking.</h2></div><div className="gd-view"><button aria-pressed={!plane} onClick={()=>setPlane(false)}>Globe</button><button aria-pressed={plane} onClick={()=>setPlane(true)}>Orbit plane</button><button aria-pressed={machine} onClick={()=>setMachine(v=>!v)}>Machine view</button></div></div>
          {result&&frame?<DesignerScene result={result} frame={frame} plane={plane} machine={machine} onFallback={fallback}/>:<p className="gd-wait">{busy?'Calculating distributed gravity and structural loads…':'Run a coast analysis.'}</p>}
          <p className="gd-legend">Violet: End A · White square: hub · Amber: End B · Cyan: center of mass<br/>Dashed: starting Kepler ellipse. Thin amber: full calculated path. Marker sizes enlarged.</p>
          <div className="gd-transport"><button aria-label={playing?'Pause designer replay':'Play designer replay'} disabled={busy||dirty||!result||end===0} onClick={()=>{if(time>=end){clock.current=0;setTime(0);}setPlaying(v=>!v);}}>{playing?'Ⅱ Pause':'▶ Play'}</button><button disabled={!result} onClick={()=>seek(0)}>Restart</button><b>T+ {elapsed(time)}</b><span>240× replay</span></div><input aria-label="Designer replay time" type="range" min={0} max={end||1} step={1} value={time} disabled={!result||end===0} onChange={e=>seek(Number(e.target.value))}/>
          {result&&frame&&load&&<div className="gd-report"><p className={result.outcome==='limit'?'gd-invalid':''}><strong>{result.outcome==='limit'?'Model limit reached.':'Coast observation complete.'}</strong> {result.reason}</p><dl className="gd-summary"><div><dt>Closest cable point now</dt><dd>{fmt(frame.clearance/1000,1)} km</dd></div><div><dt>Axial margin now</dt><dd>{fmt(frame.margin,2)}×</dd></div><div><dt>Lowest margin in run</dt><dd>{fmt(result.minMargin,2)}×</dd></div><div><dt>Peak stress from hub now</dt><dd>{fmt(load.peak/1000,1)} km</dd></div></dl>
            <LoadChart cuts={load.cuts} r={result}/>
            <details><summary>Numerical balance & full-run report</summary><p>Unpowered, fixed-mass calculation. Maximum drift at accepted steps: energy {fmt(result.maxEnergyError,4)} J; angular momentum {fmt(result.maxAngularError,2)} kg·m²/s. These are numerical checks, not flight safety margins.</p><p>{result.body.cells} cable mass cells · ≤{result.step} s steps · {fmt(result.frames.at(-1)!.t/3600,2)} simulated hours. No transfer or recovery success is implied.</p><button onClick={()=>download({...result,frames:undefined,initial:result.frames[0],final:result.frames.at(-1)},'skyhook-geometry-coast-report.json')}>Export coast report</button></details></div>}
        </section>
        <p className="gd-boundary">Geometry comes first. These designs do not yet run through Flight Studio or Operations; their existing models and saved results are unchanged. <a href="/lab/designer/method/">Equations, limitations and test basis ↗</a></p>
      </div>
    </div>
  </main>;
}
