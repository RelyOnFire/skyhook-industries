/* Offline film composition. FlightStory and the real departure viewers own
 * every mechanism pose and path; this file only directs their existing controls. */
(() => {
  const story = document.querySelector('[data-flight-story]');
  const film = document.createElement('div');
  film.id = 'film';
  const mechanism = document.createElement('div');
  mechanism.id = 'mechanism'; mechanism.append(story);
  film.append(mechanism);
  film.insertAdjacentHTML('beforeend', `
    <iframe id="earth-scene" class="launch-scene" title="Earth launch filming source" src="/lab/campaign/"></iframe>
    <iframe id="moon-scene" class="launch-scene" title="Moon launch filming source" src="/lab/campaign/"></iframe>
    <div id="network-growth"><img id="network-start-image"/><img id="network-grown-image"/><p id="network-note">START WITH EARTH <span>BUILD A WORKING NETWORK</span></p></div>
    <div id="finlay-note"><span>15P / FINLAY</span>A comet as a water depot.<small>Mission study · transfer and capture remain unsolved</small></div>
    <div id="products"><div class="product-card"><img id="studio-image"/><img id="studio-outcome"/><span>FLIGHT STUDIO <b>Fly your first mission ↗</b></span></div><div class="product-card"><img id="game-image"/><span>EXPEDITIONS <b>Build and supply a network ↗</b></span></div></div>
    <div id="kicker">SKYHOOK INDUSTRIES / AN INTRODUCTION</div>
    <h1 id="title"></h1><p id="subline"></p>
    <div id="footer"><span id="label">CONCEPT ILLUSTRATION · NOT TO SCALE</span><span id="film-brand"><img src="/brand/comet-mark.png"/>SKYHOOK INDUSTRIES</span></div>
    <div id="progress"></div><div id="fade"></div>
  `);
  document.body.replaceChildren(film);
  const style = document.createElement('style');
  style.textContent = `
    html,body{margin:0!important;padding:0!important;width:1280px!important;height:720px!important;overflow:hidden!important;background:#091116!important;color:#e9eff1;font-family:Arial,sans-serif!important}
    #film{position:relative;width:1280px;height:720px;overflow:hidden;background:radial-gradient(ellipse at 87% 18%,#29232355,transparent 65%),radial-gradient(ellipse at 35% 110%,#25465788,transparent 64%),#091116}
    .launch-scene{position:absolute;left:270px;top:118px;width:1000px;height:620px;border:0;background:#070d13;visibility:hidden;pointer-events:none;mask-image:linear-gradient(90deg,transparent,#000 12%),linear-gradient(180deg,transparent,#000 15%,#000 85%,transparent);mask-composite:intersect}
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
    #film-brand{display:flex;align-items:center;gap:10px}#film-brand img{width:28px;height:28px;object-fit:contain}
    #progress{position:absolute;bottom:0;left:0;height:2px;background:#c48868;opacity:.75}
    #products{position:absolute;inset:0;display:none}
    #network-growth{position:absolute;left:340px;right:30px;top:200px;height:410px;display:none}#network-growth>img{position:absolute;width:100%;height:100%;object-fit:contain}#network-note{position:absolute;top:-27px;left:120px;right:30px;display:flex;justify-content:space-between;color:#a9c4cf;font:12px monospace;letter-spacing:.08em}
    #finlay-note{position:absolute;left:58px;top:390px;max-width:250px;font-size:23px;color:#e4d2c3;line-height:1.3;opacity:0}#finlay-note>span{display:block;font:12px monospace;color:#dfaa82;margin-bottom:12px;letter-spacing:.1em}#finlay-note>small{display:block;margin-top:14px;color:#9ab1bc;font-size:13px;line-height:1.5}
    #products{top:257px;left:58px;right:58px;bottom:95px;gap:24px}
    .product-card{position:relative;flex:1;overflow:hidden;border:1px solid #495760;background:#111a20}.product-card img{width:100%;height:100%;object-fit:cover;object-position:top left}.product-card span{position:absolute;inset:auto 0 0;padding:30px 20px 17px;background:linear-gradient(transparent,#081015 30%);color:#d69a77;font-size:12px;letter-spacing:.09em}.product-card b{display:block;margin-top:7px;color:#e7eef0;font-size:24px;letter-spacing:-.02em;font-weight:400}
    .product-card #studio-outcome{position:absolute;left:0;bottom:90px;width:100%;height:auto;object-fit:contain}
    .product-card #studio-image,.product-card #game-image{object-fit:contain;object-position:center top}
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
  const titles = ['Speed.\nAs well as height.', 'Orbit + rotation.', 'Meet. Match.\nSecure.', 'Swing. Release.\nThen coast.', 'Recover for\nthe next handoff.', 'A different world.\nThe same idea.', 'One handoff.\nA wider network.', 'Start with one handoff.'];
  const subtitles = ['An aircraft supplies\nthe first part of the climb.', 'The tip moves against\nthe orbital motion.', 'Position, speed and timing\nhave to align.', 'Energy moves from\ntether to payload.', 'Restore what the\noutgoing payload took.', 'On the Moon, a mass driver\nsupplies the first impulse.', 'Move cargo. Grow industry.\nBuild toward the Sun.', 'Follow a flight.\nThen build your network.'];
  window.drawIntroduction = ({ time, shots, duration, studio, studioOutcome, game, gameStart }) => {
    let index = shots.findIndex(s => time >= s.start && time < s.end); if(index<0)index=shots.length-1;
    const shot = shots[index], p = clamp((time-shot.start)/(shot.end-shot.start));
    document.querySelector('#title').textContent=titles[index];
    const subline=document.querySelector('#subline');
    subline.textContent=index===7?subtitles[index].replace('\n',' '):subtitles[index];
    subline.style.top=index===7?'177px':'220px';subline.style.maxWidth=index===7?'650px':'320px';
    document.querySelector('#progress').style.width=`${1280*time/duration}px`;
    const earth=[0,2,3].includes(index),moon=index===5;
    document.querySelector('#mechanism').style.display=[1,4].includes(index)?'block':'none';
    document.querySelector('#earth-scene').style.visibility=earth?'visible':'hidden';
    document.querySelector('#moon-scene').style.visibility=moon?'visible':'hidden';
    document.querySelector('#network-growth').style.display=index===6?'block':'none';
    document.querySelector('#network-start-image').src=gameStart;document.querySelector('#network-grown-image').src=game;
    document.querySelector('#network-grown-image').style.opacity=String(smooth((p-.12)/.22));
    document.querySelector('#finlay-note').style.opacity=index===6?String(smooth((p-.65)/.1)):'0';
    document.querySelector('#products').style.display=index===7?'flex':'none';
    document.querySelector('#label').textContent=index>=6?'ACTUAL APPLICATION VIEWS · EXPEDITIONS IS A STRATEGY GAME':index===4?'RECOVERY OVER LATER PASSES · ILLUSTRATIVE TIME':earth?'EARTH ACCESS CONCEPT · HARDWARE ENLARGED':moon?'LUNAR MASS-DRIVER CONCEPT · HARDWARE ENLARGED':'CONCEPT ILLUSTRATION · NOT TO SCALE';
    document.querySelector('#studio-image').src=studio;document.querySelector('#studio-outcome').src=studioOutcome;document.querySelector('#game-image').src=game;
    const fade = index===0 ? 1-smooth(time/1.2) : index===7&&p>.93 ? smooth((p-.93)/.07)*.75 : 0;
    document.querySelector('#fade').style.opacity=String(fade);
    document.querySelector('#subline').style.opacity=index===2?String(1-smooth((p-.36)/.2)):'1';
    if(index!==1&&index!==4)return;
    const stage=index===1?0:4;
    if(stage!==previousStage){story.querySelector(`[data-story-step="${stage}"]`).click();previousStage=stage;}
    const method=index===4?(p<.38?'electrical':p<.7?'chemical':'traffic'):'electrical';
    if(method!==previousMethod){story.querySelector(`[data-story-method="${method}"]`).click();previousMethod=method;}
    const phaseProgress=index===4?(p<.38?p/.38:p<.7?(p-.38)/.32:(p-.7)/.3):p;
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
  };
})();
