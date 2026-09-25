import { STAGE_MS, STILL_PROGRESS, storyFrame, storyPath } from './flight-story-motion';

const steps = [
  { title: 'Climb to the meeting point.', description: 'The vehicle approaches from below, gaining altitude until it meets the lower tip. At pickup, its position and velocity must closely match the tip. The tip is moving with the orbit, slowed by the tether’s opposing rotation.', value: '100 km', readout: 'Pickup altitude in the reference comparison', explanation: 'Climb from Earth → meet the lower tip' },
  { title: 'Secure the payload.', description: 'Capture takes place at the bottom of this pass. The same tip then starts carrying the payload upward. A real capture mechanism must absorb small errors and transfer the load without damaging either vehicle or tether.', value: '4.1 km/s', readout: 'Tip speed relative to Earth in the comparison case; closing speed must be much smaller', explanation: 'Match position + speed → secure the payload' },
  { title: 'Carry the payload outward.', description: 'Follow the copper marker: it stays on the same end of the tether and rises away from Earth. Momentum exchange gives the payload energy while changing the facility’s orbit and rotation.', value: 'Momentum', readout: 'Energy gained by the payload comes from the facility', explanation: 'The same tip carries the payload outward' },
  { title: 'Let its velocity carry it onward.', description: 'Release adds no extra kick. The payload keeps its velocity from the orbit and the tether’s spin, then gravity curves its path. This example releases partway through the swing; the right moment depends on the destination.', value: 'Orbit + spin', readout: 'The two velocity vectors set the departure direction', explanation: 'Orbit velocity + spin velocity → departure direction' },
  { title: 'Power the orbit back up.', description: 'Solar electricity drives current through a conducting element. Earth’s magnetic field exerts a force on that current, creating thrust. Over many passes, reboost restores orbital energy; the tether’s spin also needs control.', value: 'Electrical reboost', readout: 'The highlighted path shows an orbit being raised over later passes', explanation: 'Solar power → electric current → magnetic thrust' },
];
const names = ['APPROACH', 'CAPTURE', 'SWING', 'RELEASE', 'RECOVER'];

document.querySelectorAll<HTMLElement>('[data-flight-story]').forEach((story) => {
  const node = <T extends Element>(selector: string) => story.querySelector<T>(selector)!;
  const buttons = Array.from(story.querySelectorAll<HTMLButtonElement>('[data-story-step]'));
  const motionButton = node<HTMLButtonElement>('[data-story-motion]');
  const scrubber = node<HTMLInputElement>('[data-story-progress]');
  const tether = node<SVGGElement>('[data-story-tether]');
  const payload = node<SVGGElement>('[data-story-payload]');
  const capture = node<SVGPathElement>('[data-story-capture]');
  const recovery = node<SVGGElement>('[data-story-recovery]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, progress = reducedMotion.matches ? STILL_PROGRESS[0] : 0;
  let wantsMotion = !reducedMotion.matches, visible = false;
  let lastTime: number | null = null, frame = 0;

  const text = (selector: string, value: string) => { node<HTMLElement>(selector).textContent = value; };
  const draw = () => {
    const f = storyFrame(current, progress);
    tether.setAttribute('transform', `translate(${f.hub.x} ${f.hub.y}) rotate(${f.angle * 180 / Math.PI})`);
    payload.setAttribute('opacity', f.payload ? '1' : '0');
    if (f.payload) payload.setAttribute('transform', `translate(${f.payload.x} ${f.payload.y})`);
    capture.setAttribute('transform', `translate(${f.tip.x} ${f.tip.y}) scale(${1.4 - progress * .4})`);
    recovery.setAttribute('transform', `translate(${f.hub.x} ${f.hub.y})`);
    const thrust = node<SVGLineElement>('[data-story-thrust]');
    thrust.setAttribute('x2', String(f.prograde.x * 130));
    thrust.setAttribute('y2', String(-87 + f.prograde.y * 130));
    node<SVGGElement>('[data-story-current]').setAttribute('transform', `translate(0 ${(progress * 88) % 22 - 11})`);
    scrubber.value = String(Math.round(progress * 1000));
    scrubber.setAttribute('aria-valuetext', `${Math.round(progress * 100)}% through ${names[current].toLowerCase()}`);
    motionButton.textContent = progress >= 1 ? 'Replay stage' : wantsMotion ? 'Pause animation' : 'Play animation';
  };
  const tick = (now: number) => {
    frame = 0;
    if (!wantsMotion || !visible || document.hidden || progress >= 1) { lastTime = null; return; }
    if (lastTime !== null) progress = Math.min(1, progress + Math.max(0, now - lastTime) / STAGE_MS[current]);
    lastTime = now;
    draw();
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  const syncPlayback = () => {
    cancelAnimationFrame(frame);
    lastTime = null;
    if (wantsMotion && visible && !document.hidden && progress < 1) frame = requestAnimationFrame(tick);
  };
  const select = (index: number) => {
    current = index;
    progress = wantsMotion ? 0 : STILL_PROGRESS[index];
    const step = steps[index];
    story.dataset.stage = String(index);
    text('[data-story-number]', `0${index + 1} / ${names[index]}`);
    for (const key of ['title', 'description', 'value', 'readout', 'explanation'] as const) text(`[data-story-${key}]`, step[key]);
    text('[data-story-scene-description]', step.explanation + '. ' + step.description);
    text('[data-story-timescale]', index === 4 ? 'LATER ORBITS · TIME COMPRESSED' : 'ILLUSTRATION · NOT TO SCALE');
    node<SVGPathElement>('[data-story-path]').setAttribute('d', storyPath(index));
    node<SVGGElement>('[data-story-pickup]').setAttribute('opacity', index < 2 ? '1' : '0');
    capture.setAttribute('opacity', index === 1 ? '1' : '0');
    node<SVGGElement>('[data-story-velocity]').setAttribute('opacity', index === 3 ? '1' : '0');
    recovery.setAttribute('opacity', index === 4 ? '1' : '0');
    node<SVGGElement>('[data-story-recovery-orbits]').setAttribute('opacity', index === 4 ? '1' : '0');
    buttons.forEach((button, i) => i === index ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
    draw(); syncPlayback();
  };
  buttons.forEach((button, index) => { button.disabled = false; button.addEventListener('click', () => select(index)); });
  motionButton.addEventListener('click', () => {
    if (progress >= 1) { progress = 0; wantsMotion = true; }
    else wantsMotion = !wantsMotion;
    draw(); syncPlayback();
  });
  scrubber.addEventListener('input', () => { progress = Number(scrubber.value) / 1000; wantsMotion = false; draw(); syncPlayback(); });
  reducedMotion.addEventListener('change', (event) => { wantsMotion = !event.matches; draw(); syncPlayback(); });
  document.addEventListener('visibilitychange', syncPlayback);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); }, { threshold: .05 });
  observer.observe(story);
  motionButton.hidden = false;
  node<HTMLElement>('[data-story-scrubber]').hidden = false;
  draw();
});
