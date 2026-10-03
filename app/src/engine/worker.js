/**
 * Renders the video off the main thread.
 *
 * Drawing 900 frames on the main thread would freeze the page on the phone we
 * are designing for, so all of it happens here on an OffscreenCanvas and the
 * page only receives progress messages and, at the end, the finished file.
 */
import { loadFonts } from './fonts.js';
import { renderToMp4, detectCapabilities } from './encode.js';
import { OUTPUT } from './render.js';

const state = { signal: { aborted: false } };

self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'cancel') {
    state.signal.aborted = true;
    return;
  }

  if (msg.type === 'capabilities') {
    try {
      const caps = await detectCapabilities(msg.size || {});
      self.postMessage({ type: 'capabilities', id: msg.id, caps });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
    }
    return;
  }

  if (msg.type !== 'render') return;

  state.signal = { aborted: false };

  try {
    const width = msg.width || OUTPUT.width;
    const height = msg.height || OUTPUT.height;

    // Fonts first, always. A frame drawn before the Malayalam face is ready
    // is a frame full of boxes, and it is already encoded by the time anyone
    // notices.
    self.postMessage({ type: 'progress', phase: 'fonts', progress: 0 });
    await loadFonts(msg.baseUrl || '/');

    const canvas = new OffscreenCanvas(width, height);

    const result = await renderToMp4({
      template: msg.template,
      values: msg.values,
      canvas,
      fps: msg.fps,
      endCard: msg.endCard !== false,
      music: msg.music || 'tones',
      pcm: msg.pcm || null,
      signal: state.signal,
      onProgress: (p) => self.postMessage({ type: 'progress', ...p }),
    });

    self.postMessage({ type: 'done', result }, [result.buffer]);
  } catch (err) {
    self.postMessage({
      type: err && err.name === 'Cancelled' ? 'cancelled' : 'error',
      message: String((err && err.message) || err),
    });
  }
};
