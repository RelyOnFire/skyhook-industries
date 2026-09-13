/** Presentation-only placement: measured plot positions are never jittered.
 * Numbered callouts keep coincident results individually selectable. */
export interface PlotPoint { x: number; y: number }
export interface PlotLabel { x: number; y: number; width: number; height: number }
export function layoutStudyLabels(points: readonly PlotPoint[]): (PlotLabel | null)[] {
  const placed: PlotLabel[] = [];
  const width = 28, height = 24, gap = 6;
  const available = (box: PlotLabel) =>
    box.x >= 65 && box.x + width <= 565 && box.y >= 26 && box.y + height <= 235 &&
    !placed.some(a => box.x < a.x + a.width + gap && box.x + width + gap > a.x &&
      box.y < a.y + a.height + gap && box.y + height + gap > a.y) &&
    !points.some(p => p.x + 21 > box.x && p.x - 21 < box.x + width &&
      p.y + 21 > box.y && p.y - 21 < box.y + height);
  return points.map(p => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const candidates: PlotLabel[] = [];
    for (const dy of [-24, 8, -56, 40, -88, 72, -120, 104, -152, 136, -184, 168]) {
      for (const x of [p.x + 24, p.x - width - 24])
        candidates.push({ x, y: p.y + dy, width, height });
    }
    // Bounded fallback for a crowded edge; the exact-value table remains usable
    // even if an eventual larger study cannot fit every on-chart callout.
    for (let y = 26; y + height <= 235; y += height + gap)
      for (let x = 65; x + width <= 565; x += width + gap)
        candidates.push({ x, y, width, height });
    const chosen = candidates.find(available);
    if (chosen) placed.push(chosen);
    return chosen ?? null;
  });
}
