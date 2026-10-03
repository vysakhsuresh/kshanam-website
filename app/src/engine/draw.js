/**
 * Draws one layer of a template onto a 2D context.
 *
 * Every coordinate here is in the template's design space (360 x 640, the
 * same numbers as the planning mockups). render.js scales the context, so a
 * design never has to know the output resolution.
 */
import { drawIcon } from './icons.js';
import { layoutText, drawLines } from './text.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  if (!radius) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/** A fill can be a colour string or a linear-gradient description. */
function toFillStyle(ctx, fill) {
  if (!fill) return null;
  if (typeof fill === 'string') return fill;
  if (fill.type === 'linear') {
    const g = ctx.createLinearGradient(fill.from[0], fill.from[1], fill.to[0], fill.to[1]);
    for (const [stop, colour] of fill.stops) g.addColorStop(stop, colour);
    return g;
  }
  return null;
}

/** Cover-fit a bitmap into a box, cropping the overflow like CSS object-fit. */
function drawCover(ctx, bitmap, x, y, w, h) {
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  ctx.drawImage(bitmap, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer     normalised layer definition
 * @param {object} env       { text(layer), colour(token), font(key), photo, design }
 */
export function drawLayer(ctx, layer, env) {
  switch (layer.type) {
    case 'rect': {
      const style = toFillStyle(ctx, env.colour(layer.fill));
      if (!style) return;
      ctx.fillStyle = style;
      roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.fill();
      return;
    }

    case 'border': {
      const inset = layer.inset != null ? layer.inset : 0;
      const x = layer.x != null ? layer.x : inset;
      const y = layer.y != null ? layer.y : inset;
      const w = layer.w != null ? layer.w : env.design.width - inset * 2;
      const h = layer.h != null ? layer.h : env.design.height - inset * 2;
      ctx.strokeStyle = env.colour(layer.stroke) || '#000';
      ctx.lineWidth = layer.width || 1;
      roundRectPath(ctx, x, y, w, h, layer.radius);
      ctx.stroke();
      return;
    }

    case 'line': {
      ctx.strokeStyle = env.colour(layer.stroke) || '#000';
      ctx.lineWidth = layer.width || 1;
      ctx.lineCap = layer.cap || 'butt';
      ctx.beginPath();
      ctx.moveTo(layer.x1, layer.y1);
      ctx.lineTo(layer.x2, layer.y2);
      ctx.stroke();
      return;
    }

    case 'icon': {
      drawIcon(ctx, layer.name, layer.x, layer.y, layer.size, {
        stroke: env.colour(layer.stroke),
        fill: layer.fill ? env.colour(layer.fill) : undefined,
        width: layer.width || 1.6,
      });
      return;
    }

    case 'text': {
      const value = env.text(layer);
      if (!value) return;

      const family = env.font(layer.font);
      const weight = layer.weight || 400;
      const maxWidth = layer.maxWidth != null
        ? layer.maxWidth
        : env.design.width - 2 * (layer.margin != null ? layer.margin : 36);

      ctx.letterSpacing = layer.letterSpacing ? `${layer.letterSpacing}px` : '0px';
      const laid = layoutText(ctx, value, {
        family,
        weight,
        size: layer.size,
        maxWidth,
        maxLines: layer.maxLines || 1,
        lineHeight: layer.lineHeight || 1.18,
        minSize: layer.minSize,
      });

      ctx.fillStyle = env.colour(layer.color) || '#000';
      drawLines(ctx, laid.lines, layer.x, layer.y, laid.lineHeight, layer.align || 'center');
      ctx.letterSpacing = '0px';
      return;
    }

    case 'photo': {
      const photo = env.photo;
      if (!photo) return;
      ctx.save();
      if (layer.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(layer.x + layer.w / 2, layer.y + layer.h / 2, Math.min(layer.w, layer.h) / 2, 0, Math.PI * 2);
        ctx.clip();
      } else {
        roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
        ctx.clip();
      }
      drawCover(ctx, photo, layer.x, layer.y, layer.w, layer.h);
      ctx.restore();
      if (layer.stroke) {
        ctx.strokeStyle = env.colour(layer.stroke);
        ctx.lineWidth = layer.width || 1;
        if (layer.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(layer.x + layer.w / 2, layer.y + layer.h / 2, Math.min(layer.w, layer.h) / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
          ctx.stroke();
        }
      }
      return;
    }

    default:
      // An unknown layer type is a template bug, not a reason to abandon the
      // frame: draw everything else and let the template test report it.
      return;
  }
}
