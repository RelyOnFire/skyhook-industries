import {simulate} from '../simulation/engine.js';
self.onmessage=(event:MessageEvent)=>{
  const {id,design}=event.data;
  try{const result=simulate(design);self.postMessage({id,result});}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Calculation failed.'});}
};
