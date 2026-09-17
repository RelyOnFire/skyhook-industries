import { buildSolar, launchMirrors, mercuryUnlockReason, mirrorLaunchPlan, SOLAR, solarBuildReason, solarObjectives, toggleMirrorLaunches, unlockMercury, type Campaign, type SiteId } from './model.js';
const n=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:1});

export function SwarmDrawing({world}:{world:Campaign}) {
  const count=Math.min(60,Math.ceil(world.solar.deployedT/10));
  return <svg className="solar-drawing" viewBox="0 0 520 310" role="img" aria-label={'Solar swarm schematic: '+n(world.solar.deployedT)+' tonnes deployed around the Sun. Symbols represent batches, not individual mirrors.'}>
    <defs><radialGradient id="swarm-sun"><stop stopColor="#fff1c8"/><stop offset=".6" stopColor="#efbd6b"/><stop offset="1" stopColor="#b96932"/></radialGradient></defs>
    <ellipse cx="255" cy="153" rx="175" ry="105" className="map-orbit"/>
    <ellipse cx="255" cy="153" rx="130" ry="71" className="map-orbit"/>
    <circle cx="255" cy="153" r="35" fill="url(#swarm-sun)"/>
    <circle cx="255" cy="153" r="47" fill="none" stroke="#ad7738" opacity=".25"/>
    {Array.from({length:count},(_,i)=>{
      const a=i*2.399963, ring=i%2?175:130, x=255+Math.cos(a)*ring,y=153+Math.sin(a)*(i%2?105:71);
      return <rect key={i} x={x-4} y={y-3} width="8" height="6" fill="#eac692" transform={'rotate('+(a*180/Math.PI)+' '+x+' '+y+')'}/>;
    })}
    <text x="255" y="214" textAnchor="middle" className="map-label">SOL</text>
    <text x="255" y="284" textAnchor="middle" className="map-route-label">{count?'BATCH SYMBOLS · SCHEMATIC':'AWAITING FIRST DEPLOYMENT'}</text>
  </svg>;
}

export default function SolarChapter({world,busy,act,onSelect}:{world:Campaign;busy:boolean;act:(fn:(w:Campaign)=>Campaign)=>void;onSelect:(id:SiteId)=>void}) {
  const s=world.solar, p=world.ports.mercury, goals=solarObjectives(world), unlockReason=mercuryUnlockReason(world), launch=mirrorLaunchPlan(world,SOLAR.launchT);
  const workReason=solarBuildReason(world,'mirrorWorks'),arrayReason=solarBuildReason(world,'launchArray');
  const incomingEquipment=world.flights.filter(f=>f.to==='mercury'&&f.kind==='equipment').reduce((sum,f)=>sum+f.cargoT,0);
  return <section className="campaign-solar" aria-labelledby="solar-heading">
    <header><div><p className="campaign-eyebrow">CHAPTER 03 / FIRST LIGHT</p><h2 id="solar-heading">From Mercury. Toward a solar swarm.</h2><p>A material source, a mirror works, and a stream of launches around the Sun.</p></div><span className="campaign-badge">{goals.filter(g=>g.done).length} / {goals.length} MILESTONES</span></header>
    {!s.unlocked?<div className="solar-expedition">
      <div><h3>Open the Mercury expedition</h3><p>Your Phobos staging programme needs {SOLAR.unlockOperations} Mars operations points. You have <b>{n(world.marsOperations)}</b>.</p><p>Prepare <b>60 t construction material and 20 t equipment at Earth</b> for the survey and ground support. Cargo for Mercury travels separately.</p><p className="campaign-hint">{unlockReason||'Your network is ready to expand toward the Sun.'}</p></div>
      <button className="primary" disabled={busy||!!unlockReason} onClick={()=>act(unlockMercury)}>Open Mercury expedition</button>
    </div>:<>
      <div className="solar-stock" aria-label="Mercury production and swarm">
        <div><span>MERCURY EQUIPMENT</span><strong>{n(p.equipmentT)} <small>t</small></strong><p>{n(incomingEquipment)} t inbound</p></div>
        <div><span>MIRRORS READY</span><strong data-testid="mirrors-ready">{n(s.mirrorsT)} <small>t</small></strong><p>{n(s.manufacturedT)} t manufactured</p></div>
        <div><span>DEPLOYED MIRRORS</span><strong data-testid="swarm-mass">{n(s.deployedT)} <small>t</small></strong><p>{n(s.deployments.reduce((sum,d)=>sum+d.massT,0))} t in transit</p></div>
        <div><span>SCENARIO MIRROR AREA</span><strong>{n(s.deployedT*SOLAR.areaKm2PerT)} <small>km²</small></strong><p>Assumed 10 g/m² of deployed mass</p></div>
      </div>
      <div className="solar-workspace"><div className="solar-visual"><SwarmDrawing world={world}/><p>The first pieces of a Dyson swarm. Area follows the scenario mass assumption; energy collection and power delivery are not simulated.</p></div>
        <div className="solar-builds">
          <article><p className="campaign-eyebrow">01 / MATERIAL SOURCE</p><h3>Mercury refinery</h3><p>{p.industry?'Installed · next cycle Day '+n(s.nextCycleDay??world.day):'Deliver 50 t construction material to commission the rotovator and install its refinery, plus at least 5 t equipment for the refinery.'}</p><p className="campaign-hint">Up to 2 t material/day using 0.1 t equipment/day. Local deposit: {n(s.depositT)} t remaining.</p><a href="#campaign-facility" onClick={()=>onSelect('mercury')}>Supply and build at Mercury ↗</a></article>
          <article><p className="campaign-eyebrow">02 / MIRROR PRODUCTION</p><h3>Mirror works</h3><p>Each daily cycle can turn 1 t construction material and 0.05 t equipment into 1 t mirrors.</p>{s.mirrorWorks?<p className="solar-state">{p.equipmentT<.15?'Supply equipment to keep the refinery and mirror works running.':'Installed · production runs with simulation time.'}</p>:<><button disabled={busy||!!workReason} onClick={()=>act(w=>buildSolar(w,'mirrorWorks'))}>Install mirror works</button><p className="campaign-hint">40 t construction + 10 t equipment at Mercury. {workReason}</p></>}</article>
          <article><p className="campaign-eyebrow">03 / HELIOCENTRIC DEPLOYMENT</p><h3>Mirror launch array</h3><p>Send mirror batches to a nominal {SOLAR.radiusAU} AU swarm orbit. Deployment takes {n(SOLAR.deploymentDays)} simulation days.</p>{!s.launchArray&&<><button disabled={busy||!!arrayReason} onClick={()=>act(w=>buildSolar(w,'launchArray'))}>Install mirror launch array</button><p className="campaign-hint">40 t construction + 10 t equipment at Mercury. {arrayReason}</p></>}
            {s.launchArray&&<><div className="solar-launch-actions"><button className="primary" disabled={busy||!!launch.reason} onClick={()=>act(w=>launchMirrors(w))}>Launch 10 t mirrors</button><button disabled={busy} onClick={()=>act(toggleMirrorLaunches)}>{s.autoLaunch?'Pause automatic launches':'Enable automatic launches'}</button></div><p className="campaign-hint">{launch.reason||'10 t per batch · 1 t support propellant. Mercury recovery and the shared traffic limit apply.'}</p><p>{s.autoLaunch?'Automatic · next attempt Day '+n(s.nextLaunchDay??world.day):'Automatic launches paused. Enable for a 10 t attempt every 10 days, with daily retries when blocked.'}</p></>}
          </article>
        </div>
      </div>
      <p className="solar-advice">Keep equipment moving: the refinery and mirror works together use up to <b>0.15 t/day</b>. An Earth → Mercury equipment service of <b>10 t every 60 days</b> can sustain them after the initial deliveries. Ship extra for construction; equipment takes months to arrive.</p>
      {s.deployments.length>0&&<details className="solar-deployments" open><summary>Mirror batches in transit · {s.deployments.length}</summary>{s.deployments.map(d=><div key={d.id}><span>Launch {d.id} · {d.massT} t</span><span>Deploys Day {n(d.arrival)} · {n(d.arrival-world.day)} days left</span><progress aria-label={'Mirror launch '+d.id+' progress'} value={world.day-d.departed} max={d.arrival-d.departed}/></div>)}</details>}
    </>}
    <ol className="solar-goals">{goals.map(g=><li key={g.name} className={g.done?'complete':''}><b>{g.done?'✓ ':''}{g.name}</b><p>{g.detail}</p></li>)}</ol>
    {goals.every(g=>g.done)&&<div className="campaign-achievement" role="status"><b>Your first solar swarm is established.</b><p>Keep the production chain supplied to expand beyond 10 km². Each new batch adds to your saved swarm.</p></div>}
    <p className="campaign-hint">Refining, mirror recipes, launch support and deployed area are game assumptions. Mirror composition is provisional, including the hematite concept. <a href="/lab/campaign/method/#mercury">Read the Mercury model and research.</a></p>
  </section>;
}
