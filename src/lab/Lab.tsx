import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Scene, { Plane, type View } from './Scene.js';
import Trace from './Trace.js';
import { DEFAULT, MODEL, MATERIALS, PRESETS, PAYLOAD_LIMIT_T, STANDARD_PAYLOAD_T,
  validate, compile, properties, resize, EARTH, type Design, type Result } from '../simulation/engine.js';
import { readDesign, designFragment, type ImportedDesign } from '../simulation/design-io.js';
import { elapsed, sample } from './view.js';

type ControlTab = 'structure' | 'mission' | 'recovery';
type MobileTab = 'build' | 'fly' | 'results';
const STORAGE_KEY = 'skyhook-lab-design-v2';
const fmt = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function Field({ label, unit, value, min, max, step, onChange, onValidity }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void; onValidity: (label: string, invalid: boolean) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(String(value)); setInvalid(false); onValidity(label, false); }, [value, label, onValidity]);
  useEffect(() => () => onValidity(label, false), [label, onValidity]);
  function edit(raw: string) {
    setText(raw);
    const number = Number(raw), bad = raw.trim() === '' || !Number.isFinite(number) || number < min || number > max;
    setInvalid(bad); onValidity(label, bad);
    if (!bad) onChange(number);
  }
  return <div className="lab-field">
    <div className="field-heading"><label htmlFor={id}>{label}</label><span className="field-value">
      <input id={id} aria-label={`${label} value`} type="number" inputMode="decimal" value={text} min={min} max={max} step="any"
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={e => edit(e.target.value)} /><span>{unit}</span>
    </span></div>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value}
      onChange={e => { const n = Number(e.target.value); setText(String(n)); setInvalid(false); onValidity(label, false); onChange(n); }} />
    {invalid && <p id={`${id}-error`} className="field-error">Enter {min}–{max} {unit}.</p>}
  </div>;
}

export default function Lab() {
  const [design, setDesign] = useState<Design>({ ...DEFAULT });
  const [result, setResult] = useState<Result | null>(null), [previous, setPrevious] = useState<Result | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(240);
  const [view, setView] = useState<View>('earth'), [gpu, setGpu] = useState(true);
  const [control, setControl] = useState<ControlTab>('structure'), [mobile, setMobile] = useState<MobileTab>('fly');
  const [extended, setExtended] = useState(false), [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState(''), [pendingImport, setPendingImport] = useState<ImportedDesign | null>(null);
  const clock = useRef(0), worker = useRef<Worker | null>(null), request = useRef(0), fileInput = useRef<HTMLInputElement>(null);
  const chemicalBudget = useRef(DEFAULT.fuelT), resultRef = useRef(result), playingRef = useRef(playing), speedRef = useRef(speed);
  resultRef.current = result; playingRef.current = playing; speedRef.current = speed;
  const max = result?.frames.at(-1)?.t ?? 0;
  const dirty = !!result && JSON.stringify(design) !== JSON.stringify(result.design);
  const frame = useMemo(() => result ? sample(result, time) : null, [result, time]);
  const currentEvent = result?.events.filter(e => e.t <= time + .01).at(-1);
  const material = MATERIALS.find(m => m.id === design.material)!;
  const draft = useMemo(() => { try { const d = validate(design); return { body: compile(d, 0, false), props: properties(d) }; } catch { return null; } }, [design]);
  const atEnd = !!result && time >= max - .1;
  const reportValidity = useCallback((label: string, invalid: boolean) => {
    setInvalidFields(old => invalid ? old.includes(label) ? old : [...old, label] : old.includes(label) ? old.filter(x => x !== label) : old);
  }, []);

  const run = (candidate: Design, autoPlay = true) => {
    let d: Design;
    try { d = validate(candidate); } catch (e) { setError((e as Error).message); setBusy(false); return; }
    worker.current?.terminate(); setBusy(true); setPlaying(false); setError(''); setNotice('');
    const id = ++request.current;
    try {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); worker.current = w;
      w.onerror = () => { if (id === request.current) { setError('The calculation worker could not start. Reload to try again.'); setBusy(false); } w.terminate(); };
      w.onmessage = e => {
        if (e.data.id !== request.current) return;
        setBusy(false); w.terminate(); worker.current = null;
        if (e.data.error) { setError(e.data.error); return; }
        if (resultRef.current) setPrevious(resultRef.current);
        setResult(e.data.result); clock.current = 0; setTime(0);
        setPlaying(autoPlay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      };
      w.postMessage({ id, design: d });
    } catch (e) { setBusy(false); setError(`Could not start the worker: ${(e as Error).message}`); }
  };
  const adopt = (d: Design, fly = false) => {
    setDesign(d); setExtended(d.payloadT > STANDARD_PAYLOAD_T); setInvalidFields([]);
    if (d.recovery === 'chemical') chemicalBudget.current = d.fuelT;
    setPendingImport(null); run(d, fly);
  };
  useEffect(() => {
    let initial = { ...DEFAULT }, message = '';
    try {
      const raw = new URLSearchParams(location.hash.slice(1)).get('d');
      if (raw) {
        if (raw.length > 6000) throw Error('Shared design exceeds the size limit.');
        const imported = readDesign(raw);
        if (imported.needsConfirmation) setPendingImport(imported); else initial = imported.design;
      }
    } catch (e) { message = `Shared design not loaded: ${(e as Error).message}`; }
    setDesign(initial); setExtended(initial.payloadT > STANDARD_PAYLOAD_T);
    if (initial.recovery === 'chemical') chemicalBudget.current = initial.fuelT;
    run(initial, false); if (message) setNotice(message);
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    let raf = 0, last = performance.now(), lastUI = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick); const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!playingRef.current || document.hidden || !resultRef.current) return;
      const end = resultRef.current.frames.at(-1)?.t ?? 0; clock.current = Math.min(end, clock.current + dt * speedRef.current);
      if (now - lastUI > 80 || clock.current === end) { setTime(clock.current); lastUI = now; }
      if (clock.current === end) setPlaying(false);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (t: number) => { setPlaying(false); clock.current = Math.max(0, Math.min(max, t)); setTime(clock.current); };
  const change = <K extends keyof Design>(key: K, value: Design[K]) => { setDesign(d => ({ ...d, [key]: value })); setPlaying(false); setError(''); };
  const changeRecovery = (recovery: Design['recovery']) => {
    if (design.recovery === 'chemical') chemicalBudget.current = design.fuelT;
    setDesign(d => ({ ...d, recovery, fuelT: recovery === 'none' ? 0 : chemicalBudget.current }));
    setPlaying(false); setError('');
  };
  const play = () => { if (!result || dirty || busy) return; if (time >= max) { clock.current = 0; setTime(0); } setPlaying(p => !p); };
  const nextEvent = () => seek(result?.events.find(e => e.t > time + .1)?.t ?? max);
  const cancel = () => { worker.current?.terminate(); worker.current = null; request.current++; setBusy(false); setNotice('Calculation cancelled. The last accepted run is unchanged.'); };
  const share = async () => {
    try {
      if (invalidFields.length) throw Error('Correct the highlighted input before sharing.');
      const hash = designFragment(design), url = `${location.origin}${location.pathname}${hash}`;
      history.replaceState(null, '', url); setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setNotice('Design link copied.'); } catch { setNotice('Copy the design link below.'); }
    } catch (e) { setError((e as Error).message); }
  };
  const acceptImport = (text: string) => {
    const imported = readDesign(text); setPlaying(false);
    if (imported.needsConfirmation) setPendingImport(imported); else adopt(imported.design);
  };
  const save = () => { try {
    if (invalidFields.length) throw Error('Correct the highlighted input first.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validate(design))); setNotice('Saved in this browser. Export JSON for a portable copy.');
  } catch (e) { setError(`Save failed: ${(e as Error).message}`); } };
  const load = () => { try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('skyhook-lab-design-v1');
    if (!raw) throw Error('No saved design in this browser.'); acceptImport(raw);
  } catch (e) { setError(`Load failed: ${(e as Error).message}`); } };
  const exportFile = () => { try {
    if (invalidFields.length) throw Error('Correct the highlighted input first.');
    const url = URL.createObjectURL(new Blob([JSON.stringify(validate(design), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'skyhook-tether-design.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { setError((e as Error).message); } };
  const importFile = async (file?: File) => { if (!file) return; try {
    if (file.size > 16000) throw Error('Design file exceeds 16 KB.'); acceptImport(await file.text());
  } catch (e) { setError(`Import rejected: ${(e as Error).message}`); } finally { if (fileInput.current) fileInput.current.value = ''; } };
  const error3D = useCallback((message: string) => { setGpu(false); setView('plane'); setNotice(message); }, []);
  const field = (key: keyof Design, label: string, unit: string, min: number, high: number, step: number) =>
    <Field key={key} label={label} unit={unit} value={design[key] as number} min={min} max={high} step={step} onChange={v => change(key, v as never)} onValidity={reportValidity} />;

  return <main className={`lab-app mobile-${mobile}`} id="lab-content">
    <div className="workbench-bar"><div><p className="micro">EARTH / SINGLE-STAGE ROTOVATOR</p><h1>Orbital workbench<span className="model-tag">{MODEL}</span></h1></div>
      <div className="workbench-actions"><button onClick={save}>Save</button><button onClick={load}>Load</button><button className="share-design" onClick={share}>Share design <span aria-hidden="true">↗</span></button></div>
    </div>
    <div className="experiment-strip" aria-label="Experiment presets"><span>START WITH</span>{PRESETS.map((p, i) => <button key={p.id} onClick={() => { adopt({ ...p.design }); setMobile('fly'); }} title={p.description}>
      <span className="preset-number">0{i + 1}</span>{['Orbital relay', 'No reboost', 'Material limit', 'Long reach'][i]}<span aria-hidden="true">↗</span>
    </button>)}<a href="/lab/architectures/">Architecture catalogue <span aria-hidden="true">→</span></a></div>

    {error && <div className="lab-feedback is-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="lab-feedback" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
    {pendingImport && <section className="import-review" aria-label="Saved design update required"><div><h2>Review this older design.</h2><p>{pendingImport.explanation}</p></div><button className="primary" onClick={() => adopt(pendingImport.design)}>Update and run</button><button onClick={() => setPendingImport(null)}>Keep current design</button></section>}
    {shareUrl && <div className="share-output"><label>Shareable design <input aria-label="Shareable design link" readOnly value={shareUrl} onFocus={e => e.target.select()} /></label><button onClick={() => setShareUrl('')} aria-label="Close share link">×</button></div>}
    <nav className="workspace-mobile-tabs" aria-label="Workspace panels">{(['build', 'fly', 'results'] as MobileTab[]).map(t => <button key={t} aria-pressed={mobile === t} onClick={() => setMobile(t)}>{t === 'fly' ? 'Flight' : t === 'build' ? 'Design' : 'Results'}</button>)}</nav>

    <div className="lab-workspace">
      <aside className="build-panel lab-panel" aria-label="Design controls">
        <div className="panel-heading"><h2>Design bay</h2><span className={dirty ? 'tag tag-amber' : 'tag'}>{dirty ? 'UNRUN CHANGES' : 'CONFIGURATION'}</span></div>
        <div className="control-tabs" role="group" aria-label="Design sections">{(['structure', 'mission', 'recovery'] as ControlTab[]).map(t => <button key={t} aria-pressed={control === t} onClick={() => setControl(t)}>{t === 'structure' ? 'Structure' : t === 'mission' ? 'Mission' : 'Recovery'}</button>)}</div>
        <div className="control-scroll">
          {control === 'structure' && <>
            <div className="architecture-identity"><span className="mini-tether" aria-hidden="true" /><div><strong>Single-stage rotovator</strong><span>Two equal arms · rigid-body model</span></div></div>
            <label className="lab-select">Tether material<select aria-label="Tether material" value={design.material} onChange={e => change('material', e.target.value)}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <div className={`material-card ${material.source ? '' : 'hypothetical'}`}><span className="micro">{material.source ? 'FIBER DATA / ASSUMED DERATING' : 'HYPOTHETICAL MATERIAL'}</span><strong>{draft ? fmt(draft.props.allowable / 1e9, 2) : '—'} <small>GPa allowable</small></strong><p>{material.source ? 'Ultimate fiber strength ÷ safety factor. Not a flight-qualified cable.' : 'Exploration inputs, not an available material system.'}</p><a href="/lab/method/#materials">Properties & sources ↗</a></div>
            {design.material === 'custom' && <>{field('density', 'Material density', 'kg/m³', 500, 12000, 50)}{field('ultimateGPa', 'Ultimate stress', 'GPa', .1, 100, .1)}</>}
            {field('spanKm', 'Total tether span', 'km', 80, 4000, 20)}
            <div className="field-heading"><span>Cross-section profile</span></div><div className="segmented" role="group" aria-label="Cross-section profile"><button aria-pressed={design.shape === 'uniform'} onClick={() => change('shape', 'uniform')}>Uniform</button><button aria-pressed={design.shape === 'tapered'} onClick={() => change('shape', 'tapered')}>Tapered</button></div>
            {field('areaMm2', 'Center cross-section', 'mm²', 5, 2500, 1)}
            <button className="resize-button" onClick={() => { try { const area = resize(validate(design)); change('areaMm2', area); setNotice(`Resized to ${area} mm² for the lower-radial load with a 15% area reserve. Run the mission to check the rest of the trajectory.`); } catch (e) { setError((e as Error).message); } }}>Resize for radial load <span aria-hidden="true">↗</span></button>
            <p className="control-hint">Changing material keeps these dimensions. Resizing is a separate decision.</p>
            <details className="engineering-controls"><summary>Strength assumption</summary>{field('safetyFactor', 'Safety factor', '×', 1.2, 5, .1)}<p>Joints, fatigue, environmental aging and damage are not included.</p></details>
          </>}
          {control === 'mission' && <>
            <div className="control-intro"><span className="micro">THE EXPERIMENT</span><h3>Make the second delivery.</h3><p>Release a payload into a higher-energy orbit. Restore the facility’s operating state, then attempt another handoff.</p></div>
            <label className="extended-switch"><input type="checkbox" checked={extended} onChange={e => { if (!e.target.checked && design.payloadT > STANDARD_PAYLOAD_T) { setNotice('Lower the payload to 20 t or less before leaving the extended range. Your input has not been reduced.'); return; } setExtended(e.target.checked); }} /><span>Extended payload range <small>up to {PAYLOAD_LIMIT_T} t</small></span></label>
            {field('payloadT', 'Payload per delivery', 't', .1, extended ? PAYLOAD_LIMIT_T : STANDARD_PAYLOAD_T, .1)}
            {extended && <p className="range-warning">Exploratory input range, not a rated capacity. The same physics applies; larger payloads can exceed the load or clearance limits. No automatic resizing.</p>}
            {field('altitudeKm', 'Initial circular altitude', 'km', 400, 8000, 50)}
            {field('tipSpeedKms', 'Tip speed relative to center', 'km/s', .25, 2.5, .05)}
            {field('releaseDeg', 'Earth-relative release phase', '°', 70, 210, 5)}
            <p className="control-hint">In-space, velocity-matched rendezvous. Neither a rocket ascent nor a capture-guidance system is simulated.</p><a className="text-link" href="/lab/method/#events">How the handoff is modeled ↗</a>
          </>}
          {control === 'recovery' && <>
            <div className="control-intro"><span className="micro">AFTER THE FIRST TRANSFER</span><h3>Recover, or coast.</h3><p>The payload takes energy with it. Choose what the facility does next.</p></div>
            <div className="recovery-options" role="group" aria-label="Recovery method"><button aria-pressed={design.recovery === 'chemical'} onClick={() => changeRecovery('chemical')}><span className="recovery-symbol" aria-hidden="true">↗</span><span><b>Chemical</b><small>Finite thrust, finite propellant</small></span></button><button aria-pressed={design.recovery === 'none'} onClick={() => changeRecovery('none')}><span className="recovery-symbol" aria-hidden="true">→</span><span><b>Coast</b><small>No thrust, no propellant mass</small></span></button></div>
            {design.recovery === 'chemical' ? <>
              {field('fuelT', 'Propellant budget', 't', 0, 80, 1)}
              {field('thrustN', 'Total available thrust', 'N', 100, 10000, 100)}
              {field('isp', 'Specific impulse', 's', 150, 450, 5)}
              <p className="control-hint">The controller spends fuel to recover orbit and spin. It is bounded, not fuel-optimal.</p>
            </> : <div className="coast-explainer"><span className="tag">NO ACTIVE RECOVERY</span><h4>Let the trajectory play out.</h4><p>Propellant mass is zero. Thrusters are inactive. The second handoff still requires the same orbit and spin tolerances.</p><p>Your chemical budget is remembered only for switching back; it is not carried in this run.</p></div>}
            <a className="next-architecture" href="/lab/architectures/#recovery"><span>Other recovery concepts</span><b>Electrodynamics & incoming traffic ↗</b><small>Reference only in this build</small></a>
          </>}
        </div>
        <div className="design-summary"><div><span>Dry facility</span><b>{draft ? fmt(draft.body.mass / 1000, 1) : '—'} <small>t</small></b></div><p>{draft ? fmt(draft.body.structural / 1000, 1) : '—'} t tether + 34 t hub & terminals</p>
          <button className="primary run-design" disabled={busy || invalidFields.length > 0} onClick={() => { run(design); setMobile('fly'); }}>{busy ? 'Calculating…' : dirty ? 'Run changed design' : 'Run experiment'}<span aria-hidden="true">↗</span></button>
          {invalidFields.length > 0 && <p className="field-error">Correct {invalidFields.join(', ')} to run.</p>}
          <div className="file-actions"><button onClick={exportFile}>Export JSON</button><button onClick={() => fileInput.current?.click()}>Import design</button><input ref={fileInput} type="file" hidden accept=".json,application/json" onChange={e => importFile(e.target.files?.[0])} /></div>
        </div>
      </aside>

      <section className="flight-panel" aria-label="Flight workspace">
        <div className="scene-toolbar"><span className="scene-name"><i aria-hidden="true" />EARTH ORBIT</span><div className="view-switch" role="group" aria-label="View mode"><button disabled={!gpu} aria-pressed={view === 'earth'} onClick={() => setView('earth')}>Globe</button><button aria-pressed={view === 'plane'} onClick={() => setView('plane')}>Orbit plane</button><button disabled={!gpu} aria-pressed={view === 'follow'} onClick={() => setView('follow')}>Follow</button></div></div>
        <div className="scene-box">
          {result ? view === 'plane' ? <Plane result={result} clock={clock} /> : <Scene result={result} clock={clock} view={view} onFailure={error3D} /> : <div className="scene-loading"><div className="loading-orbit" /><h2>{busy ? 'Solving the trajectory' : 'Ready for a new experiment'}</h2><p>{busy ? 'Gravity, rotation, payload transfer and recovery.' : 'Choose a design and run the simulation.'}</p></div>}
          {busy && <div className="scene-pending">Calculating mission <button onClick={cancel}>Cancel</button></div>}
          {dirty && !busy && <div className="stale-notice">Unrun changes · scene and telemetry show the last calculation</div>}
          <div className="scene-legend"><span><i className="legend-line" />Tether / facility</span><span><i className="legend-line payload" />Payload</span><span><i className="legend-line dashed" />Initial orbit</span></div>
        </div>
        <div className="flight-console">
          <div className="scene-caption"><span>{view === 'plane' ? 'Same trajectory · flat orbital view' : 'Drag to orbit · scroll to zoom'}</span><span>Markers & cable width enlarged</span></div>
          <div className="transport"><button className="play-button" onClick={play} disabled={!result || busy || dirty} aria-label={playing ? 'Pause replay' : 'Play replay'}>{playing ? 'Ⅱ' : '▶'}</button><button className="icon-button" onClick={() => seek(0)} disabled={!result} aria-label="Restart replay">↺</button><button className="icon-button" onClick={nextEvent} disabled={!result} aria-label="Next mission event">▸|</button><span className="mission-clock">T+ <b>{elapsed(time)}</b></span><label className="speed-label">Playback<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={60}>60×</option><option value={240}>240×</option><option value={600}>600×</option></select></label></div>
          <input className="timeline-scrub" aria-label="Mission time" type="range" min={0} max={max || 1} step={1} value={time} disabled={!result} onChange={e => seek(Number(e.target.value))} />
          <div className="timeline-scale"><span>00:00:00</span><span>{max ? elapsed(max) : 'Awaiting calculation'}</span></div>
          <div className="timeline-events">{result?.events.filter(e => ['capture', 'release', 'ready', 'limit'].includes(e.kind)).map((e, i) => <button key={i} className={e.t <= time + .01 ? 'visited' : ''} onClick={() => seek(e.t)}><span>{elapsed(e.t)}</span>{e.title.replace('Payload ', '').replace(' captured', ' · capture').replace(' released', ' · release').replace('Orbit and spin recovered', 'Recovery window')}</button>)}</div>
        </div>
        <div className="mission-narration" aria-live="polite"><span className="micro">FLIGHT LOG</span><h2>{currentEvent?.title ?? 'A payload leaves. What happens next?'}</h2><p>{currentEvent?.detail ?? 'Select an experiment and run it. Every line in the scene follows a calculated state.'}</p></div>
      </section>

      <aside className="results-panel lab-panel" aria-label="Mission telemetry">
        <div className="panel-heading"><h2>Flight recorder</h2><span className="tag">{dirty ? 'LAST RUN' : 'MODEL OUTPUT'}</span></div>
        <div className="telemetry-scroll"><div className="delivery-count"><div><span className="micro">DELIVERIES</span><strong>{frame?.deliveries ?? 0}<small>/ 2</small></strong></div><p>{atEnd ? result?.outcome === 'complete' ? 'Second delivery achieved' : 'Experiment finished' : currentEvent?.kind === 'recovery' ? 'Recovering orbit & spin' : 'Capture. Transfer. Repeat.'}</p></div>
          <dl className="telemetry"><div><dt>Facility altitude</dt><dd>{frame ? fmt((Math.hypot(frame.state[0], frame.state[1]) - EARTH) / 1000) : '—'}<span>km</span></dd></div><div><dt>Closest tether point</dt><dd>{frame ? fmt(frame.clearance / 1000) : '—'}<span>km</span></dd></div><div><dt>Axial load margin</dt><dd className={frame && frame.margin < 1 ? 'bad' : ''}>{frame ? frame.margin > 99 ? '>99' : fmt(frame.margin, 2) : '—'}<span>×</span></dd></div>{result?.design.recovery === 'chemical' ? <div><dt>Propellant remaining</dt><dd>{frame ? fmt(frame.fuel / 1000, 2) : '—'}<span>t</span></dd></div> : <div className="coast-status"><dt>Recovery state</dt><dd>Coast<small>No active thrust · 0 t propellant</small></dd></div>}</dl>
          {result && <div className="trace-stack"><p className="micro">FULL RUN / CURSOR = REPLAY TIME</p><Trace result={result} time={time} metric="clearance" /><Trace result={result} time={time} metric="margin" /></div>}
          {atEnd && result && <div className={`outcome ${result.outcome === 'complete' ? 'success' : ''}`} role="status"><h3>{result.outcome === 'complete' ? 'Transport, recovered.' : result.outcome === 'limit' ? 'The model found a limit.' : 'Change one thing. Try again.'}</h3><p>{result.reason}</p>{result.design.recovery === 'chemical' && <p><b>{fmt(result.fuelUsed / 1000, 2)} t</b> propellant used by this controller.</p>}{result.deliveries.map(d => <p key={d.number}>Payload {d.number}: <b>{d.gain >= 0 ? '+' : ''}{fmt(d.gain / 1e6, 1)} MJ/kg</b></p>)}</div>}
          {previous && result && <details className="comparison"><summary>Compare with previous run</summary><div className="comparison-grid"><span /> <b>Previous</b><b>This run</b><span>Payload (t)</span><span>{previous.design.payloadT}</span><span>{result.design.payloadT}</span><span>Deliveries</span><span>{previous.deliveries.length}</span><span>{result.deliveries.length}</span><span>Fuel used (t)</span><span>{fmt(previous.fuelUsed / 1000, 2)}</span><span>{fmt(result.fuelUsed / 1000, 2)}</span><span>Dry mass (t)</span><span>{fmt(previous.dryMass / 1000, 1)}</span><span>{fmt(result.dryMass / 1000, 1)}</span></div><p>Complete-run totals, not a normalized ranking.</p></details>}
          <a className="recorder-help" href="/lab/method/#limits">What counts as a successful run? ↗</a>
        </div>
      </aside>
    </div>
    <footer className="lab-statusbar"><span><i aria-hidden="true" />{busy ? 'COMPUTING' : playing ? 'REPLAYING CALCULATED STATES' : 'READY'}<span className="status-separator">/</span>Local browser simulation</span><a href="/lab/method/">Planar rigid-body model. Read the limits ↗</a></footer>
  </main>;
}
