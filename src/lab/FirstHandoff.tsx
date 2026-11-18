import { useEffect, useRef, useState } from 'react';
import type { Result } from '../simulation/engine.js';
import HandoffDiagram, { CaptureDetail } from './HandoffDiagram.js';
import { handoffFrame } from './handoff-view.js';
import { elapsed as flightClock } from './view.js';

const stages = [
  { label: 'Approach', heading: 'Meet the moving tip.', text: 'Follow the copper cargo capsule. It approaches from below, matching speed with the Earth-facing tip.' },
  { label: 'Capture', heading: 'Ride the tether upward.', text: 'The capture head holds the capsule. Follow that same tip through half a turn, from the Earth-facing side to the space-facing side.' },
  { label: 'Release', heading: 'Watch the paths split.', text: 'The capsule coasts away, taking momentum from the tether. You made one delivery. Can you recover enough momentum for the next pickup?' },
];
const CAPTURE_AT = 3.5, RELEASE_AT = 11, REPLAY_END = 16;
const sharedRate = (a: number, b: number) => 2 * a * b / (a + b);

// Each pair of segments uses the same speed at the join. Easing changes how
// quickly we read the recorded flight, never the shape of its trajectory.
function playbackTime(t: number, capture: number, release: number, end: number) {
  const approach = capture / CAPTURE_AT, swing = (release - capture) / (RELEASE_AT - CAPTURE_AT);
  const depart = (end - release) / (REPLAY_END - RELEASE_AT);
  const atCapture = sharedRate(approach, swing), atRelease = sharedRate(swing, depart);
  function segment(start: number, stop: number, a: number, b: number, v0: number, v1: number) {
    const duration = stop - start, u = (t - start) / duration, v = 1 - u;
    return a + (b - a) * u * u * (3 - 2 * u) + duration * u * v * (v * v0 - u * v1);
  }
  return t < CAPTURE_AT ? segment(0, CAPTURE_AT, 0, capture, 0, atCapture)
    : t < RELEASE_AT ? segment(CAPTURE_AT, RELEASE_AT, capture, release, atCapture, atRelease)
    : segment(RELEASE_AT, REPLAY_END, release, end, atRelease, 0);
}

export default function FirstHandoff({ result, error, onRetry, onContinue }: {
  result: Result | null;
  error: string;
  onRetry: () => void;
  onContinue: (time: number) => void;
}) {
  const elapsed = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const capture = result?.events.find(event => event.kind === 'capture' && event.payloadId === 1)?.t;
  const release = result?.events.find(event => event.kind === 'release' && event.payloadId === 1)?.t;
  const finalFrame = result?.frames.at(-1)?.t;
  const end = release === undefined || finalFrame === undefined ? undefined : Math.min(finalFrame, release + 220);
  const available = capture !== undefined && release !== undefined && end !== undefined && release > capture && end > release;
  const problem = error || (result && !available ? 'This calculation did not produce a complete handoff.' : '');
  const finished = seconds >= REPLAY_END;
  const step = seconds >= RELEASE_AT ? 2 : seconds >= CAPTURE_AT ? 1 : 0;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduceMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), frame = 0;
    const resetTime = () => { last = performance.now(); };
    const tick = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        elapsed.current = Math.min(REPLAY_END, elapsed.current + dt);
        setSeconds(elapsed.current);
      }
      if (elapsed.current >= REPLAY_END) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resetTime);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', resetTime); };
  }, [playing]);

  const next = () => {
    if (!available) return;
    setPlaying(false);
    elapsed.current = step === 0 ? CAPTURE_AT : REPLAY_END;
    setSeconds(elapsed.current);
  };
  const replay = () => {
    elapsed.current = 0; setSeconds(0); setPlaying(!reduceMotion);
  };
  const advance = () => {
    if (problem) { onRetry(); return; }
    if (!available) return;
    if (finished) onContinue(end);
    else if (reduceMotion) next();
    else setPlaying(!playing);
  };
  const action = problem ? 'Retry calculation' : !available ? 'Calculating…' : finished ? 'Try the second delivery'
    : reduceMotion ? step === 0 ? 'Show the capture' : 'Show the release'
    : playing ? 'Pause replay' : seconds > 0 ? 'Resume replay' : 'Play the handoff';
  const stage = stages[step];

  const flightTime = available ? playbackTime(seconds, capture, release, end) : 0;
  const view = result && available ? handoffFrame(result, flightTime) : null;
  const seek = (t: number) => {
    elapsed.current = t; setSeconds(t); setPlaying(false);
  };
  const progress = seconds / REPLAY_END * 100;

  return <main id="lab-content" className="lab-app first-handoff">
    <header className="handoff-header">
      <div><p className="micro">Flight Studio <span>/</span> Guided flight 01</p>
        <h1>Watch the first handoff.</h1></div>
      <a className="handoff-sandbox" href="/lab/">Open the sandbox <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5 3h8v8"/></svg></a>
    </header>
    <div className="handoff-board">
      <section className="handoff-visual" aria-label="Flight replay">
        <div className="handoff-scene scene-box" role="region" aria-label="Calculated Earth flight">
          <div className="handoff-frame-caption" aria-hidden="true"><span>Earth orbit <b>/</b> Side view</span><span>T + {flightClock(flightTime)}</span></div>
          {view && result && available
            ? <HandoffDiagram result={result} view={view} time={flightTime} capture={capture} release={release} end={end}/>
            : <div className="scene-loading">{!problem && <div className="loading-orbit"/>}<p role="status">{problem ? 'The replay is unavailable.' : 'Calculating the flight…'}</p></div>}
          <div className="handoff-reference" aria-hidden="true"><span>Earth below</span><span>Along orbit →</span></div>
        </div>
        <div className="handoff-transport">
          <label htmlFor="handoff-seek">Replay</label>
          <div className="handoff-track">
            <div aria-hidden="true" className="handoff-track-line"><i style={{width: progress+'%'}}/>
              <b style={{left: CAPTURE_AT/REPLAY_END*100+'%'}}/><b style={{left: RELEASE_AT/REPLAY_END*100+'%'}}/></div>
            <input id="handoff-seek" type="range" min="0" max={REPLAY_END} step=".1" value={seconds}
              disabled={!available} aria-label="Replay position"
              aria-valuetext={`${stage.label}, ${seconds.toFixed(1)} of ${REPLAY_END} seconds`}
              onChange={e => seek(Number(e.currentTarget.value))}/>
          </div>
          <span aria-hidden="true">0:{String(Math.floor(seconds)).padStart(2,'0')} <b>/</b> 0:16</span>
        </div>
        <div className="handoff-instruments" aria-label="Flight measurements">
          <div><span>Payload altitude</span><strong>{view?.altitudeKm?.toLocaleString('en-US') ?? '—'} <small>km</small></strong></div>
          <div><span>Tether span</span><strong>{result?.design.spanKm ?? '—'} <small>km</small></strong></div>
          <div><span>Cargo mass</span><strong>{result?.design.payloadT ?? '—'} <small>t</small></strong></div>
        </div>
      </section>
      <section className="handoff-story" aria-label="Handoff guide">
        <ol className="handoff-steps" aria-label="Handoff stages">{stages.map(({label}, i) =>
          <li key={label} aria-current={step === i ? 'step' : undefined} data-past={i < step || undefined}><span>0{i+1}</span> {label}</li>)}</ol>
        <div className="handoff-narration" aria-live="polite">
          <h2>{stage.heading}</h2><p>{stage.text}</p>
        </div>
        <CaptureDetail view={view} />
        {problem && <p role="alert">{problem}</p>}
        <div className="handoff-actions">
          <button className="primary" onClick={advance} disabled={!available && !problem}>
            <span aria-hidden="true">{finished ? '→' : playing ? 'Ⅱ' : '▷'}</span>{action}</button>
          {available && finished ? <button onClick={replay}>Replay handoff</button>
            : available && !reduceMotion ? <button onClick={next}>{step === 0 ? 'Step to capture' : step === 1 ? 'Step to release' : 'Finish replay'}</button> : null}
        </div>
      </section>
    </div>
    <p className="handoff-footnote">Calculated trajectory · Time compressed <span>Illustrative horizon · Hardware enlarged</span></p>
  </main>;
}
