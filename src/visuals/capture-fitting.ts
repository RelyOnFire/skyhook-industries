// Metres. The cargo eye lies in XY; the retaining pin runs along Z.
export const EYE = {radius:.26, tube:.070} as const;
export const PIN = {
  radius:.054, forkHalfGap:.215, sleeveLength:.13,
  openTip:-.225, lockedTip:.332, strokeSeconds:.12, seatSeconds:.18,
  // Clearance reserved for the open-loop movement during insertion.
  guard:.012,
} as const;
export const innerRadius=EYE.radius-EYE.tube;
export const pinTip=(fraction:number)=>PIN.openTip+(PIN.lockedTip-PIN.openTip)*Math.max(0,Math.min(1,fraction));
export type Point3={x:number;y:number;z:number};

export function fittingClearance(eye:Point3,head:{x:number;z:number}){
  const dx=eye.x-head.x, dz=eye.z-head.z;
  return {dx,dz,bore:innerRadius-PIN.radius-Math.hypot(dx,eye.y),fork:PIN.forkHalfGap-EYE.tube-Math.abs(dz)};
}

/** The upper inner surface of the hanging eye bears against the pin.
 * Keep the horizontal offsets acquired at interception. */
export function bearingHeight(dx:number){
  return -Math.sqrt(Math.max(0,(innerRadius-PIN.radius)**2-dx*dx));
}
