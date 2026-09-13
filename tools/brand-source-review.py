"""Read only the owner's legacy site and specified motion reference.
Downloaded third-party content is temporary review evidence, not a site asset.
No credentials, forms, purchase, or automatic commits. Bounded public requests.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
import hashlib,html,json,re
import requests
from bs4 import BeautifulSoup
OUT=Path('qa/brand-source-review');OUT.mkdir(parents=True,exist_ok=True)
report={'pages':[],'assets':[],'errors':[]}
session=requests.Session();session.headers['User-Agent']='Mozilla/5.0 (compatible; SkyhookOwnerAssetReview/1.0)'
def get(url,name,limit=12_000_000):
    try:
        r=session.get(url,timeout=35,stream=True);r.raise_for_status();data=bytearray()
        for block in r.iter_content(65536):
            data.extend(block)
            if len(data)>limit:raise ValueError('Review size limit exceeded')
        path=OUT/name;path.write_bytes(data)
        record={'requested':url,'url':r.url,'file':name,'bytes':len(data),'contentType':r.headers.get('content-type'),'sha256':hashlib.sha256(data).hexdigest()}
        report['assets'].append(record);return bytes(data),r.url
    except Exception as e:report['errors'].append({'url':url,'error':str(e)});return None,url
try:
    legacy=None
    for i,url in enumerate(['https://www.skyhook-industries.com/','https://skyhook-industries.com/']):
        data,base=get(url,f'legacy-{i}.html')
        if data:legacy=(data.decode('utf-8',errors='replace'),base);break
    if legacy:
        text,base=legacy;soup=BeautifulSoup(text,'html.parser');links=[]
        for tag in soup.find_all(['link','img','meta']):
            attr=dict(tag.attrs)
            if tag.name=='link' and any('icon' in str(v).lower() for v in tag.get('rel',[])):links.append(urljoin(base,tag.get('href','')))
            if tag.name=='img':
                report['pages'].append({'legacyImage':attr})
                src=tag.get('src','')
                if 'logo' in str(attr).lower() or '.svg' in src:links.append(urljoin(base,src))
            if tag.name=='meta' and tag.get('property')=='og:image':report['pages'].append({'socialImage':attr})
        candidates=re.findall(r'https?[^\s\"<>]+',html.unescape(text).replace('\\/','/'))
        for u in candidates:
            if any(s in u.lower() for s in ['favicon','.svg','logo']):links.append(u.replace('&amp;','&'))
        report['pages'].append({'legacyTitle':soup.title.get_text() if soup.title else '', 'candidateUrls':list(dict.fromkeys(links))[:50]})
        for index,url in enumerate(list(dict.fromkeys(links))[:20]):
            host=urlparse(url).hostname or ''
            if host not in ['skyhook-industries.com','www.skyhook-industries.com','img1.wsimg.com','img2.wsimg.com']:continue
            ext='.svg' if '.svg' in url.lower() else '.ico' if '.ico' in url.lower() else '.bin'
            get(url,f'legacy-asset-{index}{ext}')
            if '/:/' in url:get(url.split('/:')[0],f'legacy-original-{index}{ext}')
        get(urljoin(base,'/favicon.ico'),'legacy-favicon.ico')
    motion,base=get('https://dribbble.com/shots/16467758-Satellite-Landing-Page-Animation','motion-reference.html')
    if motion:
        text=motion.decode('utf-8',errors='replace');soup=BeautifulSoup(text,'html.parser')
        urls=[]
        for tag in soup.find_all(['video','source']):
            report['pages'].append({'motionElement':dict(tag.attrs)})
            for k in ['src','poster']:
                if tag.get(k):urls.append(urljoin(base,tag.get(k)))
        for u in re.findall(r'https?[^\s\"<>]+',html.unescape(text).replace('\\/','/')):
            if any(s in u.lower() for s in ['.mp4','.webm','.gif']):urls.append(u.replace('&amp;','&'))
        report['pages'].append({'motionTitle':soup.title.get_text() if soup.title else '', 'mediaUrls':list(dict.fromkeys(urls))[:30]})
        for index,url in enumerate(list(dict.fromkeys(urls))[:5]):
            host=urlparse(url).hostname or ''
            if host.endswith('dribbble.com'):
                ext='.mp4' if '.mp4' in url else '.webm' if '.webm' in url else '.gif' if '.gif' in url else '.png'
                get(url,f'motion-{index}{ext}',80_000_000)
finally:
    (OUT/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
