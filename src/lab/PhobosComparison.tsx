import { useEffect, useMemo, useRef } from 'react';
import { MARS, PHOBOS, type PhobosResult } from '../simulation/phobos.js';
import { exportPhobosComparison, phobosComparisonMetrics, phobosComparisonPaths, phobosDesignChanges, phobosFlightVerdict } from '../simulation/phobos-comparison.js';

const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
const delta=(n:number,d:number)=>{const rounded=Number(n.toFixed(d));return `${rounded>0?'+':rounded<0?'−':''}${fmt(Math.abs(rounded),d)}`;};
const input=(v:string|number)=>v==='zylon'?'Zylon HM':v==='kevlar'?'Kevlar 49':v==='inward'?'Inward':v==='outward'?'Outward':String(v);

export default function PhobosComparison({pinned,current,dirty,busy,onRestore,onClear}:{pinned:PhobosResult;current:PhobosResult;dirty:boolean;busy:boolean;onRestore:()=>void;onClear:()=>void}){
  const root=useRef<HTMLElement>(null);
  const paths=useMemo(()=>phobosComparisonPaths(pinned,current),[pinned,current]);
  const metrics=useMemo(()=>phobosComparisonMetrics(pinned,current),[pinned,current]);
  const changes=useMemo(()=>phobosDesignChanges(pinned.design,current.design),[pinned,current]);
  useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});root.current?.focus({preventScroll:true});},[pinned]);
  const scale=200/paths.extent,smallMars=MARS.radius*scale<20,xy=(s:number[])=>[240+s[0]*scale,240-s[1]*scale];
  const traces=useMemo(()=>(['pinned','current'] as const).flatMap(kind=>{
    const path=paths[kind];return path.length?[{kind,points:path.map(p=>xy(p.state).join(',')).join(' '),first:xy(path[0].state),last:xy(path.at(-1)!.state)}]:[];
  }),[paths]);
  const bar=10**Math.floor(Math.log10(paths.extent/3));
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(exportPhobosComparison(pinned,current),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='phobos-flight-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="lab-panel phobos-comparison" ref={root} tabIndex={-1} aria-label="Pinned flight comparison" data-draft={dirty}>
    <div className="panel-heading"><div><span className="micro">COMPARE FLIGHTS</span><h2>See what the reach changes.</h2></div><div className="phobos-comparison-actions"><button disabled={busy} onClick={onRestore}>Open pinned flight →</button><button onClick={download}>Export comparison ↗</button><button onClick={onClear}>Clear comparison</button></div></div>
    <p className="phobos-comparison-state" role="status">{busy?'Calculation in progress. Comparing the last accepted flights.':dirty?'You have unrun edits. Comparing the calculated flights below.':'Run another design or open an arm-study sample to compare it with your pin.'} The pin lasts for this page session.</p>
    <div className="phobos-comparison-body">
      <figure className="phobos-comparison-plot"><figcaption><strong>Two releases. One scale.</strong><span>Same Mars-centered inertial axes; Phobos starts at +X.</span></figcaption>
        <svg viewBox="0 0 480 480" role="img" aria-label="Pinned and current cargo paths on the same Mars-centered inertial scale. Circles mark release; diamonds mark each run’s end.">
          <line x1="30" y1="240" x2="450" y2="240" className="phobos-comparison-axis"/><line x1="240" y1="30" x2="240" y2="450" className="phobos-comparison-axis"/>
          <text x="450" y="229" textAnchor="end">X</text><text x="251" y="36">Y</text>
          <circle cx="240" cy="240" r={(MARS.radius+MARS.cutoff)*scale} className="phobos-comparison-cutoff"/>
          <circle cx="240" cy="240" r={MARS.radius*scale} className="phobos-comparison-mars"/>
          {smallMars&&<path d="M 248 248 L 264 270 h 20" fill="none" stroke="#59686d"/>}<text x={smallMars?288:240} y={smallMars?274:244} textAnchor={smallMars?'start':'middle'}>MARS</text>
          <circle cx="240" cy="240" r={PHOBOS.separation*scale} className="phobos-comparison-orbit"/>
          <circle cx={240+PHOBOS.separation*scale} cy="240" r="3" className="phobos-comparison-moon"/>
          {traces.map(({kind,points,first,last})=><g key={kind} data-flight={kind} className={`phobos-path-${kind}`}><polyline points={points} fill="none"/><circle cx={first[0]} cy={first[1]} r="4"/><path d={`M ${last[0]} ${last[1]-5} l 5 5 -5 5 -5 -5 Z`}/></g>)}
          <path d={`M 28 439 v 5 h ${bar*scale} v -5`} fill="none" stroke="#94a6ac"/><text x="28" y="462">{fmt(bar/1000)} km</text>
        </svg>
        <div className="phobos-path-key"><span><i className="phobos-pinned-line"/>Pinned</span><span><i className="phobos-current-line"/>Current</span><span>○ Release · ◇ Run end</span></div>
        <p>Faint ring: Phobos’ prescribed orbit. Paths stop at each flight’s actual end. {pinned.outcome==='structure-limit'?'Pinned: no cargo release. ':''}{current.outcome==='structure-limit'?'Current: no cargo release.':''}</p>
      </figure>
      <div className="phobos-comparison-data">
        <div className="phobos-comparison-flights">{([['pinned','Pinned',pinned],['current','Current',current]] as const).map(([kind,label,r])=><div key={kind} data-flight={kind}><span className="micro">{label} · {r.design.release}</span><strong>{fmt(r.design[r.design.release==='inward'?'inwardKm':'outwardKm'],3)} km</strong><span data-clear={r.outcome==='clear'}>{phobosFlightVerdict(r)}</span>{r.issues.length>0&&<p>{r.issues.join(' ')}</p>}</div>)}</div>
        <table><caption>Change = current − pinned, in each row’s units.</caption><thead><tr><th scope="col">Metric</th><th scope="col">Pinned</th><th scope="col">Current / change</th></tr></thead><tbody>{metrics.map(row=>{
          const value=(n:number|null,r:PhobosResult)=>n===null?row.id==='apoapsis'&&r.outcome!=='structure-limit'?'Unbound':'—':fmt(n,row.digits);
          return <tr key={row.id} data-metric={row.id}><th scope="row">{row.label}<small>{row.unit}</small></th><td>{value(row.pinned,pinned)}</td><td>{value(row.current,current)}<small className="phobos-comparison-delta">{row.delta===null?'—':delta(row.delta,row.digits)}</small></td></tr>;
        })}</tbody></table>
        <p className="phobos-comparison-note">Clearance covers each run’s displayed duration. Release elements do not predict a long-term orbit. Loads are static; work is an ideal positioning budget, including for blocked designs. Phobos’ orbit is held fixed. — means unavailable.</p>
      </div>
    </div>
    <div className="phobos-comparison-inputs">{changes.length?<details><summary>{changes.length} changed {changes.length===1?'input':'inputs'}</summary><dl>{changes.map(change=><div key={change.key}><dt>{change.label}</dt><dd>{input(change.pinned)} → {input(change.current)} {change.unit}</dd></div>)}</dl></details>:<p>Identical design inputs. Run a different design to compare its flight.</p>}</div>
  </section>;
}
