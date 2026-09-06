import { useMemo } from 'react';
import type { Result } from '../simulation/engine.js';

/** Plots recorded model output; never fabricated telemetry or a design score. */
export default function Trace({ result, time, metric }: {
  result: Result; time: number; metric: 'clearance' | 'margin';
}) {
  const chart = useMemo(() => {
    const values = result.frames.map(f => metric === 'clearance' ? f.clearance / 1000 : f.margin);
    const minimum = Math.min(...values), maximum = Math.max(...values);
    const low = metric === 'margin' ? Math.min(1, minimum) : Math.min(120, minimum);
    const high = Math.max(low + .1, maximum), end = result.frames.at(-1)?.t || 1;
    const y = (v: number) => 68 - (v - low) / (high - low) * 52;
    // Downsample the display only. Extrema and metrics use every accepted frame.
    const stride = Math.max(1, Math.floor(values.length / 220));
    const selected = values.map((v, i) => ({ v, i })).filter((_, i) => i % stride === 0 || i === values.length - 1);
    const points = selected.map(({ v, i }) => `${(result.frames[i].t / end * 240).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    return { minimum, maximum, points, threshold: y(metric === 'margin' ? 1 : 120), end };
  }, [result, metric]);
  const label = metric === 'clearance' ? 'Tether clearance' : 'Axial load margin';
  const unit = metric === 'clearance' ? 'km' : '×';
  const format = (v: number) => v.toFixed(metric === 'clearance' ? 0 : 2);
  return <figure className={`trace trace-${metric}`}>
    <figcaption><span>{label}</span><span>min {format(chart.minimum)} {unit}</span></figcaption>
    <svg viewBox="0 0 240 78" role="img" aria-label={`${label} over the calculated mission. Minimum ${format(chart.minimum)} ${unit}; maximum ${format(chart.maximum)} ${unit}. Dashed line is the model threshold.`}>
      <path d="M0 16H240 M0 42H240 M0 68H240" className="trace-grid" />
      <line x1="0" x2="240" y1={chart.threshold} y2={chart.threshold} className="trace-threshold" />
      <polyline points={chart.points} className="trace-data" />
      <line x1={Math.min(240, time / chart.end * 240)} x2={Math.min(240, time / chart.end * 240)} y1="10" y2="74" className="trace-cursor" />
    </svg>
  </figure>;
}
