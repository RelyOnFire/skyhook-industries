import {LUNAR_BRAKE,LUNAR_LAUNCH,LUNAR_RAIL,lunarEase,lunarLaunchFrame,lunarLaunchPath} from './lunar-launch-motion.js';
const path=(points:{x:number;y:number}[])=>points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
export default function LunarDepartureDiagram({stage,progress}:{stage:number;progress:number}){
 const f=lunarLaunchFrame(stage,progress),s=1000/f.camera.width,railAngle=Math.atan2(LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x)*180/Math.PI;
 const size=.025*f.hardwareScale,loadingLift=stage===0?.35*(1-lunarEase(progress)):0;
 return <svg viewBox="0 0 1000 620" role="img" aria-label="Lunar mass driver launches cargo to a moving tether, which captures, swings and releases it.">
  <defs><radialGradient id="lunar-launch-shade"><stop stopColor="#67757d"/><stop offset="1" stopColor="#242f38"/></radialGradient></defs>
  <rect width="1000" height="620" fill="#070d13"/>
  <g transform={`translate(500 310) scale(${s} ${-s}) translate(${-f.camera.center.x} ${-f.camera.center.y})`}>
   <circle r={LUNAR_LAUNCH.radius} fill="url(#lunar-launch-shade)"/>
   <circle r={LUNAR_LAUNCH.radius+LUNAR_LAUNCH.hubAltitude} fill="none" stroke="#668c9c" strokeWidth={.8/s} strokeDasharray={`${4/s} ${6/s}`}/>
   {stage<4&&<path d={path(lunarLaunchPath('approach'))} fill="none" stroke="#7fabbc" strokeWidth={1/s} opacity=".35"/>}
   {stage===5&&<path d={path(lunarLaunchPath('release'))} fill="none" stroke="#d5a175" strokeWidth={1/s} opacity=".4"/>}
   <g transform={`translate(${LUNAR_RAIL.start.x} ${LUNAR_RAIL.start.y}) rotate(${railAngle})`}>
    <path d={`M-.4 -.3H${LUNAR_RAIL.length+1.2}`} stroke="#a6b9c4" strokeWidth=".09"/>
    {Array.from({length:25},(_,i)=><path key={i} d={`M${.65+i/24*(LUNAR_RAIL.length-1.3)} -.5v.075m0 .85v.075`} strokeWidth=".065" stroke={stage===1&&Math.abs((.65+i/24*(LUNAR_RAIL.length-1.3))/LUNAR_RAIL.length-f.railProgress**2)<.07?'#f1bc88':'#637986'}/>)}
    <path d={`M${LUNAR_RAIL.length} -.3h${LUNAR_BRAKE.distance}`} stroke="#d5a175" strokeWidth=".035" strokeDasharray=".035 .075"/>
    {stage<3&&<g transform={`translate(${f.sledDistance-.27} 0)`}><rect x="-.27" y="-.255" width=".54" height=".1" fill="#354957" stroke="#b7cad5" strokeWidth=".018"/><path d="M-.24-.14h.48" stroke="#e5b084" strokeWidth=".025"/></g>}
    <path d="M-1.6-.7H-.3V.8H-1.6Z" fill="#354957" stroke="#b3815e" strokeWidth=".025"/>
   </g>
   <g transform={`translate(${f.hub.x} ${f.hub.y}) rotate(${f.angle*180/Math.PI})`}>
    <path d={`M0 ${-LUNAR_LAUNCH.arm}V${LUNAR_LAUNCH.arm}`} stroke="#bbcbd3" strokeWidth={Math.max(.014,1.3/s)}/>
    <rect x={-4/s} y={-4/s} width={8/s} height={8/s} fill="#dfa779"/>
    <g transform={`translate(0 ${-LUNAR_LAUNCH.arm}) scale(${size})`}>
     <path d="M-9 14H9" stroke="#c6d6dd" strokeWidth="3"/>
     {[-1,1].map(side=><path key={side} d={`M${side*8} 14V3L${side*5} -3`} transform={`rotate(${side*f.jawAngle} ${side*8} 14)`} fill="none" stroke="#e5b084" strokeWidth="2"/>)}
    </g>
   </g>
   <g transform={`translate(${f.payload.x-LUNAR_RAIL.direction.y*loadingLift} ${f.payload.y+LUNAR_RAIL.direction.x*loadingLift}) rotate(${f.payloadAngle*180/Math.PI}) scale(${size})`}>
    <rect x="-6" y="-20" width="12" height="16" rx="1" fill="#e5e2d5" stroke="#b7cad5" strokeWidth="1.5"/>
    <path d="M-6-12H6M0-4V0" stroke="#e5b084" strokeWidth="2"/><circle r="3" fill="none" stroke="#e5b084" strokeWidth="1.5"/>
   </g>
  </g>
 </svg>;
}
