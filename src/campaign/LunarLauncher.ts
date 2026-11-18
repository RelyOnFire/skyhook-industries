import * as THREE from 'three';
import {createFlightCargo} from '../visuals/FlightHardware.js';
import {LUNAR_BRAKE,LUNAR_RAIL,lunarEase,lunarLaunchFrame} from './lunar-launch-motion.js';

/** Shared geometry keeps the launch axis, bore and actual cargo envelope aligned.
 * Distances are drawing km; the hardware remains deliberately enlarged. */
export const LUNAR_BORE={radius:.46,tube:.035,first:.65,last:LUNAR_RAIL.length-.65} as const;
export function createLunarLauncher(materials:{metal:THREE.Material;dark:THREE.Material;copper:THREE.Material;cargo?:THREE.Material}){
 const {metal,dark,copper}=materials,geometries:THREE.BufferGeometry[]=[];
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
 // The rail kit keeps a narrow, replaceable shoe on the Moon. The sealed
 // cargo canister and its upper capture fitting leave without the sled.
 for(const x of [-.17,.16])for(const side of [-1,1]){
   const shoe=box(sled,.075,.055,.045,x,-.143,side*.096,metal);shoe.rotation.x=side*.43;
 }
 const pod=createFlightCargo('moon');pod.group.scale.setScalar(.185);payload.add(pod.group);
 return {group,payload,sled,coils,brakes,dispose:()=>{pod.dispose();geometries.forEach(g=>g.dispose());}};
}

export function positionLunarCargo(launcher:ReturnType<typeof createLunarLauncher>,frame:ReturnType<typeof lunarLaunchFrame>,stage:number,progress:number){
 const hardware=frame.hardwareScale;
 launcher.payload.scale.setScalar(hardware);launcher.payload.position.set(frame.payload.x,frame.payload.y,0);launcher.payload.rotation.z=frame.payloadAngle;
 if(stage===0)launcher.payload.position.add(new THREE.Vector3(-LUNAR_RAIL.direction.y,LUNAR_RAIL.direction.x,0).multiplyScalar(.35*(1-lunarEase(progress))));
 launcher.sled.position.x=frame.sledDistance-.27;launcher.sled.visible=stage<3;
 return hardware;
}
