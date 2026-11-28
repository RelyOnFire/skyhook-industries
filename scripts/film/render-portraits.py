"""Ray-traced product plates of the same meshes used in the real launch viewer.
blender -b -t 6 -P scripts/film/render-portraits.py -- qa/vehicle-film
"""
from pathlib import Path
import array, json, math, sys
import bpy
from mathutils import Vector
base=Path(sys.argv[sys.argv.index('--')+1]).resolve()
root=Path(__file__).resolve().parents[2]
data=json.loads((base/'scenes.json').read_text());out=root/'public/vehicles';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=36;scene.cycles.use_denoising=False
scene.render.film_transparent=True;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='WEBP';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.quality=94
scene.world=bpy.data.worlds.new('Soft sky');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.22,.26,.31,1)
materials={}
def material(i):
 if i in materials:return materials[i]
 spec=data['mats'][i];name=spec['name'];m=bpy.data.materials.new(name);m.use_nodes=True
 nt=m.node_tree;p=nt.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*spec['color'],1)
 p.inputs['Metallic'].default_value=spec['metal'];p.inputs['Roughness'].default_value=spec['rough']
 if 'glazing' in name.lower() or 'glass' in name.lower():
  p.inputs['Coat Weight'].default_value=.95;p.inputs['Coat Roughness'].default_value=.08
 if 'blanket' in name.lower():
  noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=62;noise.inputs['Detail'].default_value=3
  bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.028
  nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 materials[i]=m;return m
def model(name):
 w=data['portraits'][name];objs=[]
 for j,state in w['frames'][0]['updates']:
  if state is None:continue
  g=w['objects'][j]['g'];arr=array.array('f');arr.frombytes((base/f'g{g}').read_bytes())
  vs=[(arr[k],-arr[k+2],arr[k+1]) for k in range(0,len(arr),8)];ns=[(arr[k+3],-arr[k+5],arr[k+4]) for k in range(0,len(arr),8)]
  idx=range(len(vs))
  if data['geos'][g]['index']:
   idx=array.array('I');idx.frombytes((base/f'i{g}').read_bytes())
  faces=[tuple(idx[k:k+3]) for k in range(0,len(idx),3)]
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update()
  for face in mesh.polygons:face.use_smooth=True
  mesh.normals_split_custom_set_from_vertices(ns);o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
  o.data.materials.append(material(state[0]));objs.append(o)
 return objs
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.clip_end=2000
lights=[]
for pos,power,size,color in [((-35,-55,85),125000,64,(1,.91,.81)),((5,42,56),175000,48,(.59,.77,1)),((62,-35,12),58000,34,(.85,.92,1)),((-50,5,0),22000,22,(1,.66,.41))]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.shape='DISK';o.data.energy=power;o.data.size=size;o.data.color=color;aim(o,(0,0,0));lights.append(o)
carrier=model('carrier');earth=model('earth-cargo');moon=model('lunar-cargo')
def render(name,objects,eye,target,width,res,where=out):
 for o in carrier+earth+moon:o.hide_render=o not in objects
 cam.location=eye;aim(cam,target);cam.data.ortho_scale=width;scene.render.resolution_x,scene.render.resolution_y=res
 scene.render.filepath=str(where/(name+'.webp'));bpy.ops.render.render(write_still=True)
render('carrier',carrier,(-44,-168,81),(0,0,1),108,(1400,674))
render('rear',carrier,(-140,0,22),(0,0,1),76,(1000,430),base)
for label,objs in [('earth-cargo',earth),('lunar-cargo',moon)]:
 for o in objs:o.scale=(20,20,20)
 render(label,objs,(40,-160,-3),(0,0,-25.6),70,(704,704))
# Full-bleed hero: same scale and mating datums as the campaign near-camera.
for o in earth:o.scale=(3.375,)*3;o.location=(0,0,16)
render('carrier-loaded',carrier+earth,(-48,-117,73),(0,0,2.4),102,(1440,760))
