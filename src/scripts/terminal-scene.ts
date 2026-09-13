import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface TerminalState { exploded:boolean; part:number; rotating:boolean; reduced:boolean }
export interface TerminalRenderer {
  update:(state:TerminalState)=>void; reset:()=>void; setVisible:(visible:boolean)=>void; dispose:()=>void;
}
/** Original, procedural editorial model. No dimensions, mass, current or result
 * is shared with either numerical engine. All motion below is presentation. */
export function mountTerminal(root:HTMLElement, onManualOrbit:()=>void):TerminalRenderer {
  const host=root.querySelector<HTMLElement>('.terminal-canvas-host')!;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setClearColor(0x080b0d,0);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','Illustrative capture terminal. Use component and view buttons, or drag to rotate.');
  host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.03,100);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=false;
  controls.enableZoom=false; // Page scrolling stays ordinary; inspection uses a fitted camera.
  controls.minPolarAngle=.2;controls.maxPolarAngle=Math.PI-.2;
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.07);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xc8e7ed,0x312538,1.9));
  const key=new T.DirectionalLight(0xffd4a6,4.2);key.position.set(-4,6,4);scene.add(key);
  const rim=new T.DirectionalLight(0x83c9d6,3.1);rim.position.set(4,1,-3);scene.add(rim);
  const fill=new T.DirectionalLight(0xa79bcc,1.5);fill.position.set(1,-4,4);scene.add(fill);
  const assembly=new T.Group();assembly.rotation.z=-.17;assembly.rotation.y=.24;scene.add(assembly);
  const groups=[new T.Group(),new T.Group(),new T.Group()];groups.forEach(g=>assembly.add(g));
  const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
  const mat=(color:number,metalness=.65,roughness=.28)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness});materials.add(m);return m;};
  const aluminum=mat(0xc4cfd0,.85,.24),dark=mat(0x18272a,.65,.35),copper=mat(0xc37e45,.82,.24);
  const board=mat(0x154a44,.35,.48),chips=mat(0x121a21,.38,.35),ceramic=mat(0xdfded0,.25,.45),lens=mat(0x235d79,.55,.12);
  const accents=groups.map(()=>{const m=mat(0xd9a165,.72,.25);return m;});
  const mesh=(g:T.Group,geo:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    geometries.add(geo);const m=new T.Mesh(geo,material);m.position.set(x,y,z);g.add(m);return m;
  };
  const box=(g:T.Group,w:number,h:number,d:number,m:T.Material,x=0,y=0,z=0)=>mesh(g,new T.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder=(g:T.Group,r1:number,r2:number,h:number,m:T.Material,y=0,x=0,z=0,n=48)=>mesh(g,new T.CylinderGeometry(r1,r2,h,n),m,x,y,z);
  const ring=(g:T.Group,r:number,t:number,m:T.Material,y=0)=>{const o=mesh(g,new T.TorusGeometry(r,t,10,72),m,0,y,0);o.rotation.x=Math.PI/2;return o;};
  const bar=(g:T.Group,a:T.Vector3,b:T.Vector3,r:number,m:T.Material)=>{const v=b.clone().sub(a),o=mesh(g,new T.CylinderGeometry(r,r,v.length(),8),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;};
  const bolts=(g:T.Group,y:number,r:number,count=8)=>{for(let k=0;k<count;k++){const a=k/count*Math.PI*2; cylinder(g,.032,.032,.06,dark,y,r*Math.cos(a),r*Math.sin(a),6);}};
  // Tether load interface: cable, nested collar, octagonal spreader and fasteners.
  const top=groups[0];
  cylinder(top,.029,.029,.75,dark,1.27);cylinder(top,.022,.022,.76,aluminum,1.27,.008);
  cylinder(top,.20,.30,.38,aluminum,.70,0,0,12);ring(top,.22,.035,accents[0],.86);
  for(const y of [.57,.63,.69,.75])ring(top,.22,.012,dark,y);
  cylinder(top,.48,.57,.14,aluminum,.43,0,0,8);cylinder(top,.51,.51,.065,dark,.33,0,0,8);
  ring(top,.37,.027,copper,.51);bolts(top,.53,.44);
  for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2;
    bar(top,new T.Vector3(.14*Math.cos(a),.70,.14*Math.sin(a)),new T.Vector3(.48*Math.cos(a),.40,.48*Math.sin(a)),.035,aluminum);
  }
  // Guidance bay: open lattice with original stacked avionics illustration.
  const core=groups[1];
  for(const y of [.24,-.68]){cylinder(core,.60,.60,.075,aluminum,y,0,0,8);ring(core,.50,.025,accents[1],y+.045);bolts(core,y+.065,.52);}
  for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2,x=.51*Math.cos(a),z=.51*Math.sin(a);
    cylinder(core,.045,.045,.92,aluminum,-.22,x,z,8);
    const b=a+Math.PI/2;
    bar(core,new T.Vector3(x,.20,z),new T.Vector3(.51*Math.cos(b),-.64,.51*Math.sin(b)),.016,dark);
  }
  const electronics=[new T.Group(),new T.Group(),new T.Group()];
  electronics.forEach((g,i)=>{
    core.add(g);g.position.y=.035-i*.25;
    box(g,.69,.032,.60,board);
    box(g,.19,.07,.18,chips,-.12,.05,.05);box(g,.13,.055,.13,chips,.12,.05,-.11);
    for(let k=0;k<5;k++)box(g,.027,.015,.105,copper,-.24+k*.085,.023,.19);
    for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2;cylinder(g,.018,.018,.12,copper,.07,.38*Math.cos(a),.32*Math.sin(a),8);}
    for(let k=0;k<3;k++)cylinder(g,.035,.035,.11,ceramic,.07,-.21+k*.105,-.18,16);
  });
  // Side radiator and an optical head; no borrowed cubesat panels or NASA marks.
  box(core,.035,.59,.55,dark,-.49,-.21,0);
  for(let i=0;i<8;i++)box(core,.045,.022,.52,aluminum,-.512,-.47+i*.075,0);
  const optical=cylinder(core,.10,.12,.15,dark,-.15,.45,.12,24);optical.rotation.z=Math.PI/2;
  const glass=cylinder(core,.08,.08,.016,lens,-.15,.532,.12,24);glass.rotation.z=Math.PI/2;
  box(core,.20,.37,.035,dark,.10,-.27,.48);box(core,.14,.02,.012,copper,.10,-.20,.505);
  // Capture yoke: open throat, flared guides, actuators and three inward jaws.
  const bottom=groups[2];ring(bottom,.53,.075,aluminum,-.92);ring(bottom,.45,.025,accents[2],-.91);
  ring(bottom,.40,.025,dark,-.84);
  for(let k=0;k<3;k++){
    const a=k/3*Math.PI*2+Math.PI/6,x=Math.cos(a),z=Math.sin(a);
    const mount=box(bottom,.18,.12,.20,dark,x*.50,-1.02,z*.50);mount.rotation.y=-a;
    bar(bottom,new T.Vector3(x*.51,-.84,z*.51),new T.Vector3(x*.66,-1.28,z*.66),.035,aluminum);
    bar(bottom,new T.Vector3(x*.66,-1.28,z*.66),new T.Vector3(x*.37,-1.32,z*.37),.046,copper);
    const jaw=box(bottom,.15,.13,.19,accents[2],x*.37,-1.31,z*.37);jaw.rotation.y=-a;
    bar(bottom,new T.Vector3(x*.45,-.75,z*.45),new T.Vector3(x*.45,-1.02,z*.45),.029,dark);
  }
  bolts(bottom,-.83,.54,6);
  // Faint construction lines connect separated assemblies without fake telemetry.
  const guideGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(0,1.9,0),new T.Vector3(0,-2.4,0)]);
  geometries.add(guideGeometry);const guideMaterial=new T.LineDashedMaterial({color:0x678e94,dashSize:.045,gapSize:.065,transparent:true,opacity:.3});materials.add(guideMaterial);
  const guide=new T.Line(guideGeometry,guideMaterial);guide.computeLineDistances();assembly.add(guide);
  let state:TerminalState={exploded:false,part:0,rotating:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
  let spread=0,targetSpread=0,dirty=true,visible=false,disposed=false,frame=0,last=0,viewLocked=false;
  const request=()=>{dirty=true;if(!frame&&visible&&!document.hidden&&!disposed)frame=requestAnimationFrame(draw);};
  function reset(){
    const size=host.getBoundingClientRect(),aspect=Math.max(.3,size.width/Math.max(1,size.height));
    const distance=Math.max(7.5,5.8/aspect);
    camera.position.copy(new T.Vector3(3.1,2.0,5.7).normalize().multiplyScalar(distance));controls.target.set(0,-.25,0);controls.update();viewLocked=false;request();
  }
  const onChange=()=>request(),onStart=()=>{viewLocked=true;onManualOrbit();};
  controls.addEventListener('change',onChange);controls.addEventListener('start',onStart);
  const resize=new ResizeObserver(()=>{const b=host.getBoundingClientRect();if(!b.width||!b.height)return;renderer.setSize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(!viewLocked)reset();request();});resize.observe(host);
  function draw(now:number){
    frame=0;if(disposed||!visible||document.hidden)return;
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(state.reduced)spread=targetSpread;else spread+=(targetSpread-spread)*Math.min(1,dt*7.5);
    if(Math.abs(spread-targetSpread)<.0005)spread=targetSpread;
    groups[0].position.y=spread*.88;groups[2].position.y=-spread*.82;
    electronics.forEach((g,i)=>g.position.y=.035-i*.25+spread*(.20-i*.16));
    guide.visible=spread>.02;root.dataset.spread=spread.toFixed(4);
    if(state.rotating&&!state.reduced)assembly.rotation.y+=dt*.16;
    accents.forEach((m,i)=>{m.emissive.setHex(i===state.part?0x7a461f:0x000000);m.emissiveIntensity=.22;});
    controls.update();renderer.render(scene,camera);dirty=false;
    root.dataset.renderCount=String(Number(root.dataset.renderCount||0)+1);
    if(spread!==targetSpread||(state.rotating&&!state.reduced))frame=requestAnimationFrame(draw);
  }
  const observe=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);root.dataset.visible=String(visible);last=0;if(visible)request();else if(frame){cancelAnimationFrame(frame);frame=0;}},{threshold:0});observe.observe(host);
  const visibility=()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else request();};document.addEventListener('visibilitychange',visibility);
  const lost=(e:Event)=>{e.preventDefault();root.dataset.renderer='fallback';root.querySelector('[data-terminal-render-status]')!.textContent='Schematic view · graphics unavailable';host.hidden=true;state.rotating=false;onManualOrbit();};
  renderer.domElement.addEventListener('webglcontextlost',lost);
  root.dataset.renderer='webgl';root.querySelector('[data-terminal-render-status]')!.textContent='Drag to inspect · illustrative 3D';reset();
  return {
    update(next){state=next;targetSpread=next.exploded?1:0;if(next.reduced)spread=targetSpread;request();},
    reset(){assembly.rotation.y=.24;reset();},
    setVisible(value){visible=value;last=0;if(value)request();else{cancelAnimationFrame(frame);frame=0;}},
    dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observe.disconnect();document.removeEventListener('visibilitychange',visibility);controls.removeEventListener('change',onChange);controls.removeEventListener('start',onStart);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
