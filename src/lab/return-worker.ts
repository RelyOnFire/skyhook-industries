import { simulate } from '../simulation/engine.js';
import { returnTraffic } from '../simulation/return-traffic.js';
self.onmessage = (event:MessageEvent) => {
  const {design,settings}=event.data;
  try { self.postMessage({result:returnTraffic(simulate(design),settings)}); }
  catch(error) { self.postMessage({error:error instanceof Error?error.message:'Return calculation failed.'}); }
};
