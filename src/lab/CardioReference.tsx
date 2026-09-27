import {useEffect,useMemo,useState} from 'react';
import {EARTH} from '../simulation/engine.js';
import {CARDIO_REFERENCE_DEFAULT,CARDIO_REFERENCE_BOUNDS,validateCardioReference,cardioReferenceOrbit,cardioReferenceSample,cardioReferenceSummary} from '../simulation/cardio-reference.js';
import {traceCardioReferenceRelease,type CardioReferenceRelease} from '../simulation/cardio-reference-release.js';
import NumericField from './StudioField.js';
import {displayNumber,modelNumber,type StudioUnits} from './StudioUnits.js';
import './cardio-reference.css';

const number=(value:number,digits=1)=>value.toLocaleString('en-US',{maximumFractionDigits:digits});
type ReferenceDesign=typeof CARDIO_REFERENCE_DEFAULT;

export default function CardioReference({units}:{units:StudioUnits}){
  const [draft,setDraft]=useState<ReferenceDesign>({...CARDIO_REFERENCE_DEFAULT}),[bad,setBad]=useState<string[]>([]),[generation,setGeneration]=useState(0);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [trace,setTrace]=useState<CardioReferenceRelease|null>(null),[traceError,setTraceError]=useState('');
  const clearTrace=()=>{setTrace(null);setTraceError('');};
  const checked=useMemo(()=>{try{return {design:validateCardioReference(draft),error:''};}catch(error){return {design:null,error:(error as Error).message};}},[draft]);
  const geometry=useMemo(()=>{
    if(!checked.design)return null;
    const design=checked.design,orbit=cardioReferenceOrbit(design),summary=cardioReferenceSummary(design);
    const samples=Array.from({length:721},(_,i)=>cardioReferenceSample(design,orbit.period*i/720));
    const points=[...samples.flatMap(frame=>[frame.station,frame.tip]),...(trace?.frames.map(frame=>frame.state)??[])];
    const extent=Math.max(EARTH*1.2,...points.map(point=>Math.max(Math.abs(point[0]),Math.abs(point[1]))))*1.15;
    const scale=248/extent,xy=(point:readonly number[])=>[400+point[0]*scale,306-point[1]*scale];
    const path=(key:'tip'|'station')=>samples.map(frame=>xy(frame[key]).join(',')).join(' ');
    return {design,orbit,summary,scale,xy,stationPath:path('station'),tipPath:path('tip'),apogee:samples[0],perigee:samples[360]};
  },[checked,trace]);
  const invalid=bad.length>0||!geometry;
  useEffect(()=>{setBad([]);setGeneration(value=>value+1);},[units.distance]);
  useEffect(()=>{
    if(!playing||!geometry||invalid)return;
    let request=0,last=performance.now(),elapsed=time;
    const tick=(now:number)=>{
      elapsed=Math.min(geometry.orbit.period,elapsed+Math.min(.1,(now-last)/1000)*geometry.orbit.period/32);last=now;
      setTime(elapsed);
      if(elapsed>=geometry.orbit.period){setPlaying(false);return;}
      request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request);
  },[playing,geometry,invalid]);
  useEffect(()=>{const hide=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
  const distance=(metres:number)=>number(metres/(units.distance==='km'?1000:1)),speed=(metresPerSecond:number)=>number(metresPerSecond/(units.speed==='km/s'?1000:1),2);
  const orbitDistance=(metres:number)=>{const value=metres/(units.distance==='km'?1000:1);return Math.abs(value)>=1e8?value.toExponential(3):distance(metres);};
  const change=(key:keyof ReferenceDesign,value:number)=>{clearTrace();setPlaying(false);setTime(0);setDraft(previous=>({...previous,[key]:value}));};
  const field=(key:keyof ReferenceDesign,label:string)=>{
    const [min,max]=CARDIO_REFERENCE_BOUNDS[key],scale=units.distance==='m'?1000:1;
    return <NumericField key={`${key}-${generation}-${scale}`} name={`cardio-reference-${key}`} label={label} unit={units.distance} value={displayNumber(draft[key],scale)} min={displayNumber(min,scale)} max={displayNumber(max,scale)} step={10*scale} onChange={value=>change(key,modelNumber(value,scale))} onValidity={value=>{if(value)clearTrace();setPlaying(false);setBad(previous=>value?[...new Set([...previous,key])]:previous.filter(item=>item!==key));}}/>;
  };
  const frame=geometry?cardioReferenceSample(geometry.design,time):null;
  const jump=(fraction:number)=>{if(!geometry)return;clearTrace();setPlaying(false);setTime(geometry.orbit.period*fraction);};
  const phase=time===0||geometry&&Math.abs(time-geometry.orbit.period)<1e-6?'Apogee · arm inward':geometry&&Math.abs(time-geometry.orbit.period/2)<.01?'Perigee · arm outward':'Between apsides';
  const traceHere=()=>{
    if(!geometry||invalid)return;
    setPlaying(false);setTraceError('');
    try{setTrace(traceCardioReferenceRelease(geometry.design,Math.max(0,Math.min(1,time/geometry.orbit.period))));}
    catch(error){setTrace(null);setTraceError((error as Error).message);}
  };
  const exportTrace=()=>{
    if(!trace)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'skyhook-cardio-reference-release',version:1,...trace},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='cardio-reference-release.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const outcomes={'below-cutoff':'Release point is below the 120 km cutoff','crosses-cutoff':'Trajectory crosses the 120 km cutoff',bound:'Earth-bound trajectory',escape:'Earth escape trajectory'};
  return <section className="cardio-reference" data-testid="cardio-reference" aria-labelledby="cardio-reference-title">
    <header className="cardio-reference-heading"><p className="micro">THE SYNCHRONIZED ARCHITECTURE</p><h2 id="cardio-reference-title">Inward for pickup. Outward at perigee.</h2><p>The station follows an ellipse while the arm makes two full turns per orbit. At apogee, the arm reaches down to the pickup altitude. Half an orbit later, it points away from Earth as the station makes its closest pass.</p></header>
    <div className="cardio-reference-layout">
      <aside className="lab-panel cardio-reference-controls" aria-label="Synchronized reference geometry"><div className="panel-heading"><h3>Shape the reference</h3></div><div className="cardio-reference-fields">
        {field('perigeeKm','Station perigee')}{field('apogeeKm','Station apogee')}{field('pickupKm','Pickup altitude')}
        {checked.error&&<p className="field-error" role="alert">{checked.error}</p>}
        <dl className="cardio-reference-derived"><div><dt>Station-to-tip arm</dt><dd data-testid="cardio-reference-arm-length">{geometry?distance(geometry.orbit.length):'—'}<span>{units.distance}</span></dd></div><div><dt>Spin / orbit</dt><dd>2<span>turns / orbit</span></dd></div><div><dt>Nominal orbit</dt><dd>{geometry?number(geometry.orbit.period/60):'—'}<span>min</span></dd></div></dl>
        <p>The arm length follows from apogee minus pickup altitude. Spin and phase are prescribed to preserve this pattern.</p>
        {geometry&&<p className={geometry.summary.minClearance<0?'cardio-reference-ground-crossing':''}>Lowest sampled cable clearance over the orbit: <strong className="cardio-reference-quantity">{distance(geometry.summary.minClearance)} {units.distance}</strong>.{geometry.summary.minClearance<0?' This geometry intersects Earth.':''}</p>}
        <button className="cardio-reference-reset" onClick={()=>{clearTrace();setDraft({...CARDIO_REFERENCE_DEFAULT});setBad([]);setGeneration(value=>value+1);setPlaying(false);setTime(0);}}>Reset reference geometry</button>
      </div></aside>
      <div className="lab-panel cardio-reference-view">
        <div className="cardio-reference-view-heading"><span className="tag">PRESCRIBED GEOMETRY</span><span>{invalid?'Check geometry inputs':phase}</span></div>
        {geometry&&frame?<svg className="cardio-reference-scene" viewBox="0 0 800 620" role="img" aria-label="Synchronized CardioRotovator: elliptical station orbit and calculated tip path" data-testid="cardio-reference-scene" data-time={time.toFixed(3)} data-arm-radial-dot={(Math.cos(frame.angle)*frame.station[0]+Math.sin(frame.angle)*frame.station[1]).toFixed(3)}>
          <defs><radialGradient id="cardio-reference-earth" cx="32%" cy="28%"><stop stopColor="#416577"/><stop offset=".7" stopColor="#203a48"/><stop offset="1" stopColor="#0b1a23"/></radialGradient></defs>
          <circle cx="400" cy="306" r={(EARTH+100000)*geometry.scale} fill="none" stroke="#8b725b" strokeDasharray="3 6" opacity=".7"/>
          <circle cx="400" cy="306" r={EARTH*geometry.scale} fill="url(#cardio-reference-earth)" stroke="#68838e" strokeWidth=".8"/>
          <ellipse cx="400" cy="306" rx={EARTH*geometry.scale*.42} ry={EARTH*geometry.scale} fill="none" stroke="#91acb6" opacity=".12"/>
          <ellipse cx="400" cy="306" rx={EARTH*geometry.scale} ry={EARTH*geometry.scale*.27} fill="none" stroke="#91acb6" opacity=".12"/>
          <text x="400" y="312" textAnchor="middle" className="cardio-reference-earth-label">EARTH</text>
          <polyline data-testid="cardio-reference-station-path" points={geometry.stationPath} fill="none" stroke="#92b8c7" strokeWidth="1.5" strokeDasharray="5 6" opacity=".8"/>
          <polyline data-testid="cardio-reference-tip-path" points={geometry.tipPath} fill="none" stroke="#dba780" strokeWidth="2.2"/>
          {trace&&trace.frames.length>1&&<g data-testid="cardio-reference-release-path">
            <polyline points={trace.frames.map(point=>geometry.xy(point.state).join(',')).join(' ')} fill="none" stroke="#9ddac8" strokeWidth="2.4" strokeDasharray="7 4"/>
            {(()=>{const end=geometry.xy(trace.frames.at(-1)!.state);return <g><circle cx={end[0]} cy={end[1]} r="5" fill="#9ddac8"/><text x={end[0]+10} y={end[1]-12} className="cardio-reference-coast-label">+{number(trace.duration/60)} min</text></g>;})()}
          </g>}
          {[geometry.apogee,geometry.perigee].map((point,index)=>{const station=geometry.xy(point.station),tip=geometry.xy(point.tip);return <g key={index} opacity=".6"><line x1={station[0]} y1={station[1]} x2={tip[0]} y2={tip[1]} stroke="#ead7b7" strokeWidth="2" strokeDasharray="4 4"/><circle cx={station[0]} cy={station[1]} r="5" fill="#0e1920" stroke="#a8c8d1"/><text x={station[0]} y={station[1]-22} textAnchor="middle" className="cardio-reference-apsis">{index?'PERIGEE':'APOGEE'}</text></g>;})}
          {(()=>{const station=geometry.xy(frame.station),tip=geometry.xy(frame.tip);return <g data-testid="cardio-reference-moving-arm"><line x1={station[0]} y1={station[1]} x2={tip[0]} y2={tip[1]} stroke="#f4d3b2" strokeWidth="4"/><rect x={station[0]-6} y={station[1]-6} width="12" height="12" rx="1" fill="#dae8e8" stroke="#13232c" strokeWidth="2"/><circle cx={tip[0]} cy={tip[1]} r="5.5" fill="#f5ad7c" stroke="#201710" strokeWidth="2"/></g>;})()}
        </svg>:<div className="cardio-reference-unavailable">Enter an apogee above perigee and pickup altitude to draw the reference.</div>}
        <div className="cardio-reference-legend"><span><i className="tip"/>Tip path</span><span><i className="station"/>Station ellipse</span><span>Square: station · dot: grapple tip</span>{trace&&trace.frames.length>1&&<span><i className="particle"/>Free particle path</span>}</div>
        <div className="cardio-reference-playback"><button disabled={invalid} aria-label={playing?'Pause synchronized reference':'Play synchronized reference'} onClick={()=>{clearTrace();if(geometry&&time>=geometry.orbit.period-1e-6)setTime(0);setPlaying(value=>!value);}}>{playing?'Ⅱ Pause':'▶ Play'}</button><input type="range" aria-label="Synchronized reference time" min={0} max={geometry?.orbit.period||1} step="any" value={time} disabled={invalid} onChange={event=>{clearTrace();setPlaying(false);setTime(+event.target.value);}}/><span>{number(time/60)} min</span></div>
        <div className="cardio-reference-jumps"><button disabled={invalid} onClick={()=>jump(0)}>Apogee pickup</button><button disabled={invalid} onClick={()=>jump(.5)}>Perigee clearance</button><button disabled={invalid} onClick={traceHere}>Trace release here</button></div>
        <dl className="cardio-reference-readout"><div><dt>Tip altitude now</dt><dd data-testid="cardio-reference-tip-altitude">{frame?distance(frame.tipAltitude):'—'} {units.distance}</dd></div><div><dt>Tip inertial speed</dt><dd>{frame?speed(frame.tipSpeed):'—'} {units.speed}</dd></div><div><dt>Lowest cable point now</dt><dd>{frame?distance(frame.clearance):'—'} {units.distance}</dd></div></dl>
        <div className="cardio-reference-release-help">Pause or scrub to a phase, then trace a test particle released with the tip’s velocity. The plot fits the next 30 minutes of free flight; changing phase clears the trace.</div>
        {traceError&&<p role="alert" className="cardio-reference-release-help">{traceError}</p>}
        {trace&&<section className="cardio-reference-release" aria-label="Reference release trajectory">
          <p className="micro">IDEAL TEST PARTICLE · C1k</p>
          <h3 role="status">{outcomes[trace.outcome]}</h3>
          <p>Released {number(trace.releaseTime/60)} minutes after apogee ({number(trace.fraction*100,2)}% of the orbit). {trace.outcome==='below-cutoff'?'No flight is propagated below the cutoff.':trace.status==='cutoff'?`The drawn coast stops at 120 km after ${number(trace.duration/60)} minutes.`:'The dashed path shows 30 minutes of free flight.'} {trace.outcome==='crosses-cutoff'&&trace.status==='horizon'?'The predicted crossing is beyond the drawn segment.':''}</p>
          <dl className="cardio-reference-readout">
            <div><dt>Release speed</dt><dd>{speed(Math.hypot(trace.initial[2],trace.initial[3]))} {units.speed}</dd></div>
            <div><dt>Orbit perigee altitude</dt><dd>{orbitDistance(trace.elements.perigee)} {units.distance}</dd></div>
            <div><dt>{trace.elements.apogee===null?'Excess escape speed':'Orbit apogee altitude'}</dt><dd>{trace.elements.apogee===null?`${speed(Math.sqrt(Math.max(0,2*trace.elements.energy)))} ${units.speed}`:`${orbitDistance(trace.elements.apogee)} ${units.distance}`}</dd></div>
          </dl>
          <p>The particle coasts under Earth’s gravity. Tether recoil, payload mass, loads and control effort are excluded. Negative perigee altitude means the mathematical orbit intersects Earth. This does not establish a safe tether or a destination encounter.</p>
          <div className="cardio-reference-trace-actions"><button onClick={exportTrace}>Export reference release</button><button onClick={clearTrace}>Clear release trace</button></div>
        </section>}
      </div>
    </div>
    <p className="cardio-reference-boundary"><strong>This view prescribes the synchronized motion.</strong> It illustrates the reference geometry; it does not calculate a controller, tether loads, atmospheric flight or a payload approach. The 100 km ring marks the upper atmosphere for orientation. An uncontrolled tether can drift away from this pattern; the separate free-coast experiment below explores that.</p>
  </section>;
}
