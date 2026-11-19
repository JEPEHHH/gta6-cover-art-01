// Colour grading, texture tiles and frame finishing for VICE HOUR.
// Every tile and every wash here is deterministic: noise comes from a seeded PRNG, never Math.random.

// mulberry32: the one random source the whole studio draws from.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A caption turns into a stable seed, so the same words always paint the same sunset.
export function seedFromText(text) {
  const source = String(text || 'vice hour');
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// 128x128 film grain, neutral grey so it can ride 'overlay' without shifting the hue.
export function makeGrainTile(size = 128, seed = 1986) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d');
  const image = g.createImageData(size, size);
  const random = mulberry32(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 128 + (random() - 0.5) * 168;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return tile;
}

// Halftone dots on a neutral field: printed-paper texture for every panel.
export function makeHalftoneTile(cell = 12, seed = 7) {
  const tile = document.createElement('canvas');
  tile.width = cell;
  tile.height = cell;
  const g = tile.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, cell, cell);
  const random = mulberry32(seed);
  const dots = [
    [cell * 0.25, cell * 0.25, cell * (0.16 + random() * 0.06)],
    [cell * 0.75, cell * 0.75, cell * (0.14 + random() * 0.06)],
  ];
  g.fillStyle = 'rgba(16, 10, 22, 0.9)';
  for (const [x, y, r] of dots) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return tile;
}

function paintWash(g, W, H, stops, alpha, composite, vertical = true) {
  const grad = vertical ? g.createLinearGradient(0, 0, 0, H) : g.createLinearGradient(0, 0, W, 0);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  g.save();
  g.globalCompositeOperation = composite;
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// gradeCanvas: the four stock looks. One photo in, one graded photo out.
export function gradeCanvas(srcCanvas, gradeId, soften = 0.4) {
  const out = document.createElement('canvas');
  out.width = Math.max(1, srcCanvas.width);
  out.height = Math.max(1, srcCanvas.height);
  const g = out.getContext('2d');
  const W = out.width;
  const H = out.height;
  const blur = soften > 0 ? ` blur(${(soften * (W / 900)).toFixed(2)}px)` : '';

  switch (gradeId) {
    case 'neon': {
      g.filter = `saturate(0.74) contrast(1.2) brightness(0.97)${blur}`;
      g.drawImage(srcCanvas, 0, 0, W, H);
      g.filter = 'none';
      paintWash(g, W, H, [[0, '#00e5ff'], [1, '#0b3f6e']], 0.38, 'multiply');
      paintWash(g, W, H, [[0, '#ff2f92'], [0.62, '#6d1a6b'], [1, '#14042a']], 0.3, 'screen');
      paintWash(g, W, H, [[0, '#ff2f92'], [1, '#ffb03a']], 0.14, 'overlay');
      break;
    }
    case 'dusk': {
      g.filter = `saturate(0.94) contrast(1.04) brightness(1.06)${blur}`;
      g.drawImage(srcCanvas, 0, 0, W, H);
      g.filter = 'none';
      paintWash(g, W, H, [[0, '#ffb27a'], [1, '#ff7aa2']], 0.24, 'overlay');
      paintWash(g, W, H, [[0, '#2a1c3a'], [1, '#140a1e']], 0.2, 'screen');
      break;
    }
    case 'noir': {
      g.filter = `grayscale(0.86) contrast(1.24) brightness(1.02)${blur}`;
      g.drawImage(srcCanvas, 0, 0, W, H);
      g.filter = 'none';
      paintWash(g, W, H, [[0, '#08222c'], [1, '#04121a']], 0.5, 'screen');
      paintWash(g, W, H, [[0, '#ffd9a0'], [1, '#1b2f3a']], 0.09, 'overlay');
      break;
    }
    default: {
      // sunset — the studio's house look.
      g.filter = `saturate(1.3) contrast(1.12)${blur}`;
      g.drawImage(srcCanvas, 0, 0, W, H);
      g.filter = 'none';
      paintWash(g, W, H, [[0, '#ff2d78'], [1, '#ffb03a']], 0.38, 'overlay');
      paintWash(g, W, H, [[0, 'rgba(10,43,74,0)'], [1, '#0a2b4a']], 0.22, 'multiply');
      break;
    }
  }
  return out;
}

// Faint CRT lines over the photo area only.
export function drawScanlines(ctx, W, H, strength, area) {
  if (!strength || strength <= 0.001) return;
  const box = area || { x: 0, y: 0, w: W, h: H };
  const step = Math.max(3, Math.round(H / 320));
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.globalAlpha = Math.min(0.4, strength * 0.34);
  ctx.fillStyle = '#05030a';
  for (let y = box.y; y < box.y + box.h; y += step) ctx.fillRect(box.x, y, box.w, 1);
  ctx.restore();
}

// Corner falloff so the eye lands in the middle of the poster.
export function drawVignette(ctx, W, H, strength) {
  if (!strength || strength <= 0.001) return;
  const radius = Math.hypot(W, H) * 0.62;
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.46, radius * 0.28, W * 0.5, H * 0.5, radius);
  grad.addColorStop(0, 'rgba(8, 4, 14, 0)');
  grad.addColorStop(0.66, `rgba(8, 4, 14, ${(strength * 0.3).toFixed(3)})`);
  grad.addColorStop(1, `rgba(6, 3, 12, ${(strength * 0.92).toFixed(3)})`);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
