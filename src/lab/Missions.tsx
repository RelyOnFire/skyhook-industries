import { useEffect, useRef, type ReactNode } from 'react';
import { CHALLENGES, challengeGates, deliveries, diagnose, type Challenge } from '../simulation/insights.js';
import { environment, type Result } from '../simulation/engine.js';

export function Modal({ title, onClose, children, wide=false }: { title:string;onClose:()=>void;children:ReactNode;wide?:boolean }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className={`lab-modal ${wide?'modal-wide':''}`} aria-label={title}
    onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();if(e.target===e.currentTarget&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))onClose();}}>
    <div className="modal-heading"><span className="micro">TETHER LAB / FLIGHT STUDIO</span><button onClick={onClose} aria-label={`Close ${title}`}>×</button></div>
    <h2>{title}</h2>{children}
  </dialog>;
}
export function MissionSelect({ onSelect,onClose,completed,choices=CHALLENGES }: {choices?:Challenge[];onSelect:(c:Challenge)=>void;onClose:()=>void;completed:string[]}) {
  return <Modal title="Learn by flying." onClose={onClose} wide>
    <p className="modal-intro">{choices.length===1?'A lunar flight challenge.':'Three Earth missions.'} The same physics as the sandbox. Measured outcomes, finite resources.</p>
    <div className="mission-choices">{choices.map(c=><button key={c.id} onClick={()=>onSelect(c)} className="mission-choice">
      <span className="mission-index">{c.number}<small>{completed.includes(c.id)?'COMPLETED LOCALLY':'FLIGHT CHALLENGE'}</small></span>
      <strong>{c.title}</strong><p>{c.question}</p>
      <div className="mission-spec"><span>{c.payload} t × 2 deliveries</span><span>≤ {c.maxFuelT} t propellant</span></div>
      <span className="choice-cta">Open mission briefing <b aria-hidden="true">↗</b></span>
    </button>)}</div>
    <p className="modal-footnote">An educational mission pass is not flight qualification. You can leave a challenge and explore freely at any time.</p>
  </Modal>;
}
export function MissionBrief({ challenge:c, onStart,onClose }: {challenge:Challenge;onStart:()=>void;onClose:()=>void}) {
  const recoveryLesson=c.id==='second-delivery'||c.id==='lunar-relay';
  return <Modal title={c.title} onClose={onClose}>
    <p className="brief-number">MISSION {c.number}</p><p className="modal-intro">{c.brief}</p>
    {recoveryLesson&&<><ol className="brief-path" aria-label="Your flight plan"><li><b>Watch the first handoff</b><span>Step through the calculated flight. See what the payload takes from the tether.</span></li><li><b>Restore orbit and spin</b><span>Choose Chemical recovery, then run the changed design.</span></li><li><b>Verify two {c.payload} t deliveries</b><span>Check both delivered orbits and the propellant bill.</span></li></ol>
    <button className="primary launch-mission" onClick={onStart}>Start this mission <span aria-hidden="true">→</span></button>
    <p className="modal-footnote">Starting loads this mission’s example into the workspace. Your saved design stays unchanged.</p></>}
    <dl className="brief-rules"><div><dt>Your goal</dt><dd>Two {c.payload} t payloads above {c.minApogeeKm.toLocaleString('en-US')} km apogee</dd></div><div><dt>Propellant budget</dt><dd>Load no more than {c.maxFuelT} t</dd></div></dl>
    <details className="brief-constraints"><summary>Mission rules and fixed design</summary><dl className="brief-rules"><div><dt>Perigee</dt><dd>Above {environment(c.start).cutoff/1000} km</dd></div><div><dt>Dry facility</dt><dd>No more than {c.maxDryT} t</dd></div><div><dt>Keep fixed</dt><dd>{c.start.spanKm.toLocaleString('en-US')} km span · {c.start.altitudeKm.toLocaleString('en-US')} km initial altitude · {c.start.tipSpeedKms} km/s spin-tip speed · safety factor {c.start.safetyFactor}</dd></div></dl>
    <p className="modal-footnote">{c.id==='lunar-relay'?'This challenge permits recovery settings only. The supplied lunar geometry, Zylon HM fiber assumption and payload stay fixed. Explore other dimensions outside the challenge.':'Material choices for these challenges: Kevlar 49 or Zylon HM with the stated fiber assumptions. Challenge 01 only permits recovery settings; later missions also allow section/profile changes, and 03 allows release timing. All other design settings stay at the supplied baseline.'}</p></details>
    <p className="brief-hint">{c.lesson}</p>
    {!recoveryLesson&&<><p className="modal-footnote">Starting loads this mission’s example into the workspace. Your saved design stays unchanged.</p>
    <button className="primary launch-mission" onClick={onStart}>Start this mission <span aria-hidden="true">→</span></button></>}
  </Modal>;
}
export function MissionProgress({challenge:c,result,dirty,busy,invalid,error,designUrl,nextChallenge,onBrief,onExit,onReview,onReplay,onEdit,onRun,onNext}:{challenge:Challenge;result:Result|null;dirty:boolean;busy:boolean;invalid:boolean;error:string;designUrl:string|null;nextChallenge:Challenge|null;onBrief:()=>void;onExit:()=>void;onReview:()=>void;onReplay:()=>void;onEdit:()=>void;onRun:()=>void;onNext:()=>void}) {
  const gates=result?challengeGates(c,result):[], passed=!busy&&!dirty&&!invalid&&!error&&!!gates.length&&gates.every(g=>g.pass);
  const good=result?deliveries(result):[], diagnosis=result?diagnose(result):null;
  const recoveryLesson=(c.id==='second-delivery'||c.id==='lunar-relay')&&result?.design.recovery==='none';
  const heading=busy?'Calculating your flight':error?'Your calculation needs attention':invalid?'Check the highlighted input':dirty?'Your change is ready to test':passed?'Two deliveries. A repeatable flight.':recoveryLesson&&good.length===1?'One delivery. Now make it repeat.':diagnosis?.title??'Your first calculation is on its way';
  const explanation=busy?'Gravity, capture, release and recovery use the same solver as the sandbox.':error?error:invalid?'The scene still shows the last calculation. Correct the input before running again.':dirty?'Run again to see whether the change meets every mission objective.':passed?`${good.length} of 2 deliveries · ${(result!.fuelUsed/1000).toFixed(2)} t propellant spent. Both orbits and every challenge limit passed.`:recoveryLesson&&good.length===1?'The payload gains energy; the facility needs its orbit and spin restored before the next handoff. Open Recovery and choose Chemical.':diagnosis?.action??'The replay will begin paused so you can explore each handoff.';
  return <section className={`mission-banner ${passed?'mission-passed':''}`} aria-label="Active challenge">
    <div className="mission-banner-heading"><div className="mission-banner-id">{c.number}</div><div className="mission-banner-copy"><span className="micro">{dirty||invalid||error?'CHALLENGE / UNRUN DESIGN':passed?'CHALLENGE / LAST CALCULATION PASSES':'YOUR MISSION'}</span><h2>{c.title}</h2><p>{c.payload} t × 2 · apogee ≥ {c.minApogeeKm.toLocaleString('en-US')} km · ≤ {c.maxFuelT} t propellant</p></div>
      <div className="mission-banner-actions"><button onClick={onBrief}>Briefing</button><button onClick={onReview} disabled={!result||busy}>Check objectives</button><button onClick={onExit} aria-label="Leave challenge for sandbox">×</button></div></div>
    <div className="mission-next"><div className="mission-result" aria-live="polite"><span className="micro">{passed?'CALCULATED RESULT':'NEXT STEP'}</span><h3>{heading}</h3><p>{explanation}</p></div><div className="mission-next-actions">
      {dirty||invalid||error?<button className="primary" disabled={busy||invalid} onClick={onRun}>Run changed design →</button>:passed?<><button className="primary" onClick={onReview}>Review successful flight →</button>{designUrl&&<a href={designUrl}>Compare this design in Expeditions →</a>}{nextChallenge&&<button onClick={onNext}>Next mission: {nextChallenge.title} →</button>}</>:<><button className="primary" disabled={!result||busy} onClick={onEdit}>Open {recoveryLesson?'recovery':diagnosis?.tab??'recovery'} controls →</button><button disabled={!result||busy} onClick={onReplay}>Watch key moments</button></>}
    </div></div>
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
export function GuidedReplay({ result,index,onStep,onClose,onFinish,finishLabel }: {result:Result;index:number;onStep:(i:number)=>void;onClose:()=>void;onFinish?:()=>void;finishLabel?:string}) {
  const points=checkpoints(result),e=points[Math.min(index,points.length-1)],last=index>=points.length-1,diagnosis=diagnose(result);const note=last?{heading:diagnosis.title,text:diagnosis.explanation}:e.kind==='start'&&environment(result.design).id==='moon'?{heading:'A rotating facility above the Moon.',text:'Lunar gravity drives this flight. An independent payload approaches the moving tip, then leaves on its own calculated lunar trajectory. This is the orbital-transfer part of a lunavator concept; surface pickup and Earth–Moon targeting are not modeled.'}:NOTES[e.kind]??{heading:e.title,text:e.detail};
  return <section className="guided-replay" aria-label="Guided replay"><div className="guided-number">{String(index+1).padStart(2,'0')}<small>/ {points.length}</small></div><div><span className="micro">GUIDED REPLAY / PAUSED CHECKPOINT</span><h3>{note.heading}</h3><p>{note.text}</p><div className="guided-buttons"><button onClick={()=>onStep(index-1)} disabled={index===0}>Back</button>{!last?<button className="primary" onClick={()=>onStep(index+1)}>Next checkpoint →</button>:<button className="primary" onClick={onFinish??onClose}>{finishLabel??'Explore this design →'}</button>}<button onClick={onClose}>End guide</button></div></div></section>;
}
