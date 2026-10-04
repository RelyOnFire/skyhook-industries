import {LUNAR_LAUNCH,LUNAR_RAIL,lunarLaunchFrame,lunarLaunchPath} from './lunar-launch-motion.js';
const path=(points:{x:number;y:number}[])=>points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
export default function LunarDepartureDiagram({stage,progress}:{stage:number;progress:number}){
 const f=lunarLaunchFrame(stage,progress),s=1000/f.camera.width,railAngle=Math.atan2(LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x)*180/Math.PI;
 const size=stage<4?.025:Math.max(.025,f.camera.width/1000*.11);
 return <svg viewBox="0 0 1000 620" role="img" aria-label="Lunar mass driver launches cargo to a moving tether, which captures, swings and releases it.">
  <defs><radialGradient id="lunar-launch-shade"><stop stopColor="#67757d"/><stop offset="1" stopColor="#242f38"/></radialGradient></defs>
  <rect width="1000" height="620" fill="#070d13"/>
  <g transform={`translate(500 310) scale(${s} ${-s}) translate(${-f.camera.center.x} ${-f.camera.center.y})`}>
   <circle r={LUNAR_LAUNCH.radius} fill="url(#lunar-launch-shade)"/>
   <circle r={LUNAR_LAUNCH.radius+LUNAR_LAUNCH.hubAltitude} fill="none" stroke="#668c9c" strokeWidth={.8/s} strokeDasharray={`${4/s} ${6/s}`}/>
   {stage<4&&<path d={path(lunarLaunchPath('approach'))} fill="none" stroke="#7fabbc" strokeWidth={1/s} opacity=".35"/>}
   {stage===5&&<path d={path(lunarLaunchPath('release'))} fill="none" stroke="#d5a175" strokeWidth={1/s} opacity=".4"/>}
   <g transform={`translate(${LUNAR_RAIL.start.x+LUNAR_RAIL.direction.y*.6} ${LUNAR_RAIL.start.y-LUNAR_RAIL.direction.x*.6}) rotate(${railAngle})`}>
    <path d={`M-.4 -.05H${LUNAR_RAIL.length+.2}`} stroke="#a6b9c4" strokeWidth=".09"/>
    {Array.from({length:33},(_,i)=><rect key={i} x={i/32*LUNAR_RAIL.length-.045} y="-.15" width=".09" height=".3" fill={stage===1&&Math.abs(i/32-f.railProgress**2)<.07?'#f1bc88':'#637986'}/>)}
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
   <g transform={`translate(${f.payload.x} ${f.payload.y}) rotate(${f.payloadAngle*180/Math.PI}) scale(${size})`}>
    <rect x="-6" y="-20" width="12" height="16" rx="1" fill="#344a58" stroke="#b7cad5" strokeWidth="1.5"/>
    <path d="M-6-12H6M0-4V0" stroke="#e5b084" strokeWidth="2"/><circle r="3" fill="none" stroke="#e5b084" strokeWidth="1.5"/>
   </g>
  </g>
 </svg>;
}
