import { memo, useMemo } from 'react';
import type { Result } from '../simulation/engine.js';
import { HUB, handoffFrame, type HandoffFrame } from './handoff-view.js';

const field = Array.from({ length: 105 }, (_, i) => {
  const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 7.14) * 43758.5453; return x - Math.floor(x); };
  return <circle key={i} cx={-420 + 1360 * hash(3*i)} cy={397 * hash(3*i+1)}
    r={.38 + .52 * hash(3*i+2)} opacity={.17 + .49 * hash(3*i+4)} />;
});

// The backdrop and the hardware layers are pre-rendered. Replaying the
// simulation only moves lightweight geometry; it never needs a GPU context.
const Background = memo(function Background() {
  return <g aria-hidden="true">
    <g fill="#dae6ef">{field}</g>
    <image href="/handoff/earth-limb.webp" x="-420" y="345" width="1360" height="155" />
  </g>;
});

export default function HandoffDiagram({ result, time, capture, release, end, view }: {
  result: Result; time: number; capture: number; release: number; end: number; view: HandoffFrame;
}) {
  const record = useMemo(() => {
    function track(start: number, stop: number, count: number) {
      return Array.from({ length: count }, (_,i) => {
        const t = start + (stop-start)*i/(count-1);
        return {t, point: handoffFrame(result,t).cargo};
      });
    }
    return { swing: track(capture,release,72), coast: track(release,end,32),
      releaseAngle: handoffFrame(result,release).angle };
  }, [result,capture,release,end]);
  function trace(points: typeof record.swing, current = true) {
    const drawn = points.filter(p => p.t <= time && p.point).map(p => p.point);
    if (current && view.cargo) drawn.push(view.cargo);
    return drawn.join(' ');
  }
  const { a, tip, cargo, angle, phase } = view;
  return <svg className="handoff-diagram" viewBox="0 0 520 500" role="img"
    aria-label="Calculated handoff from the side, with the tether hub centered and Earth below">
    <defs>
      <linearGradient id="handoff-cable" gradientUnits="userSpaceOnUse" x1="-150" x2="150" y1="0" y2="0">
        <stop stopColor="#75939c"/><stop offset=".45" stopColor="#e1eded"/><stop offset="1" stopColor="#86c4cb"/>
      </linearGradient>
      <linearGradient id="handoff-array" x2="0" y2="1">
        <stop stopColor="#768c9c"/><stop offset=".27" stopColor="#384e61"/><stop offset="1" stopColor="#1d2a3b"/>
      </linearGradient>
    </defs>
    <Background />
    {phase !== 'approach' && <polyline className="handoff-swing" points={trace(record.swing,phase === 'attached')} />}
    {phase === 'released' && <polyline className="handoff-trail" points={trace(record.coast)} />}
    <g transform={`translate(${HUB}) rotate(${angle})`}>
      <path d={`M${-Math.hypot(a[0]-HUB[0],a[1]-HUB[1])} 0H${Math.hypot(tip[0]-HUB[0],tip[1]-HUB[1])}`}
        stroke="url(#handoff-cable)" fill="none" strokeWidth="1.45" />
      {/* A second lit edge keeps the hairline legible over both sea and space. */}
      <path d="M-120 1.1H-14M14 1.1H120" stroke="#79adba" opacity=".32" strokeWidth=".8"/>
    </g>
    <g transform={`translate(${a}) rotate(${angle})`}>
      <path d="m-5 0 2-3h5l2 3-2 3h-5z" fill="#899ca6" stroke="#e6eeeb" strokeWidth=".8"/>
      <path d="M-1-2.8V2.8" stroke="#3c505e" strokeWidth="2"/>
    </g>
    <svg className="handoff-hub" x={HUB[0]-24} y={HUB[1]-24} width="48" height="48" viewBox="-24 -24 48 48">
      <g transform={`rotate(${angle-90}) scale(.86)`}>
        <path d="M-19 0h38" stroke="#d8c7ac" strokeWidth="2"/>
        {[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
          <path d="M8-4.7 23-5.7v10L8 5Z" fill="url(#handoff-array)" stroke="#b3c5ca" strokeWidth=".8"/>
          <path d="M13-5v10m5-10v10M8 0h15" fill="none" stroke="#91a0a7" strokeWidth=".5"/>
        </g>)}
        <path d="m-6-4 5-3 6 2 1 9-5 3-7-3z" fill="#ae9475" stroke="#e8ded1" strokeWidth="1"/>
        <path d="m-6-4 6 2 5-3M0-2v8" fill="none" stroke="#4d5152" strokeWidth="1.3"/>
      </g>
    </svg>
    <g transform={`translate(${tip}) rotate(${angle})`}>
      <image href="/handoff/capture-head.webp" x="-17" y="-5.98" width="34" height="11.96"/>
    </g>
    {cargo && <g className="handoff-payload" data-phase={phase} transform={`translate(${cargo})`}>
      <image href="/handoff/cargo-bus.webp" x="-23" y="-8.09" width="46" height="16.18"
        transform={`rotate(${phase === 'released' ? record.releaseAngle : angle})`}/>
      <path d="M9-3l8-8h12" className="handoff-leader"/>
      <text x="34" y="-8" className="handoff-label" aria-hidden="true">Payload 01</text>
    </g>}
  </svg>;
}

export function CaptureDetail({ view }: { view: HandoffFrame | null }) {
  // A magnified coupling study, with compressed separation. Do not imply the
  // angular pose or the illustrated size of these parts is a solver output.
  const separation = Math.min(25, 7 * Math.log1p((view?.gap ?? 22000)/650));
  const state = view?.phase === 'attached' ? 'Latched' : view?.phase === 'released' ? 'Released' : 'Open';
  return <figure className="capture-detail" aria-label={`Capture interface, ${state.toLowerCase()}. Illustrative close-up.`}>
    <figcaption><span>Capture interface</span><span>{state}</span></figcaption>
    <svg viewBox="0 0 320 90" aria-hidden="true">
      <path d="M9 45H308" stroke="#50616a" strokeDasharray="3 6" opacity=".55"/>
      <g transform={`translate(${-separation*.32})`}><image href="/handoff/capture-head.webp" x="9" y="-9" width="304" height="107"/></g>
      <g transform={`translate(${separation*.68} ${separation*.055})`}><image href="/handoff/cargo-bus.webp" x="9" y="-9" width="304" height="107"/></g>
    </svg>
  </figure>;
}
