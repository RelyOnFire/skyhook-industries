import { useEffect, useState } from 'react';
import { ACTIVE_ARCHITECTURE, DEFAULT, type Design } from '../simulation/engine.js';
import { designFragment, readDesign } from '../simulation/design-io.js';
import { captureScreen, EXAMPLE_CAPTURE, type CaptureAxis } from '../simulation/capture-screen.js';
import './capture-screen.css';

const format = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
const fields = [
  { name: 'speedMs', label: 'Closing speed error', unit: 'm/s', min: 0 },
  { name: 'strokeM', label: 'Available stopping stroke', unit: 'm', min: 0 },
  { name: 'forceKN', label: 'Additional contact force limit', unit: 'kN', min: 0 },
] as const;
const defaults = { speedMs: String(EXAMPLE_CAPTURE.speedMs), strokeM: String(EXAMPLE_CAPTURE.strokeM), forceKN: String(EXAMPLE_CAPTURE.forceKN) };

export default function CaptureScreen() {
  const [design, setDesign] = useState<Design>(DEFAULT);
  const [values, setValues] = useState(defaults);
  const [axis, setAxis] = useState<CaptureAxis>(EXAMPLE_CAPTURE.axis);
  const [designError, setDesignError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      // Earlier study links used the Studio's design fragment. Migrate once so
      // jumping to methodology or evidence never discards the active case.
      const legacy = new URLSearchParams(location.hash.slice(1));
      if (!params.size && (legacy.has('d') || legacy.has('axis') || fields.some(field => legacy.has(field.name)))) {
        for (const [key, value] of legacy) params.set(key, value);
        history.replaceState(history.state, '', location.pathname + '?' + params.toString());
      }
      let loaded = DEFAULT;
      if (params.has('d')) {
        const imported = readDesign(params.get('d')!);
        if (imported.needsConfirmation) throw Error('Open the older design in Flight Studio to review and update it first.');
        if (imported.design.architecture !== ACTIVE_ARCHITECTURE) throw Error('This study requires an Earth single-stage design.');
        loaded = imported.design;
      }
      const direction = params.get('axis') ?? EXAMPLE_CAPTURE.axis;
      if (direction !== 'along' && direction !== 'across') throw Error('The case link contains an unknown contact direction.');
      setDesign(loaded);
      setAxis(direction);
      setValues({ speedMs: params.get('speedMs') ?? defaults.speedMs, strokeM: params.get('strokeM') ?? defaults.strokeM,
        forceKN: params.get('forceKN') ?? defaults.forceKN });
    } catch (e) { setDesignError((e as Error).message); }
    setReady(true);
  }, []);

  if (designError) return <div className="guide-note" role="alert"><p>{designError} <a href="/lab/capture/">Open the reference case</a>.</p></div>;
  const numeric = (s: string) => s.trim() ? Number(s) : NaN;
  const input = { speedMs: numeric(values.speedMs), strokeM: numeric(values.strokeM), forceKN: numeric(values.forceKN), axis };
  let result, error = '';
  try { result = captureScreen(design, input); } catch (e) { error = (e as Error).message; }
  const params = new URLSearchParams(designFragment(design).slice(1));
  params.set('axis', axis);
  fields.forEach(f => params.set(f.name, values[f.name]));
  return <section className="capture-calculator" aria-labelledby="capture-case">
    <div className="capture-inputs">
      <h2 id="capture-case">Set the contact conditions</h2>
      <p>The example force and stroke are design assumptions. Replace them with measurements from your mechanism.</p>
      <p className="capture-design">{format(design.spanKm)} km span · {format(design.payloadT)} t payload · {design.model}
        <br/><a href={'/lab/' + designFragment(design)}>Edit this design in Flight Studio</a></p>
      <fieldset disabled={!ready}>
        <legend>Contact inputs</legend>
        {fields.map(field => <label key={field.name} className="capture-field">
          <span>{field.label} ({field.unit})</span>
          <input type="number" step="any" min={field.min} value={values[field.name]}
            onChange={e => setValues({...values, [field.name]: e.target.value})}/>
        </label>)}
        <label className="capture-field"><span>Direction at contact</span><select value={axis} onChange={e => setAxis(e.target.value as CaptureAxis)}>
          <option value="along">Along the tether</option><option value="across">Across the tether, in plane</option></select></label>
      </fieldset>
      <noscript><p>The reference case is shown. Enable JavaScript to change its inputs.</p></noscript>
    </div>
    <div className="capture-result" aria-live="polite" aria-atomic="true">
      {result ? <>
        <p className="micro">WORK REQUIRED AT CONTACT</p>
        <p className="capture-energy">{format(result.energyJ / 1000)} <small>kJ</small></p>
        <h3>{result.exceedsBudget ? 'Stroke and force budget exceeded' : 'Within the ideal work budget'}</h3>
        <p>{result.exceedsBudget
          ? 'Even a constant force at the entered limit over the full stroke cannot absorb this mismatch.'
          : 'The entered stroke can absorb this energy if the mechanism develops enough force throughout its travel. Peak loads and latching still need testing.'}</p>
        <dl>
          <div><dt>Ideal work capacity</dt><dd>{format(result.idealCapacityJ / 1000)} kJ</dd></div>
          <div><dt>Mean force over available stroke</dt><dd>{format(result.meanForceN / 1000)} kN</dd></div>
          <div><dt>Minimum stroke at the force limit</dt><dd>{format(result.minStrokeM)} m</dd></div>
          <div><dt>Ideal closing-speed ceiling</dt><dd>{format(result.speedLimitMs)} m/s</dd></div>
        </dl>
        <p className="capture-detail">Effective contact mass {format(result.effectiveKg)} kg · facility mass {format(result.facilityKg / 1000)} t · lever arm {format(result.armM / 1000)} km · inertia {result.inertia.toExponential(3)} kg·m².</p>
        {ready && <a href={'/lab/capture/?' + params.toString()}>Permalink to these inputs</a>}
      </> : <p role="alert">{error}</p>}
    </div>
  </section>;
}
