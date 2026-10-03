import EarthDesign from './EarthDesign.js';
import ServicePreview from './ServicePreview.js';
import { useEffect, useRef, useState } from 'react';
import { tetherCapacity, CONTRACT_OFFERS, contractRemaining, contractFlightPlan, dispatchContract, addContractService, addService, EARTH_EQUIPMENT_PER_DAY, type CargoKind, advance, createCampaign, dispatch, exportCampaign, flightPlan, importCampaign, LIMITS, nextEventDay, ROUTES, SITE, SITES, siteLocked, swarmPower, waterRoute, type Campaign as World, type Shipment, type SiteId } from './model.js';
import { deleteSave, listSaves, loadSave, saveCampaign, type SaveSummary } from './storage.js';
import SolarChapter from './SolarChapter.js';
import BeltChapter from './BeltChapter.js';
import DevelopmentChapter from './DevelopmentChapter.js';
import NetworkMap from './NetworkMap.js';
import { Milestones, NextMove, Outposts, TrafficBoard } from './Operations.js';
import type { TrafficId } from './traffic.js';
import './campaign.css';

const number = (n:number) => n.toLocaleString('en-US',{maximumFractionDigits:1});
const day = (n:number) => `Day ${number(n)}`;

export default function Campaign() {
  const [designSource,setDesignSource]=useState<string|null>(null),[designOpen,setDesignOpen]=useState(false);
  useEffect(()=>{const read=()=>setDesignSource(new URLSearchParams(location.hash.slice(1)).get('earth-design'));read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
  const [world,setWorld]=useState<World|null>(null), [slots,setSlots]=useState<SaveSummary[]>([]);
  useEffect(()=>{if(world&&designSource)setDesignOpen(true);},[world?.id,designSource]);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), lock=useRef(false);
  const [error,setError]=useState(''), [notice,setNotice]=useState(''), [saveStatus,setSaveStatus]=useState('');
  const [selected,setSelected]=useState<SiteId>('moon'), [from,setFrom]=useState<SiteId>('earth'), [to,setTo]=useState<SiteId>('moon');
  const [cargo,setCargo]=useState('10'), [mode,setMode]=useState<Shipment['mode']>('tug'), [name,setName]=useState('First light');
  const [kind,setKind]=useState<CargoKind>('materials'), [intervalDays,setIntervalDays]=useState('30');
  const [playing,setPlaying]=useState(false), [speed,setSpeed]=useState(1), [tracked,setTracked]=useState<TrafficId|null>(null);
  useEffect(()=>{if(designOpen)setPlaying(false);},[designOpen]);
  const [arrivals,setArrivals]=useState<string[]>([]);
  const [contractId,setContractId]=useState<number|null>(null);
  const milestonePanel=useRef<HTMLDetailsElement>(null), savePanel=useRef<HTMLDetailsElement>(null);
  const playButton=useRef<HTMLButtonElement>(null);
  const revision=useRef<number|null>(null), upload=useRef<HTMLInputElement>(null), main=useRef<HTMLElement>(null);
  const refresh=async()=>setSlots(await listSaves());
  useEffect(()=>{ let alive=true; listSaves().then(s=>{if(alive)setSlots(s);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;}; },[]);
  const task=async(fn:()=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    try{await fn();}catch(e){setPlaying(false);setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  };
  const persist=async(next:World)=>{
    setSaveStatus('Saving…');
    try{const committed=await saveCampaign(next,revision.current);revision.current=committed;if(committed!==next.revision)setWorld({...next,revision:committed});setSaveStatus('Saved in this browser');await refresh();}
    catch(e){setPlaying(false);setSaveStatus('Not saved — download a backup');throw e;}
  };
  const act=(fn:(w:World)=>World, pause=false)=>{
    // Ordinary operations keep Play active. The busy lock lets their save finish
    // before the next tick; only explicit time steps take over the clock.
    if(pause)setPlaying(false);
    void task(async()=>{
      if(!world)return;
      const next=fn(world), delivered=next.log.filter(e=>e.day>world.day&&(e.text.includes(' arrived at ')||e.text.includes(' t joined the solar swarm.'))).map(e=>e.text);
      if(delivered.length)setArrivals(previous=>[...delivered.reverse(),...previous].slice(0,3));
      setWorld(next);await persist(next);
    });
  };
  // A saved simulation step per tick, never elapsed wall-clock catch-up.
  // Pause on hidden tabs, load/import, save failure and the campaign horizon.
  useEffect(()=>{
    const hide=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',hide);
    return()=>document.removeEventListener('visibilitychange',hide);
  },[]);
  useEffect(()=>{
    const space=(event:KeyboardEvent)=>{
      if((event.code!=='Space'&&event.key!==' ')||event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||document.hidden||document.querySelector('dialog[open]'))return;
      const target=event.target;
      // Keep native Space activation and text editing inside focused controls.
      if(target instanceof Element&&(target.closest('input,textarea,select,button,a,summary,[role="button"],[role="link"]')||(target instanceof HTMLElement&&target.isContentEditable)))return;
      const button=playButton.current;
      if(!button)return;
      event.preventDefault(); // Holding Space must not toggle repeatedly or scroll.
      // Reuse the button's pending-save, error and horizon guards. Pause stays available.
      if(!event.repeat&&!button.disabled)button.click();
    };
    window.addEventListener('keydown',space);
    return()=>window.removeEventListener('keydown',space);
  },[]);
  useEffect(()=>{
    if(!playing||!world||busy||designOpen)return;
    if(world.day>=LIMITS.days){setPlaying(false);return;}
    const timer=window.setTimeout(()=>act(w=>advance(w,Math.min(speed,LIMITS.days-w.day))),1000);
    return()=>window.clearTimeout(timer);
  },[playing,speed,world,busy,designOpen]);
  const changeWorld=()=>{setContractId(null);setDesignOpen(false);setPlaying(false);setTracked(null);setArrivals([]);setSelected('moon');setFrom('earth');setTo('moon');setKind('materials');setCargo('10');setMode('tug');setIntervalDays('30');};
  const start=(candidate?:World)=>void task(async()=>{
    changeWorld();const next=candidate || createCampaign(crypto.randomUUID(),name);revision.current=null;setWorld(next);setSelected('moon');
    setFrom('earth');setTo('moon');setMode('tug');setCargo('10');setKind('materials');await persist(next);main.current?.focus();
  });
  const resume=(id:string)=>void task(async()=>{changeWorld();const next=await loadSave(id);setWorld(next);revision.current=next.revision;setSaveStatus('Saved in this browser');main.current?.focus();});
  const recover=(id:string)=>void task(async()=>{changeWorld();const next=await loadSave(id,true);next.id=crypto.randomUUID();next.revision=0;next.name=(next.name+' · recovery').slice(0,48);revision.current=null;setWorld(next);await persist(next);setNotice('Recovered into a new save slot. The original campaign is unchanged.');});
  const download=()=>{
    if(!world)return;
    try{const url=URL.createObjectURL(new Blob([exportCampaign(world)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`skyhook-campaign-${world.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'backup'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Campaign backup downloaded.');}catch(e){setError((e as Error).message);}
  };
  const readFile=(file?:File)=>void task(async()=>{
    try{if(!file)return;if(file.size>LIMITS.fileBytes)throw Error('Campaign file exceeds 512 KB.');
      const next=importCampaign(await file.text(),crypto.randomUUID());changeWorld();revision.current=null;setWorld(next);await persist(next);setNotice('Imported into a new slot. Existing campaigns are unchanged.');
    }finally{if(upload.current)upload.current.value='';}
  });
  const latest=slots.find(s=>s.valid), event=world?nextEventDay(world):null;
  const commitment=world?.commerce.contracts.find(c=>c.status==='active'&&CONTRACT_OFFERS.some(o=>o.id===c.offerId&&o.from===from&&o.to===to&&o.kind===kind))??null;
  const matchingOffer=commitment?CONTRACT_OFFERS.find(o=>o.id===commitment.offerId&&o.from===from&&o.to===to&&o.kind===kind):null;
  const assignedContract=world?.commerce.contracts.find(c=>c.id===contractId);
  const assignedOffer=assignedContract?CONTRACT_OFFERS.find(o=>o.id===assignedContract.offerId):null;
  let plan:ReturnType<typeof flightPlan>|undefined;
  if(world){try{plan=contractId!==null?contractFlightPlan(world,contractId,Number(cargo),mode):flightPlan(world,from,to,Number(cargo),mode,kind);}catch{/* A destination selection is incomplete. */}}
  const contractServiceUnavailable=contractId!==null&&(!assignedContract||assignedContract.status!=='active'||!!world&&contractRemaining(world,contractId).unassignedT<=0||!!plan&&world!.day+1+plan.duration>assignedContract.dueDay+1e-8);
  const serviceDisabled=!world||!plan||siteLocked(world,from)||siteLocked(world,to)||world.services.length>=LIMITS.services||world.day+1>LIMITS.days||!Number.isInteger(Number(intervalDays))||Number(intervalDays)<1||Number(intervalDays)>3650||!Number.isInteger(Number(cargo))||Number(cargo)<1||Number(cargo)>(mode==='tug'?10:30)||contractServiceUnavailable;
  const connected=(a:SiteId,b:SiteId)=>ROUTES.some(r=>(r.a===a&&r.b===b)||(r.b===a&&r.a===b));
  const chooseFrom=(id:SiteId)=>{
    setContractId(null);
    const destination=connected(id,to)?to:SITES.find(s=>connected(id,s)&&world&&!siteLocked(world,s))!;
    setFrom(id);setTo(destination);if(kind==='water'&&!waterRoute(id,destination))setKind('materials');
  };
  const chooseTo=(id:SiteId)=>{setContractId(null);setTo(id);if(kind==='water'&&!waterRoute(from,id))setKind('materials');};
  const reveal=(element:HTMLElement|null)=>{if(element instanceof HTMLDetailsElement)element.open=true;element?.scrollIntoView({block:'nearest'});};
  const focusSite=(id:SiteId)=>{setSelected(id);reveal(document.getElementById('outpost-'+id));};
  const trackFlight=(id:TrafficId|null)=>{
    setTracked(id);
    if(id)requestAnimationFrame(()=>{
      const network=document.getElementById('network'),bounds=network?.getBoundingClientRect();
      const clockBottom=document.querySelector('.campaign-clock')?.getBoundingClientRect().bottom??0;
      if(bounds&&(bounds.top<clockBottom+8||bounds.bottom>window.innerHeight-16)){
        network?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        document.getElementById('flight-inspector')?.focus({preventScroll:true});
      }
    });
  };
  const prepare=(origin:SiteId,destination:SiteId,resource:CargoKind,requestedT=10)=>{
    setContractId(null);
    const tether=!!(world?.ports[origin].level&&world?.ports[destination].level);
    const capacity=tether?Math.min(tetherCapacity(world!,origin),tetherCapacity(world!,destination)):10;
    setFrom(origin);setTo(destination);setKind(resource);setCargo(String(Math.max(1,Math.min(Math.ceil(requestedT),capacity))));setSelected(destination);
    setMode(tether?'tether':'tug');
    setIntervalDays(destination==='ceres'?'200':resource==='water'?'90':destination==='moon'?'90':destination==='mercury'?'60':'100');
    requestAnimationFrame(()=>{reveal(document.getElementById('dispatch'));document.getElementById('campaign-origin')?.focus({preventScroll:true});});
  };
  const prepareContract=(id:number)=>{
    if(!world)return;
    const contract=world.commerce.contracts.find(c=>c.id===id),offer=CONTRACT_OFFERS.find(o=>o.id===contract?.offerId);
    if(!contract||contract.status!=='active'||!offer)return;
    prepare(offer.from,offer.to,offer.kind,contractRemaining(world,id).unassignedT);
    setContractId(id);setIntervalDays('2');
  };
  return <main ref={main} tabIndex={-1} id="lab-content" className={'campaign'+(world?' has-world':'')}>
    <header className="campaign-header"><div><p className="campaign-eyebrow">SKYHOOK / EXPEDITIONS</p><h1>{world?world.name:'A foothold. Then a network.'}</h1></div>
      {world&&<div className="campaign-save"><span role="status">{saveStatus}</span><button onClick={()=>reveal(savePanel.current)}>Your saves <span aria-hidden="true">↗</span></button></div>}
    </header>
    {error&&<div className="campaign-message error" role="alert"><span>{error}</span>{world&&saveStatus.startsWith('Not saved')&&<div><button disabled={busy} onClick={()=>void task(async()=>persist(world))}>Retry save</button> <button onClick={download}>Export unsaved progress</button></div>}</div>}{notice&&<div className="campaign-message" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}>Dismiss</button></div>}
    {!world&&designSource&&<p className="campaign-message">A Flight Studio design is ready to review. Continue a saved network or start one to see its report and commissioning cost.</p>}
    {world&&designOpen&&<EarthDesign key={world.id} world={world} source={designSource} busy={busy} saveError={error} act={act} onClose={()=>setDesignOpen(false)}/>}
    {!world&&<><section className="campaign-welcome" aria-label="Start or continue"><div><p className="campaign-eyebrow">BUILD AN INTERPLANETARY SUPPLY CHAIN</p><h2>Start at Earth.<br/>Build toward the Sun.</h2><p>Supply a lunar lunavator. Anchor your Mars network at Phobos. Grow a solar swarm from Mercury, then reach into the belt for water and propellant.</p><p>Your outposts, routes and cargo share one operations view. Time moves when you choose. Build reliable routes, then earn from customer freight contracts.</p></div><div className="campaign-start">
      <div className="campaign-recent">{loading?<p role="status">Checking saved networks…</p>:latest?<button className="primary" disabled={busy} onClick={()=>resume(latest.id)}><span>Continue {latest.name}</span><small>{day(latest.day)}</small></button>:<p>Your progress stays in this browser.</p>}</div>
      <label htmlFor="campaign-name">Name your network</label><input id="campaign-name" maxLength={48} value={name} disabled={loading} onChange={e=>setName(e.target.value)} autoComplete="off"/>
      <button className={latest?'':'primary'} disabled={busy||loading} onClick={()=>start()}>Start new network</button><button disabled={busy||loading} onClick={()=>upload.current?.click()}>Import campaign backup</button>
    </div></section><NetworkMap world={null} selected={selected} onSelect={setSelected} tracked={null} playing={false}/></>}
    {world&&<>
      <section className="campaign-clock" aria-label="Advance simulation"><div className="clock-readout"><strong data-testid="campaign-day">{day(world.day)}</strong><span><i className={playing?'clock-running':''}/>{playing?'Running':'Paused'} · simulation time</span></div><div className="campaign-time-controls">
        <button ref={playButton} className="primary" disabled={!playing&&(busy||world.day>=LIMITS.days||saveStatus.startsWith('Not saved'))} aria-label={playing?'Pause simulation':'Play simulation'} aria-keyshortcuts="Space" title={(playing?'Pause':'Play')+' simulation (Space)'} onClick={()=>setPlaying(p=>!p)}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span> {playing?'Pause':'Play'}<kbd className="clock-shortcut" aria-hidden="true">Space</kbd></button>
        <label className="campaign-speed"><span className="sr-only">Speed</span><select aria-label="Simulation speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1 day / sec</option><option value={10}>10 days / sec</option><option value={30}>30 days / sec</option></select></label>
        <button disabled={busy||world.day+1>LIMITS.days} onClick={()=>act(w=>advance(w,1),true)}>+1 day</button><button disabled={busy||world.day+30>LIMITS.days} onClick={()=>act(w=>advance(w,30),true)}>+30 days</button><button aria-label="Advance to next event" title={event===null?'No future event':day(event)} disabled={busy||event===null} onClick={()=>event!==null&&act(w=>advance(w,Math.max(1e-7,event-w.day)),true)}>Next event →</button></div>
      <div className="ops-status" aria-label="Network status"><span><b data-testid="campaign-fuel">{number(world.fuelT)} t</b> support fuel</span><span><b>{number(world.marsOperations)}</b> Mars points</span><span><b>{world.flights.length+world.solar.deployments.length}</b> flights</span><span><b>{world.services.filter(s=>s.enabled).length}</b> active services</span>{world.solar.unlocked&&<span><b>{number(world.solar.deployedT)} t</b> swarm deployed</span>}{world.solar.unlocked&&<span><b>{number(swarmPower(world).returnedGW)} GW</b> to Mercury</span>}</div>
      </section>
      <NextMove world={world} onSelect={focusSite} onMilestones={()=>reveal(milestonePanel.current)} onOutlook={()=>{
        const panel=document.querySelector<HTMLDetailsElement>('.network-outlook');
        if(panel){panel.open=true;reveal(panel);panel.querySelector('summary')?.focus({preventScroll:true});}
      }} onTract={()=>{
        const panel=document.querySelector<HTMLDetailsElement>('.development-tracts');
        if(panel){panel.open=true;const heading=document.getElementById('development-mercuryTract-heading');reveal(heading);heading?.focus({preventScroll:true});}
      }}/>
      <nav className="ops-jump" aria-label="Operations navigation"><a href="#outposts">Outposts</a><a href="#network">Map</a><a href="#traffic">Traffic</a><a href="#contracts">Contracts</a><a href="#dispatch">Send cargo</a></nav>
      <div className="ops-grid">
        <Outposts world={world} busy={busy} selected={selected} onSelect={setSelected} act={act} prepare={prepare} onEarthDesign={()=>setDesignOpen(true)}/>
        <div className="ops-center"><section id="network" aria-label="Network map"><NetworkMap world={world} selected={selected} onSelect={setSelected} tracked={tracked} onTrack={trackFlight} playing={playing} route={{from,to}}/></section>
          <section className="campaign-dispatch" id="dispatch" aria-labelledby="dispatch-heading"><header className="panel-title"><h2 id="dispatch-heading">Send cargo</h2><span>{SITE[from].name} → {SITE[to].name}</span></header>
        <form onSubmit={e=>{e.preventDefault();act(w=>contractId!==null?dispatchContract(w,contractId,Number(cargo),mode):dispatch(w,from,to,Number(cargo),mode,kind));}}>
          <div className="campaign-fields"><div><label htmlFor="campaign-origin">From</label><select id="campaign-origin" value={from} onChange={e=>chooseFrom(e.target.value as SiteId)}>{SITES.map(s=><option key={s} value={s} disabled={siteLocked(world,s)}>{SITE[s].name}{siteLocked(world,s)?' · Chapter '+(s==='ceres'?'05':'03'):''}</option>)}</select></div><div><label htmlFor="campaign-destination">To</label><select id="campaign-destination" value={to} onChange={e=>chooseTo(e.target.value as SiteId)}>{SITES.filter(s=>connected(from,s)).map(s=><option key={s} value={s} disabled={siteLocked(world,s)}>{SITE[s].name}{siteLocked(world,s)?' · Chapter '+(s==='ceres'?'05':'03'):''}</option>)}</select></div><div><label htmlFor="campaign-kind">Cargo type</label><select id="campaign-kind" value={kind} onChange={e=>{setContractId(null);setKind(e.target.value as CargoKind);}}><option value="materials">Construction material</option><option value="equipment">Equipment</option>{waterRoute(from,to)&&<option value="water">Water</option>}</select></div><div><label htmlFor="campaign-cargo">Cargo (t)</label><input id="campaign-cargo" type="number" min="1" max="30" step="1" required value={cargo} onChange={e=>setCargo(e.target.value)}/></div></div>
          {(matchingOffer||assignedContract)&&<div className="dispatch-recipient"><label htmlFor="campaign-recipient">Cargo recipient</label><select id="campaign-recipient" aria-label="Cargo recipient" value={contractId??'depot'} onChange={e=>setContractId(e.target.value==='depot'?null:Number(e.target.value))}><option value="depot">Your {SITE[to].name} depot</option>{matchingOffer&&commitment&&<option value={commitment.id}>{matchingOffer.buyer} · contract #{commitment.id}</option>}{assignedContract&&assignedContract.id!==commitment?.id&&<option value={assignedContract.id}>Contract #{assignedContract.id} · {assignedContract.status}</option>}</select></div>}
          {assignedContract&&assignedOffer&&<aside className="dispatch-contract" aria-label="Assigned contract"><b>Customer freight · {assignedOffer.buyer}</b><p>{number(assignedContract.deliveredT)} / {number(assignedContract.quantityT)} t delivered · due {day(assignedContract.dueDay)}. On-time cargo is sold to the buyer; it does not supply your depot.</p></aside>}
          <aside className="campaign-origin-stock" aria-label="Departure depot stock">
            <span>{SITE[from].name} stock</span><dl><div><dt>Material</dt><dd>{number(world.ports[from].materialsT)} t</dd></div><div><dt>Equipment</dt><dd data-testid="origin-equipment">{number(world.ports[from].equipmentT)} t</dd></div>{waterRoute(from,to)&&<div><dt>Water</dt><dd data-testid="origin-water">{number(world.ports[from].waterT)} t</dd></div>}</dl>
            {from==='earth'&&world.ports.earth.industry&&kind==='equipment'&&world.ports.earth.equipmentT<Number(cargo)&&<p>Earth manufactures {EARTH_EQUIPMENT_PER_DAY} t per simulation day. <b>+30 days produces {30*EARTH_EQUIPMENT_PER_DAY} t.</b>{world.services.some(s=>s.enabled&&s.from==='earth'&&s.kind==='equipment')&&' Scheduled services draw from this stock.'}</p>}
          </aside>
          <fieldset className="campaign-service"><legend className="sr-only">Transport service</legend><label><input type="radio" name="service" value="tug" checked={mode==='tug'} onChange={()=>setMode('tug')}/><span><b>Bootstrap tug</b><small>10 t capacity</small></span></label><label><input type="radio" name="service" value="tether" checked={mode==='tether'} onChange={()=>setMode('tether')}/><span><b>Tether corridor</b><small>Both tethers required</small></span></label></fieldset>
          {plan&&<div className="campaign-flight-estimate"><div><span>COAST + HANDLING</span><b>{number(plan.duration)} days</b></div><div><span>SUPPORT PROPELLANT</span><b>{Number.isFinite(plan.fuelT)?number(plan.fuelT):'—'} t</b></div><div><span>ARRIVAL</span><b>{day(world.day+plan.duration)}</b></div></div>}
          <div className="dispatch-action"><p id="flight-reason" className={'campaign-hint'+(plan?.reason?' dispatch-blocked':'')}>{plan?.reason||'Ready for departure'}</p><button className="primary" type="submit" disabled={busy||!!plan?.reason||!plan} aria-describedby="flight-reason">Dispatch cargo <span aria-hidden="true">↗</span></button></div>
          <div className="campaign-schedule-form"><label htmlFor="service-interval">Repeat every (simulation days)</label><div><input id="service-interval" type="number" min="1" max="3650" step="1" value={intervalDays} onChange={e=>setIntervalDays(e.target.value)}/><button type="button" disabled={busy||serviceDisabled} onClick={()=>act(w=>contractId!==null?addContractService(w,contractId,Number(cargo),mode,Number(intervalDays)):addService(w,from,to,Number(cargo),mode,kind,Number(intervalDays)))}>Schedule service</button></div><p className="campaign-hint">First attempt tomorrow. Blocked departures retry daily.{contractId!==null&&' The last batch shrinks to fit the order; this service pauses when all cargo is assigned.'}</p></div>
          <ServicePreview key={world.id} world={world} draft={{from,to,kind,mode,contractId,cargoT:Number(cargo),intervalDays:Number(intervalDays)}} disabled={serviceDisabled}/>
        </form>
          </section>
          <SolarChapter world={world} busy={busy} act={act}/>
          <BeltChapter world={world} busy={busy} act={act} prepare={prepare}/>
          <DevelopmentChapter key={world.id} world={world} busy={busy} act={act} prepare={prepare}/>
        </div>
        <TrafficBoard key={world.id} world={world} busy={busy} act={act} prepareContract={prepareContract} tracked={tracked} onTrack={trackFlight} arrivals={arrivals} onDismiss={()=>setArrivals([])}/>
      </div>
      <details ref={milestonePanel} className="campaign-milestones" id="milestones"><summary>Milestones <span>First corridors → working network → first light → the power loop → into the belt → industrial scale</span></summary><Milestones world={world}/></details>
    </>}
    <details ref={savePanel} className="campaign-save-manager" open={!world}><summary>Saved networks & backups</summary>
    <section className="campaign-saves" id="campaign-saves" aria-labelledby="save-heading"><div className="campaign-panel-heading"><div><p className="campaign-eyebrow">YOUR CAMPAIGNS</p><h2 id="save-heading">Saved networks</h2></div><button disabled={busy||loading} onClick={()=>upload.current?.click()}>Import backup</button></div>
      {world&&<div className="save-actions"><button disabled={busy} onClick={()=>void task(async()=>persist(world))}>Save now</button><button onClick={download}>Download backup</button></div>}
      <p>Actions autosave in this browser. Each slot keeps three earlier checkpoints. Download a backup to move to another device or site address, or protect progress before clearing browser data. Time pauses when this tab is hidden; there is no offline progress.</p>
      {world&&<div className="campaign-new"><label htmlFor="new-network-name">New network name</label><input id="new-network-name" value={name} maxLength={48} onChange={e=>setName(e.target.value)}/><button disabled={busy} onClick={()=>start()}>Create separate network</button></div>}
      <input ref={upload} type="file" accept=".json,application/json" hidden onChange={e=>readFile(e.target.files?.[0])}/>
      {slots.length?<ul className="campaign-slot-list">{slots.map(s=><li key={s.id}><div><b>{s.name}{s.id===world?.id&&<span className="campaign-badge">CURRENT</span>}</b><small>{s.valid?day(s.day):'Preserved for recovery or a compatible version'}</small></div><div><button disabled={busy||!s.valid} onClick={()=>resume(s.id)}>Load<span className="sr-only"> {s.name}</span></button><button disabled={busy||!s.recoverable} onClick={()=>recover(s.id)}>Recover checkpoint<span className="sr-only"> for {s.name}</span></button><button disabled={busy||s.id===world?.id} onClick={()=>{if(window.confirm(`Delete the saved campaign “${s.name}”? Download a backup first if you want to keep it.`))void task(async()=>{await deleteSave(s.id);await refresh();});}}>Delete<span className="sr-only"> {s.name}</span></button></div></li>)}</ul>:<p className="campaign-empty">{loading?'Checking saves…':'No campaigns saved here yet.'}</p>}
    </section>
    </details>
    <footer className="campaign-footer"><span>EXPEDITIONS / NETWORK OPERATIONS</span><a href="/lab/campaign/method/">Assumptions & research</a><a href="/lab/">Open Flight Studio</a></footer>
  </main>;
}
