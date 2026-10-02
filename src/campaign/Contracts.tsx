import { useRef, useState } from 'react';
import { acceptContract, activeContract, cancelContract, CARGO, CONTRACT_OFFERS, contractQuote, contractRemaining, LIMITS, procure, procurementReason, PROCUREMENT_PRICES, SITE, type Campaign, type Contract, type ContractOfferId, type ContractSize, type ProcurementKind } from './model.js';
import './contracts.css';

const n=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const date=(value:number)=>'Day '+n(value);
type Act=(fn:(world:Campaign)=>Campaign)=>void;
type Offer=typeof CONTRACT_OFFERS[number];
const offerFor=(id:ContractOfferId)=>CONTRACT_OFFERS.find(offer=>offer.id===id)!;

function Receipt({contract}:{contract:Contract}) {
  const offer=offerFor(contract.offerId);
  return <article className={'contract-receipt '+contract.status} data-contract-id={contract.id} aria-label={'Contract '+contract.id+' receipt'}>
    <div className="contract-title"><h3>{offer.name}</h3><span className="contract-state">{contract.status==='completed'?'Completed':contract.status==='expired'?'Expired':'Cancelled'}</span></div>
    <p className="contract-buyer">{offer.buyer} · #{contract.id}</p>
    <p className="contract-route">{SITE[offer.from].name} → {SITE[offer.to].name}</p>
    <dl className="contract-metrics"><div><dt>Delivered</dt><dd>{n(contract.deliveredT)} / {n(contract.quantityT)} <small>t</small></dd></div><div><dt>Earned</dt><dd>{n(contract.earnedCredits)} <small>cr</small></dd></div></dl>
    <p className="contract-receipt-note">{date(contract.settledDay!)} · {contract.status==='completed'?'Completion bonus included.':'Paid deliveries remain earned. In-flight cargo becomes depot supply.'}</p>
  </article>;
}

function ContractOffer({offer,world,busy,act}:{offer:Offer;world:Campaign;busy:boolean;act:Act}) {
  const [size,setSize]=useState<ContractSize>('standard');
  const quote=contractQuote(world,offer.id,size),description='contract-offer-'+offer.id+'-reason';
  return <article className="contract-offer" data-offer={offer.id} aria-labelledby={'contract-offer-'+offer.id}>
    <h3 id={'contract-offer-'+offer.id}>{offer.name}</h3>
    <p className="contract-buyer">{offer.buyer}</p>
    <p className="contract-route">{SITE[offer.from].name} → {SITE[offer.to].name}</p>
    <label className="contract-size">Order size<select aria-label="Order size" value={size} onChange={event=>setSize(event.target.value as ContractSize)}><option value="standard">Standard · 30 t</option><option value="industrial">Industrial · 300 t</option></select></label>
    <p className="contract-offer-cargo"><b>{n(quote.quantityT)} t</b> {CARGO[offer.kind].toLowerCase()} · {offer.rate} cr / t</p>
    <p className="contract-payment"><b>{n(quote.totalCredits)} cr</b> total <span>{n(quote.baseCredits)} delivery + {n(quote.bonusCredits)} completion bonus</span></p>
    <p className="contract-terms">Depart within <b>{quote.loadingWindowDays} days</b> of acceptance. Arrive by <b>{date(quote.dueDay)}</b> ({n(quote.duration)} days in transit).</p>
    <button className="primary" disabled={busy||!!quote.reason} aria-describedby={description} onClick={()=>act(w=>acceptContract(w,offer.id,size))}>Accept contract</button>
    <p className={'contract-reason'+(quote.reason?' blocked':'')} id={description}>{quote.reason||'Starts now. Prepare and send freight after accepting.'}</p>
  </article>;
}

export default function Contracts({world,busy,act,prepareContract}:{world:Campaign;busy:boolean;act:Act;prepareContract:(contractId:number)=>void}) {
  const [kind,setKind]=useState<ProcurementKind>('materials'),[amount,setAmount]=useState('1');
  const offers=useRef<HTMLDetailsElement>(null);
  const current=activeContract(world),settled=world.commerce.contracts.filter(contract=>contract.status!=='active'),latest=settled.at(-1);
  const currentOffer=current?offerFor(current.offerId):null;
  const remaining=current?contractRemaining(world,current.id):null;
  const lastDeparture=current?current.dueDay-contractQuote(world,current.offerId,current.size).duration:0;
  const late=!!current&&world.day>lastDeparture+1e-8;
  const quantity=Number(amount),cost=quantity*PROCUREMENT_PRICES[kind];
  const purchaseReason=amount.trim()===''?'Choose a whole procurement quantity.':procurementReason(world,kind,quantity);
  const browse=()=>{if(offers.current){offers.current.open=true;offers.current.scrollIntoView({block:'nearest'});offers.current.querySelector('summary')?.focus({preventScroll:true});}};
  return <section className="campaign-contracts" id="contracts" aria-labelledby="contracts-heading">
    <header className="panel-title"><h2 id="contracts-heading">Freight contracts</h2><span className="contract-balance"><b data-testid="contract-credits">{n(world.commerce.credits)} cr</b><span>available</span></span></header>
    <div className="contract-current">
      {current&&currentOffer&&remaining?<article className="contract-active" data-contract-id={current.id} aria-label={'Active contract '+current.id}>
        <div className="contract-title"><h3>{currentOffer.name}</h3><span className="contract-state">Active</span></div>
        <p className="contract-buyer">{currentOffer.buyer} · #{current.id}</p>
        <p className="contract-route">{SITE[currentOffer.from].name} → {SITE[currentOffer.to].name} · {CARGO[currentOffer.kind].toLowerCase()}</p>
        <dl className="contract-metrics"><div><dt>Delivered</dt><dd data-testid="contract-delivered">{n(current.deliveredT)} / {n(current.quantityT)} <small>t</small></dd></div><div><dt>In flight</dt><dd data-testid="contract-in-flight">{n(remaining.inFlightT)} <small>t</small></dd></div></dl>
        <progress aria-label="Contract delivery progress" value={current.deliveredT} max={current.quantityT}/>
        <p className="contract-deadline">Due <b>{date(current.dueDay)}</b> <span>{n(Math.max(0,current.dueDay-world.day))} d left</span></p>
        <p className="contract-earned">{n(current.earnedCredits)} cr earned · {n(current.quantityT*currentOffer.rate/4)} cr completion bonus</p>
        <p className={'contract-departure'+(late&&remaining.unassignedT>0?' blocked':'')}>{remaining.unassignedT===0?'All remaining cargo is in flight.':late?`${n(remaining.unassignedT)} t unsent. New departures would arrive late.`:`${n(remaining.unassignedT)} t still to send · depart by ${date(lastDeparture)}.`}</p>
        <div className="contract-actions"><button className="primary" disabled={remaining.unassignedT===0||late} onClick={()=>prepareContract(current.id)}>Prepare shipment</button><button className="text-button" disabled={busy} onClick={()=>act(w=>cancelContract(w,current.id))}>Cancel contract</button></div>
        <p className="contract-small">Customer freight is consumed on arrival. Cancelling keeps earned credits; remaining flights deliver to the depot.</p>
      </article>:latest?<><Receipt contract={latest}/><button className="contract-browse" onClick={browse}>Browse next contract ↗</button></>:<div className="contract-empty"><h3>Put your spare capacity to work.</h3><p>Deliver customer freight, earn credits, and buy supplies at Earth. One order at a time.</p><p>Buyers need commissioned routes and production at the origin.</p><button onClick={browse}>Browse available contracts ↗</button></div>}
    </div>
    <details ref={offers} className="contract-offers"><summary>Available contracts <span>3 buyers · fixed freight rates</span></summary><p className="contract-rules">Only assigned customer freight earns credits. Buyers consume on-time deliveries; ordinary depot supplies do not count. Earn per tonne, plus 25% for completing the order. No penalty for missing cargo. Each buyer returns 90 days after an order ends.</p>{CONTRACT_OFFERS.map(offer=><ContractOffer key={offer.id} offer={offer} world={world} busy={busy} act={act}/>)}</details>
    <details className="contract-procurement"><summary>Earth procurement <span>Spend earned credits on supplies</span></summary><form onSubmit={event=>{event.preventDefault();if(!busy&&!purchaseReason)act(w=>procure(w,kind,quantity));}}>
      <label htmlFor="procurement-resource">Procurement resource</label><select id="procurement-resource" value={kind} onChange={event=>setKind(event.target.value as ProcurementKind)}><option value="materials">Material · 12 cr / t</option><option value="equipment">Equipment · 30 cr / t</option><option value="fuel">Support fuel · 2 cr / t</option></select>
      <label htmlFor="procurement-amount">Purchase amount (t)</label><div className="procurement-controls"><input id="procurement-amount" type="number" min="1" max={LIMITS.stock} step="1" required value={amount} onChange={event=>setAmount(event.target.value)} aria-describedby="procurement-cost procurement-reason"/><button type="submit" disabled={busy||!!purchaseReason}>Buy supplies</button></div>
      <p className="procurement-cost" id="procurement-cost">Cost <b>{Number.isFinite(cost)&&quantity>0?n(cost):'—'} cr</b> · balance {n(world.commerce.credits)} cr</p><p className={'contract-reason'+(purchaseReason?' blocked':'')} id="procurement-reason">{purchaseReason||'Ready to purchase.'}</p><p className="contract-small">{kind==='fuel'?'Purchased fuel joins the shared support pool immediately.':'Purchased supplies enter the Earth depot immediately. Shipping is separate.'}</p>
    </form></details>
    <details className="contract-history"><summary>Contract receipts <span>{settled.length} settled</span></summary><div className="contract-history-scroll" role="region" aria-label="Contract receipt history" tabIndex={0}>{settled.length?[...settled].reverse().map(contract=><Receipt key={contract.id} contract={contract}/>):<p className="contract-rules">Completed, expired and cancelled orders keep their delivery and payment records here.</p>}</div></details>
  </section>;
}
