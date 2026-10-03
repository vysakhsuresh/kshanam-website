/**
 * The renderer engine.
 *
 * One engine, many designs. A template is data: scenes, timings, text slots,
 * palette, fonts and animations. Adding a design must never mean changing
 * this file - that rule is what makes "numerous designs" achievable.
 *
 * Templates are authored in a 360 x 640 design space, the same numbers as the
 * planning mockups. The context is scaled once per frame, so the output can be
 * 720 x 1280 (or anything else) without a template knowing.
 */
import { layerState } from './anim.js';
import { drawLayer } from './draw.js';

export const DESIGN = { width: 360, height: 640 };
export const OUTPUT = { width: 720, height: 1280, fps: 30 };

/** The end card every design shares, unless a template supplies its own. */
export const DEFAULT_END_CARD = {
  id: 'end-card',
  duration: 2,
  background: [{ type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: '#7A1F2B' }],
  layers: [
    { type: 'icon', name: 'lamp', x: 180, y: 212, size: 60, stroke: '#F2C14E', width: 1.6,
      anim: { preset: 'fade', dur: 0.5 } },
    { type: 'text', text: 'Made free on', font: 'ui', size: 16, color: '#F6D9DD', x: 180, y: 276,
      anim: { in: { preset: 'fade-up', at: 0.15, dur: 0.5 } } },
    { type: 'text', text: 'Kshanam', font: 'display', size: 48, color: '#FFFFFF', x: 180, y: 320,
      anim: { in: { preset: 'fade-up', at: 0.25, dur: 0.5 } } },
    { type: 'text', text: 'Make your own invite video in 2 minutes', font: 'ui', size: 19,
      color: '#FFFFFF', x: 180, y: 378, maxWidth: 250, maxLines: 2, lineHeight: 1.35,
      anim: { in: { preset: 'fade-up', at: 0.35, dur: 0.5 } } },
    { type: 'rect', x: 92, y: 416, w: 176, h: 38, radius: 19, fill: '#FFFFFF',
      anim: { in: { preset: 'scale-in', at: 0.45, dur: 0.45 } } },
    { type: 'text', text: '{{domain}}', font: 'ui', weight: 700, size: 18, color: '#7A1F2B',
      x: 180, y: 436, maxWidth: 160,
      anim: { in: { preset: 'scale-in', at: 0.45, dur: 0.45 } } },
    { type: 'text', text: 'No sign-up. No watermark.', font: 'ui', size: 14, color: '#F6D9DD',
      x: 180, y: 480, anim: { in: { preset: 'fade', at: 0.6, dur: 0.5 } } },
  ],
};

/**
 * Normalise a template once, so per-frame work stays cheap.
 *
 * @param {object} template
 * @param {object} [opts]
 * @param {boolean} [opts.endCard=true]  append the "Made free on Kshanam" card
 * @param {boolean} [opts.hasPhoto=false] keep scenes that need a photo
 */
export function prepare(template, opts = {}) {
  const { endCard = true, hasPhoto = false } = opts;

  const scenes = [];
  let start = 0;

  const source = [...template.scenes];
  if (endCard) source.push(template.endCard || DEFAULT_END_CARD);

  for (const scene of source) {
    // A scene that needs something the user did not supply (a photo) is
    // dropped rather than shown empty, and the video simply gets shorter.
    if (scene.requires === 'photo' && !hasPhoto) continue;

    const layers = scene.layers.map((layer) => withDefaultOut(layer, scene));
    scenes.push({
      id: scene.id,
      start,
      duration: scene.duration,
      end: start + scene.duration,
      background: scene.background || null,
      layers,
    });
    start += scene.duration;
  }

  return {
    id: template.id,
    design: template.design || DESIGN,
    palette: template.palette || {},
    fonts: template.fonts || {},
    background: (template.background || []).map((l) => ({ ...l })),
    scenes,
    duration: start,
  };
}

/**
 * A scene's `fadeOut` gives every one of its layers an exit, so scene changes
 * read as a dissolve instead of a cut. An explicit anim.out always wins.
 */
function withDefaultOut(layer, scene) {
  if (!scene.fadeOut) return { ...layer };
  if (layer.anim && layer.anim.out) return { ...layer };
  return {
    ...layer,
    anim: {
      ...(layer.anim || {}),
      out: { preset: layer.outPreset || 'fade', dur: scene.fadeOut },
    },
  };
}

/** Pull `{{slot}}` values out of the user's details. */
function interpolate(str, slots) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = slots[key];
    return v == null ? '' : String(v);
  });
}

function makeEnv(prepared, values) {
  const slots = values.slots || {};
  const lang = values.lang || 'en';
  const palette = { ...prepared.palette, ...(values.palette || {}) };

  return {
    design: prepared.design,
    photo: values.photo || null,

    colour(token) {
      if (!token) return null;
      if (typeof token === 'object') return token; // gradient description
      return token.startsWith('@') ? palette[token.slice(1)] || null : token;
    },

    font(key) {
      const family = prepared.fonts[key] || key || 'sans-serif';
      // Quoted so a family with a space survives the shorthand font string.
      return `"${family}"`;
    },

    text(layer) {
      let raw = layer.text;
      if (raw && typeof raw === 'object') {
        const key = layer.lang || (lang === 'ml' ? 'ml' : 'en');
        raw = raw[key] != null ? raw[key] : raw.en;
      }
      if (raw == null) return '';
      const out = interpolate(raw, slots).trim();
      return layer.uppercase ? out.toUpperCase() : out;
    },
  };
}

/**
 * Is this layer shown at all, given the chosen invite language?
 *
 * `modes` is the precise form: the exact invite languages this layer belongs
 * to, which is how a design can move its title up when there is no second
 * line under it. `lang` is the shorthand: show in that language and in both.
 */
function visibleInLanguage(layer, lang) {
  if (layer.modes) return layer.modes.includes(lang);
  if (!layer.lang) return true;
  if (lang === 'both') return true;
  return layer.lang === lang;
}

/**
 * Draw the whole frame at `t` seconds.
 *
 * @param {CanvasRenderingContext2D} ctx  a context sized to the output
 * @param {object} prepared               from prepare()
 * @param {object} values                 { slots, lang, photo, palette }
 * @param {number} t                      seconds from the start of the video
 */
export function renderFrame(ctx, prepared, values, t) {
  const { design } = prepared;
  const canvas = ctx.canvas;
  const scale = canvas.width / design.width;
  const env = makeEnv(prepared, values);
  const lang = values.lang || 'en';

  const time = Math.max(0, Math.min(t, prepared.duration - 0.0001));
  const scene = prepared.scenes.find((s) => time >= s.start && time < s.end)
    || prepared.scenes[prepared.scenes.length - 1];

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // A scene may replace the background entirely - that is how the end card
  // turns the whole frame maroon without the invite's bands showing through.
  const background = scene && scene.background ? scene.background : prepared.background;
  ctx.clearRect(0, 0, design.width, design.height);
  for (const layer of background) {
    if (!visibleInLanguage(layer, lang)) continue;
    const state = layer.anim ? layerState(layer, time, prepared.duration) : { opacity: 1, dx: 0, dy: 0, scale: 1, scaleX: 1, scaleY: 1 };
    if (!state) continue;
    paint(ctx, layer, state, env);
  }

  if (scene) {
    const local = time - scene.start;
    for (const layer of scene.layers) {
      if (!visibleInLanguage(layer, lang)) continue;
      const state = layerState(layer, local, scene.duration);
      if (!state) continue;
      paint(ctx, layer, state, env);
    }
  }

  ctx.restore();
}

function paint(ctx, layer, state, env) {
  if (state.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = state.opacity;

  const needsTransform = state.dx || state.dy || state.scale !== 1
    || state.scaleX !== 1 || state.scaleY !== 1;

  if (needsTransform) {
    // Scale about the layer's own anchor so text grows from its centre
    // rather than sliding in from the corner of the frame.
    const ax = layer.anchorX != null ? layer.anchorX : (layer.x != null ? layer.x : env.design.width / 2);
    const ay = layer.anchorY != null ? layer.anchorY : (layer.y != null ? layer.y : env.design.height / 2);
    ctx.translate(ax + state.dx, ay + state.dy);
    ctx.scale(state.scale * state.scaleX, state.scale * state.scaleY);
    ctx.translate(-ax, -ay);
  }

  drawLayer(ctx, layer, env);
  ctx.restore();
}

/** Total frames for a prepared timeline at a given frame rate. */
export function frameCount(prepared, fps = OUTPUT.fps) {
  return Math.round(prepared.duration * fps);
}
