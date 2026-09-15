import type { TerminalRenderer } from './terminal-scene';
/** Content controls work without WebGL. The 3D module loads near this section,
 * never on the critical path to the homepage heading or the lab entry. */
export function initTerminalStory(root: HTMLElement) {
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer:TerminalRenderer|null=null, requested=false, disposed=false;
  let exploded=false, part=-1, rotating=false;
  const names=['TETHER INTERFACE','GUIDANCE & POWER','CAPTURE INTERFACE'];
  const rotation=root.querySelector<HTMLButtonElement>('[data-terminal-action="rotate"]')!;
  root.dataset.enhanced='true';
  const schematic=root.querySelector<SVGSVGElement>('.terminal-fallback')!;
  function sync() {
    schematic.setAttribute('viewBox',part<0?'0 0 520 560':['120 15 280 250','120 170 280 215','110 340 300 125'][part]);
    root.dataset.exploded=String(exploded); root.dataset.part=String(part);
    root.dataset.rotating=String(rotating);root.dataset.reducedMotion=String(media.matches);
    root.querySelectorAll<HTMLButtonElement>('[data-part-button]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===part)));
    root.querySelectorAll<HTMLElement>('[data-part-copy]').forEach((p,i)=>p.hidden=i!==part);
    root.querySelectorAll<HTMLButtonElement>('[data-terminal-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.terminalMode==='exploded')===exploded)));
    root.querySelector('[data-terminal-caption]')!.textContent=part<0?'WHOLE ASSEMBLY':`0${part+1} / ${names[part]}`;
    root.querySelector('[data-terminal-overview]')!.setAttribute('aria-pressed',String(part<0));
    root.querySelector<HTMLElement>('[data-terminal-overview-copy]')!.hidden=part>=0;
    rotation.textContent=rotating?'Pause model':'Rotate model';rotation.setAttribute('aria-pressed',String(rotating));
    rotation.disabled=media.matches || root.dataset.renderer==='fallback';
    renderer?.update({exploded,part,rotating,reduced:media.matches});
  }
  root.querySelectorAll<HTMLButtonElement>('[data-part-button]').forEach((b,i)=>b.addEventListener('click',()=>{part=i;rotating=false;sync();}));
  root.querySelector('[data-terminal-overview]')!.addEventListener('click',()=>{part=-1;rotating=false;sync();});
  root.querySelectorAll<HTMLButtonElement>('[data-terminal-mode]').forEach(b=>b.addEventListener('click',()=>{exploded=b.dataset.terminalMode==='exploded';part=-1;rotating=false;sync();}));
  rotation.addEventListener('click',()=>{rotating=!rotating;sync();});
  root.querySelector('[data-terminal-action="reset"]')!.addEventListener('click',()=>{exploded=false;part=-1;rotating=false;sync();renderer?.reset();});
  const reduce=()=>{if(media.matches)rotating=false;sync();};media.addEventListener('change',reduce);
  async function load(){
    if(requested||disposed)return;requested=true;
    try {
      const module=await import('./terminal-scene');
      if(disposed)return;
      renderer=module.mountTerminal(root,()=>{rotating=false;sync();});sync();
    } catch {
      root.dataset.renderer='fallback';root.querySelector('[data-terminal-render-status]')!.textContent='Schematic view · 3D unavailable';rotating=false;sync();
    }
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){void load();observer.disconnect();}},{rootMargin:'180px'});observer.observe(root);
  sync();
  // Retain a usable scene when returning from the browser back-forward cache.
  window.addEventListener('pagehide',e=>{if(e.persisted){renderer?.setVisible(false);return;}disposed=true;observer.disconnect();media.removeEventListener('change',reduce);renderer?.dispose();},{once:false});
  window.addEventListener('pageshow',e=>{if(e.persisted)renderer?.setVisible(true);});
}
