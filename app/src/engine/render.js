/**
 * The renderer engine.
 *
 * One engine, many designs. A design is data: a palette, a font mapping, text
 * slots, a persistent background and a list of scenes whose layers each carry
 * a position, a size and an animation. Adding a design must never mean
 * changing this file.
 *
 * Designs are authored in a 360 x 640 space. The context is scaled once per
 * frame, so output resolution is not a design's problem.
 */
import { layerState, layerMotion } from './anim.js';
import { drawLayer } from './draw.js';
import { SCRIPT_FALLBACK } from './script-fonts.js';

export const DESIGN = { width: 360, height: 640 };
export const OUTPUT = { width: 720, height: 1280, fps: 30 };

/** Default dissolve between scenes when a design does not say otherwise. */
const DEFAULT_TRANSITION = 0.5;

/**
 * Where the family's pictures go. One control, three answers, because the
 * question people actually ask is "can I use my own photo" and the three
 * useful answers are: on a page of their own, behind the whole thing, or both.
 */
export const PHOTO_MODES = ['slide', 'background', 'both'];

/**
 * The arrangements, by how many pictures there are. Nobody is asked to pick a
 * layout: one picture fills the panel, two stand side by side, three put the
 * best one on top, four make a square. More than four stops being a card.
 */
function photoBoxes(area, count, gap) {
  const { x, y, w, h } = area;
  const g = gap;
  if (count <= 1) return [{ x, y, w, h }];
  if (count === 2) {
    const cw = (w - g) / 2;
    return [{ x, y, w: cw, h }, { x: x + cw + g, y, w: cw, h }];
  }
  if (count === 3) {
    const topH = Math.round((h - g) * 0.56);
    const botH = h - g - topH;
    const cw = (w - g) / 2;
    return [
      { x, y, w, h: topH },
      { x, y: y + topH + g, w: cw, h: botH },
      { x: x + cw + g, y: y + topH + g, w: cw, h: botH },
    ];
  }
  const cw = (w - g) / 2;
  const ch = (h - g) / 2;
  return [
    { x, y, w: cw, h: ch }, { x: x + cw + g, y, w: cw, h: ch },
    { x, y: y + ch + g, w: cw, h: ch }, { x: x + cw + g, y: y + ch + g, w: cw, h: ch },
  ];
}

/** The photo page's layers, built for the pictures that actually exist. */
function photoPageLayers(page, slots) {
  const area = { x: page.x, y: page.y, w: page.w, h: page.h };
  const boxes = photoBoxes(area, slots.length, page.gap != null ? page.gap : 10);
  // One shape for one picture, squarer shapes for a grid: an arch is a
  // portrait idea and reads as a doorway only when it has the room for one.
  const shape = slots.length === 1 ? page.shape : (page.shape === 'circle' ? 'circle' : 'rect');
  return boxes.map((box, i) => ({
    type: 'photo',
    slot: slots[i],
    ...box,
    shape,
    radius: page.radius,
    stroke: page.stroke,
    width: page.width,
    placeholderFill: '@bg',
    anchorX: 180,
    anchorY: box.y + box.h / 2,
    motion: slots.length === 1 ? { preset: 'zoom-in', amount: 0.06 } : undefined,
    anim: { in: { preset: 'scale-in', at: 0.1 + i * 0.12, dur: 0.8 } },
  }));
}

/**
 * Normalise a design once, so per-frame work stays cheap.
 *
 * @param {object} template
 * @param {object} [opts]
 * @param {string[]} [opts.photos]     slot names that actually have a picture
 * @param {string}   [opts.photoMode]  'slide' | 'background' | 'both'
 */
export function prepare(template, opts = {}) {
  const filled = new Set(opts.photos || []);
  const order = (template.photoSlots || []).map((p) => p.key).filter((k) => filled.has(k));
  const mode = PHOTO_MODES.includes(opts.photoMode) ? opts.photoMode : 'slide';
  const wantsSlide = order.length > 0 && (mode === 'slide' || mode === 'both');
  const wantsGround = order.length > 0 && (mode === 'background' || mode === 'both');
  const transition = template.transition != null ? template.transition : DEFAULT_TRANSITION;

  const scenes = [];
  let start = 0;

  for (const scene of template.scenes) {
    // A scene needing a photo the family has not supplied is dropped rather
    // than shown empty; the invite simply gets shorter.
    if (scene.requires && !filled.has(scene.requires)) continue;
    if (scene.photoPage && !wantsSlide) continue;

    const fadeOut = scene.fadeOut != null ? scene.fadeOut : transition;
    const layers = scene.photoPage
      ? photoPageLayers(scene.photoPage, order.slice(0, 4))
      : scene.layers;
    scenes.push({
      id: scene.id,
      start,
      duration: scene.duration,
      end: start + scene.duration,
      background: scene.background || null,
      layers: layers.map((layer) => withDefaultOut(layer, fadeOut)),
    });
    start += scene.duration;
  }

  return {
    id: template.id,
    name: template.name,
    design: template.design || DESIGN,
    palette: template.palette || {},
    fonts: template.fonts || {},
    background: groundLayers(template, wantsGround ? order[0] : null),
    scenes,
    duration: start,
  };
}

/**
 * The design's own background, with the family's picture under it if they
 * asked for one.
 *
 * The picture goes in just above the ground colour and is then washed with
 * that same colour. That is what keeps every text colour in the design
 * readable: the photograph becomes the paper's texture rather than a second
 * thing competing with the words. A full-strength photograph behind an
 * invitation is how every free template ruins a good picture.
 */
function groundLayers(template, slot) {
  const base = (template.background || []).map((l) => ({ ...l }));
  if (!slot) return base;
  // A design whose ground is already the photograph - photoLed - has its own
  // scrim and its own idea about where the text sits. Washing a second copy
  // underneath it achieves nothing except a slower frame.
  if (base.some((l) => l.type === 'photo')) return base;
  const wash = template.photoGround || {};
  const under = [
    {
      type: 'photo', slot, x: 0, y: 0, w: 360, h: 640,
      placeholder: false,
      anchorX: 180, anchorY: 320,
      motion: { preset: 'zoom-in', amount: 0.04 },
      anim: { in: { preset: 'fade', dur: 1.1 } },
    },
    {
      type: 'rect', x: 0, y: 0, w: 360, h: 640,
      fill: wash.fill || '@bg',
      alpha: wash.alpha != null ? wash.alpha : 0.82,
    },
  ];
  // After the ground colour, before the frame and the texture, so the design
  // still draws its own border over the family's picture.
  return [base[0], ...under, ...base.slice(1)];
}

function withDefaultOut(layer, fadeOut) {
  if (!fadeOut || (layer.anim && layer.anim.out)) return { ...layer };
  return {
    ...layer,
    anim: {
      ...(layer.anim || {}),
      out: { preset: layer.outPreset || 'fade', dur: fadeOut },
    },
  };
}

/** Every font family a design draws with, so only those get downloaded. */
export function templateFamilies(template) {
  return [...new Set(Object.values(template.fonts || {}))];
}

/** Total frames for a prepared timeline. */
export function frameCount(prepared, fps = OUTPUT.fps) {
  return Math.round(prepared.duration * fps);
}

/** The scene playing at time t, for the editor's storyboard. */
export function sceneAt(prepared, t) {
  return prepared.scenes.find((s) => t >= s.start && t < s.end)
    || prepared.scenes[prepared.scenes.length - 1]
    || null;
}

function interpolate(str, slots) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = slots[key];
    return v == null ? '' : String(v);
  });
}

function makeEnv(prepared, values) {
  const slots = values.slots || {};
  const photos = values.photos || {};
  const palette = { ...prepared.palette, ...(values.palette || {}) };

  // Every design's font stack ends with the script faces, so a family typing
  // Malayalam into a design built around a Latin serif still gets correctly
  // shaped Malayalam instead of boxes. The browser picks per glyph.
  const tail = SCRIPT_FALLBACK.map((f) => `"${f}"`).join(', ');

  return {
    design: prepared.design,

    photo(slot) {
      const p = photos[slot || 'p1'];
      return p && p.bitmap ? p : null;
    },

    colour(token) {
      if (!token) return null;
      if (typeof token === 'object') return token;
      return token.startsWith('@') ? palette[token.slice(1)] || null : token;
    },

    font(key) {
      const family = prepared.fonts[key] || key || 'sans-serif';
      return `"${family}", ${tail}, sans-serif`;
    },

    text(layer) {
      const raw = layer.text;
      if (raw == null) return '';
      const out = interpolate(raw, slots).trim();
      return layer.uppercase ? out.toUpperCase() : out;
    },
  };
}

const STILL = { opacity: 1, dx: 0, dy: 0, scale: 1, scaleX: 1, scaleY: 1 };

/**
 * Draw the whole frame at `t` seconds.
 *
 * @param {CanvasRenderingContext2D} ctx  a context sized to the output
 * @param {object} prepared               from prepare()
 * @param {object} values                 { slots, photos, palette }
 * @param {number} t                      seconds from the start
 */
export function renderFrame(ctx, prepared, values, t) {
  const { design } = prepared;
  const scale = ctx.canvas.width / design.width;
  const env = makeEnv(prepared, values);

  const time = Math.max(0, Math.min(t, Math.max(0, prepared.duration - 0.0001)));
  const scene = sceneAt(prepared, time);

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, design.width, design.height);

  // A scene may replace the background entirely.
  const background = scene && scene.background ? scene.background : prepared.background;
  for (const layer of background) {
    const state = layer.anim ? layerState(layer, time, prepared.duration) : STILL;
    if (!state) continue;
    paint(ctx, layer, state, layer.motion ? layerMotion(layer, time, prepared.duration) : null, env);
  }

  if (scene) {
    const local = time - scene.start;
    for (const layer of scene.layers) {
      const state = layerState(layer, local, scene.duration);
      if (!state) continue;
      paint(ctx, layer, state, layerMotion(layer, local, scene.duration), env);
    }
  }

  ctx.restore();
}

function paint(ctx, layer, state, motion, env) {
  if (state.opacity <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = state.opacity;

  const dx = state.dx + (motion ? motion.dx : 0);
  const dy = state.dy + (motion ? motion.dy : 0);
  const sc = state.scale * (motion ? motion.scale : 1);
  const rot = motion ? motion.rotate : 0;

  if (dx || dy || sc !== 1 || rot || state.scaleX !== 1 || state.scaleY !== 1) {
    // Transform about the layer's own anchor, so text grows from its centre
    // rather than sliding in from the corner of the frame.
    const ax = layer.anchorX != null ? layer.anchorX
      : (layer.x != null ? layer.x : env.design.width / 2);
    const ay = layer.anchorY != null ? layer.anchorY
      : (layer.y != null ? layer.y : env.design.height / 2);
    ctx.translate(ax + dx, ay + dy);
    ctx.scale(sc * state.scaleX, sc * state.scaleY);
    if (rot) ctx.rotate(rot);
    ctx.translate(-ax, -ay);
  }

  drawLayer(ctx, layer, env);
  ctx.restore();
}
