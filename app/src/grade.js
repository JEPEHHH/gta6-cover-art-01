// The look of the print: four colour grades, the one grain tile and halftone tile every panel shares, and the
// frame finishes. Nothing here knows about panels or captions — it takes a canvas holding a photograph and
// hands back a graded canvas of the same size, so every panel is processed by the same path.

export const GRADE_IDS = ['sunset', 'neon', 'dusk', 'noir'];

const GRADE_NAMES = { sunset: 'SUNSET', neon: 'NEON', dusk: 'DUSK', noir: 'NOIR' };

/** The button label for a grade id. */
export function gradeName(id) {
  return GRADE_NAMES[id] ?? GRADE_NAMES.sunset;
}

function offscreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

/** A small seeded generator, so the grain is identical on every draw and an export matches the preview. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
let halftoneTile = null;

/** One 128 x 128 tile of mid-grey noise, drawn over a panel with 'overlay' to read as film grain. */
export function makeGrainTile(seed = 20261118) {
  if (grainTile) return grainTile;
  const size = 128;
  const canvas = offscreen(size, size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const random = mulberry32(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const level = 128 + (random() - 0.5) * 104;
    image.data[i] = level;
    image.data[i + 1] = level;
    image.data[i + 2] = level;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return canvas;
}

/** A staggered grid of soft dark dots, the halftone screen a printed poster carries. */
export function makeHalftoneTile(cell = 7) {
  if (halftoneTile) return halftoneTile;
  const canvas = offscreen(cell * 4, cell * 4);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(6, 4, 12, 0.92)';
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cx = col * cell + (row % 2 ? cell / 2 : 0) + cell / 2;
      const cy = row * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  halftoneTile = canvas;
  return canvas;
}

function gradeSunset(ctx, src, w, h) {
  ctx.filter = 'saturate(1.3) contrast(1.12)';
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.save();
  // Vice City dusk: magenta into amber over the whole panel, then a cool multiply out of the bottom.
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.38;
  const warm = ctx.createLinearGradient(0, 0, w, h);
  warm.addColorStop(0, '#ff2d78');
  warm.addColorStop(1, '#ffb03a');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.22;
  const cool = ctx.createLinearGradient(0, h * 0.3, 0, h);
  cool.addColorStop(0, 'rgba(10, 43, 74, 0)');
  cool.addColorStop(1, '#0a2b4a');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function gradeNeon(ctx, src, w, h) {
  // Duotone: cyan in the shadows, magenta in the highlights, multiplied out of a greyscale copy of the photo
  // and screened back in, then a little of the original detail returned.
  const shadows = offscreen(w, h);
  const sc = shadows.getContext('2d');
  sc.fillStyle = '#00e5ff';
  sc.fillRect(0, 0, w, h);
  sc.globalCompositeOperation = 'multiply';
  sc.filter = 'grayscale(1) invert(1) contrast(1.3)';
  sc.drawImage(src, 0, 0, w, h);
  sc.filter = 'none';

  const lights = offscreen(w, h);
  const lc = lights.getContext('2d');
  lc.fillStyle = '#ff2f92';
  lc.fillRect(0, 0, w, h);
  lc.globalCompositeOperation = 'multiply';
  lc.filter = 'grayscale(1) contrast(1.22) saturate(0.7)';
  lc.drawImage(src, 0, 0, w, h);
  lc.filter = 'none';

  ctx.fillStyle = '#08040f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(shadows, 0, 0);
  ctx.globalAlpha = 0.95;
  ctx.drawImage(lights, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.filter = 'grayscale(1) contrast(1.1)';
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.restore();
}

function gradeDusk(ctx, src, w, h) {
  ctx.filter = 'sepia(0.22) saturate(1.14) brightness(1.1) contrast(0.94)';
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.save();
  // Soft amber and rose wash with the blacks lifted, the look of the last half hour of light.
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.26;
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, '#ffb07a');
  wash.addColorStop(1, '#c96bb0');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#2b1b2e';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function gradeNoir(ctx, src, w, h) {
  ctx.filter = 'grayscale(1) contrast(1.3) brightness(0.98)';
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.save();
  // Near-greyscale with a cyan cast in the shadows only.
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.16;
  const cast = ctx.createLinearGradient(0, h, 0, h * 0.25);
  cast.addColorStop(0, '#2fa9d6');
  cast.addColorStop(1, 'rgba(47, 169, 214, 0)');
  ctx.fillStyle = cast;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#9fd9ff';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Returns a new canvas: `src` put through the grade `gradeId`. */
export function gradeCanvas(src, gradeId) {
  const w = src.width;
  const h = src.height;
  const out = offscreen(w, h);
  const ctx = out.getContext('2d');
  switch (gradeId) {
    case 'neon':
      gradeNeon(ctx, src, w, h);
      break;
    case 'dusk':
      gradeDusk(ctx, src, w, h);
      break;
    case 'noir':
      gradeNoir(ctx, src, w, h);
      break;
    default:
      gradeSunset(ctx, src, w, h);
      break;
  }
  return out;
}

/** Mean relative luminance (0..1) of a canvas, measured on a small downsample so it costs nothing. */
export function measureLuma(src) {
  const w = Math.max(1, Math.min(40, src.width));
  const h = Math.max(1, Math.round((w * src.height) / src.width));
  const small = offscreen(w, h);
  const ctx = small.getContext('2d');
  ctx.drawImage(src, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  return total / (data.length / 4);
}

/** Faint horizontal scanlines across a rectangle, the loading-screen texture. */
export function drawScanlines(ctx, x, y, w, h, alpha) {
  if (!(alpha > 0.005)) return;
  const step = Math.max(3, Math.round(w * 0.0032));
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, alpha);
  ctx.fillStyle = '#05040a';
  for (let line = y; line < y + h; line += step) ctx.fillRect(x, line, w, 1);
  ctx.restore();
}

/** A radial darkening towards the corners of a rectangle. */
export function drawVignette(ctx, x, y, w, h, strength) {
  if (!(strength > 0.005)) return;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inner = Math.min(w, h) * 0.26;
  const outer = Math.max(w, h) * 0.74;
  ctx.save();
  const shade = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  shade.addColorStop(0, 'rgba(5, 3, 10, 0)');
  shade.addColorStop(1, `rgba(5, 3, 10, ${(0.14 + 0.62 * strength).toFixed(3)})`);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
