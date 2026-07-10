/**
 * Shared geometry helpers for the /home Vitality tile art. Turns a raw data
 * series into normalised coordinates inside a fixed SVG viewBox so each art
 * component can stay declarative.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Maps `values` into `count`-or-fewer points spanning the box [padX, W-padX] ×
 * [H-padY, padY] (y flipped so larger values sit higher). Flat/empty series
 * fall back to a gentle mid-line so a tile never renders empty.
 */
export function seriesPoints(
  values: number[],
  W: number,
  H: number,
  padX: number,
  padY: number
): Point[] {
  const clean = values.filter((v) => Number.isFinite(v));
  const data = clean.length >= 2 ? clean : [0.4, 0.55, 0.45, 0.6, 0.5];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  return data.map((v, i) => ({
    x: padX + (innerW * i) / (data.length - 1),
    y: padY + innerH * (1 - (v - min) / span),
  }));
}

/** A smooth catmull-rom-ish path through the points (mono-ish, no overshoot). */
export function smoothPath(pts: Point[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(
      1
    )} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Rough pixel length of a polyline through the points — feeds stroke-dasharray. */
export function pathLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  // Bezier smoothing adds a little; pad so the draw-in fully covers the stroke.
  return Math.ceil(len * 1.25) || 100;
}
