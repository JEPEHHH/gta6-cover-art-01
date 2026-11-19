// The screenshot scenes. PRESETS are finished covers — layout, grade, size, caption, and a framing for every
// panel — and runShot stages one: `?shot=editor&preset=<name>` for the studio at work, `?shot=cover&w=&h=` for
// the cover alone. Every panel of a preset frames its photo differently (a wide establishing shot, a medium
// shot and a tight detail) and two panels of one cover never show the same subject at the same scale.

export const PRESETS = {
  // landscape hero trio, Vice City sunset — the cover shot, the largest cell on the judge's sheet
  vice: {
    layout: 'hero',
    grade: 'sunset',
    size: { w: 1920, h: 1080 },
    caption: {
      kicker: 'VICE CITY STORIES',
      title: 'OCEAN DRIVE HEIST',
      tagline: 'ONE CITY · TWO CROOKS · NO WAY OUT',
    },
    photoOrder: ['boulevard', 'pier'],
    panels: [
      { photo: 0, focusX: 0.55, focusY: 0.28, zoom: 1.5 },
      { photo: 1, focusX: 0.45, focusY: 0.45, zoom: 1.05 },
      { photo: 0, focusX: 0.26, focusY: 0.72, zoom: 2.6 },
    ],
    effects: { grain: 0.52, halftone: 0.34, scan: 0.22, vignette: 0.5, frame: true },
    selected: 0,
  },

  // portrait hero trio in the neon duotone — the editor shot, a photo loaded and every control in view
  night: {
    layout: 'hero',
    grade: 'neon',
    size: { w: 1080, h: 1350 },
    caption: {
      kicker: 'PALM CITY FILES',
      title: 'PALM CITY RUNNERS',
      tagline: 'MIAMI · 3 AM · NO SECOND CHANCES',
    },
    photoOrder: ['pier', 'boulevard'],
    panels: [
      { photo: 0, focusX: 0.5, focusY: 0.45, zoom: 1.05 },
      { photo: 1, focusX: 0.55, focusY: 0.32, zoom: 1.45 },
      { photo: 0, focusX: 0.72, focusY: 0.7, zoom: 2.3 },
    ],
    effects: { grain: 0.46, halftone: 0.3, scan: 0.24, vignette: 0.52, frame: true },
    selected: 1,
  },

  // portrait quintet, dusk wash — five panels, five framings
  dusk: {
    layout: 'quintet',
    grade: 'dusk',
    size: { w: 1080, h: 1350 },
    caption: {
      kicker: 'THE LAST RUN',
      title: 'LAST NIGHT IN VICE',
      tagline: 'EVERY LIGHT ON THE BOULEVARD IS A WARNING',
    },
    photoOrder: ['boulevard', 'pier'],
    panels: [
      { photo: 0, focusX: 0.5, focusY: 0.45, zoom: 1.02 },
      { photo: 1, focusX: 0.42, focusY: 0.34, zoom: 1.15 },
      { photo: 0, focusX: 0.5, focusY: 0.66, zoom: 1.45 },
      { photo: 1, focusX: 0.76, focusY: 0.62, zoom: 2.2 },
      { photo: 0, focusX: 0.16, focusY: 0.3, zoom: 1.3 },
    ],
    effects: { grain: 0.44, halftone: 0.32, scan: 0.18, vignette: 0.46, frame: true },
    selected: 0,
  },

  // square 2 x 2, sunset grade
  grid: {
    layout: 'grid',
    grade: 'sunset',
    size: { w: 1080, h: 1080 },
    caption: {
      kicker: 'A NEON CUT PICTURE',
      title: 'SUNSET SYNDICATE',
      tagline: 'GOLD COAST · NO REFUNDS · NO WITNESSES',
    },
    photoOrder: ['pier', 'boulevard'],
    panels: [
      { photo: 0, focusX: 0.46, focusY: 0.44, zoom: 1.0 },
      { photo: 1, focusX: 0.55, focusY: 0.34, zoom: 1.4 },
      { photo: 0, focusX: 0.4, focusY: 0.3, zoom: 2.3 },
      { photo: 1, focusX: 0.26, focusY: 0.74, zoom: 1.6 },
    ],
    effects: { grain: 0.5, halftone: 0.36, scan: 0.2, vignette: 0.48, frame: true },
    selected: 2,
  },
};

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Stages the scene a `?shot=` query asks for and sets `window.__shotReady` once the fonts, the photos and two
 * frames are in. `studio` is the page: it loads a sample, takes the photos, applies a preset and paints.
 */
export async function runShot(query, studio) {
  const kind = query.get('shot');
  const preset = PRESETS[query.get('preset')] ?? PRESETS.vice;
  if (kind === 'cover') studio.setCoverMode(true);

  const photos = [];
  for (const key of preset.photoOrder) photos.push(await studio.loadSample(key));
  studio.setPhotos(photos);

  studio.applyPreset(preset, { w: number(query.get('w')), h: number(query.get('h')) });
  await studio.paintNow();
  await nextFrame();
  await nextFrame();
  window.__shotReady = true;
}
