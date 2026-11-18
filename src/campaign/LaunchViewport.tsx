import {useEffect,useLayoutEffect,useRef,useState, type ReactNode} from 'react';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export type WorldAssets={load:(path:string,ready:(texture:T.Texture)=>void,color?:boolean,fail?:()=>void)=>void;
  status:(key:string,value:string)=>void};
export type WorldBuilder=(assets:WorldAssets)=>{scene:T.Scene;camera:T.OrthographicCamera;pose:(stage:number,progress:number)=>void;dispose:()=>void};

/** The replay and the offline film set the same world to the same pose.
 * Only this adapter touches browser resources or the player's graphics context. */
export default function LaunchViewport({stage,progress,build,fallback}:{stage:number;progress:number;build:WorldBuilder;fallback:ReactNode}){
  const host=useRef<HTMLDivElement>(null),frame=useRef({stage,progress}),draw=useRef(()=>{});
  frame.current={stage,progress};const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useLayoutEffect(()=>draw.current(),[stage,progress]);
  useEffect(()=>{
    const root=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;root.append(renderer.domElement);
    let disposed=false,lost=false;
    const textures:T.Texture[]=[];
    const world=build({status:(k,v)=>{root.dataset[k]=v;},load:(url,apply,color=true,fail)=>{
      const texture=new T.TextureLoader().load(url,t=>{if(disposed)return;
        if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());apply(t);draw.current();
      },undefined,()=>{if(!disposed){fail?.();draw.current();}});textures.push(texture);
    }});
    // Soft reflections reveal the black forebody and metal fittings without
    // introducing a remote HDR image or changing planetary illumination.
    const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),studio=pmrem.fromScene(room,.045);
    world.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;
      for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial && m.metalness>.1){
        m.envMap=studio.texture;m.envMapIntensity=.72;m.needsUpdate=true;
      }});
    room.dispose();pmrem.dispose();
    draw.current=()=>{if(disposed||lost||!root.clientWidth)return;world.pose(frame.current.stage,frame.current.progress);renderer.render(world.scene,world.camera);};
    const resize=()=>{renderer.setSize(root.clientWidth,root.clientWidth*.62,false);draw.current();};
    const ro=new ResizeObserver(resize);ro.observe(root);
    const loss=(e:Event)=>{e.preventDefault();lost=true;setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',loss);
    resize();setReady(true);
    return()=>{disposed=true;draw.current=()=>{};ro.disconnect();renderer.domElement.removeEventListener('webglcontextlost',loss);
      textures.forEach(t=>t.dispose());world.dispose();studio.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[build]);
  return <div className="departure-visual" data-renderer={ready&&!failed?'webgl':'diagram'}><div ref={host} className="departure-webgl" aria-hidden="true" hidden={!ready||failed}/>{(!ready||failed)&&fallback}</div>;
}
