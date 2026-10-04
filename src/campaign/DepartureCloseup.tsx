import { useEffect, useRef, useState, type ComponentType } from 'react';
import { CARGO, SITE, type Campaign, type Shipment } from './model.js';
import { LAUNCH_LABELS as labels, LAUNCH_MS, LAUNCH_STILLS, earthLaunchFrame } from './earth-launch-motion.js';
import DepartureDiagram from './DepartureDiagram.js';
import './departure-closeup.css';

const offsets=[0,LAUNCH_MS[0],LAUNCH_MS[0]+LAUNCH_MS[1],LAUNCH_MS[0]+LAUNCH_MS[1]+LAUNCH_MS[2]];
const duration=LAUNCH_MS.reduce((sum,t)=>sum+t,0);
const n=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const captions=['The aircraft accelerates, then coasts upward with its engines off.','Match position and velocity. Grapple the cargo above the aircraft.','The aircraft returns. The tether lifts the cargo and adds speed.','Release outward. The cargo keeps the velocity gained from the tether.'];

export default function DepartureCloseup({shipment,world,networkPlaying,onClose}:{shipment?:Shipment;world:Campaign;networkPlaying:boolean;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false);
  const [Scene,setScene]=useState<ComponentType<{stage:number;progress:number}>|null>(null);
  useEffect(()=>{
    const d=dialog.current!,origin=document.activeElement;
    d.showModal();closeButton.current?.focus({preventScroll:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    if(reduced.matches)setElapsed(LAUNCH_MS[0]*LAUNCH_STILLS[0]);else setPlaying(true);
    const motion=()=>{if(reduced.matches)setPlaying(false);};
    const hidden=()=>{if(document.hidden)setPlaying(false);};
    reduced.addEventListener('change',motion);document.addEventListener('visibilitychange',hidden);
    return()=>{
      d.close();reduced.removeEventListener('change',motion);document.removeEventListener('visibilitychange',hidden);
      // A delivery can remove the initiating traffic row while its replay is open.
      const target=origin instanceof HTMLElement&&origin.isConnected?origin:document.querySelector<HTMLElement>('#lab-content');
      target?.focus({preventScroll:true});
    };
  },[]);
  useEffect(()=>{let alive=true;import('./DepartureScene.js').then(module=>{if(alive)setScene(()=>module.default);}).catch(()=>{/* The diagram remains fully usable if the optional 3D bundle cannot load. */});return()=>{alive=false;};},[]);
  useEffect(()=>{
    if(!playing)return;
    let frame=0,previous:number|null=null;
    const tick=(now:number)=>{if(previous!==null)setElapsed(t=>Math.min(duration,t+Math.min(100,now-previous!)));previous=now;frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing]);
  useEffect(()=>{if(elapsed>=duration)setPlaying(false);},[elapsed]);
  const stage=elapsed>=offsets[3]?3:elapsed>=offsets[2]?2:elapsed>=offsets[1]?1:0;
  const progress=Math.min(1,(elapsed-offsets[stage])/LAUNCH_MS[stage]),f=earthLaunchFrame(stage,progress);
  const inFlight=!!shipment&&world.flights.some(f=>f.id===shipment.id);
  const toggle=()=>{if(elapsed>=duration)setElapsed(0);setPlaying(value=>!value);};
  return <dialog ref={dialog} className="departure-dialog" aria-labelledby="departure-heading" data-mode={shipment?'flight':'concept'} data-phase={labels[stage].toLowerCase()} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.code==='Space'&&!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!(event.target instanceof Element&&event.target.closest('button,input,a,select,textarea'))){event.preventDefault();toggle();}
  }}>
    <header className="departure-header"><div><p className="campaign-eyebrow">{shipment?<>Flight {shipment.id} / EARTH ACCESS</>:'EARTH / HASTOL-INSPIRED CONCEPT'}</p><h2 id="departure-heading">Earth launch</h2></div><button ref={closeButton} onClick={onClose} aria-label="Close departure">×</button></header>
    <div className="departure-manifest">{shipment?<><strong>{SITE[shipment.from].name} <span>→</span> {SITE[shipment.to].name}</strong><span>{n(shipment.cargoT)} t {CARGO[shipment.kind].toLowerCase()}</span><span className="departure-live">{inFlight?'In transit':world.day>=shipment.arrival?'Delivered':'Departure recorded'}</span></>:<><strong>Earth tether</strong><span>Concept demonstration</span></>}</div>
    <div className="departure-stage" tabIndex={0} aria-label={`${labels[stage]}. ${captions[stage]} Space plays or pauses this close-up.`}>
      {Scene?<Scene stage={stage} progress={progress}/>:<div className="departure-visual" data-renderer="diagram"><DepartureDiagram stage={stage} progress={progress}/></div>}
      <div className="departure-overlay"><span>{String(stage+1).padStart(2,'0')} / {labels[stage].toUpperCase()}</span><span>HARDWARE ENLARGED</span></div>
      <p className="departure-caption">{captions[stage]}</p>
    </div>
    <div className="departure-telemetry" aria-label="Illustrative launch readouts"><span>PAYLOAD ALTITUDE<strong>{n(f.altitude)} km</strong></span><span>INERTIAL SPEED<strong>{n(f.payloadSpeed)} km/s</strong></span><span>CARRIER<strong>{stage===3||stage===2?'Returning':f.powered?'Powered climb':f.latched?'Separating':'Engine-off coast'}</strong></span></div>
    <div className="departure-controls"><button className="primary" onClick={toggle}>{elapsed>=duration?'Replay close-up':playing?'Pause close-up':'Play close-up'}</button><label><span className="sr-only">Departure progress</span><input aria-label="Departure progress" type="range" min="0" max="1000" step="1" value={Math.round(elapsed/duration*1000)} aria-valuetext={`${labels[stage]}, ${Math.round(elapsed/duration*100)} percent through departure replay`} onChange={event=>{setPlaying(false);setElapsed(Number(event.target.value)/1000*duration);}}/></label><span>{Math.floor(elapsed/1000)} / {duration/1000} s</span></div>
    <nav className="departure-phases" aria-label="Departure moments">{labels.map((label,index)=><button key={label} aria-pressed={stage===index} onClick={()=>{setPlaying(false);setElapsed(offsets[index]+LAUNCH_MS[index]*LAUNCH_STILLS[index]);}}>{label}</button>)}</nav>
    <details className="departure-explanation"><summary>How the payload reaches space</summary><p>A hypersonic aircraft supplies the first part of the speed and altitude. It makes a ballistic pop-up to meet the lower grapple; at the handoff, both move together. The tether takes the cargo while the aircraft returns, then swings it outward and releases it with greater speed.</p><p>This HASTOL-inspired example meets at 150 km and 4.5 km/s. The readouts describe this illustration; aircraft performance, capture loads and the transfer to {shipment?SITE[shipment.to].name:'another destination'} need separate calculations. Hardware is enlarged and time compressed. <a href="https://www.niac.usra.edu/files/studies/final_report/391Grant.pdf" target="_blank" rel="noreferrer">Read the HASTOL study ↗</a></p></details>
    <div className="departure-footer"><p>{shipment?'Earth launch concept alongside your cargo manifest. The sequence has its own clock.':'Earth launch concept. This demonstration has its own clock and sends no cargo.'}<br/><span>{networkPlaying?'Simulation running':'Simulation paused'} · Day {n(world.day)}{shipment&&<> · Arrives Day {n(shipment.arrival)}</>}</span></p><button onClick={onClose}>Back to network</button></div>
  </dialog>;
}
