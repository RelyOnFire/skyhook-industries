import type { CSSProperties } from 'react';
import type { Frame, Result } from '../simulation/engine.js';
import { flightObjects, type ObjectId } from './objects.js';
import { elapsed, positions } from './view.js';

export default function ObjectTracker({ result, frame, selected, following, onSelect, onSeek }: {
  result: Result; frame: Frame; selected: ObjectId; following: boolean;
  onSelect: (id: ObjectId) => void; onSeek: (t: number) => void;
}) {
  const objects = flightObjects(result, frame), active = objects.find(o => o.id === selected)!;
  const approach = result.approaches.find(a => `payload-${a.payloadId}` === selected);
  const tip = positions(result, frame).z;
  const separation = active.state ? Math.hypot(active.state[0] - tip[0], active.state[1] - tip[1]) : null;
  return <section className="object-tracker" aria-label="Flight objects">
    <div className="object-choices" role="group" aria-label="Tracking selection">
      {objects.map(object => <button key={object.id} data-object-id={object.id} data-phase={object.phase}
        aria-label={`Select ${object.name}`} aria-pressed={selected === object.id}
        onClick={() => onSelect(object.id)} style={{ '--object-color': object.color } as CSSProperties}>
        <i className={`object-symbol ${object.glyph}`} aria-hidden="true" />
        <span><strong>{object.name}</strong><small>{object.status}</small></span>
      </button>)}
    </div>
    <div className="tracking-detail" data-selected-object={selected}>
      <span role="status" aria-live="polite"><b>{following ? 'Following' : 'Selected'}: {active.name}</b> · {active.state ? active.status : 'Not in the scene at this time'}</span>
      {active.phase === 'approach' && separation !== null && <span className="range-to-tip">{(separation / 1000).toFixed(1)} km from tip</span>}
      {!active.state && approach && <button onClick={() => onSeek(approach.startTime)}>Go to approach · {elapsed(approach.startTime)} →</button>}
    </div>
  </section>;
}
