// npx esbuild scripts/film/export-worlds.ts --bundle --platform=node --format=esm --outfile=/tmp/skyhook-export.mjs
// node /tmp/skyhook-export.mjs qa/vehicle-film
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {earthDepartureWorld} from '../../src/campaign/earthDepartureWorld.js';
import {lunarDepartureWorld} from '../../src/campaign/lunarDepartureWorld.js';
import {createHypersonicAircraft} from '../../src/campaign/HypersonicAircraft.js';
import {createFlightCargo} from '../../src/visuals/FlightHardware.js';
import {portraitCamera} from '../../src/visuals/VehiclePortrait.js';
import {LAUNCH_MS} from '../../src/campaign/earth-launch-motion.js';
import {LUNAR_MS} from '../../src/campaign/lunar-launch-motion.js';

const out=process.argv[2];if(!out)throw Error('Supply an output directory');fs.mkdirSync(out,{recursive:true});
const timing=JSON.parse(fs.readFileSync('docs/storyboards/skyhook-introduction.timings.json','utf8'));
const assets={load:(name:string,apply:(t:T.Texture)=>void)=>{const t=new T.Texture();t.name=name;apply(t);},status:()=>{}};
const earth=earthDepartureWorld(assets),moon=lunarDepartureWorld(assets);
const parts=new Map<T.BufferGeometry,number>(),finishes=new Map<T.Material,number>(),geos:any[]=[],mats:any[]=[];
function geom(g:T.BufferGeometry){
  if(parts.has(g))return parts.get(g)!;const id=geos.length;parts.set(g,id);
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),data=new Float32Array(p.count*8);
  for(let i=0;i<p.count;i++)data.set([p.getX(i),p.getY(i),p.getZ(i),n?.getX(i)??0,n?.getY(i)??1,n?.getZ(i)??0,uv?.getX(i)??0,uv?.getY(i)??0],i*8);
  fs.writeFileSync(path.join(out,'g'+id),Buffer.from(data.buffer));if(g.index)fs.writeFileSync(path.join(out,'i'+id),Buffer.from(Uint32Array.from(g.index.array).buffer));
  geos.push({index:!!g.index});return id;
}
function mat(m:any){if(finishes.has(m))return finishes.get(m)!;const id=mats.length;finishes.set(m,id);
  mats.push({name:m.name,color:m.color.toArray(),metal:m.metalness??0,rough:m.roughness??.6,map:m.map?.name,alpha:m.alphaMap?.name,basic:!m.isMeshStandardMaterial,
    double:m.side===T.DoubleSide,emissive:m.emissive?.clone().multiplyScalar(m.emissiveIntensity??1).toArray()??[0,0,0]});return id;
}
const pack=(xs:number[])=>xs.map(v=>Math.round(v*1e7)/1e7);
function recorder(scene:T.Scene,camera:T.OrthographicCamera,portrait=false){
  const nodes:any[]=[];scene.traverse(o=>{if('geometry' in o)nodes.push(o);});
  const objects=nodes.map(o=>{let plate;for(let p=o;p;p=p.parent)if(['carrier','earth-cargo','lunar-cargo'].includes(p.name)&&o.material.isMeshStandardMaterial)plate=p.name;
    return {g:geom(o.geometry),kind:o.isPoints?'points':o.isLine?'line':'mesh',order:o.renderOrder,plate};});
  const frames:any[]=[];const last:string[]=[];
  function frame(index:number,scale=1,shift=.0){
    camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    const pv=camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    const clip=camera.projectionMatrix.clone();clip.elements[0]*=.55;clip.elements[5]*=.73;
    const fr=new T.Frustum().setFromProjectionMatrix(clip.multiply(camera.matrixWorldInverse)),updates:any[]=[];
    for(let i=0;i<nodes.length;i++){
      const o=nodes[i],m=o.material;let visible=m.opacity>.002;for(let q=o;q;q=q.parent)if(!q.visible){visible=false;break;}
      visible=visible&&(portrait||fr.intersectsObject(o));
      const v=visible?[mat(m),pack(o.matrixWorld.toArray()),+m.opacity.toFixed(3),m.depthWrite?1:0]:null;
      const key=JSON.stringify(v);if(key!==last[i]){updates.push([i,v]);last[i]=key;}
    }
    frames.push({i:index,cam:pack(pv.toArray()),eye:pack(camera.getWorldDirection(new T.Vector3()).negate().toArray()),scale,shift,updates});
  }
  return {frame,objects,frames};
}
const worlds={earth:recorder(earth.scene,earth.camera),moon:recorder(moon.scene,moon.camera)};
const sample=(pins:number[][],t:number)=>{for(let i=1;i<pins.length;i++){const [a,v]=pins[i-1],[b,w]=pins[i];if(t<=b)return v+(w-v)*(t-a)/(b-a);}return pins.at(-1)![1];};
for(let i=0;i<Math.round(timing.duration*24);i++){
  const t=i/24,s=timing.shots.find((s:any)=>t>=s.start&&t<s.end),p=(t-s.start)/(s.end-s.start), a=s.sentences;
  let time:number,body:'earth'|'moon'='earth';
  if(s.id==='opening')time=.5+5.3*p;
  else if(s.id==='earth')time=sample([[s.start,5.8],[a[0].end,9],[a[2].start,11.2],[s.end,16]],t);
  else if(s.id==='release')time=16+16*p;
  else if(s.id==='moon'){body='moon';time=sample([[s.start,0],[a[1].start,4],[a[1].start+(a[1].end-a[1].start)*.55,10],[s.end,17]],t);}
  else continue;
  const durations=body==='earth'?LAUNCH_MS:LUNAR_MS;let stage=0,ms=time*1000;
  while(stage<durations.length-1&&ms>=durations[stage])ms-=durations[stage++];
  (body==='earth'?earth:moon).pose(stage,ms/durations[stage]);
  worlds[body].frame(i,s.id==='release'?.82:.98,s.id==='release'?.10:.28);
}
const portraits:any={};
for(const name of ['carrier','rear','earth-cargo','lunar-cargo']){
  const scene=new T.Scene();const plane=name==='carrier'||name==='rear';
  const model=plane?createHypersonicAircraft():createFlightCargo(name==='lunar-cargo'?'moon':'earth');
  scene.add(model.group);if('exhaust' in model)model.exhaust.forEach(o=>o.visible=false);
  // Keep the attachment datum at the projected origin in all fallback layers.
  const size=plane?108:3.5,aspect=plane?2.08:1,c=new T.OrthographicCamera(-size/2,size/2,size/2/aspect,-size/2/aspect,.1,1000);
  c.position.copy(name==='rear'?new T.Vector3(-140,30,0):plane?new T.Vector3(-44,81,168):new T.Vector3(2,1.1,8));
  if(!plane){c.position.y-=1.28;c.lookAt(0,-1.28,0);}else c.lookAt(0,1,0);
  const r=recorder(scene,c,true);r.frame(0);portraits[name]=r;model.dispose();
}
fs.writeFileSync(path.join(out,'scenes.json'),JSON.stringify({geos,mats,worlds,portraits,prints:Object.fromEntries((['carrier','earth-cargo','lunar-cargo'] as const).map(name=>{const c=portraitCamera(name);return [name,{vp:c.projection.toArray(),eye:c.toward.toArray()}];}))}));
