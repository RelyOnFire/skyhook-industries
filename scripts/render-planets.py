#!/usr/bin/env python3
"""Render the checked-in surface maps to lightweight, transparent globe sprites.

Requires npm install and Playwright Chromium. Run: python scripts/render-planets.py
No remote requests. Surface provenance and processing are in public/textures/README.md.
"""
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chromium', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page()
            page.goto(f'http://127.0.0.1:{server.server_port}/package.json')
            for body in ['earth', 'moon', 'mars', 'mercury', 'ceres', 'phobos']:
                data = page.evaluate('''async body => {
                  const T = await import('/node_modules/three/build/three.module.js');
                  const renderer = new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
                  renderer.setSize(1024,1024); renderer.setClearColor(0,0);
                  renderer.outputColorSpace=T.SRGBColorSpace;
                  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);
                  camera.position.set(0,0,4);
                  const map=await new T.TextureLoader().loadAsync('/public/textures/'+body+'.webp');
                  map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
                  const geometry=new T.SphereGeometry(1,192,128);
                  if(body==='phobos')geometry.scale(.98,.75,.85);
                  const mesh=new T.Mesh(geometry,new T.MeshPhongMaterial({map,shininess:2,specular:0x080808}));
                  mesh.rotation.y=body==='earth'?4.5:body==='moon'?3*Math.PI/2:.4;
                  mesh.rotation.z=body==='earth'?.15:0;
                  scene.add(mesh);
                  if(body==='earth'){
                    const alpha=await new T.TextureLoader().loadAsync('/public/textures/earth-clouds.webp');
                    alpha.anisotropy=8;
                    const clouds=new T.Mesh(new T.SphereGeometry(1.003,192,128),new T.MeshPhongMaterial({alphaMap:alpha,color:0xffffff,transparent:true,opacity:.8,depthWrite:false,shininess:0}));
                    mesh.add(clouds);
                  }
                  const sun=new T.DirectionalLight(0xffffff,2.1);sun.position.set(-3,4,5);
                  scene.add(sun,new T.AmbientLight(0xdbe4ed,.18));
                  renderer.render(scene,camera);
                  const result=renderer.domElement.toDataURL('image/webp',.92).split(',')[1];
                  scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.alphaMap?.dispose();o.material?.dispose();});renderer.dispose();
                  renderer.forceContextLoss();return result;
                }''', body)
                target = ROOT / f'public/planets/{body}.webp'
                target.write_bytes(base64.b64decode(data))
                print(f'{body}: {target.stat().st_size:,} bytes')
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
