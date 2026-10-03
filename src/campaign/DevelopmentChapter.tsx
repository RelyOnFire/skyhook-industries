import { useEffect, useState } from 'react';
import { automaticMirrorLaunchReason, automaticMirrorPlan, beltProduction, ceresReserveT, DEVELOPMENT, developmentProjects, developmentUnlockReason, mercuryReserveT, mirrorCapacity, setMirrorFuelReserve, SITE, upgradeDevelopment, type Campaign, type CargoKind, type SiteId } from './model.js';
import { n, projectSupplyNeed, type Act, type Prepare } from './Operations.js';
import './development.css';

type Project = ReturnType<typeof developmentProjects>[number];

function DevelopmentProject({project,world,busy,act,prepare}:{project:Project;world:Campaign;busy:boolean;act:Act;prepare:Prepare}) {
  const port=world.ports[project.site],complete=project.level>=project.maxLevel;
  const tract=project.id==='mercuryTract'||project.id==='ceresTract';
  const sources:SiteId[]=project.site==='ceres'?['phobos']:project.site==='phobos'?['moon','earth']:['moon','earth','phobos'];
  const sourceFor=(kind:CargoKind)=>{
    const stock=kind==='materials'?'materialsT':'equipmentT';
    return [...sources].filter(id=>world.ports[id].level>0).sort((a,b)=>world.ports[b][stock]-world.ports[a][stock])[0]??sources[0];
  };
  const materialSource=sourceFor('materials'),equipmentSource=sourceFor('equipment');
  const {inboundMaterial,inboundEquipment,materialShort,equipmentShort}=projectSupplyNeed(world,project);
  const inboundLabels=[inboundMaterial>0?n(inboundMaterial)+' t material':'',inboundEquipment>0?n(inboundEquipment)+' t equipment':''].filter(Boolean).join(' · ');
  const shortfallLabels=[materialShort>0?n(materialShort)+' t material':'',equipmentShort>0?n(equipmentShort)+' t equipment':''].filter(Boolean).join(' · ');
  const shipmentCapacity=(source:SiteId)=>world.ports[source].level>0&&port.level>0?10*Math.min(world.ports[source].level,port.level):10;
  const headingId='development-'+project.id+'-heading';
  const descriptionId='development-'+project.id+'-description';
  const costId='development-'+project.id+'-cost';
  const reason=project.reason.startsWith('Prepare ')?shortfallLabels?'Send the missing stock, then commission when it arrives.':'Waiting for inbound cargo.':project.reason||'Supplies ready at '+SITE[project.site].name+'.';
  const completedBenefit=project.id==='launch'?n(mirrorCapacity(world))+' t per mirror launch':project.id==='water'?n(beltProduction(world).waterCapacity)+' t water / day':project.id==='fuel'?n(beltProduction(world).fuelCapacity)+' t fuel / day':n(project.level)+' additional tracts opened';
  const productionLimited=project.id==='launch'&&automaticMirrorPlan(world).intervalDays>2/Math.max(1,world.ports.mercury.level)+1e-8;
  return <article className={'development-project'+(complete?' complete':'')} data-project={project.id} aria-labelledby={headingId}>
    <div className="development-project-title">
      <div><span>{SITE[project.site].name}</span><h3 id={headingId} tabIndex={-1}>{project.name}</h3></div>
      <span className="development-level" aria-label={(tract?'Additional tracts':'Upgrade level')+' '+project.level+' of '+project.maxLevel}>{complete?'Complete':(tract?'Tracts ':'Level ')+project.level+' / '+project.maxLevel}</span>
    </div>
    <p className="development-description">{project.description}</p>
    <p className="development-benefit">{complete?completedBenefit:project.benefit}</p>
    {productionLimited&&!complete&&<p className="development-description">Production currently sets the launch pace. Larger batches add room for future growth.</p>}
    {!complete&&<>
      <div className="development-cost" id={costId}>
        <span>Cost at {SITE[project.site].name}</span>
        <b>{n(project.materialsT)}&nbsp;t material <span>+</span> {n(project.equipmentT)}&nbsp;t equipment</b>
        <small>Stored: <span className={port.materialsT+1e-8<project.materialsT?'short':''}>{n(port.materialsT)}&nbsp;t material</span> · <span className={port.equipmentT+1e-8<project.equipmentT?'short':''}>{n(port.equipmentT)}&nbsp;t equipment</span></small>
      </div>
      {(inboundLabels||shortfallLabels)&&<p className="development-shortfall">
        {inboundLabels&&<>In flight: {inboundLabels}. </>}
        {shortfallLabels?<>Still to send: <b>{shortfallLabels}.</b></>:'Inbound cargo covers the current shortfall; wait for delivery.'}
      </p>}
      <div className="development-project-actions">
        <button className="primary" disabled={busy||!!project.reason} aria-label={tract?'Open next '+project.name.toLowerCase():undefined} aria-describedby={costId+' '+descriptionId} onClick={()=>act(w=>upgradeDevelopment(w,project.id))}>{tract?'Open next tract':'Upgrade '+project.name.toLowerCase()}</button>
        {materialShort>0&&<button className="development-supply" onClick={()=>prepare(materialSource,project.site,'materials',Math.min(materialShort,shipmentCapacity(materialSource)))} aria-label={'Prepare '+SITE[materialSource].name+' material for '+project.name.toLowerCase()}>Prepare {SITE[materialSource].name} material ↗</button>}
        {equipmentShort>0&&<button className="development-supply" onClick={()=>prepare(equipmentSource,project.site,'equipment',Math.min(equipmentShort,shipmentCapacity(equipmentSource)))} aria-label={'Prepare '+SITE[equipmentSource].name+' equipment for '+project.name.toLowerCase()}>Prepare {SITE[equipmentSource].name} equipment ↗</button>}
      </div>
      <p className={'development-reason'+(project.reason?' blocked':'')} id={descriptionId}>{reason}</p>
    </>}
  </article>;
}

export default function DevelopmentChapter({world,busy,act,prepare}:{world:Campaign;busy:boolean;act:Act;prepare:Prepare}) {
  const [reserve,setReserve]=useState(String(world.development.fuelReserveT));
  useEffect(()=>setReserve(String(world.development.fuelReserveT)),[world.id,world.development.fuelReserveT]);
  if(!world.belt.unlocked)return null;
  const unlock=developmentUnlockReason(world);
  const projects=developmentProjects(world),automatic=automaticMirrorPlan(world),production=beltProduction(world);
  const launchReason=automaticMirrorLaunchReason(world);
  const amount=Number(reserve),valid=reserve.trim()!==''&&Number.isInteger(amount)&&amount>=0&&amount<=1000000;
  const reserveChanged=valid&&amount!==world.development.fuelReserveT;
  return <section className="campaign-development" id="development-operations" aria-labelledby="development-heading">
    <header className="panel-title"><div><p className="campaign-eyebrow">CHAPTER 06 / INDUSTRIAL SCALE</p><h2 id="development-heading">Build the next scale</h2></div><a href="/lab/campaign/method/#development">Model ↗</a></header>
    {unlock?<div className="development-locked"><p>Turn the established network into a growing industrial system: larger mirror launches, more Belt output, and new mining tracts.</p><p>{unlock}</p></div>:<>
      <p className="development-intro">Choose where to invest your next shipment. Larger batches raise launch throughput; water and propellant upgrades sustain the supply chain.</p>
      <div className="development-capacities" aria-label="Current industrial capacities">
        <div><span>MIRROR BATCH</span><b data-testid="development-mirror-capacity">{n(automatic.massT)} <small>t</small></b><small>every {n(automatic.intervalDays)} days</small></div>
        <div><span>CERES WATER</span><b data-testid="development-water-capacity">{n(production.waterCapacity)} <small>t/day</small></b><small>{n(production.waterT)} t next cycle</small></div>
        <div><span>PHOBOS FUEL</span><b data-testid="development-fuel-capacity">{n(production.fuelCapacity)} <small>t/day</small></b><small>{n(production.fuelT)} t next cycle</small></div>
      </div>
      <div className="development-projects">
        {projects.filter(p=>p.id!=='mercuryTract'&&p.id!=='ceresTract').map(project=><DevelopmentProject key={project.id} project={project} world={world} busy={busy} act={act} prepare={prepare}/>)}
      </div>
      <form className="development-reserve" onSubmit={event=>{event.preventDefault();if(!busy&&reserveChanged)act(w=>setMirrorFuelReserve(w,amount));}}>
        <div className="development-reserve-heading"><h3>Keep cargo moving</h3><span>{n(world.fuelT)}&nbsp;t fuel available</span></div>
        <label htmlFor="mirror-fuel-reserve">Fuel protected for cargo <span>(t)</span></label>
        <div className="development-reserve-controls"><input id="mirror-fuel-reserve" name="mirror-fuel-reserve" type="number" min="0" max="1000000" step="1" value={reserve} onChange={event=>setReserve(event.target.value)} aria-describedby="mirror-fuel-reserve-help mirror-fuel-reserve-status"/><button disabled={busy||!reserveChanged} type="submit">Apply reserve</button></div>
        <p id="mirror-fuel-reserve-help">Automatic mirror launches wait before spending this reserve. Cargo and manual mirror launches may use it.</p>
        <p id="mirror-fuel-reserve-status" className={'development-reserve-status'+(world.solar.autoLaunch&&launchReason?' blocked':'')}>{n(world.development.fuelReserveT)} t protected · {!world.solar.autoLaunch?'Automatic launches paused.':launchReason||'Fuel available for the next automatic batch.'}</p>
      </form>
      <details className="development-tracts">
        <summary>Open more mining tracts <span>Finite deposits · {n(DEVELOPMENT.tractT)} t per tract</span></summary>
        <div className="development-deposits"><span>Mercury <b>{n(world.solar.depositT)} / {n(mercuryReserveT(world))} t remaining</b></span><span>Ceres <b>{n(world.belt.depositT)} / {n(ceresReserveT(world))} t remaining</b></span></div>
        {projects.filter(p=>p.id==='mercuryTract'||p.id==='ceresTract').map(project=><DevelopmentProject key={project.id} project={project} world={world} busy={busy} act={act} prepare={prepare}/>)}
      </details>
    </>}
  </section>;
}
