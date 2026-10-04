import { useId } from 'react';
import { LAUNCH, earthLaunchFrame, launchPath } from './earth-launch-motion.js';

/** The same aircraft, handoff and release remain usable without WebGL. */
export default function DepartureDiagram({stage,progress}:{stage:number;progress:number}) {
  const id=useId(),f=earthLaunchFrame(stage,progress),s=1000/f.camera.width;
  const hardwareScale=stage<2?1:Math.max(1,(f.camera.width-130)/1000*3.6);
  const degrees=(angle:number)=>angle*180/Math.PI;
  const path=launchPath(stage===3?'cargo':'aircraft').map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
  return <svg viewBox="0 0 1000 620" role="img" aria-label="Hypersonic aircraft carrying cargo to an Earth tether, then returning as the tether lifts and releases the cargo">
    <defs><radialGradient id={id}><stop stopColor="#315b70"/><stop offset="1" stopColor="#0e2634"/></radialGradient></defs>
    <g transform={`matrix(${s} 0 0 ${-s} ${500-f.camera.center.x*s} ${310+f.camera.center.y*s})`}>
      <circle r={LAUNCH.radius} fill={`url(#${id})`}/>
      <circle r={LAUNCH.radius+80} fill="none" stroke="#7bbbd5" opacity=".25" vectorEffect="non-scaling-stroke"/>
      <circle r={LAUNCH.radius+LAUNCH.hubAltitude} fill="none" stroke="#7e9ba7" opacity=".25" strokeDasharray="4 8" vectorEffect="non-scaling-stroke"/>
      {(stage<2||stage===3)&&<path d={path} fill="none" stroke={stage===3?'#efa477':'#83b8ce'} opacity=".4" vectorEffect="non-scaling-stroke"/>}
      <g transform={`translate(${f.hub.x} ${f.hub.y}) rotate(${degrees(f.angle)})`}>
        <path d={`M0 ${-LAUNCH.arm}V${LAUNCH.arm}`} stroke="#d7e5ea" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        <rect x="-9" y="-9" width="18" height="18" fill="#263744" stroke="#efa477" vectorEffect="non-scaling-stroke"/>
        <circle cy={LAUNCH.arm} r="6" fill="#d7e5ea"/>
      </g>
      {f.aircraftVisible&&<g transform={`translate(${f.aircraft.x} ${f.aircraft.y}) rotate(${degrees(f.aircraftAngle)})`} data-aircraft="visible">
        <path d="M7 0L-24 13L-17 0L-24-13Z" fill="#314653"/>
        <path d="M-30-3L-26 4L13 4L39 0L-26-4Z" fill="#b7cbd3"/>
        <path d="M-27 2L-25 12L-13 2Z" fill="#7d98a6"/>
        <path d="M7 4Q15 9 20 3" fill="#263744"/>
        <rect x="-4" y="3.8" width="8" height="3" fill="#d69a70"/>
        {f.powered&&<path d="M-28-5L-55-3L-28-1Z" fill="#efb486" opacity=".7"/>}
      </g>}
      <g transform={`translate(${f.payload.x} ${f.payload.y}) rotate(${degrees(f.payloadAngle)}) scale(${hardwareScale})`}>
        <rect x="-2" y="-9" width="4" height="5.5" fill="#a27553" stroke="#f0c6a4" strokeWidth=".3"/>
        <path d="M0 0V-4" stroke="#d7e5ea" strokeWidth=".7"/><circle r="1.8" fill="none" stroke="#efa477" strokeWidth=".6"/>
      </g>
      <g transform={`translate(${f.tip.x} ${f.tip.y}) rotate(${degrees(f.angle)}) scale(${hardwareScale})`} fill="none" stroke="#d7e5ea" strokeWidth=".7" strokeLinecap="round">
        <path d="M0 0L-.75-3.25L0-6.75L2.25-7.75" transform={`translate(-3.5 4.5) rotate(${-f.jawAngle})`}/>
        <path d="M0 0L.75-3.25L0-6.75L-2.25-7.75" transform={`translate(3.5 4.5) rotate(${f.jawAngle})`}/>
        {f.latched&&<path d="M-1.5-3.25H1.5" stroke="#a1d5cf"/>}
      </g>
    </g>
  </svg>;
}
