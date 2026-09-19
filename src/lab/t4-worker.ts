import { runT4, t4Summary, validateT4 } from '../simulation/t4.js';
self.onmessage=e=>{
  try{
    const d=validateT4(e.data.design);
    if(e.data.kind==='sweep'){
      const rows=[];for(const phaseDeg of [0,60,120,180,240,300]){rows.push(t4Summary(runT4({...d,phaseDeg})));self.postMessage({id:e.data.id,progress:rows.length});}
      self.postMessage({id:e.data.id,rows});
    }
    else self.postMessage({id:e.data.id,result:runT4(d)});
  }catch(error){self.postMessage({id:e.data.id,error:error instanceof Error?error.message:'T4 calculation failed.'});}
};
