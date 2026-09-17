import { build, buildCost, CARGO, INDUSTRY, industryStatus, installIndustry, flightPlan, networkObjectives, objectives, removeService, resupply, SITE, SITES, solarObjectives, toggleService, type Campaign, type CargoKind, type SiteId } from './model.js';
import { FacilityDrawing } from './NetworkMap.js';

export const n = (v:number) => v.toLocaleString('en-US',{maximumFractionDigits:1});
export const date = (v:number) => 'Day '+n(v);
export type Act = (fn:(w:Campaign)=>Campaign)=>void;
export type Prepare = (from:SiteId,to:SiteId,kind:CargoKind)=>void;

export function Outposts({world,busy,selected,onSelect,act,prepare}:{world:Campaign;busy:boolean;selected:SiteId;onSelect:(site:SiteId)=>void;act:Act;prepare:Prepare}) {
  return <section className="ops-outposts" id="outposts" aria-labelledby="outposts-heading">
    <header className="panel-title"><div><p className="campaign-eyebrow">THE SUPPLY CHAIN</p><h2 id="outposts-heading">Outposts</h2></div><span>{SITES.filter(s=>world.ports[s].level).length} / 4 online</span></header>
    {SITES.map(id=>{
      const p=world.ports[id], locked=id==='mercury'&&!world.solar.unlocked, cost=buildCost(world,id);
      const incoming=world.flights.filter(f=>f.to===id).sort((a,b)=>a.arrival-b.arrival);
      const material=incoming.filter(f=>f.kind==='materials').reduce((a,f)=>a+f.cargoT,0),equipment=incoming.filter(f=>f.kind==='equipment').reduce((a,f)=>a+f.cargoT,0);
      const status=industryStatus(world,id),waiting=status.startsWith('Waiting')||status.includes('exhausted')||status.includes('full');
      const rate=id==='earth'?'+0.5 t equipment · +1 t fuel / day':id==='moon'?'+1 t material · −0.05 t equipment / day':id==='phobos'?'+1 Mars point · −0.5 t material · −0.02 t equipment / day':world.solar.mirrorWorks?'Refinery 2 t/day · mirrors 1 t/day · ≤0.15 t equipment/day':'Up to +2 t material · −0.1 t equipment / day';
      const machine=id==='moon'?'lunavator':id==='phobos'?'anchor hub':'rotovator';
      return <article key={id} id={'outpost-'+id} className={'outpost'+(selected===id?' selected':'')+(locked?' locked':'')} aria-label={SITE[id].name+' outpost'}>
        <div className="outpost-title"><button className="outpost-select" aria-pressed={selected===id} onClick={()=>onSelect(id)}><i style={{background:SITE[id].color}}/>{SITE[id].name}<span className="sr-only"> {locked?'Chapter 03':p.level?'Tier '+p.level:'Awaiting construction'}</span></button><span>{locked?'EXPEDITION':p.level?'T'+p.level+' · '+p.level*10+' t':'UNBUILT'}</span>{!locked&&p.level>0&&p.level<3&&<button className="outpost-upgrade" disabled={busy||p.materialsT<cost} aria-label={'Upgrade '+machine+' · '+cost+' t'} title={'Upgrade '+machine+' · '+cost+' t material'} onClick={()=>act(w=>build(w,id))}>↑ {cost} t</button>}</div>
        {locked?<div className="outpost-locked"><p>Develop Mars operations to reach Mercury.</p><p><b>{n(world.marsOperations)} / 100</b> operations points</p><a href="#solar-heading">Mercury expedition ↗</a></div>:<>
          <dl className="outpost-stock"><div><dt>Material</dt><dd data-testid={id+'-materials'}>{n(p.materialsT)} <small>t</small></dd></div><div><dt>Equipment</dt><dd data-testid={id+'-equipment'}>{n(p.equipmentT)} <small>t</small></dd></div><div><dt>Inbound</dt><dd>{n(material+equipment)} <small>t</small></dd></div></dl>
          {incoming.length>0&&<p className="outpost-inbound">{n(material)} t material · {n(equipment)} t equipment · Next arrival in {n(incoming[0].arrival-world.day)} days</p>}
          {(waiting||!p.industry)&&<p className={'outpost-industry'+(waiting?' needs-supply':'')}><span className="status-dot"/>{p.industry?status:'Industry not installed'}</p>}
          {p.industry&&<p className="outpost-rate"><span className="status-dot"/>{rate}{id==='mercury'&&world.solar.mirrorWorks&&world.solar.depositT===0?' · local deposit exhausted':''}</p>}
          {p.readyDay>world.day&&<p className="outpost-rating">Tether ready in {n(p.readyDay-world.day)} days</p>}
          <div className="outpost-supply"><span>{id==='earth'?'EXPORT':'SUPPLY'}</span><button aria-label={(id==='earth'?'Ship Earth material to Moon':'Supply '+SITE[id].name+' with material')} onClick={()=>prepare('earth',id==='earth'?'moon':id,'materials')}>Material ↗</button><button aria-label={id==='earth'?'Ship Earth equipment to Moon':'Supply '+SITE[id].name+' with equipment'} onClick={()=>prepare('earth',id==='earth'?'moon':id,'equipment')}>Equipment ↗</button></div>
          {p.level===0&&<button className="outpost-build" disabled={busy||p.materialsT<cost} onClick={()=>act(w=>build(w,id))}>{p.level?'Upgrade':'Commission'} {machine} · {cost} t</button>}
          {!p.industry&&<><button className="outpost-build" disabled={busy||!p.level||p.materialsT<20||p.equipmentT<5} onClick={()=>act(w=>installIndustry(w,id))}>Install {INDUSTRY[id].name.toLowerCase()}</button><p className="tiny">Industry: 20 t material + 5 t equipment</p></>}
          {id==='earth'&&<div className="earth-allocation"><button disabled={busy||world.day<world.nextSupplyDay} onClick={()=>act(resupply)}>{world.day<world.nextSupplyDay?'Next allocation: '+date(world.nextSupplyDay):'Request supply allocation'}</button><p>+60 t material +60 t fuel · every 30 days</p></div>}
        </>}
        <details className="outpost-architecture"><summary>{SITE[id].facility} · architecture</summary><p>{SITE[id].description}</p><FacilityDrawing site={id}/><a href={id==='earth'?'/lab/':'/lab/campaign/method/#'+(id==='moon'?'lunavator':id)}>Model & research ↗</a></details>
      </article>;
    })}
  </section>;
}

export function NextMove({world,onSelect,onMilestones}:{world:Campaign;onSelect:(site:SiteId)=>void;onMilestones:()=>void}) {
  const chapters=[objectives(world),networkObjectives(world),solarObjectives(world)], all=chapters.flat(), done=all.filter(g=>g.done).length;
  const chapter=chapters.findIndex(gs=>gs.some(g=>!g.done)), next=all.find(g=>!g.done);
  const targets:SiteId[]=['moon','moon','phobos','moon','moon','phobos','phobos','phobos','mercury','mercury','mercury','mercury'];
  return <section className="ops-next" aria-label="Next milestone"><div className="next-index">{chapter<0?'✓':String(chapter+1).padStart(2,'0')}</div><div><p className="campaign-eyebrow">{next?'NEXT MILESTONE':'NETWORK ESTABLISHED'}</p><h2>{next?.name||'Your first solar swarm is established.'}</h2><p>{next?.detail||n(world.solar.deployedT)+' t deployed. Keep your industries supplied and the swarm growing.'}</p></div><div className="next-actions">{next&&<button onClick={()=>onSelect(targets[all.indexOf(next)])}>Focus {SITE[targets[all.indexOf(next)]].name} ↗</button>}<button className="text-button" onClick={onMilestones}>{done} / 12 milestones</button></div></section>;
}

export function Milestones({world}:{world:Campaign}) {
  const first=objectives(world),network=networkObjectives(world),solar=solarObjectives(world);
  return <div className="milestone-columns">
    {[{title:'First corridors',goals:first,cls:'campaign-progress'},{title:'Working network',goals:network,cls:'campaign-network-goals'},{title:'First light',goals:solar,cls:'solar-goals'}].map(({title,goals,cls},i)=><section className={cls} key={title}><p className="campaign-eyebrow">CHAPTER 0{i+1}</p><h3>{title}</h3><ol>{goals.map(g=><li key={g.name} className={g.done?'complete':''}><b>{g.done?'✓ ':''}{g.name}</b><p>{g.detail}</p></li>)}</ol></section>)}
    {first.every(g=>g.done)&&<p className="milestone-achievement">The first network is established.</p>}
  </div>;
}

export function TrafficBoard({world,busy,act,tracked,onTrack,arrivals,onDismiss}:{world:Campaign;busy:boolean;act:Act;tracked:number|null;onTrack:(id:number|null)=>void;arrivals:string[];onDismiss:()=>void}) {
  const flights=[...world.flights.map(f=>({id:'cargo-'+f.id,shipment:f.id,from:SITE[f.from].name,to:SITE[f.to].name,mass:f.cargoT,kind:CARGO[f.kind],departed:f.departed,arrival:f.arrival})),...world.solar.deployments.map(d=>({id:'mirror-'+d.id,shipment:null,from:'Mercury',to:'Solar swarm',mass:d.massT,kind:'Mirrors · launch '+d.id,departed:d.departed,arrival:d.arrival}))].sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id));
  const followed=world.flights.find(f=>f.id===tracked);
  return <aside className="ops-traffic" id="traffic" aria-label="Live logistics">
    <section className="campaign-schedules" aria-labelledby="schedules-heading"><header className="panel-title"><div><p className="campaign-eyebrow">RECURRING CARGO</p><h2 id="schedules-heading">Scheduled services</h2></div><span>{world.services.length} / 12</span></header>
      <div className="traffic-scroll service-scroll" tabIndex={0} role="region" aria-label="Scheduled service list">{!world.services.length?<p className="campaign-empty">Start a regular supply line using the cargo controls. Your services and any shortages will appear here.</p>:world.services.map(s=>{
        const currentReason=flightPlan(world,s.from,s.to,s.cargoT,s.mode,s.kind).reason;
        const recoveryEnds=Math.max(world.ports[s.from].readyDay,world.ports[s.to].readyDay);
        const reason=s.enabled&&s.nextDay<=world.day+1+1e-8&&!(currentReason.includes('recovering')&&recoveryEnds<=s.nextDay)?currentReason.split('. ')[0]:'';
        return <article className="service-row" key={s.id} aria-label={'Service '+s.id}><div className="traffic-row-title"><h3>{SITE[s.from].name} <span>→</span> {SITE[s.to].name}</h3><span className={'traffic-state'+(!s.enabled?' paused':reason?' waiting':'')}>{!s.enabled?'Paused':reason?'Waiting':'Scheduled'}</span></div><p><b>{s.cargoT} t</b> {CARGO[s.kind].toLowerCase()} · every {s.intervalDays} d</p><p className="traffic-timing">{s.enabled?(reason?reason+' Retry ':'Next departure ')+date(s.nextDay):'In-flight deliveries continue.'}</p><div className="service-row-controls"><small>#{s.id} · {s.dispatched} sent · {n(s.deliveredT)} t delivered</small><button disabled={busy} aria-label={(s.enabled?'Pause service ':'Resume service ')+s.id} onClick={()=>act(w=>toggleService(w,s.id))}>{s.enabled?'Pause':'Resume'}</button><button disabled={busy} aria-label={'Remove service '+s.id} onClick={()=>act(w=>removeService(w,s.id))}>Remove</button></div></article>;
      })}</div>
    </section>
    <section className="campaign-traffic" aria-labelledby="traffic-heading"><header className="panel-title"><div><p className="campaign-eyebrow">NEXT ARRIVALS FIRST</p><h2 id="traffic-heading">In flight</h2></div><span>{flights.length} / 32</span></header>
      <div className="traffic-total">{n(flights.reduce((a,f)=>a+f.mass,0))} t travelling · {world.flights.length} cargo + {world.solar.deployments.length} mirror batches</div>
      {tracked!==null&&<div className="campaign-tracking" aria-label="Tracked flight"><p>{followed?'Following flight '+tracked+' · '+SITE[followed.from].name+' → '+SITE[followed.to].name:'Delivery complete. Cargo has reached its destination.'}</p><button onClick={()=>onTrack(null)}>Stop tracking</button></div>}
      <div className="traffic-scroll flight-scroll" tabIndex={0} role="region" aria-label="Active flight list">{!flights.length?<p className="campaign-empty">No cargo in transit. Send a shipment and watch it cross the map.</p>:flights.map(f=><article className={'flight-row'+(f.shipment!==null&&tracked===f.shipment?' tracked':'')} key={f.id} data-arrival={f.arrival}><div className="traffic-row-title"><h3>{f.from} <span>→</span> {f.to}</h3><b>{n(f.arrival-world.day)}<small> d</small></b></div><p><b>{f.mass} t</b> {f.kind.toLowerCase()} <span>· {date(f.arrival)}</span></p><div className="flight-row-bottom"><progress aria-label={(f.shipment!==null?'Flight '+f.shipment:'Mirror '+f.id)+' progress'} value={world.day-f.departed} max={f.arrival-f.departed}/>{f.shipment!==null?<button aria-pressed={tracked===f.shipment} aria-label={(tracked===f.shipment?'Tracking flight ':'Track flight ')+f.shipment} onClick={()=>onTrack(tracked===f.shipment?null:f.shipment)}>{tracked===f.shipment?'Tracking':'Track'}</button>:<span className="mirror-tag">DEPLOYMENT</span>}</div></article>)}</div>
    </section>
    {!!arrivals.length&&<section className="campaign-arrivals" aria-label="Recent arrivals"><header><b>Deliveries received</b><button aria-label="Dismiss arrival notifications" onClick={onDismiss}>Dismiss</button></header><div role="status">{arrivals.map((text,i)=><p key={i}>{text}</p>)}</div></section>}
    <details className="campaign-history"><summary>Activity log <span>{world.log.length} events</span></summary><ol>{[...world.log].reverse().map((e,i)=><li key={i}><time>{date(e.day)}</time><span>{e.text}</span></li>)}</ol></details>
  </aside>;
}
