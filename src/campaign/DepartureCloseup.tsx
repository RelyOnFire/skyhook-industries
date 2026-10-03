import { useEffect, useRef, useState, type ComponentType } from 'react';
import { CARGO, SITE, type Campaign, type Shipment } from './model.js';
import { STAGE_MS, STILL_PROGRESS } from '../components/flight-story-motion.js';
import DepartureDiagram from './DepartureDiagram.js';
import './departure-closeup.css';

const labels=['Approach','Capture','Swing','Release'];
const offsets=[0,STAGE_MS[0],STAGE_MS[0]+STAGE_MS[1],STAGE_MS[0]+STAGE_MS[1]+STAGE_MS[2]];
const duration=STAGE_MS.slice(0,4).reduce((sum,t)=>sum+t,0);
const n=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const captions=['Match the moving lower tip.','Align the fitting. Close the grapple.','Carry the payload outward.','Release. Its velocity carries it onward.'];

export default function DepartureCloseup({shipment,world,networkPlaying,onClose}:{shipment:Shipment;world:Campaign;networkPlaying:boolean;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false);
  const [Scene,setScene]=useState<ComponentType<{stage:number;progress:number}>|null>(null);
  useEffect(()=>{
    const d=dialog.current!,origin=document.activeElement;
    d.showModal();closeButton.current?.focus({preventScroll:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    if(reduced.matches)setElapsed(STAGE_MS[0]*STILL_PROGRESS[0]);else setPlaying(true);
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
  const progress=Math.min(1,(elapsed-offsets[stage])/STAGE_MS[stage]);
  const inFlight=world.flights.some(f=>f.id===shipment.id);
  const toggle=()=>{if(elapsed>=duration)setElapsed(0);setPlaying(value=>!value);};
  return <dialog ref={dialog} className="departure-dialog" aria-labelledby="departure-heading" data-phase={labels[stage].toLowerCase()} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.code==='Space'&&!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!(event.target instanceof Element&&event.target.closest('button,input,a,select,textarea'))){event.preventDefault();toggle();}
  }}>
    <header className="departure-header"><div><p className="campaign-eyebrow">Flight {shipment.id} / EARTH TETHER</p><h2 id="departure-heading">Cargo departure</h2></div><button ref={closeButton} onClick={onClose} aria-label="Close departure">×</button></header>
    <div className="departure-manifest"><strong>{SITE[shipment.from].name} <span>→</span> {SITE[shipment.to].name}</strong><span>{n(shipment.cargoT)} t {CARGO[shipment.kind].toLowerCase()}</span><span className="departure-live">{inFlight?'In transit':world.day>=shipment.arrival?'Delivered':'Departure recorded'}</span></div>
    <div className="departure-stage" tabIndex={0} aria-label={`${labels[stage]}. ${captions[stage]} Space plays or pauses this close-up.`}>
      {Scene?<Scene stage={stage} progress={progress}/>:<div className="departure-visual" data-renderer="diagram"><DepartureDiagram stage={stage} progress={progress}/></div>}
      <div className="departure-overlay"><span>{String(stage+1).padStart(2,'0')} / {labels[stage].toUpperCase()}</span><span>CONCEPT REPLAY</span></div>
      <p className="departure-caption">{captions[stage]}</p>
    </div>
    <div className="departure-controls"><button className="primary" onClick={toggle}>{elapsed>=duration?'Replay close-up':playing?'Pause close-up':'Play close-up'}</button><label><span className="sr-only">Departure progress</span><input aria-label="Departure progress" type="range" min="0" max="1000" step="1" value={Math.round(elapsed/duration*1000)} aria-valuetext={`${labels[stage]}, ${Math.round(elapsed/duration*100)} percent through departure replay`} onChange={event=>{setPlaying(false);setElapsed(Number(event.target.value)/1000*duration);}}/></label><span>{Math.floor(elapsed/1000)} / {duration/1000} s</span></div>
    <nav className="departure-phases" aria-label="Departure moments">{labels.map((label,index)=><button key={label} aria-pressed={stage===index} onClick={()=>{setPlaying(false);setElapsed(offsets[index]+STAGE_MS[index]*STILL_PROGRESS[index]);}}>{label}</button>)}</nav>
    <div className="departure-footer"><p>Illustrative Earth handoff, not a reconstruction of this flight. The replay has its own clock.<br/><span>{networkPlaying?'Simulation running':'Simulation paused'} · Day {n(world.day)} · Arrives Day {n(shipment.arrival)}</span></p><button onClick={onClose}>Back to network</button></div>
  </dialog>;
}
