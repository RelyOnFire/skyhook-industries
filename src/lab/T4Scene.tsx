import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH } from '../simulation/engine.js';
import { t4Geometry,t4Sample,type T4Result } from '../simulation/t4.js';
import { earthTexture } from './Scene.js';
type Mode='stages'|'orbit'|'cargo'|'plane';
function ThreeView({result,clock,mode,onFailure}:{result:T4Result;clock:RefObject<number>;mode:Mode;onFailure:()=>void}){
  const host=useRef<HTMLDivElement>(null),label=useRef<HTMLSpanElement>(null),current=useRef(result),view=useRef(mode),api=useRef<{reset:()=>void;zoom:(f:number)=>void}|null>(null);
  current.current=result;view.current=mode;
  useEffect(()=>{
    const root=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{onFailure();return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x080b0d,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','3D two-tier tether above Earth. The secondary rotor turns about the moving pivot. Drag to rotate or use camera controls.');root.appendChild(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.00001,100),controls=new OrbitControls(camera,renderer.domElement);
    const point=(p:number[])=>new T.Vector3(p[0]/EARTH,p[1]/EARTH*Math.sin(.4),p[1]/EARTH*Math.cos(.4));
    let dirty=true;controls.enableDamping=false;controls.minDistance=.001;controls.maxDistance=50;controls.addEventListener('change',()=>{dirty=true;});
    const target=()=>{const r=current.current,f=t4Sample(r,clock.current),p=t4Geometry(f.s,r.design);
      return view.current==='orbit'?new T.Vector3():view.current==='cargo'&&f.cargo?point(f.cargo):point(p.hub).add(point(p.pivot)).multiplyScalar(.5);
    };
    const reset=()=>{const r=current.current,span=(r.design.primaryKm+2*r.design.secondaryKm)*1000/EARTH;controls.target.copy(target());camera.position.copy(controls.target).add(view.current==='orbit'?new T.Vector3(.7,2.9,4.5).multiplyScalar((EARTH+r.design.altitudeKm*1000)/EARTH):new T.Vector3(.15,1,.35).normalize().multiplyScalar(span*1.8));controls.update();dirty=true;};
    api.current={reset,zoom:f=>{camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();dirty=true;}};reset();
    const texture=earthTexture(),earth=new T.Mesh(new T.SphereGeometry(1,96,64),new T.MeshPhongMaterial({map:texture,shininess:12}));scene.add(earth);
    const sun=new T.DirectionalLight(0xeaf1ff,2.2);sun.position.set(-2,4,5);scene.add(sun,new T.AmbientLight(0x849da6,.7));
    const line=(color:number,opacity=1)=>{const l=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:true,opacity}));scene.add(l);return l;};
    const primary=line(0xb7cdcf),secondary=line(0xefa477),path=line(0xc9a4e4,.5),track=line(0xb7cdcf,.22);
    const setLine=(l:T.Line,p:T.Vector3[])=>{l.geometry.dispose();l.geometry=new T.BufferGeometry().setFromPoints(p);};
    const marker=(color:number,shape='sphere')=>{const mesh=new T.Mesh(shape==='diamond'?new T.OctahedronGeometry(1):new T.SphereGeometry(1,14,10),new T.MeshBasicMaterial({color}));scene.add(mesh);return mesh;};
    const hub=marker(0xb7cdcf),pivot=marker(0xffffff),ends=[marker(0xefa477),marker(0xefa477)],cargo=marker(0xc9a4e4,'diamond');
    let seed=320;const stars=Array.from({length:900},()=>{seed=(1664525*seed+1013904223)>>>0;return(seed/4294967296-.5)*50;});const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));scene.add(new T.Points(starGeo,new T.PointsMaterial({size:.012,color:0xabc3c8,transparent:true,opacity:.4})));
    const resize=new ResizeObserver(()=>{const box=root.getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.fov=2*Math.atan(Math.tan(Math.PI/10)*Math.max(1,1.4/camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();dirty=true;});resize.observe(root);
    const lost=(e:Event)=>{e.preventDefault();onFailure();};renderer.domElement.addEventListener('webglcontextlost',lost);
    let raf=0,old:T4Result|null=null,last=-1,lastView='';
    const draw=()=>{raf=requestAnimationFrame(draw);if(document.hidden||!root.clientWidth)return;
      const r=current.current,t=clock.current;
      if(old!==r){old=r;last=-1;setLine(track,r.frames.filter((_,i)=>i%3===0).map(f=>point([f.s[0],f.s[1]])));setLine(path,r.frames.filter(f=>f.cargo).map(f=>point(f.cargo!)));reset();}
      if(lastView!==view.current){lastView=view.current;reset();}
      if(last===t&&!dirty)return;
      const f=t4Sample(r,t),p=t4Geometry(f.s,r.design),focus=target();
      camera.position.add(focus.clone().sub(controls.target));controls.target.copy(focus);controls.update();
      hub.position.copy(point(p.hub));pivot.position.copy(point(p.pivot));ends[0].position.copy(point(p.minus));ends[1].position.copy(point(p.plus));cargo.position.copy(point(f.cargo??p.plus));
      setLine(primary,[hub.position,pivot.position]);setLine(secondary,ends.map(x=>x.position));
      const scale=camera.position.distanceTo(controls.target)*.006;hub.scale.setScalar(scale);pivot.scale.setScalar(scale*.65);ends.forEach(e=>e.scale.setScalar(scale*.45));cargo.scale.setScalar(scale*.7);
      earth.rotation.y=t*7.292115e-5;root.dataset.phase=f.cargo?'released':'attached';
      if(label.current){const v=pivot.position.clone().project(camera),ray=pivot.position.clone().sub(camera.position),along=Math.max(0,Math.min(1,-camera.position.dot(ray)/ray.lengthSq())),occluded=camera.position.clone().addScaledVector(ray,along).length()<1;
        label.current.hidden=occluded||Math.abs(v.x)>.9||Math.abs(v.y)>.85||v.z>1||v.z< -1;label.current.style.left=`${Math.max(8,Math.min(root.clientWidth-label.current.offsetWidth-8,(v.x+1)*root.clientWidth/2+12))}px`;label.current.style.top=`${(1-v.y)*root.clientHeight/2-30}px`;}
      renderer.render(scene,camera);last=t;dirty=false;
    };draw();return()=>{cancelAnimationFrame(raf);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});texture.dispose();renderer.dispose();renderer.domElement.remove();api.current=null;};
  },[]);
  return <div className="phobos-three t4-three" ref={host}><span className="phobos-world-label" ref={label}>PIVOT <small>Free hinge · two stages</small></span><div className="phobos-camera"><button onClick={()=>api.current?.zoom(.75)} aria-label="Zoom in">+</button><button onClick={()=>api.current?.zoom(1.33)} aria-label="Zoom out">−</button><button onClick={()=>api.current?.reset()}>Reset camera</button></div></div>;
}
export default function T4Scene({result:r,clock,time}:{result:T4Result;clock:RefObject<number>;time:number}){
  const [mode,setMode]=useState<Mode>('stages'),[gpu,setGpu]=useState(true);
  const f=t4Sample(r,time),p=t4Geometry(f.s,r.design);
  const plane=mode==='plane',extent=useMemo(()=>Math.max(...r.frames.map(f=>Math.hypot(...(f.cargo??f.s).slice(0,2))),EARTH+r.design.altitudeKm*1000)*1.2,[r]);
  const focus=plane?[0,0]:[(p.hub[0]+p.pivot[0])/2,(p.hub[1]+p.pivot[1])/2],scale=220/(plane?extent:(r.design.primaryKm+2*r.design.secondaryKm)*800);
  const xy=(v:number[])=>[300+(v[0]-focus[0])*scale,240-(v[1]-focus[1])*scale],a=xy(p.hub),b=xy(p.pivot),minus=xy(p.minus),plus=xy(p.plus),cargo=xy(f.cargo??p.plus),earth=xy([0,0]);
  return <><div className="phobos-scene-toolbar" role="group" aria-label="Scene view"><span>EARTH / T4</span>{([['stages','Two stages'],['orbit','Earth orbit'],['cargo','Follow cargo'],['plane','Orbit plane']] as [Mode,string][]).map(([id,label])=><button key={id} aria-pressed={mode===id} disabled={!gpu&&(id==='orbit'||id==='cargo')} onClick={()=>setMode(id)}>{label}</button>)}</div>
    <div className="phobos-viewport t4-viewport">{gpu&&mode!=='plane'?<ThreeView result={r} clock={clock} mode={mode} onFailure={()=>{setGpu(false);setMode('stages');}}/>:<svg viewBox="0 0 600 480" className="phobos-plane" role="img" aria-label="Calculated two-stage geometry and cargo trajectory">
      <circle cx={earth[0]} cy={earth[1]} r={EARTH*scale} fill="#233d48"/>
      {plane&&<polyline points={r.frames.filter(f=>f.cargo).map(f=>xy(f.cargo!).join(',')).join(' ')} fill="none" stroke="#c9a4e4" strokeWidth="1" opacity=".5"/>}
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#b7cdcf" strokeWidth="2"/><line x1={minus[0]} y1={minus[1]} x2={plus[0]} y2={plus[1]} stroke="#efa477" strokeWidth="3"/>
      <circle cx={a[0]} cy={a[1]} r="5" fill="#b7cdcf"/><circle cx={b[0]} cy={b[1]} r="4" fill="#fff"/><circle cx={cargo[0]} cy={cargo[1]} r="4" fill="#c9a4e4"/><text x={b[0]+10} y={b[1]-12} fill="#e4ebed" fontSize="12">Pivot</text>
    </svg>}{!gpu&&<span className="phobos-fallback">WebGL unavailable · calculated 2D geometry</span>}
    <div className="phobos-scene-caption"><span><i/> Primary</span><span><i/> Secondary</span><span className="t4-cargo-key">◆ Cargo</span><span>Sizes to scale · markers enlarged · Earth surface illustrative</span></div></div></>;
}
