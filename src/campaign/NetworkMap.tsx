import type { Campaign, SiteId } from './model.js';
import { ROUTES, SITE, SITES } from './model.js';

const POINTS = { earth:[460,290], moon:[595,130], phobos:[840,320], mercury:[180,420] } as const;
export default function NetworkMap({world,selected,onSelect,tracked,playing,route}:{world:Campaign|null;selected:SiteId;onSelect:(id:SiteId)=>void;tracked:number|null;playing:boolean;route?:{from:SiteId;to:SiteId}}) {
  return <div className={playing?'network-map running':'network-map'}>
    <div className="map-heading"><div><p className="campaign-eyebrow">TRANSPORT NETWORK</p><h2>The inner system</h2></div><span className="map-live"><i/>{playing?'LIVE':'STANDBY'}</span></div>
    <svg viewBox="0 0 1000 550" role="group" aria-label="Transport network connecting Earth, the Moon and Phobos, with Mercury routes available through the solar swarm expedition.">
      <defs>
        <radialGradient id="earth-light" cx="28%" cy="28%" r="75%"><stop stopColor="#93b9bf"/><stop offset=".42" stopColor="#426e7b"/><stop offset=".78" stopColor="#173540"/><stop offset="1" stopColor="#081218"/></radialGradient>
        <radialGradient id="mars-light" cx="25%" cy="25%" r="80%"><stop stopColor="#d0a285"/><stop offset=".45" stopColor="#845c49"/><stop offset=".8" stopColor="#392923"/><stop offset="1" stopColor="#100f11"/></radialGradient>
        <radialGradient id="moon-light" cx="28%" cy="28%" r="75%"><stop stopColor="#dedac9"/><stop offset=".6" stopColor="#8b908a"/><stop offset="1" stopColor="#292f30"/></radialGradient>
        <radialGradient id="mercury-light" cx="23%" cy="24%" r="80%"><stop stopColor="#baad94"/><stop offset=".6" stopColor="#766e61"/><stop offset="1" stopColor="#28292a"/></radialGradient>
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
      <ellipse cx="850" cy="390" rx="103" ry="71" transform="rotate(-20 850 390)" className="map-orbit"/>
      {ROUTES.filter(r=>r.b!=='mercury'||world?.solar.unlocked).map(r=><line key={r.id} x1={POINTS[r.a][0]} y1={POINTS[r.a][1]} x2={POINTS[r.b][0]} y2={POINTS[r.b][1]} className={route&&((route.from===r.a&&route.to===r.b)||(route.from===r.b&&route.to===r.a))?'map-route route-planned':'map-route'}/>)}
      <g className="map-swarm" aria-label={'Solar swarm: '+(world?.solar.deployedT||0)+' tonnes deployed'}>{Array.from({length:Math.min(60,Math.ceil((world?.solar.deployedT||0)/10))},(_,i)=>{const a=i*2.399963,x=95+Math.cos(a)*(i%2?72:58),y=215+Math.sin(a)*(i%2?100:78);return <rect key={i} x={x-2} y={y-2} width="4" height="4" fill="#efc995" transform={`rotate(${i*37} ${x} ${y})`}/>;})}</g>
      <circle cx="95" cy="215" r="35" fill="url(#map-sun)"/><text x="95" y="271" textAnchor="middle" className="map-body-label">SOL</text>
      <g opacity={world?.solar.unlocked?1:.5}><circle cx="180" cy="420" r="25" fill="url(#mercury-light)"/><circle cx="172" cy="412" r="5" fill="#5f594f" opacity=".45"/><circle cx="185" cy="428" r="3" fill="#454339" opacity=".35"/></g>
      <circle cx="460" cy="290" r="56" fill="url(#earth-light)" stroke="#79afbd" strokeOpacity=".45"/>
      <g clipPath="url(#earth-disc)" fill="#a2b8a2" opacity=".6"><path d="M408 267l15-24 26-11 14 7-7 10-15 2 6 9-6 14-12 3-3 10-8-5zM434 287l14 1 7 10 17 8-4 15-10 8-4 15-8 3-4-19-9-15zM479 246l18-4 11 15-9 12-19-3-8 12-9-6 3-11zM480 276l13-4 12 12-1 21-11 20-8-7 1-17-12-10z"/></g>
      <circle cx="460" cy="290" r="56" fill="url(#earth-shade)"/>
      <circle cx="595" cy="130" r="24" fill="url(#moon-light)"/><circle cx="587" cy="123" r="6" fill="#616964" opacity=".4"/><circle cx="602" cy="137" r="4" fill="#555e5b" opacity=".3"/>
      <circle cx="855" cy="403" r="50" fill="url(#mars-light)"/><path d="M825 386q25-10 48 18l-12 8-29-12z" fill="#533f34" opacity=".25"/><text x="913" y="438" className="map-body-label">MARS</text>
      <path d="M831 312l12-3 10 12-12 10-13-8z" fill="#bfae98"/>
      <path d="M827 278L850 351" stroke="#efa477" strokeWidth="2"/>
      <circle cx="840" cy="320" r="3" fill="#ffe0b7"/>
      <path d="M555 83l44 20" stroke="#d7d1bf" strokeWidth="2"/><circle cx="577" cy="93" r="3" fill="#f4e8ca"/>
      <path d="M394 204l45 23" stroke="#9fced9" strokeWidth="2"/><circle cx="416.5" cy="215.5" r="3" fill="#ceeaf0"/>
      {!!world?.ports.mercury.level&&<path d="M135 373l36 17" stroke="#c6b69a" strokeWidth="2"/>}
      {SITES.map(id=><g key={id} role="button" tabIndex={0} aria-label={'Locate '+SITE[id].name} aria-pressed={selected===id} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}><rect x={POINTS[id][0]-75} y={POINTS[id][1]-75} width="150" height="150" fill="transparent"/><circle cx={POINTS[id][0]} cy={POINTS[id][1]} r={id==='earth'?69:36} className={selected===id?'map-selected':'map-ring'} stroke={SITE[id].color}/><text x={POINTS[id][0]} y={POINTS[id][1]+(id==='earth'?94:-54)} textAnchor="middle" className="map-label">{SITE[id].name.toUpperCase()}</text><text x={POINTS[id][0]} y={POINTS[id][1]+(id==='earth'?114:-35)} textAnchor="middle" className="map-site-state">{id==='mercury'&&!world?.solar.unlocked?'CHAPTER 03':world?.ports[id].level?'TIER '+world.ports[id].level+' / '+SITE[id].facility.toUpperCase():'AWAITING CONSTRUCTION'}</text></g>)}
      {world?.flights.map(f=>{const t=Math.min(1,Math.max(0,(world.day-f.departed)/(f.arrival-f.departed))),a=POINTS[f.from],b=POINTS[f.to];return <g key={f.id} className={tracked===f.id?'map-flight tracked':'map-flight'}><circle cx={a[0]+(b[0]-a[0])*t} cy={a[1]+(b[1]-a[1])*t} r={tracked===f.id?9:5} fill={tracked===f.id?'#fff1cf':'#efa477'} stroke="#080b0d" strokeWidth="2"/><title>{'Flight '+f.id+': '+f.cargoT+' t to '+SITE[f.to].name}</title></g>;})}
      {world?.solar.deployments.map(d=>{const t=Math.min(1,Math.max(0,(world.day-d.departed)/(d.arrival-d.departed)));return <g key={d.id} className="map-flight"><circle cx={180-85*t} cy={420-110*t} r="4" fill="#ffe9af"/><title>{'Mirror launch '+d.id+': '+d.massT+' t toward the swarm'}</title></g>;})}
    </svg>
    <div className="map-caption"><span>{route?<><i/> {SITE[route.from].name} <b>→</b> {SITE[route.to].name}</>:'Select an outpost to explore'}</span><span>Schematic · not to scale</span></div>
  </div>;
}

export function FacilityDrawing({site}:{site:SiteId}) {
  return <svg className="facility-drawing" viewBox="0 0 330 138" role="img" aria-label={site==='phobos'?'Phobos at the central anchor, one tether toward Mars and one extending away.':site==='moon'?'A rotating lunavator in free orbit above the Moon; no surface anchor.':'A rotating tether in free orbit above '+SITE[site].name+'; no surface anchor.'}>
    <path d="M-25 151Q155 56 355 151" fill={site==='moon'?'#23282a':'#1d2a2f'} stroke="#506067"/>
    {site==='phobos'?<><path d="M170 8L170 116" stroke="#efa477" strokeWidth="2"/><path d="M161 50l14-3 8 12-12 12-16-9z" fill="#b19f8e"/><text x="192" y="62">PHOBOS / ANCHOR</text><text x="190" y="19">OUTWARD</text><text x="189" y="110">TOWARD MARS</text></>:<><path d="M126 99L201 24" stroke={SITE[site].color} strokeWidth="2"/><circle cx="163.5" cy="61.5" r="5" fill={SITE[site].color}/><circle cx="126" cy="99" r="3" fill="#efa477"/><path d="M135 40A34 34 0 0 1 190 37" fill="none" stroke="#60737a" strokeDasharray="3 4"/><path d="M187 31l4 8-9-1" fill="none" stroke="#60737a"/><text x="219" y="66">FREE ORBIT</text></>}
    <text x="12" y="128">{site==='phobos'?'MARS':site.toUpperCase()}</text>
  </svg>;
}
