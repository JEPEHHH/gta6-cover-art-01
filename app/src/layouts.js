// Where the panels and the title block sit on the sheet, for every layout and every output size.
// Rects are rounded to whole pixels, never negative, never crossing the safe margin.

export const LAYOUTS = ['collage', 'hero', 'grid', 'strip', 'single', 'quintet'];

export const LAYOUT_LABELS = {
  collage: 'COLLAGE',
  hero: 'HERO TRIO',
  grid: 'GRID',
  strip: 'STRIP',
  single: 'SINGLE',
  quintet: 'QUINTET',
};

export function isWide(W, H) {
  return W / H > 1.35;
}

export function layoutPanels(layoutId, W, H) {
  const wide = isWide(W, H);
  const side = Math.round(Math.min(W, H) * 0.048);
  if (layoutId === 'collage') return wide ? collageWide(W, H, side) : collageTall(W, H, side);
  return wide ? standardWide(layoutId, W, H, side) : standardTall(layoutId, W, H, side);
}

// Landscape: the prints hang over the painted scene and the title block takes the band under the hero panel.
function collageWide(W, H, side) {
  const panels = [
    rect(0.055 * W, 0.085 * H, 0.40 * W, 0.545 * H),
    rect(0.48 * W, 0.07 * H, 0.28 * W, 0.26 * H),
    rect(0.48 * W, 0.365 * H, 0.28 * W, 0.265 * H),
    rect(0.79 * W, 0.44 * H, 0.16 * W, 0.19 * H),
  ];
  const captionBox = rect(0.055 * W, 0.645 * H, 0.89 * W, 0.952 * H - 0.645 * H);
  return {
    panels,
    captionBox,
    grid: rect(0, 0, W, H),
    wide: true,
    overlay: true,
    side,
    plateTop: captionBox.y,
  };
}

// Square and portrait: the painted scene fills the top, the prints collage over it, the caption sits on a dark
// plate below. Four prints at three scales so no two read at the same distance.
function collageTall(W, H, side) {
  const plateTop = Math.round(H * 0.665);
  const panels = [
    rect(0.055 * W, 0.075 * H, 0.545 * W, 0.42 * H),
    rect(0.635 * W, 0.155 * H, 0.31 * W, 0.195 * H),
    rect(0.635 * W, 0.37 * H, 0.31 * W, 0.20 * H),
    rect(0.055 * W, 0.515 * H, 0.245 * W, 0.105 * H),
  ];
  const captionBox = rect(side, plateTop + Math.round(H * 0.022), W - side * 2, H - plateTop - Math.round(H * 0.022) - side);
  return { panels, captionBox, grid: rect(side, side, W - side * 2, plateTop - side * 1.6), wide: false, overlay: false, side, plateTop };
}

function standardTall(layoutId, W, H, side) {
  const plateTop = Math.round(H * 0.68);
  const grid = rect(side, side, W - side * 2, plateTop - side * 1.5);
  const captionBox = rect(side, plateTop + Math.round(H * 0.02), W - side * 2, H - plateTop - Math.round(H * 0.02) - side);
  const panels = arrange(layoutId, grid, side);
  return { panels, captionBox, grid, wide: false, overlay: layoutId === 'single', side, plateTop };
}

function standardWide(layoutId, W, H, side) {
  const grid = rect(0, 0, W, H);
  const captionBox = rect(side, Math.round(H * 0.63), W - side * 2, Math.round(H * 0.952) - Math.round(H * 0.63));
  const panels = arrange(layoutId, grid, side);
  return { panels, captionBox, grid, wide: true, overlay: layoutId === 'single', side, plateTop: 0 };
}

function arrange(layoutId, grid, side) {
  const gap = Math.max(6, Math.round(grid.w * 0.013));
  const gx = grid.x + (layoutId === 'single' ? 0 : 0);
  const gy = grid.y;
  const gw = grid.w;
  const gh = grid.h;
  if (layoutId === 'single') return [rect(gx, gy, gw, gh)];
  if (layoutId === 'grid') {
    const cw = (gw - gap) / 2;
    const ch = (gh - gap) / 2;
    return [
      rect(gx, gy, cw, ch),
      rect(gx + cw + gap, gy, cw, ch),
      rect(gx, gy + ch + gap, cw, ch),
      rect(gx + cw + gap, gy + ch + gap, cw, ch),
    ];
  }
  if (layoutId === 'strip') {
    const topH = gh * 0.42 - gap / 2;
    const cw = (gw - gap * 2) / 3;
    return [
      rect(gx, gy, cw, topH),
      rect(gx + cw + gap, gy, cw, topH),
      rect(gx + cw * 2 + gap * 2, gy, cw, topH),
      rect(gx, gy + topH + gap, gw, gh - topH - gap),
    ];
  }
  if (layoutId === 'quintet') {
    const mainW = gw * 0.63 - gap / 2;
    const colX = gx + mainW + gap;
    const colW = gw - mainW - gap;
    const smallH = (gh - gap) / 2;
    const smallW = (colW - gap) / 2;
    return [
      rect(gx, gy, mainW, gh),
      rect(colX, gy, smallW, smallH),
      rect(colX + smallW + gap, gy, smallW, smallH),
      rect(colX, gy + smallH + gap, smallW, smallH),
      rect(colX + smallW + gap, gy + smallH + gap, smallW, smallH),
    ];
  }
  // hero (default): a wide left panel and a right column of two
  const leftW = gw * 0.58 - gap / 2;
  const rightX = gx + leftW + gap;
  const rightW = gw - leftW - gap;
  const topH = gh * 0.56 - gap / 2;
  return [
    rect(gx, gy, leftW, gh),
    rect(rightX, gy, rightW, topH),
    rect(rightX, gy + topH + gap, rightW, gh - topH - gap),
  ];
}

function rect(x, y, w, h) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
  };
}
