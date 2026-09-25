import { CARGO, type Campaign } from './model.js';

/** Change an existing supply line without changing its place in the departure queue.
 * Its next successful departure starts the new interval; cargo in transit keeps its
 * original payload and arrival, and all accumulated service history is retained. */
export function updateService(world: Campaign, id: number, cargoT: number, intervalDays: number): Campaign {
  const service = world.services.find(s => s.id === id);
  if (!service) throw Error('Service not found.');
  if (!Number.isInteger(cargoT) || cargoT < 1 || cargoT > (service.mode === 'tug' ? 10 : 30)) {
    throw Error('Choose a whole payload from 1 to '+(service.mode === 'tug' ? 10 : 30)+' tonnes.');
  }
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
    throw Error('Choose an interval from 1 to 3,650 whole days.');
  }
  if (service.cargoT === cargoT && service.intervalDays === intervalDays) return world;

  const next = structuredClone(world);
  const updated = next.services.find(s => s.id === id)!;
  updated.cargoT = cargoT;
  updated.intervalDays = intervalDays;
  next.revision++;
  next.log.push({ day: world.day, text: 'Service '+id+' updated: '+cargoT+' t '+CARGO[service.kind].toLowerCase()+', every '+intervalDays+' days. Its next attempt is unchanged.' });
  next.log = next.log.slice(-60);
  return next;
}
