import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {LUNAR_LAUNCH,LUNAR_RAIL,lunarEase,lunarLaunchFrame,lunarLaunchPath} from './lunar-launch-motion.js';
import {createLunarLauncher,positionLunarCargo} from './LunarLauncher.js';
import LunarDepartureDiagram from './LunarDepartureDiagram.js';
/** Original launcher, industrial apron and grapple. All hardware is enlarged. */
export default function LunarDepartureScene({stage,progress}:{stage:number;progress:number}){
 const host=useRef<HTMLDivElement>(null),frame=useRef({stage,progress}),draw=useRef(()=>{});
 frame.current={stage,progress};
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 useLayoutEffect(()=>draw.current(),[stage,progress]);
 useEffect(()=>{
  const root=host.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
  let disposed=false,lost=false;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;root.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#070d13');
  const camera=new THREE.OrthographicCamera(-500,500,310,-310,.01,16000);
  scene.add(new THREE.AmbientLight('#b5c9de',.75));scene.add(new THREE.HemisphereLight('#9eb9cf','#192630',.65));
  const sun=new THREE.DirectionalLight('#fff0d9',3.2);sun.position.set(-400,800,1200);scene.add(sun);
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures:THREE.Texture[]=[];
 const metal=new THREE.MeshStandardMaterial({color:'#b8c8d0',metalness:.6,roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#253642',metalness:.5,roughness:.5}),copper=new THREE.MeshStandardMaterial({color:'#d29b74',metalness:.45,roughness:.4}),lit=new THREE.MeshStandardMaterial({color:'#e6b485',emissive:'#bb7435',emissiveIntensity:.6,roughness:.5}),cargo=new THREE.MeshStandardMaterial({color:'#e5e2d5',metalness:.18,roughness:.55});materials.push(metal,dark,copper,lit,cargo);
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{geometries.push(g);const o=new THREE.Mesh(g,m);parent.add(o);return o;};
  const box=(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m=metal)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),m,p);o.position.set(x,y,z);return o;};
  const rod=(p:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m=metal)=>{const delta=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),m,p);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const surface=new THREE.MeshStandardMaterial({color:'#777b7f',roughness:1,transparent:true});materials.push(surface);
  const moon=mesh(new THREE.SphereGeometry(LUNAR_LAUNCH.radius,256,128),surface,scene);
  // Put the corridor over the mid-latitude Hadley image reference instead of
  // sampling a polar cap, where every longitude texel converges into streaks.
  const latitude=26.206*Math.PI/180,longitude=3.635*Math.PI/180;
  const mappedRadial=new THREE.Vector3(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),-Math.cos(latitude)*Math.sin(longitude));
  const mappedEast=new THREE.Vector3(-Math.sin(longitude),0,-Math.cos(longitude)),mappedNorth=mappedRadial.clone().cross(mappedEast);
  const localRadial=new THREE.Vector3(LUNAR_RAIL.start.x,LUNAR_RAIL.start.y,0).normalize(),localEast=new THREE.Vector3(localRadial.y,-localRadial.x,0),localNorth=localRadial.clone().cross(localEast);
  moon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(localEast,localRadial,localNorth).multiply(new THREE.Matrix4().makeBasis(mappedEast,mappedRadial,mappedNorth).transpose()));
  root.dataset.moonTexture='loading';
  const texture=new THREE.TextureLoader().load('/textures/moon.webp',loaded=>{if(disposed)return;loaded.colorSpace=THREE.SRGBColorSpace;loaded.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());surface.map=loaded;surface.color.set('#a7a7a7');surface.needsUpdate=true;root.dataset.moonTexture='ready';draw.current();},undefined,()=>{if(!disposed)root.dataset.moonTexture='unavailable';});textures.push(texture);
  const normal=new THREE.Vector3(-LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x,0);
 const launcher=createLunarLauncher({metal,dark,copper,cargo}),rail=launcher.group,coils=launcher.coils,payload=launcher.payload;
  scene.add(rail,payload);
  const point=(distance:number)=>new THREE.Vector3(LUNAR_RAIL.start.x+LUNAR_RAIL.direction.x*distance,LUNAR_RAIL.start.y+LUNAR_RAIL.direction.y*distance,0);
  for(let i=0;i<=20;i++){
   const x=i/20*LUNAR_RAIL.length,top=point(x).addScaledVector(normal,-.54),foot=point(x).normalize().multiplyScalar(LUNAR_LAUNCH.radius+.015);
   for(const z of [-.57,.57]){const a=top.clone(),b=foot.clone();a.z=z;b.z=z;rod(scene,a,b,.028,dark);}
   const a=top.clone(),b=top.clone();a.z=-.6;b.z=.6;rod(scene,a,b,.025,dark);
   if(i<20){const next=point((i+1)/20*LUNAR_RAIL.length).addScaledVector(normal,-.54);for(const z of [-.57,.57]){const a=foot.clone(),b=next.clone();a.z=z;b.z=z;rod(scene,a,b,.017,dark);}}
  }
  // Loading bay, cranes, capacitor banks and a solar apron sit at the rail foot.
  const radial=new THREE.Vector3(LUNAR_RAIL.start.x,LUNAR_RAIL.start.y,0).normalize(),tangent=new THREE.Vector3(radial.y,-radial.x,0),base=new THREE.Group();scene.add(base);base.position.copy(radial.clone().multiplyScalar(LUNAR_LAUNCH.radius+.08));base.rotation.z=-Math.atan2(radial.x,radial.y);
  box(base,1.8,.1,1.4,-.6,0,0,dark);box(base,.8,.65,.9,-.85,.36,0,metal);box(base,.07,.68,.92,-.8,.36,0,copper);
  for(let i=0;i<5;i++){box(base,.18,.4,.45,-2.1+i*.24,.24,-.8,dark);box(base,.19,.04,.46,-2.1+i*.24,.46,-.8,copper);}
  for(let i=0;i<4;i++){const panel=box(base,.75,.03,.75,-2.2+i*.82,.16,1.15,dark);panel.rotation.x=.35;for(let j=-1;j<=1;j++)box(base,.012,.04,.75,-2.2+i*.82+j*.18,.19,1.15,copper);}
  rod(base,new THREE.Vector3(-.45,.03,.5),new THREE.Vector3(-.45,1.05,.5),.035);rod(base,new THREE.Vector3(-.45,1.05,.5),new THREE.Vector3(.2,1.05,.5),.025);rod(base,new THREE.Vector3(.18,.4,.5),new THREE.Vector3(.18,1.05,.5),.014,copper);
  // Native-resolution panchromatic LROC photography supplies the close ground
  // view. Map it once onto the curved surface; do not repeat it, stretch a polar
  // texel or infer terrain heights from brightness. The launcher is illustrative.
  const terrainG=new THREE.PlaneGeometry(40.96,40.96,128,128),positions=terrainG.attributes.position,uv=terrainG.attributes.uv;
  for(let i=0;i<positions.count;i++){
   const u=uv.getX(i),v=1-uv.getY(i),x=(u-.4)*40.96,z=-(v-.3)*40.96;
   const p=radial.clone().multiplyScalar(LUNAR_LAUNCH.radius).addScaledVector(tangent,x);p.z=z;p.normalize().multiplyScalar(LUNAR_LAUNCH.radius+.02);positions.setXYZ(i,p.x,p.y,p.z);
  }
  terrainG.computeVertexNormals();
  // Its recorded illumination is part of the photograph, so preserve it rather
  // than lighting every observed crater a second time with the scene's Sun.
  const terrainM=new THREE.MeshBasicMaterial({color:'#81858a',side:THREE.DoubleSide,transparent:true,depthWrite:false});materials.push(terrainM);
  const terrain=mesh(terrainG,terrainM,scene);terrain.renderOrder=1;root.dataset.moonGround='loading';
  const groundTexture=new THREE.TextureLoader().load('/textures/moon-launch-hadley.webp',loaded=>{
   if(disposed)return;loaded.colorSpace=THREE.SRGBColorSpace;loaded.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());terrainM.map=loaded;terrainM.color.set('#ffffff');terrainM.needsUpdate=true;root.dataset.moonGround='ready';draw.current();
  },undefined,()=>{if(!disposed){root.dataset.moonGround='unavailable';terrain.visible=false;draw.current();}});textures.push(groundTexture);
  const line=(points:{x:number;y:number}[],color:string,opacity:number)=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,0)));geometries.push(g);const m=new THREE.LineBasicMaterial({color,transparent:true,opacity});materials.push(m);const o=new THREE.Line(g,m);scene.add(o);return o;};
  const orbit=line(Array.from({length:241},(_,i)=>{const a=i/240*Math.PI*2,r=LUNAR_LAUNCH.radius+LUNAR_LAUNCH.hubAltitude;return {x:r*Math.sin(a),y:r*Math.cos(a)};}),'#648f9f',.22),approach=line(lunarLaunchPath('approach'),'#91b8cb',.22),release=line(lunarLaunchPath('release'),'#e1ae85',.35);
  const tether=new THREE.Group();scene.add(tether);
  const cable=rod(tether,new THREE.Vector3(0,-LUNAR_LAUNCH.arm,0),new THREE.Vector3(0,LUNAR_LAUNCH.arm,0),.015);
  const hub=new THREE.Group();tether.add(hub);box(hub,1.4,1.2,1.2,0,0,0,dark);box(hub,.3,1.5,1.3,0,0,0,copper);for(const x of [-2,2])box(hub,2.5,1.5,.08,x,0,0,dark);
  const grapple=new THREE.Group();tether.add(grapple);grapple.position.y=-LUNAR_LAUNCH.arm;
  box(grapple,.4,.1,.18,0,.34,0,dark);
  const jaws=[-1,1].map(side=>{const pivot=new THREE.Group();grapple.add(pivot);pivot.position.set(side*.17,.3,0);const points=[[0,0],[side*.02,-.22],[-side*.1,-.3]].map(([x,y])=>new THREE.Vector3(x,y,0));for(let i=1;i<points.length;i++)rod(pivot,points[i-1],points[i],.027,metal);return pivot;});
  const latch=box(grapple,.16,.025,.08,0,.045,0,copper);
  const starG=new THREE.BufferGeometry().setFromPoints(Array.from({length:150},(_,i)=>new THREE.Vector3((i*137.5)%9000-4000,(i*i*31.7)%8000,-100-(i%7)*20)));geometries.push(starG);const starM=new THREE.PointsMaterial({color:'#b9cdda',size:1.4,sizeAttenuation:false,transparent:true,opacity:.5});materials.push(starM);scene.add(new THREE.Points(starG,starM));
  draw.current=()=>{
   if(disposed||lost||!root.clientWidth)return;
   const {stage,progress}=frame.current,f=lunarLaunchFrame(stage,progress),width=f.camera.width;
   camera.left=-width/2;camera.right=width/2;camera.top=width*.31;camera.bottom=-width*.31;camera.updateProjectionMatrix();
   // Establish the horizon before zooming beyond the detailed local photograph.
   const ground=stage<2?1:stage===2?1-lunarEase(progress/.16):0,planetOpacity=stage===3?1-lunarEase(progress/.25):stage===4?lunarEase(progress/.32):1;
   surface.opacity=planetOpacity;surface.depthWrite=planetOpacity===1;moon.visible=planetOpacity>0;terrainM.opacity=ground*(1-lunarEase((width-55)/100));terrain.visible=!!terrainM.map&&terrainM.opacity>0&&stage<3;orbit.visible=stage>=4;approach.visible=stage===2;release.visible=stage===5;
   // A slightly elevated view exposes the launch rails and payload fitting. Fade
   // the distant ground before moving into the capture camera's local frame.
   const capture=stage===3?lunarEase(progress/.25):stage===4?1-lunarEase(progress/.3):0;
   const eye=radial.clone().multiplyScalar(Math.sin((ground*34+capture*22)*Math.PI/180));eye.z=Math.sqrt(1-eye.lengthSq());eye.multiplyScalar(7000);
   camera.position.set(f.camera.center.x+eye.x,f.camera.center.y+eye.y,eye.z);camera.lookAt(f.camera.center.x,f.camera.center.y,0);
   tether.position.set(f.hub.x,f.hub.y,0);tether.rotation.z=f.angle;
   const hardware=positionLunarCargo(launcher,f,stage,progress);grapple.scale.setScalar(hardware);hub.scale.setScalar(Math.max(1,width/500));cable.scale.set(Math.max(1,width/900/.015),1,Math.max(1,width/900/.015));
   const distance=f.railProgress**2*LUNAR_RAIL.length;
   coils.forEach(o=>{o.material=stage===1&&Math.abs(o.position.x-distance)<.4?lit:copper;});
   launcher.brakes.forEach(pack=>pack.children.forEach(o=>{(o as THREE.Mesh).material=stage===2&&f.sledSpeed>0&&Math.abs(pack.position.x-f.sledDistance)<.25?lit:copper;}));
   jaws[0].rotation.z=-f.jawAngle*Math.PI/180;jaws[1].rotation.z=f.jawAngle*Math.PI/180;latch.visible=f.latched;
   renderer.render(scene,camera);
  };
  const resize=()=>{renderer.setSize(root.clientWidth,root.clientWidth*.62,false);draw.current();};const observer=new ResizeObserver(resize);observer.observe(root);
  const loss=(event:Event)=>{event.preventDefault();lost=true;setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',loss);resize();setReady(true);
  return()=>{disposed=true;draw.current=()=>{};observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',loss);textures.forEach(o=>o.dispose());geometries.forEach(o=>o.dispose());materials.forEach(o=>o.dispose());launcher.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 return <div className="departure-visual" data-renderer={ready&&!failed?'webgl':'diagram'}><div ref={host} className="departure-webgl" aria-hidden="true" hidden={!ready||failed}/>{(!ready||failed)&&<LunarDepartureDiagram stage={stage} progress={progress}/>}</div>;
}
