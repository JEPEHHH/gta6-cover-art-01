// The three poster presets the studio ships with, and the ?shot= scenes the screenshots are taken from.
// Framing rule: the two sample photos alternate and every panel gets its own distance — wide, medium, tight.

export const PRESETS = {
  vice: {
    layout: 'collage',
    grade: 'sunset',
    size: { w: 1920, h: 1080 },
    caption: {
      kicker: 'VICE CITY · 1986',
      title: 'LAST LIGHT / ON OCEAN DRIVE',
      tagline: 'A HEIST, A HURRICANE, ONE NIGHT LEFT',
    },
    photoOrder: [0, 1],
    panels: [
      { photo: 1, focusX: 0.5, focusY: 0.42, zoom: 1.03 },
      { photo: 0, focusX: 0.34, focusY: 0.4, zoom: 1.55 },
      { photo: 1, focusX: 0.47, focusY: 0.31, zoom: 2.4 },
      { photo: 1, focusX: 0.5, focusY: 0.74, zoom: 2.9 },
    ],
    effects: { grain: 0.55, halftone: 0.34, scan: 0.18, vignette: 0.5, frame: true },
    selected: 0,
  },
  night: {
    layout: 'collage',
    grade: 'neon',
    size: { w: 1080, h: 1350 },
    caption: {
      kicker: 'NEON DISTRICT · 03:40',
      title: 'PALM CITY / RUNNERS',
      tagline: 'TWO BROTHERS, ONE PAYDAY',
    },
    photoOrder: [0, 1],
    panels: [
      { photo: 0, focusX: 0.44, focusY: 0.46, zoom: 1.06 },
      { photo: 1, focusX: 0.5, focusY: 0.34, zoom: 1.58 },
      { photo: 0, focusX: 0.32, focusY: 0.32, zoom: 2.15 },
      { photo: 1, focusX: 0.46, focusY: 0.62, zoom: 2.75 },
    ],
    effects: { grain: 0.5, halftone: 0.36, scan: 0.22, vignette: 0.55, frame: true },
    selected: 1,
  },
  grid: {
    layout: 'collage',
    grade: 'dusk',
    size: { w: 1080, h: 1080 },
    caption: {
      kicker: 'SUNSET STRIP · 21:15',
      title: 'SUNSET / SYNDICATE',
      tagline: 'THE DEAL GOES DOWN AT DUSK',
    },
    photoOrder: [1, 0],
    panels: [
      { photo: 1, focusX: 0.48, focusY: 0.44, zoom: 1.08 },
      { photo: 0, focusX: 0.36, focusY: 0.36, zoom: 1.62 },
      { photo: 1, focusX: 0.44, focusY: 0.3, zoom: 2.5 },
      { photo: 0, focusX: 0.6, focusY: 0.55, zoom: 2.35 },
    ],
    effects: { grain: 0.52, halftone: 0.32, scan: 0.16, vignette: 0.5, frame: true },
    selected: 0,
  },
  noir: {
    layout: 'quintet',
    grade: 'noir',
    size: { w: 1080, h: 1080 },
    caption: {
      kicker: 'HARBOUR WATCH · 04:05',
      title: 'SALT / AND STATIC',
      tagline: 'EVERY WITNESS OWES SOMEBODY',
    },
    photoOrder: [0, 1],
    panels: [
      { photo: 0, focusX: 0.42, focusY: 0.4, zoom: 1.1 },
      { photo: 1, focusX: 0.5, focusY: 0.3, zoom: 1.65 },
      { photo: 0, focusX: 0.34, focusY: 0.33, zoom: 2.2 },
      { photo: 1, focusX: 0.46, focusY: 0.6, zoom: 2.6 },
      { photo: 0, focusX: 0.55, focusY: 0.7, zoom: 1.45 },
    ],
    effects: { grain: 0.6, halftone: 0.28, scan: 0.24, vignette: 0.6, frame: true },
    selected: 0,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function presetWithSize(name, w, h) {
  const preset = PRESETS[name] ?? PRESETS.vice;
  return { ...preset, size: { w: w ?? preset.size.w, h: h ?? preset.size.h } };
}

// ?shot=cover&w=<w>&h=<h>&preset=<name>   the cover alone, canvas at the output size, chrome hidden
// ?shot=editor&preset=<name>              the whole studio at the viewport size
export async function runShot(query, app) {
  const shot = query.get('shot');
  if (!shot) return false;
  const preset = presetWithSize(
    query.get('preset') ?? 'vice',
    numberOrNull(query.get('w')),
    numberOrNull(query.get('h')),
  );
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    app.applyPreset(preset, { coverOnly: true });
  } else {
    document.body.classList.add('shot-editor');
    app.applyPreset(preset, { coverOnly: false });
  }
  await app.loadSamples();
  await document.fonts.load('40px Anton');
  await document.fonts.load('600 20px "Barlow Condensed"');
  await document.fonts.ready;
  app.drawNow();
  await nextFrame();
  await nextFrame();
  window.__shotReady = true;
  return true;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
