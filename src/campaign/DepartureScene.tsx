import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STORY, captureDetail, storyFrame } from '../components/flight-story-motion.js';
import DepartureDiagram from './DepartureDiagram.js';

/** A presentation camera over the existing illustrative motion, never a solver. */
export default function DepartureScene({stage,progress}:{stage:number;progress:number}) {
  const host=useRef<HTMLDivElement>(null),frame=useRef({stage,progress}),draw=useRef(()=>{});
  frame.current={stage,progress};
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useLayoutEffect(()=>{draw.current();},[stage,progress]);
  useEffect(()=>{
    const root=host.current!;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});}
    catch{setFailed(true);return;}
    let disposed=false,lost=false;
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    root.append(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#070d13');
    const camera=new THREE.OrthographicCamera(-500,500,310,-310,1,5000);
    scene.add(new THREE.AmbientLight('#bfd0e6',.8));
    const sun=new THREE.DirectionalLight('#fff1db',3.2);sun.position.set(-900,750,1300);scene.add(sun);
    const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],textures:THREE.Texture[]=[];
    const metal=new THREE.MeshStandardMaterial({color:'#b7cbd3',metalness:.65,roughness:.36});
    const dark=new THREE.MeshStandardMaterial({color:'#263744',metalness:.5,roughness:.5});
    const copper=new THREE.MeshStandardMaterial({color:'#d69a70',metalness:.35,roughness:.45});
    materials.push(metal,dark,copper);
    const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{geometries.push(g);const object=new THREE.Mesh(g,m);parent.add(object);return object;};
    const box=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m=metal)=>{const object=mesh(new THREE.BoxGeometry(w,h,d),m,parent);object.position.set(x,y,z);return object;};
    const rod=(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m=metal)=>{const delta=b.clone().sub(a),object=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),m,parent);object.position.copy(a.clone().add(b).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return object;};
    const earthMaterial=new THREE.MeshStandardMaterial({color:'#667987',roughness:1});materials.push(earthMaterial);
    const earth=mesh(new THREE.SphereGeometry(STORY.radius,64,40),earthMaterial,scene);earth.rotation.set(.18,-1.2,.18);
    const cloudMaterial=new THREE.MeshStandardMaterial({transparent:true,opacity:.55,depthWrite:false,roughness:1});materials.push(cloudMaterial);
    const clouds=mesh(new THREE.SphereGeometry(STORY.radius*1.004,64,40),cloudMaterial,scene);clouds.rotation.copy(earth.rotation);clouds.visible=false;
    const load=(url:string,apply:(texture:THREE.Texture)=>void)=>{
      const texture=new THREE.TextureLoader().load(url,loaded=>{if(disposed)return;loaded.colorSpace=THREE.SRGBColorSpace;apply(loaded);draw.current();},undefined,()=>{});
      textures.push(texture);
    };
    load('/textures/earth.webp',texture=>{earthMaterial.map=texture;earthMaterial.color.set('#ffffff');earthMaterial.needsUpdate=true;});
    load('/textures/earth-clouds.webp',texture=>{cloudMaterial.map=texture;cloudMaterial.needsUpdate=true;clouds.visible=true;});
    const orbitGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:161},(_,i)=>{const a=i/160*Math.PI*2;return new THREE.Vector3(Math.sin(a)*STORY.orbit,Math.cos(a)*STORY.orbit,-2);}));geometries.push(orbitGeometry);
    const orbitMaterial=new THREE.LineBasicMaterial({color:'#608b9d',transparent:true,opacity:.23});materials.push(orbitMaterial);scene.add(new THREE.Line(orbitGeometry,orbitMaterial));
    const starGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:110},(_,i)=>new THREE.Vector3((i*137.508)%1400-600,(i*i*31.7+23)%1100,-100-(i%9)*30)));geometries.push(starGeometry);
    const starMaterial=new THREE.PointsMaterial({color:'#afc6d2',size:1.7,sizeAttenuation:false,transparent:true,opacity:.45});materials.push(starMaterial);scene.add(new THREE.Points(starGeometry,starMaterial));
    const tether=new THREE.Group();scene.add(tether);
    rod(tether,new THREE.Vector3(0,-STORY.arm,0),new THREE.Vector3(0,STORY.arm,0),1.4);
    box(tether,18,16,16,0,0,0,dark);box(tether,5,20,18,0,0,0,copper);
    for(const x of [-26,26]){box(tether,28,17,1.5,x,0,-2,dark);for(const dx of [-7,0,7])box(tether,.4,17,1,x+dx,0,0,copper);}
    mesh(new THREE.SphereGeometry(6,16,12),metal,tether).position.y=STORY.arm;
    const grapple=new THREE.Group();grapple.position.y=-STORY.arm;tether.add(grapple);
    box(grapple,34,7,12,0,20,0,dark);
    const jaws=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*14,18,0);grapple.add(pivot);const points=[[0,0],[side*3,-13],[0,-27],[-side*9,-31]].map(([x,y])=>new THREE.Vector3(x,y,0));for(let i=1;i<points.length;i++)rod(pivot,points[i-1],points[i],1.7);mesh(new THREE.SphereGeometry(2.6,12,8),copper,pivot);return pivot;});
    const latch=box(grapple,12,2,3,0,-13,3,copper);
    const payload=new THREE.Group();scene.add(payload);
    box(payload,16,22,12,0,-26,0,dark);box(payload,17,5,13,0,-25,0,copper);
    box(payload,2.8,15,2.8,0,-7,0,metal);
    const fitting=mesh(new THREE.TorusGeometry(6,2,10,28),copper,payload);fitting.rotation.y=.2;
    for(const x of [-7,7])box(payload,1,20,13,x,-26,0,metal);
    draw.current=()=>{
      if(disposed||lost||!root.clientWidth)return;
      const {stage,progress}=frame.current,f=storyFrame(stage,progress),detail=captureDetail(progress),zoom=stage===1?detail.scale:1;
      const drawingCenter={x:stage===1?(500-detail.x)/zoom:500,y:stage===1?(310-detail.y)/zoom:310};
      camera.left=-500/zoom;camera.right=500/zoom;camera.top=310/zoom;camera.bottom=-310/zoom;camera.updateProjectionMatrix();
      camera.position.set(drawingCenter.x-STORY.earth.x,STORY.earth.y-drawingCenter.y,2000);camera.lookAt(camera.position.x,camera.position.y,0);
      tether.position.set(f.hub.x-STORY.earth.x,STORY.earth.y-f.hub.y,0);tether.rotation.z=-f.angle;
      payload.visible=!!f.payload;
      if(f.payload)payload.position.set(f.payload.x-STORY.earth.x,STORY.earth.y-f.payload.y,0);
      payload.rotation.z=-(stage===3?STORY.releaseTime:f.angle);
      const opening=Math.min(1,progress/.12);
      const jawAngle=(stage===1?detail.jawAngle:stage===2?0:stage===3?36*opening*opening*(3-2*opening):36)*Math.PI/180;
      jaws[0].rotation.z=-jawAngle;jaws[1].rotation.z=jawAngle;
      latch.visible=stage===2||stage===1&&detail.locked;
      renderer.render(scene,camera);
    };
    const resize=()=>{renderer.setSize(root.clientWidth,root.clientWidth*620/1000,false);draw.current();};
    const observer=new ResizeObserver(resize);observer.observe(root);
    const contextLost=(event:Event)=>{event.preventDefault();lost=true;setFailed(true);};
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    resize();setReady(true);
    return()=>{disposed=true;draw.current=()=>{};observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[]);
  return <div className="departure-visual" data-renderer={ready&&!failed?'webgl':'diagram'}>
    <div ref={host} className="departure-webgl" aria-hidden="true" hidden={!ready||failed}/>
    {(!ready||failed)&&<DepartureDiagram stage={stage} progress={progress}/>}
  </div>;
}
