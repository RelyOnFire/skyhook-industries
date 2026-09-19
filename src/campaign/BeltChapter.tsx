import { BELT, beltProduction, buildPropellantWorks, ceresUnlockReason, propellantBuildReason, routeFor, unlockCeres, type Campaign } from './model.js';
import { n, type Act, type Prepare } from './Operations.js';

export default function BeltChapter({world,busy,act,prepare}:{world:Campaign;busy:boolean;act:Act;prepare:Prepare}) {
  if(!world.solar.powerLink)return null;
  const b=world.belt,p=beltProduction(world),unlock=ceresUnlockReason(world),plant=propellantBuildReason(world),route=routeFor('phobos','ceres');
  const waterFlights=world.flights.filter(f=>f.kind==='water'),waterTransit=waterFlights.reduce((sum,f)=>sum+f.cargoT,0);
  return <section className="campaign-belt" id="belt-operations" aria-labelledby="belt-heading">
    <header className="panel-title"><div><p className="campaign-eyebrow">CHAPTER 05 / PHOBOS → CERES</p><h2 id="belt-heading">Into the Belt</h2></div><a href="/lab/campaign/method/#ceres">Model ↗</a></header>
    {!b.unlocked?<div className="belt-expedition"><p>Your swarm is growing. Build a second source of support propellant through the Phobos hub.</p><p><b>60 t material +20 t equipment at Phobos</b> funds the expedition. Ceres supplies travel separately.</p><button className="primary" disabled={busy||!!unlock} onClick={()=>act(unlockCeres)}>Open Ceres expedition</button><p className="tiny">{unlock||'Ready to depart. Keep supplies for the Ceres outpost and Phobos plant.'}</p></div>:<>
      <div className="belt-flow" aria-label="Ceres water supply chain"><div><span>CERES WATER</span><b data-testid="belt-water">{n(world.ports.ceres.waterT)} <small>t</small></b></div><span aria-hidden="true">→</span><div><span>IN TRANSIT</span><b data-testid="belt-transit">{n(waterTransit)} <small>t</small></b></div><span aria-hidden="true">→</span><div><span>FUEL PRODUCED</span><b data-testid="belt-fuel">{n(b.refinedT)} <small>t total</small></b></div></div>
      <div className="belt-production"><div><h3>Ceres water works</h3><p>{p.mineStatus}</p><span>Next cycle <b>{n(p.waterT)} t water</b></span></div><div><h3>Phobos propellant works</h3><p>{p.plantStatus}</p>{b.propellantWorks?<span>Next cycle <b>{n(p.fuelT)} t fuel</b> · {n(world.ports.phobos.waterT)} t water stored</span>:<><button disabled={busy||!!plant} onClick={()=>act(buildPropellantWorks)}>Install Phobos propellant works</button><small>{plant||'40 t material +10 t equipment at Phobos'}</small></>}</div></div>
      <div className="belt-actions"><button onClick={()=>prepare('phobos','ceres','materials')}>Supply Ceres material ↗</button><button onClick={()=>prepare('phobos','ceres','equipment')}>Supply Ceres equipment ↗</button><button className="primary" onClick={()=>prepare('ceres','phobos','water')}>Prepare water return ↗</button></div>
      <p className="belt-advice">Allow <b>{n(route.coastDays+route.handlingDays)} days each way</b>. Send 50 t material for the port and water works, plus 20 t equipment: 5 t for construction and 15 t to cover the first supply flight. Then send 5 t equipment every 200 days. Keep the Phobos hub supplied too.</p>
      <div className="belt-deposit"><label htmlFor="ceres-deposit">Local water deposit <span>{n(b.depositT)} t remaining</span></label><progress id="ceres-deposit" value={b.extractedT} max={BELT.depositT}/></div>
      <p className="belt-assumption">Water becomes fuel only at Phobos: up to 2 t per day, with equipment and storage available. Freight consumes fuel too. <a href="/lab/campaign/method/#ceres">Scenario recipes & limits ↗</a></p>
    </>}
  </section>;
}
