"""One-time binary preparation of the existing owner-requested artwork.
Creates only unreferenced Git blobs; cannot change a branch, commit or deployment.
The assistant reviews the returned hashes before referencing assets in its tree.
"""
from pathlib import Path
import os,hashlib,io,json,struct,base64
import requests,numpy as np
from scipy import ndimage
from PIL import Image
repo=os.environ['GITHUB_REPOSITORY']
assert repo=='RelyOnFire/skyhook-industries'
url='https://img1.wsimg.com/isteam/ip/0fa0ac43-09ea-4bae-a152-48896ecd744a/favicon/9409503f-843f-4018-a17e-aa1400a7421f.png'
r=requests.get(url,timeout=30);r.raise_for_status();raw=r.content
assert hashlib.sha256(raw).hexdigest()=='1f92c662e9d62136ff03b4eb1e2a77cabaf5a350a31ad560216fa21880de89de'
i=Image.open(io.BytesIO(raw)).convert('RGB');assert i.size==(2560,2560)
a=np.array(i);white=np.all(a>232,axis=2);seed=np.zeros_like(white);seed[0,0]=True
exterior=ndimage.binary_propagation(seed,mask=white)
rgba=np.dstack([a,np.where(exterior,0,255).astype('uint8')]);cut=Image.fromarray(rgba).crop(Image.fromarray(rgba).getbbox())
side=round(max(cut.size)*1.10);square=Image.new('RGBA',(side,side));square.alpha_composite(cut,((side-cut.width)//2,(side-cut.height)//2))
def png(size):
    out=io.BytesIO();square.resize((size,size),Image.Resampling.LANCZOS).quantize(colors=128,method=Image.Quantize.FASTOCTREE).save(out,format='PNG',optimize=True);return out.getvalue()
frames=[(n,png(n)) for n in [16,24,32,48,64]];offset=6+16*len(frames);ico=struct.pack('<HHH',0,1,len(frames))
for n,b in frames:ico+=struct.pack('<BBBBHHII',n,n,0,0,1,32,len(b),offset);offset+=len(b)
ico+=b''.join(b for n,b in frames)
assets={'public/brand/comet-mark.png':png(256),'public/favicon.ico':ico,'public/favicon-32.png':png(32),'public/apple-touch-icon.png':png(180)}
output=Path('qa/owner-brand-assets');output.mkdir(parents=True,exist_ok=True)
s=requests.Session();s.headers.update({'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
manifest=[]
for path,data in assets.items():
    assert len(data)<20000
    digest=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    response=s.post(f'https://api.github.com/repos/{repo}/git/blobs',json={'content':base64.b64encode(data).decode(),'encoding':'base64'},timeout=30)
    response.raise_for_status();assert response.json()['sha']==digest
    (output/Path(path).name).write_bytes(data)
    manifest.append({'path':path,'sha':digest,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(output/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
