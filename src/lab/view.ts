import {compile,pointState,type Result,type Frame} from '../simulation/engine.js';
export function sample(result:Result,t:number):Frame {
  const a=result.frames;if(!a.length)throw Error('No trajectory samples.');let lo=0,hi=a.length-1;
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(a[m].t<=t)lo=m;else hi=m-1;}
  const f=a[lo],n=a[lo+1];if(!n||n.loaded!==f.loaded||n.t===f.t)return f;
  const u=Math.max(0,Math.min(1,(t-f.t)/(n.t-f.t)));
  return {...f,t,state:f.state.map((v,i)=>v+(n.state[i]-v)*u),payloads:f.payloads.map((p,i)=>n.payloads[i]?p.map((v,j)=>v+(n.payloads[i][j]-v)*u):p),fuel:f.fuel+(n.fuel-f.fuel)*u};
}
export function positions(r:Result,f:Frame){const b=compile(r.design,f.fuel,f.loaded);return {a:pointState(f.state,b,-b.half),z:pointState(f.state,b,b.half),hub:pointState(f.state,b,0)};}
export const elapsed=(t:number)=>{const n=Math.max(0,Math.floor(t));return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
