import { automaticMirrorPlan, buildSolar, connectSwarmPower, launchMirrors, mercuryProduction, mercuryUnlockReason, mirrorLaunchPlan, POWER, powerLinkReason, SOLAR, solarBuildReason, swarmPower, toggleMirrorLaunches, unlockMercury, type Campaign } from './model.js';
import { n, date, type Act } from './Operations.js';

export default function SolarChapter({world,busy,act}:{world:Campaign;busy:boolean;act:Act}) {
  const s=world.solar, automatic=automaticMirrorPlan(world),launch=mirrorLaunchPlan(world,automatic.massT),unlock=mercuryUnlockReason(world);
  const power=swarmPower(world),production=mercuryProduction(world),linkReason=powerLinkReason(world);
  const limited=production.madeT+1e-8<production.mirrorCapacity;
  const restriction=s.mirrorsT>=1e6?'Mirror storage full':world.ports.mercury.equipmentT+production.toolingT<1e-8?'Send material for local tooling, or equipment to restart.':s.depositT<1e-8?'Local deposit exhausted. Ship construction material to continue.':'Production limited by available inputs.';
  return <section className="campaign-solar" aria-labelledby="solar-heading">
    <header className="panel-title"><div><p className="campaign-eyebrow">MERCURY → SUN</p><h2 id="solar-heading">{s.unlocked?'Mirror operations':'Mercury expedition'}</h2></div><a href="/lab/campaign/method/#mercury">Model ↗</a></header>
    {!s.unlocked?<div className="solar-expedition"><p>{n(world.marsOperations)} / 100 Mars points · <b>60 t material +20 t equipment at Earth</b>. Survey and ground support; Mercury cargo ships separately.</p><button disabled={busy||!!unlock} title={unlock||undefined} onClick={()=>act(unlockMercury)}>Open Mercury expedition</button>{unlock&&<p className="tiny">{unlock}</p>}</div>:<>
      <div className="solar-stock"><div><span>MIRRORS READY</span><b data-testid="mirrors-ready">{n(s.mirrorsT)} <small>t</small></b></div><div><span>DEPLOYED</span><b data-testid="swarm-mass">{n(s.deployedT)} <small>t</small></b></div><div><span>SCENARIO AREA</span><b>{n(power.areaKm2)} <small>km²</small></b></div></div>
      <div className="solar-facilities">{(['mirrorWorks','launchArray'] as const).map((facility,i)=>{const reason=solarBuildReason(world,facility),installed=s[facility];return <div key={facility}><span className={installed?'installed':''}>{installed?'✓ ':''}{i===0?'Mirror works':'Launch array'}</span>{!installed&&<><button disabled={busy||!!reason} onClick={()=>act(w=>buildSolar(w,facility))}>{i===0?'Install mirror works':'Install mirror launch array'}</button><small>{reason||'40 t material +10 t equipment at Mercury'}</small></>}</div>;})}</div>
      {s.launchArray&&<><div className="solar-launch-actions"><button className="primary" disabled={busy||!!launch.reason} onClick={()=>act(w=>launchMirrors(w,automaticMirrorPlan(w).massT))}>Launch {automatic.massT} t mirrors</button><button disabled={busy} onClick={()=>act(toggleMirrorLaunches)}>{s.autoLaunch?'Pause automatic launches':'Enable automatic launches'}</button></div><p className="tiny">{launch.reason||n(launch.fuelT)+' t fuel · '+n(SOLAR.deploymentDays)+' days to deployment.'} {s.autoLaunch?'Next automatic attempt: '+date(s.nextLaunchDay??world.day)+'.':'Automatic launches paused.'}</p><p className="tiny">{automatic.massT} t per batch · {n(automatic.intervalDays)} days between successful launches{s.powerLink?' at current power.':'.'}</p></>}
      <section className={'solar-power'+(s.powerLink?' connected':'')} id="swarm-power" aria-label="Swarm power loop">
        <header><p className="campaign-eyebrow">{s.powerLink?'AUTOMATIC REINVESTMENT':'CHAPTER 04 / THE POWER LOOP'}</p><span>{s.powerLink?'Link online':'Link offline'}</span></header>
        <div className="power-readings"><div><span>Sunlight intercepted</span><b data-testid="swarm-sunlight">{n(power.sunlightGW)} <small>GW</small></b></div><div><span>Returned to Mercury</span><b data-testid="swarm-power">{n(power.returnedGW)} <small>GW</small></b></div><div><span>Production capacity</span><b data-testid="mercury-multiplier">{n(power.multiplier)}<small>×</small></b></div></div>
        {s.powerLink?<>
          <div className="power-loop" aria-label="Feedback: more deployed mirrors return more power, accelerating Mercury production and the next mirror launches"><span>More mirrors</span><i>→</i><span>More power</span><i>→</i><span>Faster Mercury works</span><i>↻</i></div>
          <div className="power-production"><span>Next cycle <b data-testid="mirror-output">{n(production.madeT)} t mirrors</b> / {n(production.mirrorCapacity)} t capacity</span><span>Refinery <b>{n(production.minedT)} t</b> · local equipment <b>{n(production.toolingT)} t</b></span></div>
          <p className={'power-condition'+(limited?' limited':'')}>{limited?restriction:'Power drives expansion; local tooling replaces equipment used each cycle.'} {!s.autoLaunch&&'Enable automatic launches to keep the loop growing.'}</p>
          <div className="power-deposit"><label htmlFor="mercury-deposit">Local mining tract <span>{n(SOLAR.depositT-s.depositT)} / {n(SOLAR.depositT)} t processed</span></label><progress id="mercury-deposit" value={SOLAR.depositT-s.depositT} max={SOLAR.depositT}/></div>
        </>:<>
          <p>Connect the swarm once. Returned power then expands refining, mirror production and local equipment fabrication automatically.</p>
          <div className="power-connect"><button className="primary" disabled={busy||!!linkReason} aria-describedby="power-link-cost" onClick={()=>act(connectSwarmPower)}>Connect swarm power</button><span id="power-link-cost">{POWER.linkMaterialsT} t material + {POWER.linkEquipmentT} t equipment at Mercury</span></div>
          <p className="power-condition">{linkReason||'Ready to connect. Keep some material or equipment for the first cycle.'}</p>
        </>}
        <p className="power-assumption">Scenario: 20% of intercepted sunlight returned; every 20 GW adds 1× capacity. <a href="/lab/campaign/method/#power">How it works ↗</a></p>
      </section>
      {!s.powerLink&&<p className="solar-advice">Before the power link, supply <b>10 t equipment every 60 days</b> for the refinery + mirror works. Ship extra for construction. Area assumes 10 g/m².</p>}
    </>}
  </section>;
}
