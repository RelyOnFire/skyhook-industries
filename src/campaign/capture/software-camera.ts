import * as T from 'three';
import {VIEW_LOCATION} from './pass.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {launchEarthOrientation} from '../LaunchEarth.js';

type Photo = { width:number;height:number;data:Uint8ClampedArray };
type DrawMesh = { mesh:T.Mesh; position:T.BufferAttribute|T.InterleavedBufferAttribute;normal:T.BufferAttribute|T.InterleavedBufferAttribute;
  indices:T.BufferAttribute|null; uv:T.BufferAttribute|T.InterleavedBufferAttribute|undefined; plate:Photo|undefined; material:T.MeshStandardMaterial; vertices:Float32Array };
const sun=new T.Vector3(-.8,.64,.4).normalize();
const glToByte=Uint8ClampedArray.from({length:4096},(_,i)=>{
  const x=i/1024;
  const mapped=Math.min(1,(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14));
  return 255*(mapped<=.00313?12.92*mapped:1.055*mapped**(1/2.4)-.055);
});
const encode=(v:number)=>glToByte[Math.min(4095,Math.max(0,Math.round(v*1024)))];
function readPhoto(img:CanvasImageSource,width:number,height:number):Photo {
  const c=document.createElement('canvas');c.width=width;c.height=height;
  const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,width,height);
  return {width,height,data:ctx.getImageData(0,0,width,height).data};
}
const texel=(p:Photo,u:number,v:number)=>4*(Math.min(p.height-1,Math.max(0,Math.floor((1-v)*p.height)))*p.width+
  Math.min(p.width-1,Math.max(0,Math.floor(u*p.width))));

// Depth-tested triangle rasterization for browsers with no graphics context.
// Both camera paths use the same mesh hierarchy, lens, geometry and pass state.
export function makeSoftwareCamera(host:HTMLElement,scene:T.Scene,repaint:()=>void) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Canvas unavailable');
  host.append(canvas);
  let alive=true, width=0,height=0,image:ImageData,depth:Float32Array,planet:Uint8ClampedArray;
  let backgroundKey='',lastRender=-Infinity;
  const photos:(Photo|undefined)[]=[];
  const geo=new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(launchEarthOrientation(VIEW_LOCATION).invert())).elements;
  for(const [i,file] of ['earth.webp','earth-clouds.webp','earth-launch-atlantic.webp'].entries()){
    const img=new Image();
    img.onload=()=>{if(!alive)return;photos[i]=readPhoto(img,img.width,img.height);backgroundKey='';lastRender=-Infinity;repaint();};
    img.src='/textures/'+file;
  }
  // Bilinear geographical sampling keeps clouds and coasts continuous at close range.
  const rgb=new Float32Array(3), cloudPixel=new Float32Array(3);
  function sample(p:Photo,u:number,v:number,out:Float32Array,channels:number){
    const xx=Math.max(0,Math.min(p.width-1.001,u*p.width-.5));
    const yy=Math.max(0,Math.min(p.height-1.001,(1-v)*p.height-.5));
    const x=xx|0,y=yy|0,fx=xx-x,fy=yy-y,i=(y*p.width+x)*4,j=i+p.width*4;
    for(let ch=0;ch<channels;ch++)out[ch]=(1-fy)*((1-fx)*p.data[i+ch]+fx*p.data[i+4+ch])+fy*((1-fx)*p.data[j+ch]+fx*p.data[j+4+ch]);
  }
  const parts:DrawMesh[]=[];
  const compact=new Map<T.BufferGeometry,T.BufferGeometry>();
  scene.traverse(o=>{
    if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
    const original:T.BufferGeometry=o.geometry;
    const g=compact.get(original)??(original.index?original:mergeVertices(original));
    compact.set(original,g);
    const pos=g.getAttribute('position'),pic=o.material.map?.image;
    parts.push({mesh:o,position:pos,normal:g.getAttribute('normal'),indices:g.index,uv:g.getAttribute('uv'),
      plate:pic?readPhoto(pic,pic.width,pic.height):undefined, material:o.material,vertices:new Float32Array(pos.count*8)});
  });
  function earth(camera:T.PerspectiveCamera,tip:{x:number;y:number},angle:number){
    const rot=new T.Matrix4().makeRotationZ(angle);
    const p=camera.position.clone().multiplyScalar(.001).applyMatrix4(rot);p.x+=tip.x;p.y+=tip.y;
    const m=rot.multiply(camera.matrixWorld).elements;
    // A few kilometres of translation leave the same background within one output texel.
    const key=[width,height,Math.round(p.x/2),Math.round(p.y/2),...[0,1,2,4,5,6,8,9,10].map(i=>Math.round(m[i]*900))].join(',');
    if(key===backgroundKey)return;backgroundKey=key;
    const lens=Math.tan(camera.fov*Math.PI/360);
    const globe=photos[0],cloud=photos[1],region=photos[2], radius=6371,eye2=p.lengthSq();
    for(let y=0,k=0;y<height;y++){
      const sy=(1-2*(y+.5)/height)*lens;
      for(let x=0;x<width;x++,k+=4){
        const sx=(2*(x+.5)/width-1)*lens*camera.aspect,inv=1/Math.hypot(sx,sy,1);
        const dx=(m[0]*sx+m[4]*sy-m[8])*inv,dy=(m[1]*sx+m[5]*sy-m[9])*inv,dz=(m[2]*sx+m[6]*sy-m[10])*inv;
        const along=-(p.x*dx+p.y*dy+p.z*dz), impact2=eye2-along*along;
        let r=2,g=4,b=7;
        if(along>0&&impact2<(radius+100)**2){
          const h=Math.sqrt(Math.max(0,impact2))-radius;
          if(h>0){const air=Math.exp(-h/12);r=3+85*air;g=6+144*air;b=12+212*air;}
          else{
            const span=Math.sqrt(Math.max(0,radius*radius-impact2)),dist=along-span;
            const nx=(p.x+dist*dx)/radius,ny=(p.y+dist*dy)/radius,nz=(p.z+dist*dz)/radius;
            const gx=geo[0]*nx+geo[3]*ny+geo[6]*nz,gy=geo[1]*nx+geo[4]*ny+geo[7]*nz,gz=geo[2]*nx+geo[5]*ny+geo[8]*nz;
            const u=Math.atan2(-gz,gx)/(2*Math.PI)+.5,v=Math.asin(Math.max(-1,Math.min(1,gy)))/Math.PI+.5;
            const ru=(u-75/360)/(65/360),rv=(v-.5)/(55/180);
            const local=region&&ru>=0&&ru<1&&rv>=0&&rv<1, source=local?region:globe;
            r=20;g=63;b=92;
            if(source){sample(source,local?ru:u,local?rv:v,rgb,3);r=rgb[0];g=rgb[1];b=rgb[2];}
            if(cloud)sample(cloud,u,v,cloudPixel,1);
            const clouds=cloud?Math.max(0,cloudPixel[0]/255-.12)*.8:0;
            const light=.45+.72*Math.max(0,sun.x*nx+sun.y*ny+sun.z*nz),haze=.62*(1-span/radius)**3.2;
            r=(r+(245-r)*clouds)*light*(1-haze)+100*haze;
            g=(g+(251-g)*clouds)*light*(1-haze)+159*haze;
            b=(b+(255-b)*clouds)*light*(1-haze)+221*haze;
          }
        }
        planet[k]=r;planet[k+1]=g;planet[k+2]=b;planet[k+3]=255;
      }
    }
  }
  function draw(camera:T.PerspectiveCamera,tip:{x:number;y:number},angle:number,force:boolean){
    if(!alive||!host.clientWidth)return;
    const now=performance.now();
    if(!force&&now-lastRender<45)return;
    lastRender=now;
    const ratio=Math.min(1.4,960/host.clientWidth,Math.sqrt(425000/(host.clientWidth*host.clientHeight)));
    const w=Math.max(2,Math.round(host.clientWidth*ratio)),h=Math.max(2,Math.round(host.clientHeight*ratio));
    if(w!==width||h!==height){width=canvas.width=w;height=canvas.height=h;image=ctx!.createImageData(w,h);depth=new Float32Array(w*h);planet=new Uint8ClampedArray(image.data.length);}
    earth(camera,tip,angle);image.data.set(planet);depth.fill(0);
    const pixels=image.data,focal=height/(2*Math.tan(camera.fov*Math.PI/360));
    scene.updateMatrixWorld();
    const view=new T.Matrix4(),cs=Math.cos(angle),sn=Math.sin(angle);
    const sx=cs*sun.x+sn*sun.y,sy=-sn*sun.x+cs*sun.y;
    for(const part of parts){
      const {mesh,position:pos,normal,indices,material,vertices:v,plate,uv}=part;
      const world=mesh.matrixWorld.elements,modelView=view.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld).elements;
      const c=material.color,metal=material.metalness,rough=material.roughness;
      for(let i=0,k=0;i<pos.count;i++,k+=8){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const d=-(modelView[2]*x+modelView[6]*y+modelView[10]*z+modelView[14]);
        v[k+2]=d>.025?1/d:0;
        v[k]=width*.5+(modelView[0]*x+modelView[4]*y+modelView[8]*z+modelView[12])*focal/d;
        v[k+1]=height*.5-(modelView[1]*x+modelView[5]*y+modelView[9]*z+modelView[13])*focal/d;
        const a=normal.getX(i),b=normal.getY(i),e=normal.getZ(i);
        const nx=world[0]*a+world[4]*b+world[8]*e,ny=world[1]*a+world[5]*b+world[9]*e,nz=world[2]*a+world[6]*b+world[10]*e;
        const vx=camera.position.x-(world[0]*x+world[4]*y+world[8]*z+world[12]),vy=camera.position.y-(world[1]*x+world[5]*y+world[9]*z+world[13]),vz=camera.position.z-(world[2]*x+world[6]*y+world[10]*z+world[14]);
        const inv=1/(Math.sqrt(vx*vx+vy*vy+vz*vz)||1),facing=Math.max(0,(nx*vx+ny*vy+nz*vz)*inv);
        const rx=2*facing*nx-vx*inv,ry=2*facing*ny-vy*inv,rz=2*facing*nz-vz*inv;
        const incidence=Math.max(0,nx*sx+ny*sy+nz*sun.z);
        const spec=Math.pow(Math.max(0,rx*sx+ry*sy+rz*sun.z),4+60*(1-rough))*1.8;
        const reflectedEarth=Math.min(1,Math.max(0,(-ry-.12)*5));
        const diff=(.050+1.75*incidence)*(1-.42*metal);
        const gloss=(.035+metal*.69)*(spec+.30*reflectedEarth+.42*Math.exp(-Math.abs(ry+.20)*14));
        v[k+3]=encode(c.r*diff+gloss*(.45+.55*c.r));
        v[k+4]=encode(c.g*diff+gloss*(.55+.45*c.g));
        v[k+5]=encode(c.b*diff+gloss*(.71+.29*c.b));
        if(uv){v[k+6]=uv.getX(i);v[k+7]=uv.getY(i);}
      }
      const count=indices?indices.count:pos.count;
      for(let i=0;i<count;i+=3){
        const a=(indices?indices.getX(i):i)*8,b=(indices?indices.getX(i+1):i+1)*8,c=(indices?indices.getX(i+2):i+2)*8;
        if(!v[a+2]||!v[b+2]||!v[c+2])continue;
        const ax=v[a],ay=v[a+1],bx=v[b],by=v[b+1],cx=v[c],cy=v[c+1];
        const x1=bx-ax,y1=by-ay,x2=cx-ax,y2=cy-ay,area=x1*y2-y1*x2;
        if(area>=-.0001)continue;
        const l=Math.max(0,Math.floor(Math.min(ax,bx,cx))),r=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx)));
        const top=Math.max(0,Math.floor(Math.min(ay,by,cy))),bottom=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
        const du=y2/area,dv=-y1/area;
        for(let yy=top;yy<=bottom;yy++){
          let u=((l+.5-ax)*y2-(yy+.5-ay)*x2)/area,t=(x1*(yy+.5-ay)-y1*(l+.5-ax))/area;
          for(let xx=l,id=yy*w+l;xx<=r;xx++,id++,u+=du,t+=dv){
            const s=1-u-t;if(u<0||t<0||s<0)continue;
            const z=s*v[a+2]+u*v[b+2]+t*v[c+2];if(z<=depth[id])continue;
            depth[id]=z;const k=id*4;
            if(plate){
              const j=texel(plate,s*v[a+6]+u*v[b+6]+t*v[c+6],s*v[a+7]+u*v[b+7]+t*v[c+7]);
              pixels[k]=plate.data[j]*v[a+3]/255;pixels[k+1]=plate.data[j+1]*v[a+4]/255;pixels[k+2]=plate.data[j+2]*v[a+5]/255;
            }else{
              pixels[k]=s*v[a+3]+u*v[b+3]+t*v[c+3];
              pixels[k+1]=s*v[a+4]+u*v[b+4]+t*v[c+4];
              pixels[k+2]=s*v[a+5]+u*v[b+5]+t*v[c+5];
            }
          }
        }
      }
    }
    // Contact shading at neighbouring visible metal surfaces; the depth
    // cutoff prevents the planet or a distant rail from shading the payload.
    for(let y=6;y<h-6;y++)for(let x=6;x<w-6;x++){
      const i=y*w+x,z=depth[i];if(!z)continue;
      const d=1/z;
      let occlusion=0;
      for(const j of [i-5,i+5,i-5*w,i+5*w]){
        const dz=depth[j]>z?d-1/depth[j]:0;
        if(dz>.045&&dz<.75)occlusion+=(1-dz/.75)*.09;
      }
      if(occlusion){const k=i*4,q=1-occlusion;pixels[k]*=q;pixels[k+1]*=q;pixels[k+2]*=q;}
    }
    ctx!.putImageData(image,0,0);
  }
  return {draw,dispose(){alive=false;for(const [original,g] of compact)if(original!==g)g.dispose();canvas.remove();}};
}
