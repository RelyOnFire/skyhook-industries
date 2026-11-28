import { useState } from 'react';
import { CARGO, SITE, type Campaign } from './model.js';
import { previewService, type ServiceProposal } from './forecast.js';

const n=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
type Snapshot={result:ReturnType<typeof previewService>;signature:string;revision:number};

export default function ServicePreview({world,draft,disabled}:{world:Campaign;draft:ServiceProposal;disabled:boolean}) {
  const [horizon,setHorizon]=useState<number|'contract'>(365),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState('');
  const contract=world.commerce.contracts.find(c=>c.id===draft.contractId);
  const effectiveHorizon=horizon==='contract'&&contract?.status!=='active'?365:horizon;
  const days=effectiveHorizon==='contract'&&contract?Math.max(1e-7,contract.dueDay-world.day):typeof effectiveHorizon==='number'?effectiveHorizon:365;
  const signature=JSON.stringify([draft,effectiveHorizon]);
  const visible=snapshot?.signature===signature?snapshot:null;
  const stale=!!visible&&visible.revision!==world.revision;
  const result=visible?.result,holds=result?.proposed.delayed.filter(item=>item.id===result.serviceId)??[];
  const rows=result?[
    {label:'Network cargo received',before:result.current.receivedT,after:result.proposed.receivedT,unit:' t'},
    ...(contract?[{label:'Customer deliveries',before:result.current.customerDeliveredT,after:result.proposed.customerDeliveredT,unit:' t'},{label:'Credits at end',before:result.current.creditsLater,after:result.proposed.creditsLater,unit:' cr'}]:[]),
    {label:'Fuel at end',before:result.current.fuelLater,after:result.proposed.fuelLater,unit:' t'},
    {label:'Existing service holds',before:result.current.delayed.reduce((sum,item)=>sum+item.attempts,0),after:result.proposed.delayed.filter(item=>item.id!==result.serviceId).reduce((sum,item)=>sum+item.attempts,0),unit:''},
    ...(world.solar.unlocked?[{label:'Mirror launches',before:result.current.mirrorLaunches,after:result.proposed.mirrorLaunches,unit:''}]:[]),
  ]:[];
  return <section className="service-preview" aria-label="New service preview">
    <div className="service-preview-controls"><button type="button" disabled={disabled} onClick={()=>{
      setError('');try{setSnapshot({result:previewService(world,draft,days),signature,revision:world.revision});}
      catch(error){setSnapshot(null);setError((error as Error).message);}
    }}>Preview service</button><label><span>Look ahead</span><select aria-label="Service preview horizon" value={effectiveHorizon} onChange={e=>{setHorizon(e.target.value==='contract'?'contract':Number(e.target.value));setError('');}}><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option>{contract?.status==='active'&&<option value="contract">Contract deadline</option>}</select></label></div>
    {error&&<p role="alert">{error}</p>}
    {result&&<div className="service-preview-result" data-stale={stale}>
      <header><h3>{SITE[draft.from].name} → {SITE[draft.to].name}</h3><button type="button" aria-label="Close service preview" onClick={()=>setSnapshot(null)}>Close</button></header>
      <p>{draft.cargoT} t {CARGO[draft.kind].toLowerCase()} · every {n(draft.intervalDays)} days · {draft.mode==='tug'?'tug':'tether'}</p>
      <p className="service-preview-date">Day {n(result.current.fromDay)} → {n(result.current.toDay)} · {n(result.current.days)} days</p>
      <p className={'service-preview-freshness'+(stale?' stale':'')} role="status">{stale?'Network changed. Preview again.':'Current snapshot · nothing scheduled.'}</p>
      <dl className="service-preview-metrics"><div><dt>New departures</dt><dd>{n(result.proposed.serviceDeparturesById[result.serviceId]??0)}</dd></div><div><dt>{contract?'Customer cargo received':'New cargo received'}</dt><dd>{n(result.proposed.serviceReceivedTById[result.serviceId]??0)} t</dd></div><div><dt>Blocked attempts</dt><dd>{n(holds.reduce((sum,item)=>sum+item.attempts,0))}</dd></div></dl>
      {holds.length>0?<ul className="service-preview-holds" aria-label="New service departure holds" tabIndex={0}>{holds.map(item=><li key={item.reason}><b>{item.reason}</b><span>{item.attempts} attempts · first Day {n(item.firstDay)}</span></li>)}</ul>:<p className="service-preview-clear">No holds projected for this service.</p>}
      <div className="outlook-comparison"><table><caption className="sr-only">Network with and without this new service</caption><thead><tr><th scope="col">Network effect</th><th scope="col">Current</th><th scope="col">With service</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{n(row.before)}{row.unit}</td><td>{n(row.after)}{row.unit}</td></tr>)}</tbody></table></div>
      {contract&&result.proposed.contracts.find(c=>c.id===contract.id)&&<p className="service-preview-clear">Contract #{contract.id}: {n(result.proposed.contracts.find(c=>c.id===contract.id)!.deliveredT)} / {n(contract.quantityT)} t delivered · {result.proposed.contracts.find(c=>c.id===contract.id)!.status} at the end of this forecast.</p>}
      <p className="service-preview-note">First attempt tomorrow. Current production, services and automatic launches continue. No manual shipments, upgrades or Earth allocations. In-flight cargo is excluded from receipts. Nothing is scheduled until you choose Schedule service.</p>
    </div>}
  </section>;
}
