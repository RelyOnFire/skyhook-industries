import { useId } from 'react';
import { STORY, captureDetail, storyFrame, storyPath } from '../components/flight-story-motion.js';

/** Lightweight, deterministic fallback for the optional departure camera. */
export default function DepartureDiagram({stage,progress}:{stage:number;progress:number}) {
  const id=useId(),f=storyFrame(stage,progress),detail=captureDetail(progress),opening=Math.min(1,progress/.12);
  const jawAngle=stage===1?detail.jawAngle:stage===2?0:stage===3?36*opening*opening*(3-2*opening):36;
  return <svg viewBox="0 0 1000 620" role="img" aria-label="Illustrated Earth tether departure">
    <defs><radialGradient id={id}><stop stopColor="#2d5a70"/><stop offset="1" stopColor="#081a26"/></radialGradient></defs>
    <g transform={stage===1?`translate(${detail.x} ${detail.y}) scale(${detail.scale})`:undefined}>
      <circle cx={STORY.earth.x} cy={STORY.earth.y} r={STORY.orbit} fill="none" stroke="#7e9ba7" strokeWidth="1" strokeDasharray="4 8" opacity=".35"/>
      <circle cx={STORY.earth.x} cy={STORY.earth.y} r={STORY.atmosphere} fill="none" stroke="#80bad6" strokeWidth="10" opacity=".14"/>
      <circle cx={STORY.earth.x} cy={STORY.earth.y} r={STORY.radius} fill={`url(#${id})`}/>
      <path d={storyPath(stage)} fill="none" stroke="#efa477" strokeWidth="2" strokeDasharray="3 7" opacity=".5"/>
      <g transform={`translate(${f.hub.x} ${f.hub.y}) rotate(${f.angle*180/Math.PI})`}>
        <path d={`M0 ${-STORY.arm}V${STORY.arm}`} stroke="#d7e5ea" strokeWidth="3"/>
        <rect x="-9" y="-9" width="18" height="18" rx="3" fill="#142b39" stroke="#efa477" strokeWidth="2"/>
        <circle cy={-STORY.arm} r="6" fill="#d7e5ea"/>
      </g>
      {f.payload&&<g transform={`translate(${f.payload.x} ${f.payload.y}) rotate(${(stage===3?STORY.releaseTime:f.angle)*180/Math.PI})`}>
        <rect x="-7" y="13" width="14" height="20" rx="2" fill="#a27553" stroke="#f0c6a4"/>
        <path d="M0 0V13" stroke="#efa477" strokeWidth="3"/><circle r="7" fill="#efa477"/>
      </g>}
      <g transform={`translate(${f.tip.x} ${f.tip.y}) rotate(${f.angle*180/Math.PI})`} fill="none" stroke="#d7e5ea" strokeWidth="2.5" strokeLinecap="round">
        <path d="M0 0L-3 13L0 27L9 31" transform={`translate(-14 -18) rotate(${jawAngle})`}/>
        <path d="M0 0L3 13L0 27L-9 31" transform={`translate(14 -18) rotate(${-jawAngle})`}/>
        {(stage===2||stage===1&&detail.locked)&&<path d="M-5 13H5" stroke="#a1d5cf"/>}
      </g>
    </g>
  </svg>;
}
