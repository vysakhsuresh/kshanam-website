/**
 * The built-in music bed.
 *
 * CLAUDE.md is strict about audio licensing: no film songs, no popular music,
 * and anything we ship has to carry a licence that allows use inside videos
 * our users download. The simplest way to satisfy that on day one is to not
 * ship a recording at all - this synthesises a soft arpeggio from scratch, so
 * it is our own work and there is nothing to licence.
 *
 * Written as plain Float32 arithmetic rather than Web Audio because this runs
 * in a worker, where OfflineAudioContext is not available.
 *
 * Real royalty-free tracks can be added later as files; see docs in README.
 */

/** A gentle pentatonic figure, in semitones above C4, with the drone last. */
const FIGURE = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2];
const C4 = 261.6256;

const semitone = (n) => C4 * Math.pow(2, n / 12);

/**
 * Synthesise `duration` seconds of music.
 *
 * @returns {{channels: Float32Array[], sampleRate: number}}
 */
export function makeToneBed(duration, sampleRate = 48000, opts = {}) {
  const {
    noteEvery = 0.72,   // seconds between plucks
    peak = 0.2,         // keep it well under the voice-free headroom
    fadeIn = 1.6,
    fadeOut = 2.2,
  } = opts;

  const frames = Math.ceil(duration * sampleRate);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);

  // Plucked notes: a sine plus a quieter octave, with an exponential decay
  // that makes it read as a music box rather than a test tone.
  const noteCount = Math.ceil(duration / noteEvery);
  for (let n = 0; n < noteCount; n++) {
    const start = n * noteEvery;
    const freq = semitone(FIGURE[n % FIGURE.length]);
    const startFrame = Math.floor(start * sampleRate);
    const lifetime = Math.min(2.6, duration - start);
    if (lifetime <= 0) break;
    const endFrame = Math.min(frames, startFrame + Math.ceil(lifetime * sampleRate));

    // Alternate the stereo placement so the figure has a little width.
    const pan = n % 2 === 0 ? -0.25 : 0.25;
    const gl = 0.5 * (1 - pan);
    const gr = 0.5 * (1 + pan);

    for (let i = startFrame; i < endFrame; i++) {
      const t = (i - startFrame) / sampleRate;
      const env = Math.exp(-t * 2.1) * (1 - Math.exp(-t * 220));
      const s = (Math.sin(2 * Math.PI * freq * t)
        + 0.3 * Math.sin(4 * Math.PI * freq * t)) * env * 0.55;
      left[i] += s * gl;
      right[i] += s * gr;
    }
  }

  // A quiet drone two octaves down, so the gaps between plucks are not silent.
  const droneFreq = semitone(-24);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const wobble = 1 + 0.004 * Math.sin(2 * Math.PI * 0.12 * t);
    const s = Math.sin(2 * Math.PI * droneFreq * wobble * t) * 0.09;
    left[i] += s;
    right[i] += s;
  }

  // Normalise to the requested peak, then fade the ends.
  let max = 0;
  for (let i = 0; i < frames; i++) {
    max = Math.max(max, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = max > 0 ? peak / max : 0;

  const fadeInFrames = Math.min(frames, Math.floor(fadeIn * sampleRate));
  const fadeOutFrames = Math.min(frames, Math.floor(fadeOut * sampleRate));

  for (let i = 0; i < frames; i++) {
    let g = gain;
    if (i < fadeInFrames) g *= i / fadeInFrames;
    const fromEnd = frames - 1 - i;
    if (fromEnd < fadeOutFrames) g *= fromEnd / fadeOutFrames;
    left[i] *= g;
    right[i] *= g;
  }

  return { channels: [left, right], sampleRate };
}

/**
 * Trim or loop already-decoded PCM to exactly `duration`, with fades.
 * Used when the visitor picks a song from their own phone.
 */
export function fitPcm(channels, sampleRate, duration, { fadeIn = 0.8, fadeOut = 2 } = {}) {
  const frames = Math.ceil(duration * sampleRate);
  const out = channels.map(() => new Float32Array(frames));
  const sourceFrames = channels[0] ? channels[0].length : 0;
  if (!sourceFrames) return { channels: out, sampleRate };

  for (let c = 0; c < channels.length; c++) {
    const src = channels[c];
    for (let i = 0; i < frames; i++) out[c][i] = src[i % sourceFrames];
  }

  const fadeInFrames = Math.min(frames, Math.floor(fadeIn * sampleRate));
  const fadeOutFrames = Math.min(frames, Math.floor(fadeOut * sampleRate));
  for (let i = 0; i < frames; i++) {
    let g = 1;
    if (i < fadeInFrames) g *= i / fadeInFrames;
    const fromEnd = frames - 1 - i;
    if (fromEnd < fadeOutFrames) g *= fromEnd / fadeOutFrames;
    for (let c = 0; c < out.length; c++) out[c][i] *= g;
  }

  return { channels: out, sampleRate };
}

/** Interleave planar channels, which is what AudioSample's 'f32' format wants. */
export function interleave(channels, from, frameCount) {
  const ch = channels.length;
  const out = new Float32Array(frameCount * ch);
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < ch; c++) out[i * ch + c] = channels[c][from + i] || 0;
  }
  return out;
}
