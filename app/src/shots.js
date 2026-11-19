// Cover presets and the ?shot= scenes. Every preset alternates the two sample photos and gives
// each panel its own framing: one wide establishing shot, one medium, one tight detail.

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
    panels: [
      { photo: 0, focusX: 0.46, focusY: 0.5, zoom: 1.08 },
      { photo: 1, focusX: 0.5, focusY: 0.42, zoom: 1.58 },
      { photo: 0, focusX: 0.62, focusY: 0.38, zoom: 2.45 },
      { photo: 1, focusX: 0.34, focusY: 0.6, zoom: 2.05 },
    ],
    effects: { grain: 0.42, halftone: 0.3, scan: 0.18, vignette: 0.5, frame: true },
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
    panels: [
      { photo: 1, focusX: 0.5, focusY: 0.44, zoom: 1.06 },
      { photo: 0, focusX: 0.44, focusY: 0.5, zoom: 1.62 },
      { photo: 1, focusX: 0.58, focusY: 0.36, zoom: 2.6 },
      { photo: 0, focusX: 0.3, focusY: 0.62, zoom: 2.2 },
    ],
    effects: { grain: 0.4, halftone: 0.34, scan: 0.22, vignette: 0.56, frame: true },
    selected: 0,
  },
  grid: {
    layout: 'collage',
    grade: 'sunset',
    size: { w: 1080, h: 1080 },
    caption: {
      kicker: 'SUNSET STRIP · 21:15',
      title: 'SUNSET / SYNDICATE',
      tagline: 'THE DEAL GOES DOWN AT DUSK',
    },
    panels: [
      { photo: 0, focusX: 0.52, focusY: 0.46, zoom: 1.1 },
      { photo: 1, focusX: 0.46, focusY: 0.5, zoom: 1.45 },
      { photo: 0, focusX: 0.36, focusY: 0.58, zoom: 2.3 },
      { photo: 1, focusX: 0.62, focusY: 0.4, zoom: 2.75 },
    ],
    effects: { grain: 0.44, halftone: 0.32, scan: 0.16, vignette: 0.48, frame: true },
    selected: 0,
  },
  dusk: {
    layout: 'hero',
    grade: 'dusk',
    size: { w: 1080, h: 1350 },
    caption: {
      kicker: 'GOLD COAST · 19:40',
      title: 'DUSK / CONVOY',
      tagline: 'NOBODY LEAVES WITH THE KEYS',
    },
    panels: [
      { photo: 1, focusX: 0.48, focusY: 0.5, zoom: 1.05 },
      { photo: 0, focusX: 0.5, focusY: 0.44, zoom: 1.5 },
      { photo: 1, focusX: 0.54, focusY: 0.4, zoom: 2.1 },
    ],
    effects: { grain: 0.38, halftone: 0.26, scan: 0.14, vignette: 0.44, frame: true },
    selected: 0,
  },
};

export function presetFor(name) {
  const base = PRESETS[name] || PRESETS.vice;
  return {
    layout: base.layout,
    grade: base.grade,
    size: { ...base.size },
    caption: { ...base.caption },
    panels: base.panels.map((panel) => ({ ...panel })),
    effects: { ...base.effects },
    selected: base.selected || 0,
  };
}

// runShot(query, api): the two scenes the capture step opens. api is handed in by main.js so
// this module never imports the studio back and the modules stay a one-way graph.
export function runShot(query, api) {
  const params = new URLSearchParams(query || '');
  const shot = params.get('shot');
  if (shot !== 'cover' && shot !== 'editor') return null;
  const preset = presetFor(params.get('preset') || 'vice');
  if (shot === 'cover') {
    const w = Number(params.get('w')) || preset.size.w;
    const h = Number(params.get('h')) || preset.size.h;
    api.coverScene(w, h, preset);
    return { shot, preset: preset.caption.title, w, h };
  }
  api.editorScene(preset);
  return { shot, preset: preset.caption.title };
}
