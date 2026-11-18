import * as T from 'three';
import {workshop,vec} from '../visuals/FlightHardware.js';

/** Original civil cargo carrier, X forward, Y up. The dorsal saddle's working
 * height is the established handoff datum. Shapes are enlarged concept art. */
export function createHypersonicAircraft(){
  const w=workshop(), body=w.finish('Graphite titanium','#292f36',.57,.34),
    chine=w.finish('Chine panels','#3b444a',.58,.34),skin=w.finish('Hot skin','#303941',.55,.37),
    dim=w.finish('Seams and recesses','#151d24',.28,.48),metal=w.finish('Burnished edges','#929b9f',.68,.31),
    bronze=w.finish('Heat-stained alloy','#977963',.58,.37),glass=w.finish('Canopy glass','#254451',.53,.13),
    marking=w.finish('Service stencil','#b7a486',.27,.45);
  // Loft rings around X with a hard lateral chine and a rounded dorsal spine.
  type Section=[number,number,number,number];
  const loft=(s:Section[],m:T.Material,z=0,shape=.72)=>{
    const curve=new T.CatmullRomCurve3(s.map(([x,r,h])=>vec(x,r,h)),false,'centripetal');
    const centers=new T.CatmullRomCurve3(s.map(([x,,,y])=>vec(x,y,0)),false,'centripetal');
    const p:number[]=[],idx:number[]=[],rings=64,sides=48;
    for(let i=0;i<=rings;i++){
      const k=curve.getPoint(i/rings),base=centers.getPoint(i/rings);
      for(let j=0;j<sides;j++){
        const t=j*2*Math.PI/sides,sn=Math.sin(t);
        p.push(k.x,base.y+Math.sign(sn)*Math.abs(sn)**shape*Math.max(.02,k.z)*(sn<0?.75:1),z+Math.max(.02,k.y)*Math.cos(t));
      }
    }
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;idx.push(a,a+sides,b,b,a+sides,b+sides);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();w.part(g,m);
  };
  const strip=(p:T.Vector3[],radius:number,m:T.Material)=>w.part(new T.TubeGeometry(new T.CatmullRomCurve3(p),Math.max(8,p.length*4),radius,6,false),m);
  const triangular=(a:T.Vector3,b:T.Vector3,c:T.Vector3,m:T.Material,normal:T.Vector3)=>{
    const pts=b.clone().sub(a).cross(c.clone().sub(a)).dot(normal)<0?[a,c,b]:[a,b,c];
    const g=new T.BufferGeometry().setFromPoints(pts);g.computeVertexNormals();w.part(g,m);
  };
  loft([[-42,.12,.22,-.15],[-38,2.8,1.15,0],[-28,5.8,2.05,0],[-13,6.0,2.9,0],[-1,5.1,3.12,0],[12,3.95,2.63,.08],[23,2.45,1.72,.12],[36,.87,.78,.12],[45,.03,.05,.18]],body);
  for(const sign of [-1,1]){
    const L=(x:number,y:number,z:number)=>vec(x,y,sign*z);
    // The chine follows the forebody into a swept, cambered lifting surface.
    const stations=[
      [.45,35,-39,.04],[3.2,23,-38,.14],[6.1,11,-37,.72],
      [10.7,-1.3,-37,.55],[15.6,-11,-38,.34],[22,-19,-36,.1],[29,-28,-32,-.16]];
    const lines=stations.map(([z,front,aft,y])=>{const c=Math.min(1,(front-aft)/28);
      return [L(front,y-.25*c,z),L(front*.71+aft*.29,y+.92*c,z),L(front*.24+aft*.76,y+.36*c,z),L(aft,y-.24*c,z)];});
    for(const face of [1,-1]){
      const pts=lines.flat().map(p=>p.clone().add(vec(0,face===1?0:-.36,0))),idx:number[]=[];
      for(let i=1;i<lines.length;i++)for(let j=0;j<3;j++){
        const a=(i-1)*4+j,b=i*4+j,c=b+1,d=a+1;
        for(const [one,two,three] of [[a,b,c],[a,c,d]]){
          const n=pts[two].clone().sub(pts[one]).cross(pts[three].clone().sub(pts[one]));
          idx.push(...(face*n.y>0?[one,two,three]:[one,three,two]));
        }
      }
      const g=new T.BufferGeometry().setFromPoints(pts);g.setIndex(idx);g.computeVertexNormals();w.part(g,face===1?skin:body);
    }
    for(let i=1;i<lines.length;i++){
      w.rod(lines[i-1][0],lines[i][0],.067,chine,.067,8);w.rod(lines[i-1][3],lines[i][3],.062,dim,.062,8);
    }
    strip(lines.slice(3).map(a=>a[2].clone().add(vec(0,.025,0))),.058,dim);
    // Spanwise elevon joins and a fine edge line remain readable in the film.
    for(let i=3;i<lines.length-1;i++)strip(lines[i].slice(2),.056,dim);
    // Flush maintenance panels sit on the actual wing skin, in its local plane.
    const panelAt=(row:number,u:number,v:number)=>{
      const a=lines[row],b=lines[row+1];
      return a[1].clone().lerp(a[2],u).lerp(b[1].clone().lerp(b[2],u),v).add(vec(0,.065,0));
    };
    for(const row of [3,4]){
      const p=(u:number,v:number)=>panelAt(row,u,v);
      const rim=[p(.19,.12),p(.63,.12),p(.63,.60),p(.19,.60),p(.19,.12)];
      for(let k=1;k<rim.length;k++)w.rod(rim[k-1],rim[k],.037,dim,.037,6);
    }
    // Restrained service chevrons, visible from the upper quarter.
    for(let i=0;i<3;i++)w.rod(panelAt(4,.29+i*.085,.22),panelAt(4,.27+i*.085,.47),.080,marking,.080,6);
    const z=sign*12.9;
    const axis=(a:number,b:number,ra:number,rb:number,m:T.Material)=>w.rod(vec(a,.20,z),vec(b,.20,z),ra,m,rb,48);
    // Annular intake and nozzle faces (no cap over the opening).
    const ring=(x:number,r:number,t:number,m:T.Material)=>{
      w.part(new T.TorusGeometry(r,t,10,56),m,vec(x,.2,z),new T.Quaternion().setFromAxisAngle(vec(0,1,0),Math.PI/2));
    };
    loft([[-40,2.8,2.75,.2],[-36.5,3.22,3.13,.2],[-28,3.15,3.08,.2],[-12,2.97,2.93,.2],[-2,2.82,2.80,.2],[2,2.72,2.67,.2]],body,z,1);
    axis(1.45,1.62,2.61,2.61,dim);ring(2,2.62,.16,metal);
    axis(1.56,4.0,1.88,1.40,chine);axis(4,9.6,1.4,.035,body);
    for(const x of [-34,-27,-12,-2.4])ring(x,x===-34?3.05:x===-27?3.02:2.86,.065,x===-34?bronze:dim);
    axis(-40.5,-36.5,2.73,3.18,bronze);
    for(let j=0;j<16;j++){
      const t=j*Math.PI/8,at=(x:number,r:number)=>vec(x,.2+r*Math.cos(t),z+r*Math.sin(t));
      w.rod(at(-40.55,2.75),at(-37,3.15),.080,dim,.055,6);
    }
    axis(-40.56,-40.52,2.57,2.57,dim);ring(-40.57,2.67,.12,metal);ring(-40.62,1.81,.08,bronze);
    // Looking forward from the tail, the crown of each fin lies INBOARD of its root.
    const outline=[[-38.4,2.0],[-22.4,2.55],[-31.7,11.2],[-36.3,11.65]];
    const sides=[-.34,.34].map(d=>outline.map(([x,y])=>L(x,y,12.9-(y-2)*.27+d)));
    for(let f=0;f<2;f++){
      const p=sides[f],n=vec(0,.27,(f?1:-1)*sign);
      triangular(p[0],p[1],p[2],f?chine:skin,n);triangular(p[0],p[2],p[3],f?chine:skin,n);
    }
    for(let j=0;j<4;j++){const k=(j+1)%4,a=sides[0][j],b=sides[1][j],c=sides[1][k],d=sides[0][k];
      const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      triangular(a,b,c,j===1?metal:skin,n);triangular(a,c,d,j===1?metal:skin,n);}
    strip(sides[1].slice(1,3),.09,metal);
    const finAt=(x:number,y:number)=>L(x,y,12.9-(y-2)*.27+.37);
    strip([finAt(-33.3,9.9),finAt(-35.8,3.45)],.07,dim);
    strip([finAt(-35.8,9.5),finAt(-31,9.5)],.16,marking);
  }
  // Tandem glazing: separate windscreens divided by a graphite pressure hoop.
  loft([[6,.08,.06,2.78],[9.5,1.75,.94,2.83],[15.6,2,1.62,2.52],[20,1.72,1.45,2.05],[24.8,.66,.6,1.60],[27,.05,.08,1.3]],glass);
  for(const [x,y,r,h] of [[12,2.7,1.88,1.42],[18,2.23,1.92,1.60]]){
    strip(Array.from({length:15},(_,i)=>{const a=i/14*Math.PI;return vec(x,y+h*Math.sin(a)**.72,r*Math.cos(a));}),.14,dim);
  }
  for(const sign of [-1,1]){
    strip([vec(7,2.75,sign*.3),vec(11,2.7,sign*1.9),vec(18,2.28,sign*1.9),vec(25,1.6,sign*.6)],.11,metal);

    strip([vec(-7,2.6,sign*3.3),vec(-16,2.5,sign*3.1),vec(-23,1.8,sign*3.4)],.065,dim);
  }
  // The cargo socket is faired into the spine, not perched on a platform.
  loft([[-14,.1,.1,2.25],[-9,2.65,1.9,2.35],[-4,3.75,3.45,2.5],[.5,3.8,3.65,2.6],[4.3,3.42,3.05,2.7],[7.6,2,1.7,2.65],[9.7,.12,.14,2.58]],skin);
  w.rod(vec(0,5.85,0),vec(0,6.42,0),3.48,dim,3.18,32);
  w.rod(vec(0,6.42,0),vec(0,6.70,0),3.18,metal,3.0,32);
  w.rod(vec(0,6.70,0),vec(0,6.82,0),2.78,bronze,2.78,32);
  w.bake();
  const flameMaterial=new T.MeshBasicMaterial({color:'#dc9967',transparent:true,opacity:.38,depthWrite:false});
  const flameGeometry=new T.ConeGeometry(1.64,10,24);
  const exhaust=[-1,1].map(side=>{const o=new T.Mesh(flameGeometry,flameMaterial);o.rotation.z=Math.PI/2;o.position.set(-45.4,.20,side*12.9);w.group.add(o);return o;});
  return {group:w.group,exhaust,dispose:()=>{w.dispose();flameGeometry.dispose();flameMaterial.dispose();}};
}
