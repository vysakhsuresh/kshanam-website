/**
 * The music beds.
 *
 * CLAUDE.md is strict: no film songs, no popular music, and anything we ship
 * has to carry a licence covering use inside videos people download. The
 * cleanest way to satisfy that is to ship no recordings at all — every track
 * here is synthesised from scratch, so it is our own work and there is
 * nothing to licence and nothing to attribute.
 *
 * Plain Float32 arithmetic rather than Web Audio, because this runs in a
 * worker where OfflineAudioContext does not exist.
 */

const A4 = 440;
/** Semitones above middle C for each scale degree. */
const SCALES = {
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

const noteHz = (semitonesFromA4) => A4 * Math.pow(2, semitonesFromA4 / 12);

/* ------------------------------------------------------------------ voices */

/** Struck and left to ring: music box, celesta, kalimba. */
function pluck(t, freq, decay) {
  const env = Math.exp(-t * decay) * (1 - Math.exp(-t * 260));
  return (Math.sin(TAU * freq * t) + 0.32 * Math.sin(2 * TAU * freq * t)
    + 0.12 * Math.sin(3 * TAU * freq * t)) * env * 0.5;
}

/** Hammer and felt: slower attack, longer tail, a little detune. */
function piano(t, freq, decay) {
  const env = Math.exp(-t * decay) * (1 - Math.exp(-t * 90));
  return (Math.sin(TAU * freq * t)
    + 0.22 * Math.sin(2 * TAU * freq * t * 1.0008)
    + 0.08 * Math.sin(4 * TAU * freq * t)) * env * 0.55;
}

/** Bowed: slow swell, vibrato, no real attack. */
function strings(t, freq, decay) {
  const swell = Math.min(1, t / 0.9) * Math.exp(-t * decay);
  const vib = 1 + 0.004 * Math.sin(TAU * 5.2 * t);
  return (Math.sin(TAU * freq * vib * t)
    + 0.4 * Math.sin(2 * TAU * freq * vib * t)
    + 0.2 * Math.sin(3 * TAU * freq * vib * t)) * swell * 0.33;
}

/** Breath: almost pure, gentle vibrato, soft edges. */
function flute(t, freq, decay) {
  const env = Math.min(1, t / 0.35) * Math.exp(-t * decay);
  const vib = 1 + 0.006 * Math.sin(TAU * 4.6 * t);
  return (Math.sin(TAU * freq * vib * t) + 0.07 * Math.sin(3 * TAU * freq * t)) * env * 0.5;
}

const TAU = Math.PI * 2;
const VOICES = { pluck, piano, strings, flute };

/* ------------------------------------------------------------------ tracks */

/**
 * Each track is a voice, a scale, a tempo and a shape. Different enough that
 * a first birthday and a memorial do not get the same music.
 */
export const TRACKS = [
  { id: 'none', name: 'No music', mood: 'Silence' },
  { id: 'music-box', name: 'Music box', mood: 'Delicate, nostalgic',
    voice: 'pluck', scale: 'majorPent', root: 3, every: 0.72, decay: 2.1, octave: 1, drone: -24, droneGain: 0.09, peak: 0.2 },
  { id: 'soft-piano', name: 'Soft piano', mood: 'Warm, unhurried',
    voice: 'piano', scale: 'major', root: -2, every: 0.9, decay: 1.5, octave: 0, drone: -26, droneGain: 0.07, peak: 0.22 },
  { id: 'warm-strings', name: 'Warm strings', mood: 'Full, ceremonial',
    voice: 'strings', scale: 'major', root: -5, every: 2.4, decay: 0.5, octave: 0, chord: [0, 4, 7], drone: -29, droneGain: 0.12, peak: 0.24 },
  { id: 'temple-bells', name: 'Temple bells', mood: 'Bright, ceremonial',
    voice: 'pluck', scale: 'majorPent', root: 7, every: 1.1, decay: 1.2, octave: 2, drone: -22, droneGain: 0.08, peak: 0.2 },
  { id: 'calm-flute', name: 'Calm flute', mood: 'Open, airy',
    voice: 'flute', scale: 'majorPent', root: 0, every: 1.3, decay: 0.8, octave: 1, drone: -27, droneGain: 0.09, peak: 0.21 },
  { id: 'celebration', name: 'Celebration', mood: 'Lively, upbeat',
    voice: 'pluck', scale: 'major', root: 5, every: 0.36, decay: 3.4, octave: 1, drone: -20, droneGain: 0.05, peak: 0.23, wander: 3 },
  { id: 'evening-raga', name: 'Evening', mood: 'Reflective, slow',
    voice: 'flute', scale: 'aeolian', root: -4, every: 1.6, decay: 0.7, octave: 0, drone: -28, droneGain: 0.12, peak: 0.2 },
  { id: 'first-light', name: 'First light', mood: 'Hopeful, cinematic',
    voice: 'strings', scale: 'lydian', root: 2, every: 2.8, decay: 0.4, octave: 0, chord: [0, 7, 11], drone: -31, droneGain: 0.13, peak: 0.25 },
];

export const trackById = (id) => TRACKS.find((t) => t.id === id) || null;

/** A walking figure over the scale, so a track never loops audibly. */
function figure(spec, index) {
  const scale = SCALES[spec.scale] || SCALES.majorPent;
  const shape = [0, 2, 1, 3, 2, 4, 3, 1];
  const step = shape[index % shape.length];
  const lift = spec.wander ? Math.floor(index / shape.length) % spec.wander : 0;
  const degree = (step + lift) % scale.length;
  const octave = Math.floor((step + lift) / scale.length);
  return scale[degree] + 12 * (octave + (spec.octave || 0));
}

/**
 * Synthesise `duration` seconds of a track.
 * @returns {{channels: Float32Array[], sampleRate: number}}
 */
export function renderTrack(id, duration, sampleRate = 48000) {
  const spec = trackById(id);
  const frames = Math.ceil(duration * sampleRate);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  if (!spec || spec.id === 'none') return { channels: [left, right], sampleRate };

  const voice = VOICES[spec.voice] || pluck;
  const notes = Math.ceil(duration / spec.every);

  for (let n = 0; n < notes; n++) {
    const start = n * spec.every;
    const life = Math.min(spec.chord ? spec.every + 2.2 : 3.2, duration - start);
    if (life <= 0) break;

    const from = Math.floor(start * sampleRate);
    const to = Math.min(frames, from + Math.ceil(life * sampleRate));
    const semis = (spec.root || 0) + figure(spec, n);
    const voicing = spec.chord || [0];

    // Alternate placement so the figure has a little width.
    const pan = n % 2 === 0 ? -0.22 : 0.22;
    const gl = 0.5 * (1 - pan);
    const gr = 0.5 * (1 + pan);

    for (let i = from; i < to; i++) {
      const t = (i - from) / sampleRate;
      let s = 0;
      for (const interval of voicing) {
        s += voice(t, noteHz(semis + interval - 9), spec.decay) / voicing.length;
      }
      left[i] += s * gl;
      right[i] += s * gr;
    }
  }

  // A quiet drone underneath, so the gaps between notes are not dead air.
  if (spec.droneGain) {
    const hz = noteHz((spec.root || 0) + (spec.drone || -24) - 9);
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      const wobble = 1 + 0.004 * Math.sin(TAU * 0.11 * t);
      const s = Math.sin(TAU * hz * wobble * t) * spec.droneGain;
      left[i] += s;
      right[i] += s;
    }
  }

  return normalise({ channels: [left, right], sampleRate }, spec.peak || 0.2, duration);
}

function normalise(audio, peak, duration) {
  const [left, right] = audio.channels;
  const frames = left.length;
  let max = 0;
  for (let i = 0; i < frames; i++) max = Math.max(max, Math.abs(left[i]), Math.abs(right[i]));
  const gain = max > 0 ? peak / max : 0;

  const fadeIn = Math.min(frames, Math.floor(Math.min(1.6, duration * 0.08) * audio.sampleRate));
  const fadeOut = Math.min(frames, Math.floor(Math.min(2.4, duration * 0.12) * audio.sampleRate));

  for (let i = 0; i < frames; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    const fromEnd = frames - 1 - i;
    if (fromEnd < fadeOut) g *= fromEnd / fadeOut;
    left[i] *= g;
    right[i] *= g;
  }
  return audio;
}

/** Trim or loop decoded PCM to exactly `duration`, with fades. */
export function fitPcm(channels, sampleRate, duration) {
  const frames = Math.ceil(duration * sampleRate);
  const out = channels.map(() => new Float32Array(frames));
  const sourceFrames = channels[0] ? channels[0].length : 0;
  if (!sourceFrames) return { channels: out, sampleRate };
  for (let c = 0; c < channels.length; c++) {
    for (let i = 0; i < frames; i++) out[c][i] = channels[c][i % sourceFrames];
  }
  return normalise({ channels: out, sampleRate }, 0.5, duration);
}

/** Interleave planar channels, which is what AudioSample's 'f32' wants. */
export function interleave(channels, from, frameCount) {
  const ch = channels.length;
  const out = new Float32Array(frameCount * ch);
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < ch; c++) out[i * ch + c] = channels[c][from + i] || 0;
  }
  return out;
}
