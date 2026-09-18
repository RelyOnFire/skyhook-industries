import { CARGO, SITE, type Campaign, type SiteId } from './model.js';

/** Presentation-only identities: cargo and mirror launch numbers can overlap. */
export type TrafficId = `cargo-${number}` | `mirror-${number}`;
export interface TrafficItem {
  id: TrafficId; label: string; from: SiteId; to: SiteId | 'swarm';
  fromName: string; toName: string; mass: number;
  kind: 'materials' | 'equipment' | 'mirrors'; cargo: string;
  departed: number; arrival: number;
}
export function trafficItems(world: Campaign): TrafficItem[] {
  return [
    ...world.flights.map(f=>({id:`cargo-${f.id}` as const,label:'Flight '+f.id,from:f.from,to:f.to,
      fromName:SITE[f.from].name,toName:SITE[f.to].name,mass:f.cargoT,kind:f.kind,cargo:CARGO[f.kind],departed:f.departed,arrival:f.arrival})),
    ...world.solar.deployments.map(d=>({id:`mirror-${d.id}` as const,label:'Mirror launch '+d.id,from:'mercury' as const,to:'swarm' as const,
      fromName:'Mercury',toName:'Solar swarm',mass:d.massT,kind:'mirrors' as const,cargo:'Mirrors',departed:d.departed,arrival:d.arrival})),
  ].sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id));
}
