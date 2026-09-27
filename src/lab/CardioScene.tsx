import {useMemo} from 'react';
import {EARTH} from '../simulation/engine.js';
import {cardioBody,cardioPoint,cardioSample,type CardioResult} from '../simulation/cardio.js';
export default function CardioScene({result,time,loaded,reference}:{result:CardioResult;time:number;loaded:boolean;reference:boolean}){
  const geometry=useMemo(()=>{
    const empty=cardioBody(result.design,false),cargo=cardioBody(result.design,true),d=result.design;
    const ra=EARTH+d.apogeeKm*1000,rp=EARTH+d.perigeeKm*1000,a=(ra+rp)/2,e=(ra-rp)/(ra+rp),b=a*Math.sqrt(1-e*e);
    const ideal=Array.from({length:721},(_,i)=>{const t=i/720*result.period,M=Math.PI+2*Math.PI*t/result.period;let E=M;for(let j=0;j<10;j++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));const angle=Math.PI+d.phaseDeg*Math.PI/180+d.spinRatio*2*Math.PI*t/result.period,u=empty.length-empty.center;return [a*(e-Math.cos(E))+u*Math.cos(angle),-b*Math.sin(E)+u*Math.sin(angle)];});
    const paths=[result.empty,result.loaded].map((r,i)=>r.frames.map(f=>cardioPoint(f.state,i?cargo:empty,(i?cargo:empty).length)));
    const points=[...ideal,...paths.flat(),...result.empty.frames.flatMap(f=>[cardioPoint(f.state,empty,0),cardioPoint(f.state,empty,empty.length)]),...result.loaded.frames.flatMap(f=>[cardioPoint(f.state,cargo,0),cardioPoint(f.state,cargo,cargo.length)])];
    const extent=Math.max(EARTH*1.25,...points.map(p=>Math.max(Math.abs(p[0]),Math.abs(p[1]))))*1.13;
    return {empty,cargo,ideal,paths,extent};
  },[result]);
  const {empty,cargo,paths,ideal,extent}=geometry,body=loaded?cargo:empty,coast=loaded?result.loaded:result.empty,frame=cardioSample(coast,time);
  // Equal x/y scale keeps the geometry and planetary clearance undistorted.
  const scale=270/extent,xy=(v:number[])=>[400+v[0]*scale,310-v[1]*scale],points=(v:number[][])=>v.map(q=>xy(q).join(',')).join(' ');
  const hub=xy(cardioPoint(frame.state,body,0)),tip=xy(cardioPoint(frame.state,body,body.length)),com=xy(frame.state),earth=EARTH*scale;
  return <svg className="cardio-scene" viewBox="0 0 800 620" role="img" aria-label={(loaded?'After ideal pickup':'Empty tether')+' in the orbital plane; actual and prescribed-spin paths'} data-time={frame.t.toFixed(2)}>
    <defs><radialGradient id="cardio-earth" cx="30%" cy="30%"><stop stopColor="#3c6979"/><stop offset=".65" stopColor="#1c3544"/><stop offset="1" stopColor="#0d1821"/></radialGradient></defs>
    <circle cx="400" cy="310" r={(EARTH+120000)*scale} fill="none" stroke="#af865b" strokeDasharray="2 5" opacity=".7"/>
    <circle cx="400" cy="310" r={earth} fill="url(#cardio-earth)" stroke="#618696" strokeWidth=".7"/>
    <ellipse cx="400" cy="310" rx={earth*.45} ry={earth} fill="none" stroke="#8aa6ad" opacity=".12"/><ellipse cx="400" cy="310" rx={earth} ry={earth*.3} fill="none" stroke="#8aa6ad" opacity=".12"/>
    <text x="400" y="315" textAnchor="middle" fill="#9eb6bf" fontSize="12" letterSpacing="4">EARTH</text>
    {reference&&<polyline points={points(ideal)} fill="none" stroke="#c7bca5" strokeDasharray="5 6" opacity=".4" strokeWidth="1.5"/>}
    {paths.map((v,i)=><polyline key={i} points={points(v)} fill="none" stroke={i?'#efa477':'#9ec3cc'} strokeWidth={loaded===!!i?2.1:1} opacity={loaded===!!i?.9:.35}/>)}
    <line x1={hub[0]} y1={hub[1]} x2={tip[0]} y2={tip[1]} stroke="#f0d2aa" strokeWidth="3"/>
    <rect x={hub[0]-5} y={hub[1]-5} width="10" height="10" fill="#dce3dc"/>
    <circle cx={com[0]} cy={com[1]} r="4" fill="#0d1821" stroke="#e0e6dd"/>
    <circle cx={tip[0]} cy={tip[1]} r={loaded?5:3} fill={loaded?'#efa477':'#a6d2db'}/>
    <text x={hub[0]+10} y={hub[1]-10} fill="#dce3dc" fontSize="10">STATION</text>
    <text x={tip[0]+10} y={tip[1]+16} fill="#edb587" fontSize="10">{loaded?'CARGO + TIP':'EMPTY TIP'}</text>
    <text x="24" y="28" fill="#9aaeb7" fontSize="10" letterSpacing="2">EARTH INERTIAL / ORBITAL PLANE</text>
    <text x="24" y="594" fill="#9aaeb7" fontSize="11">Solid paths: integrated motion · dashed: prescribed-spin reference</text>
  </svg>;
}
