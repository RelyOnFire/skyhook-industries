import * as T from 'three';
import {VIEW_LOCATION} from './pass.js';
import {launchEarthOrientation} from '../LaunchEarth.js';

// Trace the distant Earth in km, then render the nearby hardware in metres.
// This avoids putting jaw-sized clearances and an entire planet in the same depth buffer.
export function makeOrbitalBackground(renderer:T.WebGLRenderer, repaint:()=>void) {
  const scene=new T.Scene(), camera=new T.Camera(), geometry=new T.PlaneGeometry(2,2);
  const textures:T.Texture[]=[];
  const uniforms={
    eye:{value:new T.Vector3()}, cameraBasis:{value:new T.Matrix3()}, lens:{value:new T.Vector2()},
    geographic:{value:new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(launchEarthOrientation(VIEW_LOCATION).invert()))},
    sun:{value:new T.Vector3(-.8,.64,.4).normalize()},
    albedo:{value:null as T.Texture|null}, cloudMap:{value:null as T.Texture|null}, atlantic:{value:null as T.Texture|null},
    loaded:{value:new T.Vector3()},
  };
  const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 screen; void main(){screen=position.xy;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      varying vec2 screen; uniform vec2 lens; uniform mat3 cameraBasis,geographic;
      uniform vec3 sun,eye,loaded; uniform sampler2D albedo,cloudMap,atlantic;
      vec2 geo(vec3 n){vec3 g=geographic*n;return vec2(atan(-g.z,g.x)/6.2831853+.5,asin(clamp(g.y,-1.,1.))/3.14159265+.5);}
      void main(){
        vec3 ray=normalize(cameraBasis*vec3(screen*lens,-1.));
        float along=-dot(eye,ray);
        float impact=length(cross(eye,ray));
        float R=6371.;
        vec3 col=vec3(.0007,.0011,.0020);
        if(along>0. && impact<R+110.){
          float h=max(0.,impact-R);
          vec3 nearest=normalize(eye+ray*along);
          float sunlight=smoothstep(-.14,.32,dot(nearest,sun));
          vec3 air=mix(vec3(.19,.051,.018),vec3(.11,.39,.89),sunlight);
          if(impact<=R){
            vec3 n=normalize(eye+ray*(along-sqrt(max(0.,R*R-impact*impact))));
            vec2 uv=geo(n);
            vec3 base=mix(vec3(.028,.10,.19),texture2D(albedo,uv).rgb,loaded.x);
            vec2 region=(uv-vec2(75./360.,.5))/vec2(65./360.,55./180.);
            vec2 edge=min(region,1.-region);
            base=mix(base,texture2D(atlantic,clamp(region,0.,1.)).rgb,loaded.z*smoothstep(0.,.02,min(edge.x,edge.y)));
            vec3 nc=normalize(eye+ray*(along-sqrt(max(0.,6377.*6377.-impact*impact))));
            float cloud=smoothstep(.12,.82,texture2D(cloudMap,geo(nc)).r)*loaded.y;
            float day=max(0.,dot(n,sun));
            base=mix(base,vec3(.97,.985,1.),cloud*.87)*(.10+1.35*day);
            float grazing=pow(1.-max(0.,dot(n,-ray)),3.2);
            col=mix(base,air,grazing*(.27+.57*sunlight));
          }else{
            float density=exp(-h/10.8);
            col+=air*density*(.23+.75*sunlight);
            col+=vec3(.05,.12,.36)*exp(-h/23.)*sunlight;
          }
        }
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
  let alive=true;
  const loader=new T.TextureLoader();
  for (const [index,key,path] of [[0,'albedo','earth.webp'],[1,'cloudMap','earth-clouds.webp'],[2,'atlantic','earth-launch-atlantic.webp']] as const) {
    textures.push(loader.load('/textures/'+path,texture=>{
      if(!alive)return;
      if(key!=='cloudMap') texture.colorSpace=T.SRGBColorSpace;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      uniforms[key].value=texture;uniforms.loaded.value.setComponent(index,1);repaint();
    }));
  }
  return {draw(view:T.PerspectiveCamera,tip:{x:number;y:number},angle:number){
    const rotation=new T.Matrix4().makeRotationZ(angle);
    uniforms.eye.value.copy(view.position).multiplyScalar(.001).applyMatrix4(rotation).add(new T.Vector3(tip.x,tip.y,0));
    uniforms.cameraBasis.value.setFromMatrix4(rotation.multiply(view.matrixWorld));
    const half=Math.tan(T.MathUtils.degToRad(view.fov)/2);
    uniforms.lens.value.set(half*view.aspect,half);
    renderer.render(scene,camera);
  },dispose(){alive=false;textures.forEach(t=>t.dispose());geometry.dispose();material.dispose();}};
}
