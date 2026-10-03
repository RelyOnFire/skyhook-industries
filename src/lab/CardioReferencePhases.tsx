import {useMemo} from 'react';
import {compareCardioReferencePhases} from '../simulation/cardio-reference-release.js';
import type {CardioReferenceDesign} from '../simulation/cardio-reference.js';

const labels={'below-cutoff':'Below cutoff','crosses-cutoff':'Crosses cutoff',bound:'Earth-bound',escape:'Earth escape'};
const symbols={'below-cutoff':'×','crosses-cutoff':'! ',bound:'○',escape:'↗'};

export default function CardioReferencePhases({design,disabled,selected,onSelect}:{
  design:CardioReferenceDesign|null;disabled:boolean;selected:number|null;onSelect:(fraction:number)=>void;
}){
  const comparison=useMemo(()=>design?compareCardioReferencePhases(design):null,[design]);
  const download=()=>{
    if(disabled||!comparison)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(comparison,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='cardio-reference-phases.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <details className="cardio-reference-phases" data-testid="cardio-reference-phases">
    <summary>Compare release phases</summary>
    {comparison&&!disabled?<>
      <p>Sample the same geometry every 5% of its orbit. Select a phase to open its 30-minute particle trace. Zero and 100% are apogee; 50% is perigee.</p>
      <div className="cardio-reference-phase-grid" role="group" aria-label="Sampled reference release phases">
        {comparison.samples.map(sample=><button key={sample.fraction} type="button" className={`phase-${sample.outcome}`} aria-pressed={selected===sample.fraction}
          aria-label={`Trace at ${Math.round(sample.fraction*100)}%: ${labels[sample.outcome]}`} onClick={()=>onSelect(sample.fraction)}>
          <span aria-hidden="true">{symbols[sample.outcome]}</span><span>{Math.round(sample.fraction*100)}%</span>
        </button>)}
      </div>
      <div className="cardio-reference-phase-legend">{Object.entries(labels).map(([key,label])=><span key={key} className={`phase-${key}`}><b aria-hidden="true">{symbols[key as keyof typeof symbols]}</b>{label}</span>)}</div>
      <p>These are individual ideal-particle outcomes. Gaps between samples are untested; this does not establish a safe release window or qualify the tether.</p>
      <button className="cardio-reference-phase-export" onClick={download}>Export phase comparison</button>
    </>:<p>Enter valid reference geometry to compare releases.</p>}
  </details>;
}
