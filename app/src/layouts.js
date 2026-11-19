// Panel geometry. Every rect is an integer, never negative, and panels never overlap each
// other or the caption box. The poster grid is the photo area; captionBox is the single
// rectangle the title is fitted to AND clipped against.

export const LAYOUTS = ['collage', 'hero', 'grid', 'strip', 'single', 'quintet'];

export const LAYOUT_NAMES = {
  collage: 'COLLAGE',
  hero: 'HERO TRIO',
  grid: 'GRID',
  strip: 'STRIP',
  single: 'SINGLE',
  quintet: 'QUINTET',
};

const GAP = 0.0133;

function rect(x, y, w, h) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  return {
    x: rx,
    y: ry,
    w: Math.max(1, Math.round(x + w) - rx),
    h: Math.max(1, Math.round(y + h) - ry),
  };
}

// Split a rect into columns/rows with a fixed gutter, in output pixels.
function split(box, cols, rows, gap) {
  const cw = (box.w - gap * (cols - 1)) / cols;
  const ch = (box.h - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push(rect(box.x + c * (cw + gap), box.y + r * (ch + gap), cw, ch));
    }
  }
  return cells;
}

function collageWide(W, H) {
  // The poster composition from the art direction: a hero print, two medium prints and one
  // small stamp, all pasted on the painted scene with the title block hanging under them.
  return [
    rect(0.055 * W, 0.1 * H, 0.4 * W, 0.6 * H),
    rect(0.48 * W, 0.08 * H, 0.28 * W, 0.3 * H),
    rect(0.48 * W, 0.41 * H, 0.28 * W, 0.29 * H),
    rect(0.79 * W, 0.52 * H, 0.16 * W, 0.18 * H),
  ];
}

function collageNarrow(grid) {
  // Same print rhythm, packed into the top grid: the bottom-right corner stays open so the
  // painted sun shows through the collage.
  const g = grid;
  return [
    rect(g.x + 0.02 * g.w, g.y + 0.02 * g.h, 0.56 * g.w, 0.56 * g.h),
    rect(g.x + 0.61 * g.w, g.y + 0.02 * g.h, 0.37 * g.w, 0.26 * g.h),
    rect(g.x + 0.61 * g.w, g.y + 0.31 * g.h, 0.37 * g.w, 0.27 * g.h),
    rect(g.x + 0.02 * g.w, g.y + 0.61 * g.h, 0.4 * g.w, 0.37 * g.h),
  ];
}

export function layoutPanels(layoutId, W, H) {
  const wide = W / H > 1.3;
  const side = Math.round(0.048 * W);
  const gap = Math.round(GAP * W);
  const kind = LAYOUTS.includes(layoutId) ? layoutId : 'collage';

  const grid = wide
    ? rect(0, 0, W, H)
    : rect(side, side, W - side * 2, H * 0.68 - side * 1.1);

  const captionBox = wide
    ? rect(side, H * 0.716, W - side * 2, H * 0.95 - H * 0.716)
    : rect(side, H * 0.688, W - side * 2, H * 0.95 - H * 0.688);

  let panels = [];

  if (kind === 'collage') {
    panels = wide ? collageWide(W, H) : collageNarrow(grid);
  } else if (kind === 'hero') {
    const heroW = grid.w * 0.58 - gap * 0.5;
    const colH = (grid.h - gap) / 2;
    panels = [
      rect(grid.x, grid.y, heroW, grid.h),
      rect(grid.x + heroW + gap, grid.y, grid.w - heroW - gap, colH),
      rect(grid.x + heroW + gap, grid.y + colH + gap, grid.w - heroW - gap, grid.h - colH - gap),
    ];
  } else if (kind === 'grid') {
    panels = split(grid, 2, 2, gap);
  } else if (kind === 'strip') {
    const top = split(rect(grid.x, grid.y, grid.w, grid.h * 0.42), 3, 1, gap);
    const below = rect(grid.x, grid.y + grid.h * 0.42 + gap, grid.w, grid.h * 0.58 - gap);
    panels = top.concat([below]);
  } else if (kind === 'quintet') {
    const heroW = grid.w * 0.63 - gap * 0.5;
    const small = split(rect(grid.x + heroW + gap, grid.y, grid.w - heroW - gap, grid.h), 2, 2, gap);
    panels = [rect(grid.x, grid.y, heroW, grid.h)].concat(small);
  } else {
    panels = [rect(grid.x, grid.y, grid.w, grid.h)];
  }

  const rotation = kind === 'collage' ? 1.4 : kind === 'strip' ? 0.6 : 0.35;
  const pasted = panels.map((p, i) => ({
    ...p,
    rotation: i % 2 === 0 ? rotation : -rotation,
  }));

  return { panels: pasted, captionBox, grid, wide, side, gap, kind, overlay: wide };
}
