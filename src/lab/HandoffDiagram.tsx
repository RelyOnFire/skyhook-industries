import { useId, useMemo } from 'react';
import type { Result } from '../simulation/engine.js';
import { OBJECTS } from './objects.js';
import { positions, sample } from './view.js';

const CENTER = [260, 226] as const;
const PX_PER_M = 0.00049;

/** Keep the physical hub at center and express each sample in the same
 * local orbital coordinates: away from Earth is up, along the orbit is right. */
function diagramFrame(result: Result, time: number) {
  const frame = sample(result, time);
  const { a, z, hub } = positions(result, frame);
  const radius = Math.hypot(hub[0], hub[1]);
  const upX = hub[0] / radius, upY = hub[1] / radius;
  function project(point: number[]) {
    const dx = point[0] - hub[0], dy = point[1] - hub[1];
    return [CENTER[0] + (-dx * upY + dy * upX) * PX_PER_M,
      CENTER[1] - (dx * upX + dy * upY) * PX_PER_M] as const;
  }
  const cargo = frame.payloads[0] ?? (frame.loaded ? z : frame.incoming);
  return { a: project(a), z: project(z), cargo: cargo ? project(cargo) : null,
    phase: frame.payloads[0] ? 'released' : frame.loaded ? 'attached' : 'approach' };
}

export default function HandoffDiagram({ result, time, release, end }: {
  result: Result; time: number; release: number; end: number;
}) {
  const horizonId = useId();
  const view = diagramFrame(result, time);
  const coastTrail = useMemo(() => Array.from({ length: 27 }, (_, i) => {
    const t = release + (end - release) * i / 26;
    return { t, point: diagramFrame(result, t).cargo };
  }), [result, release, end]);
  const trail = view.phase === 'released' && view.cargo
    ? [...coastTrail.filter(p => p.t < time && p.point).map(p => p.point), view.cargo].join(' ')
    : '';

  return <>
    <div className="handoff-orientation" aria-hidden="true"><span>Side view</span><span>Along the orbit →</span></div>
    <svg className="handoff-diagram" viewBox="0 0 520 460" role="img"
      aria-label="Calculated handoff from the side, with the tether hub centered and Earth below">
      <defs>
        <linearGradient id={horizonId} x2="0" y2="1">
          <stop stopColor="#183141" />
          <stop offset="1" stopColor="#101a22" />
        </linearGradient>
      </defs>
      <path d="M0 459 Q260 380 520 459 V460 H0Z" fill={`url(#${horizonId})`} />
      <path d="M0 459 Q260 380 520 459" className="handoff-horizon" />
      <text x="260" y="446" textAnchor="middle" className="handoff-earth" aria-hidden="true">EARTH BELOW · SCHEMATIC</text>
      <line x1={view.a[0]} y1={view.a[1]} x2={view.z[0]} y2={view.z[1]} className="handoff-tether" />
      <circle cx={view.a[0]} cy={view.a[1]} r="3" className="handoff-far-tip" />
      <rect x={CENTER[0] - 4} y={CENTER[1] - 4} width="8" height="8" rx="1" className="handoff-hub" />
      <circle cx={view.z[0]} cy={view.z[1]} r={view.phase === 'attached' ? 10 : 5} className="handoff-tip" />
      {trail && <polyline className="handoff-trail" points={trail} stroke={OBJECTS[1].color} />}
      {view.cargo && <g className="handoff-payload" data-phase={view.phase} fill={OBJECTS[1].color}>
        <circle cx={view.cargo[0]} cy={view.cargo[1]} r="6" />
        <text x={view.cargo[0] + 13} y={view.cargo[1] + (view.phase === 'released' ? -8 : 16)} aria-hidden="true">PAYLOAD</text>
      </g>}
    </svg>
  </>;
}
