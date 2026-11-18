import { simulate, validate } from '../simulation/engine.js';
import { earthDesignReport } from '../simulation/expedition-design.js';
self.onmessage = (event: MessageEvent<string>) => {
  try {
    if(event.data.length>16000)throw Error('Earth design exceeds the size limit.');
    const design=validate(JSON.parse(event.data));
    if(design.architecture!=='single-stage-rotovator')throw Error('Choose an Earth rotovator design.');
    self.postMessage({report:earthDesignReport(simulate(design))});
  } catch(error) {self.postMessage({error:error instanceof Error?error.message:'Earth design calculation failed.'});}
};
