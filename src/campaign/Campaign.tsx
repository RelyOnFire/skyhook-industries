import { useEffect, useRef, useState } from 'react';
import { advance, build, buildCost, createCampaign, dispatch, exportCampaign, flightPlan, importCampaign, LIMITS, nextEventDay, objectives, resupply, SITE, SITES, type Campaign as World, type Shipment, type SiteId } from './model.js';
import { deleteSave, listSaves, loadSave, saveCampaign, type SaveSummary } from './storage.js';
import NetworkMap, { FacilityDrawing } from './NetworkMap.js';
import './campaign.css';

const number = (n:number) => n.toLocaleString('en-US',{maximumFractionDigits:1});
const day = (n:number) => `Day ${number(n)}`;

export default function Campaign() {
  const [world,setWorld]=useState<World|null>(null), [slots,setSlots]=useState<SaveSummary[]>([]);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), lock=useRef(false);
  const [error,setError]=useState(''), [notice,setNotice]=useState(''), [saveStatus,setSaveStatus]=useState('');
  const [selected,setSelected]=useState<SiteId>('moon'), [from,setFrom]=useState<SiteId>('earth'), [to,setTo]=useState<SiteId>('moon');
  const [cargo,setCargo]=useState('10'), [mode,setMode]=useState<Shipment['mode']>('tug'), [name,setName]=useState('First light');
  const revision=useRef<number|null>(null), upload=useRef<HTMLInputElement>(null), main=useRef<HTMLElement>(null);
  const refresh=async()=>setSlots(await listSaves());
  useEffect(()=>{ let alive=true; listSaves().then(s=>{if(alive)setSlots(s);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;}; },[]);
  const task=async(fn:()=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    try{await fn();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  };
  const persist=async(next:World)=>{
    setSaveStatus('Saving…');
    try{await saveCampaign(next,revision.current);revision.current=next.revision;setSaveStatus('Saved in this browser');await refresh();}
    catch(e){setSaveStatus('Not saved — download a backup');throw e;}
  };
  const act=(fn:(w:World)=>World)=>void task(async()=>{if(!world)return;const next=fn(world);setWorld(next);await persist(next);});
  const start=(candidate?:World)=>void task(async()=>{
    const next=candidate || createCampaign(crypto.randomUUID(),name);revision.current=null;setWorld(next);setSelected('moon');
    setFrom('earth');setTo('moon');setMode('tug');setCargo('10');await persist(next);main.current?.focus();
  });
  const resume=(id:string)=>void task(async()=>{const next=await loadSave(id);setWorld(next);revision.current=next.revision;setSaveStatus('Saved in this browser');main.current?.focus();});
  const recover=(id:string)=>void task(async()=>{const next=await loadSave(id,true);next.id=crypto.randomUUID();next.revision=0;next.name=(next.name+' · recovery').slice(0,48);revision.current=null;setWorld(next);await persist(next);setNotice('Recovered into a new save slot. The original campaign is unchanged.');});
  const download=()=>{
    if(!world)return;
    try{const url=URL.createObjectURL(new Blob([exportCampaign(world)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`skyhook-campaign-${world.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'backup'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Campaign backup downloaded.');}catch(e){setError((e as Error).message);}
  };
  const readFile=(file?:File)=>void task(async()=>{
    try{if(!file)return;if(file.size>LIMITS.fileBytes)throw Error('Campaign file exceeds 512 KB.');
      const next=importCampaign(await file.text(),crypto.randomUUID());revision.current=null;setWorld(next);await persist(next);setNotice('Imported into a new slot. Existing campaigns are unchanged.');
    }finally{if(upload.current)upload.current.value='';}
  });
  const latest=slots.find(s=>s.valid), event=world?nextEventDay(world):null;
  let plan:ReturnType<typeof flightPlan>|undefined;
  if(world){try{plan=flightPlan(world,from,to,Number(cargo),mode);}catch{/* No direct Moon–Phobos corridor. */}}
  const port=world?.ports[selected], cost=world?buildCost(world,selected):0, goals=world?objectives(world):[];
  const chooseFrom=(id:SiteId)=>{setFrom(id);if(id!=='earth')setTo('earth');else if(to==='earth')setTo('moon');};
  return <main ref={main} tabIndex={-1} id="lab-content" className="campaign">
    <header className="campaign-header"><div><p className="campaign-eyebrow">SKYHOOK / EXPEDITIONS</p><h1>{world?world.name:'A foothold. Then a network.'}</h1><p>{world?'Earth, the Moon, and a Phobos-anchored future.':'Build a transport network you can come back to.'}</p></div>
      {world&&<div className="campaign-save"><span role="status">{saveStatus}</span><div><button disabled={busy} onClick={()=>void task(async()=>persist(world))}>Save now</button><button onClick={download}>Download backup</button><a href="#campaign-saves">Your saves</a></div></div>}
    </header>
    {error&&<div className="campaign-message error" role="alert">{error}</div>}{notice&&<div className="campaign-message" role="status">{notice}</div>}
    {!world&&<section className="campaign-welcome" aria-label="Start or continue"><div><p className="campaign-eyebrow">CHAPTER 01 / THE FIRST CORRIDORS</p><h2>Start at Earth.<br/>Build toward Phobos.</h2><p>Supply the Moon. Commission a lunavator. Send construction cargo to Phobos and make the moon itself your central anchor.</p><p>Time advances when you choose. Your network waits for you between visits.</p></div><div className="campaign-start">
      {loading?<p role="status">Checking saved networks…</p>:latest&&<button className="primary" disabled={busy} onClick={()=>resume(latest.id)}>Continue {latest.name} <small>{day(latest.day)}</small></button>}
      <label htmlFor="campaign-name">Name your network</label><input id="campaign-name" maxLength={48} value={name} onChange={e=>setName(e.target.value)} autoComplete="off"/>
      <button className={latest?'':'primary'} disabled={busy||loading} onClick={()=>start()}>Start new network</button><button disabled={busy} onClick={()=>upload.current?.click()}>Import campaign backup</button>
    </div></section>}
    {world&&<section className="campaign-ledger" aria-label="Network status"><div><span>SIMULATION CLOCK</span><strong data-testid="campaign-day">{day(world.day)}</strong><small>Paused between time steps</small></div><div><span>CONSTRUCTION CARGO</span><strong>{number(SITES.reduce((sum,s)=>sum+world.ports[s].materialsT,0))} <em>t in depots</em></strong><small>{number(world.flights.reduce((sum,f)=>sum+f.cargoT,0))} t in transit</small></div><div><span>SUPPORT PROPELLANT</span><strong data-testid="campaign-fuel">{number(world.fuelT)} <em>t</em></strong><small>Network service allocation</small></div><div><span>COMMISSIONED TETHERS</span><strong>{SITES.filter(s=>world.ports[s].level).length} <em>/ 3</em></strong><small>{world.flights.length} active flights</small></div></section>}
    <div className="campaign-workspace"><NetworkMap world={world} selected={selected} onSelect={setSelected}/>
      <section className="campaign-port" aria-label={`${SITE[selected].name} facility`}><div className="campaign-panel-heading"><span className="campaign-eyebrow">{SITE[selected].name.toUpperCase()} / FACILITY</span><span className="campaign-badge">{port?.level?`TIER ${port.level}`:'UNBUILT'}</span></div><h2>{SITE[selected].facility}</h2><p>{SITE[selected].description}</p><FacilityDrawing site={selected}/>
        {world&&port?<><dl className="campaign-specs"><div><dt>Construction cargo</dt><dd data-testid="port-materials">{number(port.materialsT)} t</dd></div><div><dt>Service rating</dt><dd>{port.level?`${10*port.level} t / flight`:'Awaiting commissioning'}</dd></div><div><dt>Recovery</dt><dd>{port.readyDay>world.day?`Ready ${day(port.readyDay)}`:'Ready'}</dd></div></dl>
          <button className="primary" disabled={busy||port.level>=3||port.materialsT<cost} onClick={()=>act(w=>build(w,selected))}>{port.level>=3?'Highest campaign tier':`${port.level?'Upgrade':'Commission'} ${selected==='moon'?'lunavator':selected==='phobos'?'anchor hub':'rotovator'} · ${cost} t`}</button>
          {port.level<3&&<p className="campaign-hint">{port.materialsT<cost?`Deliver ${number(cost-port.materialsT)} t more cargo here to ${port.level?'upgrade':'commission'}.`:`Uses ${cost} t of cargo in this depot. Construction is immediate in this chapter.`}</p>}
        </>:<p className="campaign-hint">Start a network to supply and commission this facility.</p>}
        <a className="campaign-text-link" href={selected==='earth'?'/lab/':selected==='moon'?'/lab/campaign/method/#lunavator':'/lab/campaign/method/#phobos'}>{selected==='earth'?'Explore Earth tether physics':'Explore this architecture'} <span aria-hidden="true">↗</span></a>
      </section>
    </div>
    {world&&<>
      <section className="campaign-clock" aria-label="Advance simulation"><div><strong>Your next move</strong><span>{event!==null?`Next arrival, recovery, or supply: ${day(event)}`:'Book a flight or request supplies.'}</span></div><div><button disabled={busy||world.day+1>LIMITS.days} onClick={()=>act(w=>advance(w,1))}>+1 day</button><button disabled={busy||world.day+30>LIMITS.days} onClick={()=>act(w=>advance(w,30))}>+30 days</button><button className="primary" disabled={busy||event===null} onClick={()=>event!==null&&act(w=>advance(w,Math.max(1e-7,event-w.day)))}>Advance to next event</button></div></section>
      <div className="campaign-operations"><section className="campaign-dispatch" aria-labelledby="dispatch-heading"><p className="campaign-eyebrow">LOGISTICS / BOOK A FLIGHT</p><h2 id="dispatch-heading">Give the next outpost a beginning.</h2>
        <form onSubmit={e=>{e.preventDefault();act(w=>dispatch(w,from,to,Number(cargo),mode));}}>
          <div className="campaign-fields"><label>From<select value={from} onChange={e=>chooseFrom(e.target.value as SiteId)}>{SITES.map(s=><option key={s} value={s}>{SITE[s].name}</option>)}</select></label><label>To<select value={to} onChange={e=>setTo(e.target.value as SiteId)}>{(from==='earth'?(['moon','phobos'] as SiteId[]):(['earth'] as SiteId[])).map(s=><option key={s} value={s}>{SITE[s].name}</option>)}</select></label><label>Construction cargo (t)<input type="number" min="1" max="30" step="1" required value={cargo} onChange={e=>setCargo(e.target.value)}/></label></div>
          <fieldset className="campaign-service"><legend>Transport service</legend><label><input type="radio" name="service" value="tug" checked={mode==='tug'} onChange={()=>setMode('tug')}/><span><b>Bootstrap tug</b><small>10 t capacity · supplies an unbuilt outpost</small></span></label><label><input type="radio" name="service" value="tether" checked={mode==='tether'} onChange={()=>setMode('tether')}/><span><b>Tether corridor</b><small>Requires commissioned tethers at both ends</small></span></label></fieldset>
          {plan&&<div className="campaign-flight-estimate"><div><span>COAST + HANDLING</span><b>{number(plan.duration)} days</b></div><div><span>SUPPORT PROPELLANT</span><b>{Number.isFinite(plan.fuelT)?number(plan.fuelT):'—'} t</b></div><div><span>ARRIVAL</span><b>{day(world.day+plan.duration)}</b></div></div>}
          <p id="flight-reason" className="campaign-hint">{plan?.reason||'Cargo is deducted at departure and delivered once the flight arrives.'}</p><button className="primary" type="submit" disabled={busy||!!plan?.reason||!plan} aria-describedby="flight-reason">Dispatch cargo</button>
        </form><p className="campaign-hint model-boundary">Ideal transfer-time estimates. Capture, fuel allocations and recovery are scenario rules. <a href="/lab/campaign/method/">Read the model.</a></p>
      </section><section className="campaign-progress" aria-labelledby="progress-heading"><p className="campaign-eyebrow">CHAPTER 01 / OBJECTIVES</p><h2 id="progress-heading">An enduring foothold.</h2><ol>{goals.map((g,i)=><li key={g.name} className={g.done?'complete':''}><span aria-hidden="true">{g.done?'✓':String(i+1).padStart(2,'0')}</span><div><b>{g.name}{g.done&&<small className="sr-only"> — complete</small>}</b><p>{g.detail}</p></div></li>)}</ol>
        {goals.every(g=>g.done)&&<div className="campaign-achievement" role="status"><b>The first network is established.</b><p>Keep developing your corridors, try a different network, or download this milestone. Mercury industry and the solar swarm are future chapters.</p></div>}
        <div className="campaign-supply"><b>Earth supply programme</b><p>60 t construction cargo at Earth and 60 t support propellant, available every 30 simulation days. Keeps experimentation recoverable.</p><button disabled={busy||world.day<world.nextSupplyDay} onClick={()=>act(resupply)}>{world.day<world.nextSupplyDay?`Next allocation: ${day(world.nextSupplyDay)}`:'Request supply allocation'}</button></div>
      </section></div>
      <section className="campaign-traffic" aria-labelledby="traffic-heading"><div className="campaign-panel-heading"><h2 id="traffic-heading">Traffic in flight</h2><span>{world.flights.length} ACTIVE</span></div>{!world.flights.length?<p className="campaign-empty">The corridors are quiet. Dispatch construction cargo to your next outpost.</p>:<div className="campaign-flight-list">{world.flights.map(f=><article key={f.id}><div><span className="campaign-eyebrow">FLIGHT {String(f.id).padStart(3,'0')} / {f.mode==='tether'?'TETHER SERVICE':'BOOTSTRAP TUG'}</span><h3>{SITE[f.from].name} <span aria-hidden="true">→</span> {SITE[f.to].name}</h3></div><div><b>{f.cargoT} t</b><span>Construction cargo</span></div><div><b>{day(f.arrival)}</b><span>{number(f.arrival-world.day)} days remaining</span></div><progress aria-label={`Flight ${f.id} progress`} value={world.day-f.departed} max={f.arrival-f.departed}/></article>)}</div>}</section>
      <details className="campaign-history"><summary>Flight log <span>Last {world.log.length} events</span></summary><ol>{[...world.log].reverse().map((entry,i)=><li key={i}><time>{day(entry.day)}</time><span>{entry.text}</span></li>)}</ol></details>
    </>}
    <section className="campaign-saves" id="campaign-saves" aria-labelledby="save-heading"><div className="campaign-panel-heading"><div><p className="campaign-eyebrow">YOUR CAMPAIGNS</p><h2 id="save-heading">Leave a world. Come back to it.</h2></div><button disabled={busy} onClick={()=>upload.current?.click()}>Import backup</button></div>
      <p>Actions autosave in this browser. Each slot keeps three earlier checkpoints. Download a backup to move to another device or site address, or protect progress before clearing browser data.</p>
      {world&&<div className="campaign-new"><label htmlFor="new-network-name">New network name</label><input id="new-network-name" value={name} maxLength={48} onChange={e=>setName(e.target.value)}/><button disabled={busy} onClick={()=>start()}>Create separate network</button></div>}
      <input ref={upload} type="file" accept=".json,application/json" hidden onChange={e=>readFile(e.target.files?.[0])}/>
      {slots.length?<ul className="campaign-slot-list">{slots.map(s=><li key={s.id}><div><b>{s.name}{s.id===world?.id&&<span className="campaign-badge">CURRENT</span>}</b><small>{s.valid?`${day(s.day)} · revision ${s.revision}`:'Preserved for recovery or a compatible version'}</small></div><div><button disabled={busy||!s.valid} onClick={()=>resume(s.id)}>Load<span className="sr-only"> {s.name}</span></button><button disabled={busy||!s.recoverable} onClick={()=>recover(s.id)}>Recover checkpoint<span className="sr-only"> for {s.name}</span></button><button disabled={busy||s.id===world?.id} onClick={()=>{if(window.confirm(`Delete the saved campaign “${s.name}”? Download a backup first if you want to keep it.`))void task(async()=>{await deleteSave(s.id);await refresh();});}}>Delete<span className="sr-only"> {s.name}</span></button></div></li>)}</ul>:<p className="campaign-empty">{loading?'Checking saves…':'No campaigns saved here yet.'}</p>}
    </section>
    <footer className="campaign-footer"><span>EXPEDITIONS / FIRST PLAYABLE CHAPTER</span><a href="/lab/campaign/method/">Assumptions & research</a><a href="/lab/">Open Flight Studio</a></footer>
  </main>;
}
