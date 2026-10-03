import { useEffect, useMemo, useRef, useState } from 'react';
import { compile, environment, pointState, type Design } from '../simulation/engine.js';
import type { ReturnResult } from '../simulation/return-traffic.js';
import type { StudioUnits } from './StudioUnits.js';
import { Modal } from './Missions.js';
import './return-study.css';
const fmt=(v:number,d=1)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
export default function ReturnStudy({design,units,onClose}:{design:Design;units:StudioUnits;onClose:()=>void}) {
  const [mass,setMass]=useState(String(design.payloadT)),[swing,setSwing]=useState('90');
  const [result,setResult]=useState<ReturnResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false);
  const worker=useRef<Worker|null>(null);
  const frames=useMemo(()=>result?.frames.filter(f=>result.captureTime===null||f.t>=result.captureTime-95)??[],[result]);
  const frame=frames[Math.min(index,frames.length-1)];
  const valid=mass.trim()!==''&&swing.trim()!==''&&Number.isFinite(+mass)&&+mass>=.1&&+mass<=250&&Number.isFinite(+swing)&&+swing>=20&&+swing<=150;
  useEffect(()=>()=>worker.current?.terminate(),[]);
  useEffect(()=>{
    if(!playing)return;
    const id=window.setInterval(()=>setIndex(i=>{if(i>=frames.length-1){setPlaying(false);return i;}return i+1;}),100);
    const hidden=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hidden);
    return()=>{clearInterval(id);document.removeEventListener('visibilitychange',hidden);};
  },[playing,frames.length]);
  function run(){
    worker.current?.terminate();setBusy(true);setError('');setResult(null);setPlaying(false);
    try {
      const w=new Worker(new URL('./return-worker.ts',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=e=>{if(worker.current!==w)return;w.terminate();worker.current=null;setBusy(false);if(e.data.error)setError(e.data.error);else{setResult(e.data.result);setIndex(0);}};
      w.onerror=()=>{if(worker.current!==w)return;w.terminate();worker.current=null;setBusy(false);setError('The return calculation could not finish. Try again.');};
      w.postMessage({design,settings:{massT:+mass,swingDeg:+swing}});
    }catch(e){setBusy(false);setError((e as Error).message);}
  }
  function edit(set:(v:string)=>void,value:string){set(value);setResult(null);setPlaying(false);}
  const env=environment(design),body=frame?compile({...design,payloadT:result!.settings.massT},frame.state[6],frame.loaded):null;
  const scale=Math.min(600/(design.spanKm*2000),300/(design.spanKm*1600));
  const x=(v:number)=>320+(v-(frame?.state[0]??0))*scale,y=(v:number)=>180-(v-(frame?.state[1]??0))*scale;
  const ends=frame&&body?[pointState(frame.state,body,-body.half),pointState(frame.state,body,body.half)]:[];
  const path=frames.filter(f=>f.payload).map((f,i)=>`${i?'L':'M'}${x(f.payload![0])},${y(f.payload![1])}`).join(' ');
  const distanceScale=units.distance==='km'?1000:1,speedScale=units.speed==='km/s'?1000:1;
  return <Modal title="Recover with returning cargo" onClose={onClose} wide>
    <p className="modal-intro">After the first outbound delivery, catch a separate returning shipment at an upper pass. Let it give energy back during the swing, then release it toward a lower orbit.</p>
    <div className="return-inputs">
      <label>Returning mass (t)<input type="number" min="0.1" max="250" step="0.1" value={mass} disabled={busy} onChange={e=>edit(setMass,e.target.value)}/></label>
      <label>Return swing (°)<input type="number" min="20" max="150" step="1" value={swing} disabled={busy} onChange={e=>edit(setSwing,e.target.value)}/></label>
      <button className="primary" disabled={busy||!valid} onClick={run}>{busy?'Calculating return…':'Compare return exchange'}</button>
      {busy&&<button onClick={()=>{worker.current?.terminate();worker.current=null;setBusy(false);}}>Cancel</button>}
    </div>
    {!valid&&<p role="alert">Use a returning mass of 0.1–250 t and a swing of 20–150°.</p>}
    {error&&<p role="alert">{error}</p>}
    {result&&<div className="return-comparison" data-return-status={result.status}>
      <div className="return-replay">
        {frame&&<><svg viewBox="0 0 640 360" role="img" aria-label={`Returning cargo: ${frame.phase}. Camera follows the facility.`}>
          <rect width="640" height="360" fill="#081118"/>
          <circle cx={x(0)} cy={y(0)} r={env.radius*scale} fill="#173342" stroke="#668b9b"/>
          <circle cx={x(0)} cy={y(0)} r={(env.radius+env.cutoff)*scale} fill="none" stroke="#668b9b" strokeDasharray="3 6"/>
          <path d={path} fill="none" stroke="#efa477" strokeWidth="1.5" strokeDasharray="3 5"/>
          <line x1={x(ends[0][0])} y1={y(ends[0][1])} x2={x(ends[1][0])} y2={y(ends[1][1])} stroke="#dae7ed" strokeWidth="3"/>
          {ends.map((p,i)=><circle key={i} cx={x(p[0])} cy={y(p[1])} r="4" fill="#dae7ed"/>)}
          <circle cx="320" cy="180" r="5" fill="#91cbd6"/>
          {frame.payload&&<circle cx={x(frame.payload[0])} cy={y(frame.payload[1])} r="6" fill="#efa477"/>}
        </svg><p className="return-phase">{frame.phase==='approach'?'Returning payload approaches':frame.phase==='attached'?'Captured · transferring energy':frame.phase==='released'?'Released · independent coast':'Waiting for the upper pass'} <span>+{fmt(frame.t/60)} min</span></p>
        <div className="return-playback"><button onClick={()=>{if(index>=frames.length-1)setIndex(0);setPlaying(v=>!v);}}>{playing?'Pause return replay':'Play return replay'}</button><input aria-label="Return replay time" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} onChange={e=>{setPlaying(false);setIndex(+e.target.value);}}/></div>
        <p className="return-caption">Camera follows the facility. Orange: returning cargo. Cable width and markers enlarged.</p></>}
      </div>
      <div className="return-receipt" aria-live="polite">
        <h3>{result.status==='complete'?'Return exchange achieved':result.status==='unsafe-release'?'Release is not usable':'Return experiment stopped'}</h3><p>{result.reason}</p>
        <dl>
          <div><dt>Outbound energy returned</dt><dd>{result.recoveredFraction===null?'—':`${fmt(result.recoveredFraction*100)}%`}</dd></div>
          <div><dt>Facility energy gained</dt><dd>{result.facilityEnergyGainJ===null?'—':`${fmt(result.facilityEnergyGainJ/1e9,2)} GJ`}</dd></div>
          <div><dt>Return-orbit perigee</dt><dd>{result.releasedOrbit?`${fmt(result.releasedOrbit.perigee/distanceScale)} ${units.distance}`:'—'}</dd></div>
          <div><dt>Minimum load margin</dt><dd>{fmt(result.minMargin,2)} ×</dd></div>
        </dl>
        {result.releaseTime!==null&&<><h4>What still needs recovery?</h4><p>{result.ready?'Orbit and spin meet the instantaneous readiness tolerances at release. A sustained readiness check is still required.':'Energy return alone has not restored the required orbit and spin.'}</p><dl>
          <div><dt>Radius error</dt><dd>{fmt(result.radiusErrorM!/distanceScale,2)} {units.distance}</dd></div>
          <div><dt>Tangential speed error</dt><dd>{fmt(result.speedErrorMs!/speedScale,3)} {units.speed}</dd></div>
          <div><dt>Spin error</dt><dd>{fmt(result.spinErrorPct!,2)}%</dd></div>
        </dl></>}
        <details><summary>Arrival and conservation checks</summary><p>Match: {result.match?`${fmt(result.match.positionErrorM,6)} m / ${fmt(result.match.velocityErrorMs,8)} m/s`:'not reached'}. Energy residual: {result.energyResidualJ===null?'—':`${fmt(result.energyResidualJ,3)} J`}. Angular-momentum residual: {result.angularResidual===null?'—':`${fmt(result.angularResidual,2)} kg·m²/s`}.</p></details>
      </div>
    </div>}
    <p className="modal-footnote">This R1 comparison uses the last flown Earth design and a constructed, independently propagated 90-second arrival. All reboost actuators stay off and existing propellant stays aboard. It does not solve a Moon-to-Earth route, physical capture shock or subsequent chemical/electrical trimming. <a href="/lab/method/#return-traffic">Model and limits ↗</a></p>
  </Modal>;
}
