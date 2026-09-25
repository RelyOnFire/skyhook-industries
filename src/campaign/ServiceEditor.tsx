import { useEffect, useId, useRef, useState } from 'react';
import { type Campaign, type Service } from './model.js';
import { updateService } from './service-edit.js';
import './service-editor.css';

type Props = {
  world: Campaign;
  service: Service;
  busy: boolean;
  act: (fn: (world: Campaign) => Campaign) => void;
};

export default function ServiceEditor({world, service, busy, act}: Props) {
  const id = useId(), toggle = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
  const [editing, setEditing] = useState(false);
  const [cargo, setCargo] = useState(String(service.cargoT));
  const [interval, setInterval] = useState(String(service.intervalDays));
  const maximum = service.mode === 'tug' ? 10 : 30;
  useEffect(() => {
    if (!editing && !busy && restoreFocus.current) { toggle.current?.focus(); restoreFocus.current = false; }
  }, [editing, busy]);
  const close = () => { restoreFocus.current = true; setEditing(false); };
  const open = () => {
    setCargo(String(service.cargoT));
    setInterval(String(service.intervalDays));
    setEditing(true);
  };
  const attempt = service.enabled ? 'Next attempt stays on day '+service.nextDay.toLocaleString('en-US', {maximumFractionDigits: 1})+'.' : 'This service stays paused.';

  return <>
    <button type="button" ref={toggle} className="service-edit-toggle" disabled={busy} aria-label={'Edit service '+service.id} aria-expanded={editing} aria-controls={editing ? id : undefined} onClick={() => editing ? close() : open()}>Edit</button>
    {editing && <form id={id} className="service-editor" aria-label={'Edit service '+service.id} aria-describedby={id+'-timing'} onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      const mass = Number(cargo), days = Number(interval);
      if (mass !== service.cargoT || days !== service.intervalDays) act(current => updateService(current, service.id, mass, days));
      close();
    }} onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <div className="service-editor-fields">
        <label htmlFor={id+'-cargo'}>Payload · t<input autoFocus id={id+'-cargo'} type="number" inputMode="numeric" required min={1} max={maximum} step={1} value={cargo} disabled={busy} onChange={event => setCargo(event.target.value)}/></label>
        <label htmlFor={id+'-interval'}>Interval · days<input id={id+'-interval'} type="number" inputMode="numeric" required min={1} max={3650} step={1} value={interval} disabled={busy} onChange={event => setInterval(event.target.value)}/></label>
      </div>
      <p id={id+'-timing'}>{attempt} The new interval starts after its next successful departure. Cargo in flight keeps its arrival.</p>
      {service.mode === 'tether' && Number(cargo) > 10 * Math.min(world.ports[service.from].level, world.ports[service.to].level) && <p className="service-editor-capacity">This payload needs tier {Math.ceil(Number(cargo)/10)} tethers at both ends before it can depart.</p>}
      <div className="service-editor-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="primary" disabled={busy}>Save service</button></div>
    </form>}
  </>;
}
