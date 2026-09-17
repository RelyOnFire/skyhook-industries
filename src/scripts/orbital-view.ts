import { LAND } from '../lab/land';
const canvas = document.querySelector<HTMLCanvasElement>('#orbital-canvas');
if (canvas) {
 const ctx = canvas.getContext('2d');
 if (ctx) {
 let w=0,h=0,angle=.35,phase=-.7,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,drag=false,lastX=0,lastTime=0,frame=0;
 const pause=document.querySelector<HTMLButtonElement>('#orbit-pause')!;
 const sync=()=>{pause.textContent=paused?'Resume rotation':'Pause rotation';pause.setAttribute('aria-pressed',String(paused));};sync();
 const resize=()=>{const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);};
 const observer=new ResizeObserver(resize);
 const project=(lon:number,lat:number,r:number,cx:number,cy:number)=>{const a=lon*Math.PI/180+angle,b=lat*Math.PI/180;return [cx+r*Math.cos(b)*Math.sin(a),cy-r*Math.sin(b),Math.cos(b)*Math.cos(a)];};
 const render=(time:number)=>{
 const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;if(!paused&&!drag&&!document.hidden){angle+=dt*.045;phase+=dt*.10;}
 ctx.clearRect(0,0,w,h);const cx=w*.57,cy=h*.53,r=Math.min(w*.34,h*.37);
 for(let i=0;i<90;i++){const x=((i*173.71)%997)/997*w,y=((i*97.37)%631)/631*h;ctx.fillStyle=`rgba(190,209,219,${.12+(i%4)*.07})`;ctx.fillRect(x,y,1,1);}
 const halo=ctx.createRadialGradient(cx,cy,r*.85,cx,cy,r*1.22);halo.addColorStop(0,'#4d8b9b00');halo.addColorStop(.48,'#669eaf22');halo.addColorStop(.7,'#6ebdd117');halo.addColorStop(1,'#29435400');ctx.fillStyle=halo;ctx.fillRect(cx-r*1.3,cy-r*1.3,r*2.6,r*2.6);
 const sea=ctx.createRadialGradient(cx-r*.5,cy-r*.55,0,cx,cy,r);sea.addColorStop(0,'#426573');sea.addColorStop(.5,'#18313e');sea.addColorStop(1,'#040a0e');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
 for(const polygon of LAND){ctx.beginPath();let started=false;for(const [lon,lat] of polygon){const [x,y,z]=project(lon,lat,r,cx,cy);if(z>0){if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}else started=false;}ctx.strokeStyle='#8babb773';ctx.lineWidth=.8;ctx.stroke();}
 ctx.strokeStyle='#8fb0c31b';ctx.lineWidth=.7;
 for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let start=false;for(let lon=-180;lon<=180;lon+=2){const [x,y,z]=project(lon,lat,r,cx,cy);if(z>0){if(!start){ctx.moveTo(x,y);start=true;}else ctx.lineTo(x,y);}else start=false;}ctx.stroke();}
 for(let lon=-180;lon<180;lon+=30){ctx.beginPath();let start=false;for(let lat=-90;lat<=90;lat+=2){const [x,y,z]=project(lon,lat,r,cx,cy);if(z>0){if(!start){ctx.moveTo(x,y);start=true;}else ctx.lineTo(x,y);}else start=false;}ctx.stroke();}
 const shadow=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r*.25);shadow.addColorStop(0,'#00000000');shadow.addColorStop(.45,'#00000011');shadow.addColorStop(1,'#000000ed');ctx.fillStyle=shadow;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.restore();
 ctx.beginPath();ctx.ellipse(cx,cy,r*1.4,r*.53,-.45,0,Math.PI*2);ctx.strokeStyle='#a5b8bf55';ctx.lineWidth=1;ctx.stroke();
 const ox=r*1.4*Math.cos(phase),oy=r*.53*Math.sin(phase);
 const tx=cx+ox*Math.cos(-.45)-oy*Math.sin(-.45),ty=cy+ox*Math.sin(-.45)+oy*Math.cos(-.45),spin=phase*2.7+1.1,len=r*.28;
 const ex=tx+Math.cos(spin)*len,ey=ty+Math.sin(spin)*len,fx=tx-Math.cos(spin)*len,fy=ty-Math.sin(spin)*len;
 ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(fx,fy);ctx.strokeStyle='#efede2';ctx.lineWidth=1.7;ctx.stroke();
 for(const [x,y,color,size] of [[ex,ey,'#ff9e68',4],[fx,fy,'#eaf4f4',3],[tx,ty,'#ffffff',2]] as const){ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
 ctx.font='11px ui-monospace, monospace';ctx.fillStyle='#c5d1d7';ctx.fillText('ROTATING TETHER',Math.min(tx+14,w-140),ty-16);
 ctx.strokeStyle='#ff9e6877';ctx.beginPath();ctx.arc(ex,ey,10,0,Math.PI*2);ctx.stroke();frame=requestAnimationFrame(render);
 };
 canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(drag){angle+=(e.clientX-lastX)*.006;lastX=e.clientX;}});
 canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
 pause.addEventListener('click',()=>{paused=!paused;sync();});document.querySelector('#orbit-reset')?.addEventListener('click',()=>{angle=.35;phase=-.7;});
 // A back/forward-cache restore keeps this module's state but does not rerun it.
 // Restart rendering and size observation without resetting the user's view.
 const start=()=>{cancelAnimationFrame(frame);observer.observe(canvas);resize();lastTime=0;frame=requestAnimationFrame(render);};
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();drag=false;});
 window.addEventListener('pageshow',event=>{if(event.persisted) start();});
 start();
 }
}
