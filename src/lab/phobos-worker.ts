import { runPhobos } from '../simulation/phobos.js';
self.onmessage=e=>{
  try { self.postMessage({id:e.data.id,result:runPhobos(e.data.design)}); }
  catch(error){self.postMessage({id:e.data.id,error:error instanceof Error?error.message:'Phobos calculation failed.'});}
};
