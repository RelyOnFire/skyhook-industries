import { simulateCardio } from '../simulation/cardio.js';
self.onmessage=(event:MessageEvent)=>{try{self.postMessage({result:simulateCardio(event.data)});}catch(e){self.postMessage({error:e instanceof Error?e.message:'Calculation failed.'});}};
