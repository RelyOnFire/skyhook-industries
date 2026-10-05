/** Reproduce the native 10 m/pixel LROC crop used by the lunar launch view.
 * Run with a cached 4096px PNG, or omit the argument to fetch archive tiles.
 * No resampling, painted detail, height inference or runtime remote requests. */
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const base='https://data.lroc.im-ldi.com/ptif/zoomify/ser/estore/lroc/web/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_ROI/APOLLO15LOB/NAC_ROI_APOLLO15LOB_E259N0038_5M.PYR.TIF';
const width=12395,height=14768,tileSize=256,left=1024,top=1536,size=4096;
let image=process.argv[2];
if(!image){
 const levels=[[width,height]];
 while(levels.at(-1)[0]>tileSize||levels.at(-1)[1]>tileSize){const [w,h]=levels.at(-1);levels.push([Math.ceil(w/2),Math.ceil(h/2)]);}
 levels.reverse();const level=levels.length-2,columns=Math.ceil(levels[level][0]/tileSize);
 const prior=levels.slice(0,level).reduce((sum,[w,h])=>sum+Math.ceil(w/tileSize)*Math.ceil(h/tileSize),0),tiles=[];
 for(let y=top/tileSize;y<(top+size)/tileSize;y++)for(let x=left/tileSize;x<(left+size)/tileSize;x++)tiles.push({x,y});
 const composites=new Array(tiles.length);let cursor=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(cursor<tiles.length){const i=cursor++,{x,y}=tiles[i],group=Math.floor((prior+y*columns+x)/256);
   const response=await fetch(`${base}/TileGroup${group}/${level}-${x}-${y}.jpg`);if(!response.ok)throw Error(`Tile ${x}/${y}: ${response.status}`);
   composites[i]={input:Buffer.from(await response.arrayBuffer()),left:x*tileSize-left,top:y*tileSize-top};
  }
 }));
 image=await sharp({create:{width:size,height:size,channels:3,background:'#000000'}}).composite(composites).png().toBuffer();
}
const metadata=await sharp(image).metadata();if(metadata.width!==size||metadata.height!==size)throw Error('Expected the 4096 × 4096 archive crop');
await sharp(image).webp({quality:78,effort:6}).toFile(fileURLToPath(new URL('../public/textures/moon-launch-hadley.webp',import.meta.url)));
console.log('4096 × 4096: LROC Apollo 15 mosaic, level 5, crop 1024 / 1536, 10 m/pixel');
