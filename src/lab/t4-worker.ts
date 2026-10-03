import { runT4, validateT4 } from '../simulation/t4.js';
import { planT4Study, runT4Trial } from '../simulation/t4-study.js';
self.onmessage=e=>{
  try{
    const d=validateT4(e.data.design);
    if(e.data.kind==='phase'||e.data.kind==='timing'){
      const plan=planT4Study(d,e.data.kind,e.data.spacing);
      for(const [index,design] of plan.samples.entries())self.postMessage({id:e.data.id,row:runT4Trial(design,index)});
      self.postMessage({id:e.data.id,complete:true});
    }
    else self.postMessage({id:e.data.id,result:runT4(d)});
  }catch(error){self.postMessage({id:e.data.id,error:error instanceof Error?error.message:'T4 calculation failed.'});}
};
