import {validateCardio} from '../simulation/cardio.js';
import {simulateCardioRelease} from '../simulation/cardio-release.js';
import {cardioTimingPlan} from '../simulation/cardio-study.js';
self.onmessage=(event:MessageEvent)=>{
  try{
    const design=validateCardio(event.data.design),plan=cardioTimingPlan(event.data.current);
    self.postMessage({plan});
    for(const fraction of plan)self.postMessage({result:simulateCardioRelease(design,fraction)});
    self.postMessage({complete:true});
  }catch(e){self.postMessage({error:e instanceof Error?e.message:'Timing comparison failed.'});}
};
