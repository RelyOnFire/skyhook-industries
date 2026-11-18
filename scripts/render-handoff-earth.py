"""Bake the guided flight's illustrative Earth limb from the credited local maps.
python scripts/render-handoff-earth.py (NumPy, Pillow). No live texture loading.
"""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
# Coordinates are in the flight stage's reference plane; planet distance is illustrative.
left, top, width, height, scale = -420, 345, 1360, 155, 2
y, x = np.mgrid[:height*scale, :width*scale]/scale
x, y = x+left, y+top
cx, radius = 10, 2200
nx, ny = (x-cx)/radius, (391+radius-y)/radius
dist = (np.hypot(nx, ny)-1)*radius
nz = np.sqrt(np.maximum(0, 1-nx*nx-ny*ny))
tilt = np.deg2rad(36)
lat = np.arcsin(np.clip(ny*np.sin(tilt)-nz*np.cos(tilt),-1,1))
lon = np.arctan2(nx, ny*np.cos(tilt)+nz*np.sin(tilt)) + np.deg2rad(-83)
def sample(name, du=0, dv=0, regional=False):
    tex = np.asarray(Image.open(root/'public/textures'/name).convert('RGB'), dtype='float32')/255
    h,w = tex.shape[:2]
    u,v = ((lon/(2*np.pi)+.5)*w+du)%w, np.clip((.5-lat/np.pi)*h+dv,0,h-1.01)
    if regional:
        # Same Blue Marble observation; this regional crop retains its native
        # 2 km/pixel detail over the Caribbean and the Florida peninsula.
        u = np.clip((np.rad2deg(lon)+105)/65*w,0,w-1.01)
        v = np.clip((55-np.rad2deg(lat))/55*h,0,h-1.01)
    ix,iy = u.astype(int),v.astype(int)
    fx,fy = (u-ix)[:,:,None],(v-iy)[:,:,None]
    return ((tex[iy,ix]*(1-fx)+tex[iy,(ix+1)%w]*fx)*(1-fy)
          + (tex[iy+1,ix]*(1-fx)+tex[iy+1,(ix+1)%w]*fx)*fy)
land = sample('earth.webp')
in_crop = (np.rad2deg(lon)>-105) & (np.rad2deg(lon)<-40) & (np.rad2deg(lat)>0) & (np.rad2deg(lat)<55)
land = np.where(in_crop[:,:,None], sample('earth-launch-atlantic.webp',regional=True), land)
cloud = sample('earth-clouds.webp')[:,:,0]**.88
shadow = sample('earth-clouds.webp',1.4,-.8)[:,:,0]
land = land*(1-.33*shadow[:,:,None])
light = np.clip(.66-.95*nx-.68*nz,.08,.86)
surface = land*(1-cloud[:,:,None]) + np.array([.92,.95,.98])*cloud[:,:,None]
surface = surface*(.14+1.25*light[:,:,None])
air = np.exp(-nz*11)[:,:,None]
surface += np.array([.065,.22,.35])*air
surface += np.array([.022,.062,.095])*(1-nz[:,:,None])
sun = np.clip(.98-(x+140)/1230,.24,1)
rim = np.exp(-np.abs(dist)/2.4)*sun
surface += rim[:,:,None]*np.array([.36,.49,.53])
# Outside the globe the atmosphere is an alpha falloff, so it composites cleanly into the stage.
haze = np.stack([.10+.57*np.exp(-np.maximum(0,dist)/3),
                 .34+.48*np.exp(-np.maximum(0,dist)/4),
                 .55+.36*np.exp(-np.maximum(0,dist)/6)],axis=-1)
rgb = np.where((dist<=0)[:,:,None],surface,haze)
alpha = np.where(dist<=0,1,(.84*np.exp(-np.maximum(0,dist)/4.9)+.12*np.exp(-np.maximum(0,dist)/13))*sun)
rgba = np.dstack((rgb,alpha))
out = root/'public/handoff/earth-limb.webp'
out.parent.mkdir(exist_ok=True)
Image.fromarray(np.uint8(np.clip(rgba,0,1)*255+.5)).save(out,quality=90,method=6)
