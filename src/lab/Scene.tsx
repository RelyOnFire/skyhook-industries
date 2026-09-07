import { useEffect, useRef, type RefObject } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH, compile, forces, type Result } from '../simulation/engine.js';
import { sample, positions, payloadState } from './view.js';
import { LAND } from './land.js';
export type View = 'earth' | 'plane' | 'follow' | 'structure';
type Props = {result:Result;clock:RefObject<number>;view:View;vectors?:boolean;onFailure:(message:string)=>void};
// Display-plane inclination only. The integrator remains planar/spherical Earth.
const inclination=28*Math.PI/180;
const point=(p:number[])=>new T.Vector3(p[0]/EARTH,p[1]/EARTH*Math.sin(inclination),p[1]/EARTH*Math.cos(inclination));
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
export default function Scene({result,clock,view,vectors=false,onFailure}:Props) {
  const host=useRef<HTMLDivElement>(null),labelA=useRef<HTMLDivElement>(null),labelB=useRef<HTMLDivElement>(null);
  const viewRef=useRef(view),current=useRef(result),vectorRef=useRef(vectors),api=useRef<{reset:()=>void;zoom:(factor:number)=>void}|null>(null);
  viewRef.current=view;current.current=result;vectorRef.current=vectors;
  useEffect(()=>{
    const root=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{onFailure('WebGL 2 is unavailable. The orbital-plane view uses the same calculated flight.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x070d17,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','3D Earth and tether flight. Drag to rotate; keyboard-accessible zoom, reset and alternative views are provided.');root.appendChild(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.003,250);let dirty=true;
    const markDirty=()=>{dirty=true;};const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxDistance=100;controls.addEventListener('change',markDirty);
    const focalPoint=()=>{const r=current.current,f=sample(r,clock.current??0),p=positions(r,f);return point(payloadState(r,f)??p.hub);};
    const reset=()=>{
      const r=current.current;
      if(viewRef.current==='follow'){const focus=focalPoint();controls.target.copy(focus);camera.position.copy(focus).add(new T.Vector3(.35,.25,.55));controls.minDistance=.02;}
      else {const radius=1+r.design.altitudeKm*1000/EARTH;controls.target.set(0,0,0);camera.position.set(.9,1.8,3.5).multiplyScalar(radius/1.25);controls.minDistance=1.06;}
      controls.update();dirty=true;
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
    const trail=line(0x76e9e8,.8),incomingTrail=line(0xffbd83,.6),outgoing=[line(0xffbd83),line(0xd4d8ff)];
    const tether=new T.Mesh(new T.CylinderGeometry(.0016,.0016,1,8),new T.MeshBasicMaterial({color:0xbff5f3}));scene.add(tether);
    const marker=(color:number,radius:number)=>{const m=new T.Mesh(new T.SphereGeometry(radius,14,10),new T.MeshBasicMaterial({color}));scene.add(m);return m;};
    const ends=[marker(0xbff5f3,.004),marker(0xbff5f3,.004)],hub=marker(0xffffff,.008),cargo=[marker(0xffbd83,.009),marker(0xd4d8ff,.009)];
    const plume=new T.Mesh(new T.ConeGeometry(.009,.06,12),new T.MeshBasicMaterial({color:0xffac70,transparent:true,opacity:.8}));scene.add(plume);
    const velocity=[new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),.1,0x7de7ee,.02,.008),new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),.1,0xffbd83,.02,.008)];velocity.forEach(a=>scene.add(a));
    const setPoints=(l:T.Line,pts:T.Vector3[])=>{l.geometry.dispose();l.geometry=new T.BufferGeometry().setFromPoints(pts);if(l===reference)l.computeLineDistances();};
    const observer=new ResizeObserver(()=>{const box=root.getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();dirty=true;});observer.observe(root);
    const lost=(e:Event)=>{e.preventDefault();onFailure('The graphics context was lost. Your calculation is intact; the 2D view remains available.');};renderer.domElement.addEventListener('webglcontextlost',lost);
    function label(el:HTMLDivElement|null,world:T.Vector3,text:string,offset:number) {
      if(!el)return;const v=world.clone().project(camera),ray=world.clone().sub(camera.position),distance=ray.length();ray.normalize();
      const b=camera.position.dot(ray),q=b*b-camera.position.lengthSq()+1,hit=q>0?-b-Math.sqrt(q):Infinity;
      const hide=v.z>1||v.z<-1||(hit>0&&hit<distance-.01)||Math.abs(v.x)>.95||Math.abs(v.y)>.88;
      el.hidden=hide;if(hide)return;const rect=root.getBoundingClientRect();el.textContent=text;
      el.style.left=`${Math.max(12,Math.min(rect.width-160,(v.x+1)*rect.width/2+12))}px`;el.style.top=`${Math.max(55,Math.min(rect.height-65,(-v.y+1)*rect.height/2+offset))}px`;
    }
    let frame=0,lastTime=-1,lastView='',lastResult:Result|null=null,lastVectors=false;
    const draw=()=>{
      frame=requestAnimationFrame(draw);if(document.hidden||!root.clientWidth||!root.clientHeight)return;
      const r=current.current,t=clock.current??0,v=viewRef.current,show=vectorRef.current;
      if(!dirty&&lastResult===r&&lastTime===t&&lastView===v&&lastVectors===show)return;
      if(lastResult!==r){const radius=EARTH+r.design.altitudeKm*1000;setPoints(reference,Array.from({length:241},(_,j)=>point([Math.cos(j*Math.PI/120)*radius,Math.sin(j*Math.PI/120)*radius])));lastResult=r;lastTime=-1;reset();}
      if(lastView!==v){reset();lastView=v;}
      const f=sample(r,t),p=positions(r,f),a=point(p.a),z=point(p.z),h=point(p.hub);
      if(v==='follow'&&t!==lastTime){const focus=focalPoint(),shift=focus.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(focus);}
      if(t!==lastTime){
        earth.rotation.y=t*7.292115e-5+.8;
        tether.position.copy(a).add(z).multiplyScalar(.5);tether.scale.y=a.distanceTo(z);tether.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),z.clone().sub(a).normalize());ends[0].position.copy(a);ends[1].position.copy(z);hub.position.copy(h);
        cargo.forEach((m,j)=>{m.visible=!!f.payloads[j]||(f.loaded&&j===f.deliveries)||(j===0&&!!f.incoming);if(j===0&&f.incoming)m.position.copy(point(f.incoming));else if(f.payloads[j])m.position.copy(point(f.payloads[j]));else if(m.visible)m.position.copy(z);});
        plume.visible=f.burn;if(f.burn){const force=forces(f.state,compile(r.design,f.fuel,f.loaded,r.cells),r.design,true),behind=point([-force.tx,-force.ty]).normalize();plume.position.copy(h).addScaledVector(behind,.03);plume.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),behind);}
        setPoints(trail,[...r.frames.filter(q=>q.t<=t&&q.t>=t-3200).map(q=>point(q.state)),point(f.state)]);
        setPoints(incomingTrail,r.frames.filter(q=>q.t<=t&&q.incoming).map(q=>point(q.incoming!)));
        outgoing.forEach((l,j)=>setPoints(l,[...r.frames.filter(q=>q.t<=t&&q.payloads[j]).map(q=>point(q.payloads[j])),...(f.payloads[j]?[point(f.payloads[j])]:[])]));
      }
      [p.hub,payloadState(r,f)??p.z].forEach((state,j)=>{const arrow=velocity[j],direction=point([state[2],state[3]]);arrow.visible=show;arrow.position.copy(point(state));arrow.setDirection(direction.clone().normalize());arrow.setLength(Math.max(.01,Math.hypot(state[2],state[3])/1000*.025),.018,.007);});
      controls.update();renderer.render(scene,camera);
      label(labelA.current,h,'FACILITY',-28);
      const target=payloadState(r,f);
      if(target){const pos=point(target),screenA=h.clone().project(camera),screenB=pos.clone().project(camera);const separation=Math.hypot((screenA.x-screenB.x)*root.clientWidth/2,(screenA.y-screenB.y)*root.clientHeight/2);
        label(labelB.current,pos,f.loaded?'PAYLOAD / ATTACHED':f.incoming?'INCOMING PAYLOAD':'RELEASED PAYLOAD',separation<100?20:-25);
      }else if(labelB.current)labelB.current.hidden=true;
      dirty=false;lastTime=t;lastVectors=show;
    };draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',markDirty);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{const mesh=o as T.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(material as T.MeshPhongMaterial).map?.dispose();material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="scene-three" ref={host}><div ref={labelA} className="world-label" aria-hidden="true"/><div ref={labelB} className="world-label cargo-label" aria-hidden="true"/>
    <div className="camera-actions"><button onClick={()=>api.current?.zoom(.8)} aria-label="Zoom camera in">+</button><button onClick={()=>api.current?.zoom(1.25)} aria-label="Zoom camera out">−</button><button onClick={()=>api.current?.reset()}>Reset camera</button></div>
  </div>;
}
export function Plane({result,clock,vectors=false}:Omit<Props,'view'|'onFailure'>) {
  const canvas=useRef<HTMLCanvasElement>(null),rref=useRef(result),zoom=useRef(1),vref=useRef(vectors);rref.current=result;vref.current=vectors;
  useEffect(()=>{
    const c=canvas.current!,g=c.getContext('2d')!,parent=c.parentElement!;let request=0;
    const resize=()=>{const w=Math.round(parent.clientWidth*Math.min(devicePixelRatio,2)),h=Math.round(parent.clientHeight*Math.min(devicePixelRatio,2));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;};const observer=new ResizeObserver(resize);observer.observe(parent);resize();
    let previous=-1,previousR:Result|null=null,previousW=0,previousH=0,previousZoom=0,previousVectors=false;
    const draw=()=>{
      request=requestAnimationFrame(draw);if(document.hidden||!c.width||!c.height)return;const r=rref.current,t=clock.current??0,show=vref.current;
      if(t===previous&&r===previousR&&previousW===c.width&&previousH===c.height&&previousZoom===zoom.current&&previousVectors===show)return;
      previous=t;previousR=r;previousW=c.width;previousH=c.height;previousZoom=zoom.current;previousVectors=show;
      const dpr=Math.min(devicePixelRatio,2),w=c.width,h=c.height,s=Math.min(w,h)/(2.7*(EARTH+r.design.altitudeKm*1000+r.design.spanKm*500))*zoom.current,x=w/2,y=h/2;
      const xy=(p:number[])=>[x+p[0]*s,y-p[1]*s];g.clearRect(0,0,w,h);
      const glow=g.createRadialGradient(x-EARTH*s*.35,y-EARTH*s*.4,0,x,y,EARTH*s);glow.addColorStop(0,'#285168');glow.addColorStop(.65,'#122f47');glow.addColorStop(1,'#081925');g.fillStyle=glow;g.beginPath();g.arc(x,y,EARTH*s,0,Math.PI*2);g.fill();g.strokeStyle='#6ca7c5';g.lineWidth=1.2*dpr;g.stroke();
      g.strokeStyle='#355369';g.lineWidth=.5*dpr;for(let j=1;j<=3;j++){g.beginPath();g.ellipse(x,y,EARTH*s*j/4,EARTH*s,0,0,Math.PI*2);g.stroke();}
      g.strokeStyle='#69849d';g.setLineDash([4*dpr,6*dpr]);g.beginPath();g.arc(x,y,(EARTH+r.design.altitudeKm*1000)*s,0,Math.PI*2);g.stroke();g.setLineDash([]);
      const path=(pts:number[][],color:string)=>{g.strokeStyle=color;g.lineWidth=1.5*dpr;g.beginPath();pts.forEach((p,i)=>{const [a,b]=xy(p);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();};
      path(r.frames.filter(f=>f.t<=t&&f.t>t-3200).map(f=>f.state),'#7de7ee');
      for(let j=0;j<2;j++)path(r.frames.filter(f=>f.t<=t&&f.payloads[j]).map(f=>f.payloads[j]),j?'#d4d8ff':'#ffbd83');
      path(r.frames.filter(f=>f.t<=t&&f.incoming).map(f=>f.incoming!),'#ffbd8380');
      const f=sample(r,t),p=positions(r,f);path([p.a,p.z],'#ccffff');
      const dot=(v:number[],color:string,radius=4)=>{const [a,b]=xy(v);g.beginPath();g.arc(a,b,radius*dpr,0,Math.PI*2);g.fillStyle=color;g.fill();};dot(p.hub,'#f5f7ff');dot(p.a,'#7de7ee',2);dot(p.z,'#7de7ee',2);if(f.loaded)dot(p.z,'#ffbd83');if(f.incoming)dot(f.incoming,'#ffbd83');f.payloads.forEach(q=>dot(q,'#ffbd83'));
      const label=(v:number[],text:string,color:string,offset=0)=>{const [a,b]=xy(v);if(a<5||a>w-10||b<65*dpr||b>h-70*dpr)return;g.font=`${10*dpr}px monospace`;g.textAlign='left';const tx=Math.min(w-g.measureText(text).width-12*dpr,a+10*dpr);g.fillStyle='#071321dd';g.fillRect(tx-4*dpr,b+offset*dpr-18*dpr,g.measureText(text).width+8*dpr,18*dpr);g.fillStyle=color;g.fillText(text,tx,b+offset*dpr-5*dpr);};
      label(p.hub,'FACILITY','#d9efff');const payload=payloadState(r,f);if(payload)label(payload,f.loaded?'PAYLOAD / ATTACHED':'PAYLOAD','#ffbd83',24);
      if(show){for(const [v,color] of [[p.hub,'#7de7ee'],[payload??p.z,'#ffbd83']] as [number[],string][]){const [a,b]=xy(v),vx=v[2]/1000*10*dpr,vy=-v[3]/1000*10*dpr,angle=Math.atan2(vy,vx);g.strokeStyle=color;g.lineWidth=1.5*dpr;g.beginPath();g.moveTo(a,b);g.lineTo(a+vx,b+vy);g.moveTo(a+vx-7*dpr*Math.cos(angle-.4),b+vy-7*dpr*Math.sin(angle-.4));g.lineTo(a+vx,b+vy);g.lineTo(a+vx-7*dpr*Math.cos(angle+.4),b+vy-7*dpr*Math.sin(angle+.4));g.stroke();}}
      g.fillStyle='#7fa1ba';g.font=`${11*dpr}px monospace`;g.textAlign='center';g.fillText('EARTH',x,y+4*dpr);
    };draw();return()=>{cancelAnimationFrame(request);observer.disconnect();};
  },[]);
  return <div className="scene-plane"><canvas ref={canvas} aria-label="Orbital-plane view of the calculated trajectory"/><div className="plane-zoom"><button onClick={()=>zoom.current=Math.min(4,zoom.current*1.25)} aria-label="Zoom in">+</button><button onClick={()=>zoom.current=Math.max(.3,zoom.current/1.25)} aria-label="Zoom out">−</button><button onClick={()=>zoom.current=1}>Fit</button></div></div>;
}
