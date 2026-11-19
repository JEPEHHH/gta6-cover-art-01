// The painted scene every cover sits on: a retro sunset over an ocean, skyline, palms and
// birds. Nothing here is a photo — it is drawn from a seeded PRNG so the same caption always
// paints the same sunset.

import { mulberry32 } from './grade.js';

const SKY_STOPS = [
  [0, '#12061f'],
  [0.26, '#3d0d47'],
  [0.46, '#8e1d5c'],
  [0.62, '#ff5f6d'],
  [1, '#ffb03a'],
];

const OCEAN_TOP = '#120a24';
const OCEAN_BOTTOM = '#2a0f36';
const SILHOUETTE = '#140818';
const RIM = 'rgba(122, 62, 126, 0.65)';

function lerpColour(a, b, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const mix = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

function paintSky(ctx, box, horizonAt) {
  const sky = ctx.createLinearGradient(0, box.y, 0, horizonAt);
  for (const [at, colour] of SKY_STOPS) sky.addColorStop(at, colour);
  ctx.fillStyle = sky;
  ctx.fillRect(box.x, box.y, box.w, Math.max(1, horizonAt - box.y));

  const ocean = ctx.createLinearGradient(0, horizonAt, 0, box.y + box.h);
  ocean.addColorStop(0, OCEAN_TOP);
  ocean.addColorStop(1, OCEAN_BOTTOM);
  ctx.fillStyle = ocean;
  ctx.fillRect(box.x, horizonAt, box.w, Math.max(1, box.y + box.h - horizonAt));
}

// The sun: a disc with a soft halo and seven cut bands, thinner as they climb the disc.
function paintSun(ctx, cx, gy, radius) {
  const halo = ctx.createRadialGradient(cx, gy, radius * 0.5, cx, gy, radius * 3.6);
  halo.addColorStop(0, 'rgba(255, 176, 90, 0.5)');
  halo.addColorStop(0.34, 'rgba(255, 108, 108, 0.22)');
  halo.addColorStop(1, 'rgba(255, 95, 109, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, gy, radius * 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const disc = ctx.createLinearGradient(0, gy - radius, 0, gy + radius * 0.3);
  disc.addColorStop(0, '#fff6da');
  disc.addColorStop(0.55, '#fff1c9');
  disc.addColorStop(1, '#ffcf8f');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, gy, radius, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = disc;
  ctx.fillRect(cx - radius, gy - radius, radius * 2, radius);
  ctx.fillStyle = 'rgba(20, 10, 36, 0.94)';
  let y = gy;
  for (let band = 0; band < 7; band += 1) {
    const thickness = radius * (0.09 - band * 0.0125);
    y -= thickness;
    ctx.fillRect(cx - radius, y, radius * 2, thickness * 1.02);
    y -= radius * 0.026;
  }
  ctx.restore();
}

// Warm streaks on the water, fading with distance from the sun.
function paintReflection(ctx, box, cx, gy, radius, random) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const span = Math.max(1, box.y + box.h - gy);
  for (let i = 0; i < 26; i += 1) {
    const t = (i + random() * 0.8) / 26;
    const y = gy + t * span * 0.94;
    const width = (0.05 + random() * 0.21) * box.w;
    const offset = (random() - 0.5) * radius * (1.4 + t * 3.4);
    const alpha = 0.72 * (1 - t) * (0.5 + random() * 0.5);
    ctx.globalAlpha = Math.max(0.02, alpha);
    ctx.fillStyle = lerpColour('#ffb03a', '#ff5f6d', t);
    ctx.fillRect(cx + offset - width / 2, y, width, Math.max(1, radius * 0.035 * (1 - t * 0.5)));
  }
  ctx.restore();
}

// Distant blocks on the horizon, each with a few lit windows.
function paintSkyline(ctx, box, horizonAt, sunX, radius, random) {
  const count = 14 + Math.floor(random() * 9);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const w = (0.016 + random() * 0.038) * box.w;
    const h = (0.012 + Math.pow(random(), 1.6) * 0.066) * box.h;
    const x = box.x + random() * (box.w - w);
    if (Math.abs(x + w / 2 - sunX) < radius * 1.35) continue;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#1a0a24';
    ctx.fillRect(x, horizonAt - h, w, h + 1);
    if (w < 0.022 * box.w) continue;
    const windows = 2 + Math.floor(random() * 5);
    ctx.fillStyle = '#ffd08a';
    for (let d = 0; d < windows; d += 1) {
      ctx.globalAlpha = 0.35 + random() * 0.5;
      ctx.fillRect(x + w * (0.2 + random() * 0.6), horizonAt - h + h * (0.15 + random() * 0.7), Math.max(2, w * 0.06), Math.max(2, box.h * 0.0022));
    }
  }
  ctx.restore();
}

// One frond: two bezier curves out and back, so the leaf has a spine and a thin rim.
function paintFrond(ctx, x, y, angle, length, droop, sway) {
  const tipX = x + Math.cos(angle) * length + sway;
  const tipY = y + Math.sin(angle) * length + droop;
  const c1x = x + Math.cos(angle) * length * 0.36;
  const c1y = y + Math.sin(angle) * length * 0.36 - length * 0.1;
  const c2x = x + Math.cos(angle) * length * 0.76 + sway * 0.4;
  const c2y = y + Math.sin(angle) * length * 0.76 - length * 0.02;
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  const width = length * 0.15;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(c1x + nx * width, c1y + ny * width, c2x + nx * width * 0.72, c2y + ny * width * 0.72, tipX, tipY);
  ctx.bezierCurveTo(c2x - nx * width * 0.5, c2y - ny * width * 0.5, c1x - nx * width * 0.55, c1y - ny * width * 0.55, x, y);
  ctx.closePath();
  ctx.fillStyle = SILHOUETTE;
  ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(1, length * 0.014);
  ctx.stroke();
}

// A tapered trunk (two sampled bezier edges) with a crown of fronds on top.
function paintPalm(ctx, baseX, baseY, height, lean, random) {
  const topX = baseX + lean * height * 0.62;
  const topY = baseY - height;
  const c1x = baseX + lean * height * 0.06;
  const c1y = baseY - height * 0.42;
  const c2x = baseX + lean * height * 0.42;
  const c2y = baseY - height * 0.82;
  const steps = 16;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * baseX + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * topX;
    const y = mt * mt * mt * baseY + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * topY;
    const halfWidth = height * (0.028 - 0.016 * t);
    left.push([x - halfWidth, y]);
    right.push([x + halfWidth, y]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [x, y] of left) ctx.lineTo(x, y);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = SILHOUETTE;
  ctx.fill();

  const fronds = 8 + Math.floor(random() * 4);
  for (let i = 0; i < fronds; i += 1) {
    const spread = (i / (fronds - 1)) * 2 - 1;
    const angle = -Math.PI / 2 + spread * 1.62 + (random() - 0.5) * 0.18;
    const length = height * (0.34 + random() * 0.16);
    paintFrond(ctx, topX, topY, angle, length, Math.abs(spread) * height * 0.14 + height * 0.02, spread * height * 0.05);
  }
}

function paintBirds(ctx, box, horizonAt, random) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 8, 24, 0.78)';
  ctx.lineWidth = Math.max(2, box.h * 0.0035);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const x = box.x + box.w * (0.16 + random() * 0.66);
    const y = box.y + horizonAt * (0.2 + random() * 0.42);
    const s = box.h * (0.014 + random() * 0.01);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.72, x, y - s * 0.06);
    ctx.moveTo(x, y - s * 0.06);
    ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.72, x + s, y);
    ctx.stroke();
  }
  ctx.restore();
}

// drawBackdrop(ctx, W, H, grade, seedT, opts)
//   opts.box     the rectangle the scene is painted into (defaults to the whole frame)
//   opts.horizon where the horizon sits inside that box, 0..1 (defaults to 0.68)
//   opts.sunX    the sun's horizontal position as a fraction of the box width
export function drawBackdrop(ctx, W, H, grade, seedT, opts = {}) {
  const box = opts.box || { x: 0, y: 0, w: W, h: H };
  const horizonF = opts.horizon ?? 0.68;
  const sunX = opts.sunX ?? 0.72;
  const horizonAt = box.y + box.h * horizonF;
  const radius = 0.135 * H;
  const cx = box.x + box.w * sunX;
  const random = mulberry32((seedT >>> 0) || 0x51c3);

  paintSky(ctx, box, horizonAt);

  const haze = ctx.createLinearGradient(0, horizonAt - box.h * 0.08, 0, horizonAt + box.h * 0.03);
  haze.addColorStop(0, 'rgba(255, 255, 255, 0)');
  haze.addColorStop(0.56, 'rgba(255, 255, 255, 0.06)');
  haze.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(box.x, horizonAt - box.h * 0.08, box.w, box.h * 0.11);

  paintSun(ctx, cx, horizonAt, radius);
  paintReflection(ctx, box, cx, horizonAt, radius, random);
  paintSkyline(ctx, box, horizonAt, cx, radius, random);

  const smallPalms = 3 + Math.floor(random() * 4);
  for (let i = 0; i < smallPalms; i += 1) {
    const x = box.x + box.w * (0.04 + random() * 0.9);
    if (Math.abs(x - cx) < radius * 1.1) continue;
    paintPalm(ctx, x, horizonAt + box.h * 0.004, box.h * (0.07 + random() * 0.06), random() > 0.5 ? 0.6 : -0.6, random);
  }

  paintPalm(ctx, box.x + box.w * 1.02, box.y + box.h * 1.02, box.h * 0.82, -0.36, random);
  paintBirds(ctx, box, horizonAt, random);

  // A single colour pass so the painted scene follows the chosen stock.
  ctx.save();
  if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#808080';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  } else if (grade === 'neon') {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#0a3a6a';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  } else if (grade === 'dusk') {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ffb27a';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}
