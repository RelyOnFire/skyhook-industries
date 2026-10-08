export type Planet = 'earth' | 'moon' | 'mars' | 'mercury' | 'ceres' | 'phobos';
export const planetDisc = (body:Planet) => `/planets/${body}.webp`;

/** Pre-rendered spheres share the studios' surface maps without adding WebGL to the game. */
export default function PlanetDisc({body,cx,cy,r,loadImage=true}:{body:Planet;cx:number;cy:number;r:number;loadImage?:boolean}) {
  return <g className="planet-disc" data-planet={body}>
    {body!=='phobos'&&<circle cx={cx} cy={cy} r={r} fill={body==='earth'?'#0d202c':'#252729'}/>}
    <image href={loadImage?planetDisc(body):undefined} x={cx-r} y={cy-r} width={2*r} height={2*r} aria-hidden="true"/>
  </g>;
}
