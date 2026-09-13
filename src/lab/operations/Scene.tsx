import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {earthTexture} from '../Scene.js';
import {EARTH,compile,pointState} from '../../simulation/engine.js';
import {type OpsResult,type OpsFrame,sampleOps} from '../../simulation/operations.js';
export const colors={facility:'#7de7ee',outbound:'#ffbd83',inbound:'#c9b8ff'};
export function geometry(r:OpsResult,f:OpsFrame){
  const row=r.rows.find(s=>s.id===f.attachedId),d=row?{...r.plan.design,payloadT:row.massT}:r.plan.design,b=compile(d,f.state[6],!!row,r.cells);
  return {hub:pointState(f.state,b,0),a:pointState(f.state,b,-b.half),z:pointState(f.state,b,b.half)};
}
interface Props{result:OpsResult;time:number;selected:string;follow:boolean;plane:boolean;onFallback:()=>void}
export default function OperationsScene(props:Props){
  const root=useRef<HTMLDivElement>(null),current=useRef(props),cameraAPI=useRef<{reset:()=>void;zoom:(f:number)=>void}|null>(null);current.current=props;
  useEffect(()=>{
    const host=root.current!,canvas=document.createElement('canvas');let raf=0,dirty=true,previous='',renderer:T.WebGLRenderer|null=null;
    const color=(id:string)=>colors[current.current.result.rows.find(r=>r.id===id)?.direction??'outbound'];
    if(!props.plane){try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});}catch{props.onFallback();return;}}
    host.appendChild(canvas);canvas.setAttribute('aria-label',props.plane?'Operations orbital-plane view':'3D operations Earth view');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.001,200),point=(v:number[])=>new T.Vector3(v[0]/EARTH,0,-v[1]/EARTH);
    let controls:OrbitControls|null=null;const earth=new T.Mesh(new T.SphereGeometry(1,64,40),new T.MeshPhongMaterial({map:earthTexture(),shininess:9}));
    if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));scene.add(earth,new T.AmbientLight(0xa0c0e0,.8));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-3,5,4);scene.add(light);controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=.015;controls.maxDistance=80;controls.addEventListener('change',()=>dirty=true);}
    const cable=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:colors.facility}));scene.add(cable);
    const path=(c:string,opacity=.6)=>{const l=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:c,transparent:true,opacity}));scene.add(l);return l;};
    const approach=path('#ffcfac',.8),reference=path('#7996b3',.35),track=path(colors.facility,.8),trails=new Map<string,T.Line>(),markers=new Map<string,T.Mesh>();
    for(const [id,shape] of [['facility','square'],...props.result.rows.map(r=>[r.id,r.direction])] as [string,string][]){const m=new T.Mesh(shape==='inbound'?new T.OctahedronGeometry(1):new T.SphereGeometry(1,12,8),new T.MeshBasicMaterial({color:id==='facility'?colors.facility:color(id)}));scene.add(m);markers.set(id,m);if(id!=='facility')trails.set(id,path(color(id),.35));}
    const setPoints=(line:T.Line,pts:T.Vector3[])=>{line.geometry.dispose();line.geometry=new T.BufferGeometry().setFromPoints(pts);};
    const radius=EARTH+props.result.plan.design.altitudeKm*1000;
    setPoints(reference,Array.from({length:241},(_,i)=>point([radius*Math.cos(i*Math.PI/120),radius*Math.sin(i*Math.PI/120)])));
    let zoom=1,focus:T.Vector3|null=null;
    const target=()=>{const p=current.current,f=sampleOps(p.result,p.time),g=geometry(p.result,f);return p.selected==='facility'?g.hub:f.cargo.find(c=>c.id===p.selected)?.state??null;};
    const reset=()=>{zoom=1;const p=current.current,s=target();if(controls){focus=p.follow&&s?point(s):null;controls.target.copy(focus??new T.Vector3());camera.position.copy(controls.target).add(new T.Vector3(.6,1.9,2.7).normalize().multiplyScalar(focus ? .4 : (1+radius/EARTH)*1.8));controls.update();}dirty=true;};
    cameraAPI.current={reset,zoom:f=>{zoom*=1/f;if(controls){camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();}dirty=true;}};reset();
    const observer=new ResizeObserver(()=>{const box=host.getBoundingClientRect();if(renderer){renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();}else{canvas.width=Math.round(box.width*Math.min(devicePixelRatio,2));canvas.height=Math.round(box.height*Math.min(devicePixelRatio,2));}dirty=true;});observer.observe(host);
    let lastSelection='',lastFollow=false;
    const label=document.createElement('div');label.className='ops-scene-label';host.appendChild(label);
    const draw=()=>{
      raf=requestAnimationFrame(draw);const p=current.current;if(document.hidden||!host.clientWidth)return;
      const stamp=`${p.time}|${p.selected}|${p.follow}`;if(!dirty&&previous===stamp)return;
      const f=sampleOps(p.result,p.time),g=geometry(p.result,f),state=target();
      if(lastSelection!==p.selected||lastFollow!==p.follow){reset();lastSelection=p.selected;lastFollow=p.follow;}
      host.dataset.selected=p.selected;host.dataset.followTarget=p.follow&&state?p.selected:'none';
      label.textContent=state?`${p.selected==='facility'?'FACILITY':p.selected} · ${p.selected==='facility'?(f.powered?'powered recovery':'coasting'):f.cargo.find(c=>c.id===p.selected)?.phase}`:`${p.selected} · not in the scene at this time`;
      if(renderer&&controls){
        if(p.follow&&state){const next=point(state);camera.position.add(next.clone().sub(controls.target));controls.target.copy(next);}
        host.dataset.followError=p.follow&&state?String(controls.target.distanceTo(point(state))):'';
        earth.rotation.y=p.time*7.292115e-5+.8;setPoints(cable,[point(g.a),point(g.z)]);
        setPoints(track,[...p.result.frames.filter(q=>q.t<=p.time&&q.t>p.time-3000).map(q=>point(q.state)),point(f.state)]);
        for(const [id,m] of markers){const s=id==='facility'?g.hub:f.cargo.find(c=>c.id===id)?.state;m.visible=!!s;if(s){m.position.copy(point(s));m.scale.setScalar(Math.max(.00008,camera.position.distanceTo(m.position)*Math.tan(camera.fov*Math.PI/360)*8/host.clientHeight));}}
        const incoming=f.cargo.find(c=>c.phase==='approach');
        (approach.material as T.LineBasicMaterial).color.set(incoming?color(incoming.id):colors.outbound);
        setPoints(approach,incoming?p.result.frames.filter(q=>q.t<=p.time).flatMap(q=>{const c=q.cargo.find(c=>c.id===incoming.id&&c.phase==='approach');return c?[point(c.state)]:[];}):[]);
        for(const [id,l] of trails){const pts=p.result.frames.filter(q=>q.t<=p.time).flatMap(q=>{const c=q.cargo.find(c=>c.id===id);return c&&(c.phase==='released'||c.phase==='cutoff'||c.phase==='flyby')?[point(c.state)]:[];});setPoints(l,pts);}
        controls.update();renderer.render(scene,camera);
      }else{
        const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,dpr=Math.min(devicePixelRatio,2),scale=Math.min(w,h)/(2.9*(radius+p.result.plan.design.spanKm*500)) * zoom * (p.follow&&state?5:1);
        const cx=w/2-(p.follow&&state?state[0]*scale:0),cy=h/2+(p.follow&&state?state[1]*scale:0),xy=(a:number[])=>[cx+a[0]*scale,cy-a[1]*scale];
        c.clearRect(0,0,w,h);const grad=c.createRadialGradient(cx-EARTH*scale*.3,cy-EARTH*scale*.3,0,cx,cy,EARTH*scale);grad.addColorStop(0,'#2b596a');grad.addColorStop(1,'#0b2035');c.fillStyle=grad;c.beginPath();c.arc(cx,cy,EARTH*scale,0,Math.PI*2);c.fill();
        const stroke=(points:number[][],col:string,dashed=false)=>{c.strokeStyle=col;c.lineWidth=1.3*dpr;c.setLineDash(dashed?[3*dpr,6*dpr]:[]);c.beginPath();points.forEach((a,i)=>{const [x,y]=xy(a);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.setLineDash([]);};
        stroke(Array.from({length:241},(_,i)=>[radius*Math.cos(i*Math.PI/120),radius*Math.sin(i*Math.PI/120)]),'#45627c',true);
        for(const row of p.result.rows)stroke(p.result.frames.filter(q=>q.t<=p.time).flatMap(q=>{const a=q.cargo.find(c=>c.id===row.id);return a&&(a.phase==='released'||a.phase==='cutoff'||a.phase==='flyby')?[a.state]:[];}),color(row.id)+'66');
        const incoming=f.cargo.find(c=>c.phase==='approach');if(incoming)stroke(p.result.frames.filter(q=>q.t<=p.time).flatMap(q=>{const c=q.cargo.find(c=>c.id===incoming.id&&c.phase==='approach');return c?[c.state]:[];}),color(incoming.id));
        stroke([g.a,g.z],colors.facility);const all=[{id:'facility',state:g.hub},...f.cargo];
        for(const obj of all){const [x,y]=xy(obj.state),r=(obj.id===p.selected?6:4)*dpr,dir=p.result.rows.find(r=>r.id===obj.id)?.direction;c.fillStyle=obj.id==='facility'?colors.facility:color(obj.id);c.beginPath();if(dir==='inbound'){c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();}else c.arc(x,y,r,0,Math.PI*2);c.fill();if(obj.id===p.selected){c.font=`${11*dpr}px monospace`;c.fillText(obj.id.toUpperCase(),Math.min(w-100*dpr,x+12*dpr),y-10*dpr);}}
      }
      previous=stamp;dirty=false;
    };draw();
    return()=>{cancelAnimationFrame(raf);observer.disconnect();controls?.dispose();scene.traverse(o=>{const m=o as T.Mesh;m.geometry?.dispose();if(m.material)for(const material of Array.isArray(m.material)?m.material:[m.material]){(material as T.MeshPhongMaterial).map?.dispose();material.dispose();}});renderer?.dispose();canvas.remove();label.remove();};
  },[props.result,props.plane]);
  return <div className="ops-scene" ref={root} data-renderer={props.plane?'canvas':'webgl'}><div className="ops-camera"><button onClick={()=>cameraAPI.current?.zoom(.8)} aria-label="Zoom operations camera in">+</button><button onClick={()=>cameraAPI.current?.zoom(1.25)} aria-label="Zoom operations camera out">−</button><button onClick={()=>cameraAPI.current?.reset()}>Fit view</button></div></div>;
}
