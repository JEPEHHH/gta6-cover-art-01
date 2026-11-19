// Wires the studio: the photo shelf, the layout and grade pickers, the panel inspector, the caption fields,
// the effects rack, the live preview loop and the PNG export. Photos are read from the person's own machine
// and never leave it — the page makes no request at all. A `?shot=` query hands the page to ./shots.js, which
// stages a fixed cover or editor scene for a screenshot and then sets window.__shotReady.

import { drawCover } from './engine.js';
import { layoutPanelCount, layoutName, layoutPanels } from './layouts.js';
import { gradeName } from './grade.js';
import { runShot } from './shots.js';

const MAX_PHOTOS = 6;
const PREVIEW_LONG_SIDE = 1000;

const SAMPLES = [
  { key: 'pier', label: 'PIER', url: './samples/pier.jpg' },
  { key: 'boulevard', label: 'BOULEVARD', url: './samples/boulevard.jpg' },
];

// starting captions for the randomize button and the first cover
const IDEAS = [
  { kicker: 'VICE CITY STORIES', title: 'OCEAN DRIVE HEIST', tagline: 'ONE CITY · TWO CROOKS · NO WAY OUT' },
  { kicker: 'PALM CITY FILES', title: 'NEON TIDE', tagline: 'THE WATER REMEMBERS EVERYTHING' },
  { kicker: 'SEASON SIX', title: 'LAST NIGHT IN VICE', tagline: 'EVERY LIGHT IS A WARNING' },
  { kicker: 'A NEON CUT PICTURE', title: 'SUNSET SYNDICATE', tagline: 'GOLD COAST · NO REFUNDS · NO WITNESSES' },
  { kicker: 'NIGHT SHIFT', title: 'HARBOUR LIGHTS', tagline: 'TWO CITIES · ONE BAD IDEA' },
];

const state = {
  photos: [],
  panels: [{ photo: null, focusX: 0.5, focusY: 0.5, zoom: 1 }],
  layout: 'hero',
  grade: 'sunset',
  caption: { ...IDEAS[0] },
  size: { w: 1080, h: 1080 },
  effects: { grain: 0.5, halftone: 0.35, scan: 0.2, vignette: 0.45, frame: true },
  selected: 0,
};

const el = {
  canvas: byId('preview'),
  dropZone: byId('drop-zone'),
  fileInput: byId('file-input'),
  thumbs: byId('thumbs'),
  photoCount: byId('photo-count'),
  loadSamples: byId('load-samples'),
  layoutGrid: byId('layout-grid'),
  gradeGrid: byId('grade-grid'),
  photoChips: byId('photo-chips'),
  panelIndex: byId('panel-index'),
  focusX: byId('focus-x'),
  focusY: byId('focus-y'),
  zoom: byId('zoom'),
  valFx: byId('val-fx'),
  valFy: byId('val-fy'),
  valZoom: byId('val-zoom'),
  fit: byId('fit'),
  kicker: byId('cap-kicker'),
  title: byId('cap-title'),
  tagline: byId('cap-tagline'),
  fxGrain: byId('fx-grain'),
  fxHalftone: byId('fx-halftone'),
  fxScan: byId('fx-scan'),
  fxVignette: byId('fx-vignette'),
  fxFrame: byId('fx-frame'),
  valGrain: byId('val-grain'),
  valHalftone: byId('val-halftone'),
  valScan: byId('val-scan'),
  valVignette: byId('val-vignette'),
  hudSize: byId('hud-size'),
  hudLayout: byId('hud-layout'),
  hudGrade: byId('hud-grade'),
  hudPanel: byId('hud-panel'),
  hudTime: byId('hud-time'),
  sizes: byId('sizes'),
  exportBtn: byId('export'),
  randomize: byId('randomize'),
  toast: byId('toast'),
};

let coverOnly = false;
let drag = null;
let lastDrawMs = 0;
let frameQueued = false;
let toastTimer = 0;

function byId(id) {
  return document.getElementById(id);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image did not load: ${url}`));
    img.src = url;
  });
}

function photoLabel(fileName) {
  const base = String(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase();
  return base.slice(0, 16) || 'PHOTO';
}

/* -------------------------------------------------------------------------------------- panels & photos */

/** Panel count follows the layout; the photos are kept by re-mapping panel indices modulo the photo count. */
function syncPanels() {
  const count = layoutPanelCount(state.layout);
  const total = state.photos.length;
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const previous = state.panels[i];
    const photo = !total ? null : previous && typeof previous.photo === 'number' ? previous.photo % total : i % total;
    next.push({
      photo,
      focusX: previous ? previous.focusX : 0.5,
      focusY: previous ? previous.focusY : 0.5,
      zoom: previous ? previous.zoom : 1,
    });
  }
  state.panels = next;
  state.selected = Math.min(state.selected, count - 1);
}

function afterPhotosChanged() {
  syncPanels();
  renderThumbs();
  syncInspector();
  scheduleDraw();
}

async function addFiles(fileList) {
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) return;
  const files = Array.from(fileList).filter((file) => file.type.startsWith('image/')).slice(0, room);
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push({ img, url, name: photoLabel(file.name) });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (files.length) afterPhotosChanged();
}

async function addSamples() {
  for (const sample of SAMPLES) {
    if (state.photos.length >= MAX_PHOTOS) break;
    if (state.photos.some((photo) => photo.url === sample.url)) continue;
    try {
      const img = await loadImage(sample.url);
      state.photos.push({ img, url: sample.url, name: sample.label });
    } catch {
      return;
    }
  }
  afterPhotosChanged();
}

function removePhoto(index) {
  const [photo] = state.photos.splice(index, 1);
  if (photo && photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
  for (const panel of state.panels) {
    if (typeof panel.photo !== 'number') continue;
    if (panel.photo === index) panel.photo = state.photos.length ? index % state.photos.length : null;
    else if (panel.photo > index) panel.photo -= 1;
  }
  afterPhotosChanged();
}

/* --------------------------------------------------------------------------------------------- rendering */

function previewSize() {
  const scale = Math.min(1, PREVIEW_LONG_SIDE / Math.max(state.size.w, state.size.h));
  return { w: Math.round(state.size.w * scale), h: Math.round(state.size.h * scale) };
}

function paint() {
  const canvas = el.canvas;
  const target = coverOnly ? state.size : previewSize();
  if (canvas.width !== target.w || canvas.height !== target.h) {
    canvas.width = target.w;
    canvas.height = target.h;
  }
  const started = performance.now();
  drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state);
  lastDrawMs = performance.now() - started;
  updateHud();
}

function scheduleDraw() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    paint();
  });
}

function updateHud() {
  el.hudSize.textContent = `${state.size.w} × ${state.size.h}`;
  el.hudLayout.textContent = layoutName(state.layout);
  el.hudGrade.textContent = gradeName(state.grade);
  el.hudPanel.textContent = `PANEL ${state.selected + 1} / ${state.panels.length}`;
  el.hudTime.textContent = `${Math.max(1, Math.round(lastDrawMs))} ms`;
}

/* ----------------------------------------------------------------------------------------------- the rails */

function renderThumbs() {
  el.thumbs.textContent = '';
  state.photos.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'thumb';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    img.decoding = 'async';
    const badge = document.createElement('span');
    badge.className = 'thumb-badge';
    badge.textContent = String(index + 1);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'thumb-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${photo.name}`);
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removePhoto(index);
    });
    item.append(img, badge, remove);
    el.thumbs.append(item);
  });
  el.photoCount.textContent = String(state.photos.length).padStart(2, '0');
}

function renderChips() {
  const panel = state.panels[state.selected];
  el.photoChips.textContent = '';
  if (!state.photos.length) {
    const empty = document.createElement('span');
    empty.className = 'chip-empty';
    empty.textContent = 'NO PHOTOS YET';
    el.photoChips.append(empty);
    return;
  }
  state.photos.forEach((photo, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    if (panel && panel.photo === index) chip.classList.add('on');
    chip.textContent = String.fromCharCode(65 + index);
    chip.title = photo.name;
    chip.addEventListener('click', () => {
      if (!state.panels[state.selected]) return;
      state.panels[state.selected].photo = index;
      renderChips();
      renderThumbs();
      scheduleDraw();
    });
    el.photoChips.append(chip);
  });
  const off = document.createElement('button');
  off.type = 'button';
  off.className = 'chip chip-off';
  if (panel && panel.photo === null) off.classList.add('on');
  off.textContent = '—';
  off.title = 'Leave this panel empty';
  off.addEventListener('click', () => {
    if (!state.panels[state.selected]) return;
    state.panels[state.selected].photo = null;
    renderChips();
    scheduleDraw();
  });
  el.photoChips.append(off);
}

function syncInspector() {
  const panel = state.panels[state.selected] ?? { focusX: 0.5, focusY: 0.5, zoom: 1 };
  el.panelIndex.textContent = String(state.selected + 1);
  el.focusX.value = String(Math.round(panel.focusX * 100));
  el.focusY.value = String(Math.round(panel.focusY * 100));
  el.zoom.value = String(Math.round(panel.zoom * 100));
  el.valFx.textContent = `${Math.round(panel.focusX * 100)}%`;
  el.valFy.textContent = `${Math.round(panel.focusY * 100)}%`;
  el.valZoom.textContent = `${panel.zoom.toFixed(2)}×`;
  renderChips();
}

function syncChoosers() {
  for (const button of el.layoutGrid.querySelectorAll('[data-layout]')) {
    button.classList.toggle('on', button.dataset.layout === state.layout);
  }
  for (const button of el.gradeGrid.querySelectorAll('[data-grade]')) {
    button.classList.toggle('on', button.dataset.grade === state.grade);
  }
  for (const button of el.sizes.querySelectorAll('[data-size]')) {
    button.classList.toggle('on', button.dataset.size === `${state.size.w}x${state.size.h}`);
  }
}

function syncEffects() {
  el.fxGrain.value = String(Math.round(state.effects.grain * 100));
  el.fxHalftone.value = String(Math.round(state.effects.halftone * 100));
  el.fxScan.value = String(Math.round(state.effects.scan * 100));
  el.fxVignette.value = String(Math.round(state.effects.vignette * 100));
  el.fxFrame.checked = state.effects.frame !== false;
  el.valGrain.textContent = `${Math.round(state.effects.grain * 100)}`;
  el.valHalftone.textContent = `${Math.round(state.effects.halftone * 100)}`;
  el.valScan.textContent = `${Math.round(state.effects.scan * 100)}`;
  el.valVignette.textContent = `${Math.round(state.effects.vignette * 100)}`;
}

function syncCaptionFields() {
  el.kicker.value = state.caption.kicker;
  el.title.value = state.caption.title;
  el.tagline.value = state.caption.tagline;
}

function syncAll() {
  syncChoosers();
  syncEffects();
  syncCaptionFields();
  syncInspector();
  renderThumbs();
  scheduleDraw();
}

/* ----------------------------------------------------------------------------------------------- preview */

function canvasPoint(event) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * el.canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * el.canvas.height,
  };
}

/** The panels at the preview canvas's own size: the same rectangles the compositor tiles, so hits match. */
function panelsOf() {
  return layoutPanels(state.layout, el.canvas.width, el.canvas.height).panels;
}

function panelAt(point) {
  return panelsOf().findIndex(
    (p) => point.x >= p.x && point.x <= p.x + p.w && point.y >= p.y && point.y <= p.y + p.h,
  );
}

/* ---------------------------------------------------------------------------------------------- exporting */

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function exportPng() {
  const { w, h } = state.size;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const started = performance.now();
  drawCover(canvas.getContext('2d'), w, h, state);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    toast('EXPORT FAILED · TRY ANOTHER SIZE');
    return;
  }
  const ms = performance.now() - started;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `neon-cut-${state.layout}-${w}x${h}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`PNG ${w} × ${h} · ${formatBytes(blob.size)} · ${(ms / 1000).toFixed(1)}s`);
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('on'), 3400);
}

/* ------------------------------------------------------------------------------------------------ random */

function randomize() {
  const layouts = ['hero', 'grid', 'strip', 'single', 'quintet'];
  const grades = ['sunset', 'neon', 'dusk', 'noir'];
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  syncPanels();
  state.caption = { ...IDEAS[Math.floor(Math.random() * IDEAS.length)] };
  for (const panel of state.panels) {
    panel.zoom = 1 + Math.random() * 1.7;
    panel.focusX = clamp01(0.5 + (Math.random() - 0.5) * 0.5);
    panel.focusY = clamp01(0.5 + (Math.random() - 0.5) * 0.5);
  }
  syncAll();
}

/* -------------------------------------------------------------------------------------------------- wiring */

function bindUi() {
  el.dropZone.addEventListener('click', () => el.fileInput.click());
  el.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.fileInput.click();
    }
  });
  el.fileInput.addEventListener('change', () => {
    addFiles(el.fileInput.files);
    el.fileInput.value = '';
  });
  for (const type of ['dragenter', 'dragover']) {
    el.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      el.dropZone.classList.add('hot');
    });
  }
  for (const type of ['dragleave', 'dragend']) {
    el.dropZone.addEventListener(type, () => el.dropZone.classList.remove('hot'));
  }
  el.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    el.dropZone.classList.remove('hot');
    addFiles(event.dataTransfer.files);
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  el.loadSamples.addEventListener('click', () => addSamples());

  el.layoutGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-layout]');
    if (!button) return;
    state.layout = button.dataset.layout;
    syncPanels();
    syncChoosers();
    syncInspector();
    scheduleDraw();
  });

  el.gradeGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-grade]');
    if (!button) return;
    state.grade = button.dataset.grade;
    syncChoosers();
    scheduleDraw();
  });

  el.sizes.addEventListener('click', (event) => {
    const button = event.target.closest('[data-size]');
    if (!button) return;
    const [w, h] = button.dataset.size.split('x').map(Number);
    state.size = { w, h };
    syncChoosers();
    scheduleDraw();
  });

  el.focusX.addEventListener('input', () => setPanelField('focusX', Number(el.focusX.value) / 100));
  el.focusY.addEventListener('input', () => setPanelField('focusY', Number(el.focusY.value) / 100));
  el.zoom.addEventListener('input', () => setPanelField('zoom', Math.max(1, Number(el.zoom.value) / 100)));

  el.fit.addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.focusX = 0.5;
    panel.focusY = 0.5;
    panel.zoom = 1;
    syncInspector();
    scheduleDraw();
  });

  el.kicker.addEventListener('input', () => {
    state.caption.kicker = el.kicker.value;
    scheduleDraw();
  });
  el.title.addEventListener('input', () => {
    state.caption.title = el.title.value;
    scheduleDraw();
  });
  el.tagline.addEventListener('input', () => {
    state.caption.tagline = el.tagline.value;
    scheduleDraw();
  });

  el.fxGrain.addEventListener('input', () => setEffect('grain', Number(el.fxGrain.value) / 100));
  el.fxHalftone.addEventListener('input', () => setEffect('halftone', Number(el.fxHalftone.value) / 100));
  el.fxScan.addEventListener('input', () => setEffect('scan', Number(el.fxScan.value) / 100));
  el.fxVignette.addEventListener('input', () => setEffect('vignette', Number(el.fxVignette.value) / 100));
  el.fxFrame.addEventListener('change', () => setEffect('frame', el.fxFrame.checked));

  el.exportBtn.addEventListener('click', () => exportPng());
  el.randomize.addEventListener('click', () => randomize());

  el.canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const index = panelAt(point);
    if (index < 0) return;
    state.selected = index;
    drag = { index, x: point.x, y: point.y };
    el.canvas.setPointerCapture(event.pointerId);
    syncInspector();
    scheduleDraw();
  });

  el.canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const panel = state.panels[drag.index];
    const rect = panelsOf()[drag.index] ?? null;
    if (!panel || !rect) return;
    const point = canvasPoint(event);
    const gain = 1 / Math.max(1, panel.zoom * 0.9);
    panel.focusX = clamp01(panel.focusX - ((point.x - drag.x) / rect.w) * gain);
    panel.focusY = clamp01(panel.focusY - ((point.y - drag.y) / rect.h) * gain);
    drag.x = point.x;
    drag.y = point.y;
    syncInspector();
    scheduleDraw();
  });

  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    el.canvas.addEventListener(type, () => {
      drag = null;
    });
  }

  el.canvas.addEventListener(
    'wheel',
    (event) => {
      const point = canvasPoint(event);
      const index = panelAt(point);
      if (index < 0) return;
      event.preventDefault();
      const panel = state.panels[index];
      state.selected = index;
      panel.zoom = clamp(panel.zoom * (1 - event.deltaY * 0.0016), 1, 3);
      syncInspector();
      scheduleDraw();
    },
    { passive: false },
  );

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'e') {
      event.preventDefault();
      exportPng();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const panel = state.panels[state.selected];
    if (!panel) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves = {
      ArrowLeft: () => (panel.focusX = clamp01(panel.focusX - step)),
      ArrowRight: () => (panel.focusX = clamp01(panel.focusX + step)),
      ArrowUp: () => (panel.focusY = clamp01(panel.focusY - step)),
      ArrowDown: () => (panel.focusY = clamp01(panel.focusY + step)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
    syncInspector();
    scheduleDraw();
  });
}

function setPanelField(key, value) {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel[key] = value;
  syncInspector();
  scheduleDraw();
}

function setEffect(key, value) {
  state.effects[key] = value;
  syncEffects();
  scheduleDraw();
}

/* ------------------------------------------------------------------------------- the scene for shots.js */

const studio = {
  state,
  async loadSample(key) {
    const sample = SAMPLES.find((entry) => entry.key === key) ?? SAMPLES[0];
    const img = await loadImage(sample.url);
    return { img, url: sample.url, name: sample.label };
  },
  setPhotos(photos) {
    state.photos = photos;
  },
  /** Applies a preset cover on top of the studio, with the shot's own output size when it names one. */
  applyPreset(preset, size) {
    state.layout = preset.layout;
    state.grade = preset.grade;
    state.effects = { ...state.effects, ...preset.effects };
    state.caption = { ...preset.caption };
    const w = size?.w || preset.size?.w || state.size.w;
    const h = size?.h || preset.size?.h || state.size.h;
    state.size = { w, h };
    syncPanels();
    (preset.panels ?? []).forEach((spec, index) => {
      if (state.panels[index]) Object.assign(state.panels[index], spec);
    });
    state.selected = Math.min(preset.selected ?? 0, state.panels.length - 1);
    syncAll();
  },
  setCoverMode(on) {
    coverOnly = on;
    document.body.classList.toggle('shot-cover', on);
  },
  paintNow() {
    paint();
  },
};

/* ---------------------------------------------------------------------------------------------------- boot */

async function boot() {
  // the lettering must be in before the first draw, or the cover is measured against a fallback face
  await Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('600 20px "Barlow Condensed"'),
    document.fonts.load('700 20px "Barlow Condensed"'),
  ]);
  await document.fonts.ready;

  bindUi();
  syncPanels();
  syncAll();

  const query = new URLSearchParams(location.search);
  if (query.get('shot')) await runShot(query, studio);
}

boot();
