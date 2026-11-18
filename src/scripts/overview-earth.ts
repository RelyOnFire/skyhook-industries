// Project the equirectangular Earth map without requiring a second graphics
// context on the GPU. Rotation only offsets longitude. All trigonometry and
// lighting are cached for the current screen size.
export function overviewEarth(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let map: ImageData | undefined;
  let frame: ImageData;
  let columns: Float32Array;
  let rows: Int32Array;
  let light: Float32Array;
  let atmosphere: Float32Array;
  let lastAngle = NaN;
  let lastPaint = -Infinity;
  let lastDiameter = 0;
  const image = new Image();
  image.onload = () => {
    const buffer = document.createElement('canvas');
    buffer.width = image.naturalWidth;
    buffer.height = image.naturalHeight;
    const reader = buffer.getContext('2d');
    if (!reader) return;
    reader.drawImage(image, 0, 0);
    map = reader.getImageData(0, 0, buffer.width, buffer.height);
  };
  image.src = '/textures/earth-overview.webp';

  function project(size: number, texture: ImageData) {
    canvas.width = canvas.height = size;
    frame = new ImageData(size, size);
    const count = size * size;
    columns = new Float32Array(count);
    rows = new Int32Array(count).fill(-1);
    light = new Float32Array(count);
    atmosphere = new Float32Array(count);
    const tilt = .32;
    const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    for (let y = 0; y < size; y++) {
      const ny = 1 - (2 * y + 1) / size;
      for (let x = 0; x < size; x++) {
        const nx = (2 * x + 1) / size - 1;
        const radius2 = nx * nx + ny * ny;
        if (radius2 >= 1) continue;
        const i = y * size + x;
        const nz = Math.sqrt(1 - radius2);
        const latitude = Math.asin(ny * cosTilt + nz * sinTilt);
        const longitude = Math.atan2(nx, nz * cosTilt - ny * sinTilt);
        const ty = Math.min(texture.height-1, Math.floor((.5 - latitude / Math.PI) * texture.height));
        rows[i] = ty * texture.width;
        columns[i] = (.5 + longitude / (2 * Math.PI)) * texture.width;
        const sun = -.72 * nx + .58 * ny + .39 * nz;
        light[i] = .085 + .98 * Math.pow(Math.max(0, sun), .58);
        atmosphere[i] = Math.pow(1 - nz, 3) * Math.max(0, Math.min(1, (sun + .25) / .9));
        frame.data[4*i+3] = 255 * Math.min(1, (1-Math.sqrt(radius2)) * size / 2);
      }
    }
    lastAngle = NaN;
  }

  return (angle: number, diameter: number) => {
    if (!map || diameter < 1) return false;
    const size = Math.min(640, Math.ceil(diameter * Math.min(devicePixelRatio, 1.5)));
    if (!frame || size !== canvas.width) project(size, map);
    if (diameter !== lastDiameter) {
      canvas.style.width = canvas.style.height = diameter + 'px';
      lastDiameter = diameter;
    }
    const now = performance.now();
    if (angle === lastAngle || (Number.isFinite(lastAngle) && now - lastPaint < 40)) return true;
    const {width, data} = map;
    const offset = ((-angle / (2 * Math.PI)) % 1 + 1) % 1 * width;
    const result = frame.data;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] < 0) continue;
      let u = columns[i] + offset;
      if (u >= width) u -= width;
      const left = Math.floor(u);
      const mix = u - left;
      const a = 4 * (rows[i] + left);
      const b = left === width - 1 ? 4 * rows[i] : a + 4;
      const l = light[i], rim = atmosphere[i], dest = 4 * i;
      result[dest] = (data[a] + (data[b] - data[a]) * mix) * l + 46 * rim;
      result[dest+1] = (data[a+1] + (data[b+1] - data[a+1]) * mix) * l + 120 * rim;
      result[dest+2] = (data[a+2] + (data[b+2] - data[a+2]) * mix) * l + 174 * rim;
    }
    ctx.putImageData(frame, 0, 0);
    canvas.hidden = false;
    lastAngle = angle;
    lastPaint = now;
    return true;
  };
}
