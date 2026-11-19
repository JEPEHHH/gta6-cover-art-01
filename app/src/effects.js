// The print-shop layer: pasted prints with a hard offset shadow and a white keyline, the dark plate the caption
// sits on, the bottom scrim, the unifying wash and the poster frame.

export function drawPastedPrint(ctx, print, box, angle, W) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = Math.max(2, Math.round(W * 0.012));
  const dy = Math.max(2, Math.round(W * 0.014));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(4,2,9,0.55)';
  ctx.fillRect(-box.w / 2 + dx, -box.h / 2 + dy, box.w, box.h);
  ctx.save();
  ctx.shadowColor = 'rgba(4,2,9,0.55)';
  ctx.shadowBlur = Math.max(6, box.w * 0.055);
  ctx.shadowOffsetX = dx * 0.5;
  ctx.shadowOffsetY = dy * 0.5;
  ctx.drawImage(print, -box.w / 2, -box.h / 2, box.w, box.h);
  ctx.restore();
  // 2 px white keyline, inside the print
  ctx.strokeStyle = 'rgba(255,248,236,0.92)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-box.w / 2 + 1, -box.h / 2 + 1, box.w - 2, box.h - 2);
  ctx.restore();
}

export function drawEmptyPrint(ctx, box, angle, W, gradeWarm) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const fill = ctx.createLinearGradient(-box.w / 2, -box.h / 2, box.w / 2, box.h / 2);
  fill.addColorStop(0, gradeWarm ? '#3d0d47' : '#1b1230');
  fill.addColorStop(1, gradeWarm ? '#8e1d5c' : '#2c1c40');
  ctx.fillStyle = fill;
  ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
  ctx.strokeStyle = 'rgba(255,248,236,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-box.w / 2 + 1, -box.h / 2 + 1, box.w - 2, box.h - 2);
  ctx.restore();
}

export function drawCaptionPlate(ctx, W, H, plateTop) {
  const plate = ctx.createLinearGradient(0, plateTop, 0, H);
  plate.addColorStop(0, '#0d0716');
  plate.addColorStop(1, '#08050f');
  ctx.fillStyle = plate;
  ctx.fillRect(0, plateTop, W, H - plateTop);
  const glow = ctx.createLinearGradient(0, plateTop, 0, plateTop + (H - plateTop) * 0.34);
  glow.addColorStop(0, 'rgba(255,45,120,0.12)');
  glow.addColorStop(1, 'rgba(255,45,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, plateTop, W, (H - plateTop) * 0.34);
  ctx.fillStyle = 'rgba(255,45,120,0.55)';
  ctx.fillRect(0, plateTop, W, Math.max(2, H * 0.0022));
}

export function drawBottomScrim(ctx, W, H, fromY) {
  const scrim = ctx.createLinearGradient(0, fromY, 0, H);
  scrim.addColorStop(0, 'rgba(6,3,10,0)');
  scrim.addColorStop(0.45, 'rgba(6,3,10,0.42)');
  scrim.addColorStop(1, 'rgba(6,3,10,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, fromY, W, H - fromY);
}

// One very light wash over the poster area so the graded prints and the painted scene share a light.
export function drawUnifyingWash(ctx, box, W, H) {
  const warm = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  warm.addColorStop(0, 'rgba(255,45,120,0.09)');
  warm.addColorStop(0.55, 'rgba(255,120,90,0.06)');
  warm.addColorStop(1, 'rgba(255,176,58,0.08)');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = warm;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const cool = ctx.createLinearGradient(0, box.y + box.h * 0.6, 0, box.y + box.h);
  cool.addColorStop(0, 'rgba(10,43,74,0)');
  cool.addColorStop(1, 'rgba(10,43,74,0.30)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = cool;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

export function drawPosterFrame(ctx, W, H, side) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,248,236,0.14)';
  ctx.lineWidth = Math.max(1, Math.round(W * 0.001));
  ctx.strokeRect(side * 0.42, side * 0.42, W - side * 0.84, H - side * 0.84);
  ctx.strokeStyle = 'rgba(255,45,120,0.35)';
  ctx.lineWidth = Math.max(2, Math.round(W * 0.0022));
  const len = Math.round(Math.min(W, H) * 0.06);
  const m = side * 0.42;
  ctx.beginPath();
  ctx.moveTo(m, m + len);
  ctx.lineTo(m, m);
  ctx.lineTo(m + len, m);
  ctx.moveTo(W - m - len, H - m);
  ctx.lineTo(W - m, H - m);
  ctx.lineTo(W - m, H - m - len);
  ctx.stroke();
  ctx.restore();
}
