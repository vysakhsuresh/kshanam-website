/**
 * Animation presets.
 *
 * A layer says when it enters and leaves; this turns the clock into a plain
 * transform the drawing code applies. Keeping it declarative is what lets a
 * new design ship as a JSON file instead of new code.
 */

export const easings = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Each preset maps progress (0 entering .. 1 fully in) to a transform.
 * `out` animations are played with the same function at 1 - progress.
 */
export const presets = {
  fade: () => ({}),
  'fade-up': (p) => ({ dy: (1 - p) * 18 }),
  'fade-down': (p) => ({ dy: (1 - p) * -18 }),
  'fade-in-left': (p) => ({ dx: (1 - p) * -24 }),
  'fade-in-right': (p) => ({ dx: (1 - p) * 24 }),
  'rise': (p) => ({ dy: (1 - p) * 40 }),
  'scale-in': (p) => ({ scale: 0.88 + 0.12 * p }),
  'scale-soft': (p) => ({ scale: 0.97 + 0.03 * p }),
  'grow-width': (p) => ({ scaleX: p }),
  'grow-height': (p) => ({ scaleY: p }),
  'none': () => ({}),
};

const DEFAULT_IN = { preset: 'fade-up', at: 0, dur: 0.6, ease: 'outCubic' };
const DEFAULT_OUT = { preset: 'fade', dur: 0.4, ease: 'inCubic' };

/**
 * Work out how a layer should be drawn at `t` seconds into its scene.
 *
 * Returns null when the layer is not on screen at all, so the caller can skip
 * it entirely rather than drawing something fully transparent.
 *
 * @param {object} layer       the layer definition
 * @param {number} t           seconds since the scene started
 * @param {number} sceneDur    the scene's total length in seconds
 */
export function layerState(layer, t, sceneDur) {
  const anim = layer.anim || {};
  const inn = { ...DEFAULT_IN, ...(anim.in || {}) };
  // A layer with anim.out omitted stays until the scene ends and is then cut
  // with the rest of the scene, which is what most layers want.
  const out = anim.out ? { ...DEFAULT_OUT, ...anim.out } : null;

  if (t < inn.at) return null;

  let opacity = 1;
  let tf = {};

  const inProgress = inn.dur > 0 ? clamp01((t - inn.at) / inn.dur) : 1;
  const inEase = easings[inn.ease] || easings.outCubic;
  const ip = inEase(inProgress);
  opacity = inProgress;
  tf = (presets[inn.preset] || presets.fade)(ip);

  if (out) {
    const outAt = out.at != null ? out.at : sceneDur - out.dur;
    if (t >= outAt) {
      const outProgress = out.dur > 0 ? clamp01((t - outAt) / out.dur) : 1;
      const outEase = easings[out.ease] || easings.inCubic;
      const op = 1 - outEase(outProgress);
      opacity = Math.min(opacity, op);
      tf = (presets[out.preset] || presets.fade)(op);
      if (outProgress >= 1) return null;
    }
  }

  return {
    opacity: clamp01(opacity) * (layer.opacity != null ? layer.opacity : 1),
    dx: tf.dx || 0,
    dy: tf.dy || 0,
    scale: tf.scale != null ? tf.scale : 1,
    scaleX: tf.scaleX != null ? tf.scaleX : 1,
    scaleY: tf.scaleY != null ? tf.scaleY : 1,
  };
}

/**
 * Slow movement that runs for the whole time a layer is on screen.
 *
 * This is what stops a still frame from looking like a still frame: a photo
 * drifting imperceptibly closer, a title easing upward. `anim` handles the
 * entrance and exit; `motion` handles the middle.
 */
export const motions = {
  'zoom-in': (p, a) => ({ scale: 1 + (a != null ? a : 0.08) * p }),
  'zoom-out': (p, a) => ({ scale: 1 + (a != null ? a : 0.08) * (1 - p) }),
  'pan-left': (p, a) => ({ dx: -(a != null ? a : 14) * p }),
  'pan-right': (p, a) => ({ dx: (a != null ? a : 14) * p }),
  'pan-up': (p, a) => ({ dy: -(a != null ? a : 14) * p }),
  'drift-up': (p, a) => ({ dy: -(a != null ? a : 10) * p }),
  'float': (p, a) => ({ dy: Math.sin(p * Math.PI * 2) * (a != null ? a : 4) }),
  'sway': (p, a) => ({ dx: Math.sin(p * Math.PI * 2) * (a != null ? a : 5) }),
  'spin-slow': (p, a) => ({ rotate: p * (a != null ? a : 0.08) }),
};

/** @returns {{dx:number, dy:number, scale:number, rotate:number}} */
export function layerMotion(layer, t, sceneDur) {
  const m = layer.motion;
  if (!m) return null;
  const fn = motions[typeof m === 'string' ? m : m.preset];
  if (!fn) return null;
  const p = sceneDur > 0 ? Math.max(0, Math.min(1, t / sceneDur)) : 0;
  const out = fn(p, typeof m === 'object' ? m.amount : undefined);
  return {
    dx: out.dx || 0,
    dy: out.dy || 0,
    scale: out.scale != null ? out.scale : 1,
    rotate: out.rotate || 0,
  };
}
