/**
 * Plays a design on a canvas, in real time, with no encoding.
 *
 * This is the answer to the biggest complaint about the first version: you
 * had to export a video to find out what you were getting. Now the editor
 * plays the finished thing as you type, and the storyboard shows every slide
 * with the real words already on it.
 */
import { prepare, renderFrame, sceneAt, templateFamilies } from '../engine/render.js';
import { ensureFonts } from '../engine/fonts.js';
import { toValues } from '../values.js';

export function createPlayer(canvas, options = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let template = options.template;
  let entered = options.entered || {};
  let photos = options.photos || {};
  let prepared = null;
  let time = 0;
  let playing = false;
  let raf = 0;
  let last = 0;
  let destroyed = false;

  const onTime = options.onTime || (() => {});
  const onEnd = options.onEnd || (() => {});

  function rebuild() {
    const filled = Object.keys(photos).filter((k) => photos[k] && photos[k].bitmap);
    prepared = prepare(template, { photos: filled });
    if (time > prepared.duration) time = 0;
  }

  function draw() {
    if (!prepared || destroyed) return;
    renderFrame(ctx, prepared, toValues(entered, photos), time);
    onTime(time, prepared.duration, sceneAt(prepared, time));
  }

  function tick(now) {
    if (!playing || destroyed) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    time += dt;
    if (time >= prepared.duration) {
      time = prepared.duration;
      draw();
      pause();
      onEnd();
      return;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing || destroyed) return;
    if (time >= prepared.duration - 0.01) time = 0;
    playing = true;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Load only the typefaces this design needs, then draw. */
  async function ready(base) {
    await ensureFonts(templateFamilies(template), base);
    if (destroyed) return;
    draw();
  }

  rebuild();

  return {
    get duration() { return prepared ? prepared.duration : 0; },
    get time() { return time; },
    get playing() { return playing; },
    get prepared() { return prepared; },
    play,
    pause,
    toggle() { playing ? pause() : play(); },
    seek(t) {
      time = Math.max(0, Math.min(t, prepared.duration));
      draw();
    },
    setEntered(next) { entered = next; draw(); },
    setPhotos(next) { photos = next; rebuild(); draw(); },
    setTemplate(next, nextEntered) {
      template = next;
      if (nextEntered) entered = nextEntered;
      rebuild();
      return ready(options.base);
    },
    redraw: draw,
    ready,
    destroy() { destroyed = true; pause(); },
  };
}

/**
 * Draw a single frame of a design into a canvas. Used for the gallery, where
 * thirty live players would be thirty animation loops.
 */
export async function drawStill(canvas, template, entered, { sceneId = 'names', offset = 2.2, base } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const prepared = prepare(template, { photos: [] });
  const scene = prepared.scenes.find((s) => s.id === sceneId) || prepared.scenes[0];
  const t = scene.start + Math.min(offset, scene.duration - 0.3);
  // Draw once with whatever is loaded so the card is never blank, then again
  // once the design's own typefaces have arrived.
  renderFrame(ctx, prepared, toValues(entered, {}), t);
  await ensureFonts(templateFamilies(template), base);
  renderFrame(ctx, prepared, toValues(entered, {}), t);
}
