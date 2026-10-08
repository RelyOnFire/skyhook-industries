import {useEffect,useState} from 'react';
import {FINLAY_ASSUMPTIONS,FINLAY_DEFAULTS,FINLAY_NODES,FINLAY_ORBIT,estimateFinlay,finlayOrbitPoint,type FinlayInputs} from './finlay-model';
import './finlay-workbench.css';

const number=(value:number,digits=2)=>value.toLocaleString('en-US',{maximumFractionDigits:digits});
const mass=(kg:number)=>kg>=1e12?number(kg/1e12)+' billion t':kg>=1e9?number(kg/1e9)+' million t':kg>=1e6?number(kg/1e6)+' thousand t':number(kg/1000)+' t';
const force=(newtons:number)=>newtons>=1e6?number(newtons/1e6)+' MN':number(newtons/1000)+' kN';
const year=(years:number)=>years<1?number(years*365.25,1)+' days':number(years,1)+' years';
const orbitPath=Array.from({length:241},(_,i)=>{const p=finlayOrbitPoint(i/240*Math.PI*2);return (i?'L':'M')+numberPath(p.x,p.y);}).join(' ');
function numberPath(x:number,y:number){return (440+x*61).toFixed(3)+' '+(177-y*61).toFixed(3);}

export default function FinlayWorkbench(){
 const [ready,setReady]=useState(false),[inputs,setInputs]=useState<FinlayInputs>({...FINLAY_DEFAULTS}),[location,setLocation]=useState<'near'|'far'>('far'),[otherDeltaV,setOtherDeltaV]=useState(0);
 useEffect(()=>setReady(true),[]);
 const node=FINLAY_NODES[location],deltaV=node.planeChangeKmS+otherDeltaV;
 const result=estimateFinlay({...inputs,deltaVKmS:deltaV}),spent=result.consumedWaterKg/result.massKg*100,water=result.remainingWaterKg/result.massKg*100,dry=(result.massKg-result.availableWaterKg)/result.massKg*100;
 const update=(key:keyof FinlayInputs,value:number)=>setInputs(current=>({...current,[key]:value}));
 const reset=()=>{setInputs({...FINLAY_DEFAULTS});setLocation('far');setOtherDeltaV(0);};
 return <div className="finlay-workbench" data-feasible={String(result.feasible)} data-elapsed-years={result.elapsedYears??''} data-delta-v={deltaV} data-required-propellant={result.requiredPropellantKg}>
  <div className="finlay-orbit">
   <div><p className="finlay-kicker">01 / CHOOSE WHERE TO TURN</p><h3>Same plane change.<br/>A different price.</h3><p>A velocity change turns the orbit at a node, where Finlay crosses the ecliptic. The far node needs less impulse—but sunlight is weaker there.</p></div>
   <figure><svg viewBox="0 0 590 340" role="img" aria-label="Finlay's frozen orbit projected onto the ecliptic, with near and far plane-change nodes">
    <defs><radialGradient id="finlay-sun"><stop stopColor="#ffdaa0"/><stop offset="1" stopColor="#d49a62"/></radialGradient></defs>
    <path d="M45 177H550" stroke="#253a46" strokeDasharray="3 7"/>
    <circle cx="440" cy="177" r="61" fill="none" stroke="#657e88" strokeWidth="1" strokeDasharray="3 5"/>
    <circle cx="440" cy="177" r={1.523679*61} fill="none" stroke="#657e88" strokeWidth="1" opacity=".35"/>
    <path d={orbitPath} fill="none" stroke="#bc906c" strokeWidth="2"/>
    <circle cx="440" cy="177" r="8" fill="url(#finlay-sun)"/><text x="440" y="203" textAnchor="middle">Sun</text>
    {(['near','far'] as const).map(key=>{const n=FINLAY_NODES[key],x=440+n.positionAU.x*61,y=177-n.positionAU.y*61,selected=location===key;return <g key={key}>
     {selected&&<circle cx={x} cy={y} r="12" fill="none" stroke="#efad7b" strokeWidth="1.5"/>}
     <circle cx={x} cy={y} r="4" fill={selected?'#efad7b':'#8499a3'}/>
     <text x={x} y={y+(key==='far'?29:-21)} textAnchor="middle" className={selected?'selected':''}>{key==='far'?'Far node':'Near node'}</text>
    </g>;})}
    <text x="465" y="104">Earth orbit</text><text x="365" y="64">Mars orbit</text>
   </svg><figcaption>Frozen JPL orbit · ecliptic projection · body positions and a transfer route are not shown.</figcaption></figure>
  </div>
  <div className="finlay-budget-grid">
   <fieldset disabled={!ready} className="finlay-inputs">
    <legend>Explore the mission budget</legend>
    <label>Plane-change location<select aria-label="Plane-change location" value={location} onChange={e=>setLocation(e.target.value as 'near'|'far')}><option value="far">{'Far node · '+number(FINLAY_NODES.far.radiusAU)+' AU'}</option><option value="near">{'Near node · '+number(FINLAY_NODES.near.radiusAU)+' AU'}</option></select></label>
    <p className="finlay-field-note">{number(node.planeChangeKmS)} km/s for the ideal plane change. Sunlight is {number(100/node.radiusAU**2,1)}% of its intensity at 1 AU.</p>
    <label>Other manoeuvres (km/s)<input aria-label="Other manoeuvres (km/s)" type="number" min="0" max="10" step=".1" value={otherDeltaV} onChange={e=>setOtherDeltaV(Math.max(0,Math.min(10,Number(e.target.value)||0)))}/></label>
    <p className="finlay-field-note">Your allowance for orbit reshaping and arrival. Zero leaves those manoeuvres out; this study does not calculate them.</p>
    <label>Usable plant power (GW)<select aria-label="Usable plant power (GW)" value={inputs.powerGW} onChange={e=>update('powerGW',Number(e.target.value))}>{[.1,1,10,100,1000].map(p=><option key={p} value={p}>{number(p)+' GW'}</option>)}</select></label>
    <p className="finlay-field-note">Power delivered to extraction and propulsion at the comet. Collector area and power transmission are not sized.</p>
    <label className="finlay-range">Exhaust speed (km/s)<output>{number(inputs.exhaustKmS,1)} km/s</output><input aria-label="Exhaust speed (km/s)" type="range" min=".5" max="10" step=".1" value={inputs.exhaustKmS} onChange={e=>update('exhaustKmS',Number(e.target.value))}/></label>
    <p className="finlay-field-note">An assumed effective exhaust speed. Higher settings require a different heater, temperature or propulsion technology; they are not demonstrated steam-engine ratings.</p>
    <label className="finlay-range">Water allocation (%)<output>{number(inputs.waterFraction*100,0)}%</output><input aria-label="Water allocation (%)" type="range" min="5" max="90" step="1" value={inputs.waterFraction*100} onChange={e=>update('waterFraction',Number(e.target.value)/100)}/></label>
    <details><summary>Nucleus assumptions</summary><label>Nucleus radius (km)<input aria-label="Nucleus radius (km)" type="number" min=".2" max="1.5" step=".01" value={inputs.radiusKm} onChange={e=>update('radiusKm',Math.max(.2,Math.min(1.5,Number(e.target.value)||.2)))}/></label><label>Bulk density (kg/m³)<input aria-label="Bulk density (kg/m³)" type="number" min="200" max="1000" step="50" value={inputs.densityKgM3} onChange={e=>update('densityKgM3',Math.max(200,Math.min(1000,Number(e.target.value)||200)))}/></label><p>The 0.9 km radius and assumed 500 kg/m³ density follow the adopted model in Ye et al. (2015). Water allocation is your assumption, not a measured Finlay inventory.</p></details>
    <button type="button" onClick={reset}>Reset study</button>
   </fieldset>
   <section className="finlay-results" aria-label="Mission budget results">
    <p className="finlay-kicker">02 / SPEND WATER TO MOVE WATER</p>
    <p className="finlay-outcome" role="status">{result.feasible?'Within the assumed water allocation':'Requested Δv exceeds the water allocation'}</p>
    <div className="finlay-main-result"><span>Water retained after the budgeted burn</span><strong>{mass(result.remainingWaterKg)}</strong><p>{result.feasible?'An ideal remaining inventory before storage losses, depot operations and any unbudgeted manoeuvres.':'All allocated water would be exhausted before reaching the requested velocity change.'}</p></div>
    <div className="finlay-mass-bar" role="img" aria-label={'Initial nucleus: '+mass(result.massKg)+'. Water used '+mass(result.consumedWaterKg)+', water retained '+mass(result.remainingWaterKg)+', other material '+mass(result.massKg-result.availableWaterKg)+'.'}>
     <span className="spent" style={{width:spent+'%'}}/><span className="retained" style={{width:water+'%'}}/><span className="dry" style={{width:dry+'%'}}/>
    </div>
    <div className="finlay-mass-key"><span><i className="spent"/>Water used</span><span><i className="retained"/>Water retained</span><span><i className="dry"/>Other material</span></div>
    <dl className="finlay-result-list">
     <div><dt>Total budgeted Δv</dt><dd>{number(deltaV)} km/s</dd></div>
     <div><dt>Required propellant</dt><dd>{mass(result.requiredPropellantKg)}</dd></div>
     <div><dt>Initial nucleus mass</dt><dd>{mass(result.massKg)}</dd></div>
     <div><dt>Thrust while operating</dt><dd>{force(result.thrustN)}</dd></div>
     <div><dt>Propellant flow while operating</dt><dd>{number(result.massFlowKgS)} kg/s</dd></div>
     <div><dt>Ideal operating time</dt><dd>{result.operatingSeconds===null?'Insufficient water':year(result.operatingSeconds/FINLAY_ASSUMPTIONS.secondsPerYear)}</dd></div>
     <div className="finlay-time"><dt>Time at 70% duty cycle</dt><dd>{result.elapsedYears===null?'Unavailable':year(result.elapsedYears)}</dd></div>
    </dl>
    {!result.feasible&&<p className="finlay-shortfall">Shortfall: <strong>{mass(result.waterShortfallKg)}</strong>. The allocated water supplies at most <strong>{number(result.maxDeltaVKmS)} km/s</strong> under these assumptions.</p>}
    <p className="finlay-limit">This is a mass-and-energy budget. The plane change is an instantaneous node benchmark; a long burn requires a separate low-thrust trajectory. These times exclude rendezvous, coast, orbital capture and commissioning the depot.</p>
    <details className="finlay-equations"><summary>What the calculation includes</summary><p>The ideal rocket equation accounts for expelled water: Δv = vₑ ln(m₀/m₁). Plant power supplies {number(FINLAY_ASSUMPTIONS.extractionJPerKg/1e6)} MJ per kilogram for extraction, plus jet energy at {number(FINLAY_ASSUMPTIONS.jetEfficiency*100,0)}% conversion efficiency. Thrust = mass flow × exhaust speed. Extraction and propulsion share the same power budget.</p><p>The plane change rotates transverse velocity through {number(FINLAY_ORBIT.inclinationDeg)}° at an actual ecliptic node; radial velocity is preserved. The calculation uses a frozen two-body orbit, not a propagated mission. It excludes dry spacecraft/enclosure mass, natural mass loss, spin control, thermal storage and gravity losses.</p></details>
   </section>
  </div>
 </div>;
}
