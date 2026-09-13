import { simulateOps } from '../../simulation/operations.js';
self.onmessage = (event:MessageEvent) => {
  const {id,plan}=event.data;
  try {const result=simulateOps(plan,{progress:fraction=>self.postMessage({id,fraction})});self.postMessage({id,result});}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
