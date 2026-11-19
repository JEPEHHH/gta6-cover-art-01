// The poster title block: a magenta kicker ribbon that runs off the left edge, two lines of Anton — line one in
// cream, line two as a neon outline over a magenta offset copy — a Barlow tagline, and the studio badge. Every
// line is drawn on one left edge and fitted to the box, so nothing ever clips.

export const MAX_TITLE_LINES = 2;

export function splitTitleLines(text) {
  const clean = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return [''];
  const explicit = clean.split('/').map((part) => part.trim()).filter(Boolean);
  if (explicit.length === 2) return explicit;
  if (explicit.length > 2) return [explicit[0], explicit.slice(1).join(' ')];
  const words = clean.split(' ');
  if (words.length === 1) return words;
  if (words.length === 2) return words[0].length >= words[1].length ? words : [words[1], words[0]];
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const score = Math.abs(a.length - b.length);
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best.lines;
}

export function drawCaption(ctx, W, H, caption, box, opts = {}) {
  const short = Math.min(W, H);
  const kickerSize = clamp(short * 0.0235, 13, 54);
  const taglineSize = clamp(short * 0.0255, 13, 56);
  const tracking = -0.012;

  const lines = splitTitleLines(caption.title).slice(0, MAX_TITLE_LINES);
  const ribbonH = kickerSize * 1.74;
  const gapAfterRibbon = H * 0.012;
  const gapBeforeTagline = H * 0.016;
  const taglineRow = taglineSize * 1.26;
  const fixed = ribbonH + gapAfterRibbon + gapBeforeTagline + taglineRow;

  const capByHeight = Math.max(18, ((box.h - fixed) / (lines.length * 0.86 + 0.2)));
  const capSize = Math.min(H * 0.115, capByHeight);
  const titleSize = fitTitle(ctx, lines, box, capSize, tracking);

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // the block is bottom-anchored inside the box so a short caption still sits on the tagline row
  let y = box.y + ribbonH;
  drawKicker(ctx, W, caption.kicker ?? '', box, y - ribbonH, ribbonH, kickerSize);

  y += gapAfterRibbon;
  const advance = titleSize * 0.86;
  const firstBaseline = y + titleSize * 0.78;
  lines.forEach((line, index) => {
    const baseline = firstBaseline + index * advance;
    const style = { size: titleSize, tracking, W, H };
    if (index === 1) drawOutlineLine(ctx, line, box.x, baseline, style);
    else drawCreamLine(ctx, line, box.x, baseline, style);
  });
  y = firstBaseline + (lines.length - 1) * advance;
  drawTagline(ctx, caption.tagline ?? '', box, y + gapBeforeTagline + taglineSize * 0.86, taglineSize);
  ctx.restore();
}

function fitTitle(ctx, lines, box, cap, tracking) {
  ctx.save();
  ctx.font = `100px Anton, 'Barlow Condensed', sans-serif`;
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, measureTracked(ctx, line, tracking * 100));
  ctx.restore();
  const byWidth = widest > 0 ? (100 * box.w) / widest : cap;
  return Math.max(18, Math.min(cap, byWidth));
}

function drawKicker(ctx, W, text, box, top, height, size) {
  const value = String(text).toUpperCase();
  ctx.save();
  ctx.font = `700 ${size}px 'Barlow Condensed', sans-serif`;
  const letterSpace = size * 0.24;
  const textW = measureTracked(ctx, value, letterSpace);
  const skew = height * Math.tan((12 * Math.PI) / 180);
  const left = -W * 0.06;
  const right = box.x + textW + size * 1.15;
  ctx.beginPath();
  ctx.moveTo(left + skew, top);
  ctx.lineTo(right + skew, top);
  ctx.lineTo(right, top + height);
  ctx.lineTo(left, top + height);
  ctx.closePath();
  ctx.fillStyle = '#ff2d78';
  ctx.fill();
  ctx.fillStyle = 'rgba(18,6,15,0.28)';
  ctx.fillRect(left, top + height - Math.max(2, height * 0.08), right - left, Math.max(2, height * 0.08));
  ctx.fillStyle = '#fff3e6';
  drawTracked(ctx, value, box.x, top + height * 0.5 + size * 0.34, letterSpace);
  ctx.restore();
}

function drawCreamLine(ctx, text, x, baseline, style) {
  const { size, tracking, W } = style;
  ctx.save();
  ctx.font = `${size}px Anton, 'Barlow Condensed', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const space = tracking * size;
  // chromatic fringe: only behind the title glyphs
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#ff2d78';
  drawTracked(ctx, text, x + size * 0.022, baseline, space);
  ctx.fillStyle = '#25e6ff';
  drawTracked(ctx, text, x - size * 0.019, baseline, space);
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12060f';
  ctx.lineWidth = Math.max(2, W * 0.0035);
  strokeTracked(ctx, text, x, baseline, space);
  const cream = ctx.createLinearGradient(0, baseline - size * 0.78, 0, baseline + size * 0.1);
  cream.addColorStop(0, '#fff8e8');
  cream.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = cream;
  drawTracked(ctx, text, x, baseline, space);
  ctx.restore();
}

function drawOutlineLine(ctx, text, x, baseline, style) {
  const { size, tracking, W, H } = style;
  const space = tracking * size;
  ctx.save();
  ctx.font = `${size}px Anton, 'Barlow Condensed', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // magenta offset copy behind the line
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ff2d78';
  drawTracked(ctx, text, x + H * 0.0065, baseline + H * 0.0055, space);
  ctx.restore();
  // dark bed so the outline reads over the sunset, then the dark edge
  ctx.globalAlpha = 0.66;
  ctx.fillStyle = '#12060f';
  drawTracked(ctx, text, x, baseline, space);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#12060f';
  ctx.lineWidth = Math.max(2, H * 0.006);
  strokeTracked(ctx, text, x, baseline, space);
  // the neon outline itself
  ctx.strokeStyle = '#25e6ff';
  ctx.lineWidth = Math.max(2, H * 0.0042);
  ctx.shadowColor = 'rgba(37,230,255,0.65)';
  ctx.shadowBlur = Math.max(4, H * 0.018);
  strokeTracked(ctx, text, x, baseline, space);
  ctx.restore();
}

function drawTagline(ctx, text, box, baseline, size) {
  const value = String(text).toUpperCase();
  ctx.save();
  ctx.font = `600 ${size}px 'Barlow Condensed', sans-serif`;
  const space = size * 0.1;
  let shown = value;
  if (measureTracked(ctx, shown, space) > box.w) {
    while (shown.length > 4 && measureTracked(ctx, `${shown.trimEnd()}…`, space) > box.w) {
      shown = shown.slice(0, -1);
    }
    shown = `${shown.trimEnd()}…`;
  }
  ctx.fillStyle = 'rgba(255,247,236,0.88)';
  drawTracked(ctx, shown, box.x, baseline, space);
  ctx.restore();
}

export function drawStudioBadge(ctx, W, H, side, letters = 'NCS') {
  const r = Math.max(16, H * 0.048);
  const cx = W - side - r;
  const cy = side + r;
  ctx.save();
  // a soft dark halo keeps the badge readable where palm fronds cross behind it
  const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.7);
  halo.addColorStop(0, 'rgba(10,4,14,0.55)');
  halo.addColorStop(1, 'rgba(10,4,14,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2d78';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = 'rgba(255,248,236,0.92)';
  ctx.stroke();
  ctx.font = `700 ${Math.round(r * 0.62)}px 'Barlow Condensed', sans-serif`;
  ctx.fillStyle = '#fff8ec';
  ctx.textBaseline = 'middle';
  const space = r * 0.1;
  const text = letters.slice(0, 3);
  const w = measureTracked(ctx, text, space);
  let x = cx - w / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, cy + r * 0.03);
    x += ctx.measureText(ch).width + space;
  }
  ctx.restore();
}

function measureTracked(ctx, text, tracking) {
  let width = 0;
  for (const ch of text) width += ctx.measureText(ch).width + tracking;
  return Math.max(0, width - tracking);
}

function drawTracked(ctx, text, x, baseline, tracking) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, baseline);
    cursor += ctx.measureText(ch).width + tracking;
  }
}

function strokeTracked(ctx, text, x, baseline, tracking) {
  let cursor = x;
  for (const ch of text) {
    ctx.strokeText(ch, cursor, baseline);
    cursor += ctx.measureText(ch).width + tracking;
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
