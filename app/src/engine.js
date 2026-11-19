// The compositor: painted scene, graded pasted prints, cohesion pass, caption, frame finish.
// This is the only place that knows how a cover is assembled; everything it uses is a module
// beside it.

import { drawBackdrop } from './backdrop.js';
import { layoutPanels } from './layouts.js';
import { gradeCanvas, seedFromText } from './grade.js';
import { drawCaption } from './caption.js';
import {
  makeTiles,
  measureLight,
  drawPastedPanel,
  drawCohesionWash,
  drawScrim,
  drawSideScrim,
  drawCaptionPlate,
  drawEdgeGlow,
  finishFrame,
} from './effects.js';

// Cover-fit one photo into a panel with the panel's own focus point and zoom.
function drawPhotoCover(g, image, w, h, settings) {
  const iw = image.naturalWidth || image.width || w;
  const ih = image.naturalHeight || image.height || h;
  const zoom = Math.min(3, Math.max(1, Number(settings.zoom) || 1));
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const fx = Math.min(1, Math.max(0, settings.focusX ?? 0.5));
  const fy = Math.min(1, Math.max(0, settings.focusY ?? 0.5));
  g.drawImage(image, (w - dw) * fx, (h - dh) * fy, dw, dh);
}

// One panel at device size: raw crop, then the grade, ready for the cohesion pass.
function renderGradedPanel(image, panel, settings, gradeId) {
  const raw = document.createElement('canvas');
  raw.width = Math.max(2, panel.w);
  raw.height = Math.max(2, panel.h);
  const g = raw.getContext('2d');
  g.fillStyle = '#1b0f26';
  g.fillRect(0, 0, raw.width, raw.height);
  if (image) drawPhotoCover(g, image, raw.width, raw.height, settings);
  return gradeCanvas(raw, gradeId, 0.4);
}

// Empty studio: a painted plate instead of a photo, so a fresh cover still looks composed.
function drawEmptyPlate(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#3d0d47');
  grad.addColorStop(0.6, '#8e1d5c');
  grad.addColorStop(1, '#ff5f6d');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#fff1c9';
  ctx.lineWidth = Math.max(2, w * 0.012);
  for (let i = -h; i < w; i += Math.max(14, w * 0.1)) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCover(ctx, W, H, state, opts = {}) {
  const layout = layoutPanels(state.layout, W, H);
  const caption = state.caption || {};
  const seed = seedFromText(`${caption.kicker || ''}|${caption.title || ''}|${caption.tagline || ''}`);
  const effects = state.effects || {};
  const tiles = makeTiles(seed);
  const grade = state.grade || 'sunset';

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // 1. the painted scene: full frame on 16:9, the top poster area on square and portrait.
  if (layout.wide) {
    drawBackdrop(ctx, W, H, grade, seed, { box: { x: 0, y: 0, w: W, h: H }, horizon: 0.68, sunX: 0.72 });
  } else {
    drawBackdrop(ctx, W, H, grade, seed, { box: { x: 0, y: 0, w: W, h: H * 0.68 }, horizon: 0.8, sunX: 0.77 });
  }

  // 2. every panel graded on its own, then measured for the cohesion pass.
  const panels = state.panels || [];
  const photos = state.photos || [];
  const settings = layout.panels.map((panel, index) => {
    const own = panels[index] || {};
    const fallback = photos.length ? index % photos.length : null;
    return {
      photo: own.photo === null || own.photo === undefined ? fallback : own.photo,
      focusX: own.focusX ?? 0.5,
      focusY: own.focusY ?? 0.5,
      zoom: own.zoom ?? 1,
    };
  });

  const graded = settings.map((setting, index) => {
    const photo = photos[setting.photo];
    const image = photo ? photo.img || photo : null;
    return image ? renderGradedPanel(image, layout.panels[index], setting, grade) : null;
  });

  const lights = graded.filter(Boolean).map((canvas) => measureLight(canvas));
  const meanLuma = lights.length ? lights.reduce((sum, l) => sum + l.luma, 0) / lights.length : 0.5;
  const meanSat = lights.length ? lights.reduce((sum, l) => sum + l.sat, 0) / lights.length : 0.4;

  layout.panels.forEach((panel, index) => {
    const canvas = graded[index];
    const light = canvas ? measureLight(canvas) : null;
    const brightness = light && meanLuma > 0.02
      ? Math.min(1.18, Math.max(0.84, 1 + ((meanLuma - light.luma) / meanLuma) * 0.5))
      : 1;
    const saturation = light && light.sat > 0.02
      ? Math.min(1.16, Math.max(0.82, 1 + ((meanSat - light.sat) / light.sat) * 0.2))
      : 1;

    drawPastedPanel(
      ctx,
      panel,
      (c, dx, dy, w, h) => {
        if (!canvas) {
          drawEmptyPlate(c, dx, dy, w, h);
          return;
        }
        c.save();
        c.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`;
        c.drawImage(canvas, dx, dy, w, h);
        c.restore();
      },
      {
        tiles,
        effects,
        shadowX: Math.round(0.012 * W),
        shadowY: Math.round(0.014 * W),
      },
    );
  });

  // 3. one printed sheet: unifying wash over the poster area.
  drawCohesionWash(ctx, layout.grid, 1);

  // 4. caption ground: scrim on 16:9, dark plate on square and portrait.
  if (layout.wide) {
    drawScrim(ctx, W, H, Math.max(layout.captionBox.y - H * 0.17, H * 0.5));
    drawSideScrim(ctx, W, H, layout.captionBox.y - H * 0.03);
    drawEdgeGlow(ctx, W, H);
  } else {
    drawEdgeGlow(ctx, W, H);
    drawCaptionPlate(ctx, W, H, H * 0.68);
  }

  // 5. the title block.
  drawCaption(ctx, W, H, caption, layout.captionBox, {
    wide: layout.wide,
    grade,
    wordmark: opts.wordmark || 'NEON CUT',
    mark: opts.mark || 'NCT',
  });

  // 6. frame finish: scanlines over the photo area, grain, vignette.
  finishFrame(ctx, W, H, effects, layout.wide ? layout.grid : { x: 0, y: 0, w: W, h: H * 0.68 }, tiles);
  ctx.restore();

  return layout;
}
