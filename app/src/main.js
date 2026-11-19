// The studio: one state object, the DOM wiring around it, photo loading, panel editing, and the export pipeline.
// A `?shot=` query hands the page to ./shots.js instead, which builds the scenes the screenshots are taken from.

import { drawCover } from './engine.js';
import { layoutPanels, LAYOUTS, LAYOUT_LABELS } from './layouts.js';
import { PRESETS, runShot } from './shots.js';

const MAX_PHOTOS = 6;
const PANEL_COUNT = { collage: 4, hero: 3, grid: 4, strip: 4, single: 1, quintet: 5 };
const SIZES = [
  { w: 1080, h: 1080, label: '1080 × 1080' },
  { w: 1080, h: 1350, label: '1080 × 1350' },
  { w: 1920, h: 1080, label: '1920 × 1080' },
];
const GRADES = [
  { id: 'sunset', label: 'SUNSET', stops: ['#ff2d78', '#ff8a5c', '#ffb03a'] },
  { id: 'neon', label: 'NEON', stops: ['#25e6ff', '#7d5cff', '#ff2f92'] },
  { id: 'dusk', label: 'DUSK', stops: ['#8a3355', '#e07466', '#ffb04a'] },
  { id: 'noir', label: 'NOIR', stops: ['#0b0c14', '#4a4453', '#c9b9a4'] },
];

const state = {
  photos: [],
  panels: [],
  layout: 'collage',
  grade: 'sunset',
  caption: { kicker: 'VICE CITY · 1986', title: 'LAST LIGHT / ON OCEAN DRIVE', tagline: 'A HEIST, A HURRICANE, ONE NIGHT LEFT' },
  size: { w: 1920, h: 1080 },
  effects: { grain: 0.55, halftone: 0.34, scan: 0.18, vignette: 0.5, frame: true },
  selected: 0,
};

const el = (id) => document.getElementById(id);
const ui = {
  preview: el('preview'),
  matte: el('matte'),
  hudLine: el('hud-line'),
  hudMs: el('hud-ms'),
  photoInput: el('photo-input'),
  photoGrid: el('photo-grid'),
  photoCount: el('photo-count'),
  photoDrop: el('photo-drop'),
  layoutList: el('layout-list'),
  gradeList: el('grade-list'),
  panelTitle: el('panel-title'),
  panelChips: el('panel-chips'),
  focusX: el('focus-x'),
  focusXValue: el('focus-x-value'),
  focusY: el('focus-y'),
  focusYValue: el('focus-y-value'),
  zoom: el('zoom'),
  zoomValue: el('zoom-value'),
  fit: el('fit-panel'),
  kicker: el('caption-kicker'),
  title: el('caption-title'),
  tagline: el('caption-tagline'),
  grain: el('fx-grain'),
  grainValue: el('fx-grain-value'),
  halftone: el('fx-halftone'),
  halftoneValue: el('fx-halftone-value'),
  scan: el('fx-scan'),
  scanValue: el('fx-scan-value'),
  vignette: el('fx-vignette'),
  vignetteValue: el('fx-vignette-value'),
  frame: el('fx-frame'),
  sizePills: el('size-pills'),
  exportBtn: el('export-png'),
  randomBtn: el('randomize'),
  toast: el('toast'),
};

let frameHandle = 0;
let toastTimer = 0;
let coverOnly = false;
let drag = null;

// ---------------------------------------------------------------- drawing

function paint() {
  const ctx = ui.preview.getContext('2d');
  const started = performance.now();
  drawCover(ctx, ui.preview.width, ui.preview.height, state);
  const ms = performance.now() - started;
  ui.hudMs.textContent = `${Math.round(ms)} MS`;
}

function requestDraw() {
  if (frameHandle) return;
  frameHandle = requestAnimationFrame(() => {
    frameHandle = 0;
    paint();
  });
}

function drawNow() {
  if (frameHandle) {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }
  paint();
  syncHud();
}

function syncHud() {
  const grade = GRADES.find((g) => g.id === state.grade);
  ui.hudLine.textContent = `${state.size.w} × ${state.size.h} · ${LAYOUT_LABELS[state.layout]} · ${grade ? grade.label : state.grade.toUpperCase()}`;
}

// ---------------------------------------------------------------- sizing

function fitPreview() {
  const box = ui.matte.getBoundingClientRect();
  const maxW = Math.max(280, box.width - 84);
  const maxH = Math.max(220, box.height - 96);
  const { w, h } = state.size;
  const k = Math.min(maxW / w, maxH / h, 1);
  const longSide = Math.max(w * k, h * k);
  const shrink = longSide > 1000 ? 1000 / longSide : 1;
  ui.preview.width = Math.max(200, Math.round(w * k * shrink));
  ui.preview.height = Math.max(200, Math.round(h * k * shrink));
  ui.preview.style.width = `${Math.round(w * k)}px`;
  ui.preview.style.height = `${Math.round(h * k)}px`;
  requestDraw();
}

// The cover scene draws at the real output size; CSS fits it into the viewport.
function sizePreviewToOutput() {
  ui.preview.width = state.size.w;
  ui.preview.height = state.size.h;
  const k = Math.min(window.innerWidth / state.size.w, window.innerHeight / state.size.h, 1);
  ui.preview.style.width = `${Math.round(state.size.w * k)}px`;
  ui.preview.style.height = `${Math.round(state.size.h * k)}px`;
  requestDraw();
}

// ---------------------------------------------------------------- controls

function buildControls() {
  for (const id of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-btn';
    button.dataset.layout = id;
    button.innerHTML = `<span class="glyph g-${id}"><i></i><i></i><i></i><i></i><i></i></span><span class="layout-name">${LAYOUT_LABELS[id]}</span>`;
    button.addEventListener('click', () => setLayout(id));
    ui.layoutList.append(button);
  }

  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-btn';
    button.dataset.grade = grade.id;
    button.style.setProperty('--s0', grade.stops[0]);
    button.style.setProperty('--s1', grade.stops[1]);
    button.style.setProperty('--s2', grade.stops[2]);
    button.innerHTML = `<span class="swatch"></span><span class="layout-name">${grade.label}</span>`;
    button.addEventListener('click', () => {
      state.grade = grade.id;
      syncAll();
      requestDraw();
    });
    ui.gradeList.append(button);
  }

  for (const size of SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-pill';
    button.dataset.size = `${size.w}x${size.h}`;
    button.textContent = size.label;
    button.addEventListener('click', () => {
      state.size = { w: size.w, h: size.h };
      if (coverOnly) sizePreviewToOutput();
      else fitPreview();
      syncAll();
      requestDraw();
    });
    ui.sizePills.append(button);
  }
}

function syncAll() {
  syncHud();
  syncInspector();
  syncPhotoGrid();
  syncControls();
}

function syncControls() {
  for (const button of ui.layoutList.children) button.classList.toggle('is-active', button.dataset.layout === state.layout);
  for (const button of ui.gradeList.children) button.classList.toggle('is-active', button.dataset.grade === state.grade);
  for (const button of ui.sizePills.children) {
    button.classList.toggle('is-active', button.dataset.size === `${state.size.w}x${state.size.h}`);
  }
  ui.kicker.value = state.caption.kicker;
  ui.title.value = state.caption.title;
  ui.tagline.value = state.caption.tagline;
  ui.grain.value = String(state.effects.grain);
  ui.grainValue.textContent = state.effects.grain.toFixed(2);
  ui.halftone.value = String(state.effects.halftone);
  ui.halftoneValue.textContent = state.effects.halftone.toFixed(2);
  ui.scan.value = String(state.effects.scan);
  ui.scanValue.textContent = state.effects.scan.toFixed(2);
  ui.vignette.value = String(state.effects.vignette);
  ui.vignetteValue.textContent = state.effects.vignette.toFixed(2);
  ui.frame.checked = state.effects.frame;
}

function syncInspector() {
  const panel = state.panels[state.selected];
  ui.panelTitle.textContent = `PANEL ${state.selected + 1}`;
  ui.panelChips.replaceChildren();
  state.photos.forEach((photo, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = `${String.fromCharCode(65 + index)} · ${photo.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 9).toUpperCase()}`;
    chip.classList.toggle('is-active', panel ? panel.photo === index : false);
    chip.addEventListener('click', () => {
      if (!state.panels[state.selected]) return;
      state.panels[state.selected].photo = index;
      syncInspector();
      requestDraw();
    });
    ui.panelChips.append(chip);
  });
  if (!state.photos.length) {
    const empty = document.createElement('span');
    empty.className = 'chip is-empty';
    empty.textContent = 'NO PHOTOS YET';
    ui.panelChips.append(empty);
  }
  const px = panel ? panel.focusX : 0.5;
  const py = panel ? panel.focusY : 0.5;
  const pz = panel ? panel.zoom : 1;
  ui.focusX.value = String(px);
  ui.focusXValue.textContent = px.toFixed(2);
  ui.focusY.value = String(py);
  ui.focusYValue.textContent = py.toFixed(2);
  ui.zoom.value = String(pz);
  ui.zoomValue.textContent = pz.toFixed(2);
}

function syncPhotoGrid() {
  ui.photoCount.textContent = `${state.photos.length} / ${MAX_PHOTOS}`;
  ui.photoGrid.replaceChildren();
  state.photos.forEach((photo, index) => {
    const item = document.createElement('li');
    item.className = 'thumb';
    const used = state.panels.some((panel) => panel.photo === index);
    item.classList.toggle('is-used', used);
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    img.draggable = false;
    const badge = document.createElement('span');
    badge.className = 'thumb-badge';
    badge.textContent = String.fromCharCode(65 + index);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'thumb-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${photo.name}`);
    remove.addEventListener('click', (event) => {
      event.preventDefault();
      removePhoto(index);
    });
    item.append(img, badge, remove);
    item.addEventListener('click', () => assignPhoto(index));
    ui.photoGrid.append(item);
  });
}

// ---------------------------------------------------------------- state edits

function setLayout(id) {
  const count = PANEL_COUNT[id] ?? 4;
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const previous = state.panels[i];
    next.push({
      photo: state.photos.length ? (previous?.photo ?? i) % state.photos.length : null,
      focusX: previous?.focusX ?? 0.5,
      focusY: previous?.focusY ?? 0.5,
      zoom: previous?.zoom ?? (i === 0 ? 1 : 1.4 + i * 0.4),
    });
  }
  state.layout = id;
  state.panels = next;
  state.selected = Math.min(state.selected, count - 1);
  syncAll();
  if (coverOnly) sizePreviewToOutput();
  else fitPreview();
  requestDraw();
}

function assignPhoto(index) {
  if (!state.panels[state.selected]) return;
  state.panels[state.selected].photo = index;
  syncInspector();
  syncPhotoGrid();
  requestDraw();
}

function removePhoto(index) {
  state.photos.splice(index, 1);
  for (const panel of state.panels) {
    if (panel.photo === index) panel.photo = state.photos.length ? 0 : null;
    else if (panel.photo !== null && panel.photo > index) panel.photo -= 1;
  }
  syncAll();
  requestDraw();
}

async function addPhotoFiles(files) {
  const room = MAX_PHOTOS - state.photos.length;
  const list = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, room));
  for (const file of list) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push({ img, name: file.name || 'photo' });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (state.panels.length && state.panels.some((panel) => panel.photo === null)) {
    state.panels.forEach((panel, index) => {
      if (panel.photo === null && state.photos.length) panel.photo = index % state.photos.length;
    });
  }
  syncAll();
  requestDraw();
  if (list.length) showToast(`${state.photos.length} PHOTO${state.photos.length === 1 ? '' : 'S'} READY · LOCAL ONLY`);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

async function loadSamples() {
  const samples = [['samples/pier.jpg', 'PIER.JPG'], ['samples/boulevard.jpg', 'BOULEVARD.JPG']];
  const photos = [];
  for (const [src, name] of samples) {
    try {
      photos.push({ img: await loadImage(src), name });
    } catch {
      photos.push(null);
    }
  }
  state.photos = photos.filter(Boolean);
  syncAll();
}

function applyPreset(preset, opts = {}) {
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.caption = { ...preset.caption };
  state.size = { ...preset.size };
  state.effects = { ...preset.effects };
  state.panels = preset.panels.map((panel) => ({ ...panel }));
  state.selected = Math.min(preset.selected ?? 0, state.panels.length - 1);
  coverOnly = Boolean(opts.coverOnly);
  syncAll();
  if (coverOnly) sizePreviewToOutput();
  else fitPreview();
  requestDraw();
}

function randomize() {
  const names = Object.keys(PRESETS);
  const choice = names[Math.floor(Math.random() * names.length)];
  const preset = PRESETS[choice];
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.effects = { ...preset.effects };
  state.panels = preset.panels.map((panel, index) => ({
    ...panel,
    photo: state.photos.length ? (panel.photo + index) % state.photos.length : null,
    focusX: clamp(panel.focusX + (Math.random() - 0.5) * 0.12, 0.05, 0.95),
    focusY: clamp(panel.focusY + (Math.random() - 0.5) * 0.12, 0.05, 0.95),
  }));
  state.selected = 0;
  syncAll();
  if (coverOnly) sizePreviewToOutput();
  else fitPreview();
  requestDraw();
  showToast(`RE-CUT · ${LAYOUT_LABELS[state.layout]} · ${state.grade.toUpperCase()}`);
}

// ---------------------------------------------------------------- export

async function exportPng() {
  const { w, h } = state.size;
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const started = performance.now();
  drawCover(offscreen.getContext('2d'), w, h, state);
  const ms = performance.now() - started;
  const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
  if (!blob) {
    showToast('EXPORT FAILED · TRY A SMALLER SIZE');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `neon-cut-${state.layout}-${w}x${h}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  const mb = blob.size / (1024 * 1024);
  showToast(`PNG ${w}×${h} · ${mb.toFixed(1)} MB · ${(ms / 1000).toFixed(1)}s`);
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-shown');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('is-shown'), 2800);
}

// ---------------------------------------------------------------- pointer work on the canvas

function canvasPoint(event) {
  const rect = ui.preview.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (ui.preview.width / rect.width),
    y: (event.clientY - rect.top) * (ui.preview.height / rect.height),
  };
}

function panelAt(point) {
  const layout = layoutPanels(state.layout, ui.preview.width, ui.preview.height);
  return layout.panels.findIndex((box) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h);
}

function bindCanvas() {
  ui.preview.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const index = panelAt(point);
    if (index >= 0) {
      state.selected = index;
      syncInspector();
    }
    drag = { point, index: index >= 0 ? index : state.selected };
    ui.preview.setPointerCapture(event.pointerId);
    ui.preview.classList.add('is-dragging');
  });

  ui.preview.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = canvasPoint(event);
    const panel = state.panels[drag.index];
    if (!panel) return;
    const box = layoutPanels(state.layout, ui.preview.width, ui.preview.height).panels[drag.index];
    if (!box) return;
    panel.focusX = clamp(panel.focusX - ((point.x - drag.point.x) / box.w) * 0.55, 0, 1);
    panel.focusY = clamp(panel.focusY - ((point.y - drag.point.y) / box.h) * 0.55, 0, 1);
    drag.point = point;
    syncInspector();
    requestDraw();
  });

  const endDrag = () => {
    drag = null;
    ui.preview.classList.remove('is-dragging');
  };
  ui.preview.addEventListener('pointerup', endDrag);
  ui.preview.addEventListener('pointercancel', endDrag);

  ui.preview.addEventListener('wheel', (event) => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    event.preventDefault();
    panel.zoom = clamp(panel.zoom - event.deltaY * 0.0012, 1, 3);
    syncInspector();
    requestDraw();
  }, { passive: false });
}

// ---------------------------------------------------------------- wiring

function bindInputs() {
  ui.photoInput.addEventListener('change', (event) => {
    addPhotoFiles(event.target.files);
    event.target.value = '';
  });

  for (const target of [document.body, ui.photoDrop]) {
    target.addEventListener('dragover', (event) => {
      event.preventDefault();
      ui.photoDrop.classList.add('is-over');
    });
    target.addEventListener('dragleave', () => ui.photoDrop.classList.remove('is-over'));
    target.addEventListener('drop', (event) => {
      event.preventDefault();
      ui.photoDrop.classList.remove('is-over');
      if (event.dataTransfer?.files?.length) addPhotoFiles(event.dataTransfer.files);
    });
  }

  bindCanvas();

  const nudge = (panel, dx, dy) => {
    if (!panel) return;
    panel.focusX = clamp(panel.focusX + dx, 0, 1);
    panel.focusY = clamp(panel.focusY + dy, 0, 1);
    syncInspector();
    requestDraw();
  };

  ui.focusX.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.focusX = Number(ui.focusX.value);
    ui.focusXValue.textContent = panel.focusX.toFixed(2);
    requestDraw();
  });
  ui.focusY.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.focusY = Number(ui.focusY.value);
    ui.focusYValue.textContent = panel.focusY.toFixed(2);
    requestDraw();
  });
  ui.zoom.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = Number(ui.zoom.value);
    ui.zoomValue.textContent = panel.zoom.toFixed(2);
    requestDraw();
  });
  ui.fit.addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.focusX = 0.5;
    panel.focusY = 0.5;
    panel.zoom = 1;
    syncInspector();
    requestDraw();
  });

  ui.kicker.addEventListener('input', () => {
    state.caption.kicker = ui.kicker.value;
    requestDraw();
  });
  ui.title.addEventListener('input', () => {
    state.caption.title = ui.title.value;
    requestDraw();
  });
  ui.tagline.addEventListener('input', () => {
    state.caption.tagline = ui.tagline.value;
    requestDraw();
  });

  const bindEffect = (input, output, key) => {
    input.addEventListener('input', () => {
      state.effects[key] = Number(input.value);
      output.textContent = Number(input.value).toFixed(2);
      requestDraw();
    });
  };
  bindEffect(ui.grain, ui.grainValue, 'grain');
  bindEffect(ui.halftone, ui.halftoneValue, 'halftone');
  bindEffect(ui.scan, ui.scanValue, 'scan');
  bindEffect(ui.vignette, ui.vignetteValue, 'vignette');
  ui.frame.addEventListener('change', () => {
    state.effects.frame = ui.frame.checked;
    requestDraw();
  });

  ui.exportBtn.addEventListener('click', () => exportPng());
  ui.randomBtn.addEventListener('click', () => randomize());

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      exportPng();
      return;
    }
    const map = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] };
    const delta = map[event.key];
    if (!delta) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    nudge(state.panels[state.selected], delta[0] * step, delta[1] * step);
  });

  window.addEventListener('resize', () => {
    if (coverOnly) sizePreviewToOutput();
    else fitPreview();
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- boot

async function boot() {
  buildControls();
  bindInputs();
  state.panels = PRESETS.vice.panels.map((panel) => ({ ...panel }));
  syncAll();

  await document.fonts.load('40px Anton');
  await document.fonts.load('600 20px "Barlow Condensed"');
  await document.fonts.ready;

  const query = new URLSearchParams(window.location.search);
  const shot = await runShot(query, {
    applyPreset,
    loadSamples,
    drawNow,
  });
  if (shot) return;

  await loadSamples();
  applyPreset(PRESETS.vice, { coverOnly: false });
  drawNow();
}

boot();
