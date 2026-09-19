import { BELT, beltObjectives, build, buildCost, CARGO, INDUSTRY, industryStatus, installIndustry, flightPlan, LIMITS, mercuryProduction, networkObjectives, objectives, powerObjectives, removeService, resupply, SITE, SITES, siteLocked, solarObjectives, toggleService, type Campaign, type CargoKind, type SiteId } from './model.js';
import { FacilityDrawing } from './NetworkMap.js';
import { trafficItems, type TrafficId } from './traffic.js';

export const n = (v:number,digits=1) => v.toLocaleString('en-US',{maximumFractionDigits:digits});
export const date = (v:number) => 'Day '+n(v);
export type Act = (fn:(w:Campaign)=>Campaign)=>void;
export type Prepare = (from:SiteId,to:SiteId,kind:CargoKind)=>void;

function Stock({value,testId}:{value:number;testId?:string}) {
  const text=n(value);
  return <dd data-testid={testId} className={text.length>6?'stock-long':undefined}><span>{text}</span> <small>t</small></dd>;
}

export function Outposts({world,busy,selected,onSelect,act,prepare}:{world:Campaign;busy:boolean;selected:SiteId;onSelect:(site:SiteId)=>void;act:Act;prepare:Prepare}) {
  const visibleSites=SITES.filter(s=>s!=='ceres'||world.solar.powerLink);
  return <section className="ops-outposts" id="outposts" aria-labelledby="outposts-heading">
    <header className="panel-title"><h2 id="outposts-heading">Outposts</h2><span>{visibleSites.filter(s=>world.ports[s].level).length} / {visibleSites.length} online</span></header>
    {visibleSites.map(id=>{
      const p=world.ports[id], locked=siteLocked(world,id), cost=buildCost(world,id);
      const incoming=world.flights.filter(f=>f.to===id).sort((a,b)=>a.arrival-b.arrival);
      const material=incoming.filter(f=>f.kind==='materials').reduce((a,f)=>a+f.cargoT,0),equipment=incoming.filter(f=>f.kind==='equipment').reduce((a,f)=>a+f.cargoT,0),water=incoming.filter(f=>f.kind==='water').reduce((a,f)=>a+f.cargoT,0);
      const hasWater=world.belt.unlocked&&(id==='ceres'||id==='phobos'),supplier=id==='ceres'?'phobos':'earth';
      const status=industryStatus(world,id),waiting=status.startsWith('Waiting')||status.includes('exhausted')||status.includes('full');
      const production=mercuryProduction(world);
      const rate=id==='earth'?'+0.5 t equipment · +1 t fuel / day':id==='moon'?'+1 t material · −0.05 t equipment / day':id==='phobos'?'+1 Mars point · −0.5 t material · −0.02 t equipment / day':id==='ceres'?'+2 t water · −0.02 t equipment / day':'Refinery '+n(production.mineCapacity)+' t/d · mirrors '+n(production.mirrorCapacity)+' t/d';
      const machine=id==='moon'?'lunavator':id==='phobos'?'anchor hub':'rotovator';
      return <article key={id} id={'outpost-'+id} className={'outpost'+(selected===id?' selected':'')+(locked?' locked':'')} aria-label={SITE[id].name+' outpost'}>
        <div className="outpost-title"><button className="outpost-select" aria-pressed={selected===id} onClick={()=>onSelect(id)}><i style={{background:SITE[id].color}}/>{SITE[id].name}<span className="sr-only"> {locked?'Chapter '+(id==='ceres'?'05':'03'):p.level?'Tier '+p.level:'Awaiting construction'}</span></button><span>{locked?'EXPEDITION':p.level?'T'+p.level+' · '+p.level*10+' t':'UNBUILT'}</span>{!locked&&p.level>0&&p.level<3&&<button className="outpost-upgrade" disabled={busy||p.materialsT<cost} aria-label={'Upgrade '+machine+' · '+cost+' t'} title={'Upgrade '+machine+' · '+cost+' t material'} onClick={()=>act(w=>build(w,id))}>↑ {cost} t</button>}</div>
        {locked?<div className="outpost-locked">{id==='ceres'?<><p><b>{n(world.solar.deployedT)} / {n(BELT.minSwarmT)} t</b> deployed · tier-2 Phobos hub</p><a href="#belt-operations">Ceres expedition ↗</a></>:<><p><b>{n(world.marsOperations)} / 100</b> Mars points to unlock</p><a href="#solar-heading">Mercury expedition ↗</a></>}</div>:<>
          <dl className="outpost-stock"><div><dt>Material</dt><Stock value={p.materialsT} testId={id+'-materials'}/></div><div><dt>Equipment</dt><Stock value={p.equipmentT} testId={id+'-equipment'}/></div><div><dt>{hasWater?'Water':'Inbound'}</dt><Stock value={hasWater?p.waterT:material+equipment+water} testId={hasWater?id+'-water':undefined}/></div></dl>
          <div className="outpost-inbound"><span>Next arrival</span><b>{incoming.length?n(incoming[0].arrival-world.day)+' d':'—'}</b><small>{incoming.length?(water?n(material+equipment)+' t supplies · '+n(water)+' t water':n(material)+' t material · '+n(equipment)+' t equipment'):'No cargo in transit'}</small></div>
          {p.industry&&<p className={'outpost-industry'+(waiting?' needs-supply':'')}><span className="status-dot"/>{waiting?status:'Industry active'}</p>}
          {p.industry&&<p className="outpost-rate">{rate}{id==='mercury'&&<span>{world.solar.powerLink?'Local tooling replaces maintenance':'Up to '+n(production.equipmentDemand,2)+' t equipment / day'}</span>}</p>}
          <p className="outpost-rating">{!p.level?'Tether not commissioned':p.readyDay>world.day?'Tether ready in '+n(p.readyDay-world.day)+' days':'Tether ready for departure'}</p>
          <div className="outpost-supply"><span>{id==='earth'?'Ship':'Supply'}</span><button aria-label={(id==='earth'?'Ship Earth material to Moon':'Supply '+SITE[id].name+' with material')} onClick={()=>prepare(supplier,id==='earth'?'moon':id,'materials')}>Material ↗</button><button aria-label={id==='earth'?'Ship Earth equipment to Moon':'Supply '+SITE[id].name+' with equipment'} onClick={()=>prepare(supplier,id==='earth'?'moon':id,'equipment')}>Equipment ↗</button></div>
          {p.level===0&&<button className="outpost-build" disabled={busy||p.materialsT<cost} onClick={()=>act(w=>build(w,id))}>{p.level?'Upgrade':'Commission'} {machine} · {cost} t</button>}
          {p.level>0&&!p.industry&&<><button className="outpost-build" disabled={busy||p.materialsT<20||p.equipmentT<5} onClick={()=>act(w=>installIndustry(w,id))}>Install {INDUSTRY[id].name.toLowerCase()}</button><p className="tiny">20 t material + 5 t equipment</p></>}
          {id==='earth'&&<div className="earth-allocation"><button disabled={busy||world.day<world.nextSupplyDay} onClick={()=>act(resupply)}>{world.day<world.nextSupplyDay?'Next allocation: '+date(world.nextSupplyDay):'Request supply allocation'}</button><p>+60 t material +60 t fuel · every 30 days</p></div>}
      {(id==='moon'||id==='phobos')&&<a className="outpost-experiment" href={id==='moon'?'/lab/lunar/':'/lab/phobos/'} target="_blank" rel="noopener" aria-label={`Explore the ${id==='moon'?'lunar':'Phobos'} tether in Flight Studio (opens a new tab)`}>Explore this tether <span>↗</span><small>Flight Studio · separate {id==='moon'?'orbital':'anchored'} experiment</small></a>}
        </>}
      </article>;
    })}
    <details className="outpost-architecture"><summary>{SITE[selected].facility} · architecture</summary><p>{SITE[selected].description}</p><FacilityDrawing site={selected}/><a href={selected==='earth'?'/lab/':'/lab/campaign/method/#'+(selected==='moon'?'lunavator':selected)}>Model & research ↗</a></details>
  </section>;
}

export function NextMove({world,onSelect,onMilestones}:{world:Campaign;onSelect:(site:SiteId)=>void;onMilestones:()=>void}) {
  const chapters=[objectives(world),networkObjectives(world),solarObjectives(world),powerObjectives(world),beltObjectives(world)], all=chapters.flat(), done=all.filter(g=>g.done).length;
  const chapter=chapters.findIndex(gs=>gs.some(g=>!g.done)), next=all.find(g=>!g.done);
  const targets:SiteId[]=['moon','moon','phobos','moon','moon','phobos','phobos','phobos','mercury','mercury','mercury','mercury','mercury','mercury','mercury','mercury','phobos','ceres','phobos','ceres'];
  return <section className="ops-next" aria-label="Next milestone"><div className="next-index">{chapter<0?'✓':String(chapter+1).padStart(2,'0')}</div><div><p className="campaign-eyebrow">{next?'NEXT MILESTONE':'NETWORK ESTABLISHED'}</p><h2>{next?.name||'The belt is supplying your network.'}</h2><p>{next?.detail||n(world.belt.refinedT)+' t of support fuel produced at Phobos. Keep your supply lines running and the swarm growing.'}</p></div><div className="next-actions">{next&&(chapter===4?<a className="next-power" href="#belt-operations">Open belt operations ↗</a>:chapter===3?<a className="next-power" href="#swarm-power">{world.solar.powerLink?'View power loop ↗':'Connect the power loop ↗'}</a>:<button onClick={()=>onSelect(targets[all.indexOf(next)])}>Focus {SITE[targets[all.indexOf(next)]].name} ↗</button>)}<button className="text-button" onClick={onMilestones}>{done} / {all.length} milestones</button></div></section>;
}

export function Milestones({world}:{world:Campaign}) {
  const first=objectives(world),network=networkObjectives(world),solar=solarObjectives(world),power=powerObjectives(world),belt=beltObjectives(world);
  return <div className="milestone-columns">
    {[{title:'First corridors',goals:first,cls:'campaign-progress'},{title:'Working network',goals:network,cls:'campaign-network-goals'},{title:'First light',goals:solar,cls:'solar-goals'},{title:'The power loop',goals:power,cls:'power-goals'},{title:'Into the Belt',goals:belt,cls:'belt-goals'}].map(({title,goals,cls},i)=><section className={cls} key={title}><p className="campaign-eyebrow">CHAPTER 0{i+1}</p><h3>{title}</h3><ol>{goals.map(g=><li key={g.name} className={g.done?'complete':''}><b>{g.done?'✓ ':''}{g.name}</b><p>{g.detail}</p></li>)}</ol></section>)}
    {first.every(g=>g.done)&&<p className="milestone-achievement">The first network is established.</p>}
  </div>;
}

export function TrafficBoard({world,busy,act,tracked,onTrack,arrivals,onDismiss}:{world:Campaign;busy:boolean;act:Act;tracked:TrafficId|null;onTrack:(id:TrafficId|null)=>void;arrivals:string[];onDismiss:()=>void}) {
  const flights=trafficItems(world);
  const services=<section className="campaign-schedules" aria-labelledby="schedules-heading"><header className="panel-title"><h2 id="schedules-heading">Scheduled services</h2><span>{world.services.length} / 12</span></header>
      <div className="traffic-scroll service-scroll" tabIndex={0} role="region" aria-label="Scheduled service list">{!world.services.length?<p className="campaign-empty">Start a regular supply line using the cargo controls. Your services and any shortages will appear here.</p>:world.services.map(s=>{
        const currentReason=flightPlan(world,s.from,s.to,s.cargoT,s.mode,s.kind).reason;
        const recoveryEnds=Math.max(world.ports[s.from].readyDay,world.ports[s.to].readyDay);
        const reason=s.enabled&&s.nextDay<=world.day+1+1e-8&&!(currentReason.includes('recovering')&&recoveryEnds<=s.nextDay)?currentReason.split('. ')[0]:'';
        return <article className="service-row" key={s.id} aria-label={'Service '+s.id}><div className="traffic-row-title"><h3>{SITE[s.from].name} <span>→</span> {SITE[s.to].name}</h3><span className={'traffic-state'+(!s.enabled?' paused':reason?' waiting':'')}>{!s.enabled?'Paused':reason?'Waiting':'Scheduled'}</span></div><p><b>{s.cargoT} t</b> {CARGO[s.kind].toLowerCase()} · every {s.intervalDays} d</p><p className="traffic-timing">{s.enabled?(reason?reason+' Retry ':'Next departure ')+date(s.nextDay):'In-flight deliveries continue.'}</p><div className="service-row-controls"><small>#{s.id} · {s.dispatched} sent · {n(s.deliveredT)} t delivered</small><button disabled={busy} aria-label={(s.enabled?'Pause service ':'Resume service ')+s.id} onClick={()=>act(w=>toggleService(w,s.id))}>{s.enabled?'Pause':'Resume'}</button><button disabled={busy} aria-label={'Remove service '+s.id} onClick={()=>act(w=>removeService(w,s.id))}>Remove</button></div></article>;
      })}</div>
    </section>;
  return <aside className="ops-traffic" id="traffic" aria-label="Live logistics">
    <section className="campaign-traffic" aria-labelledby="traffic-heading"><header className="panel-title"><h2 id="traffic-heading">In flight</h2><span>{flights.length} active</span></header>
      <div className="traffic-capacity" aria-label="Independent flight capacities"><span>Cargo <b data-testid="cargo-capacity">{world.flights.length} / {LIMITS.cargoFlights}</b></span>{world.solar.unlocked&&<span>Mirrors <b data-testid="mirror-capacity">{world.solar.deployments.length} / {LIMITS.mirrorDeployments}</b></span>}</div>
      <div className="traffic-total"><b>{n(flights.reduce((a,f)=>a+f.mass,0))} t</b> in transit <span>Next arrivals first</span></div>
      <div className="traffic-scroll flight-scroll" tabIndex={0} role="region" aria-label="Active flight list">{!flights.length?<p className="campaign-empty">No cargo in transit. Send a shipment and watch it cross the map.</p>:flights.map(f=><article className={'flight-row'+(tracked===f.id?' tracked':'')} key={f.id} data-arrival={f.arrival} data-kind={f.kind}><div className="traffic-row-title"><h3>{f.fromName} <span>→</span> {f.toName}</h3><b>{n(f.arrival-world.day)}<small> d</small></b></div><p><i className={'cargo-swatch '+f.kind} aria-hidden="true"/><b>{f.mass} t</b> {f.cargo.toLowerCase()} <span>· {date(f.arrival)}</span></p><div className="flight-row-bottom"><progress aria-label={f.label+' progress'} value={world.day-f.departed} max={f.arrival-f.departed}/>{f.kind==='mirrors'&&<span className="mirror-tag">SOLAR</span>}<button aria-pressed={tracked===f.id} aria-label={(tracked===f.id?'Tracking ':'Track ')+f.label.toLowerCase()} onClick={()=>onTrack(tracked===f.id?null:f.id)}>{tracked===f.id?'Tracking':'Track'}</button></div></article>)}</div>
    </section>
    {services}
    {!!arrivals.length&&<section className="campaign-arrivals" aria-label="Recent arrivals"><header><b>Deliveries received</b><button aria-label="Dismiss arrival notifications" onClick={onDismiss}>Dismiss</button></header><div role="status">{arrivals.map((text,i)=><p key={i}>{text}</p>)}</div></section>}
    <details className="campaign-history"><summary>Activity log <span>{world.log.length} events</span></summary><ol>{[...world.log].reverse().map((e,i)=><li key={i}><time>{date(e.day)}</time><span>{e.text}</span></li>)}</ol></details>
  </aside>;
}
