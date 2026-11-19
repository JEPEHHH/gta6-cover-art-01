// VICE HOUR studio: state, DOM wiring, photo handling, the panel inspector, export and the
// ?shot= scenes. The drawing itself lives in engine.js and its module siblings.

import { drawCover } from './engine.js';
import { LAYOUTS, LAYOUT_NAMES, layoutPanels } from './layouts.js';
import { runShot } from './shots.js';

const SAMPLES = ['./samples/pier.jpg', './samples/boulevard.jpg'];
const SIZES = [
  { w: 1080, h: 1080 },
  { w: 1080, h: 1350 },
  { w: 1920, h: 1080 },
];
const GRADES = ['sunset', 'neon', 'dusk', 'noir'];
const PHOTO_LIMIT = 6;
const PREVIEW_LONG_SIDE = 1100;
const LETTERS = 'ABCDEF';

const state = {
  photos: [],
  panels: [],
  layout: 'collage',
  grade: 'sunset',
  caption: {
    kicker: 'VICE CITY · 1986',
    title: 'LAST LIGHT / ON OCEAN DRIVE',
    tagline: 'A HEIST, A HURRICANE, ONE NIGHT LEFT',
  },
  size: { w: 1080, h: 1080 },
  effects: { grain: 0.45, halftone: 0.3, scan: 0.18, vignette: 0.5, frame: true },
  selected: 0,
};

const el = (id) => document.getElementById(id);
const canvas = el('cover');
const ctx = canvas.getContext('2d');

let lastLayout = null;
let rafHandle = 0;
let toastTimer = 0;
let pendingShot = null;
let drag = null;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image did not load'));
    img.src = src;
  });
}

// ---------- controls ----------

function buildControls() {
  const layoutList = el('layoutList');
  layoutList.textContent = '';
  const glyphCount = { collage: 4, hero: 3, grid: 4, strip: 4, single: 1, quintet: 5 };
  LAYOUTS.forEach((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-btn';
    button.dataset.layout = id;
    button.dataset.glyph = id;
    const glyph = document.createElement('span');
    glyph.className = `glyph ${id}`;
    glyph.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < (glyphCount[id] || 4); i += 1) glyph.appendChild(document.createElement('i'));
    const label = document.createElement('span');
    label.textContent = LAYOUT_NAMES[id];
    button.append(glyph, label);
    button.addEventListener('click', () => setLayout(id));
    layoutList.appendChild(button);
  });

  const gradeList = el('gradeList');
  gradeList.textContent = '';
  GRADES.forEach((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `grade-btn ${id}`;
    button.dataset.grade = id;
    const swatch = document.createElement('i');
    const label = document.createElement('span');
    label.textContent = id.toUpperCase();
    button.append(swatch, label);
    button.addEventListener('click', () => {
      state.grade = id;
      syncControls();
      requestDraw();
    });
    gradeList.appendChild(button);
  });

  const sizeList = el('sizeList');
  sizeList.textContent = '';
  SIZES.forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-btn';
    button.textContent = `${size.w} × ${size.h}`;
    button.dataset.size = `${size.w}x${size.h}`;
    button.addEventListener('click', () => {
      state.size = { w: size.w, h: size.h };
      syncControls();
      requestDraw();
    });
    sizeList.appendChild(button);
  });
}

function wireEvents() {
  el('photoDrop').addEventListener('click', () => el('photoInput').click());
  el('photoInput').addEventListener('change', (event) => {
    addFiles(event.target.files).then(() => {
      event.target.value = '';
    });
  });

  const drop = el('photoDrop');
  ['dragenter', 'dragover'].forEach((type) => {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    drop.addEventListener(type, () => drop.classList.remove('is-over'));
  });
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer && event.dataTransfer.files);
  });

  el('exportBtn').addEventListener('click', () => {
    exportPng();
  });
  el('randomizeBtn').addEventListener('click', randomize);

  const focusX = el('focusX');
  const focusY = el('focusY');
  const zoom = el('zoom');
  focusX.addEventListener('input', () => {
    const panel = currentPanel();
    if (!panel) return;
    panel.focusX = Number(focusX.value);
    requestDraw();
  });
  focusY.addEventListener('input', () => {
    const panel = currentPanel();
    if (!panel) return;
    panel.focusY = Number(focusY.value);
    requestDraw();
  });
  zoom.addEventListener('input', () => {
    const panel = currentPanel();
    if (!panel) return;
    panel.zoom = Number(zoom.value);
    requestDraw();
  });
  el('fitBtn').addEventListener('click', () => {
    const panel = currentPanel();
    if (!panel) return;
    panel.focusX = 0.5;
    panel.focusY = 0.5;
    panel.zoom = 1;
    syncInspector();
    requestDraw();
  });

  el('kickerInput').addEventListener('input', (event) => {
    state.caption.kicker = event.target.value;
    requestDraw();
  });
  el('titleInput').addEventListener('input', (event) => {
    state.caption.title = event.target.value;
    requestDraw();
  });
  el('taglineInput').addEventListener('input', (event) => {
    state.caption.tagline = event.target.value;
    requestDraw();
  });

  ['grain', 'halftone', 'scan', 'vignette'].forEach((key) => {
    el(key).addEventListener('input', (event) => {
      state.effects[key] = Number(event.target.value);
      requestDraw();
    });
  });
  el('frameToggle').addEventListener('change', (event) => {
    state.effects.frame = event.target.checked;
    requestDraw();
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const index = panelAt(point.x, point.y);
    if (index >= 0) {
      state.selected = index;
      syncInspector();
      const panel = state.panels[index];
      drag = { index, x: event.clientX, y: event.clientY, focusX: panel ? panel.focusX : 0.5, focusY: panel ? panel.focusY : 0.5 };
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const panel = state.panels[drag.index];
    if (!panel) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (event.clientX - drag.x) / Math.max(1, rect.width);
    const dy = (event.clientY - drag.y) / Math.max(1, rect.height);
    panel.focusX = clamp01(drag.focusX - dx * 1.4);
    panel.focusY = clamp01(drag.focusY - dy * 1.4);
    requestDraw();
  });
  canvas.addEventListener('pointerup', (event) => {
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('wheel', (event) => {
    const point = canvasPoint(event);
    const index = panelAt(point.x, point.y);
    if (index < 0) return;
    event.preventDefault();
    const panel = state.panels[index];
    if (!panel) return;
    state.selected = index;
    panel.zoom = clamp(panel.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 1, 3);
    requestDraw();
  }, { passive: false });

  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(event) {
  const tag = event.target && event.target.tagName ? event.target.tagName : '';
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
    event.preventDefault();
    exportPng();
    return;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const panel = currentPanel();
  if (!panel) return;
  const step = event.shiftKey ? 0.04 : 0.01;
  let used = true;
  if (event.key === 'ArrowLeft') panel.focusX = clamp01(panel.focusX - step);
  else if (event.key === 'ArrowRight') panel.focusX = clamp01(panel.focusX + step);
  else if (event.key === 'ArrowUp') panel.focusY = clamp01(panel.focusY - step);
  else if (event.key === 'ArrowDown') panel.focusY = clamp01(panel.focusY + step);
  else used = false;
  if (used) {
    event.preventDefault();
    requestDraw();
  }
}

// ---------- photos ----------

async function loadSamples() {
  const loaded = [];
  for (const src of SAMPLES) {
    try {
      const img = await loadImage(src);
      loaded.push({ img, name: src.split('/').pop(), url: src });
    } catch {
      // a missing sample simply leaves the studio empty; the drop zone still works
    }
  }
  state.photos = loaded;
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => /^image\//.test(file.type || ''));
  const room = Math.max(0, PHOTO_LIMIT - state.photos.length);
  const take = files.slice(0, room);
  const loaded = [];
  for (const file of take) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      loaded.push({ img, name: file.name, url });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (!loaded.length) return;
  state.photos = state.photos.concat(loaded);
  ensurePanels();
  buildThumbs();
  syncInspector();
  requestDraw();
}

function removePhoto(index) {
  const photo = state.photos[index];
  if (photo && photo.url && photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
  state.photos.splice(index, 1);
  state.panels.forEach((panel) => {
    if (panel.photo === null) return;
    if (panel.photo === index) panel.photo = state.photos.length ? Math.min(index, state.photos.length - 1) : null;
    else if (panel.photo > index) panel.photo -= 1;
  });
  ensurePanels();
  buildThumbs();
  syncInspector();
  requestDraw();
}

function buildThumbs() {
  const thumbHost = el('thumbs');
  thumbHost.textContent = '';
  state.photos.forEach((photo, index) => {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    const used = state.panels.some((panel) => panel.photo === index);
    if (used) cell.classList.add('is-selected');
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    const badge = document.createElement('span');
    badge.className = 'idx';
    badge.textContent = LETTERS[index] || String(index + 1);
    const kill = document.createElement('button');
    kill.type = 'button';
    kill.className = 'kill';
    kill.textContent = '×';
    kill.setAttribute('aria-label', `Remove ${photo.name}`);
    kill.addEventListener('click', (event) => {
      event.stopPropagation();
      removePhoto(index);
    });
    cell.append(img, badge, kill);
    thumbHost.appendChild(cell);
  });
  if (!state.photos.length) {
    const note = document.createElement('p');
    note.className = 'card-note';
    note.textContent = 'NO PHOTOS YET';
    thumbHost.appendChild(note);
  }
}

function buildChips() {
  const host = el('panelChips');
  host.textContent = '';
  if (!state.photos.length) {
    const empty = document.createElement('span');
    empty.className = 'chip empty';
    empty.textContent = 'DROP A PHOTO';
    host.appendChild(empty);
    return;
  }
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = `PHOTO ${LETTERS[index] || index + 1}`;
    button.dataset.photo = String(index);
    button.addEventListener('click', () => {
      const panel = currentPanel();
      if (!panel) return;
      panel.photo = index;
      syncInspector();
      buildThumbs();
      requestDraw();
    });
    host.appendChild(button);
  });
}

// ---------- state helpers ----------

function currentPanel() {
  return state.panels[state.selected] || null;
}

function ensurePanels() {
  const count = layoutPanels(state.layout, 1920, 1080).panels.length;
  const n = state.photos.length;
  while (state.panels.length < count) {
    const index = state.panels.length;
    state.panels.push({
      photo: n ? index % n : null,
      focusX: 0.5,
      focusY: 0.5,
      zoom: 1,
    });
  }
  if (state.panels.length > count) state.panels.length = count;
  state.panels.forEach((panel, index) => {
    if (panel.photo !== null && (panel.photo >= n || panel.photo < 0)) panel.photo = n ? index % n : null;
  });
  state.selected = clamp(state.selected, 0, Math.max(0, count - 1));
}

function setLayout(id) {
  if (!LAYOUTS.includes(id)) return;
  state.layout = id;
  ensurePanels();
  syncControls();
  syncInspector();
  requestDraw();
}

function randomize() {
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  state.grade = GRADES[Math.floor(Math.random() * GRADES.length)];
  state.layout = layout;
  ensurePanels();
  state.panels.forEach((panel) => {
    panel.focusX = 0.28 + Math.random() * 0.44;
    panel.focusY = 0.28 + Math.random() * 0.44;
    panel.zoom = 1 + Math.random() * 1.9;
  });
  state.effects.grain = 0.3 + Math.random() * 0.25;
  state.effects.halftone = 0.2 + Math.random() * 0.25;
  syncControls();
  syncInspector();
  requestDraw();
}

// ---------- drawing ----------

function requestDraw() {
  if (rafHandle) return;
  rafHandle = requestAnimationFrame(() => {
    rafHandle = 0;
    drawPreview(pendingShot === 'cover');
  });
}

function drawPreview(exact) {
  const { w, h } = state.size;
  const scale = exact ? 1 : Math.min(1, PREVIEW_LONG_SIDE / Math.max(w, h));
  const cw = Math.max(2, Math.round(w * scale));
  const ch = Math.max(2, Math.round(h * scale));
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const started = performance.now();
  lastLayout = drawCover(ctx, cw, ch, state);
  const ms = performance.now() - started;
  const hud = el('hud');
  hud.textContent = `${w} × ${h} · ${LAYOUT_NAMES[state.layout]} · ${state.grade.toUpperCase()} · ${ms.toFixed(0)} MS`;
  syncInspector();
}

function syncControls() {
  document.querySelectorAll('.layout-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.layout === state.layout);
  });
  document.querySelectorAll('.grade-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.grade === state.grade);
  });
  document.querySelectorAll('.size-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.size === `${state.size.w}x${state.size.h}`);
  });
  el('grain').value = String(state.effects.grain);
  el('halftone').value = String(state.effects.halftone);
  el('scan').value = String(state.effects.scan);
  el('vignette').value = String(state.effects.vignette);
  el('frameToggle').checked = state.effects.frame !== false;
  el('grainValue').textContent = Number(state.effects.grain).toFixed(2);
  el('halftoneValue').textContent = Number(state.effects.halftone).toFixed(2);
  el('scanValue').textContent = Number(state.effects.scan).toFixed(2);
  el('vignetteValue').textContent = Number(state.effects.vignette).toFixed(2);
  el('kickerInput').value = state.caption.kicker || '';
  el('titleInput').value = state.caption.title || '';
  el('taglineInput').value = state.caption.tagline || '';
}

function syncInspector() {
  const panel = currentPanel();
  el('panelLabel').textContent = `PANEL ${state.selected + 1}`;
  if (panel) {
    el('focusX').value = String(panel.focusX);
    el('focusY').value = String(panel.focusY);
    el('zoom').value = String(panel.zoom);
    el('focusXValue').textContent = Number(panel.focusX).toFixed(2);
    el('focusYValue').textContent = Number(panel.focusY).toFixed(2);
    el('zoomValue').textContent = `${Number(panel.zoom).toFixed(2)}×`;
  }
  document.querySelectorAll('#panelChips .chip').forEach((chip) => {
    chip.classList.toggle('is-active', !!panel && String(panel.photo) === chip.dataset.photo);
  });
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
  };
}

function panelAt(x, y) {
  if (!lastLayout) return -1;
  return lastLayout.panels.findIndex((panel) => x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h);
}

// ---------- export ----------

async function exportPng() {
  const { w, h } = state.size;
  const sheet = document.createElement('canvas');
  sheet.width = w;
  sheet.height = h;
  const started = performance.now();
  drawCover(sheet.getContext('2d'), w, h, state);
  const blob = await new Promise((resolve) => sheet.toBlob(resolve, 'image/png'));
  const ms = performance.now() - started;
  if (!blob) {
    showToast('EXPORT FAILED');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vice-hour-${state.layout}-${w}x${h}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast(`PNG ${w} × ${h} · ${(blob.size / 1048576).toFixed(1)} MB · ${(ms / 1000).toFixed(1)}s`);
}

function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('is-on');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
}

// ---------- shot scenes ----------

function applyPreset(preset) {
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.size = { w: preset.size.w, h: preset.size.h };
  state.caption = { ...preset.caption };
  state.effects = { ...preset.effects };
  state.panels = preset.panels.map((panel) => ({ ...panel }));
  state.selected = preset.selected || 0;
  ensurePanels();
  buildThumbs();
  buildChips();
  syncControls();
  syncInspector();
}

const sceneApi = {
  coverScene(w, h, preset) {
    document.body.classList.add('shot-cover');
    applyPreset(preset);
    state.size = { w, h };
    pendingShot = 'cover';
  },
  editorScene(preset) {
    applyPreset(preset);
    pendingShot = 'editor';
  },
};

function markReady() {
  const done = () => {
    window.__shotReady = true;
  };
  requestAnimationFrame(() => requestAnimationFrame(done));
  setTimeout(done, 250);
}

// ---------- boot ----------

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  await document.fonts.load('400 64px Anton');
  await document.fonts.load('600 40px "Barlow Condensed"');
  await document.fonts.load('700 40px "Barlow Condensed"');
  await document.fonts.ready;
}

async function init() {
  buildControls();
  wireEvents();
  await loadFonts();
  await loadSamples();
  ensurePanels();
  buildThumbs();
  buildChips();
  syncControls();

  const query = location.search || '';
  const info = query.includes('shot=') ? runShot(query, sceneApi) : null;
  ensurePanels();
  buildThumbs();
  syncInspector();
  drawPreview(pendingShot === 'cover');
  if (info) markReady();
}

init();
