import { useEffect, useRef, useState, type ComponentType } from 'react';
import { CARGO, SITE, type Campaign, type Shipment } from './model.js';
import { LAUNCH_LABELS, LAUNCH_MS, LAUNCH_STILLS, earthLaunchFrame } from './earth-launch-motion.js';
import DepartureDiagram from './DepartureDiagram.js';
import LunarDepartureDiagram from './LunarDepartureDiagram.js';
import {LUNAR_LABELS,LUNAR_MS,LUNAR_STILLS,LUNAR_RAIL,lunarLaunchFrame} from './lunar-launch-motion.js';
import './departure-closeup.css';

const n=(value:number,digits=1)=>value.toLocaleString('en-US',{maximumFractionDigits:digits});
const earthCaptions=['The aircraft accelerates, then coasts upward with its engines off.','Match position and velocity. Grapple the cargo above the aircraft.','The aircraft returns. The tether lifts the cargo and adds speed.','Release outward. The cargo keeps the velocity gained from the tether.'];

const lunarCaptions=['Load the cargo into a reusable electromagnetic sled.','Coils accelerate the sled along the raised launch ramp.','The cargo coasts upward and slows under lunar gravity. The sled stays on the Moon.','Match the moving grapple at 50 km. Close the jaws around the cargo fitting.','The tether carries the cargo outward and adds speed.','Open the grapple. The cargo departs with the tip’s velocity.'];

export default function DepartureCloseup({shipment,origin='earth',world,networkPlaying,onClose}:{shipment?:Shipment;origin?:'earth'|'moon';world:Campaign;networkPlaying:boolean;onClose:()=>void}) {
  const lunar=(shipment?.from??origin)==='moon',body=lunar?'Moon':'Earth';
  const labels=lunar?LUNAR_LABELS:LAUNCH_LABELS,times=lunar?LUNAR_MS:LAUNCH_MS,stills=lunar?LUNAR_STILLS:LAUNCH_STILLS,captions=lunar?lunarCaptions:earthCaptions;
  const offsets=times.map((_,i)=>times.slice(0,i).reduce((sum,t)=>sum+t,0)),duration=times.reduce((sum,t)=>sum+t,0);
  const Diagram=lunar?LunarDepartureDiagram:DepartureDiagram;
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false);
  const [Scene,setScene]=useState<ComponentType<{stage:number;progress:number}>|null>(null);
  useEffect(()=>{
    const d=dialog.current!,origin=document.activeElement;
    d.showModal();closeButton.current?.focus({preventScroll:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    if(reduced.matches)setElapsed(times[0]*stills[0]);else setPlaying(true);
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
  useEffect(()=>{let alive=true;(lunar?import('./LunarDepartureScene.js'):import('./DepartureScene.js')).then(module=>{if(alive)setScene(()=>module.default);}).catch(()=>{/* The diagram remains fully usable if the optional 3D bundle cannot load. */});return()=>{alive=false;};},[]);
  useEffect(()=>{
    if(!playing)return;
    let frame=0,previous:number|null=null;
    const tick=(now:number)=>{if(previous!==null)setElapsed(t=>Math.min(duration,t+Math.min(100,now-previous!)));previous=now;frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing]);
  useEffect(()=>{if(elapsed>=duration)setPlaying(false);},[elapsed]);
  const stage=Math.max(0,offsets.reduce((current,offset,index)=>elapsed>=offset?index:current,0));
  const progress=Math.min(1,(elapsed-offsets[stage])/times[stage]),f=lunar?lunarLaunchFrame(stage,progress):earthLaunchFrame(stage,progress);
  const inFlight=!!shipment&&world.flights.some(f=>f.id===shipment.id);
  const toggle=()=>{if(elapsed>=duration)setElapsed(0);setPlaying(value=>!value);};
  return <dialog ref={dialog} className="departure-dialog" aria-labelledby="departure-heading" data-mode={shipment?'flight':'concept'} data-origin={lunar?'moon':'earth'} data-phase={labels[stage].toLowerCase()} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.code==='Space'&&!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!(event.target instanceof Element&&event.target.closest('button,input,a,select,textarea'))){event.preventDefault();toggle();}
  }}>
    <header className="departure-header"><div><p className="campaign-eyebrow">{shipment?<>Flight {shipment.id} / {body.toUpperCase()} ACCESS</>:lunar?'MOON / MASS-DRIVER CONCEPT':'EARTH / HASTOL-INSPIRED CONCEPT'}</p><h2 id="departure-heading">{body} launch</h2></div><button ref={closeButton} onClick={onClose} aria-label="Close departure">×</button></header>
    <div className="departure-manifest">{shipment?<><strong>{SITE[shipment.from].name} <span>→</span> {SITE[shipment.to].name}</strong><span>{n(shipment.cargoT)} t {CARGO[shipment.kind].toLowerCase()}</span><span className="departure-live">{inFlight?'In transit':world.day>=shipment.arrival?'Delivered':'Departure recorded'}</span></>:<><strong>{lunar?'Lunar mass driver & tether':'Earth tether'}</strong><span>Concept demonstration</span></>}</div>
    <div className="departure-stage" tabIndex={0} aria-label={`${labels[stage]}. ${captions[stage]} Space plays or pauses this close-up.`}>
      {Scene?<Scene stage={stage} progress={progress}/>:<div className="departure-visual" data-renderer="diagram"><Diagram stage={stage} progress={progress}/></div>}
      <div className="departure-overlay"><span>{String(stage+1).padStart(2,'0')} / {labels[stage].toUpperCase()}</span><span>{'timeScale' in f&&f.timeScale>0?`TIME ×${n(f.timeScale,0)} · `:''}HARDWARE ENLARGED</span></div>
      <p className="departure-caption">{captions[stage]}</p>
    </div>
    <div className="departure-telemetry" aria-label="Illustrative launch readouts"><span>PAYLOAD ALTITUDE<strong>{n(f.altitude)} km</strong></span><span>INERTIAL SPEED<strong>{n(f.payloadSpeed,lunar?2:1)} km/s</strong></span><span>{lunar?'LAUNCHER':'CARRIER'}<strong>{lunar?stage===0?'Loading':stage===1?'Accelerating':stage===2?'Sled braking':'On the Moon':stage===3||stage===2?'Returning':('powered' in f&&f.powered)?'Powered climb':f.latched?'Separating':'Engine-off coast'}</strong></span></div>
    <div className="departure-controls"><button className="primary" onClick={toggle}>{elapsed>=duration?'Replay close-up':playing?'Pause close-up':'Play close-up'}</button><label><span className="sr-only">Departure progress</span><input aria-label="Departure progress" type="range" min="0" max="1000" step="1" value={Math.round(elapsed/duration*1000)} aria-valuetext={`${labels[stage]}, ${Math.round(elapsed/duration*100)} percent through departure replay`} onChange={event=>{setPlaying(false);setElapsed(Number(event.target.value)/1000*duration);}}/></label><span>{Math.floor(elapsed/1000)} / {duration/1000} s</span></div>
    <nav className="departure-phases" aria-label="Departure moments">{labels.map((label,index)=><button key={label} aria-pressed={stage===index} onClick={()=>{setPlaying(false);setElapsed(offsets[index]+times[index]*stills[index]);}}>{label}</button>)}</nav>
    <details className="departure-explanation"><summary>How the payload reaches space</summary>{lunar?<><p>The mass driver accelerates a sled electromagnetically. At the end of the ramp, the cargo separates and coasts without an engine. The tether meets it at matched position and velocity, grips its fitting, then swings it outward and releases it.</p><p>This illustration uses a {n(LUNAR_RAIL.length)} km ramp, 60 m/s² acceleration and a {n(LUNAR_RAIL.duration)} s launch to about 0.98 km/s. The handoff is 50 km above the Moon at 0.9 km/s. The launcher supplies the first part of the speed; the tether supplies the next.</p><p>Hardware is enlarged and time compressed. Lunar gravity governs the cargo’s free coast; terrain, launcher power, loads, finite-mass tether recoil and targeting {shipment?SITE[shipment.to].name:'another destination'} need separate calculations. <a href="https://ntrs.nasa.gov/api/citations/19890006394/downloads/19890006394.pdf" target="_blank" rel="noreferrer">Read the lunar electromagnetic launcher study ↗</a></p></>:<><p>A hypersonic aircraft supplies the first part of the speed and altitude. It makes a ballistic pop-up to meet the lower grapple; at the handoff, both move together. The tether takes the cargo while the aircraft returns, then swings it outward and releases it with greater speed.</p><p>This HASTOL-inspired example meets at 150 km and 4.5 km/s. The readouts describe this illustration; aircraft performance, capture loads and the transfer to {shipment?SITE[shipment.to].name:'another destination'} need separate calculations. Hardware is enlarged and time compressed. <a href="https://www.niac.usra.edu/files/studies/final_report/391Grant.pdf" target="_blank" rel="noreferrer">Read the HASTOL study ↗</a></p></>}</details>
    <div className="departure-footer"><p>{shipment?`${body} launch concept alongside your cargo manifest. The sequence has its own clock.`:`${body} launch concept. This demonstration has its own clock and sends no cargo.`}<br/><span>{networkPlaying?'Simulation running':'Simulation paused'} · Day {n(world.day)}{shipment&&<> · Arrives Day {n(shipment.arrival)}</>}</span></p><button onClick={onClose}>Back to network</button></div>
  </dialog>;
}
