import {simulateCardioRelease} from '../simulation/cardio-release.js';
self.onmessage=(event:MessageEvent)=>{
  try{self.postMessage({result:simulateCardioRelease(event.data.design,event.data.fraction)});}
  catch(e){self.postMessage({error:e instanceof Error?e.message:'Release calculation failed.'});}
};
