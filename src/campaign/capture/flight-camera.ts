import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFlightCargo } from '../../visuals/FlightHardware.js';
import { launchTetherAt } from '../earth-launch-motion.js';
import { makeGrapple,makeServiceBay } from './Grapple.js';
import { makeSoftwareCamera } from './software-camera.js';
import { makeOrbitalBackground } from './orbital-background.js';
import type { Carriage, Telemetry } from './pass.js';

export const cameraNames = ['Tracking', 'Payload', 'Grapple'] as const;
export type CameraName = typeof cameraNames[number];
export type Exposure = { time:number; carriage:Carriage; data:Telemetry; camera:CameraName; secured:boolean; yaw:number; pitch:number };

function flightPlate() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#dbd8cb';ctx.fillRect(0,0,512,192);
  ctx.fillStyle='#24303a';ctx.fillRect(0,0,512,13);
  ctx.font='bold 66px sans-serif';ctx.fillText('SKYHOOK',20,94);
  ctx.font='30px monospace';ctx.fillText('CARGO  /  E-01',20,150);
  for(let i=0;i<22;i++)ctx.fillRect(375+i*5,115,1+(i%3),38);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const material=new T.MeshStandardMaterial({map:texture,roughness:.68,metalness:.08});
  const geometry=new T.CylinderGeometry(.746,.746,.29,36,1,true,-.51,1.02);
  const plate=new T.Mesh(geometry,material);plate.position.y=-1.75;plate.rotation.y=.24;
  return {plate,dispose(){texture.dispose();material.dispose();geometry.dispose();}};
}

export function openFlightCamera(host:HTMLElement, last:()=>Exposure, failed:()=>void) {
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.035,500);
  const grapple=makeGrapple(),cargo=createFlightCargo('earth'),label=flightPlate(),service=makeServiceBay();
  cargo.group.add(label.plate,service.group);scene.add(grapple.base,cargo.group);
  cargo.group.traverse(p=>{if(p instanceof T.Mesh){p.castShadow=true;p.receiveShadow=true;}});
  const sky=new T.HemisphereLight('#e2e8f4','#6886a8',.72);scene.add(sky);
  const sun=new T.DirectionalLight('#fff7e4',3.05);
  sun.position.set(-8,6.4,4);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:6,bottom:-6,near:.1,far:32});
  sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.013;sun.shadow.bias=-.0002;
  scene.add(sun,sun.target);
  let renderer:T.WebGLRenderer|undefined, reflections:T.WebGLRenderTarget|undefined;
  let software:ReturnType<typeof makeSoftwareCamera>|undefined,background:ReturnType<typeof makeOrbitalBackground>|undefined;
  let disposed=false,previous:Exposure|undefined;
  function useSoftware(){
    renderer?.domElement.remove();
    software=makeSoftwareCamera(host,scene,()=>draw(true));
    host.dataset.graphics='software';
  }
  try {renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});}
  catch {useSoftware();}
  if(renderer){
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
    renderer.autoClear=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    host.append(renderer.domElement);
    const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
    reflections=pmrem.fromScene(room,.07);scene.environment=reflections.texture;
    scene.environmentIntensity=.72;room.dispose();pmrem.dispose();
    background=makeOrbitalBackground(renderer,()=>draw(true));
    host.dataset.graphics='webgl';
  }
  function draw(force=false) {
    if(disposed||!host.clientWidth)return;
    const f=last(), p=f.data.cargo, c=f.carriage;
    cargo.group.position.set(p.x,p.y,p.z);
    grapple.pose(c.x,c.z,f.secured);
    const target=new T.Vector3(), eye=new T.Vector3();
    const narrow=Math.max(1,1.16/camera.aspect);
    camera.up.set(0,1,0);
    if(f.camera==='Tracking') {
      const reach=9.9*narrow;
      target.set((p.x+c.x)*.5,p.y+Math.min(1.0,.57-p.y*.10),(p.z+c.z)*.5);
      const az=.49+f.yaw,el=.32+f.pitch;
      eye.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(reach).add(target);
    } else if(f.camera==='Payload'){
      eye.set(p.x+1.22,p.y-.03,p.z+1.85);
      target.set(p.x-.30,p.y+.19,p.z-.38);
    } else {
      eye.set(c.x+.85,1.35,c.z+.94);
      target.set(p.x*.78+c.x*.22,Math.min(-.16,p.y-.52),p.z*.78+c.z*.22);
    }
    camera.position.copy(eye);camera.lookAt(target);
    if(f.camera==='Tracking')camera.rotateZ(-.17);
    if(f.camera==='Payload')camera.rotateZ(.20);
    camera.updateMatrixWorld();
    const tether=launchTetherAt(f.time);
    const cs=Math.cos(tether.angle),sn=Math.sin(tether.angle);
    sun.position.set(-8*cs+6.4*sn,8*sn+6.4*cs,4);
    if(software){
      const movedCamera=previous?.camera!==f.camera||previous.yaw!==f.yaw||previous.pitch!==f.pitch;
      software.draw(camera,tether.tip,tether.angle,force||movedCamera||previous?.time===f.time||previous?.secured!==f.secured);
    }else if(renderer&&background){
      renderer.clear();background.draw(camera,tether.tip,tether.angle);renderer.clearDepth();renderer.render(scene,camera);
    }
    previous=f;
  }
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer?.setSize(w,h,false);draw(true);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  function loss(e:Event){e.preventDefault();if(disposed||software)return;try{useSoftware();draw(true);}catch{failed();}}
  renderer?.domElement.addEventListener('webglcontextlost',loss);
  resize();
  return {draw,dispose(){
    disposed=true;observer.disconnect();renderer?.domElement.removeEventListener('webglcontextlost',loss);
    grapple.dispose();cargo.dispose();label.dispose();service.dispose();background?.dispose();software?.dispose();reflections?.dispose();sun.shadow.dispose();
    renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();
  }};
}
