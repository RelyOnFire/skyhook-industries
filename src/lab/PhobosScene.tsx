import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MARS, PHOBOS, MARS_X, PHOBOS_X, RATE, marsState, phobosSample, tipX, type PhobosResult } from '../simulation/phobos.js';

type Props={result:PhobosResult;clock:RefObject<number>;time:number};
/** Procedural colors only: no claim to geographic or terrain data. */
function marsTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d')!;
  g.fillStyle='#a2694b';g.fillRect(0,0,1024,512);
  let seed=401;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<190;i++){
    const x=random()*1024,y=random()*512,r=8+random()*90;
    const glow=g.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,i%3?'#412d2525':'#ddb88830');glow.addColorStop(1,'#a2694b00');
    g.fillStyle=glow;g.fillRect(x-r,y-r,2*r,2*r);
  }
  const ice=g.createLinearGradient(0,0,0,512);ice.addColorStop(0,'#f5dfc5cc');ice.addColorStop(.08,'#dcbf9300');ice.addColorStop(.91,'#dcbf9300');ice.addColorStop(1,'#f5dfc5aa');g.fillStyle=ice;g.fillRect(0,0,1024,512);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function Flight3D({result,clock,follow,onFailure}:{result:PhobosResult;clock:RefObject<number>;follow:boolean;onFailure:()=>void}){
  const host=useRef<HTMLDivElement>(null),label=useRef<HTMLSpanElement>(null),current=useRef(result),following=useRef(follow);
  const api=useRef<{reset:()=>void;zoom:(factor:number)=>void}|null>(null);current.current=result;following.current=follow;
  useEffect(()=>{
    const root=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{onFailure();return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x080b0d,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','3D Mars, Phobos and anchored tethers. Drag to rotate. Zoom, reset and orbit-plane controls are also available.');root.appendChild(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.001,200),controls=new OrbitControls(camera,renderer.domElement);
    const point=(x:number,y:number)=>new T.Vector3(x/MARS.radius,Math.sin(.4)*y/MARS.radius,Math.cos(.4)*y/MARS.radius);
    const fromState=(s:number[],t:number)=>{const p=marsState(s as [number,number,number,number],t);return point(p[0],p[1]);};
    let dirty=true;controls.enableDamping=false;controls.minDistance=.02;controls.maxDistance=100;controls.addEventListener('change',()=>{dirty=true;});
    const reset=()=>{
      const r=current.current,p=fromState(phobosSample(r,clock.current),clock.current);
      controls.target.copy(following.current?p:new T.Vector3());
      const reach=(PHOBOS.separation+PHOBOS.radius+r.design.outwardKm*1000)/(PHOBOS.separation+PHOBOS.radius+3000000);
      camera.position.copy(controls.target).add(following.current?new T.Vector3(.6,2,1):new T.Vector3(1,7.2,4.5).multiplyScalar(reach));controls.update();dirty=true;
    };
    api.current={reset,zoom:f=>{camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();dirty=true;}};reset();
    const texture=marsTexture(),mars=new T.Mesh(new T.SphereGeometry(1,80,56),new T.MeshPhongMaterial({map:texture,shininess:3}));scene.add(mars);
    const light=new T.DirectionalLight(0xffe9d0,2.5);light.position.set(-3,4,5);scene.add(light,new T.AmbientLight(0x81949e,.7));
    const moon=new T.Mesh(new T.IcosahedronGeometry(.038,1),new T.MeshPhongMaterial({color:0xa49a87,flatShading:true}));scene.add(moon);
    const makeLine=(color:number,opacity=1)=>{const l=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:true,opacity}));scene.add(l);return l;};
    const orbit=makeLine(0x798890,.3),predicted=makeLine(0xd49167,.25),trail=makeLine(0xffc098),arms=[makeLine(0xb6c9c9),makeLine(0xefa477)];
    const setLine=(l:T.Line,pts:T.Vector3[])=>{l.geometry.dispose();l.geometry=new T.BufferGeometry().setFromPoints(pts);};
    setLine(orbit,Array.from({length:241},(_,i)=>point(PHOBOS.separation*Math.cos(i*Math.PI/120),PHOBOS.separation*Math.sin(i*Math.PI/120))));
    const cargo=new T.Mesh(new T.OctahedronGeometry(.021),new T.MeshBasicMaterial({color:0xffc098}));scene.add(cargo);
    const terminals=[0xb6c9c9,0xefa477].map(color=>{const m=new T.Mesh(new T.SphereGeometry(.012,10,8),new T.MeshBasicMaterial({color}));scene.add(m);return m;});
    let starSeed=92;const stars=Array.from({length:900},()=>{starSeed=(1664525*starSeed+1013904223)>>>0;return (starSeed/4294967296-.5)*80;});
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(stars,3));scene.add(new T.Points(geometry,new T.PointsMaterial({size:.018,color:0xaabbc1,transparent:true,opacity:.45})));
    const resize=new ResizeObserver(()=>{const {width,height}=root.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.fov=2*Math.atan(Math.tan(Math.PI/10)*Math.max(1,1.45/camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();dirty=true;});resize.observe(root);
    const lost=(e:Event)=>{e.preventDefault();onFailure();};renderer.domElement.addEventListener('webglcontextlost',lost);
    let raf=0,previous=-1,oldResult:PhobosResult|null=null,oldFollow=follow;
    const draw=()=>{
      raf=requestAnimationFrame(draw);if(document.hidden||!root.clientWidth||!root.clientHeight)return;
      const r=current.current,t=clock.current;
      if(oldResult!==r){setLine(predicted,r.frames.map(f=>fromState(f.state,f.t)));oldResult=r;previous=-1;reset();}
      if(oldFollow!==following.current){oldFollow=following.current;reset();}
      if(previous===t&&!dirty)return;
      const p=fromState(phobosSample(r,t),t);
      if(following.current){const offset=p.clone().sub(controls.target);controls.target.copy(p);camera.position.add(offset);controls.update();}
      if(previous!==t){
        const angle=RATE*t,c=Math.cos(angle),s=Math.sin(angle);moon.position.copy(point(PHOBOS.separation*c,PHOBOS.separation*s));moon.rotation.y=-angle;
        (['inward','outward'] as const).forEach((arm,i)=>{
          const sign=i===0?-1:1,rootRadius=PHOBOS.separation+sign*PHOBOS.radius,tipRadius=tipX(r.design,arm)-MARS_X;
          const end=point(tipRadius*c,tipRadius*s);setLine(arms[i],[point(rootRadius*c,rootRadius*s),end]);terminals[i].position.copy(end);
        });
        cargo.position.copy(p);cargo.visible=r.outcome!=='structure-limit';
        setLine(trail,[...r.frames.filter(f=>f.t<=t).map(f=>fromState(f.state,f.t)),p]);mars.rotation.y=t*2*Math.PI/(1.02595676*86400);
      }
      if(label.current){
        const v=moon.position.clone().project(camera),ray=moon.position.clone().sub(camera.position),distance=ray.length();ray.normalize();
        const b=camera.position.dot(ray),q=b*b-camera.position.lengthSq()+1,hit=q>0?-b-Math.sqrt(q):Infinity;
        label.current.hidden=v.z< -1||v.z>1||Math.abs(v.x)>.78||Math.abs(v.y)>.8||(hit>0&&hit<distance-.05);
        label.current.style.left=`${Math.max(8,Math.min(root.clientWidth-label.current.offsetWidth-8,(v.x+1)*root.clientWidth/2+12))}px`;label.current.style.top=`${(1-v.y)*root.clientHeight/2-12}px`;
      }
      renderer.render(scene,camera);previous=t;dirty=false;
    };draw();
    return()=>{cancelAnimationFrame(raf);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);
      scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});texture.dispose();renderer.dispose();renderer.domElement.remove();api.current=null;};
  },[]);
  return <div className="phobos-three" data-body="mars-phobos" ref={host}><span ref={label} className="phobos-world-label">PHOBOS <small>Central anchor</small></span><div className="phobos-camera"><button onClick={()=>api.current?.zoom(.75)} aria-label="Zoom in">+</button><button onClick={()=>api.current?.zoom(1.33)} aria-label="Zoom out">−</button><button onClick={()=>api.current?.reset()}>Reset camera</button></div></div>;
}
export default function PhobosScene({result,clock,time}:Props){
  const [view,setView]=useState<'system'|'follow'|'plane'>('system'),[gpu,setGpu]=useState(true);
  const r=result,s=phobosSample(r,time),cargo=marsState(s,time),angle=RATE*time;
  // The plane view fits the entire calculated path and remains useful without WebGL.
  const extent=useMemo(()=>Math.max(PHOBOS.separation+PHOBOS.radius+r.design.outwardKm*1000,...r.frames.map(f=>Math.hypot(f.state[0]-MARS_X,f.state[1])))*1.18,[r]);
  const scale=220/extent,xy=(x:number,y:number)=>[300+x*scale,240-y*scale];
  const pos=(x:number)=>xy(x*Math.cos(angle),x*Math.sin(angle)),anchor=pos(PHOBOS.separation),tipI=pos(tipX(r.design,'inward')-MARS_X),tipO=pos(tipX(r.design,'outward')-MARS_X),cp=xy(cargo[0],cargo[1]);
  const path=useMemo(()=>r.frames.map(f=>{const p=marsState(f.state,f.t);return `${300+p[0]*scale},${240-p[1]*scale}`;}).join(' '),[r,scale]);
  return <>
    <div className="phobos-scene-toolbar" role="group" aria-label="Scene view"><span>MARS / PHOBOS</span><button aria-pressed={view==='system'&&gpu} disabled={!gpu} onClick={()=>setView('system')}>System</button><button aria-pressed={view==='follow'&&gpu} disabled={!gpu} onClick={()=>setView('follow')}>Follow cargo</button><button aria-pressed={view==='plane'||!gpu} onClick={()=>setView('plane')}>Orbit plane</button></div>
    <div className="phobos-viewport">
      {gpu&&view!=='plane'?<Flight3D result={r} clock={clock} follow={view==='follow'} onFailure={()=>setGpu(false)}/>:<svg className="phobos-plane" viewBox="0 0 600 480" role="img" aria-label="Calculated Mars orbit plane, with Phobos as the anchor between the inward and outward terminals">
        <defs><radialGradient id="phobos-mars"><stop stopColor="#bd8761"/><stop offset="1" stopColor="#492d24"/></radialGradient></defs>
        <circle cx="300" cy="240" r={MARS.radius*scale} fill="url(#phobos-mars)"/><circle cx="300" cy="240" r={PHOBOS.separation*scale} fill="none" stroke="#8a9ca34a" strokeDasharray="3 6"/>
        <polyline points={path} fill="none" stroke="#eab08b" strokeWidth="1.2" opacity=".6"/>
        <line x1={tipI[0]} y1={tipI[1]} x2={anchor[0]} y2={anchor[1]} stroke="#b6c9c9" strokeWidth="2"/><line x1={anchor[0]} y1={anchor[1]} x2={tipO[0]} y2={tipO[1]} stroke="#efa477" strokeWidth="2"/>
        <circle cx={anchor[0]} cy={anchor[1]} r="5" fill="#c4baab"/><text x={anchor[0]} y={anchor[1]-15} textAnchor="middle" fill="#e7e6e0" fontSize="12">Phobos</text>
        <circle cx={cp[0]} cy={cp[1]} r="4" fill="#ffc098"/>
      </svg>}
      {!gpu&&<span className="phobos-fallback">WebGL unavailable · showing the calculated orbit plane</span>}
      <div className="phobos-scene-caption"><span><i/> Inward arm</span><span><i/> Outward arm</span><span>Phobos & cargo markers enlarged · illustrative surfaces</span></div>
    </div>
  </>;
}
