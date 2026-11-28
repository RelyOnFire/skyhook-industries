"""Grade the shared launch worlds offline at 24 fps, preserving the approved
narration and the unmodified chapters of the previous edit. Requires
moderngl, glcontext, NumPy, Pillow, ffmpeg and a desktop EGL implementation.
Run export-worlds.ts first; see the storyboard for the reproducible commands.
"""
import argparse, json, math, subprocess
from pathlib import Path
import moderngl as gl
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
FPS=24
VERT="""#version 330
uniform mat4 vp,model;
uniform vec2 framing;uniform mat4 printCamera;uniform vec3 printEye,eye;out vec2 pUv;out float pMix;
in vec3 pos,norm;in vec2 uv;
out vec3 N;out vec2 UV;
void main(){
 vec4 p=vp*model*vec4(pos,1.);
 p.xy*=vec2(framing.x*.9073,framing.x);p.x+=framing.y*p.w;
 gl_Position=p; pUv=(printCamera*vec4(pos,1.)).xy*.5+.5;
 pMix=smoothstep(.82,.97,dot(normalize(mat3(model)*printEye),eye))*smoothstep(.01,.24,dot(norm,printEye));
 N=mat3(transpose(inverse(model)))*norm; UV=uv;
 gl_PointSize=1.25;
}"""
FRAG="""#version 330
in vec3 N;in vec2 UV;out vec4 outputColor;
uniform vec3 col,eye,emission;uniform vec4 surface;
in vec2 pUv;in float pMix;uniform int hasPrint;uniform sampler2D portrait;uniform int texMode,basic;uniform sampler2D tex;
float card(vec3 r,vec3 n,float exponent){return pow(max(dot(r,normalize(n)),0.),exponent);}
void main(){
 vec3 albedo=col;float opacity=surface.z;
 if(texMode==1) albedo*=pow(texture(tex,UV).rgb,vec3(2.2));
 if(texMode==2) opacity*=texture(tex,UV).g;
 if(opacity<.002)discard;
 vec3 n=normalize(N),v=normalize(eye),l=normalize(vec3(-.45,.74,1.)),r=reflect(-v,n);
 if(!gl_FrontFacing)n=-n;
 float metal=surface.x,rough=surface.y;
 float light=max(dot(l,n),0.),rim=max(dot(n,normalize(vec3(.75,.53,-.9))),0.);
 vec3 shaded=albedo;
 if(basic==0){
   vec3 diffuse=albedo*(.27+.17*(n.y*.5+.5)+1.28*light+.28*rim);
   float angle=clamp(1.-max(dot(n,v),0.),0.,1.);
   vec3 F=mix(vec3(.045),albedo,metal);F+=(1.-F)*pow(angle,5.);
   float sky=clamp((r.y+.3)*.60,0.,1.);
   vec3 reflected=mix(vec3(.055,.075,.10),vec3(.46,.55,.65),sky);
   reflected+=vec3(2.65,2.5,2.22)*card(r,vec3(-.63,.90,.37),mix(85.,6.,rough));
   reflected+=vec3(1.3,1.7,2.)*card(r,vec3(.23,.75,-.76),mix(62.,8.,rough));
   vec3 key=vec3(1.,.92,.83)*pow(max(dot(n,normalize(v+l)),0.),mix(140.,14.,rough))*(1.3-rough);
   shaded=diffuse*(1.-.66*metal)+(reflected+key)*F+emission;
   if(texMode!=0)shaded=albedo*(.32+.95*light); // geography is diffuse, not polished hardware
 }
 vec3 c=max(shaded,vec3(0));c=c/(1.+c*.47);
 vec3 srgb=pow(c,vec3(1./2.2));
 if(hasPrint==1){vec4 plate=texture(portrait,pUv);srgb=mix(srgb,plate.rgb,pMix*smoothstep(.9,1.,plate.a)*.96);}
 outputColor=vec4(srgb,opacity);
}"""

class Stage:
 def __init__(self,data,base,width,height):
  self.c=gl.create_standalone_context(backend='egl');self.w,self.h=width,height;self.data=data;self.base=base
  self.buf=self.c.simple_framebuffer((width,height),components=4,samples=4)
  self.flat=self.c.simple_framebuffer((width,height),components=4)
  self.program=self.c.program(vertex_shader=VERT,fragment_shader=FRAG)
  self.c.enable(gl.DEPTH_TEST|gl.BLEND|gl.PROGRAM_POINT_SIZE);self.c.blend_func=(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
  self.c.depth_func='<=';self.vaos={};self.tex={};self.state={}
 def geometry(self,g):
  if g not in self.vaos:
   v=self.c.buffer((self.base/f'g{g}').read_bytes());idx=self.c.buffer((self.base/f'i{g}').read_bytes()) if self.data['geos'][g]['index'] else None
   self.vaos[g]=self.c.vertex_array(self.program,[(v,'3f 3f 2f','pos','norm','uv')],idx)
  return self.vaos[g]
 def texture(self,url,unit=0):
  if url not in self.tex:
   img=Image.open(ROOT/'public'/url.lstrip('/')).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
   t=self.c.texture(img.size,4,img.tobytes(),alignment=1);t.build_mipmaps();t.filter=(gl.LINEAR_MIPMAP_LINEAR,gl.LINEAR);t.anisotropy=8;t.repeat_x=False;t.repeat_y=False;self.tex[url]=t
  self.tex[url].use(unit)
 def update(self,world,f):
  st=self.state.setdefault(id(world),{});st.update(f['updates'])
 def draw(self,world,f,portrait=False):
  st=self.state[id(world)];self.buf.use();self.buf.depth_mask=True
  self.buf.clear(0,0,0,0) if portrait else self.buf.clear(.028,.047,.061,1.)
  p=self.program;p['vp'].write(np.asarray(f['cam'],dtype='f4').tobytes());p['eye'].value=f['eye'];p['framing'].value=(f['scale']*(1/.9073 if portrait else 1),f['shift'])
  by_order=[]
  for i,o in enumerate(world['objects']):
   if not st.get(i):continue
   m,matrix,alpha,depth=st[i];mat=self.data['mats'][m]
   by_order.append(((o['order'],int(alpha<.999 or bool(mat.get('alpha')))),o,mat,matrix,alpha,depth))
  for _,o,m,matrix,alpha,depth in sorted(by_order,key=lambda x:x[0]):
   p['model'].write(np.asarray(matrix,dtype='f4').tobytes());p['col'].value=m['color'];p['emission'].value=m['emissive'];p['surface'].value=(m['metal'],m['rough'],alpha,0);p['basic'].value=int(m['basic'])
   url=m.get('map') or m.get('alpha');p['texMode'].value=1 if m.get('map') else 2 if m.get('alpha') else 0
   if url:self.texture(url)
   plate=o.get('plate');p['hasPrint'].value=int(bool(plate));p['portrait'].value=1
   if plate:
    ref=self.data['prints'][plate];self.texture('/vehicles/'+plate+'.webp',1)
    p['printEye'].value=ref['eye'];p['printCamera'].write(np.asarray(ref['vp'],dtype='f4').tobytes())
   if o['kind']=='mesh' and not m['double']:self.c.enable(gl.CULL_FACE)
   else:self.c.disable(gl.CULL_FACE)
   self.buf.depth_mask=bool(depth);self.geometry(o['g']).render({'mesh':gl.TRIANGLES,'line':gl.LINE_STRIP,'points':gl.POINTS}[o['kind']])
  self.c.copy_framebuffer(self.flat,self.buf)
  mode='RGBA' if portrait else 'RGB'
  return Image.frombytes(mode,(self.w,self.h),self.flat.read(components=len(mode),alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)

font='/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
mono='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
def title_card(shot):
 im=Image.new('RGBA',(1280,720));d=ImageDraw.Draw(im)
 titles={'opening':('Speed.\nAs well as height.','An aircraft supplies\nthe first part of the climb.'),
        'earth':('Meet. Match.\nSecure.','Position, speed and timing\nhave to align.'),
        'release':('Swing. Release.\nThen coast.','Energy moves from\ntether to payload.'),
        'moon':('A different world.\nThe same idea.','On the Moon, a mass driver\nsupplies the first impulse.')}
 # Editorial scrim protects the text without placing a rectangular card over the horizon.
 x=np.arange(1280)[None,:];y=np.arange(720)[:,None]
 a=np.maximum(.81*np.clip(1-x/660,0,1)*np.clip(1.42-y/600,0,1),.58*np.clip((y-595)/125,0,1))
 v=np.empty((720,1280,4),np.uint8);v[:,:,:3]=[8,16,21];v[:,:,3]=(255*a).astype(np.uint8);im=Image.fromarray(v);d=ImageDraw.Draw(im)
 def text(x,y,s,f,size,fill):d.multiline_text((x,y),s,font=ImageFont.truetype(f,size),fill=fill,spacing=1,stroke_width=0)
 text(58,42,'SKYHOOK INDUSTRIES / AN INTRODUCTION',mono,13,'#e2a37e')
 text(55,80,titles[shot][0],font,53,'#f0f4f5');text(58,218,titles[shot][1],font,19,'#c5d1d5')
 if shot in ('earth','moon'):
  # A separately labelled hardware plate gives the cargo a readable scale
  # while the live scene still shows the actual position inside the sequence.
  lunar=shot=='moon';name='lunar-cargo' if lunar else 'earth-cargo'
  card=Image.new('RGBA',(224,214),(10,19,25,210));cd=ImageDraw.Draw(card)
  cd.line((0,0,224,0),fill='#7d8789',width=1);cd.text((12,10),'LUNAR CANISTER' if lunar else 'EARTH CARGO BUS',font=ImageFont.truetype(mono,12),fill='#e0ae8a')
  portrait=Image.open(ROOT/'public/vehicles'/(name+'.webp')).convert('RGBA').resize((171,171),Image.Resampling.LANCZOS)
  card.alpha_composite(portrait,(26,29));cd.text((12,191),'HARDWARE DETAIL',font=ImageFont.truetype(mono,10),fill='#9cabb4')
  im.alpha_composite(card,(58,348))
 text(58,678,('LUNAR MASS DRIVER' if shot=='moon' else 'EARTH ACCESS CONCEPT')+'  /  HARDWARE ENLARGED',mono,11,'#bdccd2')
 mark=Image.open(ROOT/'public/brand/comet-mark.png').convert('RGBA').resize((25,25),Image.Resampling.LANCZOS);im.alpha_composite(mark,(1024,673));text(1057,679,'SKYHOOK INDUSTRIES',mono,12,'#d8e1e4')
 return im

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base',type=Path,default=ROOT/'qa/vehicle-film');ap.add_argument('--source',type=Path);ap.add_argument('--encode',action='store_true');args=ap.parse_args()
 base=args.base;data=json.loads((base/'scenes.json').read_text());time=json.loads((ROOT/'docs/storyboards/skyhook-introduction.timings.json').read_text())
 stage=Stage(data,base,1280,720);frames={f['i']:(w,f) for w in data['worlds'].values() for f in w['frames']}
 cards={k:title_card(k) for k in ('opening','earth','release','moon')}
 count=round(time['duration']*FPS);poster=round(32*FPS);proof={round(t*FPS) for t in [2,6,25,30,32,35,41,46,61,63,65,67,69]}
 if args.encode:
  if not args.source:ap.error('--encode needs the previous edit as --source')
  inp=subprocess.Popen(['ffmpeg','-loglevel','error','-threads','2','-i',str(args.source),'-map','0:v:0','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE)
  enc=subprocess.Popen(['ffmpeg','-loglevel','error','-y','-framerate','24','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-i','-','-i',str(args.source),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','4','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(base/'introduction.mp4')],stdin=subprocess.PIPE)
 for i in range(count):
  raw=inp.stdout.read(1280*720*3) if args.encode else None
  if i in frames:
   w,f=frames[i];stage.update(w,f)
   if args.encode or i in proof:
    im=stage.draw(w,f);shot=next(s for s in time['shots'] if s['start']<=i/FPS<s['end'])
    k=shot['id'];im.paste(cards[k],(0,0),cards[k]);d=ImageDraw.Draw(im);d.rectangle((0,718,round(1280*i/count),719),fill='#bd8669')
    if i<19:im=Image.blend(Image.new('RGB',im.size,'#091116'),im,i/19)
    if i in proof:im.save(base/f'proof-{i:04}.jpg',quality=90)
    if i==poster:im.save(base/'poster.webp',quality=92,method=6)
    if args.encode:raw=im.tobytes()
  if args.encode:
   if len(raw)!=1280*720*3:raise RuntimeError(f'Missing source frame {i}')
   enc.stdin.write(raw)
 if args.encode:
  enc.stdin.close();inp.stdout.close()
  if enc.wait() or inp.wait():raise RuntimeError('Video pipeline failed')
if __name__=='__main__':main()
