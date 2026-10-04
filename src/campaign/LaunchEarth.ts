import * as THREE from 'three';

/** Display-only geodetic surface; the launch motion retains its mean-radius model.
 * Axes/radii: NASA Earth Fact Sheet (WGS84). Longitude and geodetic latitude
 * follow the NASA Blue Marble equirectangular map, not a texture-space rotation.
 */
const A=6378.137,B=6356.752314245,e2=1-B*B/(A*A),radians=Math.PI/180;
export const LAUNCH_GEOGRAPHY={latitude:28.5,longitude:-72} as const;
export const LAUNCH_REGION={west:-105,east:-40,south:0,north:55} as const;
type Region={west:number;east:number;south:number;north:number};

function surface(latitude:number,longitude:number,height:number) {
  const lat=latitude*radians,lon=longitude*radians,n=A/Math.sqrt(1-e2*Math.sin(lat)**2);
  return new THREE.Vector3((n+height)*Math.cos(lat)*Math.cos(lon),(n*(1-e2)+height)*Math.sin(lat),-(n+height)*Math.cos(lat)*Math.sin(lon));
}

/** Pickup is +Y in the existing motion plane, with geographic east along +X.
 * The planar orbit is inclined by approximately 28.5° to the Earth equator.
 */
export function launchEarthOrientation() {
  const lon=LAUNCH_GEOGRAPHY.longitude*radians;
  const east=new THREE.Vector3(-Math.sin(lon),0,-Math.cos(lon));
  const radial=surface(LAUNCH_GEOGRAPHY.latitude,LAUNCH_GEOGRAPHY.longitude,0).normalize();
  const normal=east.clone().cross(radial).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,radial,normal).transpose());
}

export function launchEarthGeometry(region:Region={west:-180,east:180,south:-90,north:90},columns=256,rows=128,height=0) {
  const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++) {
    const latitude=region.north-(region.north-region.south)*y/rows,longitude=region.west+(region.east-region.west)*x/columns;
    const lat=latitude*radians,lon=longitude*radians,p=surface(latitude,longitude,height);
    positions.push(p.x,p.y,p.z);
    normals.push(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
    uv.push(x/columns,1-y/rows);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  return geometry;
}
