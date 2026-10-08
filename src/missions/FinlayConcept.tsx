import { useEffect, useId, useState } from 'react';
import './finlay-concept.css';

const stages = [
  { name: 'Survey', title: 'Meet the comet. Learn what it can bear.', text: 'Map the nucleus, measure its rotation and sample its material before designing the enclosure, anchors or thrust schedule.', focus: 'Shape · spin · cohesion · accessible ice' },
  { name: 'Enclose', title: 'Collect vapor. Carry loads through a harness.', text: 'A flexible enclosure surrounds the nucleus. A separate restraint mesh and load harness would secure the material and carry engine forces; the collection membrane is not the thrust structure.', focus: 'Vapor enclosure + separate load path' },
  { name: 'Extract', title: 'Turn accessible ice into a controlled feed.', text: 'Localized heat releases vapor. Dust filters, a cold trap and a water feed tank prepare a usable supply while most of the nucleus remains frozen.', focus: 'Vapor → filtration → cold trap → feed tank' },
  { name: 'Redirect', title: 'Heat the water. Direct the exhaust.', text: 'A supplied energy source heats the stored water for paired, steerable engines attached to the harness. Expelled vapor provides thrust; the required trajectory and plane change still need to be solved.', focus: 'Heater + engines · exhaust right, thrust left' },
  { name: 'Depot', title: 'Keep the water where spacecraft can reach it.', text: 'The intended destination is a stable, accessible depot orbit near Earth, the Moon or Mars. Store extracted water for visiting vehicles while retaining the remaining ice in the enclosure.', focus: 'Destination and capture maneuver to be determined' },
] as const;

const nucleus = 'M164 191 L194 145 L244 119 L288 128 L320 109 L355 139 L396 147 L423 184 L455 204 L446 248 L462 280 L434 317 L386 327 L356 356 L311 340 L275 359 L241 333 L203 326 L183 291 L156 264 L170 227 Z';
const enclosure = 'M122 180 C151 101 218 73 290 79 C365 64 444 104 482 165 C516 205 514 289 473 332 C428 386 351 403 281 389 C195 402 127 351 111 291 C91 248 99 208 122 180 Z';

export default function FinlayConcept() {
  const [stage, setStage] = useState(1);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const prefix = `finlay-${useId().replace(/:/g, '')}`;
  const id = (name: string) => `${prefix}-${name}`;
  const selected = stages[stage];
  const enclosed = stage >= 1, processing = stage >= 2, thrusting = stage === 3, depot = stage === 4;
  return <figure className="finlay-concept" data-phase={selected.name.toLowerCase()} aria-labelledby={id('heading')}>
    <div className="finlay-concept-top"><span>15P / FINLAY</span><span>System concept · not to scale</span></div>
    <div className="finlay-concept-picture">
      <svg viewBox="55 35 730 410" role="img" aria-labelledby={`${id('svg-title')} ${id('svg-desc')}`}>
        <title id={id('svg-title')}>{'Comet enclosure and water propulsion concept: ' + selected.name}</title>
        <desc id={id('svg-desc')}>An illustrative irregular nucleus sits inside a translucent vapor collection bag and a separate restraint harness. Piping leads to filtration, storage, a heater and two engines attached to the harness. {thrusting ? 'The engines expel vapor to the right, producing thrust to the left.' : depot ? 'A visiting vehicle approaches the water transfer port with engines off.' : 'Engines are off.'} The drawing does not represent a measured shape or trajectory for Finlay.</desc>
        <defs>
          <radialGradient id={id('rock')} cx="28%" cy="24%" r="85%"><stop stopColor="#89867e"/><stop offset=".48" stopColor="#484b4b"/><stop offset="1" stopColor="#171c1e"/></radialGradient>
          <radialGradient id={id('bag')} cx="27%" cy="24%" r="78%"><stop stopColor="#bbdce5" stopOpacity=".13"/><stop offset=".73" stopColor="#77979f" stopOpacity=".025"/><stop offset="1" stopColor="#94bac2" stopOpacity=".17"/></radialGradient>
          <linearGradient id={id('metal')} x2=".8" y2="1"><stop stopColor="#c8d1d0"/><stop offset=".5" stopColor="#6b7779"/><stop offset="1" stopColor="#343e42"/></linearGradient>
          <linearGradient id={id('plume')}><stop stopColor="#dcebef" stopOpacity=".9"/><stop offset=".25" stopColor="#9fc5d2" stopOpacity=".34"/><stop offset="1" stopColor="#8fbdcc" stopOpacity="0"/></linearGradient>
          <pattern id={id('mesh')} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path d="M0 0L32 32M32 0L0 32" stroke="#b9c5c5" strokeWidth=".7" opacity=".28"/></pattern>
          <clipPath id={id('nucleus')}><path d={nucleus}/></clipPath>
          <clipPath id={id('enclosure')}><path d={enclosure}/></clipPath>
          <marker id={id('arrow')} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L7 4L0 8" fill="none" stroke="#dfb18e" strokeWidth="1.3"/></marker>
        </defs>

        <g className="finlay-orientation" fill="none" stroke="#5f767e" strokeWidth="1" opacity=".35">
          <path d="M75 240H92M305 48V64M305 409V426"/><path d="M137 91A246 198 0 0 1 449 79M112 377A245 198 0 0 0 478 391" strokeDasharray="2 8"/>
        </g>
        <g className="finlay-nucleus">
          <path d={nucleus} fill={`url(#${id('rock')})`} stroke="#a9afa9" strokeOpacity=".5" strokeWidth="1.2"/>
          <g clipPath={`url(#${id('nucleus')})`}>
            <path d="M164 191L234 181L244 119L277 198L320 109L329 216L396 147L370 230L455 204L412 261L462 280L375 299L356 356L328 280L275 359L273 266L203 326L221 243L156 264Z" fill="#bac0b4" opacity=".12"/>
            <path d="M234 181L277 198L253 245L221 243ZM329 216L370 230L328 280L273 266L291 223ZM412 261L375 299L328 280L370 230Z" fill="#111719" opacity=".32"/>
            <path d="M184 183L222 170L240 178M268 149L272 181L258 199M333 151L348 180L338 198M390 194L413 209L413 231M185 272L210 284L226 278M285 306L305 294L319 305M378 289L401 280" fill="none" stroke="#c6c6b8" strokeOpacity=".25" strokeWidth="1.5"/>
            {Array.from({length: 90}, (_, i) => {
              const x = 169 + ((i * 61 + i * i * 7) % 285), y = 122 + ((i * 43 + i * i * 3) % 233), r = 1.2 + (i % 5) * .8;
              return <g key={i} opacity={.13 + (i % 4) * .035}><ellipse cx={x} cy={y} rx={r * 1.35} ry={r} fill="#0b1215"/><path d={`M${x-r} ${y-r*.3}q${r} ${-r} ${r*2} 0`} fill="none" stroke="#e6e2d2" strokeWidth=".7"/></g>;
            })}
          </g>
        </g>

        <g className="finlay-layer" opacity={enclosed ? 1 : .12}>
          <path d={enclosure} fill={`url(#${id('bag')})`} stroke="#a5c1ca" strokeOpacity=".65" strokeWidth="1.4"/>
          <path d={enclosure} fill={`url(#${id('mesh')})`} opacity=".72"/>
          <g clipPath={`url(#${id('enclosure')})`} fill="none" stroke="#9eb5be" strokeWidth="1" opacity=".38">
            <path d="M121 180Q298 31 482 165M105 255Q302 166 506 248M132 331Q306 276 479 330M270 74Q190 234 280 392M349 78Q428 228 361 391"/>
          </g>
          <g fill="none" stroke="#c8936c" strokeWidth="4" strokeLinejoin="round">
            <path d="M182 117Q137 240 182 356M374 91Q435 232 383 374M118 184Q295 147 482 174M121 308Q302 359 483 307"/>
            <path d="M432 167L525 157L577 180M435 320L525 332L577 314"/>
          </g>
          <g fill="#d8b08b" stroke="#292d2d" strokeWidth="2">{[[168,175],[165,321],[408,166],[410,325],[480,174],[481,309]].map(([x,y],i)=><rect key={i} x={x-5} y={y-5} width="10" height="10" rx="2"/>)}</g>
        </g>

        <g className="finlay-layer finlay-processing" opacity={processing ? 1 : .34}>
          <path d="M442 245C463 234 477 241 492 243L535 243L548 255H601" fill="none" stroke="#8bbacb" strokeWidth="4"/>
          <path d="M421 225Q459 196 480 223M430 275Q468 281 487 254" fill="none" stroke="#a9d6e2" strokeWidth="1.5" strokeDasharray="3 7" opacity={processing ? .6 : 0}/>
          <rect x="520" y="231" width="21" height="24" rx="3" fill="#1e2e34" stroke="#9ac8d4" strokeWidth="1.5"/>
          <path d="M525 234L537 252M525 243L532 253M530 233L537 241" stroke="#9ac8d4" strokeWidth="1"/>
          <rect x="555" y="235" width="28" height="40" rx="6" fill="#26383e" stroke="#9ac8d4" strokeWidth="1.5"/>
          <path d="M560 243H578M560 251H578M560 259H578M560 267H578" stroke="#85b4c5" strokeWidth="1"/>
          <rect x="601" y="230" width="34" height="51" rx="16" fill={`url(#${id('metal')})`} stroke="#b9d1d6" strokeWidth="1.4"/>
          <path d="M604 249H632M604 263H632" stroke="#394f58" strokeWidth="2"/>
          <path d="M635 255H652" stroke="#8bbacb" strokeWidth="4"/>
          <rect x="652" y="238" width="26" height="34" rx="4" fill="#40362e" stroke="#cf9a71" strokeWidth="1.6"/>
          <path d="M659 244L671 249L659 254L671 259L659 265" fill="none" stroke="#e2b385" strokeWidth="1.6"/>
          <path d="M665 238V198Q665 180 641 180H606M665 272V297Q665 314 641 314H606" fill="none" stroke="#d59d76" strokeWidth="3"/>
          <path d="M607 206V227M607 283V300" stroke="#71818a" strokeWidth="2"/>
        </g>

        <g className="finlay-layer" opacity={enclosed ? 1 : .2}>
          {[180, 314].map(y => <g key={y}>
            <path d={`M577 ${y-9}H592L600 ${y-16}H610V${y+16}H600L592 ${y+9}H577Z`} fill={`url(#${id('metal')})`} stroke="#bac8c9" strokeWidth="1.2"/>
            <path d={`M610 ${y-7}Q624 ${y-7} 637 ${y-18}V${y+18}Q624 ${y+7} 610 ${y+7}Z`} fill="#273439" stroke="#a4b6bd" strokeWidth="1.5"/>
            <path d={`M636 ${y-14}Q691 ${y-25} 759 ${y-37}V${y+37}Q691 ${y+25} 636 ${y+14}Z`} fill={`url(#${id('plume')})`} opacity={thrusting ? 1 : 0} className="finlay-layer"/>
            <path d={`M637 ${y-6}L731 ${y}L637 ${y+6}`} fill="#cde6ed" opacity={thrusting ? .34 : 0} className="finlay-layer"/>
          </g>)}
          <path d="M671 120H555" fill="none" stroke="#dfb18e" strokeWidth="2" markerEnd={`url(#${id('arrow')})`} opacity={thrusting ? 1 : 0} className="finlay-layer"/>
        </g>

        <g className="finlay-layer" opacity={stage === 0 ? 1 : 0}>
          <path d="M595 98L416 148M595 98L359 113M595 98L459 210" fill="none" stroke="#90c4d0" strokeWidth="1" strokeDasharray="3 7" opacity=".65"/>
          <g transform="translate(595 98) rotate(-22)"><path d="M-36 -8H-13V8H-36ZM13 -8H36V8H13Z" fill="#334b56" stroke="#88a7b5"/><rect x="-10" y="-12" width="20" height="24" rx="3" fill={`url(#${id('metal')})`}/><circle r="4" fill="#b7dce7"/></g>
        </g>
        <g className="finlay-layer" opacity={depot ? 1 : 0}>
          <path d="M618 282V351Q618 371 649 371H699" fill="none" stroke="#8bbacb" strokeWidth="3" strokeDasharray="5 5"/>
          <g transform="translate(711 371)"><rect x="-9" y="-14" width="32" height="28" rx="8" fill={`url(#${id('metal')})`} stroke="#b9cbd0"/><path d="M0 -14V-27H14V-14M0 14V27H14V14" fill="#293f4a" stroke="#8ba7b3"/><path d="M23 -5L34 -9V9L23 5" fill="#333c40" stroke="#84989e"/></g>
        </g>
      </svg>
      <div className="finlay-concept-key" aria-label="Diagram legend"><span><i className="finlay-key-bag"/>Collection membrane</span><span><i className="finlay-key-load"/>Load harness</span><span><i className="finlay-key-water"/>Water / vapor feed</span><span><i className="finlay-key-heat"/>Heated propellant</span></div>
      <p className="finlay-concept-shape">Illustrative nucleus; Finlay’s shape is not reconstructed here.</p>
    </div>
    <nav className="finlay-concept-stages" aria-label="Finlay mission concept stages">{stages.map((item, index) => <button key={item.name} type="button" disabled={!ready} aria-pressed={index === stage} aria-controls={id('caption')} onClick={() => setStage(index)}><span aria-hidden="true">0{index + 1}</span>{item.name}</button>)}</nav>
    <figcaption id={id('caption')} className="finlay-concept-caption" aria-live="polite" aria-atomic="true"><div><p className="finlay-concept-focus">{selected.focus}</p><h3 id={id('heading')}>{selected.title}</h3></div><p>{selected.text}</p></figcaption>
  </figure>;
}
