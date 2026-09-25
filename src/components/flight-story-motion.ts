/** Educational geometry in drawing units, NOT the Flight Studio solver.
 * The hub follows a circle and the rigid tether spins at constant rate. The
 * payload's finite-mass effect is omitted. Free flight uses the central gravity
 * that supports that hub circle, so release inherits velocity without a kick.
 * Recovery is a separately labeled, time-compressed orbit-raising schematic.
 */
export type Point = { x: number; y: number };
export const STORY = {
  earth: { x: 350, y: 760 },
  radius: 330,
  atmosphere: 344,
  orbit: 550,
  arm: 145,
  orbitRate: .32,
  spinRate: 1,
  approachDuration: .65,
  captureEnd: .1,
  releaseTime: 1.92,
  coastDuration: 1.1,
  recoveryOrbit: 505,
} as const;
export const STAGE_MS = [6000, 6000, 7000, 6000, 8000];
export const STILL_PROGRESS = [.72, .55, .65, .6, .7];
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, n: number): Point => ({ x: a.x * n, y: a.y * n });
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const distanceFromEarth = (p: Point) => Math.hypot(p.x - STORY.earth.x, p.y - STORY.earth.y);

export function tetherAt(time: number) {
  const phi = STORY.orbitRate * time;
  const angle = STORY.spinRate * time;
  const hub = add(STORY.earth, { x: STORY.orbit * Math.sin(phi), y: -STORY.orbit * Math.cos(phi) });
  const arm = { x: -STORY.arm * Math.sin(angle), y: STORY.arm * Math.cos(angle) };
  const hubVelocity = { x: STORY.orbit * STORY.orbitRate * Math.cos(phi), y: STORY.orbit * STORY.orbitRate * Math.sin(phi) };
  const spinVelocity = { x: -STORY.arm * STORY.spinRate * Math.cos(angle), y: -STORY.arm * STORY.spinRate * Math.sin(angle) };
  return { hub, tip: add(hub, arm), otherTip: add(hub, scale(arm, -1)), angle, hubVelocity, spinVelocity, velocity: add(hubVelocity, spinVelocity) };
}

export function approachAt(progress: number): Point {
  const p = clamp(progress);
  const pickupRadius = STORY.orbit - STORY.arm;
  // Powered climb: radius rises monotonically and its rate reaches zero at
  // pickup. The final angular derivative matches the arriving tip's velocity.
  const radius = STORY.radius + 18 + (pickupRadius - STORY.radius - 18) * smooth(p);
  const endSlope = STORY.approachDuration * tetherAt(0).velocity.x / pickupRadius;
  const phi = (2 * p ** 3 - 3 * p ** 2 + 1) * -.5
    + (p ** 3 - 2 * p ** 2 + p) * .6 + (p ** 3 - p ** 2) * endSlope;
  return add(STORY.earth, { x: radius * Math.sin(phi), y: -radius * Math.cos(phi) });
}

export const RELEASE = tetherAt(STORY.releaseTime);
export const STORY_MU = STORY.orbit ** 3 * STORY.orbitRate ** 2;
type CoastState = { position: Point; velocity: Point };
function derivative(s: CoastState): CoastState {
  const dx = s.position.x - STORY.earth.x, dy = s.position.y - STORY.earth.y;
  const factor = -STORY_MU / Math.hypot(dx, dy) ** 3;
  return { position: s.velocity, velocity: { x: dx * factor, y: dy * factor } };
}
function shifted(s: CoastState, d: CoastState, dt: number): CoastState {
  return { position: add(s.position, scale(d.position, dt)), velocity: add(s.velocity, scale(d.velocity, dt)) };
}
const coast: CoastState[] = [{ position: RELEASE.tip, velocity: RELEASE.velocity }];
const COAST_STEPS = 240;
const dt = STORY.coastDuration / COAST_STEPS;
for (let i = 0; i < COAST_STEPS; i++) {
  const s = coast[i], a = derivative(s), b = derivative(shifted(s, a, dt / 2)), c = derivative(shifted(s, b, dt / 2)), d = derivative(shifted(s, c, dt));
  const sum = (key: keyof CoastState) => scale(add(add(a[key], scale(b[key], 2)), add(scale(c[key], 2), d[key])), dt / 6);
  coast.push({ position: add(s.position, sum('position')), velocity: add(s.velocity, sum('velocity')) });
}
export function coastAt(progress: number): CoastState {
  const index = clamp(progress) * COAST_STEPS, i = Math.min(COAST_STEPS - 1, Math.floor(index)), f = index - i;
  return { position: mix(coast[i].position, coast[i + 1].position, f), velocity: mix(coast[i].velocity, coast[i + 1].velocity, f) };
}

export function storyFrame(stage: number, progress: number) {
  const p = clamp(progress);
  const time = stage === 0 ? STORY.approachDuration * (p - 1)
    : stage === 1 ? STORY.captureEnd * p
    : stage === 2 ? STORY.captureEnd + (STORY.releaseTime - STORY.captureEnd) * p
    : STORY.releaseTime + STORY.coastDuration * p;
  const tether = tetherAt(time);
  if (stage === 4) {
    // Later passes, compressed in time: rising orbital energy is represented
    // by an outward spiral. This is explanatory geometry, not a thrust solve.
    const phi = -.14 + .53 * p;
    const radius = STORY.recoveryOrbit + (STORY.orbit - STORY.recoveryOrbit) * smooth(p);
    const hub = add(STORY.earth, { x: radius * Math.sin(phi), y: -radius * Math.cos(phi) });
    const angle = .9 + p * 1.7;
    const arm = { x: -STORY.arm * Math.sin(angle), y: STORY.arm * Math.cos(angle) };
    return { hub, angle, tip: add(hub, arm), otherTip: add(hub, scale(arm, -1)), payload: null, prograde: { x: Math.cos(phi), y: Math.sin(phi) } };
  }
  return { ...tether, payload: stage === 0 ? approachAt(p) : stage === 3 ? coastAt(p).position : tether.tip, prograde: { x: 1, y: 0 } };
}

export function storyPath(stage: number): string {
  return Array.from({ length: 101 }, (_, i) => {
    const f = storyFrame(stage, i / 100), p = stage === 4 ? f.hub : f.payload!;
    return `${i ? 'L' : 'M'}${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
  }).join(' ');
}

/** Schematic Lorentz force for a uniform field into the drawing. Switch
 * conventional current with spin phase to keep the along-orbit force positive.
 * Gate it near perpendicular alignment; this is not a plasma/current solver.
 */
export function electrodynamicDrive(angle: number, prograde: Point) {
  const normal = { x: Math.cos(angle), y: Math.sin(angle) };
  const alignment = normal.x * prograde.x + normal.y * prograde.y;
  const direction = alignment >= 0 ? 1 : -1;
  const strength = smooth(clamp((Math.abs(alignment) - .08) / .12));
  return { direction, strength, force: scale(normal, direction * strength) };
}

/** Camera and illustrative grapple choreography share the scrubber clock.
 * The camera returns exactly to the wide frame before Swing; it never changes
 * the trajectory. Jaw geometry illustrates a capture concept, not hardware.
 */
export function captureDetail(progress: number) {
  const p = clamp(progress);
  const zoom = smooth(clamp(p / .24)) * (1 - smooth(clamp((p - .74) / .26)));
  const closure = smooth(clamp((p - .28) / .3));
  const tip = storyFrame(1, p).tip;
  const scale = 1 + 5 * zoom;
  return {
    scale, x: zoom * (440 - 6 * tip.x), y: zoom * (298 - 6 * tip.y),
    jawAngle: 36 * (1 - closure), locked: p >= .62,
    detailOpacity: zoom,
    phase: p < .28 ? 0 : p < .62 ? 1 : p < .78 ? 2 : 3,
  };
}
