// Print effects: pasted-panel drawing (shadow, keyline, grain, halftone), the cohesion pass
// that makes separate photos read as one printed sheet, and the frame finish.

import { makeGrainTile, makeHalftoneTile, drawScanlines, drawVignette } from './grade.js';

export function makeTiles(seed) {
  return {
    grain: makeGrainTile(128, seed),
    halftone: makeHalftoneTile(12, seed ^ 0x9e37),
  };
}

// Mean luminance and saturation of a small downsample, used to pull panels together.
export function measureLight(source) {
  const probe = document.createElement('canvas');
  probe.width = 24;
  probe.height = 24;
  const g = probe.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, 24, 24);
  const data = g.getImageData(0, 0, 24, 24).data;
  let luma = 0;
  let sat = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const gg = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    luma += 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    sat += max > 0.001 ? (max - min) / max : 0;
    count += 1;
  }
  return { luma: luma / count, sat: sat / count };
}

// One pasted print: hard offset shadow, soft shadow, clipped photo, grain, halftone, keyline.
export function drawPastedPanel(ctx, panel, drawPhoto, opts) {
  const w = panel.w;
  const h = panel.h;
  const tiles = opts.tiles;
  const effects = opts.effects || {};
  const shadowX = opts.shadowX ?? Math.round(w * 0.03);
  const shadowY = opts.shadowY ?? Math.round(h * 0.03);

  ctx.save();
  ctx.translate(panel.x + w / 2, panel.y + h / 2);
  ctx.rotate(((panel.rotation || 0) * Math.PI) / 180);
  const dx = -w / 2;
  const dy = -h / 2;

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#05030a';
  ctx.fillRect(dx + shadowX, dy + shadowY, w, h);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(4, 2, 10, 0.5)';
  ctx.shadowBlur = Math.max(10, w * 0.07);
  ctx.shadowOffsetY = Math.max(4, h * 0.02);
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(dx, dy, w, h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, w, h);
  ctx.clip();
  drawPhoto(ctx, dx, dy, w, h);

  const halftone = Number(effects.halftone ?? 0);
  if (halftone > 0.01 && tiles) {
    const pattern = ctx.createPattern(tiles.halftone, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.5, halftone * 0.5);
      ctx.fillStyle = pattern;
      ctx.fillRect(dx, dy, w, h);
      ctx.restore();
    }
  }
  const grain = Number(effects.grain ?? 0);
  if (grain > 0.01 && tiles) {
    const pattern = ctx.createPattern(tiles.grain, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.55, grain * 0.55);
      ctx.fillStyle = pattern;
      ctx.fillRect(dx, dy, w, h);
      ctx.restore();
    }
  }
  ctx.restore();

  if (effects.frame !== false) {
    ctx.lineWidth = Math.max(2, Math.min(6, w * 0.006));
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.9)';
    ctx.strokeRect(dx + ctx.lineWidth / 2, dy + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  ctx.restore();
}

// The unifying wash: one magenta-to-amber breath over the poster area, plus a cool lift in
// the shadows, so no print looks like it came from a different roll of film.
export function drawCohesionWash(ctx, area, strength = 1) {
  const grad = ctx.createLinearGradient(area.x, area.y, area.x + area.w, area.y + area.h);
  grad.addColorStop(0, '#ff2d78');
  grad.addColorStop(0.55, '#8e1d5c');
  grad.addColorStop(1, '#ffb03a');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = Math.min(0.16, 0.09 * strength);
  ctx.fillStyle = grad;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.05 * strength;
  ctx.fillStyle = '#1b3350';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.restore();
}

// Bottom scrim for the 16:9 caption, and the dark plate for square/portrait captions.
export function drawScrim(ctx, W, H, fromY) {
  const grad = ctx.createLinearGradient(0, fromY, 0, H);
  grad.addColorStop(0, 'rgba(8, 4, 14, 0)');
  grad.addColorStop(0.4, 'rgba(8, 4, 14, 0.22)');
  grad.addColorStop(0.68, 'rgba(8, 4, 14, 0.58)');
  grad.addColorStop(1, 'rgba(6, 3, 12, 0.9)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, fromY, W, H - fromY);
  ctx.restore();
}

// A horizontal falloff under the 16:9 caption: dense at the left margin, clear by 78% of the
// width, so the painted ocean keeps breathing on the right of the title.
export function drawSideScrim(ctx, W, H, fromY) {
  const grad = ctx.createLinearGradient(0, 0, W * 0.78, 0);
  grad.addColorStop(0, 'rgba(6, 3, 12, 0.74)');
  grad.addColorStop(0.6, 'rgba(6, 3, 12, 0.3)');
  grad.addColorStop(1, 'rgba(6, 3, 12, 0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, fromY, W, H - fromY);
  ctx.restore();
}

// Two soft light leaks in the corners of the poster, so the frame never dies in flat black.
export function drawEdgeGlow(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const warm = ctx.createRadialGradient(W * 0.9, H * 1.02, 0, W * 0.9, H * 1.02, W * 0.46);
  warm.addColorStop(0, 'rgba(255, 43, 108, 0.34)');
  warm.addColorStop(0.55, 'rgba(140, 24, 96, 0.12)');
  warm.addColorStop(1, 'rgba(20, 4, 26, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  const cool = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.42);
  cool.addColorStop(0, 'rgba(37, 120, 200, 0.2)');
  cool.addColorStop(1, 'rgba(4, 10, 26, 0)');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawCaptionPlate(ctx, W, H, plateTop) {
  const grad = ctx.createLinearGradient(0, plateTop, 0, H);
  grad.addColorStop(0, '#150a22');
  grad.addColorStop(0.35, '#0d0616');
  grad.addColorStop(1, '#08040e');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, plateTop, W, H - plateTop);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff2d78';
  ctx.fillRect(0, plateTop, W, Math.max(2, H * 0.0022));
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Frame finish: vignette, scanlines over the photo area, a last breath of grain.
export function finishFrame(ctx, W, H, effects, area, tiles) {
  drawScanlines(ctx, W, H, Number(effects.scan ?? 0), area);
  if (tiles) {
    const grain = Number(effects.grain ?? 0);
    if (grain > 0.01) {
      const pattern = ctx.createPattern(tiles.grain, 'repeat');
      if (pattern) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = Math.min(0.3, grain * 0.22);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }
  drawVignette(ctx, W, H, Number(effects.vignette ?? 0));
}
