import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {LUNAR_LAUNCH,LUNAR_RAIL,lunarEase,lunarLaunchFrame,lunarLaunchPath} from './lunar-launch-motion.js';
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
  const metal=new THREE.MeshStandardMaterial({color:'#b8c8d0',metalness:.6,roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#253642',metalness:.5,roughness:.5}),copper=new THREE.MeshStandardMaterial({color:'#d29b74',metalness:.45,roughness:.4}),lit=new THREE.MeshStandardMaterial({color:'#ffe0a9',emissive:'#eeb574',emissiveIntensity:1.5,roughness:.5});materials.push(metal,dark,copper,lit);
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{geometries.push(g);const o=new THREE.Mesh(g,m);parent.add(o);return o;};
  const box=(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m=metal)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),m,p);o.position.set(x,y,z);return o;};
  const rod=(p:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m=metal)=>{const delta=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),m,p);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const surface=new THREE.MeshStandardMaterial({color:'#777b7f',roughness:1,transparent:true});materials.push(surface);
  const moon=mesh(new THREE.SphereGeometry(LUNAR_LAUNCH.radius,192,96),surface,scene);moon.rotation.y=-Math.PI/2;moon.rotation.z=.2;
  root.dataset.moonTexture='loading';
  const texture=new THREE.TextureLoader().load('/textures/moon.webp',loaded=>{if(disposed)return;loaded.colorSpace=THREE.SRGBColorSpace;loaded.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());surface.map=loaded;surface.color.set('#a7a7a7');surface.needsUpdate=true;root.dataset.moonTexture='ready';draw.current();},undefined,()=>{if(!disposed)root.dataset.moonTexture='unavailable';});textures.push(texture);
  // The rail has a raised straight launch ramp, with supports meeting the sphere.
  const rail=new THREE.Group();scene.add(rail);const normal=new THREE.Vector3(-LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x,0);rail.position.set(LUNAR_RAIL.start.x-normal.x*.6,LUNAR_RAIL.start.y-normal.y*.6,0);rail.rotation.z=Math.atan2(LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x);
  box(rail,LUNAR_RAIL.length+1.4,.08,.4,(LUNAR_RAIL.length+1)/2,-.09,0,dark);
  for(const z of [-.17,.17])box(rail,LUNAR_RAIL.length+1.4,.04,.045,(LUNAR_RAIL.length+1)/2,0,z,metal);
  const coils:THREE.Mesh[]=[];
  for(let i=0;i<=40;i++){
   const x=i/40*LUNAR_RAIL.length,coil=mesh(new THREE.TorusGeometry(.26,.035,8,20,Math.PI*1.55),copper,rail);coil.rotation.y=Math.PI/2;coil.position.set(x,.35,0);coils.push(coil);
   const pos=new THREE.Vector3(LUNAR_RAIL.start.x+LUNAR_RAIL.direction.x*x,LUNAR_RAIL.start.y+LUNAR_RAIL.direction.y*x,0),foot=pos.clone().normalize().multiplyScalar(LUNAR_LAUNCH.radius+.015);
   for(const z of [-.26,.26]){const top=pos.clone();top.z=z;const bottom=foot.clone();bottom.z=z;rod(scene,top,bottom,.035,dark);}
  }
  for(let i=0;i<20;i++){
   const x=i/20*LUNAR_RAIL.length,next=(i+1)/20*LUNAR_RAIL.length;
   const point=(distance:number)=>new THREE.Vector3(LUNAR_RAIL.start.x+LUNAR_RAIL.direction.x*distance,LUNAR_RAIL.start.y+LUNAR_RAIL.direction.y*distance,0);
   const bottom=point(x).normalize().multiplyScalar(LUNAR_LAUNCH.radius+.03),top=point(next);
   for(const z of [-.26,.26]){const a=bottom.clone(),b=top.clone();a.z=z;b.z=z;rod(scene,a,b,.018,dark);}
  }
  // Loading bay, cranes, capacitor banks and a solar apron sit at the rail foot.
  const radial=new THREE.Vector3(LUNAR_RAIL.start.x,LUNAR_RAIL.start.y,0).normalize(),tangent=new THREE.Vector3(radial.y,-radial.x,0),base=new THREE.Group();scene.add(base);base.position.copy(radial.clone().multiplyScalar(LUNAR_LAUNCH.radius+.08));base.rotation.z=-Math.atan2(radial.x,radial.y);
  box(base,1.8,.1,1.4,-.6,0,0,dark);box(base,.8,.65,.9,-.85,.36,0,metal);box(base,.07,.68,.92,-.8,.36,0,copper);
  for(let i=0;i<5;i++){box(base,.18,.4,.45,-2.1+i*.24,.24,-.8,dark);box(base,.19,.04,.46,-2.1+i*.24,.46,-.8,copper);}
  for(let i=0;i<4;i++){const panel=box(base,.75,.03,.75,-2.2+i*.82,.16,1.15,dark);panel.rotation.x=.35;for(let j=-1;j<=1;j++)box(base,.012,.04,.75,-2.2+i*.82+j*.18,.19,1.15,copper);}
  rod(base,new THREE.Vector3(-.45,.03,.5),new THREE.Vector3(-.45,1.05,.5),.035);rod(base,new THREE.Vector3(-.45,1.05,.5),new THREE.Vector3(.2,1.05,.5),.025);rod(base,new THREE.Vector3(.18,.4,.5),new THREE.Vector3(.18,1.05,.5),.014,copper);
  // Original, display-only regolith relief surrounds an intentionally level
  // loading apron. It avoids enlarging the low-detail global map into a ground
  // close-up; these craters do not imply a surveyed lunar launch location.
  const craters=Array.from({length:32},(_,i)=>({x:(i*7.137)%28-14,z:(i*5.319)%24-12,r:.3+(i%6)*.19})).filter(c=>Math.abs(c.z)>1.3);
  const terrainG=new THREE.PlaneGeometry(64,60,320,300),positions=terrainG.attributes.position,colors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getY(i);let height=0;
   for(const c of craters){const distance=Math.hypot(x-c.x,z-c.z)/c.r;if(distance<1.4)height+=c.r*(.025*Math.exp(-(distance**4)*2.8)+.13*Math.exp(-(((distance-1)/.22)**2)));}
   const seed=Math.sin(x*12.9898+z*78.233)*43758.5453,noise=(seed-Math.floor(seed))-.5,shade=.19+noise*.018+Math.min(.03,height*.06);
   const p=radial.clone().multiplyScalar(LUNAR_LAUNCH.radius+height+.003).addScaledVector(tangent,x);p.z=z;p.normalize().multiplyScalar(LUNAR_LAUNCH.radius+height+.003);
   positions.setXYZ(i,p.x,p.y,p.z);colors[i*3]=shade;colors[i*3+1]=shade*1.01;colors[i*3+2]=shade*1.04;
  }
  terrainG.setAttribute('color',new THREE.BufferAttribute(colors,3));terrainG.computeVertexNormals();
  const terrainM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});materials.push(terrainM);const terrain=mesh(terrainG,terrainM,scene);
  const rockMaterial=new THREE.MeshStandardMaterial({color:'#65686a',roughness:1});materials.push(rockMaterial);
  for(let i=0;i<90;i++){
   const x=(i*1.618)%16-8,z=(i*3.137)%9-4.5;if(Math.abs(z)<.7&&x>-1)continue;
   const p=radial.clone().multiplyScalar(LUNAR_LAUNCH.radius).addScaledVector(tangent,x);p.z=z;p.normalize().multiplyScalar(LUNAR_LAUNCH.radius);
   const rock=mesh(new THREE.DodecahedronGeometry(.025+(i%7)*.012),rockMaterial,scene);rock.position.copy(p);rock.scale.set(1,.55,1);rock.rotation.set(i*.23,i*.49,i*.31);
  }
  const line=(points:{x:number;y:number}[],color:string,opacity:number)=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,0)));geometries.push(g);const m=new THREE.LineBasicMaterial({color,transparent:true,opacity});materials.push(m);const o=new THREE.Line(g,m);scene.add(o);return o;};
  const orbit=line(Array.from({length:241},(_,i)=>{const a=i/240*Math.PI*2,r=LUNAR_LAUNCH.radius+LUNAR_LAUNCH.hubAltitude;return {x:r*Math.sin(a),y:r*Math.cos(a)};}),'#648f9f',.22),approach=line(lunarLaunchPath('approach'),'#91b8cb',.22),release=line(lunarLaunchPath('release'),'#e1ae85',.35);
  const tether=new THREE.Group();scene.add(tether);
  const cable=rod(tether,new THREE.Vector3(0,-LUNAR_LAUNCH.arm,0),new THREE.Vector3(0,LUNAR_LAUNCH.arm,0),.015);
  const hub=new THREE.Group();tether.add(hub);box(hub,1.4,1.2,1.2,0,0,0,dark);box(hub,.3,1.5,1.3,0,0,0,copper);for(const x of [-2,2])box(hub,2.5,1.5,.08,x,0,0,dark);
  const grapple=new THREE.Group();tether.add(grapple);grapple.position.y=-LUNAR_LAUNCH.arm;
  box(grapple,.4,.1,.18,0,.34,0,dark);
  const jaws=[-1,1].map(side=>{const pivot=new THREE.Group();grapple.add(pivot);pivot.position.set(side*.17,.3,0);const points=[[0,0],[side*.02,-.22],[-side*.1,-.3]].map(([x,y])=>new THREE.Vector3(x,y,0));for(let i=1;i<points.length;i++)rod(pivot,points[i-1],points[i],.027,metal);return pivot;});
  const latch=box(grapple,.16,.025,.08,0,.045,0,copper);
  const payload=new THREE.Group();scene.add(payload);box(payload,.28,.4,.24,0,-.27,0,dark);box(payload,.29,.07,.25,0,-.28,0,copper);for(const x of [-.12,.12])box(payload,.015,.4,.25,x,-.27,0,metal);rod(payload,new THREE.Vector3(0,-.07,0),new THREE.Vector3(0,0,0),.022);
  mesh(new THREE.TorusGeometry(.055,.018,8,20),copper,payload);
  const sled=new THREE.Group();rail.add(sled);box(sled,.5,.1,.32,0,.09,0,dark);for(const z of [-.17,.17])box(sled,.42,.065,.06,0,.09,z,copper);
  const starG=new THREE.BufferGeometry().setFromPoints(Array.from({length:150},(_,i)=>new THREE.Vector3((i*137.5)%9000-4000,(i*i*31.7)%8000,-100-(i%7)*20)));geometries.push(starG);const starM=new THREE.PointsMaterial({color:'#b9cdda',size:1.4,sizeAttenuation:false,transparent:true,opacity:.5});materials.push(starM);scene.add(new THREE.Points(starG,starM));
  draw.current=()=>{
   if(disposed||lost||!root.clientWidth)return;
   const {stage,progress}=frame.current,f=lunarLaunchFrame(stage,progress),width=f.camera.width;
   camera.left=-width/2;camera.right=width/2;camera.top=width*.31;camera.bottom=-width*.31;camera.updateProjectionMatrix();
   const ground=stage<2?1:stage===2?1-lunarEase(progress/.45):0,planetOpacity=stage===3?1-lunarEase(progress/.25):stage===4?lunarEase(progress/.32):1;
   surface.opacity=planetOpacity;surface.depthWrite=planetOpacity===1;moon.visible=planetOpacity>0;terrain.visible=stage<3;orbit.visible=stage>=4;approach.visible=stage===2;release.visible=stage===5;
   // A slightly elevated view exposes the launch rails and payload fitting. Fade
   // the distant ground before moving into the capture camera's local frame.
   const capture=stage===3?lunarEase(progress/.25):stage===4?1-lunarEase(progress/.3):0;
   const eye=radial.clone().multiplyScalar(Math.sin((ground*18+capture*22)*Math.PI/180));eye.z=Math.sqrt(1-eye.lengthSq());eye.multiplyScalar(7000);
   camera.position.set(f.camera.center.x+eye.x,f.camera.center.y+eye.y,eye.z);camera.lookAt(f.camera.center.x,f.camera.center.y,0);
   tether.position.set(f.hub.x,f.hub.y,0);tether.rotation.z=f.angle;
   const hardware=Math.max(1,width/500*13);grapple.scale.setScalar(hardware);payload.scale.setScalar(hardware);hub.scale.setScalar(Math.max(1,width/500));cable.scale.set(Math.max(1,width/900/.015),1,Math.max(1,width/900/.015));
   payload.position.set(f.payload.x,f.payload.y,0);if(stage===0)payload.position.addScaledVector(normal,.35*(1-lunarEase(progress)));payload.rotation.z=f.payloadAngle;
   // The fitting follows the solved cargo path. A cradle beneath it rides the
   // rail, then brakes on the track; it never follows the cargo into free flight.
   const travel=f.railProgress**2,sledDistance=stage<2?travel*LUNAR_RAIL.length:LUNAR_RAIL.length+.65*lunarEase(progress/.12);sled.position.x=sledDistance;
   sled.visible=stage<3;coils.forEach((o,i)=>{o.material=stage===1&&Math.abs(i/40-travel)<.075?lit:copper;});
   jaws[0].rotation.z=-f.jawAngle*Math.PI/180;jaws[1].rotation.z=f.jawAngle*Math.PI/180;latch.visible=f.latched;
   renderer.render(scene,camera);
  };
  const resize=()=>{renderer.setSize(root.clientWidth,root.clientWidth*.62,false);draw.current();};const observer=new ResizeObserver(resize);observer.observe(root);
  const loss=(event:Event)=>{event.preventDefault();lost=true;setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',loss);resize();setReady(true);
  return()=>{disposed=true;draw.current=()=>{};observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',loss);textures.forEach(o=>o.dispose());geometries.forEach(o=>o.dispose());materials.forEach(o=>o.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 return <div className="departure-visual" data-renderer={ready&&!failed?'webgl':'diagram'}><div ref={host} className="departure-webgl" aria-hidden="true" hidden={!ready||failed}/>{(!ready||failed)&&<LunarDepartureDiagram stage={stage} progress={progress}/>}</div>;
}
