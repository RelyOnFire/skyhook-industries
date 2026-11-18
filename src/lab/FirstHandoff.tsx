import { useEffect, useRef, useState } from 'react';
import type { Result } from '../simulation/engine.js';
import HandoffDiagram from './HandoffDiagram.js';
import { OBJECTS } from './objects.js';

const stages = [
  { label: 'Approach', heading: 'Meet the moving tether.', text: 'The orange payload is already above the atmosphere. Watch it meet the tip closest to Earth.' },
  { label: 'Capture', heading: 'The tether carries the payload upward.', text: 'The tip catches the payload at matching speed. As the tether turns, that same tip swings away from Earth.' },
  { label: 'Release', heading: 'One delivery. Can you do it again?', text: 'The cargo leaves on a higher orbit, taking momentum from the tether. In this flight the tether doesn’t recover enough for a second pickup. Try to get it ready again.' },
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

  return <main id="lab-content" className="lab-app first-handoff">
    <header>
      <p className="micro">FLIGHT STUDIO / GUIDED FLIGHT</p>
      <h1>Watch the first handoff.</h1>
    </header>
    <div className="handoff-board">
      <div className="handoff-visual">
        <div className="handoff-scene scene-box" role="region" aria-label="Calculated Earth flight">
          {result && available
            ? <HandoffDiagram result={result} time={playbackTime(seconds, capture, release, end)} release={release} end={end} />
            : <div className="scene-loading">{!problem && <div className="loading-orbit" />}<p role="status">{problem ? 'The replay is unavailable.' : 'Calculating the flight…'}</p></div>}
        </div>
        <div className="handoff-legend">
          <span><i style={{ borderColor: OBJECTS[0].color }} />Tether</span>
          <span><i style={{ borderColor: OBJECTS[1].color }} />Payload</span>
          <span>Calculated flight · time compressed</span>
        </div>
      </div>
      <section className="handoff-story" aria-label="Handoff guide">
        <ol className="handoff-steps" aria-label="Handoff stages">{stages.map(({label}, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>{label}</li>)}</ol>
        <div aria-live="polite">
          <h2>{stage.heading}</h2>
          <p>{stage.text}</p>
        </div>
        {problem && <p role="alert">{problem}</p>}
        <div className="handoff-actions">
          <button className="primary" onClick={advance} disabled={!available && !problem}>{action}</button>
          {available && finished ? <button onClick={replay}>Replay handoff</button>
            : available && !reduceMotion ? <button onClick={next}>{step === 0 ? 'Step to capture' : step === 1 ? 'Step to release' : 'Finish replay'}</button> : null}
        </div>
        <a className="handoff-sandbox" href="/lab/">Open the sandbox</a>
      </section>
    </div>
  </main>;
}
