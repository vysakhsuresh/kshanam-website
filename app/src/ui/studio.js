/**
 * The editor.
 *
 * The thing this screen exists to fix: in the first version you had to export
 * a video to find out what you were getting, then open it beside the form and
 * correct things. Now the finished invitation plays here, every slide is
 * visible with the real words on it, and touching a field jumps to the slide
 * that shows it.
 */
import { byId, TEMPLATES, fieldsFor, defaultValuesFor } from '../templates/index.js';
import { createPlayer } from './player.js';
import { loadEntry, saveEntry, setPhotoFile, getPhotoFile } from './store.js';
import { TRACKS, renderTrack } from '../engine/music.js';
import { renderFrame, prepare, templateFamilies } from '../engine/render.js';
import { ensureFonts } from '../engine/fonts.js';
import { toValues } from '../values.js';

const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------- state */

const params = new URLSearchParams(location.search);
const entry = loadEntry();
const template = byId(params.get('t')) || byId(entry.templateId) || TEMPLATES[0];
entry.templateId = template.id;

const fields = fieldsFor(template);

// Keep anything already typed that this design also asks for, so switching
// design does not mean typing the whole thing again.
const entered = { ...defaultValuesFor(template) };
for (const field of fields) {
  const saved = entry.values && entry.values[field.key];
  if (saved != null && saved !== '') entered[field.key] = saved;
}

/** slot -> { file, bitmap, focal:{x,y}, zoom } */
const photos = {};
let songPcm = null;
let worker = null;
let videoBlob = null;
let videoUrl = null;
let audioCtx = null;

const persist = () => {
  entry.values = entered;
  saveEntry(entry);
};

/* -------------------------------------------------------------- player */

const player = createPlayer($('player'), { template, entered, photos, base: BASE,
  onTime: (t, duration, scene) => {
    $('scrub').value = String(Math.round((t / duration) * 1000));
    $('time').textContent = clock(t);
    markSlide(scene);
  },
  onEnd: () => setPlayIcon(false),
});

function clock(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setPlayIcon(playing) {
  $('play-icon').innerHTML = playing
    ? '<rect x="3" y="2" width="4" height="12" fill="currentColor"/><rect x="9" y="2" width="4" height="12" fill="currentColor"/>'
    : '<path d="M3 1.5v13l11-6.5z" fill="currentColor"/>';
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play the invitation');
}

$('play').addEventListener('click', () => {
  player.toggle();
  setPlayIcon(player.playing);
});

$('scrub').addEventListener('input', () => {
  player.pause();
  setPlayIcon(false);
  player.seek((Number($('scrub').value) / 1000) * player.duration);
});

/* ----------------------------------------------------------- storyboard */

let slideCanvases = [];

function buildSlides() {
  const host = $('slides');
  host.textContent = '';
  slideCanvases = [];

  for (const scene of player.prepared.scenes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slide';
    btn.title = `Jump to this slide`;
    btn.setAttribute('aria-label', `Slide ${slideCanvases.length + 1}`);

    const canvas = document.createElement('canvas');
    canvas.width = 108;
    canvas.height = 192;
    btn.appendChild(canvas);

    btn.addEventListener('click', () => {
      player.pause();
      setPlayIcon(false);
      // A little past the start, so the slide is drawn rather than animating in.
      player.seek(scene.start + Math.min(1.6, scene.duration * 0.45));
    });

    host.appendChild(btn);
    slideCanvases.push({ scene, canvas, btn });
  }
  paintSlides();
}

function paintSlides() {
  const prepared = player.prepared;
  for (const { scene, canvas } of slideCanvases) {
    const ctx = canvas.getContext('2d', { alpha: false });
    renderFrame(ctx, prepared, toValues(entered, photos),
      scene.start + Math.min(1.6, scene.duration * 0.45));
  }
}

function markSlide(scene) {
  for (const s of slideCanvases) {
    s.btn.setAttribute('aria-current', String(!!scene && s.scene.id === scene.id));
  }
}

/* ------------------------------------------------------------- fields */

/** Which group a field belongs in. */
const WHEN_KEYS = new Set(['date', 'time', 'timeLabel', 'venue']);

function buildFields() {
  const words = $('fields-words');
  const when = $('fields-when');
  words.textContent = '';
  when.textContent = '';

  for (const field of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field' + (field.multiline || field.key === 'venue' ? ' wide' : '');

    const id = `f-${field.key}`;
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = field.label;

    const input = field.multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    input.id = id;
    if (!field.multiline) input.type = field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
    if (field.max) input.maxLength = field.max;
    input.value = entered[field.key] != null ? entered[field.key] : '';

    const apply = () => {
      entered[field.key] = input.value;
      persist();
      player.setEntered(entered);
      schedulePaint();
    };
    input.addEventListener('input', apply);

    // Touching a field shows the slide it appears on. This is the whole point
    // of the screen: you never have to guess where a line will land.
    const reveal = () => {
      const scene = player.prepared.scenes.find((s) => s.id === field.scene);
      if (!scene) return;
      player.pause();
      setPlayIcon(false);
      player.seek(scene.start + Math.min(1.6, scene.duration * 0.45));
    };
    input.addEventListener('focus', reveal);

    wrap.append(label, input);
    (WHEN_KEYS.has(field.key) ? when : words).appendChild(wrap);
  }
}

let paintTimer = 0;
function schedulePaint() {
  if (paintTimer) cancelAnimationFrame(paintTimer);
  paintTimer = requestAnimationFrame(() => { paintTimer = 0; paintSlides(); });
}

/* -------------------------------------------------------------- photos */

function buildPhotos() {
  const host = $('photos');
  host.textContent = '';

  for (const slot of template.photoSlots || []) {
    const row = document.createElement('div');
    row.className = 'photo-row';

    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    const img = document.createElement('img');
    img.alt = '';
    img.hidden = true;
    thumb.appendChild(img);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'visually-hidden';
    file.id = `photo-${slot.key}`;

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn btn-ghost';
    pick.textContent = 'Add a photo';
    pick.addEventListener('click', () => {
      if (photos[slot.key]) {
        delete photos[slot.key];
        setPhotoFile(slot.key, null);
        file.value = '';
        img.hidden = true;
        img.removeAttribute('src');
        pick.textContent = 'Add a photo';
        sliders.hidden = true;
        player.setPhotos(photos);
        buildSlides();
      } else {
        file.click();
      }
    });

    // Focal point and zoom: one slot has to work for a portrait, a group and
    // a landscape, and centre-cropping fails all three.
    const sliders = document.createElement('div');
    sliders.className = 'photo-sliders';
    sliders.hidden = true;
    sliders.innerHTML = `
      <label>Across <input type="range" min="0" max="100" value="50" data-axis="x" /></label>
      <label>Up/down <input type="range" min="0" max="100" value="50" data-axis="y" /></label>
      <label>Zoom <input type="range" min="100" max="220" value="100" data-axis="zoom" /></label>`;
    sliders.addEventListener('input', (e) => {
      const axis = e.target.dataset.axis;
      const entryFor = photos[slot.key];
      if (!entryFor || !axis) return;
      if (axis === 'zoom') entryFor.zoom = Number(e.target.value) / 100;
      else entryFor.focal[axis] = Number(e.target.value) / 100;
      player.setPhotos(photos);
      schedulePaint();
    });

    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      try {
        const bitmap = await createImageBitmap(chosen);
        photos[slot.key] = { bitmap, focal: { x: 0.5, y: 0.5 }, zoom: 1 };
        setPhotoFile(slot.key, chosen);
        img.src = URL.createObjectURL(chosen);
        img.hidden = false;
        pick.textContent = 'Remove';
        sliders.hidden = false;
        player.setPhotos(photos);
        buildSlides();
      } catch {
        $('form-error').textContent = 'That picture could not be opened. Try another one.';
      }
    });

    const col = document.createElement('div');
    col.style.flex = '1';
    col.style.minWidth = '180px';
    const hint = document.createElement('p');
    hint.className = 'stage-hint';
    hint.textContent = slot.hint || 'Optional. It stays on your device.';
    col.append(pick, hint);

    row.append(thumb, col, sliders);
    host.append(row, file);
  }
}

/* --------------------------------------------------------------- music */

function buildMusic() {
  const host = $('music');
  host.textContent = '';

  for (const track of TRACKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.innerHTML = `${track.name}${track.mood ? ` <small>${track.mood}</small>` : ''}`;
    b.setAttribute('aria-pressed', String(entry.music === track.id));
    b.addEventListener('click', () => {
      entry.music = track.id;
      songPcm = null;
      saveEntry(entry);
      paintMusic();
      preview(track.id);
    });
    host.appendChild(b);
  }

  const own = document.createElement('button');
  own.type = 'button';
  own.className = 'choice';
  own.innerHTML = 'My own song <small>From this device</small>';
  own.setAttribute('aria-pressed', String(entry.music === 'file'));
  own.addEventListener('click', () => $('song').click());
  host.appendChild(own);
}

function paintMusic() {
  for (const b of $('music').querySelectorAll('.choice')) {
    const name = b.textContent.trim();
    const track = TRACKS.find((t) => name.startsWith(t.name));
    b.setAttribute('aria-pressed', String(track ? entry.music === track.id : entry.music === 'file'));
  }
}

/** Four seconds of the chosen bed, so nobody picks music blind either. */
let previewSource = null;
function preview(id) {
  if (id === 'none') { stopPreview(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    stopPreview();
    const { channels, sampleRate } = renderTrack(id, 4, audioCtx.sampleRate);
    const buffer = audioCtx.createBuffer(2, channels[0].length, sampleRate);
    buffer.copyToChannel(channels[0], 0);
    buffer.copyToChannel(channels[1], 1);
    previewSource = audioCtx.createBufferSource();
    previewSource.buffer = buffer;
    previewSource.connect(audioCtx.destination);
    previewSource.start();
  } catch { /* preview is a nicety, never a failure */ }
}

function stopPreview() {
  if (previewSource) { try { previewSource.stop(); } catch {} previewSource = null; }
}

$('song').addEventListener('change', async () => {
  const chosen = $('song').files && $('song').files[0];
  if (!chosen) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(await chosen.arrayBuffer());
    songPcm = {
      sampleRate: decoded.sampleRate,
      channels: Array.from({ length: Math.min(2, decoded.numberOfChannels) },
        (_, i) => decoded.getChannelData(i).slice()),
    };
    ctx.close();
    entry.music = 'file';
    saveEntry(entry);
    paintMusic();
    $('song-name').textContent = chosen.name;
  } catch {
    songPcm = null;
    $('song-name').textContent = 'That song could not be read. Pick one of ours instead.';
  }
});

/* ---------------------------------------------------------- making it */

function show(view) {
  $('view-edit').hidden = view !== 'edit';
  $('view-progress').hidden = view !== 'progress';
  $('view-ready').hidden = view !== 'ready';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

$('make').addEventListener('click', () => {
  const named = fields.some((f) => f.key.startsWith('name') && String(entered[f.key] || '').trim());
  if (!named) {
    $('form-error').textContent = 'Please fill in at least one name.';
    const first = $('f-name1');
    if (first) first.focus();
    return;
  }
  $('form-error').textContent = '';
  player.pause();
  setPlayIcon(false);
  stopPreview();
  show('progress');
  setProgress(0, 'fonts');

  worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') setProgress(d.progress || 0, d.phase);
    else if (d.type === 'done') { stopWorker(); showReady(d.result); }
    else if (d.type === 'cancelled') { stopWorker(); show('edit'); }
    else if (d.type === 'error') { stopWorker(); show('edit'); $('form-error').textContent = d.message; }
  };
  worker.onerror = () => {
    stopWorker();
    show('edit');
    $('form-error').textContent = 'Something went wrong while making the video.';
  };

  // Photos are copied rather than transferred: the editor still needs them
  // when somebody comes back to change a line.
  const payload = {};
  for (const [slot, p] of Object.entries(photos)) {
    payload[slot] = { bitmap: p.bitmap, focal: p.focal, zoom: p.zoom };
  }

  worker.postMessage({
    type: 'render',
    template,
    values: toValues(entered, payload),
    music: entry.music === 'file' && !songPcm ? 'music-box' : entry.music,
    pcm: songPcm,
    baseUrl: BASE,
  });
});

function setProgress(fraction, phase) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  $('progress-fill').style.width = `${pct}%`;
  $('progress-pct').textContent = phase === 'fonts' ? 'Getting ready…' : `${pct}%`;
}

function stopWorker() {
  if (worker) { worker.terminate(); worker = null; }
}

$('cancel').addEventListener('click', () => {
  if (worker) worker.postMessage({ type: 'cancel' });
  stopWorker();
  show('edit');
});

function showReady(result) {
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoBlob = new Blob([result.buffer], { type: 'video/mp4' });
  videoUrl = URL.createObjectURL(videoBlob);
  $('ready-video').src = videoUrl;
  $('download').href = videoUrl;

  const warn = $('codec-warn');
  warn.hidden = !!result.codecs.whatsappReady;
  if (!result.codecs.whatsappReady) {
    warn.textContent = 'This browser could not use the format WhatsApp likes best. '
      + 'The video still plays, but Chrome gives the most reliable result.';
  }
  show('ready');
}

$('share').addEventListener('click', async () => {
  if (!videoBlob) return;
  const file = new File([videoBlob], 'invitation.mp4', { type: 'video/mp4' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Invitation' });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  $('download').click();
});

$('again').addEventListener('click', () => show('edit'));

/* ----------------------------------------------------------------- go */

buildFields();
buildPhotos();
buildMusic();
setPlayIcon(false);

ensureFonts(templateFamilies(template), BASE)
  .catch(() => {})
  .then(() => {
    buildSlides();
    // Open on the slide with the names on it rather than on frame zero, which
    // is legitimately just the background before anything has animated in and
    // reads as a broken player.
    const opening = player.prepared.scenes.find((s) => s.id === 'names')
      || player.prepared.scenes[0];
    player.seek(opening.start + Math.min(1.6, opening.duration * 0.45));
    // The design's own one-line idea, which is the sentence that justified it
    // existing. Worth more here than a second count on its own.
    $('hint').textContent = [
      `${template.name} — ${player.prepared.scenes.length} slides, ${Math.round(player.duration)} seconds.`,
      template.idea,
    ].filter(Boolean).join(' ');
  });
