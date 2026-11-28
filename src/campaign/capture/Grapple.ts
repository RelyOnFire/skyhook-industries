import * as T from 'three';
import {PIN,pinTip} from '../../visuals/capture-fitting.js';
import {workshop, vec} from '../../visuals/FlightHardware.js';

// The stationary cross rails carry the X bridge. Its travelling carriage carries
// the capture head along Z. Pose and travel use the same metres as the guidance display.
export function makeGrapple() {
  const frame = workshop(), bridge = workshop(), head = workshop();
  const steel = frame.finish('Bare alloy', '#bfcad2', .82, .31);
  const titanium = frame.finish('Titanium', '#6e7981', .72, .36);
  const graphite = frame.finish('Carbon composite', '#222931', .40, .40);
  const gold = frame.finish('Anodized fittings', '#d8a558', .70, .32);
  const porcelain = frame.finish('Thermal covers', '#e6e5db', .24, .49);
  for (const z of [-2.25, 2.25]) {
    frame.box(0,2.60,z,4.95,.20,.16,graphite);
    frame.rod(vec(-2.43,2.46,z),vec(2.43,2.46,z),.057,steel);
    for (const x of [-2.25,2.25]) {
      frame.box(x,2.55,z,.39,.36,.35,porcelain);
      frame.rod(vec(x,2.74,z),vec(x*.11,5.1,z*.11),.054,steel);
      frame.rod(vec(x,2.74,z),vec(-x*.10,4.75,z*.10),.024,titanium);
    }
  }
  for (const x of [-2.25,2.25]) frame.box(x,2.63,0,.12,.19,4.5,titanium);
  for (const x of [-.29,.29]) {
    bridge.rod(vec(x,2.20,-2.38),vec(x,2.20,2.38),.062,steel);
    for (const z of [-2.25,2.25]) bridge.box(x,2.32,z,.28,.26,.34,gold);
  }
  frame.rod(vec(0,4.75,0),vec(0,5.22,0),.37,titanium,.16,32);
  frame.rod(vec(0,5.18,0),vec(0,5.55,0),.16,porcelain,.09);
  frame.rod(vec(0,5.5,0),vec(0,410,0),.070,graphite,.064);
  head.box(0,2.15,0,.88,.29,.72,graphite);
  head.rod(vec(0,1.28,0),vec(0,2.13,0),.46,porcelain,.29,40);
  for (const [y,r,h,m] of [[1.29,.52,.10,steel],[1.44,.47,.09,gold],[1.83,.35,.1,graphite]] as const)
    head.rod(vec(0,y,0),vec(0,y+h,0),r,m,r,48);
  head.rod(vec(0,.95,0),vec(0,1.31,0),.43,graphite,.52,48);
  for (let k=0;k<8;k++) {
    const a=k*Math.PI/4, cx=Math.cos(a), cz=Math.sin(a);
    head.rod(vec(.47*cx,1.30,.47*cz),vec(.32*cx,1.98,.32*cz),.035,steel);
    head.rod(vec(.46*cx,1.37,.46*cz),vec(.46*cx,1.405,.46*cz),.035,gold,.035,6);
  }
  // A clevis leaves an unobstructed slot for the eye. Both bearing sleeves
  // have actual through-holes. The gold pin moves from the rear sleeve into
  // the front receiver, along the normal to the eye.
  const sleeveOuter=.111, sleeveBore=PIN.radius+.007;
  function sleeve(zStart:number,length:number,outer:number,inner:number,finish:T.Material){
    const outline=new T.Shape();outline.absarc(0,0,outer,0,2*Math.PI,false);
    const hole=new T.Path();hole.absarc(0,0,inner,0,2*Math.PI,true);outline.holes.push(hole);
    const g=new T.ExtrudeGeometry(outline,{depth:length,bevelEnabled:false,curveSegments:32});
    head.part(g,finish,vec(0,0,zStart));
  }
  for(const side of [-1,1]){
    const z=side*(PIN.forkHalfGap+PIN.sleeveLength/2);
    // Twin machined ribs flank the bore; their lower ends meet the sleeve wall.
    for(const x of [-1,1]){
      head.rod(vec(x*.22,1.00,z),vec(x*.15,.46,z),.070,titanium,.054);
      head.rod(vec(x*.15,.46,z),vec(x*.080,.068,z),.054,titanium,.037);
      head.rod(vec(x*.22,.99,z-side*.08),vec(x*.22,.99,z+side*.08),.060,steel);
    }
    const lo=side<0?-PIN.forkHalfGap-PIN.sleeveLength:PIN.forkHalfGap;
    sleeve(lo,PIN.sleeveLength,sleeveOuter,sleeveBore,titanium);
    sleeve(side<0?lo-.014:lo+PIN.sleeveLength,.014,.124,sleeveBore,steel);
  }
  // The drive housing stays behind the rear cheek. The receiver is open on
  // the camera side so the inserted tip can be inspected through its bore.
  sleeve(-.78,.43,.096,sleeveBore,graphite);
  for(const z of [-.75,-.60,-.43])sleeve(z,.020,.106,sleeveBore,steel);
  const bolt=workshop();
  bolt.rod(vec(0,0,-.66),vec(0,0,-.018),PIN.radius,gold,PIN.radius,36);
  bolt.rod(vec(0,0,-.018),vec(0,0,0),PIN.radius,gold,PIN.radius*.80,36);
  const mark=bolt.finish('Pin tip witness','#f5bf48',.28,.33);
  bolt.rod(vec(0,0,-.001),vec(0,0,0),PIN.radius*.79,mark,PIN.radius*.79,32);
  frame.bake();bridge.bake();head.bake();bolt.bake();
  const base=new T.Group();base.add(frame.group,bridge.group);bridge.group.add(head.group);head.group.add(bolt.group);
  base.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return {base,pose(x:number,z:number,stroke:number){
    bridge.group.position.x=x;head.group.position.z=z;bolt.group.position.z=pinTip(stroke);
  },dispose(){frame.dispose();bridge.dispose();head.dispose();bolt.dispose();}};
}

// An optical tracking target and a recessed service bay give the operator
// scale references that remain visible as the capture fitting approaches.
export function makeServiceBay() {
  const w=workshop(),silver=w.finish('Fasteners','#b4b9b8',.84,.25),dark=w.finish('Optics','#101820',.53,.27),
    white=w.finish('Optical target','#e4e0ca',.16,.47),gold=w.finish('Connector shell','#c69852',.71,.30);
  w.box(0,-.93,.56,.56,.24,.12,dark);
  w.box(0,-.93,.635,.50,.21,.025,silver);
  for(let x=0;x<4;x++)for(let y=0;y<2;y++)w.box((x-1.5)*.096,-.93+(y-.5)*.095,.655,.096,.095,.012,(x+y)%2?white:dark);
  for(const side of [-1,1]){
    const x=side*.36,z=.645;
    w.rod(vec(x,-2.33,z),vec(x,-2.33,z+.13),.025,silver);
    w.rod(vec(x,-2.33,z+.13),vec(x,-2.05,z+.13),.025,silver);
    w.rod(vec(x,-2.05,z+.13),vec(x,-2.05,z),.025,silver);
  }
  w.box(-.43,-1.63,.61,.18,.57,.095,dark);
  for(let i=0;i<7;i++)w.box(-.43,-1.39-i*.068,.674,.17,.018,.052,silver);
  for(let i=0;i<4;i++)w.rod(vec(.39,-1.39-i*.12,.62),vec(.39,-1.39-i*.12,.68),.037,gold,.037,12);
  w.bake();return w;
}
