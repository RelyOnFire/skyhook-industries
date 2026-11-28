import {useEffect,useRef,useState, type CSSProperties,type PointerEvent} from 'react';
import {START, END, PREVIEW_TIME, LIMIT, passes, neutral, bound, moveCarriage, encounter, insertionOutcome, latchPose,lockDuration,separationAcceleration, type Outcome,type Pass} from './pass.js';
import {PIN,innerRadius} from '../../visuals/capture-fitting.js';
import FittingMonitor from './FittingMonitor.js';
import type {Exposure,CameraName} from './flight-camera.js';
import {rideFrame,RIDE_END,RIDE_SWING} from './ride.js';
import './flight-deck.css';

type Phase='ready'|'running'|'paused'|'inserting'|'finished';
type Attempt={phase:Phase; time:number; carriage:ReturnType<typeof neutral>; goal:{x:number;z:number}; strokeTime:number; outcome:Outcome|null};
const fresh=():Attempt=>({phase:'ready',strokeTime:0,time:PREVIEW_TIME,carriage:neutral(),goal:{x:0,z:0},outcome:null});
const cameras:CameraName[]=['Tracking','Payload','Grapple'];
const reports:Record<Outcome,[string,string]>={
  secured:['Cargo secured','The pin passed through the eye and entered the far sleeve. The upper inside rim now rests on the pin.'],
  offset:['Pin would strike the rim','The eye missed the pin axis. Use the X readout to bring the white eye over the gold pin in the end view.'],
  fork:['Eye outside the fork','The loop would hit a cheek of the fork. Correct the Z offset on the alignment pad.'],
  speed:['Too fast to latch','The relative speed exceeds the limit during insertion. Settle the carriage and try nearer T zero.'],
  early:['Eye below the pin','The eye was still approaching. Wait until the opening reaches the pin axis.'],
  late:['Window passed','The eye moved away before the pin could traverse it. Try an earlier command.'],
};
const pct=(n:number)=>(50+n/LIMIT.travel*45)+'%';
const pointStyle=(x:number,z:number):CSSProperties=>({left:pct(x),top:pct(z)});
function advance(a:Attempt,dt:number):Attempt{
  const time=Math.min(END,a.time+dt),carriage=moveCarriage(a.carriage,a.goal,time-a.time);
  if(time>=END)return {...a,time,carriage,phase:'finished',outcome:'late'};
  return {...a,time,carriage};
}

export default function CaptureFlight(){
  const [pass,setPass]=useState<Pass>('offset'),[camera,setCamera]=useState<CameraName>('Tracking'),[rate,setRate]=useState(.2);
  const [attempt,present]=useState<Attempt>(fresh),a=useRef(attempt);
  const [rendering,setRendering]=useState<'loading'|'3d'|'guidance'>('loading');
  const [ride,setRide]=useState<{clock:number;playing:boolean}|null>(null);
  const [view,setView]=useState({yaw:0,pitch:0});
  const drag=useRef<{x:number;y:number;yaw:number;pitch:number}|null>(null);
  const host=useRef<HTMLDivElement>(null),pad=useRef<HTMLDivElement>(null);
  const draw=useRef<()=>void>(()=>{});
  const sync=(next:Attempt)=>{a.current=next;present(next);};
  const phase=attempt.phase,result=attempt.outcome,c=attempt.carriage;
  const f=encounter(pass,attempt.time,c);
  const contact=phase==='inserting'||result==='secured'?latchPose(pass,attempt.time,c,attempt.strokeTime):null;
  const lift=ride?rideFrame(ride.clock,contact?c:neutral(),contact?.cargo):null;
  const state:Exposure={time:lift?.time??attempt.time+attempt.strokeTime,carriage:lift&&!contact?neutral():c,
    cargo:lift?.data.cargo??contact?.cargo??f.cargo,stroke:lift?.stroke??contact?.stroke??0,camera,yaw:view.yaw,pitch:view.pitch};
  const shot=useRef(state);shot.current=state;
  const close=()=>{const current=a.current;if(current.phase!=='running'&&current.phase!=='paused')return;
    const outcome=insertionOutcome(encounter(pass,current.time,current.carriage));
    sync(outcome==='secured'?{...current,phase:'inserting',strokeTime:0}:{...current,phase:'finished',outcome});};
  const inspect=()=>{
    const passTime=-PIN.strokeSeconds/2,p=passes[pass];
    const goal={x:p.x+p.vx*passTime,z:p.z+p.vz*passTime};
    setCamera('Grapple');sync({...fresh(),phase:'paused',time:passTime,goal,carriage:{...goal,vx:0,vz:0}});
  };
  const start=()=>{
    const next=fresh();next.phase='running';next.time=START;
    if(a.current.phase==='ready'){next.carriage=a.current.carriage;next.goal=a.current.goal;}
    sync(next);pad.current?.focus({preventScroll:true});
  };
  const command=(x:number,z:number)=>{
    const current=a.current;if(current.phase==='finished'||current.phase==='inserting')return;
    const goal={x:bound(x),z:bound(z)};
    sync({...current,goal,...(current.phase==='ready'?{carriage:{...goal,vx:0,vz:0}}:{})});
  };
  function point(e:PointerEvent<HTMLDivElement>){
    const r=e.currentTarget.getBoundingClientRect();
    command(((e.clientX-r.left)/r.width-.5)*LIMIT.travel/.45,((e.clientY-r.top)/r.height-.5)*LIMIT.travel/.45);
  }
  useEffect(()=>{
    let alive=true,dispose:(()=>void)|undefined;
    import('./flight-camera.js').then(({openFlightCamera})=>{
      if(!alive)return;
      const scene=openFlightCamera(host.current!,()=>shot.current,()=>setRendering('guidance'));
      dispose=scene.dispose;draw.current=scene.draw;setRendering('3d');
    }).catch(()=>{if(alive)setRendering('guidance');});
    return ()=>{alive=false;draw.current=()=>{};dispose?.();};
  },[]);
  useEffect(()=>{draw.current();},[attempt,camera,view,pass,ride]);
  useEffect(()=>{
    if(phase!=='running')return;
    let id=0,last=performance.now(),carry=0;
    const tick=(now:number)=>{
      if(a.current.phase!=='running')return;
      carry+=Math.min(.5,(now-last)/1000)*rate;last=now;
      let next=a.current;
      while(carry>=1/120&&next.phase==='running'){next=advance(next,1/120);carry-=1/120;}
      if(next!==a.current)sync(next);
      if(next.phase==='running')id=requestAnimationFrame(tick);
    };
    const pause=()=>{if(document.hidden&&a.current.phase==='running')sync({...a.current,phase:'paused'});};
    document.addEventListener('visibilitychange',pause);id=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(id);document.removeEventListener('visibilitychange',pause);};
  },[phase,rate,pass]);
  useEffect(()=>{
    if(phase!=='inserting')return;
    let id=0,last=performance.now();
    const resetClock=()=>{last=performance.now();};
    document.addEventListener('visibilitychange',resetClock);
    const tick=(now:number)=>{
      const current=a.current;if(current.phase!=='inserting')return;
      const dt=document.hidden?0:Math.max(0,(now-last)/1000)*.2;last=now;
      const strokeTime=Math.min(lockDuration,current.strokeTime+dt);
      sync(strokeTime>=lockDuration?{...current,strokeTime,phase:'finished',outcome:'secured'}:{...current,strokeTime});
      if(strokeTime<lockDuration)id=requestAnimationFrame(tick);
    };
    id=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(id);document.removeEventListener('visibilitychange',resetClock);};
  },[phase]);
  useEffect(()=>{
    if(!ride?.playing)return;
    let id=0,previous=performance.now();
    const tick=(now:number)=>{
      const delta=Math.min(.5,(now-previous)/1000);previous=now;
      setRide(r=>{if(!r?.playing)return r;const clock=Math.min(RIDE_END,r.clock+delta);return {clock,playing:clock<RIDE_END};});
      id=requestAnimationFrame(tick);
    };
    const hidden=()=>{if(document.hidden)setRide(r=>r&&{...r,playing:false});};
    document.addEventListener('visibilitychange',hidden);id=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(id);document.removeEventListener('visibilitychange',hidden);};
  },[ride?.playing]);
  const beginRide=()=>setRide({clock:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches});
  const toggle=()=>{if(a.current.phase==='running'||a.current.phase==='paused')sync({...a.current,phase:a.current.phase==='running'?'paused':'running'});};
  const inPass=phase==='running'||phase==='paused';
  const latchMode=result==='secured'?'Pin seated':phase==='inserting'?(state.stroke<1?'Inserting pin':'Taking up clearance'):result?'Pin held open':'Pin retracted';
  const guidance=insertionOutcome(f);
  return <main className="capture-flight" id="lab-content">
    <header className="flight-title"><div><a href="/lab/campaign/">← Expeditions</a><h1>Capture station</h1></div><p>Catch a ballistic cargo pod with the moving tip of an Earth skyhook.</p></header>
    <div className="flight-console">
      <section className="flight-channel" aria-label="Flight cameras and telemetry">
        <div className="flight-toolbar"><span>Flight cameras</span><div role="group" aria-label="Flight camera">{cameras.map(name=><button key={name} aria-pressed={camera===name} disabled={rendering==='guidance'} onClick={()=>{setCamera(name);setView({yaw:0,pitch:0});}}>{name}</button>)}</div></div>
        <div className={'flight-screen camera-'+camera.toLowerCase()} data-renderer={rendering}
          onPointerDown={e=>{if(camera!=='Tracking'||rendering!=='3d')return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,...view};}}
          onPointerMove={e=>{const d=drag.current;if(!d||!e.currentTarget.hasPointerCapture(e.pointerId))return;setView({yaw:d.yaw-(e.clientX-d.x)*.008,pitch:Math.max(-.72,Math.min(.83,d.pitch+(e.clientY-d.y)*.006))});}}
          onLostPointerCapture={()=>{drag.current=null;}}>
          <div ref={host} className="flight-canvas" aria-hidden="true" hidden={rendering==='guidance'}/>
          {rendering!=='3d'&&<div className="flight-backup"><div className="backup-tip"/><div className="backup-pod" style={{top:Math.min(85,43-state.cargo.y*.9)+'%',left:(50+(state.cargo.x-state.carriage.x)*5)+'%'}}/><span>{rendering==='loading'?'Opening flight camera…':'Instrument view · side elevation'}</span></div>}
          <div className="flight-overlay"><span><i/>{rendering==='guidance'?'GUIDANCE':camera.toUpperCase()+' CAM'}</span><span>{lift?(lift.released?'FREE COAST':'TETHER SWING'):phase==='ready'?'CONTACT PREVIEW':phase==='running'?'LIVE PASS':phase==='paused'?'PAUSED':phase==='inserting'?'LATCH CYCLE':'CONTACT FRAME'}</span></div>
          <div className="flight-time"><small>{lift?'SINCE CAPTURE':'RENDEZVOUS'}</small><strong>T {state.time<0?'−':'+'}{lift?Math.abs(state.time).toFixed(0):Math.abs(state.time).toFixed(2)} <em>s</em></strong></div>
          {camera==='Tracking'&&rendering==='3d'&&<span className="flight-orbit-hint">Drag to orbit</span>}
        </div>
        {lift?<dl className="flight-instruments"><div><dt>Altitude</dt><dd>{lift.altitude.toFixed(0)} <small>km</small></dd></div><div><dt>Inertial speed</dt><dd>{lift.inertialSpeed.toFixed(2)} <small>km/s</small></dd></div><div><dt>Grapple</dt><dd className="flight-latch-state">{lift.released?'Released':lift.stroke<1?'Withdrawing':'Latched'}</dd></div></dl>:<FittingMonitor eye={state.cargo} head={c} stroke={state.stroke} mode={latchMode} telemetry={f} held={!!contact||!!result}/>}
      </section>
      <section className="grapple-console" aria-label="Grapple controls">
        {ride&&lift?<div className="ride-panel"><small>EARTH DEPARTURE</small><h2>Ride the tether</h2>
          <p>{lift.released?'The pin has cleared the eye. The pod keeps its release velocity and coasts under gravity.':'The cargo is latched. Watch the horizon turn as the tether lifts the pod and transfers momentum.'}</p>
          <label>Swing and release<input type="range" aria-label="Swing and release progress" min="0" max={RIDE_END} step=".01" value={ride.clock} onChange={e=>setRide({clock:Number(e.target.value),playing:false})}/></label>
          <div className="ride-stops"><button onClick={()=>setRide({clock:0,playing:false})}>Capture</button><button onClick={()=>setRide({clock:RIDE_SWING,playing:false})}>Release</button></div>
          <p className="ride-rate">{lift.stroke<1&&lift.stroke>0?'Slow motion · pin withdrawal':lift.released?'½ speed on free coast':Math.round(lift.swingRate)+'× swing playback'}</p>
          <button className="capture-primary" onClick={()=>setRide({clock:ride.clock>=RIDE_END?0:ride.clock,playing:!ride.playing})}>{ride.clock>=RIDE_END?'Replay ride':ride.playing?'Pause ride':'Play ride'}</button>
          <button className="flight-secondary" onClick={()=>setRide(null)}>Back to grapple controls</button></div>:<>
        <label className="flight-select">Training pass<select value={pass} disabled={inPass||phase==='inserting'} onChange={e=>{setPass(e.target.value as Pass);sync(fresh());}}>{Object.entries(passes).map(([id,p])=><option key={id} value={id}>{p.name}</option>)}</select></label>
        <div className="scope-heading"><h2>Grapple alignment</h2><small>+X → · +Z ↓ · ±2 m</small></div>
        <div className="scope-wrap"><div ref={pad} className="flight-scope" role="group" tabIndex={0} aria-label="Aim grapple. Tap or drag, or use arrow keys to move in steps of ten centimetres. Press Space to insert the pin."
          onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus({preventScroll:true});point(e);}}
          onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))point(e);}}
          onKeyDown={e=>{
            const d:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};
            if(d[e.key]){e.preventDefault();const [x,z]=d[e.key];command(a.current.goal.x+x,a.current.goal.z+z);}
            if(e.code==='Space'){e.preventDefault();if(!e.repeat)close();}
          }}>
          <span className="scope-center"/><span className="scope-head" style={pointStyle(c.x,c.z)}/><span className="scope-cargo" style={pointStyle(state.cargo.x,state.cargo.z)}/><span className="scope-command" style={pointStyle(attempt.goal.x,attempt.goal.z)}/>
        </div></div>
        <div className="scope-key"><span>◇ Eye</span><span>+ Carriage</span></div>
        <p className="flight-instruction">Tap the diamond or use the arrow keys to put the carriage cross on the eye. Insert the pin when both clearances are positive and the stroke speed is within limit.</p>
        <div className={'capture-light'+(f.within?' within':'')} role="status">{phase==='inserting'?latchMode:result?reports[result][0]:phase==='ready'?'Ready for approach':f.within?'Capture window open':guidance==='fork'?'Correct Z · eye outside fork':guidance==='offset'?'Correct X · pin outside eye':guidance==='speed'?'Wait for speed match':guidance==='late'?'Eye moving away':'Eye approaching'}</div>
        <button className="capture-primary" disabled={phase==='inserting'||rendering==='loading'} onClick={inPass?close:start}>{phase==='inserting'?latchMode:inPass?'Insert pin':phase==='finished'?'Fly again':'Begin approach'} <span aria-hidden="true">{inPass?'⌖':'→'}</span></button>
        {inPass&&<div className="clock-tools"><button onClick={toggle}>{phase==='running'?'Pause':'Resume'}</button>{phase==='paused'&&<button onClick={()=>sync(advance(a.current,.05))}>Step 0.05 s</button>}<button onClick={()=>sync(fresh())}>Reset</button></div>}
        <label className="flight-rate">Playback speed<select value={rate} onChange={e=>setRate(Number(e.target.value))}><option value={.2}>⅕ speed</option><option value={1}>Real time</option></select></label>
        {(phase==='ready'||phase==='finished')&&<button className="flight-secondary inspect-lock" disabled={rendering==='loading'} onClick={inspect}>Practice with the eye aligned</button>}
        {phase==='ready'&&<button className="flight-secondary" onClick={beginRide}>Preview the tether ride ↗</button>}
        {result==='secured'&&<button className="flight-secondary" onClick={beginRide}>Ride your captured pod ↗</button>}</>}
      </section>
    </div>
    {result&&!ride&&<section className={'flight-report '+(result==='secured'?'success':'')} aria-label="Pass debrief" role="status"><div><small>PASS DEBRIEF</small><h2>{reports[result][0]}</h2><p>{reports[result][1]}</p></div><a href={'/lab/capture/?axis=along&speedMs='+Math.abs(separationAcceleration*attempt.time).toFixed(3)}>Study the axial stopping load ↗</a></section>}
    <details className="flight-method"><summary>Flight model and capture limits</summary><p>The nominal handoff is 150 km above Earth at 4.5 km/s. The camera places it over the Bahamas using mapped Earth imagery. In the last three seconds we approximate the separation between a freely falling payload and a rigid rotating tip with their relative acceleration at pickup ({separationAcceleration.toFixed(2)} m/s²). The drift pass adds a constant lateral velocity. The two-axis carriage slews at up to {LIMIT.slew} m/s.</p><p>The eye has a {Math.round(200*innerRadius)} cm clear opening. The {Math.round(200*PIN.radius*10)/10} cm pin takes {PIN.strokeSeconds} s to reach the receiver. At command the carriage holds position. The interlock checks the whole stroke against the eye and both fork cheeks, allowing {PIN.guard*1000} mm spare clearance and at most {LIMIT.speed} m/s relative speed. The screen holds the command-time measurements during closure. The seating motion illustrates clearance take-up. Eye attitude is fixed in these passes. These dimensions, timings and tolerances are concept assumptions. The ride follows the Earth launch model’s prescribed circular hub orbit and rigid spin. Released cargo coasts under central gravity. Structural flexibility, recoil, latch dynamics and sensor noise require separate models. <a href="/lab/capture/">Explore the stopping-work calculation</a> or <a href="/research/library/#hastol-phase-ii">read the HASTOL study</a>.</p></details>
  </main>;
}
