import { useEffect, useRef, useState } from 'react';
import type { Result } from '../simulation/engine.js';
import Scene, { Plane } from './Scene.js';
import { OBJECTS } from './objects.js';

const stages = [
  { label: 'Approach', heading: 'Meet the moving tether.', text: 'The cargo is already above the atmosphere. It matches the speed of the moving tip so the tether can catch it.' },
  { label: 'Capture', heading: 'The tether swings the cargo upward.', text: 'Once attached, the cargo travels with the spinning tether. Watch what happens when the tether lets go.' },
  { label: 'Release', heading: 'One delivery. Can you do it again?', text: 'The cargo leaves on a higher orbit, taking momentum from the tether. In this flight the tether doesn’t recover enough for a second pickup. Try to get it ready again.' },
];
const CAPTURE_AT = 3, RELEASE_AT = 8, REPLAY_END = 9.5;

export default function FirstHandoff({ result, error, gpu, onGraphicsError, onRetry, onContinue }: {
  result: Result | null;
  error: string;
  gpu: boolean;
  onGraphicsError: (message: string) => void;
  onRetry: () => void;
  onContinue: (time: number) => void;
}) {
  const clock = useRef(0);
  const elapsed = useRef(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const capture = result?.events.find(event => event.kind === 'capture' && event.payloadId === 1)?.t;
  const release = result?.events.find(event => event.kind === 'release' && event.payloadId === 1)?.t;
  const finalFrame = result?.frames.at(-1)?.t;
  const end = release === undefined || finalFrame === undefined ? undefined : Math.min(finalFrame, release + 18);
  const available = capture !== undefined && release !== undefined && end !== undefined && release > capture;
  const problem = error || (result && !available ? 'This calculation did not produce a complete handoff.' : '');

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
    if (!playing || capture === undefined || release === undefined || end === undefined) return;
    let last = performance.now(), frame = 0;
    const resetTime = () => { last = performance.now(); };
    const tick = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      // Give the approach and release time on screen; compress the long swing.
      const before = elapsed.current;
      const t = elapsed.current = Math.min(REPLAY_END, before + (document.hidden ? 0 : dt));
      clock.current = t < CAPTURE_AT ? capture * t / CAPTURE_AT
        : t < RELEASE_AT ? capture + (release - capture) * (t - CAPTURE_AT) / (RELEASE_AT - CAPTURE_AT)
        : release + (end - release) * (t - RELEASE_AT) / (REPLAY_END - RELEASE_AT);
      if (t >= REPLAY_END) { setStep(2); setPlaying(false); }
      else if (before < CAPTURE_AT && t >= CAPTURE_AT) setStep(1);
      if (t < REPLAY_END) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resetTime);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', resetTime); };
  }, [playing, capture, release, end]);

  const next = () => {
    if (!available) return;
    setPlaying(false);
    clock.current = step === 0 ? capture : end;
    elapsed.current = step === 0 ? CAPTURE_AT : REPLAY_END;
    setStep(step === 0 ? 1 : 2);
  };
  const replay = () => {
    clock.current = 0; elapsed.current = 0; setStep(0); setPlaying(!reduceMotion);
  };
  const advance = () => {
    if (problem) { onRetry(); return; }
    if (!available) return;
    if (step === 2) onContinue(end);
    else if (reduceMotion) next();
    else setPlaying(!playing);
  };
  const action = problem ? 'Retry calculation' : !available ? 'Calculating…' : step === 2 ? 'Try the second delivery'
    : reduceMotion ? step === 0 ? 'Show the capture' : 'Show the release'
    : playing ? 'Pause replay' : clock.current > 0 ? 'Resume replay' : 'Play the handoff';
  const stage = stages[step];

  return <main id="lab-content" className="lab-app first-handoff">
    <header>
      <p className="micro">FLIGHT STUDIO / GUIDED FLIGHT</p>
      <h1>Watch the first handoff.</h1>
    </header>
    <div className="handoff-board">
      <div className="handoff-visual">
        <div className="handoff-scene scene-box" role="region" aria-label="Calculated Earth flight">
          {result && available ? gpu
            ? <Scene result={result} clock={clock} view="follow" selectedObject="payload-1" onFailure={onGraphicsError} />
            : <Plane result={result} clock={clock} selectedObject="payload-1" follow />
            : <div className="scene-loading">{!problem && <div className="loading-orbit" />}<p role="status">{problem ? 'The replay is unavailable.' : 'Calculating the flight…'}</p></div>}
        </div>
        <div className="handoff-legend">
          <span><i style={{ borderColor: OBJECTS[0].color }} />Tether</span>
          <span><i style={{ borderColor: OBJECTS[1].color }} />Payload</span>
          <span>Calculated flight · schematic view</span>
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
          {available && step === 2 ? <button onClick={replay}>Replay handoff</button>
            : available && !reduceMotion ? <button onClick={next}>{step === 0 ? 'Step to capture' : 'Step to release'}</button> : null}
        </div>
        <a className="handoff-sandbox" href="/lab/">Open the sandbox</a>
      </section>
    </div>
  </main>;
}
