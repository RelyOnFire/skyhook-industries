import * as T from 'three';

export type VehiclePlate='carrier'|'earth-cargo'|'lunar-cargo';
/** Match the orthographic product photographer in scripts/film/render-portraits.py.
 * The meshes and their capture datums stay 3D. Near the photographed angle,
 * a registered plate restores fine finish and self-shadow; other angles use PBR. */
export function portraitCamera(name:VehiclePlate) {
  const plane=name==='carrier',width=plane?108:3.5,aspect=plane?1400/674:1;
  const c=new T.OrthographicCamera(-width/2,width/2,width/2/aspect,-width/2/aspect,.1,2000);
  c.position.copy(plane?new T.Vector3(-44,81,168):new T.Vector3(2,-.15,8));
  c.lookAt(0,plane?1:-1.28,0);c.updateMatrixWorld();
  return {projection:c.projectionMatrix.clone().multiply(c.matrixWorldInverse),
    toward:c.getWorldDirection(new T.Vector3()).negate()};
}
export function registerPortrait(group:T.Group,name:VehiclePlate,texture:T.Texture){
  const {projection,toward}=portraitCamera(name);
  group.traverse(child=>{
    if(!(child instanceof T.Mesh)||!(child.material instanceof T.MeshStandardMaterial))return;
    const material=child.material;
    material.onBeforeCompile=(shader:T.WebGLProgramParametersWithUniforms)=>{
      shader.uniforms.vehiclePrint={value:texture};shader.uniforms.printCamera={value:projection};shader.uniforms.printEye={value:toward};
      shader.vertexShader='uniform mat4 printCamera; uniform vec3 printEye; varying vec2 printUv; varying float printMix;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        printUv=(printCamera*vec4(position,1.)).xy*.5+.5;
        vec3 printView=normalize(mat3(modelViewMatrix)*printEye);
        printMix=smoothstep(.82,.97,printView.z)*smoothstep(.01,.24,dot(normal,printEye));`);
      shader.fragmentShader='uniform sampler2D vehiclePrint; varying vec2 printUv; varying float printMix;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
        vec4 plate=texture2D(vehiclePrint,printUv);
        gl_FragColor.rgb=mix(gl_FragColor.rgb,plate.rgb,printMix*smoothstep(.90,1.,plate.a)*.94);`);
    };
    material.needsUpdate=true;
  });
}
