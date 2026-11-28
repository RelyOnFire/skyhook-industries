// Derivative of the credited maps in public/textures. The homepage needs one
// small sampler; the close-up flight scenes keep independent full-size layers.
import sharp from 'sharp';

const width = 1536;
const height = width / 2;
const dir = new URL('../public/textures/', import.meta.url);
const raw = async name => sharp(new URL(name, dir).pathname)
  .resize(width, height).removeAlpha().toColourspace('srgb').raw().toBuffer();
const [earth, clouds] = await Promise.all([raw('earth.webp'), raw('earth-clouds.webp')]);
for (let i = 0; i < earth.length; i += 3) {
  const opacity = Math.min(.90, clouds[i] / 255 * 1.10);
  for (let c = 0; c < 3; c++) earth[i + c] += (241 - earth[i + c]) * opacity;
}
await sharp(earth, {raw: {width, height, channels: 3}}).webp({quality: 85})
  .toFile(new URL('earth-overview.webp', dir).pathname);

// Compact navigation figures use the same lighting as the simulation maps.
const planets = new URL('../public/planets/', import.meta.url);
for (const body of ['earth','moon','mars','phobos','mercury']) {
  await sharp(new URL(body + '.webp', planets).pathname).resize(192,192)
    .webp({quality: 83}).toFile(new URL(body + '-small.webp', planets).pathname);
}
