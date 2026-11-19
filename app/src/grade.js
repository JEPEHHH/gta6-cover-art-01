// The print stock: film grain, halftone dots, the four colour grades, scanlines, vignette, and the cohesion pass
// that pulls every panel towards one exposure and one saturation so the collage reads as one printed sheet.

const stockCache = new Map();

export function makeGrainTile(size = 128, seed = 7) {
  const key = `grain:${size}:${seed}`;
  if (stockCache.has(key)) return stockCache.get(key);
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  const data = ctx.createImageData(size, size);
  let t = seed >>> 0;
  for (let i = 0; i < data.data.length; i += 4) {
    t = (Math.imul(t, 1664525) + 1013904223) >>> 0;
    const v = 96 + ((t >>> 16) % 96);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  stockCache.set(key, tile);
  return tile;
}

export function makeHalftoneTile(size = 14, seed = 3) {
  const key = `halftone:${size}:${seed}`;
  if (stockCache.has(key)) return stockCache.get(key);
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#f2f2f2';
  const r = size * 0.23;
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) {
      ctx.beginPath();
      ctx.arc(x * size * 0.5 + size * 0.25 + (y % 2 ? size * 0.25 : 0), y * size * 0.5 + size * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  stockCache.set(key, tile);
  return tile;
}

// The four colour treatments. Each one filters the panel first, then lays gradients over it.
export function gradeCanvas(canvas, gradeId) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  if (gradeId === 'sunset') {
    filterInPlace(canvas, 'saturate(1.3) contrast(1.12)');
    wash(ctx, w, h, [[0, '#ff2d78'], [1, '#ffb03a']], 'overlay', 0.38);
    wash(ctx, w, h, [[0, 'rgba(10,43,74,0)'], [1, 'rgba(10,43,74,0.22)']], 'multiply', 1);
    return;
  }
  if (gradeId === 'neon') {
    filterInPlace(canvas, 'saturate(0.78) contrast(1.22) brightness(0.96)');
    wash(ctx, w, h, [[0, '#00e5ff'], [1, '#00b8d4']], 'multiply', 0.42);
    wash(ctx, w, h, [[0, '#ff2f92'], [1, '#ff7ad0']], 'screen', 0.30);
    wash(ctx, w, h, [[0, '#120a2a'], [1, 'rgba(18,10,42,0)']], 'overlay', 0.35);
    return;
  }
  if (gradeId === 'noir') {
    filterInPlace(canvas, 'grayscale(0.82) contrast(1.34) brightness(0.97)');
    wash(ctx, w, h, [[0, 'rgba(6,28,46,0)'], [1, 'rgba(6,28,46,0.34)']], 'multiply', 1);
    wash(ctx, w, h, [[0, '#25e6ff'], [1, 'rgba(37,230,255,0)']], 'overlay', 0.16);
    return;
  }
  // dusk: soft amber and rose, lifted blacks
  filterInPlace(canvas, 'saturate(1.06) contrast(0.94) brightness(1.03)');
  wash(ctx, w, h, [[0, '#ffb04a'], [1, '#e0607e']], 'overlay', 0.28);
  wash(ctx, w, h, [[0, '#3a2a4a'], [1, 'rgba(58,42,74,0)']], 'screen', 0.20);
}

export function drawGrain(ctx, box, amount) {
  if (!amount || amount <= 0) return;
  const tile = makeGrainTile(128, 7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(0.55, amount * 0.5);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

export function drawHalftone(ctx, box, amount) {
  if (!amount || amount <= 0) return;
  const tile = makeHalftoneTile(14, 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(0.42, amount * 0.42);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

export function drawScanlines(ctx, box, amount) {
  if (!amount || amount <= 0) return;
  const step = Math.max(3, Math.round(box.w * 0.0035));
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.fillStyle = `rgba(8,4,14,${Math.min(0.32, amount * 0.32)})`;
  for (let y = box.y; y < box.y + box.h; y += step) {
    ctx.fillRect(box.x, y, box.w, Math.max(1, step * 0.42));
  }
  ctx.restore();
}

export function drawVignette(ctx, W, H, strength) {
  if (!strength || strength <= 0) return;
  const g = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.24, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(4,2,10,0)');
  g.addColorStop(0.65, `rgba(4,2,10,${strength * 0.28})`);
  g.addColorStop(1, `rgba(4,2,10,${strength * 0.78})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// How a panel reads: its mean luminance and its mean saturation, on a 24 px downsample.
export function measureStock(canvas) {
  const s = 24;
  const probe = document.createElement('canvas');
  probe.width = s;
  probe.height = s;
  const pctx = probe.getContext('2d');
  pctx.drawImage(canvas, 0, 0, s, s);
  const data = pctx.getImageData(0, 0, s, s).data;
  let luma = 0;
  let sat = 0;
  const n = s * s;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sat += max > 0.001 ? (max - min) / max : 0;
  }
  return { luma: luma / n, sat: sat / n };
}

// Pull a graded panel towards the frame's mean exposure and saturation: same stock, whatever the photo.
export function matchStock(canvas, target) {
  const now = measureStock(canvas);
  const brightness = clamp(1 + (target.luma - now.luma) * 1.15, 0.72, 1.34);
  const saturation = clamp(1 + (target.sat - now.sat) * 0.9, 0.55, 1.5);
  if (Math.abs(brightness - 1) < 0.015 && Math.abs(saturation - 1) < 0.02) return;
  filterInPlace(canvas, `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`);
}

function filterInPlace(canvas, filter) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d').drawImage(canvas, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = filter;
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
}

function wash(ctx, w, h, stops, mode, alpha) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
