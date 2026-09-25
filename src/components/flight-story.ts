import { STAGE_MS, STILL_PROGRESS, STORY, captureDetail, electrodynamicDrive, storyFrame, storyPath } from './flight-story-motion';

const steps = [
  { title: 'Climb to the meeting point.', description: 'The vehicle approaches from below, gaining altitude until it meets the lower tip. At pickup, its position and velocity must closely match the tip. The tip is moving with the orbit, slowed by the tether’s opposing rotation.', value: '100 km', readout: 'Pickup altitude in the reference comparison', explanation: 'Climb from Earth → meet the lower tip' },
  { title: 'Secure the payload.', description: 'At the bottom of the pass, payload and tip meet with closely matched motion. Watch the grapple’s jaws close around the capture fitting, then latch before the swing. This illustrates the handoff; real hardware must absorb small errors and transfer the load gently.', value: '4.1 km/s', readout: 'Tip speed relative to Earth in the comparison case; closing speed must be much smaller', explanation: 'Match position + speed → secure the payload' },
  { title: 'Carry the payload outward.', description: 'Follow the copper marker: it stays on the same end of the tether and rises away from Earth. Momentum exchange gives the payload energy while changing the facility’s orbit and rotation.', value: 'Momentum', readout: 'Energy gained by the payload comes from the facility', explanation: 'The same tip carries the payload outward' },
  { title: 'Let its velocity carry it onward.', description: 'Release adds no extra kick. The payload keeps its velocity from the orbit and the tether’s spin, then gravity curves its path. This example releases partway through the swing; the right moment depends on the destination.', value: 'Orbit + spin', readout: 'The two velocity vectors set the departure direction', explanation: 'Orbit velocity + spin velocity → departure direction' },
  { title: 'Power the orbit back up.', description: 'Solar power drives current through a conductor built into the spinning tether. Its interaction with Earth’s magnetic field produces thrust. Current is controlled through the spin to add orbital energy over many passes; spin recovery also needs control.', value: 'Electrical reboost', readout: 'The highlighted path shows an orbit being raised over later passes', explanation: 'Current within the tether → magnetic thrust' },
];
const chemical = { title: 'Power the orbit back up.', description: 'A rocket engine on the hub burns stored propellant. A gimbaled mount keeps thrust pointed along the orbit as the tether rotates, sending exhaust backward. Reboost restores orbital energy; propellant needs resupply, and spin recovery needs separate control.', value: 'Chemical reboost', readout: 'Forward thrust raises the orbit; stored propellant is consumed', explanation: 'Propellant → backward exhaust → forward thrust' };
const names = ['APPROACH', 'CAPTURE', 'SWING', 'RELEASE', 'RECOVER'];

document.querySelectorAll<HTMLElement>('[data-flight-story]').forEach((story) => {
  const node = <T extends Element>(selector: string) => story.querySelector<T>(selector)!;
  const buttons = Array.from(story.querySelectorAll<HTMLButtonElement>('[data-story-step]'));
  const motionButton = node<HTMLButtonElement>('[data-story-motion]');
  const scrubber = node<HTMLInputElement>('[data-story-progress]');
  const tether = node<SVGGElement>('[data-story-tether]');
  const payload = node<SVGGElement>('[data-story-payload]');
  const capture = node<SVGGElement>('[data-story-capture]');
  const recovery = node<SVGGElement>('[data-story-recovery]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let method: 'electrical' | 'chemical' = 'electrical';
  let current = 0, progress = reducedMotion.matches ? STILL_PROGRESS[0] : 0;
  let wantsMotion = !reducedMotion.matches, visible = false;
  let lastTime: number | null = null, frame = 0;

  const text = (selector: string, value: string) => { const element = node<HTMLElement>(selector); if (element.textContent !== value) element.textContent = value; };
  const draw = () => {
    const f = storyFrame(current, progress);
    tether.setAttribute('transform', `translate(${f.hub.x} ${f.hub.y}) rotate(${f.angle * 180 / Math.PI})`);
    payload.setAttribute('opacity', f.payload ? '1' : '0');
    if (f.payload) payload.setAttribute('transform', `translate(${f.payload.x} ${f.payload.y})`);
    const detail = captureDetail(progress);
    const capturing = current === 1;
    capture.setAttribute('opacity', capturing ? String(detail.detailOpacity) : '0');
    node<SVGGElement>('[data-story-world]').setAttribute('transform', capturing ? `translate(${detail.x} ${detail.y}) scale(${detail.scale})` : 'translate(0 0) scale(1)');
    capture.setAttribute('transform', `translate(${f.tip.x} ${f.tip.y}) rotate(${f.angle * 180 / Math.PI})`);
    const jawAngle = capturing ? detail.jawAngle : current === 2 ? 0 : 36;
    node<SVGPathElement>('[data-story-jaw="left"]').setAttribute('transform', `translate(-14 -18) rotate(${jawAngle})`);
    node<SVGPathElement>('[data-story-jaw="right"]').setAttribute('transform', `translate(14 -18) rotate(${-jawAngle})`);
    node<SVGPathElement>('[data-story-latch]').setAttribute('opacity', capturing && detail.locked ? '1' : '0');
    node<SVGGElement>('[data-story-closeup-labels]').setAttribute('opacity', capturing ? String(detail.detailOpacity) : '0');
    node<SVGGElement>('[data-story-pickup]').setAttribute('opacity', current === 0 ? '1' : capturing ? String(Math.max(0, 1 - 4 * detail.detailOpacity)) : '0');
    if (capturing) {
      const phases = ['Match motion', 'Grapple closing', 'Latch confirmed', 'Ready to swing'];
      text('[data-story-capture-status]', phases[detail.phase]);
      text('[data-story-explanation]', ['Match motion → align the capture fitting', 'Grapple jaws close around the fitting', 'Latch confirmed → payload secured', 'Payload secured → pull back for the swing'][detail.phase]);
    }
    recovery.setAttribute('transform', `translate(${f.hub.x} ${f.hub.y})`);
    const drive = electrodynamicDrive(f.angle, f.prograde);
    const electrical = current === 4 && method === 'electrical';
    node<SVGGElement>('[data-story-conductor]').setAttribute('opacity', electrical ? '1' : '0');
    node<SVGGElement>('[data-story-current]').setAttribute('opacity', String(drive.strength));
    story.querySelectorAll<SVGCircleElement>('[data-story-current] circle').forEach((dot, i) => {
      const phase = ((i / 8 + drive.direction * progress * 4) % 1 + 1) % 1;
      dot.setAttribute('cy', String((phase * 2 - 1) * (STORY.arm - 8)));
    });
    const engine = node<SVGGElement>('[data-story-engine]');
    engine.setAttribute('opacity', method === 'chemical' ? '1' : '0');
    engine.setAttribute('transform', `rotate(${Math.atan2(f.prograde.y, f.prograde.x) * 180 / Math.PI})`);
    const force = method === 'electrical' ? drive.force : f.prograde;
    const thrust = node<SVGLineElement>('[data-story-thrust]');
    thrust.setAttribute('x2', String(force.x * 130));
    thrust.setAttribute('y2', String(force.y * 130));
    thrust.setAttribute('opacity', method === 'electrical' ? String(drive.strength) : '1');
    text('[data-story-drive-label]', method === 'electrical' ? 'CURRENT IN TETHER' : 'GIMBALED HUB ENGINE');
    text('[data-story-force-label]', method === 'electrical' ? (drive.strength < .1 ? 'CURRENT SWITCHING' : 'MAGNETIC FORCE') : 'FORWARD THRUST');
    text('[data-story-drive-note]', method === 'electrical' ? 'CONTROLLED WITH SPIN' : 'EXHAUST BACKWARD');
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
    const step = index === 4 && method === 'chemical' ? chemical : steps[index];
    story.dataset.stage = String(index);
    text('[data-story-number]', `0${index + 1} / ${names[index]}`);
    for (const key of ['title', 'description', 'value', 'readout', 'explanation'] as const) text(`[data-story-${key}]`, step[key]);
    text('[data-story-scene-description]', step.explanation + '. ' + step.description);
    text('[data-story-timescale]', index === 4 ? 'LATER ORBITS · TIME COMPRESSED' : index === 1 ? 'CAPTURE · CLOSE-UP' : 'ILLUSTRATION · NOT TO SCALE');
    node<SVGPathElement>('[data-story-path]').setAttribute('d', storyPath(index));
    node<SVGGElement>('[data-story-pickup]').setAttribute('opacity', index < 2 ? '1' : '0');
    capture.setAttribute('opacity', index === 1 ? '1' : '0');
    node<SVGGElement>('[data-story-velocity]').setAttribute('opacity', index === 3 ? '1' : '0');
    recovery.setAttribute('opacity', index === 4 ? '1' : '0');
    node<SVGGElement>('[data-story-recovery-key]').setAttribute('opacity', index === 4 ? '1' : '0');
    node<HTMLElement>('[data-story-reboost]').hidden = index !== 4;
    node<SVGGElement>('[data-story-recovery-orbits]').setAttribute('opacity', index === 4 ? '1' : '0');
    buttons.forEach((button, i) => i === index ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
    draw(); syncPlayback();
  };
  buttons.forEach((button, index) => { button.disabled = false; button.addEventListener('click', () => select(index)); });
  story.querySelectorAll<HTMLButtonElement>('[data-story-method]').forEach(button => {
    button.addEventListener('click', () => {
      method = button.dataset.storyMethod as typeof method;
      story.dataset.reboost = method;
      story.querySelectorAll<HTMLButtonElement>('[data-story-method]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      const step = method === 'chemical' ? chemical : steps[4];
      for (const key of ['title', 'description', 'value', 'readout', 'explanation'] as const) text(`[data-story-${key}]`, step[key]);
      text('[data-story-scene-description]', step.explanation + '. ' + step.description);
      draw();
    });
  });
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
