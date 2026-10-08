import { useEffect, useState } from 'react';

export type StudioUnits = { distance: 'km' | 'm'; speed: 'km/s' | 'm/s'; force: 'kN' | 'N' };
const KEY = 'skyhook-studio-display-units-v1';
const DEFAULT_UNITS: StudioUnits = { distance: 'km', speed: 'km/s', force: 'kN' };

export function useStudioUnits(): [StudioUnits, (next: StudioUnits) => void] {
  const [units, setUnits] = useState<StudioUnits>(DEFAULT_UNITS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && ['km', 'm'].includes(saved.distance) && ['km/s', 'm/s'].includes(saved.speed) && ['kN', 'N'].includes(saved.force)) setUnits(saved);
    } catch { /* Display preference remains usable without storage. */ }
  }, []);
  const change = (next: StudioUnits) => {
    setUnits(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep the session preference. */ }
  };
  return [units, change];
}

export function unitScale(unit: string): number {
  return unit === 'm' || unit === 'm/s' ? 1000 : unit === 'kN' ? .001 : 1;
}

export function displayNumber(value: number, scale: number): number {
  return Number((value * scale).toPrecision(12));
}

export function modelNumber(value: number, scale: number): number {
  return Number((value / scale).toPrecision(12));
}

// Presentation only. Study results and portable reports retain their model units.
export function shownUnit(source: string, units: StudioUnits): string {
  return source === 'km' || source === 'm' ? units.distance
    : source === 'km/s' || source === 'm/s' ? units.speed
    : source === 'kN' || source === 'N' ? units.force : source;
}

export function shownValue(value: number, source: string, units: StudioUnits): number {
  const target = shownUnit(source, units);
  if (source === target) return value;
  if ((source === 'km' && target === 'm') || (source === 'km/s' && target === 'm/s') || (source === 'kN' && target === 'N')) return displayNumber(value,1000);
  if ((source === 'm' && target === 'km') || (source === 'm/s' && target === 'km/s') || (source === 'N' && target === 'kN')) return modelNumber(value,1000);
  return value;
}

export default function UnitPicker({ units, onChange }: { units: StudioUnits; onChange: (next: StudioUnits) => void }) {
  return <div className="studio-units" role="group" aria-label="Flight Studio display units">
    <span>DISPLAY UNITS</span>
    <label>Distance <select aria-label="Distance unit" value={units.distance} onChange={e => onChange({ ...units, distance: e.target.value as StudioUnits['distance'] })}><option value="km">km</option><option value="m">m</option></select></label>
    <label>Speed / Δv <select aria-label="Speed unit" value={units.speed} onChange={e => onChange({ ...units, speed: e.target.value as StudioUnits['speed'] })}><option value="km/s">km/s</option><option value="m/s">m/s</option></select></label>
    <label>Force <select aria-label="Force unit" value={units.force} onChange={e => onChange({ ...units, force: e.target.value as StudioUnits['force'] })}><option value="kN">kN</option><option value="N">N</option></select></label>
    <small>Thrust is force; Δv is velocity change during a burn.</small>
  </div>;
}
