import { buildSolar, launchMirrors, mercuryUnlockReason, mirrorLaunchPlan, SOLAR, solarBuildReason, toggleMirrorLaunches, unlockMercury, type Campaign } from './model.js';
import { n, date, type Act } from './Operations.js';

export default function SolarChapter({world,busy,act}:{world:Campaign;busy:boolean;act:Act}) {
  const s=world.solar, launch=mirrorLaunchPlan(world,SOLAR.launchT),unlock=mercuryUnlockReason(world);
  return <section className="campaign-solar" aria-labelledby="solar-heading">
    <header className="panel-title"><div><p className="campaign-eyebrow">MERCURY → SUN</p><h2 id="solar-heading">{s.unlocked?'Mirror operations':'Mercury expedition'}</h2></div><a href="/lab/campaign/method/#mercury">Model ↗</a></header>
    {!s.unlocked?<div className="solar-expedition"><p>{n(world.marsOperations)} / 100 Mars points · <b>60 t material +20 t equipment at Earth</b>. Survey and ground support; Mercury cargo ships separately.</p><button disabled={busy||!!unlock} title={unlock||undefined} onClick={()=>act(unlockMercury)}>Open Mercury expedition</button>{unlock&&<p className="tiny">{unlock}</p>}</div>:<>
      <div className="solar-stock"><div><span>MIRRORS READY</span><b data-testid="mirrors-ready">{n(s.mirrorsT)} <small>t</small></b></div><div><span>DEPLOYED</span><b data-testid="swarm-mass">{n(s.deployedT)} <small>t</small></b></div><div><span>SCENARIO AREA</span><b>{n(s.deployedT*SOLAR.areaKm2PerT)} <small>km²</small></b></div></div>
      <div className="solar-facilities">{(['mirrorWorks','launchArray'] as const).map((facility,i)=>{const reason=solarBuildReason(world,facility),installed=s[facility];return <div key={facility}><span className={installed?'installed':''}>{installed?'✓ ':''}{i===0?'Mirror works':'Launch array'}</span>{!installed&&<><button disabled={busy||!!reason} onClick={()=>act(w=>buildSolar(w,facility))}>{i===0?'Install mirror works':'Install mirror launch array'}</button><small>{reason||'40 t material +10 t equipment at Mercury'}</small></>}</div>;})}</div>
      {s.launchArray&&<><div className="solar-launch-actions"><button className="primary" disabled={busy||!!launch.reason} onClick={()=>act(w=>launchMirrors(w))}>Launch 10 t mirrors</button><button disabled={busy} onClick={()=>act(toggleMirrorLaunches)}>{s.autoLaunch?'Pause automatic launches':'Enable automatic launches'}</button></div><p className="tiny">{launch.reason||'1 t fuel per launch · '+n(SOLAR.deploymentDays)+' days to deployment.'} {s.autoLaunch?'Automatic: next attempt '+date(s.nextLaunchDay??world.day)+'.':'Automatic: 10 t every 10 days when enabled.'}</p></>}
      <p className="solar-advice">Supply Mercury with <b>10 t equipment every 60 days</b> to support refinery + mirror works. Ship extra for construction. Area assumes 10 g/m²; power delivery is not simulated.</p>
    </>}
  </section>;
}
