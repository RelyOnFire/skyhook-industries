import { useEffect, useRef, type RefObject } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH, compile, forces, type Result } from '../simulation/engine.js';
import { sample, positions } from './view.js';
import { flightObjects, trackedObject, OBJECTS, type ObjectId } from './objects.js';
import { LAND } from './land.js';
export type View = 'earth' | 'plane' | 'follow' | 'structure';
type Props = {result:Result;clock:RefObject<number>;view:View;selectedObject:ObjectId;vectors?:boolean;onFailure:(message:string)=>void};
// Display-plane inclination only. The integrator remains planar/spherical Earth.

function earthTexture() {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const g=canvas.getContext('2d')!;
  const ocean=g.createLinearGradient(0,0,0,1024);ocean.addColorStop(0,'#224859');ocean.addColorStop(.2,'#12344d');ocean.addColorStop(.5,'#0e2941');ocean.addColorStop(.8,'#12394d');ocean.addColorStop(1,'#294e5b');
  g.fillStyle=ocean;g.fillRect(0,0,2048,1024);
  // Geographic silhouettes from the credited land dataset. Surface coloring is
  // illustrative, not a climate/terrain dataset or an Earth photograph.
  for(const poly of LAND) {
    g.save();g.beginPath();poly.forEach(([lon,lat],j)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;j?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();
    g.fillStyle='#59756f';g.fill();g.strokeStyle='#82a19b';g.lineWidth=.7;g.stroke();g.clip();
    const land=g.createLinearGradient(0,0,0,1024);land.addColorStop(0,'#d7e7e2');land.addColorStop(.2,'#749992');land.addColorStop(.4,'#788b73');land.addColorStop(.55,'#476f65');land.addColorStop(.8,'#72958f');land.addColorStop(1,'#cadcdb');
    g.fillStyle=land;g.fillRect(0,0,2048,1024);g.restore();
  }
  g.strokeStyle='rgba(155,205,226,.10)';g.lineWidth=1;
  for(let x=0;x<2048;x+=2048/24){g.beginPath();g.moveTo(x,0);g.lineTo(x,1024);g.stroke();}
  for(let y=0;y<1024;y+=1024/12){g.beginPath();g.moveTo(0,y);g.lineTo(2048,y);g.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export default function Scene({result,clock,view,selectedObject,vectors=false,onFailure}:Props) {
  const host=useRef<HTMLDivElement>(null),labelA=useRef<HTMLDivElement>(null),labelB=useRef<HTMLDivElement>(null),labelC=useRef<HTMLDivElement>(null);
  const selectionRef=useRef(selectedObject),viewRef=useRef(view),current=useRef(result),vectorRef=useRef(vectors),api=useRef<{reset:()=>void;zoom:(factor:number)=>void}|null>(null);
  selectionRef.current=selectedObject;viewRef.current=view;current.current=result;vectorRef.current=vectors;
  useEffect(()=>{
    // E0 is actually equatorial. The other modes retain their illustrative tilt.
    const point=(p:number[])=>{const angle=current.current.design.recovery==='electrodynamic'?0:28*Math.PI/180;
      return new T.Vector3(p[0]/EARTH,p[1]/EARTH*Math.sin(angle),p[1]/EARTH*Math.cos(angle)*(current.current.design.recovery==='electrodynamic'?-1:1));};
    const root=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{onFailure('WebGL 2 is unavailable. The orbital-plane view uses the same calculated flight.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x070d17,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','3D Earth and tether flight. Drag to rotate; keyboard-accessible zoom, reset and alternative views are provided.');root.appendChild(renderer.domElement);
    const colors=OBJECTS.map(o=>new T.Color(o.color).getHex());
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.003,250);let dirty=true;
    const markDirty=()=>{dirty=true;};const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxDistance=100;controls.addEventListener('change',markDirty);
    const focalPoint=()=>{const r=current.current,f=sample(r,clock.current??0),object=trackedObject(r,f,selectionRef.current);return object.state?point(object.state):null;};
    const reset=()=>{
      const r=current.current;
      const focus=viewRef.current==='follow'?focalPoint():null;
      if(focus){
        const f=sample(r,clock.current??0),object=trackedObject(r,f,selectionRef.current),tip=positions(r,f).z;
        const separation=object.state?Math.hypot(object.state[0]-tip[0],object.state[1]-tip[1]):0;
        const distance=object.phase==='approach'||object.phase==='attached'?Math.max(120000,separation*8)/EARTH:.7;
        controls.target.copy(focus);camera.position.copy(focus).addScaledVector(new T.Vector3(.35,.25,.55).normalize(),distance);controls.minDistance=.002;camera.near=.00001;
      }
      else {const radius=1+r.design.altitudeKm*1000/EARTH;controls.target.set(0,0,0);camera.position.set(.9,1.8,3.5).multiplyScalar(radius/1.25);controls.minDistance=1.06;camera.near=.003;}
      camera.updateProjectionMatrix();controls.update();dirty=true;
    };
    api.current={reset,zoom:factor=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();dirty=true;}};reset();
    const earth=new T.Mesh(new T.SphereGeometry(1,96,64),new T.MeshPhongMaterial({map:earthTexture(),specular:0x244c66,shininess:14}));scene.add(earth);
    const sun=new T.DirectionalLight(0xe8f2ff,2.1);sun.position.set(-3,4,5);scene.add(sun,new T.AmbientLight(0x8299c2,.62));
    const atmosphere=new T.Mesh(new T.SphereGeometry(1.018,64,48),new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),4.);gl_FragColor=vec4(.22,.55,.94,rim*.7);}'}));scene.add(atmosphere);
    let seed=742;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const stars=[];
    for(let k=0;k<500;k++){const z=rng()*2-1,a=rng()*Math.PI*2,r=28;stars.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}
    const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));scene.add(new T.Points(starGeo,new T.PointsMaterial({color:0xb4c9df,size:.018,transparent:true,opacity:.4,sizeAttenuation:true})));
    const line=(color:number,opacity=1)=>{const l=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));scene.add(l);return l;};
    const reference=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0x7194ae,transparent:true,opacity:.5,dashSize:.024,gapSize:.018}));scene.add(reference);
    const trail=line(0x76e9e8,.8),incomingTrail=line(0xffbd83,.6),outgoing=[line(colors[1]),line(colors[2])];
    const tether=new T.Mesh(new T.CylinderGeometry(.0016,.0016,1,8),new T.MeshBasicMaterial({color:0xbff5f3}));scene.add(tether);
    const marker=(color:number,radius:number,diamond=false)=>{const m=new T.Mesh(diamond?new T.OctahedronGeometry(radius*1.25):new T.SphereGeometry(radius,14,10),new T.MeshBasicMaterial({color}));m.userData.radius=radius*(diamond?1.25:1);scene.add(m);return m;};
    const conductorMeshes=[0,1].map(()=>{const m=new T.Mesh(new T.CylinderGeometry(.0016,.0016,1,8),new T.MeshBasicMaterial({color:0x7cebc0,transparent:true,opacity:.5}));scene.add(m);return m;});
    const ends=[marker(0xbff5f3,.004),marker(0xbff5f3,.004)],hub=marker(0xffffff,.008),cargo=[marker(colors[1],.009),marker(colors[2],.009,true)];
    const plume=new T.Mesh(new T.ConeGeometry(.009,.06,12),new T.MeshBasicMaterial({color:0x80c5ff,transparent:true,opacity:.8}));scene.add(plume);
    const velocity=[new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),.1,0x7de7ee,.02,.008),new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),.1,0xffbd83,.02,.008)];velocity.forEach(a=>scene.add(a));
    const setPoints=(l:T.Line,pts:T.Vector3[])=>{l.geometry.dispose();l.geometry=new T.BufferGeometry().setFromPoints(pts);if(l===reference)l.computeLineDistances();};
    const observer=new ResizeObserver(()=>{const box=root.getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();dirty=true;});observer.observe(root);
    const lost=(e:Event)=>{e.preventDefault();onFailure('The graphics context was lost. Your calculation is intact; the 2D view remains available.');};renderer.domElement.addEventListener('webglcontextlost',lost);
    const occupied:{x:number;y:number;w:number;h:number}[]=[];
    function label(el:HTMLDivElement|null,world:T.Vector3,text:string,offset:number) {
      if(!el)return;
      const v=world.clone().project(camera),ray=world.clone().sub(camera.position),distance=ray.length();ray.normalize();
      const b=camera.position.dot(ray),q=b*b-camera.position.lengthSq()+1,hit=q>0?-b-Math.sqrt(q):Infinity;
      el.hidden=true;
      if(v.z>1||v.z<-1||(hit>0&&hit<distance-.01)||Math.abs(v.x)>.95||Math.abs(v.y)>.88)return;
      const rect=root.getBoundingClientRect();el.textContent=text;el.hidden=false;
      const width=el.offsetWidth,height=el.offsetHeight;
      const x=Math.max(10,Math.min(rect.width-width-10,(v.x+1)*rect.width/2+12));
      const base=(-v.y+1)*rect.height/2+offset;
      for(const shift of [0,26,-26,52,-52,78]) {
        const y=base+shift;
        if(y<55||y+height>rect.height-70)continue;
        if(occupied.some(r=>x<r.x+r.w+4&&x+width+4>r.x&&y<r.y+r.h+4&&y+height+4>r.y))continue;
        el.style.left=`${x}px`;el.style.top=`${y}px`;occupied.push({x,y,w:width,h:height});return;
      }
      el.hidden=true; // The always-visible object list retains the full identity.
    }
    let frame=0,lastTime=-1,lastView='',lastResult:Result|null=null,lastVectors=false,lastSelected:ObjectId|null=null,lastFollowAvailable=false;
    const draw=()=>{
      frame=requestAnimationFrame(draw);if(document.hidden||!root.clientWidth||!root.clientHeight)return;
      const r=current.current,t=clock.current??0,v=viewRef.current,show=vectorRef.current,selected=selectionRef.current;
      if(!dirty&&lastResult===r&&lastTime===t&&lastView===v&&lastVectors===show&&lastSelected===selected)return;
      if(lastResult!==r){const radius=EARTH+r.design.altitudeKm*1000;setPoints(reference,Array.from({length:241},(_,j)=>point([Math.cos(j*Math.PI/120)*radius,Math.sin(j*Math.PI/120)*radius])));lastResult=r;lastTime=-1;reset();}
      if(lastView!==v||(lastSelected!==selected&&v==='follow')){reset();lastView=v;}
      const f=sample(r,t),p=positions(r,f),objects=flightObjects(r,f),active=trackedObject(r,f,selected),a=point(p.a),z=point(p.z),h=point(p.hub);
      root.dataset.followTarget=v==='follow'&&active.state?selected:'none';
      if(v==='follow'&&active.state&&!lastFollowAvailable)reset();
      if(v==='follow'&&t!==lastTime){const focus=focalPoint();if(focus){const shift=focus.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(focus);}}
      if(t!==lastTime){
        earth.rotation.y=t*7.292115e-5+.8;
        tether.position.copy(a).add(z).multiplyScalar(.5);tether.scale.y=a.distanceTo(z);tether.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),z.clone().sub(a).normalize());ends[0].position.copy(a);ends[1].position.copy(z);hub.position.copy(h);
        cargo.forEach((m,j)=>{const object=objects[j+1];m.visible=!!object.state;if(object.state)m.position.copy(point(object.state));});
        conductorMeshes.forEach((m,j)=>{
          m.visible=r.design.recovery==='electrodynamic';if(!m.visible)return;
          const fraction=r.design.edLengthKm/r.design.spanKm;
          const start=j===0?a:z.clone().lerp(a,fraction),end=j===0?a.clone().lerp(z,fraction):z;
          m.position.copy(start).add(end).multiplyScalar(.5);m.scale.y=start.distanceTo(end);
          m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());
          (m.material as T.MeshBasicMaterial).opacity=f.burn&&Math.abs(f.electrical?.circuits[j].current??0)>.01?1:.4;
        });
        plume.visible=f.burn&&r.design.recovery==='chemical';if(plume.visible){const force=forces(f.state,compile(r.design,f.fuel,f.loaded,r.cells),r.design,true),behind=point([-force.tx,-force.ty]).normalize();plume.position.copy(h).addScaledVector(behind,.03);plume.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),behind);}
        setPoints(trail,[...r.frames.filter(q=>q.t<=t&&q.t>=t-3200).map(q=>point(q.state)),point(f.state)]);
        (incomingTrail.material as T.LineBasicMaterial).color.set(colors[f.incomingId??1]);
        setPoints(incomingTrail,f.incoming?[...r.frames.filter(q=>q.t<=t&&q.incoming&&q.incomingId===f.incomingId).map(q=>point(q.incoming!)),point(f.incoming)]:[]);
        outgoing.forEach((l,j)=>setPoints(l,[...r.frames.filter(q=>q.t<=t&&q.payloads[j]).map(q=>point(q.payloads[j])),...(f.payloads[j]?[point(f.payloads[j])]:[])]));
      }
      // Both vectors use one display scale; fixed world-size heads would look
      // like additional spacecraft when the camera moves close to the tip.
      const vectorPixel=2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(controls.target)/Math.max(1,root.clientHeight);
      [p.hub,selected==='facility'?null:active.state].forEach((state,j)=>{
        const arrow=velocity[j];arrow.visible=show&&!!state;if(!state)return;
        const direction=point([state[2],state[3]]);arrow.position.copy(point(state));
        arrow.setColor(new T.Color(j?active.color:OBJECTS[0].color));
        arrow.setDirection(direction.clone().normalize());arrow.setLength(Math.max(1e-6,Math.hypot(state[2],state[3])/1000*vectorPixel*12),vectorPixel*7,vectorPixel*3);
      });
      controls.update();
      root.dataset.followErrorKm=v==='follow'&&active.state?String(controls.target.distanceTo(point(active.state))*EARTH/1000):'';
      // Keep symbolic markers legible without turning them into 50 km objects
      // in a close-up. Scale is display-only and never enters the integrator.
      const perPixel=(position:T.Vector3)=>2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(position)/Math.max(1,root.clientHeight);
      [...ends,hub,...cargo].forEach((m,i)=>m.scale.setScalar(perPixel(m.position)*(i<2?2:4)/m.userData.radius));
      tether.scale.x=tether.scale.z=perPixel(tether.position)*.85/.0016;
      conductorMeshes.forEach(m=>{m.scale.x=m.scale.z=perPixel(m.position)*1.8/.0016;});
      renderer.render(scene,camera);occupied.length=0;
      const closeup=v==='follow'&&(active.phase==='approach'||active.phase==='attached');
      label(labelA.current,closeup?z:h,closeup?'WORKING TIP':'FACILITY',-28);
      for(const j of [1,2].sort((a,b)=>Number(objects[b].id===selected)-Number(objects[a].id===selected))) {
        const object=objects[j],el=j===1?labelB.current:labelC.current;
        if(object.state)label(el,point(object.state),`PAYLOAD ${j} / ${object.phase.toUpperCase()}`,object.phase==='attached'?20:-25);
        else if(el)el.hidden=true;
      }
      dirty=false;lastTime=t;lastVectors=show;lastSelected=selected;lastFollowAvailable=v==='follow'&&!!active.state;
    };draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',markDirty);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{const mesh=o as T.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(material as T.MeshPhongMaterial).map?.dispose();material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="scene-three" ref={host} data-recovery={result.design.recovery}><div ref={labelA} className="world-label" aria-hidden="true"/><div ref={labelB} className="world-label cargo-label" style={{color:OBJECTS[1].color,borderColor:OBJECTS[1].color}} aria-hidden="true"/><div ref={labelC} className="world-label cargo-label" style={{color:OBJECTS[2].color,borderColor:OBJECTS[2].color}} aria-hidden="true"/>
    <div className="camera-actions"><button onClick={()=>api.current?.zoom(.8)} aria-label="Zoom camera in">+</button><button onClick={()=>api.current?.zoom(1.25)} aria-label="Zoom camera out">−</button><button onClick={()=>api.current?.reset()}>Reset camera</button></div>
  </div>;
}
export function Plane({result,clock,selectedObject,vectors=false,follow=false}:Omit<Props,'view'|'onFailure'>&{follow?:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null),rref=useRef(result),zoom=useRef(1),vref=useRef(vectors),selectionRef=useRef(selectedObject),followRef=useRef(follow);rref.current=result;vref.current=vectors;selectionRef.current=selectedObject;followRef.current=follow;
  useEffect(()=>{
    const c=canvas.current!,g=c.getContext('2d')!,parent=c.parentElement!;let request=0,resized=true;
    const resize=()=>{const w=Math.round(parent.clientWidth*Math.min(devicePixelRatio,2)),h=Math.round(parent.clientHeight*Math.min(devicePixelRatio,2));if(c.width!==w){c.width=w;resized=true;}if(c.height!==h){c.height=h;resized=true;}};const observer=new ResizeObserver(resize);observer.observe(parent);resize();
    let previous=-1,previousR:Result|null=null,previousW=0,previousH=0,previousZoom=0,previousVectors=false,previousSelected:ObjectId|null=null,previousFollow=false;
    let focusOrigin:number[]|null=null,focusSpan=120000;
    let focusIdentity:ObjectId|null=null;
    const draw=()=>{
      request=requestAnimationFrame(draw);if(document.hidden||!c.width||!c.height)return;const r=rref.current,t=clock.current??0,show=vref.current,selected=selectionRef.current,following=followRef.current;
      if(!resized&&t===previous&&r===previousR&&previousW===c.width&&previousH===c.height&&previousZoom===zoom.current&&previousVectors===show&&previousSelected===selected&&previousFollow===following)return;
      resized=false;previous=t;previousR=r;previousW=c.width;previousH=c.height;previousZoom=zoom.current;previousVectors=show;previousSelected=selected;previousFollow=following;
      const f=sample(r,t),p=positions(r,f),objects=flightObjects(r,f),active=trackedObject(r,f,selected);
      if(!following){focusOrigin=null;focusIdentity=null;}
      else if(active.state){
        focusOrigin=active.state;
        if(focusIdentity!==selected){
          const separation=Math.hypot(active.state[0]-p.z[0],active.state[1]-p.z[1]);
          focusSpan=active.phase==='approach'||active.phase==='attached'?Math.max(120000,separation*8):EARTH*.7;focusIdentity=selected;
        }
      } else if(focusIdentity!==selected){focusOrigin=null;focusIdentity=selected;}
      parent.dataset.followTarget=following&&active.state?selected:'none';
      const dpr=Math.min(devicePixelRatio,2),w=c.width,h=c.height;
      const extent=following&&focusOrigin?focusSpan:2.7*(EARTH+r.design.altitudeKm*1000+r.design.spanKm*500);
      const s=Math.min(w,h)/extent*zoom.current,x=w/2-(focusOrigin?.[0]??0)*s,y=h/2+(focusOrigin?.[1]??0)*s;
      const xy=(p:number[])=>[x+p[0]*s,y-p[1]*s];g.clearRect(0,0,w,h);
      const glow=g.createRadialGradient(x-EARTH*s*.35,y-EARTH*s*.4,0,x,y,EARTH*s);glow.addColorStop(0,'#285168');glow.addColorStop(.65,'#122f47');glow.addColorStop(1,'#081925');g.fillStyle=glow;g.beginPath();g.arc(x,y,EARTH*s,0,Math.PI*2);g.fill();g.strokeStyle='#6ca7c5';g.lineWidth=1.2*dpr;g.stroke();
      g.strokeStyle='#355369';g.lineWidth=.5*dpr;for(let j=1;j<=3;j++){g.beginPath();g.ellipse(x,y,EARTH*s*j/4,EARTH*s,0,0,Math.PI*2);g.stroke();}
      g.strokeStyle='#69849d';g.setLineDash([4*dpr,6*dpr]);g.beginPath();g.arc(x,y,(EARTH+r.design.altitudeKm*1000)*s,0,Math.PI*2);g.stroke();g.setLineDash([]);
      const path=(pts:number[][],color:string)=>{g.strokeStyle=color;g.lineWidth=1.5*dpr;g.beginPath();pts.forEach((p,i)=>{const [a,b]=xy(p);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();};
      path(r.frames.filter(f=>f.t<=t&&f.t>t-3200).map(f=>f.state),'#7de7ee');
      for(let j=0;j<2;j++)path(r.frames.filter(f=>f.t<=t&&f.payloads[j]).map(f=>f.payloads[j]),OBJECTS[j+1].color);
      if(f.incoming)path(r.frames.filter(q=>q.t<=t&&q.incoming&&q.incomingId===f.incomingId).map(q=>q.incoming!),OBJECTS[f.incomingId??1].color+'90');
      path([p.a,p.z],'#ccffff');
      if(r.design.recovery==='electrodynamic') {
        const lerp=(a:number[],b:number[],u:number)=>a.map((v,i)=>v+(b[i]-v)*u),q=r.design.edLengthKm/r.design.spanKm;
        for(const [a,b] of [[p.a,lerp(p.a,p.z,q)],[lerp(p.z,p.a,q),p.z]])path([a,b],f.burn?'#7cebc0':'#497b6c');
      }
      const dot=(v:number[],color:string,radius=4,diamond=false,highlight=false)=>{
        const [a,b]=xy(v),size=radius*dpr;g.beginPath();
        if(diamond){g.moveTo(a,b-size);g.lineTo(a+size,b);g.lineTo(a,b+size);g.lineTo(a-size,b);g.closePath();}
        else g.arc(a,b,size,0,Math.PI*2);
        g.fillStyle=color;g.fill();
        if(highlight){g.strokeStyle=color;g.lineWidth=dpr;g.beginPath();g.arc(a,b,size+3*dpr,0,Math.PI*2);g.stroke();}
      };
      dot(p.hub,OBJECTS[0].color,4,false,selected==='facility');dot(p.a,'#7de7ee',2);dot(p.z,'#7de7ee',2);
      objects.slice(1).forEach(o=>{if(o.state)dot(o.state,o.color,5,o.glyph==='diamond',o.id===selected);});
      const occupied:{x:number;y:number;w:number;h:number}[]=[];
      const label=(v:number[],text:string,color:string,offset=0)=>{
        const [a,b]=xy(v);if(a<5||a>w-10||b<65*dpr||b>h-70*dpr)return;
        g.font=`${10*dpr}px monospace`;g.textAlign='left';const width=g.measureText(text).width+8*dpr,height=20*dpr;
        const tx=Math.max(8*dpr,Math.min(w-width-8*dpr,a+10*dpr));
        for(const shift of [0,26,-26,52,-52,78]) {
          const ty=b+(offset+shift-18)*dpr;
          if(ty<55*dpr||ty+height>h-70*dpr)continue;
          if(occupied.some(r=>tx<r.x+r.w+4*dpr&&tx+width+4*dpr>r.x&&ty<r.y+r.h+4*dpr&&ty+height+4*dpr>r.y))continue;
          g.fillStyle='#071321ee';g.fillRect(tx-4*dpr,ty,width,height);g.fillStyle=color;g.fillText(text,tx,ty+14*dpr);
          occupied.push({x:tx,y:ty,w:width,h:height});return;
        }
      };
      const closeup=following&&(active.phase==='approach'||active.phase==='attached');
      label(closeup?p.z:p.hub,closeup?'WORKING TIP':'FACILITY',OBJECTS[0].color);
      for(const object of objects.slice(1).sort((a,b)=>Number(b.id===selected)-Number(a.id===selected))) {
        if(object.state)label(object.state,`${object.name.toUpperCase()} / ${object.phase.toUpperCase()}`,object.color,object.phase==='attached'?24:0);
      }
      if(show){for(const [v,color] of [[p.hub,OBJECTS[0].color],[selected==='facility'?null:active.state,active.color]] as [number[]|null,string][]){
        if(!v)continue;const [a,b]=xy(v),vx=v[2]/1000*10*dpr,vy=-v[3]/1000*10*dpr,angle=Math.atan2(vy,vx);g.strokeStyle=color;g.lineWidth=1.5*dpr;g.beginPath();g.moveTo(a,b);g.lineTo(a+vx,b+vy);g.moveTo(a+vx-7*dpr*Math.cos(angle-.4),b+vy-7*dpr*Math.sin(angle-.4));g.lineTo(a+vx,b+vy);g.lineTo(a+vx-7*dpr*Math.cos(angle+.4),b+vy-7*dpr*Math.sin(angle+.4));g.stroke();
      }}
      g.fillStyle='#7fa1ba';g.font=`${11*dpr}px monospace`;g.textAlign='center';g.fillText('EARTH',x,y+4*dpr);
    };draw();return()=>{cancelAnimationFrame(request);observer.disconnect();};
  },[]);
  return <div className="scene-plane" data-recovery={result.design.recovery}><canvas ref={canvas} aria-label="Orbital-plane view of the calculated trajectory"/><div className="plane-zoom"><button onClick={()=>zoom.current=Math.min(4,zoom.current*1.25)} aria-label="Zoom in">+</button><button onClick={()=>zoom.current=Math.max(.3,zoom.current/1.25)} aria-label="Zoom out">−</button><button onClick={()=>zoom.current=1}>Fit</button></div></div>;
}
