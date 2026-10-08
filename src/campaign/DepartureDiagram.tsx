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
        <path d="M-39 1.4L-30 10L-26 1.4Z" fill="#526974"/>
        <path d="M-42-.6Q-32 4-8 3Q18 3 44 0Q20-2-12-2L-42-.6Z" fill="#718894"/>
        <path d="M-40-1L-31-4L-8-2L-8-.5Z" fill="#293e49"/>
        <path d="M18-.3L-39-.7" stroke="#bccbd2" strokeWidth=".6"/>
        <path d="M6 2.7Q11 4.5 18 3.3L25 1.6Q16 2.2 6 2.7Z" fill="#14374a" stroke="#9baeb8" strokeWidth=".3"/>
        <path d="M-3 3V6M3 3V6" stroke="#bacad2" strokeWidth=".8"/><rect x="-4" y="5.5" width="8" height="1.2" fill="#b88764"/>
        {f.powered&&<path d="M-40-2.5L-56-1.5L-40-.5Z" fill="#efb486" opacity=".7"/>}
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
