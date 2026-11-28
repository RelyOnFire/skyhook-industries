import * as T from 'three';
import {EYE} from './capture-fitting.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake rigid details by finish. A hundred fittings should not cost a hundred
 * draw calls on a phone. All resources returned here are owned by the caller. */
export function workshop() {
  const group = new T.Group(), buckets = new Map<T.Material,T.BufferGeometry[]>();
  const materials:T.Material[]=[], geometry:T.BufferGeometry[]=[];
  const finish=(name:string,color:string,metalness:number,roughness:number)=>{
    const m=new T.MeshStandardMaterial({name,color,metalness,roughness});materials.push(m);return m;
  };
  const part=(g:T.BufferGeometry,m:T.Material,p=new T.Vector3(),q=new T.Quaternion())=>{
    g.applyQuaternion(q);g.translate(p.x,p.y,p.z);
    const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
    flat.deleteAttribute('uv');if(!flat.getAttribute('normal'))flat.computeVertexNormals();
    if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(flat);
  };
  const rod=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material,r2=r,n=16)=>{
    const v=b.clone().sub(a);part(new T.CylinderGeometry(r2,r,v.length(),n,1),m,a.clone().lerp(b,.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>part(new T.BoxGeometry(w,h,d),m,new T.Vector3(x,y,z));
  const bake=()=>{for(const [m,parts] of buckets){const g=mergeGeometries(parts,false)!;geometry.push(g);parts.forEach(p=>p.dispose());group.add(new T.Mesh(g,m));}buckets.clear();};
  return {group,finish,part,rod,box,bake,dispose:()=>{geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
export const vec=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);

/** Concept cargo canisters share an end fitting, with different blankets and
 * service bays. Origin is the capture fitting; the body extends along -Y. */
export function createFlightCargo(kind:'earth'|'moon') {
  const w=workshop(), lunar=kind==='moon';
  const silver=w.finish('Machined aluminium','#b8c5cb',.68,.32), carbon=w.finish('Recesses','#26313a',.36,.46),
    ceramic=w.finish('Thermal ceramic','#d8d9d0',.17,.46), bronze=w.finish('Copper collar','#b4794e',.6,.36),
    foil=w.finish('Insulation blanket',lunar?'#d1c7ad':'#bd7b43',.52,.41), foilLt=w.finish('Blanket highlights',lunar?'#e0d8bc':'#cd9058',.55,.39);
  const drum=(a:number,b:number,r:number,r2:number,m:T.Material,n=48)=>w.rod(vec(0,-a,0),vec(0,-b,0),r,m,r2,n);
  const at=(d:number,r:number,t:number)=>vec(Math.cos(t)*r,-d,Math.sin(t)*r);
  // A real opening, stepped stem and shoulder give the grip an identifiable mating surface.
  w.part(new T.TorusGeometry(EYE.radius,EYE.tube,20,80),silver);
  drum(EYE.radius,.47,.095,.16,silver);drum(.40,.56,.24,.24,carbon);
  drum(.48,.66,.32,.32,silver);drum(.55,.58,.334,.334,bronze);
  drum(.63,1.05,.30,.705,carbon);drum(.95,1.05,.73,.73,silver);
  const bays=12;
  for(let j=0;j<bays;j++){
    const a=(j+.045)*Math.PI*2/bays,b=(j+.955)*Math.PI*2/bays;
    // Slightly quilted stitched panels; the folds are geometry, visible without textures.
    const v:number[]=[],ix:number[]=[];const seg=8,rows=10;
    for(let k=0;k<=rows;k++)for(let i=0;i<=seg;i++){
      const u=i/seg,s=k/rows,t=a+(b-a)*u;
      const wrinkle=Math.sin(Math.PI*u)*Math.sin(Math.PI*s)*(.022*Math.sin(16*s+6*u+j)+.014*Math.sin(21*u-19*s+j)+.014);
      v.push(...at(1.035+1.37*s,.703+wrinkle,t).toArray());
      if(k&&i){const n=k*(seg+1)+i;ix.push(n-seg-2,n,n-1,n-seg-2,n-seg-1,n);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();w.part(g,j%4===1?foilLt:foil);
    w.rod(at(1.06,.713,a),at(2.40,.713,a),.014,bronze,.014,6);
  }
  // Backing shows only in the seams.
  drum(1.02,2.41,.68,.68,carbon);
  for(const d of [1.05,1.40,2.10,2.38]){
    drum(d,d+.055,.735,.735,d===1.4||d===2.1?carbon:silver,48);
    if(lunar)drum(d+.055,d+.08,.731,.731,bronze);
  }
  drum(2.42,2.58,.73,.62,ceramic,24);drum(2.57,2.68,.59,.58,carbon);
  drum(2.68,2.70,.51,.51,silver);drum(2.70,2.72,.38,.38,carbon);
  for(let i=0;i<8;i++){const t=(i+.5)*Math.PI/4;w.rod(at(2.695,.44,t),at(2.72,.44,t),.028,silver,.028,8);
    w.rod(at(.64,.32,t),at(.99,.69,t),.052,ceramic,.043,10);}
  w.bake();return {group:w.group,dispose:w.dispose};
}
