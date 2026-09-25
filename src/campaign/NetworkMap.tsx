import type { Campaign, SiteId } from './model.js';
import { ROUTES, SITE, SITES, swarmPower } from './model.js';
import { trafficItems, type TrafficId } from './traffic.js';

const POINTS = { earth:[460,290], moon:[595,130], phobos:[840,320], mercury:[180,420], ceres:[840,110] } as const;
const SWARM = [95,310] as const;
const number = (value:number) => value.toLocaleString('en-US',{maximumFractionDigits:1});
function OrbitalTether({site,cx,cy,radius,seconds,phase,commissioned=true}:{site:SiteId;cx:number;cy:number;radius:number;seconds:number;phase:number;commissioned?:boolean}) {
  return <g transform={`translate(${cx} ${cy})`} className="map-tether" data-site={site} aria-label={site==='phobos'?(commissioned?'Phobos and its anchored tethers orbit Mars':'Phobos orbits Mars'):SITE[site].facility+' in free orbit'}>
    <circle r={radius} className="map-tether-track"/>
    <g transform={`rotate(${phase})`}><g className="map-orbital-motion" style={{animationDuration:seconds+'s'}}>
      <g transform={`translate(0 ${-radius})`}>
        {site==='phobos'?<>
          {commissioned&&<path d="M0 -31V29" stroke={SITE.phobos.color} strokeWidth="2"/>}
          <path d="M-10 -6L3 -10 12 3 1 12-12 3Z" fill="#bfae98"/>
          <circle r="3" fill="#ffe0b7"/>
          {commissioned&&<><circle cy="-31" r="2.5" fill="#f1c08e"/><circle cy="29" r="2.5" fill="#f1c08e"/></>}
        </>:<g className="map-rotor-motion">
          <path d="M-22 0H22" stroke={SITE[site].color} strokeWidth="2"/>
          <circle r="3.5" fill={SITE[site].color}/>
          <circle cx="-22" r="2.5" fill="#f4d6ae"/><circle cx="22" r="2.5" fill="#f4d6ae"/>
        </g>}
      </g>
    </g></g>
  </g>;
}
export default function NetworkMap({world,selected,onSelect,tracked,onTrack,playing,route}:{world:Campaign|null;selected:SiteId;onSelect:(id:SiteId)=>void;tracked:TrafficId|null;onTrack?:(id:TrafficId|null)=>void;playing:boolean;route?:{from:SiteId;to:SiteId}}) {
  const swarmMass=world?.solar.deployedT||0,swarmCount=Math.min(80,Math.ceil(swarmMass/10));
  const shells=[0,1,...(swarmMass>=2000?[2]:[]),...(swarmMass>=10000?[3]:[]),...(swarmMass>=50000?[4]:[])];
  const visibleSites=SITES.filter(id=>id!=='ceres'||world?.solar.powerLink);
  const traffic=world?trafficItems(world):[],followed=traffic.find(f=>f.id===tracked),power=world?swarmPower(world):null;
  const destination=followed&&(followed.to==='swarm'?SWARM:POINTS[followed.to]);
  const complete=tracked!==null&&!followed;
  const detail=followed?`${followed.label} · ${followed.mass} t ${followed.cargo.toLowerCase()} · Day ${number(followed.arrival)}`:complete?(tracked.startsWith('mirror-')?'Mirrors are now part of the solar swarm.':'Cargo has reached its destination.'):route?'Planned corridor · prepare a shipment below':'Select an outpost to explore';
  return <div className={'network-map'+(playing?' running':'')+(followed?' following':'')}>
    <div className="map-heading"><div><p className="campaign-eyebrow">TRANSPORT NETWORK</p><h2>{world?.belt.unlocked?'Inner system & belt':'The inner system'}</h2></div><div className="map-readouts">{world?.solar.unlocked&&power&&<a className="map-power-readout" href="#swarm-power" aria-label={world.solar.powerLink?`${number(power.returnedGW)} GW returned to Mercury, ${number(power.multiplier)} times production capacity. View power loop.`:'Connect swarm power to Mercury'}><span>POWER TO MERCURY</span><strong data-testid="map-power">{number(power.returnedGW)} <small>GW</small></strong><span>{world.solar.powerLink?number(power.multiplier)+'× capacity':'Connect power'} <b>↗</b></span></a>}<span className="map-live"><i/>{playing?'LIVE':'STANDBY'}</span></div></div>
    <div className="map-visual">
    <svg key={world?.id??'preview'} viewBox="0 0 1000 550" role="group" aria-label="Transport network connecting Earth, the Moon and Phobos, with Mercury available through the solar swarm expedition and Ceres through Phobos. Orbital motion is illustrative and follows Play and Pause.">
      <defs>
        <radialGradient id="earth-light" cx="28%" cy="28%" r="75%"><stop stopColor="#93b9bf"/><stop offset=".42" stopColor="#426e7b"/><stop offset=".78" stopColor="#173540"/><stop offset="1" stopColor="#081218"/></radialGradient>
        <radialGradient id="mars-light" cx="25%" cy="25%" r="80%"><stop stopColor="#d0a285"/><stop offset=".45" stopColor="#845c49"/><stop offset=".8" stopColor="#392923"/><stop offset="1" stopColor="#100f11"/></radialGradient>
        <radialGradient id="moon-light" cx="28%" cy="28%" r="75%"><stop stopColor="#dedac9"/><stop offset=".6" stopColor="#8b908a"/><stop offset="1" stopColor="#292f30"/></radialGradient>
        <radialGradient id="mercury-light" cx="23%" cy="24%" r="80%"><stop stopColor="#baad94"/><stop offset=".6" stopColor="#766e61"/><stop offset="1" stopColor="#28292a"/></radialGradient>
        <radialGradient id="ceres-light" cx="23%" cy="24%" r="80%"><stop stopColor="#b9cecb"/><stop offset=".5" stopColor="#697e80"/><stop offset="1" stopColor="#202c30"/></radialGradient>
        <radialGradient id="map-sun" cx="40%" cy="35%"><stop stopColor="#fff6d8"/><stop offset=".6" stopColor="#efc38e"/><stop offset="1" stopColor="#c77b47"/></radialGradient>
        <radialGradient id="sun-halo"><stop stopColor="#e7ab64" stopOpacity=".2"/><stop offset=".35" stopColor="#c88343" stopOpacity=".08"/><stop offset="1" stopColor="#c88343" stopOpacity="0"/></radialGradient>
        <radialGradient id="earth-halo"><stop offset=".55" stopColor="#83c4d9" stopOpacity=".14"/><stop offset="1" stopColor="#83c4d9" stopOpacity="0"/></radialGradient>
        <linearGradient id="earth-shade"><stop stopColor="#06121b" stopOpacity="0"/><stop offset=".55" stopColor="#06121b" stopOpacity=".1"/><stop offset="1" stopColor="#04090d" stopOpacity=".9"/></linearGradient>
        <clipPath id="earth-disc"><circle cx="460" cy="290" r="56"/></clipPath>
      </defs>
      <g aria-hidden="true">{Array.from({length:80},(_,i)=><circle key={i} cx={(i*137.508)%1000} cy={(i*i*31.7+23)%550} r={i%7===0?1.1:.6} fill="#bfd0d8" opacity={i%3===0?.45:.2}/>)}</g>
      <circle cx="95" cy="215" r="200" fill="url(#sun-halo)"/>
      <circle cx="460" cy="290" r="100" fill="url(#earth-halo)"/>
      <path d="M-180 495C-110-120 905-155 1140 362 M-160 590C-130-280 1190-235 1230 480" className="map-orbit"/>
      <ellipse cx="460" cy="290" rx="212" ry="155" transform="rotate(-27 460 290)" className="map-orbit"/>
      <ellipse cx="95" cy="215" rx="140" ry="217" transform="rotate(-24 95 215)" className="map-orbit"/>
      {ROUTES.filter(r=>(r.b!=='mercury'||world?.solar.unlocked)&&(r.b!=='ceres'||world?.belt.unlocked)).map(r=><line key={r.id} x1={POINTS[r.a][0]} y1={POINTS[r.a][1]} x2={POINTS[r.b][0]} y2={POINTS[r.b][1]} className={route&&((route.from===r.a&&route.to===r.b)||(route.from===r.b&&route.to===r.a))?'map-route route-planned':'map-route'}/>)}
      {followed&&destination&&<line x1={POINTS[followed.from][0]} y1={POINTS[followed.from][1]} x2={destination[0]} y2={destination[1]} className={'map-tracked-route '+followed.kind}/>}
      <g className="map-swarm" aria-label="Solar swarm, schematic mirror batches" transform="translate(95 215)">
        {shells.map(ring=><g key={ring} data-shell={ring} transform="scale(.75 1)">
          {swarmCount>0&&<circle r={78+ring*22} className="map-swarm-track"/>}
          <g className="map-swarm-motion" style={{animationDuration:(34+ring*14)+'s'}}>
            {Array.from({length:ring<2?Math.ceil((swarmCount-ring)/2):Math.min(24,Math.ceil(12*swarmMass/[1,1,2000,10000,50000][ring]))},(_,i)=>{const angle=i*2.399963+ring,r=78+ring*22,x=Math.cos(angle)*r,y=Math.sin(angle)*r;return <rect key={i} x={x-3} y={y-1.5} width="6" height="3" fill="#efc995" transform={`rotate(${angle*180/Math.PI} ${x} ${y})`}/>;})}
          </g>
        </g>)}
      </g>
      {world?.solar.powerLink&&<g className="map-power-link"><path className="map-power-conduit" d="M111 274Q119 342 174 391"/><path className="map-power-flow" d="M111 274Q119 342 174 391"/><text x="101" y="335">POWER RETURN</text></g>}
      <circle cx="95" cy="215" r="35" fill="url(#map-sun)"/><text x="95" y="271" textAnchor="middle" className="map-body-label">SOL</text>
      <g opacity={world?.solar.unlocked?1:.5}><circle cx="180" cy="420" r="25" fill="url(#mercury-light)"/><circle cx="172" cy="412" r="5" fill="#5f594f" opacity=".45"/><circle cx="185" cy="428" r="3" fill="#454339" opacity=".35"/></g>
      <circle cx="460" cy="290" r="56" fill="url(#earth-light)" stroke="#79afbd" strokeOpacity=".45"/>
      <g clipPath="url(#earth-disc)" fill="#a2b8a2" opacity=".6"><path d="M408 267l15-24 26-11 14 7-7 10-15 2 6 9-6 14-12 3-3 10-8-5zM434 287l14 1 7 10 17 8-4 15-10 8-4 15-8 3-4-19-9-15zM479 246l18-4 11 15-9 12-19-3-8 12-9-6 3-11zM480 276l13-4 12 12-1 21-11 20-8-7 1-17-12-10z"/></g>
      <circle cx="460" cy="290" r="56" fill="url(#earth-shade)"/>
      <circle cx="595" cy="130" r="24" fill="url(#moon-light)"/><circle cx="587" cy="123" r="6" fill="#616964" opacity=".4"/><circle cx="602" cy="137" r="4" fill="#555e5b" opacity=".3"/>
      {world?.solar.powerLink&&<g opacity={world.belt.unlocked?1:.5}><circle cx="840" cy="110" r="25" fill="url(#ceres-light)"/><circle cx="831" cy="102" r="6" fill="#39494b" opacity=".4"/><circle cx="847" cy="119" r="4" fill="#dbe8df" opacity=".3"/></g>}
      <circle cx="855" cy="403" r="50" fill="url(#mars-light)"/><path d="M825 386q25-10 48 18l-12 8-29-12z" fill="#533f34" opacity=".25"/><text x="913" y="438" className="map-body-label">MARS</text>
      {(!world||world.ports.earth.level>0)&&<OrbitalTether site="earth" cx={460} cy={290} radius={86} seconds={30} phase={-30}/>}
      {!!world?.ports.moon.level&&<OrbitalTether site="moon" cx={595} cy={130} radius={50} seconds={38} phase={-24}/>}
      <OrbitalTether site="phobos" cx={855} cy={403} radius={88} seconds={42} phase={-10} commissioned={!!world?.ports.phobos.level}/>
      {!!world?.ports.mercury.level&&<OrbitalTether site="mercury" cx={180} cy={420} radius={54} seconds={26} phase={-30}/>}
      {!!world?.ports.ceres.level&&<OrbitalTether site="ceres" cx={840} cy={110} radius={50} seconds={50} phase={24}/>}
      {world&&([{id:'launch',name:'Mirror array',level:world.development.launchLevel,x:219,y:453},{id:'water',name:'Water works',level:world.development.waterLevel,x:885,y:119},{id:'fuel',name:'Fuel works',level:world.development.fuelLevel,x:915,y:353}]).filter(item=>item.level>0).map(item=><g key={item.id} className="map-infrastructure" transform={`translate(${item.x} ${item.y})`} role="img" aria-label={item.name+' at '+2**item.level+' times base capacity'}><path d="M-3 12H35"/>{Array.from({length:item.level},(_,i)=><rect key={i} x={i*11} y={8-i*3} width="7" height={4+i*3} rx="1"/>)}<text y="25">{2**item.level}× {item.name.toUpperCase()}</text></g>)}
      {visibleSites.map(id=><g key={id} role="button" tabIndex={0} aria-label={'Locate '+SITE[id].name} aria-pressed={selected===id} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}><rect x={POINTS[id][0]-75} y={POINTS[id][1]-75} width="150" height={id==='phobos'?260:150} fill="transparent"/><circle cx={id==='phobos'?855:POINTS[id][0]} cy={id==='phobos'?403:POINTS[id][1]} r={id==='phobos'?112:id==='earth'?69:36} className={selected===id?'map-selected':'map-ring'} stroke={SITE[id].color}/><text x={POINTS[id][0]} y={id==='moon'||id==='ceres'?30:id==='mercury'?516:POINTS[id][1]+(id==='earth'?114:-68)} textAnchor="middle" className="map-label">{SITE[id].name.toUpperCase()}</text><text x={POINTS[id][0]} y={id==='moon'||id==='ceres'?47:id==='mercury'?535:POINTS[id][1]+(id==='earth'?134:-49)} textAnchor="middle" className="map-site-state">{id==='ceres'&&!world?.belt.unlocked?'CHAPTER 05':id==='mercury'&&!world?.solar.unlocked?'CHAPTER 03':world?.ports[id].level?'TIER '+world.ports[id].level+' / '+SITE[id].facility.toUpperCase():'AWAITING CONSTRUCTION'}</text></g>)}
    </svg>
    <svg key={'traffic-'+(world?.id??'preview')} className="map-traffic-layer" viewBox="0 0 1000 550" aria-hidden="true">
      {world&&[...traffic.filter(f=>f.id!==tracked),...(followed?[followed]:[])].map(f=>{const t=Math.min(1,Math.max(0,(world.day-f.departed)/(f.arrival-f.departed))),a=POINTS[f.from],b=f.to==='swarm'?SWARM:POINTS[f.to],angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;return <g key={f.id} className={'map-flight '+f.kind+(tracked===f.id?' tracked':'')} data-traffic-id={f.id} style={{transform:`translate(${a[0]+(b[0]-a[0])*t}px,${a[1]+(b[1]-a[1])*t}px)`}}>
        {tracked===f.id&&<circle r="14" className="map-flight-halo"/>}<path transform={`rotate(${angle})`} d={f.kind==='mirrors'?'M0-5L7 0 0 5-7 0Z':f.kind==='water'?'M8 0Q0-8-5-4Q-11 0-5 4Q0 8 8 0Z':f.kind==='equipment'?'M7 0L-1-5-6-3-6 3-1 5Z':'M8 0L-6-5-3 0-6 5Z'}/><title>{f.label+': '+f.mass+' t '+f.cargo.toLowerCase()+' to '+f.toName}</title>
      </g>;})}
    </svg>
    </div>
    <div className={'map-inspector'+(tracked?' tracking':'')} id="flight-inspector" role="region" aria-label={tracked?'Tracked flight':'Planned route'} tabIndex={-1}>
      <div className="map-inspector-detail"><b>{followed?<>{followed.fromName} <span>→</span> {followed.toName}</>:complete?(tracked.startsWith('mirror-')?'Deployment complete':'Delivery complete'):route?<>{SITE[route.from].name} <span>→</span> {SITE[route.to].name}</>:'Your transport network'}</b><p title={detail}>{detail}</p></div>
      {followed&&world&&<div className="map-eta"><strong>{number(followed.arrival-world.day)}<small> d</small></strong><span>TO ARRIVAL</span></div>}
      {tracked&&<button className="map-stop-tracking" aria-label="Stop tracking" title="Stop tracking" onClick={()=>onTrack?.(null)}>×</button>}
    </div>
    <div className="map-key" aria-label="Map legend"><span><i className="cargo-swatch materials"/>Materials</span><span><i className="cargo-swatch equipment"/>Equipment</span><span><i className="cargo-swatch mirrors"/>Mirrors</span>{world?.belt.unlocked&&<span><i className="cargo-swatch water"/>Water</span>}<span>Illustrative · not to scale</span></div>
  </div>;
}

export function FacilityDrawing({site}:{site:SiteId}) {
  return <svg className="facility-drawing" viewBox="0 0 330 138" role="img" aria-label={site==='phobos'?'Phobos at the central anchor, one tether toward Mars and one extending away.':site==='moon'?'A rotating lunavator in free orbit above the Moon; no surface anchor.':'A rotating tether in free orbit above '+SITE[site].name+'; no surface anchor.'}>
    <path d="M-25 151Q155 56 355 151" fill={site==='moon'?'#23282a':'#1d2a2f'} stroke="#506067"/>
    {site==='phobos'?<><path d="M170 8L170 116" stroke="#efa477" strokeWidth="2"/><path d="M161 50l14-3 8 12-12 12-16-9z" fill="#b19f8e"/><text x="192" y="62">PHOBOS / ANCHOR</text><text x="190" y="19">OUTWARD</text><text x="189" y="110">TOWARD MARS</text></>:<><path d="M126 99L201 24" stroke={SITE[site].color} strokeWidth="2"/><circle cx="163.5" cy="61.5" r="5" fill={SITE[site].color}/><circle cx="126" cy="99" r="3" fill="#efa477"/><path d="M135 40A34 34 0 0 1 190 37" fill="none" stroke="#60737a" strokeDasharray="3 4"/><path d="M187 31l4 8-9-1" fill="none" stroke="#60737a"/><text x="219" y="66">FREE ORBIT</text></>}
    <text x="12" y="128">{site==='phobos'?'MARS':site.toUpperCase()}</text>
  </svg>;
}
