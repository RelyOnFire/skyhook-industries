import { useEffect, useRef, type ReactNode } from 'react';
import { CHALLENGES, challengeGates, type Challenge } from '../simulation/insights.js';
import type { Result } from '../simulation/engine.js';

export function Modal({ title, onClose, children, wide=false }: { title:string;onClose:()=>void;children:ReactNode;wide?:boolean }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className={`lab-modal ${wide?'modal-wide':''}`} aria-label={title}
    onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();if(e.target===e.currentTarget&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))onClose();}}>
    <div className="modal-heading"><span className="micro">TETHER LAB / FLIGHT STUDIO</span><button onClick={onClose} aria-label={`Close ${title}`}>×</button></div>
    <h2>{title}</h2>{children}
  </dialog>;
}
export function MissionSelect({ onSelect,onClose,completed }: {onSelect:(c:Challenge)=>void;onClose:()=>void;completed:string[]}) {
  return <Modal title="Learn by flying." onClose={onClose} wide>
    <p className="modal-intro">Three missions. The same physics as the sandbox. No upgrades, magic fuel, or hidden score.</p>
    <div className="mission-choices">{CHALLENGES.map(c=><button key={c.id} onClick={()=>onSelect(c)} className="mission-choice">
      <span className="mission-index">{c.number}<small>{completed.includes(c.id)?'COMPLETED LOCALLY':'FLIGHT CHALLENGE'}</small></span>
      <strong>{c.title}</strong><p>{c.question}</p>
      <div className="mission-spec"><span>{c.payload} t × 2 deliveries</span><span>≤ {c.maxFuelT} t propellant</span></div>
      <span className="choice-cta">Open mission briefing <b aria-hidden="true">↗</b></span>
    </button>)}</div>
    <p className="modal-footnote">An educational mission pass is not flight qualification. You can leave a challenge and explore freely at any time.</p>
  </Modal>;
}
export function MissionBrief({ challenge:c, onStart,onClose }: {challenge:Challenge;onStart:()=>void;onClose:()=>void}) {
  return <Modal title={c.title} onClose={onClose}>
    <p className="brief-number">MISSION {c.number}</p><p className="modal-intro">{c.brief}</p>
    <dl className="brief-rules"><div><dt>Deliver</dt><dd>Two {c.payload} t payloads</dd></div><div><dt>Reach</dt><dd>At least {c.minApogeeKm.toLocaleString('en-US')} km apogee; perigee above 120 km</dd></div><div><dt>Keep dry mass below</dt><dd>{c.maxDryT} t</dd></div><div><dt>Load no more than</dt><dd>{c.maxFuelT} t of propellant</dd></div><div><dt>Keep fixed</dt><dd>600 km span · 1,600 km initial altitude · 1.2 km/s spin-tip speed · safety factor 2</dd></div></dl>
    <p className="brief-hint">{c.lesson}</p>
    <p className="modal-footnote">Material choices for these challenges: Kevlar 49 or Zylon HM with the stated fiber assumptions. Challenge 01 only permits recovery settings; later missions also allow section/profile changes, and 03 allows release timing. All other design settings stay at the supplied baseline.</p>
    <button className="primary launch-mission" onClick={onStart}>Start this mission <span aria-hidden="true">→</span></button>
  </Modal>;
}
export function MissionProgress({challenge:c,result,dirty,onBrief,onExit,onReview}:{challenge:Challenge;result:Result|null;dirty:boolean;onBrief:()=>void;onExit:()=>void;onReview:()=>void}) {
  const gates=result?challengeGates(c,result):[], passed=!!gates.length&&gates.every(g=>g.pass);
  return <section className={`mission-banner ${passed&&!dirty?'mission-passed':''}`} aria-label="Active challenge">
    <div className="mission-banner-id">{c.number}</div><div className="mission-banner-copy"><span className="micro">{dirty?'CHALLENGE / UNRUN DESIGN':passed?'CHALLENGE / LAST CALCULATION PASSES':'YOUR MISSION'}</span><h2>{c.title}</h2><p>{c.payload} t × 2 · apogee ≥ {c.minApogeeKm.toLocaleString('en-US')} km · ≤ {c.maxFuelT} t propellant</p></div>
    <div className="mission-banner-actions"><button onClick={onBrief}>Briefing</button><button onClick={onReview} disabled={!result}>Check objectives</button><button onClick={onExit} aria-label="Leave challenge for sandbox">×</button></div>
  </section>;
}
const NOTES:Record<string,{heading:string;text:string}>={
  start:{heading:'Two motions. One rendezvous.',text:'The facility moves around Earth while its tether rotates. The supplied payload trajectory matches the working tip at capture. This example does not calculate the launch from Earth.'},
  capture:{heading:'The payload joins the rotating machine.',text:'Capture changes the combined center of mass. Existing tether points stay continuous: the tip does not teleport, and the payload is not given free velocity.'},
  release:{heading:'The payload leaves; the facility pays.',text:'Payload 1 keeps its orange marker and follows its own released trajectory. Its new orbit is reported in the recorder. The facility keeps the state left by the exchange, rather than resetting.'},
  ready:{heading:'The facility is ready, not the payload recovered.',text:'The facility’s orbit and spin have stayed inside tolerance for 60 seconds. Payload 1 remains independent. A coast forecast checks the next pass before constructing Payload 2’s approach.'},
  approach:{heading:'A new shipment, not the old payload returning.',text:'Payload 2 has a violet diamond and its own calculated approach. The engine checks its position and velocity at the working tip before attaching it. Payload 1 keeps its orange marker elsewhere in orbit.'},
  end:{heading:'Now change one thing.',text:'Use the debrief to find the limiting condition. Pin the run or sweep a design parameter. A better number is only useful when the deliveries and the modeled limits still pass.'},
};
export function checkpoints(r:Result) {
  const selected=[r.events[0],r.events.find(e=>e.kind==='capture'),r.events.find(e=>e.kind==='release'),r.events.find(e=>e.kind==='ready'),r.events.find(e=>e.kind==='approach'),r.events.find(e=>e.kind==='capture'&&e.payloadId===2),r.events.at(-1)].filter((e):e is NonNullable<typeof e>=>!!e);
  return selected.filter((e,i)=>selected.findIndex(x=>x.t===e.t)===i);
}
export function GuidedReplay({ result,index,onStep,onClose }: {result:Result;index:number;onStep:(i:number)=>void;onClose:()=>void}) {
  const points=checkpoints(result),e=points[Math.min(index,points.length-1)];const note=NOTES[e.kind]??{heading:e.title,text:e.detail};
  return <section className="guided-replay" aria-label="Guided replay"><div className="guided-number">{String(index+1).padStart(2,'0')}<small>/ {points.length}</small></div><div><span className="micro">GUIDED REPLAY / PAUSED CHECKPOINT</span><h3>{note.heading}</h3><p>{note.text}</p><div className="guided-buttons"><button onClick={()=>onStep(index-1)} disabled={index===0}>Back</button>{index<points.length-1?<button className="primary" onClick={()=>onStep(index+1)}>Next checkpoint →</button>:<button className="primary" onClick={onClose}>Explore this design →</button>}<button onClick={onClose}>End guide</button></div></div></section>;
}
