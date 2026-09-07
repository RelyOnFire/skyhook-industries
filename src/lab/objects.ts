/** One identity/color registry shared by the globe, flat view and object list.
 * Identity never depends on which shipment happens to be attached now. */
import type { Frame, PayloadId, Result } from '../simulation/engine.js';
import { positions } from './view.js';
export type ObjectId = 'facility' | 'payload-1' | 'payload-2';
export const OBJECTS = [
  { id: 'facility', name: 'Facility', color: '#7de7ee', glyph: 'square' },
  { id: 'payload-1', name: 'Payload 1', color: '#ffbd83', glyph: 'circle' },
  { id: 'payload-2', name: 'Payload 2', color: '#c9b8ff', glyph: 'diamond' },
] as const;
export interface FlightObject {
  id: ObjectId; name: string; color: string; glyph: string;
  phase: 'facility' | 'approach' | 'attached' | 'released' | 'absent';
  status: string; state: number[] | null;
}
export function flightObjects(r: Result, f: Frame): FlightObject[] {
  const p = positions(r, f);
  return OBJECTS.map((object, index): FlightObject => {
    if (!index) return { ...object, phase: 'facility', state: p.hub,
      status: f.burn ? 'Reboosting orbit & spin' : f.loaded ? `Carrying Payload ${f.deliveries + 1}` : 'Coasting' };
    const id = index as PayloadId;
    if (f.payloads[index - 1]) return { ...object, phase: 'released', status: 'Released · independent orbit', state: f.payloads[index - 1] };
    if (f.loaded && f.deliveries + 1 === id) return { ...object, phase: 'attached', status: 'Attached to working tip', state: p.z };
    if (f.incomingId === id && f.incoming) return { ...object, phase: 'approach', status: 'On calculated approach', state: f.incoming };
    return { ...object, phase: 'absent', status: r.approaches.some(a => a.payloadId === id) ? 'Before recorded approach' : 'Not scheduled in this run', state: null };
  });
}
export function trackedObject(r: Result, f: Frame, id: ObjectId): FlightObject {
  return flightObjects(r, f).find(object => object.id === id)!;
}
