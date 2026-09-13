import { compile, pointState, forces, type Result, type Frame } from '../simulation/engine.js';

/** Interpolate within a continuous physical state, never across an attachment
 * or the start of a different incoming shipment. Exact event frames take priority. */
export function sample(result: Result, t: number): Frame {
  const frames = result.frames;
  if (!frames.length) throw Error('No trajectory samples.');
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  const f = frames[lo], next = frames[lo + 1];
  if (!next || next.burn !== f.burn || next.loaded !== f.loaded || next.deliveries !== f.deliveries || next.t === f.t) return f;
  const u = Math.max(0, Math.min(1, (t - f.t) / (next.t - f.t)));
  const mix = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * u);
  return {
    ...f, t, state: mix(f.state, next.state),
    ...(result.design.recovery==='electrodynamic'?{electrical:forces(mix(f.state,next.state),compile(result.design,f.fuel,f.loaded,result.cells),result.design,f.burn).electrical!}:{}),
    payloads: f.payloads.map((p, i) => next.payloads[i] ? mix(p, next.payloads[i]) : p),
    incoming: f.incoming && next.incoming && f.incomingId === next.incomingId ? mix(f.incoming, next.incoming) : f.incoming,
    clearance: f.clearance + (next.clearance - f.clearance) * u,
    margin: f.margin + (next.margin - f.margin) * u,
    fuel: f.fuel + (next.fuel - f.fuel) * u,
  };
}
export function positions(r: Result, f: Frame) {
  const body = compile(r.design, f.fuel, f.loaded, r.cells);
  return { a: pointState(f.state, body, -body.half), z: pointState(f.state, body, body.half), hub: pointState(f.state, body, 0) };
}
export const elapsed = (t: number) => {
  const n = Math.max(0, Math.floor(t));
  return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};
