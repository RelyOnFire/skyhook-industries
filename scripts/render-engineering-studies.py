"""Build the Finlay stage portraits and tether specimen. From the repository root:
blender -b -t 6 -P scripts/render-engineering-studies.py
All hardware and nucleus geometry is illustrative. Distances are artist units.
"""
from math import atan2, cos, exp, pi, sin, tau
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector, noise

OUT = Path(__file__).resolve().parents[1] / 'public/studies'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 36
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 1280, 680
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = 91
scene.world = bpy.data.worlds.new('Cool sky fill')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.13, .16, .22, 1)

def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    for key, value in [('Base Color', (*color, 1)), ('Metallic', metal), ('Roughness', rough)]:
        shader.inputs[key].default_value = value
    return mat

steel = material('Machined titanium', (.40,.48,.54), .87,.27)
ceramic = material('Ivory ceramic', (.73,.73,.64), .39,.31)
carbon = material('Woven graphite', (.046,.066,.081), .55,.35)
dark = material('Oxidised recess', (.012,.021,.028), .55,.44)
copper = material('Copper restraint web', (.66,.26,.071), .79,.29)
water = material('Blue anodised plumbing', (.12,.38,.49), .7,.26)
foil = material('Thermal blankets', (.59,.32,.11), .78,.38)
cells = material('Solar cells', (.045,.10,.20), .70,.25)
rock = material('Dust and exposed grains', (.22,.21,.19), .06,.92)

def noise_detail(mat, freq, depth, strength, colors=None):
    tree = mat.node_tree
    tex = tree.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = freq
    tex.inputs['Detail'].default_value = 5
    tex.inputs['Roughness'].default_value = .69
    bump = tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = depth
    shader = tree.nodes['Principled BSDF']
    tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
    tree.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    if colors:
        ramp = tree.nodes.new('ShaderNodeValToRGB')
        for item, (pos, rgb) in zip(ramp.color_ramp.elements, colors):
            item.position = pos
            item.color = (*rgb,1)
        tree.links.new(tex.outputs['Fac'], ramp.inputs[0])
        tree.links.new(ramp.outputs[0], shader.inputs['Base Color'])

noise_detail(rock,95,.065,.65,[(.29,(.044,.045,.043)),(.71,(.37,.35,.30))])
noise_detail(foil,43,.021,.34)
noise_detail(carbon,110,.009,.25)
membrane = material('Vapor envelope', (.44,.62,.70), .58,.34)
tree = membrane.node_tree
mix = tree.nodes.new('ShaderNodeMixShader')
mix.inputs[0].default_value = .115
tree.links.new(tree.nodes.new('ShaderNodeBsdfTransparent').outputs[0],mix.inputs[1])
tree.links.new(tree.nodes['Principled BSDF'].outputs[0],mix.inputs[2])
tree.links.new(mix.outputs[0],tree.nodes['Material Output'].inputs['Surface'])

def finish(obj, mat, bevel=0, smooth=False):
    obj.data.materials.append(mat)
    if smooth:
        for face in obj.data.polygons:
            face.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Edge breaks', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    return obj

def tube(points, radius, mat, loop=False):
    curve = bpy.data.curves.new('Conduit', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth, curve.bevel_resolution = radius, 2
    p = curve.splines.new('POLY')
    p.points.add(len(points)-1)
    for pt, v in zip(p.points, points):
        pt.co = (*v,1)
    p.use_cyclic_u = loop
    obj = bpy.data.objects.new('Conduit', curve)
    scene.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj

def drum(a,b,r,mat,r2=None,n=40,bevel=.01):
    start,end = Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,
                                    depth=(end-start).length,location=(start+end)*.5)
    obj = bpy.context.object
    obj.rotation_euler = (end-start).to_track_quat('Z','Y').to_euler()
    return finish(obj,mat,bevel)

def box(xyz, sizes, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz)
    obj = bpy.context.object
    obj.dimensions = sizes
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,mat,bevel)

def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    return finish(obj,mat,smooth=smooth)

def light(loc,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=loc)
    obj = bpy.context.object
    obj.data.energy, obj.data.size, obj.data.color = power,size,color
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()

light((-5,-5,7),1450,3.2,(1,.88,.71))
light((1,4,4),1700,3.8,(.57,.77,1))
light((5,-5,.2),370,2.4,(.88,.92,1))
bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
camera.data.type = 'ORTHO'

def look(eye, target, width):
    camera.location = eye
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale = width

def render(name):
    scene.render.filepath = str(OUT / (name+'.webp'))
    bpy.ops.render.render(write_still=True)

def geometry():
    return {o for o in scene.objects if o.type in {'MESH','CURVE'}}

# Colatitude measured down the long axis, with the propulsion frame at the +X pole.
def ellipsoid(theta, phi):
    return Vector((cos(theta),sin(theta)*cos(phi),sin(theta)*sin(phi)))

def shell(theta, phi, lift=0):
    n = ellipsoid(theta,phi)
    width = 1-.10*exp(-((n.x+.22)/.33)**2)
    return Vector((-1.18+(2.30+lift)*n.x, (1.58+lift)*width*n.y,
                   (1.53+lift)*width*n.z+.10*n.x))

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=7,radius=1)
nucleus = bpy.context.object
for vertex in nucleus.data.vertices:
    n = vertex.co.normalized()
    body = .90 + .115*noise.noise(n*2.3) + .075*noise.fractal(n*6,1.0,2.05,5)
    neck = 1-.33*exp(-((n.x+.23)/.34)**2)
    vertex.co = (-1.18+2.22*n.x*body,1.49*n.y*neck*body,
                 1.50*n.z*neck*body+.14*n.x+.13*cos(n.x*3))
finish(nucleus,rock,smooth=True)
# Small ridges from fractured surface facets catch glancing light.
rng = Random(157)
for _ in range(88):
    face = rng.choice(nucleus.data.polygons)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=face.center)
    obj = bpy.context.object
    size = rng.uniform(.019,.068)
    obj.scale = (size*1.5,size*.84,size)
    obj.rotation_euler = (rng.random()*pi,rng.random()*pi,rng.random()*pi)
    finish(obj,rock)
surface = geometry()

nlat,nlon = 56,96
verts = [shell(pi*i/nlat,tau*j/nlon) for i in range(nlat+1) for j in range(nlon)]
faces = [(i*nlon+j,i*nlon+(j+1)%nlon,(i+1)*nlon+(j+1)%nlon,(i+1)*nlon+j)
         for i in range(nlat) for j in range(nlon)]
mesh('Flexible collection membrane',verts,faces,membrane)
# Silver diagonal restraint net and separate copper longitudinal load straps.
for j in range(16):
    for slope in (-.88,.88):
        tube([shell(.14+2.86*i/90,tau*j/16 + slope*(i/90-.5)*pi,.012)
              for i in range(91)],.006,steel)
for j in range(8):
    phi = tau*j/8 + .13
    strip = [shell(.14+2.86*i/80,phi+offset,.029) for i in range(81) for offset in (-.029,.029)]
    mesh('Flat longitudinal load strap',strip,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(80)],copper)
    for offset in (-.03,.03):
        tube([shell(.14+2.86*i/80,phi+offset,.034) for i in range(81)],.007,foil)
for lat in (.64,1.36,2.10,2.67):
    tube([shell(lat,tau*i/100,.034) for i in range(100)],.019,copper,True)
    for j in range(8):
        center = shell(lat,tau*j/8+.13,.046)
        box(center,(.09,.076,.07),steel,.013)

def engine(y,z):
    def ring(x,end,r,mat,r2=None):
        return drum((x,y,z),(end,y,z),r,mat,r2)
    ring(1.79,2.11,.22,foil)
    ring(2.10,2.15,.24,steel)
    ring(2.15,2.37,.18,carbon,.13)
    ring(2.37,2.70,.12,copper,.29)
    ring(2.69,2.75,.30,steel)
    ring(2.749,2.759,.257,dark)
    ring(2.758,2.763,.12,carbon)
    for i in range(7):
        x = 2.40 + i*.041
        ring(x,x+.012,.135+i*.020,copper)
    for j in range(8):
        a = tau*j/8
        def around(x, radius):
            return (x,y+radius*cos(a),z+radius*sin(a))
        drum(around(1.82,.219),around(2.09,.222),.018,steel,n=12)
        drum(around(2.28,.137),around(2.68,.289),.012,steel,n=10)
        drum(around(2.746,.273),around(2.757,.273),.014,copper,n=8)
    ring(2.00,2.025,.232,carbon)
    ring(1.83,1.853,.234,steel)
    for yoff in (-.12,.12):
        tube([(1.53,y+yoff,z+.13),(1.72,y+yoff,z+.23),
              (2.12,y+yoff,z+.20),(2.22,y+yoff,z+.10)],.018,steel)

for y,z in [(-.64,.64),(.64,-.62)]:
    engine(y,z)
    for delta in (-.51,.51):
        phi = atan2(z,y) + delta
        end=(1.91,y,z)
        drum(shell(.60,phi,.04), end,.042,steel,n=12)
        drum(shell(.91,phi,.04), (1.40,y*.8,z*.8),.023,copper,n=12)
        drum((1.40,y*.8,z*.8),end,.036,carbon,n=12)
drum((1.87,-.64,.64),(1.87,.64,-.62),.091,steel)
frame = geometry()-surface

# Cold-trap fins, collection lines, pressure tank and heater on the thrust bridge.
drum((1.24,-.56,-.21),(1.89,-.56,-.21),.21,ceramic,.21)
for x in (1.25,1.42,1.68,1.86):
    drum((x,-.56,-.21),(x+.035,-.56,-.21),.216,steel)
for i in range(9):
    box((1.18+i*.052,-.86,.11),(.023,.29,.36),steel,.009)
tube([(.57,-.96,.08),(.98,-.89,.05),(1.21,-.87,.08),(1.61,-.84,.08),(1.68,-.59,-.20)],.042,water)
for y,z in [(-.64,.64),(.64,-.62)]:
    tube([(1.85,-.56,-.21),(2.04,-.49,-.24),(2.04,y,z-.14),(1.94,y,z)],.032,copper)
processing = geometry()-surface-frame

def satellite(x,y,z,span):
    box((x,y,z),(.40,.32,.37),foil)
    for end in (-.185,.185):
        box((x+end,y,z),(.018,.34,.385),steel,.005)
    box((x+.034,y-.169,z),(.185,.027,.20),carbon,.006)
    for i in range(5):
        box((x+.034,y-.19,z-.085+i*.04),(.16,.025,.012),steel,.001)
    drum((x,y,z+.13),(x+.12,y,z+.37),.017,steel,n=12)
    drum((x+.12,y,z+.37),(x+.15,y,z+.42),.12,ceramic,.045)
    drum((x-.20,y,z),(x-.32,y,z),.13,steel,.09)
    drum((x-.32,y,z),(x-.335,y,z),.074,dark)
    for side in (-1,1):
        box((x,y,z+side*.27),(.065,.06,.26),steel)
        box((x,y,z+side*(.32+span/2)),(.43,.035,span),cells)
        for i in range(7):
            box((x,y-.020,z+side*(.32+i*span/6)),(.43,.012,.012),steel,.002)
        box((x,y-.021,z+side*(.32+span/2)),(.009,.013,span),steel,.002)

satellite(1.65,-.54,.72,.46)
survey = geometry()-surface-frame-processing
satellite(2.85,-.56,-.85,.31)
tube([(1.79,-.56,-.36),(1.85,-.61,-.64),(2.12,-.61,-.85),(2.53,-.56,-.85)],.034,water)
depot = geometry()-surface-frame-processing-survey

look((4.6,-13,4.15),(-.03,0,0),8.05)
for name, groups in [('survey',[surface,survey]),('enclose',[surface,frame]),
                     ('extract',[surface,frame,processing]),('depot',[surface,frame,processing,depot])]:
    visible = set.union(*groups)
    for obj in geometry():
        obj.hide_render = obj not in visible
    render('finlay-'+name)

# For the redirect illustration, transparent emissive nested jets taper away from the bells.
def plume_material():
    mat = bpy.data.materials.new('Water vapor scattering')
    mat.use_nodes=True
    nt=mat.node_tree
    coord=nt.nodes.new('ShaderNodeTexCoord')
    xyz=nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(coord.outputs['Generated'],xyz.inputs[0])
    ramp=nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(.19,.19,.19,1)
    ramp.color_ramp.elements[1].color=(0,0,0,1)
    nt.links.new(xyz.outputs['X'],ramp.inputs[0])
    shader=nt.nodes.new('ShaderNodeEmission')
    shader.inputs[0].default_value=(.49,.78,.93,1)
    mix=nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(ramp.outputs[0],mix.inputs[0])
    nt.links.new(nt.nodes.new('ShaderNodeBsdfTransparent').outputs[0],mix.inputs[1])
    nt.links.new(shader.outputs[0],mix.inputs[2])
    nt.links.new(mix.outputs[0],nt.nodes['Material Output'].inputs[0])
    return mat

vapor=plume_material()
for obj in depot:
    obj.hide_render=True
for y,z in [(-.64,.64),(.64,-.62)]:
    for radius,length in [(.24,1.52),(.15,1.13),(.074,.85)]:
        verts=[(2.76+length*t,y+radius*(1+.78*t)*cos(tau*j/40),z+radius*(1+.78*t)*sin(tau*j/40))
               for t in (0,1) for j in range(40)]
        mesh('Expanding steam jet',verts,[(j,(j+1)%40,(j+1)%40+40,j+40) for j in range(40)],vapor)
render('finlay-redirect')

# Section-joint tensile coupon. Two split grips expose the longitudinal fiber bundles.
for obj in geometry():
    obj.hide_render=True
for side in (-1,1):
    x = 2.25*side
    box((x,0,-.11),(1.08,1.40,.26),carbon,.082)
    box((x,0,.12),(.86,1.33,.20),steel,.062)
    box((x-.28*side,0,.231),(.13,1.30,.022),copper,.008)
    for y in (-.49,.49):
        for offset in (-.25,.24):
            bx = x+offset
            drum((bx,y,.21),(bx,y,.256),.088,dark,n=32)
            drum((bx,y,.253),(bx,y,.287),.070,steel,n=6)
            drum((bx,y,.285),(bx,y,.290),.028,dark,n=6,bevel=.001)
    for y in (-.54,.54):
        tube([(side*2.78,y,0),(side*3.39,y*.60,0),(side*3.66,y*.52,0)],.12,steel)
    drum((side*3.55,0,-.085),(side*3.55,0,.085),.35,carbon)
    drum((side*3.55,0,.085),(side*3.55,0,.100),.20,steel)
    drum((side*3.55,0,.10),(side*3.55,0,.108),.13,dark)
for lane in (-.43,0,.43):
    tube([(-2.24,lane,0),(2.24,lane,0)],.070,carbon)
    for k in range(7):
        phase=k*tau/7
        tube([(x,lane+.06*cos(phase+x*21),.06*sin(phase+x*21))
              for x in [-2.2+4.4*i/400 for i in range(401)]],.019,carbon if k%3 else steel)
for j in range(7):
    x = -1.7+j*.49
    for y in (-.43,.43):
        tube([(x,y,.043),(x+.245,0,.039),(x+.49,y,.043)],.018,copper)
    drum((x+.21,0,0),(x+.27,0,0),.089,steel,n=20)
look((3.8,-6.8,7.3),(0,0,0),8.40)
render('tether-specimen')

# A repeated deployable mirror module in Expeditions. The triangular foil bays
# terminate on radial booms; the spacecraft bus sits below their central hinge.
for obj in geometry():
    obj.hide_render=True
mirror=material('Reflective film',(.73,.68,.55),.88,.24)
noise_detail(mirror,38,.028,.19)
box((0,0,-.18),(.73,.65,.42),foil,.065)
for z in (-.37,.02):
    box((0,0,z),(.78,.70,.055),steel,.025)
for side in (-1,1):
    drum((side*.29,0,-.17),(side*.53,0,-.17),.15,carbon,n=24)
    drum((side*.53,0,-.17),(side*.57,0,-.17),.16,steel,n=24)
drum((0,0,-.45),(0,0,.19),.185,dark)
drum((0,0,.12),(0,0,.27),.31,copper,n=12)

def sail_point(rad,a,z):
    return Vector((rad*cos(a),rad*sin(a),z))

for j in range(6):
    a,b=tau*j/6,tau*(j+1)/6
    A,B=sail_point(2.4,a,.03),sail_point(2.4,b,.03)
    for r in (.35,1.18,2.05,2.43):
        C=sail_point(r,a,.05)
        drum((C.x,C.y,C.z-.04),(C.x,C.y,C.z+.057),.062,steel,n=12)
    tube([sail_point(.21,a,.18),sail_point(2.48,a,.02)],.041,copper)
    tube([sail_point(.32,a,-.23),sail_point(2.14,a,.01)],.016,steel)
    # A shallow crease across each facet makes the separate foil panels visible.
    sections=16
    verts=[]
    for ri in range(sections+1):
        t=.15+.85*ri/sections
        for si in range(sections+1):
            u=.013+.974*si/sections
            v=(A*(1-u)+B*u)*t
            v.z += .106*(1-t)-.11*sin(pi*ri/sections)*sin(pi*u)+.012*sin(4*pi*u)*sin(3*pi*t)
            verts.append(v)
    faces=[(i*17+k,i*17+k+1,(i+1)*17+k+1,(i+1)*17+k) for i in range(16) for k in range(16)]
    mesh('Tensioned reflector bay',verts,faces,mirror)
    for i in (0,8,16):
        tube(verts[i*17:i*17+17],.009,steel)
    tube([verts[i*17+8] for i in range(17)],.005,steel)
look((3.8,-6.4,5.7),(0,0,0),6.65)
render('solar-mirror')
