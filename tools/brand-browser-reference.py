"""Normal public-page viewing for the two references selected by the owner.
No authentication, captcha interaction or access-control workarounds.
Third-party media is captured only in expiring review artifacts, not shipped.
"""
from pathlib import Path
from urllib.parse import urlparse
import json,requests
from playwright.sync_api import sync_playwright
OUT=Path('qa/brand-source-review');OUT.mkdir(parents=True,exist_ok=True)
report={'pages':[],'errors':[],'media':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chromium',headless=True,args=['--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    urls=[]
    page.on('response',lambda r:urls.append(r.url) if any(x in r.url for x in ['.mp4','.webm','.m3u8']) else None)
    for name,url in [('old-site','https://skyhook-industries.com/'),('motion-shot','https://dribbble.com/shots/16467758-Satellite-Landing-Page-Animation')]:
        try:
            r=page.goto(url,wait_until='domcontentloaded',timeout=45000);page.wait_for_timeout(6000)
            (OUT/(name+'-browser.html')).write_text(page.content())
            page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
            info={'name':name,'url':page.url,'title':page.title(),'status':r.status if r else None,'videos':page.locator('video').evaluate_all('els=>els.map(v=>({src:v.currentSrc,poster:v.poster,html:v.outerHTML}))')}
            report['pages'].append(info)
            for v in info['videos']:
                if v['src']:urls.append(v['src'])
            if name=='motion-shot' and page.locator('video').count():
                video=page.locator('video').first
                video.evaluate('v=>{v.muted=true;v.play().catch(()=>{});}');page.wait_for_timeout(1000)
                for second in [0,2,5,8,12,16]:
                    video.evaluate('(v,t)=>{v.pause();v.currentTime=Math.min(t,Number.isFinite(v.duration)?Math.max(0,v.duration-.1):t)}',second)
                    page.wait_for_timeout(400);video.screenshot(path=str(OUT/f'motion-frame-{second}.png'))
        except Exception as e:report['errors'].append({'url':url,'error':str(e)})
    browser.close()
for i,url in enumerate(list(dict.fromkeys(urls))[:3]):
    if not (urlparse(url).hostname or '').endswith('dribbble.com'):continue
    try:
        r=requests.get(url,timeout=45);r.raise_for_status()
        if len(r.content)<80_000_000:
            name=f'reference-video-{i}.mp4';(OUT/name).write_bytes(r.content);report['media'].append({'url':url,'file':name,'bytes':len(r.content)})
    except Exception as e:report['errors'].append({'url':url,'error':str(e)})
# Public previews only: inspect possible stock origins, never retrieve paid files.
for name,url in [('stock-preview','https://cdn.vectorstock.com/i/1000v/34/49/comet-fireball-or-meteor-icon-cartoon-style-vector-9363449.jpg'),('motion-poster','https://cdn.dribbble.com/userupload/33356803/file/still-e4f6b60b365035a41128a612c11c7bac.png')]:
    try:
        r=requests.get(url,timeout=30);r.raise_for_status();(OUT/(name+'.jpg')).write_bytes(r.content);report['media'].append({'url':url,'file':name+'.jpg','bytes':len(r.content)})
    except Exception as e:report['errors'].append({'url':url,'error':str(e)})
(OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
