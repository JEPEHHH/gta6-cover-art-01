// The compositor. drawCover paints one finished poster at any size: it tiles the layout's panels, cuts each
// photo into its panel with that panel's own focus and zoom, puts it through the shared grade and texture
// path, pastes it with a keyline and a hard offset shadow, unifies the collage so it reads as one printed
// sheet, letters the caption with Anton, and finishes the frame.

import { layoutPanels } from './layouts.js';
import {
  gradeCanvas,
  makeGrainTile,
  makeHalftoneTile,
  drawScanlines,
  drawVignette,
  measureLuma,
} from './grade.js';

const INK = '#0a0710';
const PLATE_TOP = '#0d0a17';
const PLATE_BOTTOM = '#07050c';
const TEXT = '#f4f1ea';
const WARM = '#ffd7a1';
const MAGENTA = '#ff2d78';
const CYAN = '#25e6ff';
const MARK = 'NEON CUT';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function upper(value) {
  return typeof value === 'string' ? value.toUpperCase().trim() : '';
}

/* ---------------------------------------------------------------------------------------------- panels */

/** Draws `img` covering a `w` x `h` panel, with the focus point held where the panel says and `zoom` on top. */
function drawPhotoCover(ctx, img, w, h, focusX, focusY, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih) * clamp(zoom, 1, 3);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = clamp(w / 2 - clamp(focusX, 0, 1) * dw, w - dw, 0);
  const dy = clamp(h / 2 - clamp(focusY, 0, 1) * dh, h - dh, 0);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** The halftone screen and the grain every panel shares, so no panel reads as a different stock. */
function texturePanel(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const grain = effects?.grain ?? 0.5;
  const halftone = effects?.halftone ?? 0.35;
  if (halftone > 0.01) {
    const pattern = ctx.createPattern(makeHalftoneTile(), 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.4, halftone * 0.52);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }
  if (grain > 0.01) {
    const pattern = ctx.createPattern(makeGrainTile(), 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.5, grain * 0.44);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }
}

/** Cuts one panel: cover-fit the photo at the panel's own framing, grade it, texture it. */
function cutPanel(photo, spec, rect, state) {
  const cut = createCanvas(rect.w, rect.h);
  const ctx = cut.getContext('2d');
  ctx.fillStyle = '#141020';
  ctx.fillRect(0, 0, rect.w, rect.h);
  drawPhotoCover(ctx, photo.img, rect.w, rect.h, spec.focusX ?? 0.5, spec.focusY ?? 0.5, spec.zoom ?? 1);
  const graded = gradeCanvas(cut, state.grade);
  texturePanel(graded, state.effects);
  return { canvas: graded, luma: measureLuma(graded) };
}

/** Pastes a cut panel: hard offset shadow, uniform softening, exposure pulled to the sheet, white keyline. */
function pastePanel(ctx, panel, rect, state, W, index, frameLuma) {
  const shadow = Math.round(clamp(W * 0.0135, 12, 18));
  const soften = Math.max(0.35, W / 2400);
  const exposure = clamp(1 + (frameLuma - panel.luma) * 0.7, 0.84, 1.18);

  ctx.save();
  if (state.layout === 'strip') {
    const angle = (index % 2 === 0 ? -1 : 1) * 0.0062;
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(angle);
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
  }
  ctx.fillStyle = 'rgba(3, 1, 6, 0.62)';
  ctx.fillRect(rect.x + shadow, rect.y + shadow, rect.w, rect.h);
  ctx.filter = `blur(${soften.toFixed(2)}px) brightness(${exposure.toFixed(3)}) saturate(0.82)`;
  ctx.drawImage(panel.canvas, rect.x, rect.y, rect.w, rect.h);
  ctx.filter = 'none';
  if (state.effects?.frame !== false) {
    const key = Math.max(2, Math.round(W * 0.0016));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = key;
    ctx.strokeRect(rect.x + key / 2, rect.y + key / 2, rect.w - key, rect.h - key);
  }
  ctx.restore();
}

/** A dark plate with a hairline cross where a panel has no photo yet. */
function drawEmptyPlate(ctx, rect, W) {
  ctx.save();
  ctx.fillStyle = '#12101c';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const step = Math.max(10, Math.round(W * 0.014));
  for (let x = rect.x - rect.h; x < rect.x + rect.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x + rect.h, rect.y + rect.h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.restore();
}

/** One very light magenta-to-amber wash plus a cool shade, laid over the poster area to tie the panels together. */
function drawCohesionWash(ctx, grid) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(grid.x, grid.y, grid.w, grid.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08;
  const warm = ctx.createLinearGradient(grid.x, grid.y, grid.x + grid.w, grid.y + grid.h);
  warm.addColorStop(0, MAGENTA);
  warm.addColorStop(1, '#ffb03a');
  ctx.fillStyle = warm;
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.1;
  const cool = ctx.createLinearGradient(0, grid.y, 0, grid.y + grid.h);
  cool.addColorStop(0, '#12406b');
  cool.addColorStop(1, 'rgba(10, 32, 58, 0.15)');
  ctx.fillStyle = cool;
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);
  ctx.restore();
}

/* --------------------------------------------------------------------------------------------- caption */

function setTracking(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px.toFixed(2)}px`;
}

function setTitleFont(ctx, size) {
  ctx.font = `400 ${size}px Anton, "Barlow Condensed", sans-serif`;
}

// Anton's cap height as a share of the font size, measured from the shipped face: the title is stacked and
// fitted by its ink, not by the font's (much taller) metric box.
const CAP_RATIO = 0.868;

function titleLineHeight(size) {
  return Math.round(size * 0.86);
}

function titleBlockHeight(size, lineCount) {
  if (lineCount <= 0) return 0;
  return (lineCount - 1) * titleLineHeight(size) + size * CAP_RATIO;
}

function trackedWidth(ctx, lines, size) {
  setTitleFont(ctx, size);
  setTracking(ctx, -0.012 * size);
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
  return widest;
}

/** The largest size at which the stack's ink fits the box width and height; 0 when nothing does. */
function sizeForLines(ctx, lines, maxW, maxH, maxSize, floorSize) {
  const fits = (size) => titleBlockHeight(size, lines.length) <= maxH && trackedWidth(ctx, lines, size) <= maxW;
  if (!fits(floorSize)) return 0;
  let lo = floorSize;
  let hi = Math.max(floorSize, maxSize);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Trims `text` to `maxW` at the current font, with an ellipsis. */
function ellipsiseTo(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let cut = text.length;
  while (cut > 1) {
    const candidate = `${text.slice(0, cut).trimEnd()}…`;
    if (ctx.measureText(candidate).width <= maxW) return candidate;
    cut -= 1;
  }
  return text.slice(0, 1);
}

/**
 * Picks the title's lines and size: every split into one or two lines is tried, and the split that allows the
 * largest type inside the box wins, with the longer line on top. If nothing fits, one ellipsised line.
 */
function fitTitle(ctx, text, maxW, maxH, W) {
  const maxSize = Math.max(18, Math.round(W * 0.135));
  const floorSize = Math.max(14, Math.round(W * 0.042));
  if (!text) return { lines: [], size: maxSize, lineHeight: 0, height: 0 };

  const words = text.split(/\s+/).filter(Boolean);
  const candidates = [];
  for (let cut = 1; cut < words.length; cut += 1) {
    candidates.push([words.slice(0, cut).join(' '), words.slice(cut).join(' ')]);
  }
  candidates.sort((a, b) => (b[0].length - b[1].length) - (a[0].length - a[1].length));
  candidates.push([text]);

  let best = null;
  for (const lines of candidates) {
    const size = sizeForLines(ctx, lines, maxW, maxH, maxSize, floorSize);
    if (size <= 0) continue;
    const wins = !best || size > best.size || (size === best.size && lines.length > best.lines.length);
    if (wins) best = { lines, size };
  }

  if (!best) {
    setTitleFont(ctx, floorSize);
    setTracking(ctx, -0.012 * floorSize);
    const lines = [ellipsiseTo(ctx, text, maxW)];
    return { lines, size: floorSize, lineHeight: titleLineHeight(floorSize), height: titleBlockHeight(floorSize, 1) };
  }
  return {
    lines: best.lines,
    size: best.size,
    lineHeight: titleLineHeight(best.size),
    height: titleBlockHeight(best.size, best.lines.length),
  };
}

/** One compensated copy, then the white glyph: a magenta shadow, a magenta/cyan fringe, the ink stroke. */
function drawTitleLine(ctx, text, x, y, size) {
  const unit = size / 150;
  setTracking(ctx, -0.012 * size);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = MAGENTA;
  ctx.fillText(text, x + 5 * unit, y + 6 * unit);
  ctx.globalAlpha = 0.34;
  ctx.fillText(text, x + 2.1 * unit, y);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = CYAN;
  ctx.fillText(text, x - 1.7 * unit, y);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, 3 * unit);
  ctx.strokeStyle = '#12060f';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

/** Lays the caption out in its one box: rule, kicker, title lines, tagline and the closing mark. */
function drawCaption(ctx, W, state, layout) {
  const box = layout.captionBox;
  const cap = state.caption ?? {};
  const kicker = upper(cap.kicker);
  const titleText = upper(cap.title);
  const taglineText = upper(cap.tagline);

  const kickerSize = Math.max(11, Math.round(W * 0.0235));
  const taglineSize = Math.max(12, Math.round(W * 0.026));
  const markSize = Math.max(9, Math.round(W * 0.017));
  const ruleH = Math.max(2, Math.round(W * 0.0022));
  const gapRule = Math.round(W * 0.015);
  const gapKicker = Math.round(W * 0.012);
  const gapTag = Math.round(W * 0.019);
  const gapMark = Math.round(W * 0.014);
  const kickerH = kicker ? Math.round(kickerSize * 1.12) : 0;
  const taglineH = Math.round(taglineSize * 1.12);
  const reserved = ruleH + gapRule + kickerH + (kicker ? gapKicker : 0) + gapTag + taglineH;
  const slack = Math.round(W * 0.008); // room for the title's ink stroke and its hard shadow

  const title = fitTitle(ctx, titleText, box.w, Math.max(Math.round(kickerSize * 1.6), box.h - reserved - slack), W);
  const blockH = reserved + title.height;
  const top = box.y + Math.max(0, box.h - blockH - slack * 0.6);

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // the hairline rule the block hangs from
  ctx.fillStyle = 'rgba(244, 241, 234, 0.26)';
  ctx.fillRect(box.x, top, box.w * 0.52, ruleH);
  ctx.fillStyle = MAGENTA;
  ctx.fillRect(box.x, top, Math.round(W * 0.052), ruleH);

  let cursor = top + ruleH + gapRule;

  if (kicker) {
    ctx.font = `700 ${kickerSize}px "Barlow Condensed", sans-serif`;
    setTracking(ctx, kickerSize * 0.24);
    ctx.fillStyle = WARM;
    ctx.fillText(kicker, box.x, cursor + kickerSize * 0.72);
    cursor += kickerH + gapKicker;
  }

  if (title.lines.length) {
    setTitleFont(ctx, title.size);
    for (let i = 0; i < title.lines.length; i += 1) {
      drawTitleLine(ctx, title.lines[i], box.x, cursor + title.size * CAP_RATIO + i * title.lineHeight, title.size);
    }
    cursor += title.height + gapTag;
  }

  // tagline row: the tagline, a hairline bridge, the studio mark on the right margin
  const baseline = cursor + taglineSize * 0.72;
  ctx.font = `700 ${markSize}px "Barlow Condensed", sans-serif`;
  setTracking(ctx, markSize * 0.34);
  const markW = Math.min(box.w, ctx.measureText(MARK).width);
  const markX = box.x + box.w - markW;

  ctx.font = `600 ${taglineSize}px "Barlow Condensed", sans-serif`;
  setTracking(ctx, taglineSize * 0.1);
  let tagW = 0;
  if (taglineText) {
    const room = box.w - markW - gapMark * 2;
    const tag = ellipsiseTo(ctx, taglineText, Math.max(box.w * 0.2, room));
    tagW = ctx.measureText(tag).width;
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = TEXT;
    ctx.fillText(tag, box.x, baseline);
    ctx.globalAlpha = 1;
  }

  const bridgeStart = box.x + tagW + gapMark;
  const bridgeEnd = markX - gapMark;
  if (bridgeEnd - bridgeStart > W * 0.02) {
    ctx.fillStyle = 'rgba(244, 241, 234, 0.22)';
    ctx.fillRect(bridgeStart, baseline - taglineSize * 0.3, bridgeEnd - bridgeStart, Math.max(1, Math.round(W * 0.0012)));
  }

  ctx.font = `700 ${markSize}px "Barlow Condensed", sans-serif`;
  setTracking(ctx, markSize * 0.34);
  ctx.globalAlpha = 0.66;
  ctx.fillStyle = TEXT;
  ctx.fillText(MARK, markX, baseline);
  ctx.globalAlpha = 1;
  setTracking(ctx, 0);
  ctx.restore();
}

/* ---------------------------------------------------------------------------------------------- frame */

/** The band under the poster that the caption sits in, with its hairline. */
function drawCaptionPlate(ctx, W, H, layout) {
  const y = layout.grid.y + layout.grid.h;
  const plate = ctx.createLinearGradient(0, y, 0, H);
  plate.addColorStop(0, PLATE_TOP);
  plate.addColorStop(1, PLATE_BOTTOM);
  ctx.fillStyle = plate;
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(layout.grid.x, y, layout.grid.w, Math.max(1, Math.round(W * 0.0012)));
}

/** The bottom scrim a caption hangs on over the photos. */
function drawScrim(ctx, W, H) {
  const scrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
  scrim.addColorStop(0, 'rgba(4, 2, 8, 0)');
  scrim.addColorStop(0.45, 'rgba(4, 2, 8, 0.5)');
  scrim.addColorStop(1, 'rgba(4, 2, 8, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);
}

/** The cover before any photo is dropped in: ink, hatch, a keyline frame and the studio mark. */
function drawEmptyState(ctx, W, H, layout, state) {
  const grid = layout.grid;
  const step = Math.max(8, Math.round(W * 0.018));
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = Math.max(1, W * 0.0011);
  for (let x = grid.x - grid.h; x < grid.x + grid.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, grid.y);
    ctx.lineTo(x + grid.h, grid.y + grid.h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(grid.x + 1, grid.y + 1, grid.w - 2, grid.h - 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT;
  ctx.font = `400 ${Math.round(W * 0.062)}px Anton, "Barlow Condensed", sans-serif`;
  setTracking(ctx, W * 0.014);
  ctx.fillText(MARK, W / 2, grid.y + grid.h * 0.54);
  ctx.font = `700 ${Math.round(W * 0.018)}px "Barlow Condensed", sans-serif`;
  setTracking(ctx, W * 0.0034);
  ctx.fillStyle = 'rgba(244, 241, 234, 0.5)';
  ctx.fillText('DROP PHOTOS TO START', W / 2, grid.y + grid.h * 0.54 + W * 0.042);
  ctx.fillStyle = MAGENTA;
  ctx.fillRect(W / 2 - W * 0.012, grid.y + grid.h * 0.54 + W * 0.062, W * 0.024, Math.max(2, W * 0.0022));
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ drawCover */

/**
 * Paints the whole cover at `W` x `H` from `state`. Pure: it reads the state and the photos it holds and
 * draws, so the same state gives the same poster for the preview and for the export.
 */
export function drawCover(ctx, W, H, state, opts = {}) {
  const layout = layoutPanels(state.layout, W, H);
  const photos = state.photos ?? [];

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  if (!photos.length) {
    if (!layout.overlay) drawCaptionPlate(ctx, W, H, layout);
    drawEmptyState(ctx, W, H, layout, state);
    ctx.restore();
    return;
  }

  if (!layout.overlay) drawCaptionPlate(ctx, W, H, layout);

  // pass 1: cut, grade and measure every panel
  const cut = [];
  for (let i = 0; i < layout.panels.length; i += 1) {
    const spec = state.panels?.[i] ?? { photo: i };
    const index = typeof spec.photo === 'number' ? spec.photo % photos.length : null;
    if (index === null || !photos[index]?.img) {
      cut.push(null);
      continue;
    }
    cut.push(cutPanel(photos[index], spec, layout.panels[i], state));
  }

  // the sheet's own exposure, which every panel is pulled towards
  const measured = cut.filter(Boolean);
  const frameLuma = measured.length ? measured.reduce((sum, p) => sum + p.luma, 0) / measured.length : 0.5;

  // pass 2: paste
  for (let i = 0; i < layout.panels.length; i += 1) {
    if (cut[i]) pastePanel(ctx, cut[i], layout.panels[i], state, W, i, frameLuma);
    else drawEmptyPlate(ctx, layout.panels[i], W);
  }

  drawCohesionWash(ctx, layout.grid);
  if (layout.overlay) drawScrim(ctx, W, H);
  drawVignette(ctx, 0, 0, W, H, state.effects?.vignette ?? 0.45);
  drawScanlines(ctx, layout.grid.x, layout.grid.y, layout.grid.w, layout.grid.h, (state.effects?.scan ?? 0.2) * 0.55);
  drawCaption(ctx, W, state, layout);

  ctx.restore();
}
