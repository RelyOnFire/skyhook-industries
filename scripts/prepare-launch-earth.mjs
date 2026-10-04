/** Geographic extraction only: no painted detail, enlargement or reprojection.
 * Download the January 21600 × 10800 NASA Blue Marble base map, then run:
 * node scripts/prepare-launch-earth.mjs /path/to/world.200401.3x21600x10800.jpg
 * Source and exact geographic bounds are recorded in public/textures/README.md.
 */
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {LAUNCH_REGION} from '../src/campaign/LaunchEarth.ts';

const source=process.argv[2];
if(!source)throw Error('Provide the downloaded NASA January 21600 × 10800 base map');
const {width,height}=await sharp(source).metadata();
if(width!==21600||height!==10800)throw Error('Expected NASA global 21600 × 10800 image');
const {west,east,south,north}=LAUNCH_REGION;
const left=Math.round((west+180)/360*width),top=Math.round((90-north)/180*height);
const cropWidth=Math.round((east-west)/360*width),cropHeight=Math.round((north-south)/180*height);
const target=fileURLToPath(new URL('../public/textures/earth-launch-atlantic.webp',import.meta.url));
await sharp(source).extract({left,top,width:cropWidth,height:cropHeight}).webp({quality:92}).toFile(target);
console.log(`${cropWidth} × ${cropHeight}, ${west}° to ${east}° longitude, ${south}° to ${north}° latitude`);
