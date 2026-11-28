import {EYE,PIN,pinTip,type Point3} from '../../visuals/capture-fitting.js';
import {LIMIT,type Carriage,type Telemetry} from './pass.js';

const cm=(v:number)=>Number((v*100).toFixed(1)).toLocaleString('en-US',{useGrouping:false});
const signed=(v:number)=>Math.abs(v)<.0005?'0':(v>0?'+':'−')+cm(Math.abs(v));

/** Both sections are orthographic, at the same scale, centred on the hardware.
 * The main X/Z scope commands the carriage. These are read-only instruments. */
export default function FittingMonitor({eye,head,stroke,telemetry,mode,held}:{eye:Point3;head:Carriage;stroke:number;telemetry:Telemetry;mode:string;held:boolean}){
  const {boreMargin:bore,forkMargin:fork,axialRate:closing,speed,peakSpeed,range}=telemetry;
  const dx=eye.x-head.x,dz=eye.z-head.z;
  const scale=108,eyeY=52-eye.y*scale,boreX=75+dx*scale;
  const sideX=85+dz*scale,r=EYE.radius*scale,tube=EYE.tube*scale;
  const pinR=PIN.radius*scale,tip=85+pinTip(stroke)*scale;
  const slot=PIN.forkHalfGap*scale,sleeve=PIN.sleeveLength*scale;
  return <section className="fitting-monitor" aria-label="Capture instruments">
    <header><h2>Latch inspection</h2><span>{mode}</span></header>
    <div className="inspection-grid">
      <div className="inspection-view"><h3>Through the eye <small>X / Y</small></h3>
        <svg viewBox="0 0 150 106" role="img" aria-label="End view of the eye opening relative to the pin axis">
          <path className="cross" d="M0 52H150M75 0V106"/>
          <circle className="eye" cx={boreX} cy={eyeY} r={r} fill="none" strokeWidth={tube*2}/>
          <circle className="pin-target" cx="75" cy="52" r={pinR}/>
          <path className="axis-tick" d="M65 52h-7m27 0h7M75 42v-7m0 27v7"/>
        </svg>
        <p>{signed(dx)} cm X <span>·</span> {cm(-eye.y)} cm below axis</p>
      </div>
      <div className="inspection-view"><h3>Across the fork <small>Z / Y</small></h3>
        <svg viewBox="0 0 170 106" role="img" aria-label="Side section showing the pin stroke, eye thickness and receiver">
          <path className="cross" d="M0 52H170M85 0V106"/>
          {[-1,1].map(side=>{const x=side<0?85-slot-sleeve:85+slot;return <g key={side} className="fork-section">
            <path d={'M'+x+' 0h'+sleeve+'v44H'+x+'z'}/><rect x={x} y={52+pinR+1} width={sleeve} height="7"/></g>;})}
          {[-1,1].map(i=><circle key={i} className="eye-section" cx={sideX} cy={eyeY+i*r} r={tube}/>)}
          <path className="pin-section" d={'M'+(tip-70)+' '+(52-pinR)+'H'+(tip-2.2)+'l2.2 2v'+(pinR*2-4)+'l-2.2 2H'+(tip-70)+'z'}/>
        </svg>
        <p>{signed(dz)} cm Z <span>·</span> {Math.round(stroke*100)}% pin stroke</p>
      </div>
      <dl className="clearance-readouts" aria-label={held?'Readings held at command or end of pass':'Live capture readings'}>
        <div><dt>Pin clearance¹</dt><dd data-low={bore<0}>{signed(bore)} <small>cm</small></dd></div>
        <div><dt>Fork clearance¹</dt><dd data-low={fork<0}>{signed(fork)} <small>cm</small></dd></div>
        <div><dt>Fitting range</dt><dd>{range.toFixed(2)} <small>m</small></dd></div>
        <div><dt>Vertical motion</dt><dd>{Math.abs(closing).toFixed(2)} <small>m/s {closing>.005?'up':closing<-.005?'down':''}</small></dd></div>
        <div><dt>Relative speed</dt><dd>{speed.toFixed(2)} <small>m/s</small></dd></div>
        <div><dt>Peak during stroke</dt><dd data-low={peakSpeed>LIMIT.speed}>{peakSpeed.toFixed(2)} <small>/ {LIMIT.speed.toFixed(2)} m/s</small></dd></div>
      </dl>
    </div>
    <p className="inspection-legend"><i/> Cargo eye <b/> Locking pin <span>¹ Minimum clearance during insertion, after a {PIN.guard*1000} mm allowance. {held?'Numbers held at end of approach. Diagrams show actual position.':'Both margins must reach zero or above.'}</span></p>
  </section>;
}
