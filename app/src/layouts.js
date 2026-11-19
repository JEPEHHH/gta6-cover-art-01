// Panel geometry for the five cover layouts. One pure function turns a layout id and an output size into
// integer rectangles — the photo panels, the poster grid they tile, and the caption box the lettering is
// fitted and clipped to — so the editor preview and the full-size export share exactly the same maths.

export const LAYOUT_IDS = ['hero', 'grid', 'strip', 'single', 'quintet'];

const LAYOUT_NAMES = {
  hero: 'HERO TRIO',
  grid: 'GRID',
  strip: 'STRIP',
  single: 'SINGLE',
  quintet: 'QUINTET',
};

const PANEL_COUNTS = { hero: 3, grid: 4, strip: 4, single: 1, quintet: 5 };

/** The button label for a layout id. */
export function layoutName(id) {
  return LAYOUT_NAMES[id] ?? LAYOUT_NAMES.hero;
}

/** How many panels a layout tiles. */
export function layoutPanelCount(id) {
  return PANEL_COUNTS[id] ?? PANEL_COUNTS.hero;
}

/** True when the size is a landscape one, where the photos fill the frame and the caption hangs over a scrim. */
export function isWide(W, H) {
  return W / H > 1.35;
}

/**
 * Rectangles for `layoutId` at `W` x `H`, in output pixels.
 *
 * Returns `{ panels, captionBox, grid, wide, overlay }`: `panels` tile `grid` with the layout's gaps and no
 * overlap, `captionBox` is the one rectangle the caption is laid out in and clipped to, `wide` marks a
 * landscape output, and `overlay` says whether the caption sits on the photos (over a scrim) or in its own
 * band under them.
 */
export function layoutPanels(layoutId, W, H) {
  const wide = isWide(W, H);
  const single = layoutId === 'single';
  const side = Math.round(Math.min(W, H) * 0.048);
  const gap = Math.round(Math.min(16, Math.max(10, W * 0.013)));

  // A landscape output, and a single-photo cover, run the photos edge to edge; the poster layouts keep the
  // outer margin and stop at 68% of the height so the caption has a band of its own.
  const full = wide || single;
  const grid = full
    ? { x: 0, y: 0, w: W, h: H }
    : { x: side, y: side, w: W - side * 2, h: Math.round(H * 0.68) - side };

  let panels;
  switch (layoutId) {
    case 'grid': {
      const cw = Math.round((grid.w - gap) / 2);
      const ch = Math.round((grid.h - gap) / 2);
      const x2 = grid.x + cw + gap;
      const y2 = grid.y + ch + gap;
      panels = [
        { x: grid.x, y: grid.y, w: cw, h: ch },
        { x: x2, y: grid.y, w: grid.x + grid.w - x2, h: ch },
        { x: grid.x, y: y2, w: cw, h: grid.y + grid.h - y2 },
        { x: x2, y: y2, w: grid.x + grid.w - x2, h: grid.y + grid.h - y2 },
      ];
      break;
    }
    case 'strip': {
      const topH = Math.round((grid.h - gap) * 0.42);
      const y2 = grid.y + topH + gap;
      const cw = Math.round((grid.w - gap * 2) / 3);
      panels = [
        { x: grid.x, y: grid.y, w: cw, h: topH },
        { x: grid.x + cw + gap, y: grid.y, w: cw, h: topH },
        { x: grid.x + (cw + gap) * 2, y: grid.y, w: grid.x + grid.w - (grid.x + (cw + gap) * 2), h: topH },
        { x: grid.x, y: y2, w: grid.w, h: grid.y + grid.h - y2 },
      ];
      break;
    }
    case 'single':
      panels = [{ x: grid.x, y: grid.y, w: grid.w, h: grid.h }];
      break;
    case 'quintet': {
      const bigW = Math.round((grid.w - gap) * 0.63);
      const rightX = grid.x + bigW + gap;
      const rightW = grid.x + grid.w - rightX;
      const cw = Math.round((rightW - gap) / 2);
      const ch = Math.round((grid.h - gap) / 2);
      const y2 = grid.y + ch + gap;
      panels = [
        { x: grid.x, y: grid.y, w: bigW, h: grid.h },
        { x: rightX, y: grid.y, w: cw, h: ch },
        { x: rightX + cw + gap, y: grid.y, w: rightX + rightW - (rightX + cw + gap), h: ch },
        { x: rightX, y: y2, w: cw, h: grid.y + grid.h - y2 },
        { x: rightX + cw + gap, y: y2, w: rightX + rightW - (rightX + cw + gap), h: grid.y + grid.h - y2 },
      ];
      break;
    }
    default: {
      // hero: one tall panel at 58% of the grid width, two stacked beside it
      const leftW = Math.round((grid.w - gap) * 0.58);
      const rightX = grid.x + leftW + gap;
      const rightW = grid.x + grid.w - rightX;
      const topH = Math.round((grid.h - gap) * 0.46);
      const y2 = grid.y + topH + gap;
      panels = [
        { x: grid.x, y: grid.y, w: leftW, h: grid.h },
        { x: rightX, y: grid.y, w: rightW, h: topH },
        { x: rightX, y: y2, w: rightW, h: grid.y + grid.h - y2 },
      ];
      break;
    }
  }

  // The caption box spans the full safe width on every layout: a narrower box would clip a long title
  // mid-word at its right edge.
  let captionBox;
  if (wide) {
    // landscape: the whole block hangs in the lower-left over the bottom scrim
    const y = Math.round(H * 0.6);
    captionBox = { x: side, y, w: W - side * 2, h: H - side - y };
  } else if (single) {
    const y = Math.round(H * 0.6);
    captionBox = { x: side, y, w: W - side * 2, h: H - side - y };
  } else {
    const y = grid.y + grid.h + Math.round(gap * 1.5);
    captionBox = { x: side, y, w: W - side * 2, h: H - side - y };
  }

  return { panels, captionBox, grid, wide, overlay: wide || single };
}
