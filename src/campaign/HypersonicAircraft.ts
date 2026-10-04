import * as THREE from 'three';

/** Original cargo carrier: Darkstar/Blackbird-like chines and swept planform,
 * with a slender spaceplane body and paired nacelles. X is forward, Y is up,
 * Z is span. Every part uses this same airframe; no independently tilted wings.
 * Dimensions are enlarged drawing units, not a qualified aircraft design.
 */
export function createHypersonicAircraft() {
  const group=new THREE.Group(),geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const material=(color:string,metalness:number,roughness:number)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;};
  const hull=material('#526570',.3,.48),edge=material('#8397a4',.7,.32),panel=material('#1b2a34',.5,.48),accent=material('#b88764',.55,.4);
  const glass=new THREE.MeshPhysicalMaterial({color:'#14374a',metalness:.25,roughness:.14,clearcoat:1,clearcoatRoughness:.12});materials.push(glass);
  const mesh=(geometry:THREE.BufferGeometry,m:THREE.Material)=>{geometries.push(geometry);const object=new THREE.Mesh(geometry,m);group.add(object);return object;};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m=panel)=>{const object=mesh(new THREE.BoxGeometry(w,h,d),m);object.position.set(x,y,z);return object;};
  type Profile={x:number;w:number;h:number;y:number};
  const loft=(profiles:Profile[],m:THREE.Material,half=false,zOffset=0)=>{
    const curve=new THREE.CatmullRomCurve3(profiles.map(p=>new THREE.Vector3(p.x,p.w,p.h))),centers=new THREE.CatmullRomCurve3(profiles.map(p=>new THREE.Vector3(p.x,p.y,0)));
    const rings=72,segments=32,vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<=rings;i++) {
      const p=curve.getPoint(i/rings),center=centers.getPoint(i/rings);
      for(let j=0;j<=segments;j++) {
        const angle=j/segments*Math.PI*(half?1:2),sin=Math.sin(angle);
        vertices.push(p.x,center.y+Math.max(.015,p.z)*Math.sign(sin)*Math.abs(sin)**.8*(sin<0?.62:1),zOffset+Math.max(.015,p.y)*Math.cos(angle));
      }
    }
    for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(geometry,m);
  };
  const body=[
    {x:-42,w:1.2,h:.7,y:0},{x:-34,w:4.7,h:1.9,y:0},
    {x:-22,w:6.1,h:2.7,y:0},{x:-8,w:5.8,h:3,y:0},
    {x:7,w:4.5,h:2.7,y:0},{x:22,w:2.7,h:1.8,y:0},
    {x:36,w:.75,h:.7,y:0},{x:44,w:.02,h:.02,y:0}
  ];
  loft(body,hull);
  const solid=(points:THREE.Vector3[],thickness:number,m:THREE.Material)=>{
    const vertices=points.flatMap(p=>[p.x,p.y-thickness/2,p.z]).concat(points.flatMap(p=>[p.x,p.y+thickness/2,p.z])),n=points.length,indices:number[]=[];
    const triangles=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.z)),[]);
    for(const [a,b,c] of triangles)indices.push(a,b,c,c+n,b+n,a+n);
    for(let i=0;i<n;i++){const next=(i+1)%n;indices.push(i,next,i+n,next,next+n,i+n);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(geometry,m);
  };
  const trim=(points:THREE.Vector3[],radius=.13)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,radius,5,false),edge);
  for(const side of [-1,1]) {
    const wing=[new THREE.Vector3(18,-.45,side*3.6),new THREE.Vector3(-1,-.45,side*15),new THREE.Vector3(-30,-.45,side*31),new THREE.Vector3(-39,-.45,side*24),new THREE.Vector3(-26,-.45,side*5)];
    solid(wing,.7,hull);trim(wing.slice(0,3));
    trim(body.slice(1,-1).map(p=>new THREE.Vector3(p.x,.1,side*p.w)),.1);
    loft([{x:-40,w:2.7,h:1.8,y:-1.2},{x:-31,w:3.4,h:2.1,y:-1.1},{x:-16,w:3.2,h:1.9,y:-.8},{x:-8,w:2.5,h:1.6,y:-.4}],hull,false,side*11);
    box(-7.6,-.5,side*11,.5,2.6,4.2,panel);box(-39.7,-1.4,side*11,1.3,3.4,6.5,edge);box(-40.4,-1.4,side*11,.3,2.4,5.2,panel);
    // Canted fins share the horizontal wing's actual span and the hull's up axis.
    const fin=new THREE.BufferGeometry(),v=[-39,1.4,side*16,-26,1.4,side*15,-30,10,side*20];
    fin.setAttribute('position',new THREE.Float32BufferAttribute(v,3));fin.setIndex(side<0?[0,1,2]:[2,1,0]);fin.computeVertexNormals();
    const finMaterial=material('#314550',.55,.4);finMaterial.side=THREE.DoubleSide;mesh(fin,finMaterial);
  }
  loft([{x:6,w:.03,h:.03,y:2.72},{x:11,w:2.05,h:1.2,y:2.55},{x:18,w:1.8,h:1.3,y:2.05},{x:25,w:.03,h:.03,y:1.55}],glass,true);
  for(const side of [-1,1])trim([new THREE.Vector3(6,2.75,0),new THREE.Vector3(11,2.55,side*2.05),new THREE.Vector3(18,2.05,side*1.8),new THREE.Vector3(25,1.58,0)],.1);
  // The cargo is carried on a dorsal saddle behind the glazing, not the canopy.
  for(const side of [-1,1])box(0,4.25,side*3.2,6,3,1,edge);
  box(0,6.05,0,8,1.2,8,panel);box(0,6.7,0,7,.18,7,accent);
  const exhaustMaterial=new THREE.MeshBasicMaterial({color:'#ecb084',transparent:true,opacity:.65,depthWrite:false});materials.push(exhaustMaterial);
  const exhaust=[-1,1].map(side=>{const object=mesh(new THREE.ConeGeometry(1.7,16,16),exhaustMaterial);object.rotation.z=Math.PI/2;object.position.set(-48,-1.4,side*11);return object;});
  return {group,exhaust,dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
