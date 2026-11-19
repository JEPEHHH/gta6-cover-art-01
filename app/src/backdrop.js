// The painted scene printed behind the photos: a retro sunset over the ocean with a sunburst sun, a reflected
// column of light, a distant skyline and palms. Everything is drawn from a seeded PRNG, so one caption always
// reproduces the same sky. Drawn at any size: every measurement is a fraction of W or H.

export function mulberry32(a) {
  let t = a >>> 0;
  return function random() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromCaption(caption) {
  const text = [caption?.kicker ?? '', caption?.title ?? '', caption?.tagline ?? ''].join('|');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// Sky ramps: the art direction's sunset is the base, the other grades bend it a little so the painted scene and
// the graded prints share one light.
const SKY = {
  sunset: [
    [0, '#12061f'], [0.26, '#3d0d47'], [0.46, '#8e1d5c'], [0.62, '#ff5f6d'], [0.68, '#ffb03a'],
  ],
  neon: [
    [0, '#0a0620'], [0.26, '#241046'], [0.46, '#5c1568'], [0.62, '#c2257f'], [0.68, '#ff8f5a'],
  ],
  dusk: [
    [0, '#160b22'], [0.26, '#43203f'], [0.46, '#8a3355'], [0.62, '#e07466'], [0.68, '#f5b070'],
  ],
  noir: [
    [0, '#0b0c14'], [0.26, '#1c1b2b'], [0.46, '#3a2b44'], [0.62, '#7d5560'], [0.68, '#b08b74'],
  ],
};

const OCEAN = {
  sunset: ['#120a24', '#2a0f36'],
  neon: ['#08061a', '#1c0d3a'],
  dusk: ['#140c20', '#331c30'],
  noir: ['#0a0a12', '#25222c'],
};

export function drawBackdrop(ctx, W, H, grade, seedT) {
  const rand = mulberry32((seedT ?? 1) >>> 0);
  const key = SKY[grade] ? grade : 'sunset';
  const horizon = H * 0.68;

  drawSky(ctx, W, H, horizon, SKY[key]);
  drawStars(ctx, W, horizon, rand, key);
  const sunX = W * 0.72;
  const sunR = H * 0.135;
  drawSunHalo(ctx, sunX, horizon, sunR, key);
  drawSunDisc(ctx, sunX, horizon, sunR, key);
  drawOcean(ctx, W, H, horizon, OCEAN[key]);
  drawSunColumn(ctx, W, horizon, sunX, sunR, rand, key);
  drawSkyline(ctx, W, horizon, rand);
  for (let i = 0; i < 3 + Math.floor(rand() * 4); i += 1) {
    const px = W * (0.08 + rand() * 0.52);
    const ph = H * (0.09 + rand() * 0.11);
    drawPalm(ctx, px, horizon + 2, ph, (rand() - 0.5) * ph * 0.35, rand, false);
  }
  drawHaze(ctx, W, horizon);
  drawBirds(ctx, W, H, rand);
  drawForegroundPalm(ctx, W, H, rand);
}

function drawSky(ctx, W, H, horizon, stops) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  for (const [at, colour] of stops) sky.addColorStop(at / 0.68, colour);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  // one warm bleed under the horizon so the sky and the sea meet without a seam
  const glow = ctx.createLinearGradient(0, horizon - H * 0.10, 0, horizon + H * 0.02);
  glow.addColorStop(0, 'rgba(255,176,58,0)');
  glow.addColorStop(1, hexA(stops[stops.length - 1][1], 0.55));
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - H * 0.10, W, H * 0.12);
}

function drawStars(ctx, W, horizon, rand, key) {
  const count = key === 'sunset' ? 26 : 70;
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = rand() * W;
    const y = rand() * horizon * 0.42;
    const r = 0.4 + rand() * 1.2;
    ctx.globalAlpha = 0.20 + rand() * 0.55;
    ctx.fillStyle = '#ffe9c9';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSunHalo(ctx, x, y, r, key) {
  const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.2);
  halo.addColorStop(0, hexA('#fff1c9', key === 'noir' ? 0.22 : 0.42));
  halo.addColorStop(0.45, hexA('#ff9a5c', 0.16));
  halo.addColorStop(1, hexA('#ff5f6d', 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
}

// The sun is a disc cut by seven horizontal bands, each thinner than the last, so it reads as a retro sunburst.
function drawSunDisc(ctx, x, y, r, key) {
  const disc = ctx.createLinearGradient(0, y - r, 0, y);
  disc.addColorStop(0, key === 'noir' ? '#f4e6c8' : '#fff6da');
  disc.addColorStop(1, '#ffcf7d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.clip();
  const cut = OCEAN[key] ? OCEAN[key][1] : '#2a0f36';
  ctx.fillStyle = cut;
  let cursor = y - r * 0.62;
  for (let i = 1; i <= 7; i += 1) {
    const thickness = r * (0.09 - (i - 1) * 0.0125);
    cursor += r * 0.085 + i * r * 0.012;
    ctx.fillRect(x - r * 1.05, cursor, r * 2.1, thickness);
  }
  ctx.restore();
  // a hot rim along the top of the disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 1.04, Math.PI * 1.96);
  ctx.strokeStyle = 'rgba(255,241,201,0.85)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.stroke();
  ctx.restore();
}

function drawOcean(ctx, W, H, horizon, pair) {
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, pair[0]);
  sea.addColorStop(0.55, pair[0]);
  sea.addColorStop(1, pair[1]);
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);
}

// Twenty-six streaks of reflected sun, each wider and warmer the closer it sits to the horizon.
function drawSunColumn(ctx, W, horizon, sunX, sunR, rand, key) {
  const seaDepth = horizon * 0.32;
  ctx.save();
  for (let i = 0; i < 26; i += 1) {
    const t = i / 25;
    const y = horizon + 1 + seaDepth * Math.pow(t, 1.35);
    const width = W * (0.03 + rand() * 0.13) * (1 - t * 0.4);
    const x = sunX - width / 2 + (rand() - 0.5) * W * 0.13;
    const height = Math.max(1, seaDepth * 0.014 * (1 + t));
    const warm = mix('#ffb03a', '#ff5f6d', t);
    ctx.globalAlpha = (1 - t * 0.82) * (key === 'noir' ? 0.4 : 0.6);
    ctx.fillStyle = warm;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function drawSkyline(ctx, W, horizon, rand) {
  const blocks = 14 + Math.floor(rand() * 9);
  let x = -W * 0.02;
  ctx.save();
  ctx.fillStyle = 'rgba(26,10,36,0.85)';
  for (let i = 0; i < blocks; i += 1) {
    const w = W * (0.014 + rand() * 0.05);
    const h = horizon * (0.015 + rand() * 0.085);
    ctx.fillRect(x, horizon - h, w, h);
    if (rand() > 0.35) {
      const windows = 2 + Math.floor(rand() * 5);
      for (let k = 0; k < windows; k += 1) {
        const wx = x + w * (0.18 + rand() * 0.7);
        const wy = horizon - h + h * (0.15 + rand() * 0.7);
        ctx.fillStyle = 'rgba(255,208,138,0.85)';
        ctx.fillRect(wx, wy, Math.max(1, W * 0.0022), Math.max(1, W * 0.0022));
        ctx.fillStyle = 'rgba(26,10,36,0.85)';
      }
    }
    x += w + W * (0.004 + rand() * 0.02);
    if (x > W * 1.02) break;
  }
  ctx.restore();
}

// A tapered trunk (two beziers) and 8-11 fronds, each a two-curve leaf with a lighter rim.
function drawPalm(ctx, x, y, h, lean, rand, large) {
  const dark = large ? '#140818' : '#180b20';
  const rim = large ? '#2d1433' : '#2b1230';
  const tipX = x + lean;
  const tipY = y - h;
  const baseW = h * (large ? 0.055 : 0.075);
  const tipW = h * 0.018;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - baseW / 2, y);
  ctx.quadraticCurveTo(x - baseW * 0.15, y - h * 0.55, tipX - tipW / 2, tipY);
  ctx.lineTo(tipX + tipW / 2, tipY);
  ctx.quadraticCurveTo(x + baseW * 0.35, y - h * 0.55, x + baseW / 2, y);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();

  const fronds = 8 + Math.floor(rand() * 4);
  for (let i = 0; i < fronds; i += 1) {
    const spread = -Math.PI + (i / (fronds - 1)) * Math.PI;
    const len = h * (0.30 + rand() * 0.26) * (large ? 1.15 : 1);
    const droop = len * (0.22 + rand() * 0.4);
    const ex = tipX + Math.cos(spread) * len;
    const ey = tipY + Math.sin(spread) * len * 0.42 + droop;
    const c1x = tipX + Math.cos(spread - 0.25) * len * 0.55;
    const c1y = tipY + Math.sin(spread - 0.25) * len * 0.3 - len * 0.12;
    const c2x = ex - Math.cos(spread) * len * 0.28;
    const c2y = ey - len * 0.18;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    ctx.bezierCurveTo(
      ex - Math.cos(spread + 0.32) * len * 0.3,
      ey + len * 0.14,
      tipX + Math.cos(spread + 0.5) * len * 0.42,
      tipY + len * 0.1,
      tipX,
      tipY,
    );
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(0.6, h * 0.006);
    ctx.stroke();
  }
  ctx.restore();
}

// One big palm leaning in from the right edge, well outside the caption block.
function drawForegroundPalm(ctx, W, H, rand) {
  ctx.save();
  const baseX = W * 1.03;
  const baseY = H * 1.08;
  const tipX = W * 0.805;
  const tipY = H * 0.13;
  const baseW = W * 0.085;
  ctx.beginPath();
  ctx.moveTo(baseX - baseW / 2, baseY);
  ctx.bezierCurveTo(W * 0.95, H * 0.72, W * 0.87, H * 0.42, tipX - W * 0.008, tipY);
  ctx.lineTo(tipX + W * 0.008, tipY);
  ctx.bezierCurveTo(W * 0.90, H * 0.44, W * 0.985, H * 0.74, baseX + baseW / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = '#140818';
  ctx.fill();
  // a faint warm edge on the trunk where the sun catches it
  ctx.beginPath();
  ctx.moveTo(baseX - baseW / 2, baseY);
  ctx.bezierCurveTo(W * 0.95, H * 0.72, W * 0.87, H * 0.42, tipX - W * 0.008, tipY);
  ctx.strokeStyle = 'rgba(255,176,58,0.16)';
  ctx.lineWidth = Math.max(1, W * 0.0022);
  ctx.stroke();

  const fronds = 9 + Math.floor(rand() * 3);
  for (let i = 0; i < fronds; i += 1) {
    const spread = Math.PI * 0.92 + (i / (fronds - 1)) * Math.PI * 1.16;
    const len = H * (0.30 + rand() * 0.22);
    const ex = tipX + Math.cos(spread) * len;
    const ey = tipY + Math.sin(spread) * len * 0.46 + len * 0.26;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.bezierCurveTo(
      tipX + Math.cos(spread - 0.2) * len * 0.6,
      tipY + Math.sin(spread - 0.2) * len * 0.4 - len * 0.1,
      ex - Math.cos(spread) * len * 0.3,
      ey - len * 0.15,
      ex,
      ey,
    );
    ctx.bezierCurveTo(
      ex - Math.cos(spread + 0.3) * len * 0.34,
      ey + len * 0.16,
      tipX + Math.cos(spread + 0.45) * len * 0.46,
      tipY + len * 0.14,
      tipX,
      tipY,
    );
    ctx.closePath();
    ctx.fillStyle = '#140818';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,110,0.13)';
    ctx.lineWidth = Math.max(1, H * 0.0025);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHaze(ctx, W, horizon) {
  const haze = ctx.createLinearGradient(0, horizon - horizon * 0.09, 0, horizon + horizon * 0.04);
  haze.addColorStop(0, 'rgba(255,244,228,0)');
  haze.addColorStop(0.62, 'rgba(255,244,228,0.14)');
  haze.addColorStop(1, 'rgba(255,244,228,0)');
  ctx.save();
  ctx.globalAlpha = 0.06 / 0.14;
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - horizon * 0.09, W, horizon * 0.13);
  ctx.restore();
}

function drawBirds(ctx, W, H, rand) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,8,24,0.72)';
  ctx.lineWidth = Math.max(1, W * 0.0018);
  for (let i = 0; i < 3; i += 1) {
    const x = W * (0.14 + rand() * 0.48);
    const y = H * (0.12 + rand() * 0.22);
    const spread = W * (0.012 + rand() * 0.008);
    ctx.beginPath();
    ctx.moveTo(x - spread, y + spread * 0.35);
    ctx.quadraticCurveTo(x - spread * 0.45, y - spread * 0.35, x, y);
    ctx.quadraticCurveTo(x + spread * 0.45, y - spread * 0.35, x + spread, y + spread * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}
