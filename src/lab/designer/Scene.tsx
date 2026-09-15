import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EARTH} from '../../simulation/engine.js';
import {geometryPoint,orbitReference,type GeometryResult,type GeometryFrame} from '../../simulation/designer.js';
import {earthTexture} from '../Scene.js';
interface Props {result:GeometryResult;frame:GeometryFrame;plane:boolean;machine:boolean;onFallback:()=>void}
export default function DesignerScene(props:Props) {
  const host=useRef<HTMLDivElement>(null),current=useRef(props);
  const api=useRef<{draw:()=>void;fit:()=>void;zoom:(factor:number)=>void}|null>(null);current.current=props;
  useEffect(()=>{
    const root=host.current!,canvas=document.createElement('canvas');
    let renderer:T.WebGLRenderer|null=null,disposed=false,visible=false,drawing=false,raf=0,zoom=1;
    if(!props.plane){try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});}catch{props.onFallback();return;}}
    root.appendChild(canvas);canvas.setAttribute('aria-label','Calculated asymmetric tether and its initial orbital ellipse');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.00001,250);
    const point=(p:number[])=>new T.Vector3(p[0]/EARTH,0,-p[1]/EARTH);
    const controls=renderer?new OrbitControls(camera,canvas):null;
    if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x080b0d,0);}
    if(controls){controls.enableDamping=false;controls.enablePan=false;controls.enableZoom=false;}
    const earth=new T.Mesh(new T.SphereGeometry(1,72,48),new T.MeshPhongMaterial({map:renderer?earthTexture():null,color:0xe5eeee,shininess:12}));
    scene.add(earth,new T.AmbientLight(0x95b4c3,.85));const light=new T.DirectionalLight(0xffeedf,2);light.position.set(-3,4,5);scene.add(light);
    const line=(color:number,dashed=false)=>{const m=dashed?new T.LineDashedMaterial({color,dashSize:.025,gapSize:.02,transparent:true,opacity:.55}):new T.LineBasicMaterial({color,transparent:true,opacity:.85});const l=new T.Line(new T.BufferGeometry(),m);scene.add(l);return l;};
    const reference=line(0xa1b3bd,true),trajectory=line(0xe6a678),cable=line(0xd2e4e5);
    const marker=(color:number,cube=false)=>{const m=new T.Mesh(cube?new T.BoxGeometry(1,1,1):new T.SphereGeometry(1,14,10),new T.MeshBasicMaterial({color}));scene.add(m);return m;};
    const markers=[marker(0xc5b8fa),marker(0xe6edf0,true),marker(0xf5bd85),marker(0x7de7ee)];
    const ellipse=orbitReference(props.result.design);
    const pts=Array.from({length:361},(_,i)=>{const a=i*Math.PI/180,r=ellipse.p/(1+ellipse.e*Math.cos(a));return [r*Math.cos(a),r*Math.sin(a)];});
    reference.geometry.setFromPoints(pts.map(point));reference.computeLineDistances();trajectory.geometry.setFromPoints(props.result.frames.map(f=>point(f.state)));
    const names=['END A','HUB','END B','CENTER OF MASS'];
    const labels=names.map(name=>{const label=document.createElement('span');label.className='gd-world-label';label.textContent=name;label.setAttribute('aria-hidden','true');root.appendChild(label);return label;});
    let fittedMachine:boolean|null=null;
    function request(){if(!raf&&!disposed&&!drawing&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
    function fit(){
      const {result:r,frame:f,machine}=current.current,b=r.body;
      const target=machine?point(f.state):new T.Vector3(-ellipse.a*ellipse.e/EARTH,0,0);
      const reach=Math.max(b.center-b.min,b.max-b.center);
      const radius=machine?reach/EARTH:(ellipse.a+reach)/EARTH;
      const vfov=camera.fov*Math.PI/360,hfov=Math.atan(Math.tan(vfov)*Math.max(.1,camera.aspect));
      const distance=radius/Math.sin(Math.min(vfov,hfov))*1.12;
      if(controls){controls.target.copy(target);camera.position.copy(target).addScaledVector(new T.Vector3(.2,1,.7).normalize(),distance);controls.update();}
      zoom=1;fittedMachine=machine;request();
    }
    function draw(){
      raf=0;if(disposed||!visible||!root.clientHeight||!root.clientWidth||document.hidden)return;drawing=true;
      const {result:r,frame:f,machine}=current.current,b=r.body;
      if(fittedMachine!==machine)fit();
      const states=[geometryPoint(f.state,b,b.min),geometryPoint(f.state,b,0),geometryPoint(f.state,b,b.max),f.state];
      root.dataset.centroidOffset=String(b.center);root.dataset.machineView=String(machine);
      const positions:[number,number][]=[];
      if(renderer&&controls){
        if(machine){const target=point(f.state);camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);}
        cable.geometry.dispose();cable.geometry=new T.BufferGeometry().setFromPoints([point(states[0]),point(states[2])]);
        markers.forEach((m,i)=>{m.position.copy(point(states[i]));const px=2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(m.position)/Math.max(1,root.clientHeight);m.scale.setScalar(px*(i===1?8:i===3?2.5:4));});
        earth.rotation.y=f.t*7.292115e-5+.8;controls.update();renderer.render(scene,camera);
        for(const state of states){const v=point(state).project(camera);positions.push(v.z<1&&v.z>-1?[(v.x+1)*root.clientWidth/2,(1-v.y)*root.clientHeight/2]:[-100,-100]);}
        root.dataset.camera=[...camera.position.toArray(),...controls.target.toArray()].map(v=>v.toFixed(7)).join(',');
      }else{
        const g=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,dpr=Math.min(devicePixelRatio,2);
        const extent=machine?Math.max(b.center-b.min,b.max-b.center)*2.35:(ellipse.a+Math.max(b.center-b.min,b.max-b.center))*2.35;
        const scale=Math.min(w,h)/extent*zoom,ox=machine?f.state[0]:-ellipse.a*ellipse.e,oy=machine?f.state[1]:0;
        const xy=(p:number[])=>[w/2+(p[0]-ox)*scale,h/2-(p[1]-oy)*scale];g.clearRect(0,0,w,h);
        const [ex,ey]=xy([0,0]);const gradient=g.createRadialGradient(ex-EARTH*scale*.3,ey-EARTH*scale*.3,0,ex,ey,EARTH*scale);
        gradient.addColorStop(0,'#2f5769');gradient.addColorStop(1,'#0b1c27');g.fillStyle=gradient;g.beginPath();g.arc(ex,ey,EARTH*scale,0,Math.PI*2);g.fill();g.strokeStyle='#4d7989';g.lineWidth=dpr;g.stroke();
        const stroke=(values:number[][],color:string,dashed=false)=>{g.strokeStyle=color;g.lineWidth=1.3*dpr;g.setLineDash(dashed?[4*dpr,5*dpr]:[]);g.beginPath();values.forEach((p,i)=>{const [x,y]=xy(p);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.setLineDash([]);};
        stroke(pts,'#8599a4',true);stroke(r.frames.map(f=>f.state),'#b88260');stroke([states[0],states[2]],'#deeeee');
        ['#c5b8fa','#e6edf0','#f5bd85','#7de7ee'].forEach((col,i)=>{const [x,y]=xy(states[i]);g.fillStyle=col;g.beginPath();if(i===1)g.rect(x-4*dpr,y-4*dpr,8*dpr,8*dpr);else g.arc(x,y,(i===3?2.5:4)*dpr,0,Math.PI*2);g.fill();positions.push([x/dpr,y/dpr]);});
      }
      const occupied:{x:number;y:number;w:number;h:number}[]=[];
      labels.forEach((label,i)=>{
        label.hidden=true;if(!machine)return;
        const [x,y]=positions[i];if(x<0||x>root.clientWidth||y<0||y>root.clientHeight)return;
        label.hidden=false;const width=label.offsetWidth,tx=Math.max(8,Math.min(root.clientWidth-width-8,x+10));
        for(const offset of [-28,14,-52,38]){const ty=y+offset;
          if(ty<20||ty>root.clientHeight-65||occupied.some(p=>tx<p.x+p.w+3&&tx+width+3>p.x&&ty<p.y+p.h+3&&ty+20+3>p.y))continue;
          label.style.left=`${tx}px`;label.style.top=`${ty}px`;occupied.push({x:tx,y:ty,w:width,h:20});return;}
        label.hidden=true;
      });
      root.dataset.ready='true';root.dataset.renderCount=String(Number(root.dataset.renderCount||0)+1);drawing=false;
    }
    api.current={draw:request,fit,zoom:f=>{const next=Math.max(.3,Math.min(5,zoom/f)),factor=zoom/next;zoom=next;if(controls){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}request();}};
    controls?.addEventListener('change',request);
    const resize=new ResizeObserver(()=>{const b=root.getBoundingClientRect();if(!b.width||!b.height)return;if(renderer){renderer.setSize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();}else{canvas.width=Math.round(b.width*Math.min(devicePixelRatio,2));canvas.height=Math.round(b.height*Math.min(devicePixelRatio,2));}fit();});resize.observe(root);
    const observe=new IntersectionObserver(e=>{visible=e.some(v=>v.isIntersecting);if(visible)request();else{cancelAnimationFrame(raf);raf=0;}});observe.observe(root);
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();};document.addEventListener('visibilitychange',visibility);
    const lost=(e:Event)=>{e.preventDefault();props.onFallback();};canvas.addEventListener('webglcontextlost',lost);
    return()=>{disposed=true;cancelAnimationFrame(raf);api.current=null;resize.disconnect();observe.disconnect();controls?.removeEventListener('change',request);controls?.dispose();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);labels.forEach(l=>l.remove());scene.traverse(o=>{const m=o as T.Mesh;m.geometry?.dispose();if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material]){(mat as T.MeshPhongMaterial).map?.dispose();mat.dispose();}});renderer?.dispose();canvas.remove();};
  },[props.result,props.plane]);
  useEffect(()=>api.current?.draw(),[props.frame,props.machine]);
  return <div className="gd-scene" ref={host} data-renderer={props.plane?'canvas':'webgl'}><div className="gd-camera"><button aria-label="Zoom designer camera in" onClick={()=>api.current?.zoom(.8)}>+</button><button aria-label="Zoom designer camera out" onClick={()=>api.current?.zoom(1.25)}>−</button><button onClick={()=>api.current?.fit()}>Fit design</button></div></div>;
}
