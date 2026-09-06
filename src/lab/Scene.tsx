import {useEffect,useRef,type RefObject} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EARTH,compile,forces,type Result} from '../simulation/engine.js';
import {sample,positions} from './view.js';
import {LAND} from './land.js';
export type View='earth'|'plane'|'follow';
type Props={result:Result;clock:RefObject<number>;view:View;onFailure:(message:string)=>void};
const i=28*Math.PI/180;
const point=(p:number[])=>new T.Vector3(p[0]/EARTH,p[1]/EARTH*Math.sin(i),p[1]/EARTH*Math.cos(i));
function earthTexture(){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const g=c.getContext('2d')!;
 g.fillStyle='#102a39';g.fillRect(0,0,c.width,c.height);
 g.fillStyle='#597570';g.strokeStyle='#819590';g.lineWidth=1;
 for(const poly of LAND){g.beginPath();poly.forEach(([lon,lat],j)=>{const x=(lon+180)/360*c.width,y=(90-lat)/180*c.height;j?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fill();g.stroke();}
 g.strokeStyle='rgba(148,182,190,.13)';g.lineWidth=1;
 for(let x=0;x<=2048;x+=2048/24){g.beginPath();g.moveTo(x,0);g.lineTo(x,1024);g.stroke();}
 for(let y=0;y<=1024;y+=1024/12){g.beginPath();g.moveTo(0,y);g.lineTo(2048,y);g.stroke();}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
}
export default function Scene({result,clock,view,onFailure}:Props){
 const host=useRef<HTMLDivElement>(null),viewRef=useRef(view),current=useRef(result),api=useRef<{reset:()=>void}|null>(null);
 viewRef.current=view;current.current=result;
 useEffect(()=>{const root=host.current!;let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{onFailure('WebGL 2 is unavailable. Orbital-plane view uses the same simulation.');return;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0x060b10,0);renderer.outputColorSpace=T.SRGBColorSpace;
 root.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive Earth and simulated tether. Drag to orbit; use the view buttons for keyboard-accessible alternatives.');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,0.005,80);let dirty=true;
 const markDirty=()=>{dirty=true;};
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=0.25;controls.maxDistance=12;controls.enablePan=true;controls.addEventListener('change',markDirty);
 const reset=()=>{camera.position.set(2.5,1.85,3.2);controls.target.set(0,0,0);controls.update();};reset();api.current={reset};
 const earth=new T.Mesh(new T.SphereGeometry(1,96,64),new T.MeshPhongMaterial({map:earthTexture(),specular:0x24454d,shininess:12}));scene.add(earth);
 const sun=new T.DirectionalLight(0xe9f3f1,2.8);sun.position.set(-3,4,5);scene.add(sun,new T.AmbientLight(0x8daab2,0.65));
 const atmosphere=new T.Mesh(new T.SphereGeometry(1.017,64,48),new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),4.);gl_FragColor=vec4(.21,.52,.66,rim*.55);}'}));scene.add(atmosphere);
 let seed=742;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const stars=[];
 for(let k=0;k<700;k++){const z=rng()*2-1,a=rng()*Math.PI*2,r=18;stars.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}
 const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));scene.add(new T.Points(starGeo,new T.PointsMaterial({color:0x93a9b8,size:0.013,transparent:true,opacity:.45,sizeAttenuation:true})));
 const line=(color:number,opacity=1)=>{const g=new T.BufferGeometry();const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));scene.add(l);return l;};
 const reference=line(0x526574,.5);reference.material=new T.LineDashedMaterial({color:0x526574,transparent:true,opacity:.5,dashSize:.025,gapSize:.015});const trail=line(0x6faeb0,.7),outgoing=[line(0xf5a669),line(0xe4cf99)];
 const tether=new T.Mesh(new T.CylinderGeometry(.0018,.0018,1,8),new T.MeshBasicMaterial({color:0xb2dddd}));scene.add(tether);
 const marker=(color:number,radius:number)=>{const m=new T.Mesh(new T.SphereGeometry(radius,12,10),new T.MeshBasicMaterial({color}));scene.add(m);return m;};
 const ends=[marker(0xb9dedb,.006),marker(0xb9dedb,.006)],hub=marker(0xf0f5f3,.012),cargo=[marker(0xf5a669,.013),marker(0xe4cf99,.013)];
 const plume=new T.Mesh(new T.ConeGeometry(.014,.075,12),new T.MeshBasicMaterial({color:0xf5a669,transparent:true,opacity:.8}));scene.add(plume);
 let lastResult:Result|null=null,lastTime=-1,lastView='',frame=0;
 const setPoints=(l:T.Line,pts:T.Vector3[])=>{l.geometry.dispose();l.geometry=new T.BufferGeometry().setFromPoints(pts);if(l===reference)l.computeLineDistances();};
 const resize=()=>{const rect=root.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();dirty=true;};const observer=new ResizeObserver(resize);observer.observe(root);resize();
 const lost=(e:Event)=>{e.preventDefault();onFailure('The graphics context was lost. The 2D view remains available.');};renderer.domElement.addEventListener('webglcontextlost',lost);
 const draw=()=>{
  frame=requestAnimationFrame(draw);if(document.hidden)return;
  const r=current.current,t=clock.current??0,v=viewRef.current;if(!dirty&&lastResult===r&&lastTime===t&&lastView===v)return;dirty=false;
  if(lastResult!==r){const radius=(EARTH+r.design.altitudeKm*1000)/EARTH;setPoints(reference,Array.from({length:241},(_,j)=>point([Math.cos(j*Math.PI/120)*radius*EARTH,Math.sin(j*Math.PI/120)*radius*EARTH])));lastResult=r;lastTime=-1;}
  const f=sample(r,t),p=positions(r,f),a=point(p.a),z=point(p.z),h=point(p.hub);
  if(v!==lastView){reset();if(v==='follow'){camera.position.copy(h).add(new T.Vector3(.2,.18,.28));controls.target.copy(h);controls.minDistance=.03;}else controls.minDistance=.25;lastView=v;}
  if(t!==lastTime){
   if(v==='follow'){const shift=h.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(h);}
   earth.rotation.y=t*7.292115e-5+0.8;
   tether.position.copy(a).add(z).multiplyScalar(.5);tether.scale.y=a.distanceTo(z);tether.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),z.clone().sub(a).normalize());
   ends[0].position.copy(a);ends[1].position.copy(z);hub.position.copy(h);
   cargo.forEach((m,j)=>{m.visible=!!f.payloads[j]||(f.loaded&&j===f.deliveries)||(j===0&&!!f.incoming);if(j===0&&f.incoming)m.position.copy(point(f.incoming));else if(f.payloads[j])m.position.copy(point(f.payloads[j]));else if(m.visible)m.position.copy(z);});
   plume.visible=f.burn;if(f.burn){const force=forces(f.state,compile(r.design,f.fuel,f.loaded),r.design,true),behind=point([-force.tx,-force.ty]).normalize();plume.position.copy(h).addScaledVector(behind,.04);plume.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),behind);}
   const past=r.frames.filter(q=>q.t<=t&&q.t>=t-2200);setPoints(trail,past.map(q=>point(q.state)));
   outgoing.forEach((l,j)=>{const ps=r.frames.filter(q=>q.t<=t&&q.payloads[j]).map(q=>point(q.payloads[j]));setPoints(l,ps);});lastTime=t;
  }
  controls.update();renderer.render(scene,camera);
 };draw();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',markDirty);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{const x=o as T.Mesh;x.geometry?.dispose();if(x.material){for(const m of Array.isArray(x.material)?x.material:[x.material]){const mat=m as T.MeshPhongMaterial;mat.map?.dispose();m.dispose();}}});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="scene-three" ref={host}><button className="camera-reset" onClick={()=>api.current?.reset()} aria-label="Reset camera">Reset view</button></div>;
}
export function Plane({result,clock}:Omit<Props,'view'|'onFailure'>){
 const canvas=useRef<HTMLCanvasElement>(null),rref=useRef(result),zoom=useRef(1);rref.current=result;
 useEffect(()=>{const c=canvas.current!,g=c.getContext('2d')!;let request=0;const parent=c.parentElement!;
 const resize=()=>{c.width=parent.clientWidth*Math.min(devicePixelRatio,2);c.height=parent.clientHeight*Math.min(devicePixelRatio,2);};const observer=new ResizeObserver(resize);observer.observe(parent);resize();
 let previous=-1,previousR:Result|null=null,previousW=0,previousZoom=0;
 const draw=()=>{request=requestAnimationFrame(draw);if(document.hidden)return;const r=rref.current,t=clock.current??0;if(t===previous&&r===previousR&&previousW===c.width&&previousZoom===zoom.current)return;previous=t;previousR=r;previousW=c.width;previousZoom=zoom.current;
 const w=c.width,h=c.height,s=Math.min(w,h)/3.5/EARTH*zoom.current,x=w/2,y=h/2;
 const xy=(p:number[])=>[x+p[0]*s,y-p[1]*s];g.clearRect(0,0,w,h);
 const glow=g.createRadialGradient(x-w*.03,y-h*.05,0,x,y,EARTH*s);glow.addColorStop(0,'#294b59');glow.addColorStop(1,'#10202c');g.fillStyle=glow;g.beginPath();g.arc(x,y,EARTH*s,0,Math.PI*2);g.fill();g.strokeStyle='#5e899c';g.lineWidth=1;g.stroke();
 g.strokeStyle='#557282';g.setLineDash([5,8]);g.beginPath();g.arc(x,y,(EARTH+r.design.altitudeKm*1000)*s,0,Math.PI*2);g.stroke();g.setLineDash([]);
 const path=(pts:number[][],color:string)=>{g.strokeStyle=color;g.lineWidth=2;g.beginPath();pts.forEach((p,i)=>{const [a,b]=xy(p);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();};
 path(r.frames.filter(f=>f.t<=t&&f.t>t-2200).map(f=>f.state),'#81bdbc');
 for(let j=0;j<2;j++)path(r.frames.filter(f=>f.t<=t&&f.payloads[j]).map(f=>f.payloads[j]),j?'#e4cf99':'#f5a669');
 const f=sample(r,t),p=positions(r,f);path([p.a,p.z],'#d1eeee');const dot=(v:number[],color:string)=>{const [a,b]=xy(v);g.beginPath();g.arc(a,b,5*Math.min(devicePixelRatio,2),0,Math.PI*2);g.fillStyle=color;g.fill();};dot(p.hub,'#f5f7f7');if(f.loaded)dot(p.z,'#f5a669');if(f.incoming)dot(f.incoming,'#f5a669');f.payloads.forEach(q=>dot(q,'#f5a669'));
 g.fillStyle='#94adb9';g.font=`${12*Math.min(devicePixelRatio,2)}px monospace`;g.textAlign='center';g.fillText('EARTH',x,y+5);
 };draw();return()=>{cancelAnimationFrame(request);observer.disconnect();};},[]);
 return <div className="scene-plane"><canvas ref={canvas} aria-label="Orbital-plane view of the same calculated trajectory"/><div className="plane-zoom"><button onClick={()=>zoom.current=Math.min(4,zoom.current*1.25)} aria-label="Zoom in">+</button><button onClick={()=>zoom.current=Math.max(.3,zoom.current/1.25)} aria-label="Zoom out">−</button></div></div>;
}
