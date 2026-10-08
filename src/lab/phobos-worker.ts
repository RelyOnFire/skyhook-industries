import { runPhobos } from '../simulation/phobos.js';
import { planPhobosStudy,runPhobosTrial } from '../simulation/phobos-study.js';
self.onmessage=e=>{
  try {
    if(e.data.kind==='study'){
      const plan=planPhobosStudy(e.data.design,e.data.spacingKm);
      plan.samples.forEach((design,index)=>self.postMessage({id:e.data.id,row:runPhobosTrial(design,index)}));
      self.postMessage({id:e.data.id,complete:true});
    }else self.postMessage({id:e.data.id,result:runPhobos(e.data.design)});
  }
  catch(error){self.postMessage({id:e.data.id,error:error instanceof Error?error.message:'Phobos calculation failed.'});}
};
