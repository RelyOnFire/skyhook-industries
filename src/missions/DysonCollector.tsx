import { useEffect, useState } from 'react';
import { COLLECTOR_DEFAULTS, COLLECTOR_FIELDS, screenCollector, type CollectorInputs } from '../simulation/dyson-collector';

type FieldKey = keyof CollectorInputs;
type CollectorForm = Record<FieldKey, string>;
const initialForm = Object.fromEntries(COLLECTOR_FIELDS.map(field => [field.key, String(field.initial)])) as CollectorForm;
const number = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits });

function readCase(form: CollectorForm) {
  const inputs = Object.fromEntries(COLLECTOR_FIELDS.map(({ key }) => [key, form[key].trim() ? Number(form[key]) : NaN])) as CollectorInputs;
  return { inputs, result: screenCollector(inputs) };
}

function CaseResults({ inputs, result }: ReturnType<typeof readCase>) {
  if (!result.wholeSunInFront) return <div className="swarm-results">
    <p className="swarm-kicker">Model limit at {number(inputs.radiusAU, 3)} AU</p>
    <h3>Sunlight would reach the rear face.</h3>
    <p>The tilt required by the heat balance puts part of the solar disk behind the panel. This calculation needs a fully illuminated front face and a shaded rear face. Move farther from the Sun or model absorption across the solar disk on both surfaces.</p>
  </div>;
  const comparison = screenCollector({ ...inputs, radiusAU: 1 });
  const params = new URLSearchParams(COLLECTOR_FIELDS.map(({ key }) => [key, String(inputs[key])]));
  const csv = [
    'quantity,value,unit',
    ...COLLECTOR_FIELDS.map(field => `${field.key},${inputs[field.key]},${field.unit}`),
    'electricalTarget,1000000,W',
    `availableSolarFlux,${result.solarWm2},W/m2`, `incidentOnTiltedPanel,${result.incidentWm2},W/m2`,
    `electricalOutput,${result.dcWm2},W/m2`, `panelHeat,${result.heatWm2},W/m2`,
    `faceOnTemperature,${result.faceOnC},degC`, `minimumTilt,${result.tiltDeg},deg`,
    `crossoverDistance,${result.crossoverAU},AU`, `panelArea,${result.panelAreaM2},m2`,
    `panelMass,${result.panelMassKg},kg`,
  ].join('\r\n');
  return <div className="swarm-results">
    <p className="swarm-kicker">Operating point at {number(inputs.radiusAU, 3)} AU</p>
    <h3>{result.thermalLimited ? 'Heat limits output here.' : 'The panel can face the Sun.'}</h3>
    <p>{result.thermalLimited
      ? `Face-on, the panel would reach ${number(result.faceOnC, 1)} °C. Tilt its normal at least ${number(result.tiltDeg, 1)}° from the Sun to stay within the assumed ${number(inputs.limitC, 1)} °C ceiling.`
      : `Face-on operation gives a calculated ${number(result.faceOnC, 1)} °C, within the assumed ${number(inputs.limitC, 1)} °C ceiling.`}</p>
    <dl className="swarm-readout">
      <div><dt>DC power at panel terminals</dt><dd>{number(result.dcWm2, 1)} <small>W/m²</small></dd></div>
      <div><dt>Heat radiated by both faces</dt><dd>{number(result.heatWm2, 1)} <small>W/m² of panel</small></dd></div>
      <div><dt>Panel area for 1 MW DC</dt><dd>{number(result.panelAreaM2)} <small>m²</small></dd></div>
      <div><dt>Panel mass for 1 MW DC</dt><dd>{number(result.panelMassKg / 1000, 2)} <small>t</small></dd></div>
    </dl>
    <p>{comparison.wholeSunInFront
      ? <>At 1 AU, the same panel supplies <b>{number(comparison.dcWm2, 1)} W/m²</b>. </>
      : <>At 1 AU, the required tilt would expose the rear face to sunlight. </>}
      Inside <b>{number(result.crossoverAU, 3)} AU</b>, moving closer requires more tilt and yields the same modeled power per square metre while the rear face stays shaded.</p>
    <div className="swarm-case-links"><a href={`?${params}#collector-budget`}>Link to this case</a><a download="skyhook-swarm-collector.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}>Download calculation (CSV)</a></div>
  </div>;
}

export default function DysonCollector() {
  const [values, setValues] = useState<CollectorForm>(initialForm);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = { ...initialForm };
    for (const { key } of COLLECTOR_FIELDS) {
      if (params.has(key)) shared[key] = params.get(key) ?? '';
    }
    setValues(shared);
    setReady(true);
  }, []);
  let calculated: ReturnType<typeof readCase> | undefined;
  let invalid = '';
  try { calculated = readCase(values); }
  catch (error) { invalid = error instanceof Error ? error.message : 'Check the panel assumptions.'; }

  return <div className="swarm-budget">
    <fieldset className="swarm-inputs" disabled={!ready}>
      <legend>Collector assumptions</legend>
      {COLLECTOR_FIELDS.map(({ key, label, unit, min, max }) => <label key={key}>
        <span>{label} ({unit})</span>
        <input type="number" min={min} max={max} step="any" value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} />
      </label>)}
      <button type="button" onClick={() => setValues(initialForm)}>Reset assumptions</button>
    </fieldset>
    <section className="swarm-output" aria-label="Collector calculation" aria-live="polite" aria-atomic="true">
      {calculated ? <CaseResults {...calculated} /> : <p className="swarm-error">{invalid}</p>}
    </section>
  </div>;
}
