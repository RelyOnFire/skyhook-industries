import { useRef, useState } from 'react';
import { acceptContract, buyerMarket, cancelContract, CARGO, CONTRACT_OFFERS, contractQuote, contractRemaining, LIMITS, procure, procurementReason, PROCUREMENT_PRICES, SITE, type Campaign, type Contract, type ContractOfferId, type ContractSize, type ProcurementKind } from './model.js';
import './contracts.css';

const n=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const date=(value:number)=>'Day '+n(value);
type Act=(fn:(world:Campaign)=>Campaign)=>void;
type Offer=typeof CONTRACT_OFFERS[number];
const offerFor=(id:ContractOfferId)=>CONTRACT_OFFERS.find(offer=>offer.id===id)!;

function LockedTerms({contract,showEarned=false}:{contract:Contract;showEarned?:boolean}) {
  return <p className="contract-locked-terms"><b>{n(contract.rate)} cr / t locked</b> · {date(contract.acceptedDay)}<span>{showEarned&&<>{n(contract.earnedCredits)} cr earned · </>}{n(contract.completionBonusCredits)} cr completion bonus{(contract.status==='cancelled'||contract.status==='expired')&&' forfeited'}</span></p>;
}

function Receipt({contract}:{contract:Contract}) {
  const offer=offerFor(contract.offerId);
  return <article className={'contract-receipt '+contract.status} data-contract-id={contract.id} aria-label={'Contract '+contract.id+' receipt'}>
    <div className="contract-title"><h3>{offer.name}</h3><span className="contract-state">{contract.status==='completed'?'Completed':contract.status==='expired'?'Expired':'Cancelled'}</span></div>
    <p className="contract-buyer">{offer.buyer} · #{contract.id}</p>
    <p className="contract-route">{SITE[offer.from].name} → {SITE[offer.to].name}</p>
    <dl className="contract-metrics"><div><dt>Delivered</dt><dd>{n(contract.deliveredT)} / {n(contract.quantityT)} <small>t</small></dd></div><div><dt>Earned</dt><dd>{n(contract.earnedCredits)} <small>cr</small></dd></div></dl>
    <LockedTerms contract={contract}/>
    <p className="contract-receipt-note">{date(contract.settledDay!)} · {contract.status==='completed'?'Completion bonus included.':'Paid deliveries remain earned. In-flight cargo becomes depot supply.'}</p>
  </article>;
}

function ContractOffer({offer,world,busy,act}:{offer:Offer;world:Campaign;busy:boolean;act:Act}) {
  const [size,setSize]=useState<ContractSize>('standard');
  const quote=contractQuote(world,offer.id,size),market=buyerMarket(world,offer.id),description='contract-offer-'+offer.id+'-reason';
  const rivalTiming=market.rivalInFlightT>0?`Rivals: ${n(market.rivalInFlightT)} t reserved${market.nextRivalArrivalDay!==null?' · due '+date(market.nextRivalArrivalDay):''}`:market.nextRivalDay<=LIMITS.days?'Rival booking window '+date(market.nextRivalDay):'No further rival bookings';
  return <article className="contract-offer" data-offer={offer.id} aria-labelledby={'contract-offer-'+offer.id}>
    <h3 id={'contract-offer-'+offer.id}>{offer.name}</h3>
    <p className="contract-buyer">{offer.buyer}</p>
    <p className="contract-route">{SITE[offer.from].name} → {SITE[offer.to].name}</p>
    <div className={'contract-market '+market.demandBand} data-testid={'buyer-market-'+offer.id}>
      <p><b>{n(market.openT)} t open</b> · {market.demandBand} demand<span>{market.nextReviewDay<=LIMITS.days?'New requests '+date(market.nextReviewDay):'Final requests before the horizon'}</span></p>
      <p>{rivalTiming}</p>
    </div>
    <label className="contract-size">Order size<select aria-label="Order size" value={size} onChange={event=>setSize(event.target.value as ContractSize)}><option value="standard">Standard · 30 t</option><option value="industrial">Industrial · 300 t</option></select></label>
    <p className="contract-offer-cargo"><b>{n(quote.quantityT)} t</b> {CARGO[offer.kind].toLowerCase()} · <span className="contract-quote-rate">{n(quote.rate)} cr / t</span></p>
    <p className="contract-payment"><b>{n(quote.totalCredits)} cr</b> total <span>{n(quote.baseCredits)} delivery + {n(quote.bonusCredits)} completion bonus</span></p>
    <p className="contract-terms">Depart within <b>{quote.loadingWindowDays} days</b> of acceptance. Arrive by <b>{date(quote.dueDay)}</b> ({n(quote.duration)} days in transit).</p>
    <button className="primary" disabled={busy||!!quote.reason} aria-describedby={description} onClick={()=>act(w=>acceptContract(w,offer.id,size,{marketRound:quote.marketRound,rate:quote.rate}))}>Accept contract</button>
    <p className={'contract-reason'+(quote.reason?' blocked':'')} id={description}>{quote.reason||'Starts now. Prepare and send freight after accepting.'}</p>
  </article>;
}

function ContractCard({contract,world,busy,act,prepareContract,browse}:{contract:Contract;world:Campaign;busy:boolean;act:Act;prepareContract:(id:number)=>void;browse:()=>void}) {
  const offer=offerFor(contract.offerId),active=contract.status==='active',remaining=contractRemaining(world,contract.id);
  const lastDeparture=contract.dueDay-contractQuote(world,contract.offerId,contract.size).duration,late=world.day>lastDeparture+1e-8;
  const status=active?'Active':contract.status==='completed'?'Completed':contract.status==='expired'?'Expired':'Cancelled';
  return <article className={'contract-card '+(active?'contract-active':'contract-receipt '+contract.status)} data-contract-id={contract.id} data-buyer={contract.offerId} aria-label={active?'Active contract '+contract.id:'Contract '+contract.id+' receipt'}>
    <div className="contract-title"><h3>{SITE[offer.from].name} → {SITE[offer.to].name}</h3><span className="contract-state">{status}</span></div>
    <p className="contract-buyer">{offer.buyer} · #{contract.id}</p>
    <div className="contract-delivery"><span><b data-testid={active?'contract-delivered':undefined}>{n(contract.deliveredT)} / {n(contract.quantityT)} t</b> {offer.kind==='materials'?'material':'equipment'}</span><span data-testid={active?'contract-in-flight':undefined}>{n(remaining.inFlightT)} t in flight</span></div>
    <progress aria-label={active?'Contract delivery progress':'Settled contract delivery progress'} value={contract.deliveredT} max={contract.quantityT}/>
    {active?<><p className="contract-deadline">Due <b>{date(contract.dueDay)}</b><span>{n(Math.max(0,contract.dueDay-world.day))} d left</span></p><p className={'contract-departure'+(late&&remaining.unassignedT>0?' blocked':'')}>{remaining.unassignedT===0?'All remaining cargo is in flight.':late?`${n(remaining.unassignedT)} t unsent. New departures would arrive late.`:`${n(remaining.unassignedT)} t to send · depart by ${date(lastDeparture)}.`}</p></>:<><p className="contract-deadline">Settled <b>{date(contract.settledDay!)}</b></p><p className="contract-departure">{n(contract.earnedCredits)} cr earned · {contract.status==='completed'?'bonus included':'bonus forfeited'}</p></>}
    <div className="contract-card-actions">
      {active?<button className="primary" disabled={remaining.unassignedT===0||late} onClick={()=>prepareContract(contract.id)}>Prepare shipment</button>:<button onClick={browse}>Browse contracts</button>}
      <details className="contract-active-terms"><summary>{active?'Terms & cancellation':'Agreed terms'}</summary><div className="contract-terms-body"><h4>{offer.name}</h4><LockedTerms contract={contract} showEarned/>{active?<><p className="contract-small">Customer freight is consumed on arrival. Cancelling keeps earned credits; remaining flights deliver to the depot.</p><button className="text-button" disabled={busy} onClick={()=>act(w=>cancelContract(w,contract.id))}>Cancel contract</button></>:<p className="contract-small">{contract.status==='completed'?'All customer freight was delivered.':remaining.inFlightT>0?'Remaining flights deliver to your depot.':'Paid deliveries remain earned.'}</p>}</div></details>
    </div>
  </article>;
}

export default function Contracts({world,busy,act,prepareContract}:{world:Campaign;busy:boolean;act:Act;prepareContract:(contractId:number)=>void}) {
  const [kind,setKind]=useState<ProcurementKind>('materials'),[amount,setAmount]=useState('1');
  const offers=useRef<HTMLDetailsElement>(null);
  const active=world.commerce.contracts.filter(contract=>contract.status==='active'),settled=world.commerce.contracts.filter(contract=>contract.status!=='active');
  const cards=CONTRACT_OFFERS.map(offer=>world.commerce.contracts.filter(contract=>contract.offerId===offer.id).at(-1)).filter((contract):contract is Contract=>!!contract);
  const quantity=Number(amount),cost=quantity*PROCUREMENT_PRICES[kind];
  const purchaseReason=amount.trim()===''?'Choose a whole procurement quantity.':procurementReason(world,kind,quantity);
  const browse=()=>{if(offers.current){offers.current.open=true;offers.current.scrollIntoView({block:'nearest'});offers.current.querySelector('summary')?.focus({preventScroll:true});}};
  return <section className="campaign-contracts" id="contracts" aria-labelledby="contracts-heading">
    <header className="panel-title"><div><h2 id="contracts-heading">Freight contracts</h2><p className="contract-commitments">{active.length} / 3 buyers active</p></div><span className="contract-balance"><b data-testid="contract-credits">{n(world.commerce.credits)} cr</b><span>available</span></span></header>
    <div className={'contract-current'+(cards.length?' has-contract-cards':'')}>
      {cards.length?cards.map(contract=><ContractCard key={contract.offerId} contract={contract} world={world} busy={busy} act={act} prepareContract={prepareContract} browse={browse}/>):<div className="contract-empty"><h3>Put your spare capacity to work.</h3><p>Deliver customer freight, earn credits, and buy supplies at Earth. One active order per buyer.</p><p>Buyers need commissioned routes and production at the origin.</p><button onClick={browse}>Browse available contracts ↗</button></div>}
    </div>
    <details ref={offers} className="contract-offers"><summary>Available contracts <span>3 buyers · rates follow open demand</span></summary><p className="contract-rules">Accepting reserves the cargo quantity and locks your rate and 25% completion bonus. Only assigned customer freight earns credits; buyers consume on-time deliveries. More open demand pays a higher rate. Rival bookings reduce availability. You can take another order from the same buyer 90 days after your order ends.</p>{CONTRACT_OFFERS.map(offer=><ContractOffer key={offer.id} offer={offer} world={world} busy={busy} act={act}/>)}
      <details className="contract-market-activity"><summary>Buyer activity <span>Requests and competing deliveries</span></summary><p className="contract-rules">Buyers review requests every 90 days. Unclaimed requests expire at the review; accepted orders keep their terms. Cancellation never reopens expired requests. Selene Logistics and Vector Freight use their own cargo and fleets. Rival freight in transit is already reserved; its arrival does not reduce open demand again or take cargo from your depots.</p><div className="contract-market-scroll" role="region" aria-label="Recent buyer activity" tabIndex={0}>{world.commerce.market.history.length?<ol>{[...world.commerce.market.history].reverse().map((entry,index)=><li key={index}><time>{date(entry.day)}</time><span>{entry.text}</span></li>)}</ol>:<p className="contract-rules">New buyer requests and rival bookings will appear here as simulation time advances.</p>}</div></details>
    </details>
    <details className="contract-procurement"><summary>Earth procurement <span>Spend earned credits on supplies</span></summary><form onSubmit={event=>{event.preventDefault();if(!busy&&!purchaseReason)act(w=>procure(w,kind,quantity));}}>
      <label htmlFor="procurement-resource">Procurement resource</label><select id="procurement-resource" value={kind} onChange={event=>setKind(event.target.value as ProcurementKind)}><option value="materials">Material · 12 cr / t</option><option value="equipment">Equipment · 30 cr / t</option><option value="fuel">Support fuel · 2 cr / t</option></select>
      <label htmlFor="procurement-amount">Purchase amount (t)</label><div className="procurement-controls"><input id="procurement-amount" type="number" min="1" max={LIMITS.stock} step="1" required value={amount} onChange={event=>setAmount(event.target.value)} aria-describedby="procurement-cost procurement-reason"/><button type="submit" disabled={busy||!!purchaseReason}>Buy supplies</button></div>
      <p className="procurement-cost" id="procurement-cost">Cost <b>{Number.isFinite(cost)&&quantity>0?n(cost):'—'} cr</b> · balance {n(world.commerce.credits)} cr</p><p className={'contract-reason'+(purchaseReason?' blocked':'')} id="procurement-reason">{purchaseReason||'Ready to purchase.'}</p><p className="contract-small">{kind==='fuel'?'Purchased fuel joins the shared support pool immediately.':'Purchased supplies enter the Earth depot immediately. Shipping is separate.'}</p>
    </form></details>
    <details className="contract-history"><summary>Contract receipts <span>{settled.length} settled</span></summary><div className="contract-history-scroll" role="region" aria-label="Contract receipt history" tabIndex={0}>{settled.length?[...settled].reverse().map(contract=><Receipt key={contract.id} contract={contract}/>):<p className="contract-rules">Completed, expired and cancelled orders keep their delivery and payment records here.</p>}</div></details>
  </section>;
}
