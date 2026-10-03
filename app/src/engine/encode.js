/**
 * Frames in, MP4 out.
 *
 * The target is WhatsApp on a low-end Android, which means H.264 video and
 * AAC audio in an MP4 with the moov atom at the front. Everything else here
 * is a fallback for browsers that cannot do that, chosen in order so the file
 * is still an MP4 and still plays somewhere useful.
 *
 * MediaRecorder is deliberately not used: it tends to produce WebM, which
 * WhatsApp handles badly.
 */
import {
  Output, Mp4OutputFormat, BufferTarget,
  CanvasSource, AudioSampleSource, AudioSample,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
  QUALITY_HIGH, QUALITY_MEDIUM,
} from 'mediabunny';

import { prepare, renderFrame, frameCount, OUTPUT } from './render.js';
import { renderTrack, fitPcm, interleave } from './music.js';

/** Most wanted first. 'avc' is H.264, the only one WhatsApp is happy with. */
export const VIDEO_PREFERENCE = ['avc', 'vp9', 'av1', 'vp8'];
export const AUDIO_PREFERENCE = ['aac', 'opus'];

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

/**
 * What can this browser actually encode?
 *
 * Call it before showing the "Make my video" button, so a browser that cannot
 * encode at all is told plainly instead of failing halfway through.
 */
export async function detectCapabilities({ width = OUTPUT.width, height = OUTPUT.height } = {}) {
  const hasWebCodecs = typeof VideoEncoder !== 'undefined';
  if (!hasWebCodecs) {
    return { hasWebCodecs: false, video: null, audio: null, whatsappReady: false };
  }

  const [video, audio] = await Promise.all([
    getFirstEncodableVideoCodec(VIDEO_PREFERENCE, { width, height, quality: QUALITY_HIGH })
      .catch(() => null),
    getFirstEncodableAudioCodec(AUDIO_PREFERENCE, {
      numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE, quality: QUALITY_MEDIUM,
    }).catch(() => null),
  ]);

  return {
    hasWebCodecs: true,
    video,
    audio,
    // The combination WhatsApp plays without re-encoding on every Android.
    whatsappReady: video === 'avc' && (audio === null || audio === 'aac'),
  };
}

class Cancelled extends Error {
  constructor() {
    super('Rendering was cancelled');
    this.name = 'Cancelled';
  }
}

/**
 * Render a template to an MP4.
 *
 * @param {object}   o
 * @param {object}   o.template   the template JSON
 * @param {object}   o.values     { slots, lang, photo }
 * @param {HTMLCanvasElement|OffscreenCanvas} o.canvas  sized to the output
 * @param {number}   [o.fps]
 * @param {string}   [o.music]    a track id from music.js, or 'file'
 * @param {{channels: Float32Array[], sampleRate: number}} [o.pcm]  decoded song
 * @param {(p: {phase: string, progress: number, frame: number, frames: number}) => void} [o.onProgress]
 * @param {{aborted: boolean}} [o.signal]
 * @returns {Promise<{buffer: ArrayBuffer, mimeType: string, codecs: object, duration: number, frames: number, ms: number}>}
 */
export async function renderToMp4(o) {
  const {
    template, values, canvas,
    fps = OUTPUT.fps,
    music = 'music-box',
    pcm = null,
    onProgress = () => {},
    signal = null,
  } = o;

  const started = Date.now();
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser gave us no 2D canvas to draw on.');

  // Only slots with a picture in them count; a design's photo scene is
  // dropped rather than shown empty.
  const photos = Object.entries((values && values.photos) || {})
    .filter(([, p]) => p && p.bitmap)
    .map(([slot]) => slot);
  const prepared = prepare(template, { photos, photoMode: o.photoMode });
  const frames = frameCount(prepared, fps);

  const caps = await detectCapabilities({ width: canvas.width, height: canvas.height });
  if (!caps.video) {
    throw new Error(
      caps.hasWebCodecs
        ? 'This browser cannot encode video. Please try Chrome on Android.'
        : 'This browser is missing the video features we need. Please try Chrome.');
  }

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: caps.video,
    quality: QUALITY_HIGH,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  // Audio is optional in every direction: the visitor may want silence, the
  // browser may have no audio encoder, and neither is a reason to fail.
  const wantsAudio = music !== 'none' && !!caps.audio;
  let audioSource = null;
  let audio = null;

  if (wantsAudio) {
    audio = music === 'file' && pcm
      ? fitPcm(pcm.channels, pcm.sampleRate, prepared.duration)
      : renderTrack(music, prepared.duration, SAMPLE_RATE);
    audioSource = new AudioSampleSource({ codec: caps.audio, quality: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const audioFrames = audio ? audio.channels[0].length : 0;
  const audioRate = audio ? audio.sampleRate : SAMPLE_RATE;
  const audioChunk = Math.floor(audioRate / 2); // half a second at a time
  let audioWritten = 0;

  const pushAudioUpTo = async (seconds) => {
    while (audioSource && audioWritten < audioFrames
           && audioWritten / audioRate < seconds) {
      const n = Math.min(audioChunk, audioFrames - audioWritten);
      const sample = new AudioSample({
        data: interleave(audio.channels, audioWritten, n),
        format: 'f32',
        numberOfChannels: audio.channels.length,
        sampleRate: audioRate,
        timestamp: audioWritten / audioRate,
      });
      await audioSource.add(sample);
      sample.close?.();
      audioWritten += n;
    }
  };

  try {
    for (let i = 0; i < frames; i++) {
      if (signal && signal.aborted) throw new Cancelled();

      const t = i / fps;
      renderFrame(ctx, prepared, values, t);
      await videoSource.add(t, 1 / fps);

      // Keep the audio roughly level with the video so the muxer never has to
      // hold a whole track in memory.
      await pushAudioUpTo(t + 1);

      if (i % 5 === 0 || i === frames - 1) {
        onProgress({ phase: 'render', progress: (i + 1) / frames, frame: i + 1, frames });
      }
    }

    await pushAudioUpTo(Infinity);

    onProgress({ phase: 'finalise', progress: 1, frame: frames, frames });
    await output.finalize();
  } catch (err) {
    try { await output.cancel(); } catch { /* already torn down */ }
    throw err;
  }

  return {
    buffer: output.target.buffer,
    mimeType: 'video/mp4',
    codecs: { video: caps.video, audio: wantsAudio ? caps.audio : null, whatsappReady: caps.whatsappReady },
    duration: prepared.duration,
    frames,
    ms: Date.now() - started,
  };
}

export { Cancelled };
