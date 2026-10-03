/* Offline film composition. FlightStory owns every mechanism pose and path;
 * this file only directs its existing controls and composes titles/end cards. */
(() => {
  const story = document.querySelector('[data-flight-story]');
  const film = document.createElement('div');
  film.id = 'film';
  const mechanism = document.createElement('div');
  mechanism.id = 'mechanism'; mechanism.append(story);
  film.append(mechanism);
  film.insertAdjacentHTML('beforeend', `
    <div id="network"><svg viewBox="0 0 1280 720">
      <defs><marker id="network-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10" fill="#edaa80"/></marker></defs>
      <path id="route" d="M260 410Q405 210 590 400Q800 200 1020 398" fill="none" stroke="#d69a77" stroke-width="2" stroke-dasharray="5 8" opacity=".55"/>
      <image href="/planets/earth.webp" x="125" y="365" width="240" height="240"/>
      <image href="/planets/moon.webp" x="520" y="399" width="138" height="138"/>
      <image href="/planets/phobos.webp" x="976" y="412" width="85" height="85"/>
      <g fill="none" stroke="#73919e" opacity=".6"><circle cx="245" cy="485" r="175"/><circle cx="590" cy="468" r="125"/></g>
      <g id="earth-rotor" stroke="#d9e6e9" stroke-width="3"><path d="M0 -42V42"/><circle r="5" fill="#d59a75" stroke="#d59a75"/></g>
      <g id="moon-rotor" stroke="#d9e6e9" stroke-width="3"><path d="M0 -34V34"/><circle r="5" fill="#d59a75" stroke="#d59a75"/></g>
      <g id="phobos-rotor" transform="translate(1019 454) rotate(-28)" stroke="#d9e6e9" stroke-width="3"><path d="M0 -87V-21M0 21V93"/><circle cy="-87" r="4" fill="#d59a75"/><circle cy="93" r="4" fill="#d59a75"/></g>
      <g font-family="Arial,sans-serif" fill="#e7edef" font-size="27"><text x="167" y="627">Earth</text><text x="543" y="583">Moon</text><text x="970" y="583">Phobos</text></g>
      <g font-family="Arial,sans-serif" fill="#a4b8c2" font-size="18"><text x="127" y="660">Free-orbiting rotator</text><text x="491" y="616">Lunar lunavator</text><text x="922" y="616">Anchored at Phobos</text></g>
      <circle id="network-payload" r="6" fill="#f3bb94"/>
    </svg></div>
    <div id="products"><div class="product-card"><img id="studio-image"/><span>FLIGHT STUDIO <b>Design and test a flight ↗</b></span></div><div class="product-card"><img id="game-image"/><span>EXPEDITIONS <b>Build and supply a network ↗</b></span></div></div>
    <div id="kicker">SKYHOOK INDUSTRIES / AN INTRODUCTION</div>
    <h1 id="title"></h1><p id="subline"></p>
    <div id="footer"><span id="label">CONCEPT ILLUSTRATION · NOT TO SCALE</span><span>SKYHOOK INDUSTRIES</span></div>
    <div id="progress"></div><div id="fade"></div>
  `);
  document.body.replaceChildren(film);
  const style = document.createElement('style');
  style.textContent = `
    html,body{margin:0!important;padding:0!important;width:1280px!important;height:720px!important;overflow:hidden!important;background:#091116!important;color:#e9eff1;font-family:Arial,sans-serif!important}
    #film{position:relative;width:1280px;height:720px;overflow:hidden;background:radial-gradient(ellipse at 87% 18%,#29232355,transparent 65%),radial-gradient(ellipse at 35% 110%,#25465788,transparent 64%),#091116}
    #mechanism{position:absolute;inset:0}#mechanism .flight-story{display:block!important;margin:0!important;padding:0!important;background:none!important;border:0!important;position:absolute;inset:0}
    #mechanism .flight-story-inner,#mechanism .flight-story-frame,#mechanism .flight-story-scene{display:block!important;background:none!important;border:0!important;min-height:0!important;max-width:none!important;margin:0!important;padding:0!important;position:static!important}
    #mechanism .flight-story-scene svg{position:absolute;width:1100px!important;height:682px!important;left:210px;top:125px;max-width:none!important}
    #mechanism .flight-story-heading,#mechanism .flight-story-side,#mechanism .flight-story-foot,#mechanism .flight-story-scene-top,#mechanism .flight-story-explanation,#mechanism .flight-story-scrubber{display:none!important}
    #mechanism .story-map-label{font:15px monospace!important;fill:#a5bdc6!important}#mechanism .story-capture-labels{font:17px monospace!important;fill:#c5d5dd!important}
    #mechanism [data-story-closeup-labels] text:first-child{display:none}
    #kicker{position:absolute;left:58px;top:43px;font-size:13px;letter-spacing:.14em;color:#e2a37e}
    #title{position:absolute;left:54px;top:80px;margin:0;font-size:55px;font-weight:400;line-height:1.07;letter-spacing:-.045em;white-space:pre-line;color:#eff3f4;text-shadow:0 3px 30px #091116}
    #subline{position:absolute;left:58px;top:220px;max-width:320px;white-space:pre-line;font-size:19px;line-height:1.55;margin:0;color:#b8cbd4;text-shadow:0 2px 16px #091116}
    #footer{position:absolute;bottom:26px;left:58px;right:58px;display:flex;justify-content:space-between;font-size:11px;letter-spacing:.11em;color:#b5c5cd}
    #progress{position:absolute;bottom:0;left:0;height:2px;background:#c48868;opacity:.75}
    #network,#products{position:absolute;inset:0;display:none}#network svg{width:1280px;height:720px}
    #products{top:257px;left:58px;right:58px;bottom:95px;gap:24px}
    .product-card{position:relative;flex:1;overflow:hidden;border:1px solid #495760;background:#111a20}.product-card img{width:100%;height:100%;object-fit:cover;object-position:top left}.product-card span{position:absolute;inset:auto 0 0;padding:30px 20px 17px;background:linear-gradient(transparent,#081015 30%);color:#d69a77;font-size:12px;letter-spacing:.09em}.product-card b{display:block;margin-top:7px;color:#e7eef0;font-size:24px;letter-spacing:-.02em;font-weight:400}
    #fade{position:absolute;inset:0;background:#091116;opacity:0;pointer-events:none}
  `;
  document.head.append(style);
  // A detailed, project-owned rendered Earth uses the existing clip/geometry.
  const globe = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  globe.setAttribute('href', '/planets/earth.webp'); globe.setAttribute('x', '20'); globe.setAttribute('y', '430'); globe.setAttribute('width', '660'); globe.setAttribute('height', '660');
  globe.setAttribute('clip-path', 'url(#story-earth-clip)');
  story.querySelector('[data-story-earth]').after(globe);
  const arrows=document.createElementNS('http://www.w3.org/2000/svg','g');
  arrows.innerHTML='<path id="film-orbit-vector" fill="none" stroke="#9fced8" stroke-width="2" marker-end="url(#story-thrust-arrow)"/><path id="film-spin-vector" fill="none" stroke="#efa477" stroke-width="2" marker-end="url(#story-arrow)"/><text id="film-orbit-label" fill="#9fced8" font-size="16" font-family="monospace">ORBIT</text><text id="film-spin-label" fill="#efa477" font-size="16" font-family="monospace">SPIN</text>';
  story.querySelector('[data-story-world]').append(arrows);
  let previousStage = -1, previousMethod = '';
  const clamp = x => Math.min(1, Math.max(0, x));
  const smooth = x => { const p = clamp(x); return p*p*(3-2*p); };
  const titles = ['Speed.\nAs well as height.', 'Orbit + rotation.', 'Meet. Match.\nSecure.', 'Carry the load.', 'Release.\nThen coast.', 'Recover for\nthe next handoff.', 'One handoff.\nA wider network.', 'Start with one handoff.'];
  const subtitles = ['Leave the infrastructure\nin orbit.', 'The tip moves against\nthe orbital motion.', 'Position, speed and timing\nhave to align.', 'Energy moves from\ntether to payload.', 'Orbit and spin set\nthe departure velocity.', 'Restore what the\noutgoing payload took.', 'Different worlds.\nDifferent tether designs.', 'See where it could lead.'];
  window.drawIntroduction = ({ time, shots, duration, studio, game }) => {
    let index = shots.findIndex(s => time >= s.start && time < s.end); if(index<0)index=shots.length-1;
    const shot = shots[index], p = clamp((time-shot.start)/(shot.end-shot.start));
    document.querySelector('#title').textContent=titles[index]; document.querySelector('#subline').textContent=subtitles[index];
    document.querySelector('#progress').style.width=`${1280*time/duration}px`;
    document.querySelector('#mechanism').style.display=index<6?'block':'none';
    // Follow the departing payload while retaining both tether tips in frame.
    // This is a camera move only; FlightStory still owns all world geometry.
    const scene=story.querySelector('.flight-story-scene svg');
    scene.style.transformOrigin='50% 0';
    scene.style.transform=index===4?`scale(${1-.18*smooth(p/.3)})`:'none';
    document.querySelector('#network').style.display=index===6?'block':'none';
    document.querySelector('#products').style.display=index===7?'flex':'none';
    document.querySelector('#label').textContent=index===7?'ACTUAL APPLICATION VIEWS · EXPEDITIONS IS A STRATEGY GAME':index===5?'RECOVERY OVER LATER PASSES · ILLUSTRATIVE TIME':'CONCEPT ILLUSTRATION · NOT TO SCALE';
    document.querySelector('#studio-image').src=studio;document.querySelector('#game-image').src=game;
    const fade = index===0 ? 1-smooth(time/1.2) : index===7&&p>.93 ? smooth((p-.93)/.07)*.75 : 0;
    document.querySelector('#fade').style.opacity=String(fade);
    if(index===6){
      const a=-1.9+p*.8,b=-1.8+p*.6;
      document.querySelector('#earth-rotor').setAttribute('transform',`translate(${245+175*Math.cos(a)} ${485+175*Math.sin(a)}) rotate(${p*230-20})`);
      document.querySelector('#moon-rotor').setAttribute('transform',`translate(${590+125*Math.cos(b)} ${468+125*Math.sin(b)}) rotate(${p*200+20})`);
      const route=document.querySelector('#route'),point=route.getPointAtLength(route.getTotalLength()*p);
      document.querySelector('#network-payload').setAttribute('cx',point.x);document.querySelector('#network-payload').setAttribute('cy',point.y);
    }
    if(index>=6)return;
    const stage=index===0?2:index===1?0:index===2?(p<.37?0:1):index===3?2:index===4?3:4;
    const progress=index===0?.05+p*.45:index===1?p:index===2?(p<.37?p/.37:(p-.37)/.63):p;
    if(stage!==previousStage){story.querySelector(`[data-story-step="${stage}"]`).click();previousStage=stage;}
    const method=index===5?(p<.38?'electrical':p<.7?'chemical':'traffic'):'electrical';
    if(method!==previousMethod){story.querySelector(`[data-story-method="${method}"]`).click();previousMethod=method;}
    const phaseProgress=index===5?(p<.38?p/.38:p<.7?(p-.38)/.32:(p-.7)/.3):progress;
    const range=story.querySelector('[data-story-progress]');range.value=String(Math.round(phaseProgress*1000));range.dispatchEvent(new Event('input',{bubbles:true}));
    arrows.style.display=index===1?'block':'none';
    if(index===1){
      const m=story.querySelector('[data-story-tether]').transform.baseVal.consolidate().matrix;
      const tip={x:m.e-m.b*145,y:m.f+m.a*145};
      document.querySelector('#film-orbit-vector').setAttribute('d',`M${m.e+25} ${m.f-25}h115`);
      document.querySelector('#film-spin-vector').setAttribute('d',`M${tip.x-18} ${tip.y-18}l${-110*m.a} ${-110*m.b}`);
      document.querySelector('#film-orbit-label').setAttribute('x',m.e+35);document.querySelector('#film-orbit-label').setAttribute('y',m.f-38);
      document.querySelector('#film-spin-label').setAttribute('x',tip.x-110*m.a);document.querySelector('#film-spin-label').setAttribute('y',tip.y-110*m.b-34);
    }
    story.querySelector('[data-story-path]').style.opacity=index<2?'0':'.8';
    story.querySelector('[data-story-payload]').style.visibility=index<2?'hidden':'visible';
    story.querySelector('[data-story-pickup]').style.visibility=index<2?'hidden':'visible';
    if(index===2&&stage===1){document.querySelector('#subline').style.opacity=String(1-smooth((progress-.08)/.18));}else document.querySelector('#subline').style.opacity='1';
  };
})();
