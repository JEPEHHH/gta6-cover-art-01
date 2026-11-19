// The compositor: painted backdrop, four graded prints pasted over it, the unifying wash, the title block and the
// finish (scanlines, vignette, frame). One call paints a whole cover at any output size.

import { drawBackdrop, seedFromCaption } from './backdrop.js';
import { layoutPanels } from './layouts.js';
import { gradeCanvas, drawGrain, drawHalftone, measureStock, matchStock, drawScanlines, drawVignette } from './grade.js';
import {
  drawPastedPrint,
  drawEmptyPrint,
  drawCaptionPlate,
  drawBottomScrim,
  drawUnifyingWash,
  drawPosterFrame,
} from './effects.js';
import { drawCaption, drawStudioBadge } from './caption.js';

const TILT = (1.4 * Math.PI) / 180;

export function drawCover(ctx, W, H, state, opts = {}) {
  const layout = layoutPanels(state.layout, W, H);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackdrop(ctx, W, H, state.grade, seedFromCaption(state.caption));
  if (layout.plateTop) drawCaptionPlate(ctx, W, H, layout.plateTop);

  const prints = layout.panels.map((box, index) => buildPrint(box, state, index, W, H));
  const target = meanStock(prints);
  for (const print of prints) {
    if (print) matchStock(print.canvas, target);
  }

  layout.panels.forEach((box, index) => {
    const angle = state.layout === 'collage' ? (index % 2 === 0 ? -TILT : TILT) : 0;
    const print = prints[index];
    if (print) drawPastedPrint(ctx, print.canvas, box, angle, W);
    else drawEmptyPrint(ctx, box, angle, W, state.grade === 'sunset');
  });

  drawUnifyingWash(ctx, unionOf(layout.panels), W, H);
  if (layout.wide && !layout.plateTop) drawBottomScrim(ctx, W, H, layout.captionBox.y - H * 0.015);
  drawCaption(ctx, W, H, state.caption, layout.captionBox, { wide: layout.wide });
  drawStudioBadge(ctx, W, H, layout.side);

  drawScanlines(ctx, layout.grid, state.effects.scan);
  drawVignette(ctx, W, H, state.effects.vignette);
  if (state.effects.frame) drawPosterFrame(ctx, W, H, layout.side);
  ctx.restore();
  return layout;
}

// One photo, cropped to the panel by its focus point and zoom, graded, then printed with grain and halftone.
function buildPrint(box, state, index, W, H) {
  const panel = state.panels?.[index] ?? { photo: null };
  const entry = panel.photo === null || panel.photo === undefined ? null : state.photos[panel.photo];
  const img = entry?.img;
  if (!img || !img.complete || !img.naturalWidth) return null;

  const cw = Math.max(1, Math.round(box.w));
  const ch = Math.max(1, Math.round(box.h));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const c = canvas.getContext('2d');

  const zoom = clamp(panel.zoom ?? 1, 0.6, 4);
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const fx = clamp(panel.focusX ?? 0.5, 0, 1);
  const fy = clamp(panel.focusY ?? 0.5, 0, 1);
  let dx = cw / 2 - fx * dw;
  let dy = ch / 2 - fy * dh;
  dx = Math.min(0, Math.max(cw - dw, dx));
  dy = Math.min(0, Math.max(ch - dh, dy));

  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.filter = `blur(${(0.4 * Math.min(1.6, W / 1080)).toFixed(2)}px)`;
  c.drawImage(img, dx, dy, dw, dh);
  c.filter = 'none';

  gradeCanvas(canvas, state.grade);
  drawHalftone(c, { x: 0, y: 0, w: cw, h: ch }, state.effects.halftone);
  drawGrain(c, { x: 0, y: 0, w: cw, h: ch }, state.effects.grain);
  return { canvas };
}

function meanStock(prints) {
  const present = prints.filter(Boolean).map((print) => measureStock(print.canvas));
  if (!present.length) return { luma: 0.42, sat: 0.5 };
  return {
    luma: present.reduce((sum, p) => sum + p.luma, 0) / present.length,
    sat: present.reduce((sum, p) => sum + p.sat, 0) / present.length,
  };
}

function unionOf(panels) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of panels) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w);
    y1 = Math.max(y1, p.y + p.h);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
