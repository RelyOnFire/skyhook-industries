import {validateCardioReference,type CardioReferenceDesign} from './cardio-reference.js';
import {CARDIO_REFERENCE_RELEASE_MODEL} from './cardio-reference-release.js';

export const CARDIO_REFERENCE_SAVE_KEY='skyhook-lab-cardio-reference-v1';
export const CARDIO_REFERENCE_FRAGMENT='cardio-reference';
export const CARDIO_REFERENCE_FILE_LIMIT=16384;
export interface CardioReferenceSetup {
  format:'skyhook-cardio-reference';version:1;model:typeof CARDIO_REFERENCE_RELEASE_MODEL;
  design:CardioReferenceDesign;phase:number;showTrace:boolean;
}

export function validateCardioReferenceSetup(value:unknown):CardioReferenceSetup {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a synchronized Cardio reference file.');
  const v=value as Record<string,unknown>;
  if(v.format!=='skyhook-cardio-reference'||v.version!==1||v.model!==CARDIO_REFERENCE_RELEASE_MODEL)
    throw Error('Use a version-1 synchronized Cardio reference file; passive designs and result reports use separate formats.');
  const design=validateCardioReference(v.design);
  if(typeof v.phase!=='number'||!Number.isFinite(v.phase)||v.phase<0||v.phase>1)
    throw Error('Reference phase must be between 0 and 1.');
  if(typeof v.showTrace!=='boolean')throw Error('Reference trace selection must be true or false.');
  return {format:'skyhook-cardio-reference',version:1,model:CARDIO_REFERENCE_RELEASE_MODEL,design,phase:v.phase,showTrace:v.showTrace};
}

export function createCardioReferenceSetup(design:CardioReferenceDesign,phase:number,showTrace:boolean):CardioReferenceSetup {
  return validateCardioReferenceSetup({format:'skyhook-cardio-reference',version:1,model:CARDIO_REFERENCE_RELEASE_MODEL,design,phase,showTrace});
}

export function readCardioReferenceSetup(text:string):CardioReferenceSetup {
  if(new TextEncoder().encode(text).length>CARDIO_REFERENCE_FILE_LIMIT)throw Error('Reference file exceeds 16 KB.');
  let value:unknown;try{value=JSON.parse(text);}catch{throw Error('Reference file is not valid JSON.');}
  return validateCardioReferenceSetup(value);
}

export function cardioReferenceFragment(setup:CardioReferenceSetup):string {
  return '#'+CARDIO_REFERENCE_FRAGMENT+'='+encodeURIComponent(JSON.stringify(validateCardioReferenceSetup(setup)));
}
