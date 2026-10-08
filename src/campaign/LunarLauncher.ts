import * as THREE from 'three';
import {LUNAR_BRAKE,LUNAR_RAIL,lunarEase,lunarLaunchFrame} from './lunar-launch-motion.js';

/** Shared geometry keeps the launch axis, bore and actual cargo envelope aligned.
 * Distances are drawing km; the hardware remains deliberately enlarged. */
export const LUNAR_BORE={radius:.46,tube:.035,first:.65,last:LUNAR_RAIL.length-.65} as const;
export function createLunarLauncher(materials:{metal:THREE.Material;dark:THREE.Material;copper:THREE.Material;cargo?:THREE.Material}){
 const {metal,dark,copper,cargo=metal}=materials,geometries:THREE.BufferGeometry[]=[];
 const group=new THREE.Group(),payload=new THREE.Group(),sled=new THREE.Group();group.add(sled);
 group.position.set(LUNAR_RAIL.start.x,LUNAR_RAIL.start.y,0);group.rotation.z=Math.atan2(LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x);
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{geometries.push(g);const o=new THREE.Mesh(g,m);parent.add(o);return o;};
 const box=(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m=metal)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),m,p);o.position.set(x,y,z);return o;};
 // Everything travels through the centre of the coil bore. Rail and sled also
 // fit inside it; neither the housing nor a vertical support crosses the bore.
 box(group,LUNAR_RAIL.length+1.4,.08,.45,(LUNAR_RAIL.length+1)/2,-.3,0,dark);
 for(const z of [-.17,.17])box(group,LUNAR_RAIL.length+1.4,.04,.045,(LUNAR_RAIL.length+1)/2,-.24,z,metal);
 const coils=Array.from({length:25},(_,i)=>{
  const x=LUNAR_BORE.first+i/24*(LUNAR_BORE.last-LUNAR_BORE.first);
  const coil=mesh(new THREE.TorusGeometry(LUNAR_BORE.radius,LUNAR_BORE.tube,12,48),copper,group);
  coil.rotation.y=Math.PI/2;coil.position.x=x;return coil;
 });
 // Exposed brake packs leave a clear view of the separating cargo and sled.
 const brakes=Array.from({length:9},(_,i)=>{
  const pack=new THREE.Group();group.add(pack);pack.position.x=LUNAR_RAIL.length+i/8*LUNAR_BRAKE.distance;
  for(const z of [-.17,.17])box(pack,.035,.045,.065,0,-.245,z,copper);
  return pack;
 });
 box(sled,.54,.1,.32,0,-.205,0,dark);
 for(const z of [-.12,.12]){box(sled,.48,.025,.045,0,-.14,z,copper);box(sled,.5,.04,.035,0,-.215,z,metal);}
 box(payload,.28,.4,.24,0,-.27,0,cargo);box(payload,.29,.07,.25,0,-.28,0,copper);
 box(payload,.015,.16,.08,.147,-.28,0,dark);
 box(payload,.11,.12,.012,0,-.4,.126,dark);
 for(const x of [-.12,.12])box(payload,.015,.4,.25,x,-.27,0,metal);
 const stem=mesh(new THREE.CylinderGeometry(.022,.022,.07,12),metal,payload);stem.position.y=-.035;
 mesh(new THREE.TorusGeometry(.055,.018,12,32),copper,payload);
 return {group,payload,sled,coils,brakes,dispose:()=>geometries.forEach(g=>g.dispose())};
}

export function positionLunarCargo(launcher:ReturnType<typeof createLunarLauncher>,frame:ReturnType<typeof lunarLaunchFrame>,stage:number,progress:number){
 const hardware=frame.hardwareScale;
 launcher.payload.scale.setScalar(hardware);launcher.payload.position.set(frame.payload.x,frame.payload.y,0);launcher.payload.rotation.z=frame.payloadAngle;
 if(stage===0)launcher.payload.position.add(new THREE.Vector3(-LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x,0).multiplyScalar(.35*(1-lunarEase(progress))));
 launcher.sled.position.x=frame.sledDistance-.27;launcher.sled.visible=stage<3;
 return hardware;
}
