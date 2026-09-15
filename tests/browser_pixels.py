"""Compare browser screenshot pixels without adding an imaging dependency.
PNG encodings and outward-rounded element clips are not visual state. Decode in
an unattached 2D canvas; allow at most one CSS pixel of clip rounding and retain
strict error bounds. Original screenshots remain the review evidence.
"""
import base64

def difference(page, first: bytes, second: bytes):
    return page.evaluate('''async ([a,b]) => {
      async function decode(encoded) {
        const image=new Image();image.src='data:image/png;base64,'+encoded;
        await image.decode();
        const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
        const g=c.getContext('2d');g.drawImage(image,0,0);
        return {w:c.width,h:c.height,data:g.getImageData(0,0,c.width,c.height).data};
      }
      const A=await decode(a),B=await decode(b);
      if(Math.abs(A.w-B.w)>1||Math.abs(A.h-B.h)>1)
        return {mean:255,changed:1,dimensions:[A.w,A.h,B.w,B.h]};
      const w=Math.min(A.w,B.w),h=Math.min(A.h,B.h);let best={mean:255,changed:1};
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        let sum=0,changed=0,count=0;
        for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
          const i=(y*A.w+x)*4,j=((y+dy)*B.w+x+dx)*4;let peak=0;
          for(let k=0;k<3;k++){const d=Math.abs(A.data[i+k]-B.data[j+k]);sum+=d;peak=Math.max(peak,d);}
          if(peak>10)changed++;count++;
        }
        const mean=sum/(3*count);if(mean<best.mean)best={mean,changed:changed/count};
      }
      return {...best,dimensions:[A.w,A.h,B.w,B.h]};
    }''', [base64.b64encode(first).decode(),base64.b64encode(second).decode()])

def assert_restored(page, first: bytes, second: bytes):
    diff=difference(page,first,second)
    # Less than half a channel level on average; <=0.5% substantially changed.
    # Full camera coordinates and visible-component state are checked separately.
    assert diff['mean']<.5 and diff['changed']<.005, f'Reset visual mismatch: {diff}'
    return diff
