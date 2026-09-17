import type { Campaign, SiteId } from './model.js';
import { SITE, SITES } from './model.js';

const POINTS = { earth:[220,200], moon:[340,100], phobos:[710,240] } as const;
export default function NetworkMap({world,selected,onSelect,tracked,playing}:{world:Campaign|null;selected:SiteId;onSelect:(id:SiteId)=>void;tracked:number|null;playing:boolean}) {
  return <div className={playing?"network-map running":"network-map"}>
    <div className="map-heading"><span>INNER SYSTEM / TRANSPORT NETWORK</span><span>SCHEMATIC · NOT TO SCALE</span></div>
    <svg viewBox="0 0 900 390" role="img" aria-label="Transport network: Earth and its Moon connected by the cislunar corridor; Earth and the Moon both connect directly to Phobos in the Mars system.">
      <defs><radialGradient id="earth-light"><stop stopColor="#a0c1c2"/><stop offset=".5" stopColor="#375965"/><stop offset="1" stopColor="#142c34"/></radialGradient><radialGradient id="mars-light"><stop stopColor="#bf8f76"/><stop offset=".6" stopColor="#684c41"/><stop offset="1" stopColor="#201b1b"/></radialGradient><pattern id="map-dots" width="47" height="43" patternUnits="userSpaceOnUse"><circle cx="6" cy="9" r=".65" fill="#71848c" opacity=".35"/></pattern></defs>
      <rect width="900" height="390" fill="url(#map-dots)"/>
      <path d="M-180 650 A750 750 0 0 1 1060 450" className="map-orbit"/>
      <path d="M-170 760 A1050 1050 0 0 1 1090 175" className="map-orbit"/>
      <ellipse cx="220" cy="200" rx="162" ry="116" className="map-orbit"/>
      <ellipse cx="700" cy="275" rx="82" ry="48" className="map-orbit"/>
      <path d="M220 200 L340 100 M220 200 L710 240 M340 100 L710 240" className="map-route"/>
      <text x="466" y="126" className="map-route-label">LUNAR–PHOBOS</text><text x="360" y="250" className="map-route-label">MARS TRANSFER CORRIDOR</text>
      <circle cx="220" cy="200" r="36" fill="url(#earth-light)"/>
      <path d="M205 174l15 7 3 12 15 8-7 10-14-6-10-15zM227 213l9 5-7 12-6-7z" fill="#839893" opacity=".65"/>
      <circle cx="340" cy="100" r="15" fill="#a4a59e"/><circle cx="337" cy="95" r="4" fill="#787d7a"/><circle cx="346" cy="103" r="3" fill="#777d79"/>
      <circle cx="700" cy="292" r="37" fill="url(#mars-light)"/>
      <text x="745" y="322" className="map-body-label">MARS</text>
      <path d="M703 233l11-1 6 8-8 8-12-6z" fill="#beafa0"/>
      <path d="M704 215L719 269" stroke="#efa477" strokeWidth="2"/>
      <path d="M326 79l29 16" stroke="#d7d1bf" strokeWidth="2"/>
      <path d="M191 152l25 15" stroke="#8ebbc6" strokeWidth="2"/>
      {SITES.map(id=><g key={id}><circle cx={POINTS[id][0]} cy={POINTS[id][1]} r={id==='earth'?47:29} className={selected===id?'map-selected':'map-ring'} stroke={SITE[id].color}/><text x={POINTS[id][0]} y={POINTS[id][1]+(id==='earth'?68:-43)} textAnchor="middle" className="map-label">{SITE[id].name.toUpperCase()}</text></g>)}
      {world?.flights.map(f=>{const t=Math.min(1,Math.max(0,(world.day-f.departed)/(f.arrival-f.departed))),a=POINTS[f.from],b=POINTS[f.to];return <g key={f.id} className={tracked===f.id?"map-flight tracked":"map-flight"}><circle cx={a[0]+(b[0]-a[0])*t} cy={a[1]+(b[1]-a[1])*t} r={tracked===f.id?9:5} fill={tracked===f.id?"#fff1cf":"#efa477"} stroke="#080b0d" strokeWidth="2"/><title>{`Flight ${f.id}: ${f.cargoT} t to ${SITE[f.to].name}`}</title></g>;})}
      <text x="36" y="362" className="map-route-label">SOLAR INDUSTRY / MERCURY — FUTURE CHAPTER</text>
    </svg>
    <div className="map-site-buttons" aria-label="Select a destination">{SITES.map(id=><button key={id} aria-pressed={selected===id} onClick={()=>onSelect(id)}><i style={{background:SITE[id].color}}/><span>{SITE[id].name}<small>{world?.ports[id].level?`Tier ${world.ports[id].level} · ${world.ports[id].materialsT.toLocaleString("en-US",{maximumFractionDigits:1})} t in depot`:'Awaiting construction'}</small></span><span aria-hidden="true">↗</span></button>)}</div>
  </div>;
}

export function FacilityDrawing({site}:{site:SiteId}) {
  return <svg className="facility-drawing" viewBox="0 0 330 138" role="img" aria-label={site==='phobos'?'Phobos at the central anchor, one tether toward Mars and one extending away.':site==='moon'?'A rotating lunavator in free orbit above the Moon; no surface anchor.':'A rotating tether in free orbit above Earth; no surface anchor.'}>
    <path d="M-25 151Q155 56 355 151" fill={site==='moon'?'#23282a':'#1d2a2f'} stroke="#506067"/>
    {site==='phobos'?<><path d="M170 8L170 116" stroke="#efa477" strokeWidth="2"/><path d="M161 50l14-3 8 12-12 12-16-9z" fill="#b19f8e"/><text x="192" y="62">PHOBOS / ANCHOR</text><text x="190" y="19">OUTWARD</text><text x="189" y="110">TOWARD MARS</text></>:<><path d="M126 99L201 24" stroke={SITE[site].color} strokeWidth="2"/><circle cx="163.5" cy="61.5" r="5" fill={SITE[site].color}/><circle cx="126" cy="99" r="3" fill="#efa477"/><path d="M135 40A34 34 0 0 1 190 37" fill="none" stroke="#60737a" strokeDasharray="3 4"/><path d="M187 31l4 8-9-1" fill="none" stroke="#60737a"/><text x="219" y="66">FREE ORBIT</text></>}
    <text x="12" y="128">{site==='phobos'?'MARS':site.toUpperCase()}</text>
  </svg>;
}
