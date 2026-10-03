/**
 * Draws one layer of a design onto a 2D context.
 *
 * Coordinates are in the design space (360 x 640); render.js scales the
 * context, so a design never knows the output resolution.
 */
import { drawMotif, drawFrame, drawPattern } from './ornaments.js';
import { layoutText, drawLines } from './text.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  if (!radius) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** A fill is a colour, or a gradient description a design can write as data. */
function toFillStyle(ctx, fill, env) {
  if (!fill) return null;
  if (typeof fill === 'string') return fill;

  if (fill.type === 'linear') {
    const g = ctx.createLinearGradient(fill.from[0], fill.from[1], fill.to[0], fill.to[1]);
    for (const [stop, colour] of fill.stops) g.addColorStop(stop, env.colour(colour) || colour);
    return g;
  }
  if (fill.type === 'radial') {
    const [cx, cy, r] = fill.circle || [180, 240, 320];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [stop, colour] of fill.stops) g.addColorStop(stop, env.colour(colour) || colour);
    return g;
  }
  return null;
}

function boxOf(layer, env) {
  const inset = layer.inset != null ? layer.inset : 0;
  return {
    x: layer.x != null ? layer.x : inset,
    y: layer.y != null ? layer.y : inset,
    w: layer.w != null ? layer.w : env.design.width - inset * 2,
    h: layer.h != null ? layer.h : env.design.height - inset * 2,
  };
}

function clipShape(ctx, layer, box) {
  if (layer.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) / 2, 0, Math.PI * 2);
  } else if (layer.shape === 'arch') {
    const r = box.w / 2;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h);
    ctx.lineTo(box.x, box.y + r);
    ctx.arc(box.x + r, box.y + r, r, Math.PI, 0);
    ctx.lineTo(box.x + box.w, box.y + box.h);
    ctx.closePath();
  } else {
    roundRectPath(ctx, box.x, box.y, box.w, box.h, layer.radius);
  }
}

/**
 * Cover-fit a bitmap into a box, honouring a focal point and extra zoom.
 *
 * The focal point is what makes a single photo slot usable for a portrait,
 * a group and a landscape: the subject stays in frame instead of being
 * cropped to the middle of the file.
 */
function drawCover(ctx, bitmap, box, focal = {}, zoom = 1) {
  const fx = focal.x != null ? focal.x : 0.5;
  const fy = focal.y != null ? focal.y : 0.5;
  const scale = Math.max(box.w / bitmap.width, box.h / bitmap.height) * (zoom || 1);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  // Place the focal point of the image at the focal point of the box, then
  // clamp so no edge of the box is left empty.
  let dx = box.x + box.w * fx - dw * fx;
  let dy = box.y + box.h * fy - dh * fy;
  dx = Math.min(box.x, Math.max(box.x + box.w - dw, dx));
  dy = Math.min(box.y, Math.max(box.y + box.h - dh, dy));
  ctx.drawImage(bitmap, dx, dy, dw, dh);
}

export function drawLayer(ctx, layer, env) {
  switch (layer.type) {
    case 'rect': {
      const style = toFillStyle(ctx, typeof layer.fill === 'string'
        ? env.colour(layer.fill) : layer.fill, env);
      if (!style) return;
      ctx.fillStyle = style;
      roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.fill();
      return;
    }

    case 'frame':
    case 'border': {
      const box = boxOf(layer, env);
      drawFrame(ctx, layer.name || 'thin', box.x, box.y, box.w, box.h, {
        stroke: env.colour(layer.stroke) || '#000',
        width: layer.width || 1,
        radius: layer.radius,
        gap: layer.gap,
        arm: layer.arm,
        step: layer.step,
      });
      return;
    }

    case 'pattern': {
      const box = boxOf(layer, env);
      drawPattern(ctx, layer.name || 'dots', box.x, box.y, box.w, box.h, {
        fill: env.colour(layer.fill) || '#ffffff',
        colours: (layer.colours || []).map((c) => env.colour(c) || c),
        alpha: layer.alpha,
        count: layer.count,
        step: layer.step,
        size: layer.size,
        seed: layer.seed,
        cx: layer.cx,
        cy: layer.cy,
        rotate: layer.rotate,
      });
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

    case 'motif':
    case 'icon': {
      drawMotif(ctx, layer.name, layer.x, layer.y, layer.size, {
        stroke: env.colour(layer.stroke),
        fill: layer.fill ? env.colour(layer.fill) : undefined,
        width: layer.width || 1.6,
        rotate: layer.rotate,
      });
      return;
    }

    case 'text': {
      const value = env.text(layer);
      if (!value) return;

      const family = env.font(layer.font, value);
      const weight = layer.weight || 400;
      const maxWidth = layer.maxWidth != null
        ? layer.maxWidth
        : env.design.width - 2 * (layer.margin != null ? layer.margin : 36);

      ctx.letterSpacing = layer.letterSpacing ? `${layer.letterSpacing}px` : '0px';
      const laid = layoutText(ctx, value, {
        family,
        weight,
        style: layer.italic ? 'italic' : 'normal',
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
      const photo = env.photo(layer.slot);
      const box = boxOf(layer, env);

      if (!photo) {
        // An empty slot still shows its shape, so the design does not collapse
        // into a hole while someone is deciding which picture to use.
        if (layer.placeholder === false) return;
        ctx.save();
        clipShape(ctx, layer, box);
        ctx.fillStyle = env.colour(layer.placeholderFill) || 'rgba(0,0,0,0.06)';
        ctx.fill();
        ctx.restore();
        if (layer.stroke) {
          ctx.save();
          clipShape(ctx, layer, box);
          ctx.strokeStyle = env.colour(layer.stroke);
          ctx.lineWidth = layer.width || 1;
          ctx.stroke();
          ctx.restore();
        }
        return;
      }

      ctx.save();
      clipShape(ctx, layer, box);
      ctx.clip();
      drawCover(ctx, photo.bitmap, box, photo.focal, photo.zoom);
      if (layer.scrim) {
        const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, env.colour(layer.scrim) || 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g;
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }
      ctx.restore();

      if (layer.stroke) {
        ctx.save();
        clipShape(ctx, layer, box);
        ctx.strokeStyle = env.colour(layer.stroke);
        ctx.lineWidth = layer.width || 1;
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    default:
      // An unknown type is a design bug, not a reason to abandon the frame.
      // tests/templates.mjs is where that gets caught.
  }
}
