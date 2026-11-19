// The poster title block: ribbon kicker, a two-line Anton title that is fitted before it is
// drawn, an outlined second line with a neon rim, the tagline and the studio badge.
// Nothing is allowed to leave the safe area or the caption box.

const SAFE = 0.048;
const TITLE_TRACK = -0.012;
const CREAM_TOP = '#fff8e8';
const CREAM_BOTTOM = '#ffd9a0';
const INK = '#12060f';
const MAGENTA = '#ff2d78';
const CYAN = '#25e6ff';

function titleLines(title) {
  const raw = String(title || 'UNTITLED').toUpperCase().replace(/\s+/g, ' ').trim();
  if (raw.includes('/')) {
    const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return [parts[0], parts.slice(1).join(' ')];
    return [parts[0] || raw];
  }
  const words = raw.split(' ').filter(Boolean);
  if (words.length < 2) return [raw];
  if (words.length === 2) {
    return words[0].length >= words[1].length ? [words[0], words[1]] : [words[1], words[0]];
  }
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function ellipsise(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '\u2026').width > maxWidth) cut = cut.slice(0, -1);
  return cut.replace(/[\s,·-]+$/, '') + '\u2026';
}

// Fit the block: try the poster size first, shrink until both lines fit the box and the whole
// block fits its height. Both limits are the same rectangle, so nothing can clip.
function fitBlock(ctx, lines, box, H, W) {
  const kickerSize = Math.min(0.0235 * W, 0.036 * H);
  const taglineSize = Math.min(0.026 * W, 0.04 * H);
  const maxSize = Math.min(0.115 * H, box.w / 3.1);
  let size = maxSize;
  let widest = 0;
  for (let guard = 0; guard < 90; guard += 1) {
    ctx.font = `400 ${size}px Anton, Impact, "Arial Narrow", sans-serif`;
    ctx.letterSpacing = `${(TITLE_TRACK * size).toFixed(2)}px`;
    widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const step = size * 0.86;
    const blockH = 0.73 * size + step + 1.35 * taglineSize + 1.34 * kickerSize + H * 0.006;
    if (widest <= box.w * 0.995 && blockH <= box.h) break;
    size *= 0.975;
    if (size < 0.036 * H) {
      size = 0.036 * H;
      break;
    }
  }
  return { size, widest, kickerSize, taglineSize };
}

export function drawCaption(ctx, W, H, caption, box, opts = {}) {
  const side = Math.round(SAFE * W);
  const lines = titleLines(caption && caption.title);
  const kicker = String((caption && caption.kicker) || '').toUpperCase();
  const tagline = String((caption && caption.tagline) || '').toUpperCase();
  const { size, kickerSize, taglineSize } = fitBlock(ctx, lines, box, H, W);
  const step = size * 0.86;
  const boxBottom = box.y + box.h;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const taglineBaseline = boxBottom;
  const line2Base = taglineBaseline - taglineSize * 1.35;
  const line1Base = line2Base - step;
  const kickerBase = line1Base - 0.73 * size - 0.62 * kickerSize;
  // A band a little taller than the type, so the ribbon never cuts the caps it sits behind.
  const ribbonH = kickerSize * 1.46;

  // Hairline rule above the block, running from the left margin to the right one.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(255, 244, 226, 0.55)';
  ctx.lineWidth = Math.max(1, H * 0.0018);
  ctx.beginPath();
  const ruleY = kickerBase - 0.72 * kickerSize;
  ctx.moveTo(side, ruleY);
  ctx.lineTo(W - side, ruleY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Kicker on a magenta ribbon that runs off the left edge of the frame.
  if (kicker) {
    ctx.font = `700 ${kickerSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.letterSpacing = `${(0.24 * kickerSize).toFixed(2)}px`;
    const kickerW = ctx.measureText(kicker).width;
    ctx.save();
    ctx.translate(0, kickerBase);
    ctx.transform(1, 0, Math.tan((-12 * Math.PI) / 180), 1, 0, 0);
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(-0.08 * W, -ribbonH + kickerSize * 0.24, side + kickerW + kickerSize * 0.9, ribbonH);
    ctx.restore();
    ctx.fillStyle = '#fff6ea';
    ctx.fillText(kicker, side, kickerBase);
  }

  // Title line 1: cream gradient over a magenta offset copy and a dark rim.
  ctx.font = `400 ${size}px Anton, Impact, "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(TITLE_TRACK * size).toFixed(2)}px`;
  const cream = ctx.createLinearGradient(0, line1Base - size * 0.76, 0, line1Base);
  cream.addColorStop(0, CREAM_TOP);
  cream.addColorStop(1, CREAM_BOTTOM);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = MAGENTA;
  ctx.fillText(lines[0], side + size * 0.05, line1Base + size * 0.04);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.055);
  ctx.strokeStyle = INK;
  ctx.strokeText(lines[0], side, line1Base);
  ctx.fillStyle = cream;
  ctx.fillText(lines[0], side, line1Base);

  // Title line 2: a magenta offset copy behind, a dark stroke, then the neon cyan outline.
  if (lines[1]) {
    const text = lines[1];
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = MAGENTA;
    ctx.fillText(text, side + size * 0.055, line2Base + size * 0.045);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, 0.006 * H);
    ctx.strokeStyle = INK;
    ctx.strokeText(text, side, line2Base);

    ctx.lineWidth = Math.max(2, 0.0026 * H);
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = 0.95;
    ctx.strokeText(text, side, line2Base);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(18, 6, 15, 0.42)';
    ctx.fillText(text, side, line2Base);
  }

  // Tagline on the left, studio wordmark on the right margin, one hairline bridging them.
  ctx.font = `600 ${taglineSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(0.1 * taglineSize).toFixed(2)}px`;
  const markSize = Math.max(11, 0.017 * W);
  const markText = opts.wordmark || 'NEON CUT';
  ctx.save();
  ctx.font = `700 ${markSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(0.34 * markSize).toFixed(2)}px`;
  const markW = ctx.measureText(markText).width;
  const markX = W - side - markW;
  ctx.font = `600 ${taglineSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(0.1 * taglineSize).toFixed(2)}px`;
  const tagW = Math.max(0, markX - side - taglineSize * 1.6);
  const tagText = tagline ? ellipsise(ctx, tagline, tagW) : '';
  if (tagText) {
    ctx.fillStyle = 'rgba(255, 252, 246, 0.88)';
    ctx.fillText(tagText, side, taglineBaseline);
  }
  if (tagText && tagW > taglineSize * 2) {
    const endX = side + Math.min(tagW, ctx.measureText(tagText).width) + taglineSize * 0.5;
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = 'rgba(255, 240, 222, 0.7)';
    ctx.lineWidth = Math.max(1, H * 0.0016);
    ctx.beginPath();
    ctx.moveTo(endX, taglineBaseline - taglineSize * 0.3);
    ctx.lineTo(markX - taglineSize * 0.5, taglineBaseline - taglineSize * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.font = `700 ${markSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(0.34 * markSize).toFixed(2)}px`;
  ctx.fillStyle = 'rgba(255, 248, 236, 0.72)';
  ctx.fillText(markText, markX, taglineBaseline);
  ctx.restore();

  // Studio badge, top-right over the scene: three letters in a magenta disc.
  const radius = 0.048 * H;
  const bx = W - side - radius;
  const by = side + radius;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, radius, 0, Math.PI * 2);
  ctx.fillStyle = MAGENTA;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, radius * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 248, 232, 0.65)';
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8e8';
  ctx.font = `700 ${(radius * 0.78).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${(radius * 0.06).toFixed(2)}px`;
  ctx.fillText(opts.mark || 'NCT', bx, by + radius * 0.28);
  ctx.restore();

  ctx.restore();
  return { titleSize: size, baseline: taglineBaseline };
}
