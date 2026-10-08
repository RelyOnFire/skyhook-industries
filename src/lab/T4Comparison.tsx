import { useEffect, useMemo, useRef } from 'react';
import { EARTH } from '../simulation/engine.js';
import type { T4Result } from '../simulation/t4.js';
import { exportT4Comparison, t4ComparisonMetrics, t4ComparisonPaths, t4DesignChanges, t4FlightVerdict } from '../simulation/t4-comparison.js';
import { shownUnit, shownValue, type StudioUnits } from './StudioUnits.js';

const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
const delta=(n:number,d:number)=>{const rounded=Number(n.toFixed(d));return `${rounded>0?'+':rounded<0?'−':''}${fmt(Math.abs(rounded),d)}`;};
const input=(value:string|number)=>value==='zylon'?'Zylon HM':value==='kevlar'?'Kevlar 49':String(value);

export default function T4Comparison({pinned,current,dirty,busy,units,onRestore,onClear}:{pinned:T4Result;current:T4Result;dirty:boolean;busy:boolean;units:StudioUnits;onRestore:()=>void;onClear:()=>void}){
  const root=useRef<HTMLElement>(null);
  const paths=useMemo(()=>t4ComparisonPaths(pinned,current),[pinned,current]);
  const metrics=useMemo(()=>t4ComparisonMetrics(pinned,current),[pinned,current]);
  const changes=useMemo(()=>t4DesignChanges(pinned.design,current.design),[pinned,current]);
  useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});root.current?.focus({preventScroll:true});},[pinned]);
  const scale=200/paths.extent,xy=(s:number[])=>[240+s[0]*scale,240-s[1]*scale];
  const traces=useMemo(()=>(['pinned','current'] as const).flatMap(kind=>{
    const path=paths[kind];return path.length?[{kind,points:path.map(p=>xy(p.state).join(',')).join(' '),first:xy(path[0].state),last:xy(path.at(-1)!.state)}]:[];
  }),[paths]);
  const bar=10**Math.floor(Math.log10(paths.extent/3));
  const changedValue=(value:string|number,unit:string)=>typeof value==='number'?String(shownValue(value,unit,units)):input(value);
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(exportT4Comparison(pinned,current),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='t4-flight-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="lab-panel t4-comparison" ref={root} tabIndex={-1} aria-label="Pinned flight comparison" data-draft={dirty}>
    <div className="panel-heading"><div><span className="micro">COMPARE FLIGHTS</span><h2>See what changed.</h2></div><div className="t4-comparison-actions"><button disabled={busy} onClick={onRestore}>Open pinned flight →</button><button onClick={download}>Export comparison ↗</button><button onClick={onClear}>Clear comparison</button></div></div>
    <p className="t4-comparison-state" role="status">{busy?'Calculation in progress. Comparing the last accepted flights.':dirty?'You have unrun edits. Comparing the calculated flights below.':'Pin a flight, then run another design or open a study sample.'} The pin lasts for this page session.</p>
    <div className="t4-comparison-body">
      <figure className="t4-comparison-plot"><figcaption><strong>Where the cargo goes</strong><span>Same Earth-centered axes and scale.</span></figcaption>
        <svg viewBox="0 0 480 480" role="img" aria-label="Pinned and current cargo paths on the same Earth-centered scale. Circles mark release; diamonds mark each run’s end.">
          <line x1="30" y1="240" x2="450" y2="240" className="t4-comparison-axis"/><line x1="240" y1="30" x2="240" y2="450" className="t4-comparison-axis"/>
          <text x="450" y="229" textAnchor="end">X</text><text x="251" y="36">Y</text>
          <circle cx="240" cy="240" r={EARTH*scale} className="t4-comparison-earth"/><text x="240" y="244" textAnchor="middle">EARTH</text>
          {traces.map(({kind,points,first,last})=><g key={kind} data-flight={kind} className={`t4-path-${kind}`}><polyline points={points} fill="none"/><circle cx={first[0]} cy={first[1]} r="4"/><path d={`M ${last[0]} ${last[1]-5} l 5 5 -5 5 -5 -5 Z`}/></g>)}
          <path d={`M 28 439 v 5 h ${bar*scale} v -5`} fill="none" stroke="#94a6ac"/><text x="28" y="462">{fmt(shownValue(bar,'m',units))} {units.distance}</text>
        </svg>
        <div className="t4-path-key"><span><i className="t4-pinned-line"/>Pinned</span><span><i className="t4-current-line"/>Current</span><span>○ Release · ◇ Run end</span></div>
        <p>Paths stop at each flight’s actual end. {!pinned.release?'Pinned: no cargo release. ':''}{!current.release?'Current: no cargo release.':''}</p>
      </figure>
      <div className="t4-comparison-data">
        <div className="t4-comparison-flights">{([['pinned','Pinned',pinned],['current','Current',current]] as const).map(([kind,label,r])=><div key={kind} data-flight={kind}><span className="micro">{label}</span><strong>{fmt(r.design.phaseDeg,2)}° · {fmt(r.design.releaseMin,3)} min</strong><span data-pass={t4FlightVerdict(r)==='Target reached'}>{t4FlightVerdict(r)}</span></div>)}</div>
        <table><caption>Change = current − pinned, in each row’s units.</caption><thead><tr><th scope="col">Metric</th><th scope="col">Pinned</th><th scope="col">Current / change</th></tr></thead><tbody>{metrics.map(row=>{
          const digits=row.unit==='km'&&units.distance==='m'?0:row.digits;
          const value=(n:number|null,r:T4Result)=>n===null?row.id==='apoapsis'&&r.release?'Escape':'—':fmt(shownValue(n,row.unit,units),digits);
          return <tr key={row.id} data-metric={row.id}><th scope="row">{row.label}<small>{shownUnit(row.unit,units)}</small></th><td>{value(row.pinned,pinned)}</td><td>{value(row.current,current)}<small className="t4-comparison-delta">{row.delta===null?'—':delta(shownValue(row.delta,row.unit,units),digits)}</small></td></tr>;
        })}</tbody></table>
        <p className="t4-comparison-note">Loads and clearance cover each flight’s displayed duration. Read the outcome and duration alongside load changes. — means unavailable.</p>
      </div>
    </div>
    <div className="t4-comparison-inputs">{changes.length?<details><summary>{changes.length} changed {changes.length===1?'input':'inputs'}</summary><dl>{changes.map(change=><div key={change.key}><dt>{change.label}</dt><dd>{changedValue(change.pinned,change.unit)} → {changedValue(change.current,change.unit)} {shownUnit(change.unit,units)}</dd></div>)}</dl></details>:<p>Identical design inputs. Run a different design to compare its flight.</p>}</div>
  </section>;
}
