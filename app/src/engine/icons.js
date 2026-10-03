/**
 * Template artwork, drawn as canvas paths.
 *
 * Our own shapes only, per the licensing rules in CLAUDE.md. Each icon is
 * authored in its own small viewBox and scaled to the requested height, so a
 * template can ask for an icon at any size without new assets.
 */

/** @type {Record<string, {w: number, h: number, draw: (ctx: any) => void}>} */
const ICONS = {
  // Nilavilakku, the Kerala lamp. Same shape as the planning mockups.
  lamp: {
    w: 22, h: 30,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(11, 2);
      ctx.bezierCurveTo(14, 6, 14, 9, 11, 11);
      ctx.bezierCurveTo(8, 9, 8, 6, 11, 2);
      ctx.closePath();
      ctx.stroke();
      line(ctx, 3, 13, 19, 13);
      line(ctx, 11, 13, 11, 24);
      line(ctx, 8, 24, 14, 24);
      line(ctx, 5, 28, 17, 28);
    },
  },

  // Crescent: a disc with a second disc taken out of it, offset to the right.
  crescent: {
    w: 32, h: 32,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(16, 16, 15, 0, Math.PI * 2);
      ctx.arc(24, 13, 14, 0, Math.PI * 2);
      ctx.fill('evenodd');
    },
  },

  // Church arch for the Christian designs.
  arch: {
    w: 60, h: 82,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(2, 80);
      ctx.lineTo(2, 30);
      ctx.arc(30, 30, 28, Math.PI, 0);
      ctx.lineTo(58, 80);
      ctx.stroke();
    },
  },

  bell: {
    w: 24, h: 26,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(4, 19);
      ctx.bezierCurveTo(4, 9, 8, 6, 12, 5);
      ctx.bezierCurveTo(16, 6, 20, 9, 20, 19);
      ctx.closePath();
      ctx.stroke();
      line(ctx, 2, 19, 22, 19);
      ctx.beginPath();
      ctx.arc(12, 23, 2.2, 0, Math.PI * 2);
      ctx.stroke();
      line(ctx, 12, 2, 12, 5);
    },
  },

  // A small ornamental rule used between blocks of text.
  flourish: {
    w: 60, h: 10,
    draw(ctx) {
      line(ctx, 0, 5, 22, 5);
      line(ctx, 38, 5, 60, 5);
      ctx.beginPath();
      ctx.moveTo(26, 5);
      ctx.lineTo(30, 1);
      ctx.lineTo(34, 5);
      ctx.lineTo(30, 9);
      ctx.closePath();
      ctx.stroke();
    },
  },

  ring: {
    w: 36, h: 24,
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(13, 13, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(24, 13, 9.5, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
};

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function iconSize(name, height) {
  const icon = ICONS[name];
  if (!icon) return { width: 0, height: 0 };
  return { width: (height * icon.w) / icon.h, height };
}

/**
 * Draw an icon with its centre at (cx, cy).
 *
 * @param {string} name    key in ICONS
 * @param {number} height  drawn height in design units
 */
export function drawIcon(ctx, name, cx, cy, height, { stroke, fill, width = 1.6 } = {}) {
  const icon = ICONS[name];
  if (!icon) return;
  const scale = height / icon.h;

  ctx.save();
  ctx.translate(cx - (icon.w * scale) / 2, cy - height / 2);
  ctx.scale(scale, scale);
  ctx.lineWidth = width / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke) ctx.strokeStyle = stroke;
  if (fill) ctx.fillStyle = fill;
  else ctx.fillStyle = stroke || '#000';
  icon.draw(ctx);
  ctx.restore();
}

export const iconNames = Object.keys(ICONS);
