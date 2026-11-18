"""Render the two transparent, registered layers of the guided flight's hardware study.
Run from the repo root: blender -b -t 4 -P scripts/render-handoff-hardware.py
The coupling plane projects to the image center in both layers. Concept art only.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

out = Path(__file__).resolve().parents[1] / 'public/handoff'
out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 1024, 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = 94
scene.world = bpy.data.worlds.new('Starlight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.28, .36, .46, 1)

def material(name, rgb, metal, rough, wrinkles=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    shader = nt.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    if wrinkles:
        noise, bump = nt.nodes.new('ShaderNodeTexNoise'), nt.nodes.new('ShaderNodeBump')
        noise.inputs['Scale'].default_value = 24
        noise.inputs['Detail'].default_value = 2
        bump.inputs['Strength'].default_value = .28
        bump.inputs['Distance'].default_value = .028
        nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return m

silver = material('Bead-blasted aluminium', (.42,.52,.61), .88,.29)
white = material('Ceramic insulation', (.78,.81,.77), .31,.34)
dark = material('Carbon composite', (.037,.057,.072), .6,.31)
gold = material('Amber multilayer blanket', (.62,.225,.042), .79,.30, True)
edge = material('Anodized copper', (.68,.31,.12), .83,.29)
black = material('Recessed mechanisms', (.011,.018,.026), .41,.44)

def finish(obj, mat, bevel):
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Machined edge','BEVEL')
        mod.width, mod.segments = bevel, 3
        mod = obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    group.append(obj)
    return obj

def rod(a, b, r, mat, n=32, bevel=.012, r2=None):
    u, v = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r if r2 is None else r2,
        depth=(v-u).length, location=(u+v)*.5)
    o = bpy.context.object
    o.rotation_euler = (v-u).to_track_quat('Z','Y').to_euler()
    return finish(o,mat,bevel)

def drum(x1,x2,r,mat,n=48,r2=None):
    return rod((x1,0,0),(x2,0,0),r,mat,n,r2=r2)

def point(x,r,t):
    return (x,r*math.cos(t),r*math.sin(t))

group = []
# Tether-side spreader and open capture crown.
drum(-3.8,-2.65,.055,silver,16)
drum(-2.77,-2.27,.15,dark,24,.32)
drum(-2.28,-1.51,.36,gold,12)
for x in (-2.28,-2.16,-1.61,-1.50):
    drum(x,x+.055,.385,silver)
drum(-1.55,-.96,.42,dark,32)
for i in range(6):
    t = i*math.tau/6
    rod(point(-2.48,.17,t),point(-1.14,.56,t),.044,silver)
    rod(point(-1.64,.36,t),point(-1.14,.56,t+math.pi/3),.024,edge)
    rod(point(-1.11,.48,t),point(-.46,.67,t),.095,silver,8)
    rod(point(-.62,.62,t),point(-.14,.56,t),.108,white,8)
    rod(point(-.19,.57,t),point(.04,.49,t),.075,dark,8)
    rod(point(-1.17,.59,t),point(-.95,.59,t),.088,edge,16)
drum(-1.24,-1.10,.61,silver)
drum(-1.12,-1.02,.62,dark)
drum(-1.02,-.82,.47,black)
receiver = group

group = []
# Cargo bus: docking spigot, octagonal blanket bays, and service endcap.
drum(-.10,.18,.29,silver,32)
drum(.03,.13,.425,white)
drum(.14,.66,.35,dark,32,.70)
drum(.59,2.37,.72,gold,12)
for x in (.58,1.14,1.94,2.34):
    drum(x,x+.07,.746,silver if x in (.58,2.34) else dark,12)
for i in range(6):
    t = (i+.5)*math.tau/6
    rod(point(.64,.712,t),point(2.38,.712,t),.018,edge,8)
    rod(point(.23,.36,t),point(.57,.63,t),.043,white,12)
drum(2.40,2.56,.71,white,12,.61)
drum(2.56,2.68,.56,dark)
drum(2.67,2.71,.41,silver)
drum(2.70,2.73,.32,black)
for i in range(8):
    p = point(2.60,.50,i*math.tau/8)
    rod(p,(p[0]+.04,p[1],p[2]),.039,white,12)
payload = group

def aim(obj): obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
for loc, energy, size, color in [((-3,-5,8),1150,5,(1,.89,.74)),((2,4,4),1600,4,(.56,.76,1)),((5,-4,-1),260,3,(.84,.91,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    o = bpy.context.object
    o.data.energy, o.data.shape, o.data.size, o.data.color = energy,'DISK',size,color
    aim(o)
bpy.ops.object.camera_add(location=(4,-14,4.5))
scene.camera = bpy.context.object
aim(scene.camera)
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 8.3
for name, hidden, visible in [('capture-head',payload,receiver),('cargo-bus',receiver,payload)]:
    for o in hidden: o.hide_render = True
    for o in visible: o.hide_render = False
    scene.render.filepath = str(out / (name+'.webp'))
    bpy.ops.render.render(write_still=True)
