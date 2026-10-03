import * as T from 'three';
import type { Planet } from './PlanetDisc.js';

/** Visual albedo only. These maps never enter the dynamics or clearance model. */
export function planetMaterial(body:Planet,renderer:T.WebGLRenderer,onReady:()=>void) {
  const material=new T.MeshPhongMaterial({color:body==='earth'?0x243b48:0x777571,specular:0x080808,shininess:2});
  let disposed=false;
  const texture=new T.TextureLoader().load(`/textures/${body}.webp`,map=>{
    if(disposed){map.dispose();return;}
    map.colorSpace=T.SRGBColorSpace;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    material.color.set(0xffffff);material.map=map;material.needsUpdate=true;
    onReady(); // Paused scenes must repaint when the asynchronous image arrives.
  },undefined,()=>{}); // Keep the neutral, lit sphere if an image cannot load.
  material.addEventListener('dispose',()=>{disposed=true;texture.dispose();});
  return material;
}

/** A separate photographic cloud layer, attached to the Earth mesh. */
export function earthClouds(renderer:T.WebGLRenderer,onReady:()=>void) {
  const material=new T.MeshPhongMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,shininess:0});
  let disposed=false;
  const texture=new T.TextureLoader().load('/textures/earth-clouds.webp',map=>{
    if(disposed){map.dispose();return;}
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    material.alphaMap=map;material.opacity=.8;material.needsUpdate=true;onReady();
  },undefined,()=>{});
  material.addEventListener('dispose',()=>{disposed=true;texture.dispose();});
  return new T.Mesh(new T.SphereGeometry(1.003,96,64),material);
}
