/**
 * The details screen: type, watch it change, make the video.
 *
 * One page, three views - form, progress, ready - because a page load between
 * them would mean handing a 3 MB video across a navigation, and because the
 * fewer steps there are, the better this works for someone who is not
 * comfortable with apps.
 */
import { t } from './i18n.js';
import { loadUi, saveUi, loadDetails, saveDetails, setPhoto, getPhoto, DEFAULT_DETAILS } from './store.js';
import { byId, TEMPLATES } from '../templates/index.js';
import { loadFonts } from '../engine/fonts.js';
import { prepare, renderFrame } from '../engine/render.js';
import { toSlots } from '../sample-values.js';
import { SITE_DOMAIN, FEEDBACK_EMAIL } from '../config.js';

const ui = loadUi();
const details = loadDetails();

const params = new URLSearchParams(location.search);
if (params.get('t') && byId(params.get('t'))) details.templateId = params.get('t');
if (params.get('o')) details.occasion = params.get('o');

const template = byId(details.templateId) || TEMPLATES[0];
details.templateId = template.id;

const $ = (id) => document.getElementById(id);
const views = { form: $('view-form'), progress: $('view-progress'), ready: $('view-ready') };

let photoBitmap = null;
let songPcm = null;
let worker = null;
let videoBlob = null;
let videoUrl = null;

/* ---------- language ---------- */

function applyLanguage(lang) {
  document.documentElement.lang = lang === 'ml' ? 'ml' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(lang, el.dataset.i18n);
  }
  for (const b of document.querySelectorAll('.lang-toggle button')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  $('preview-title').textContent = template.name;
  // data-i18n just reset this to "Add a photo"; put the right word back when
  // there is already a picture loaded.
  $('photo-btn').textContent = t(lang, photoBitmap ? 'removePhoto' : 'addPhoto');
  refreshSongLabel();
}

for (const btn of document.querySelectorAll('.lang-toggle button')) {
  btn.addEventListener('click', () => {
    ui.lang = btn.dataset.lang;
    saveUi(ui);
    applyLanguage(ui.lang);
  });
}

/* ---------- form binding ---------- */

const TEXT_FIELDS = ['name1', 'name2', 'dateISO', 'time', 'venue', 'customLine'];

for (const key of TEXT_FIELDS) {
  const el = $(key);
  if (!el) continue;
  el.value = details[key] != null ? details[key] : DEFAULT_DETAILS[key];
  el.addEventListener('input', () => {
    details[key] = el.value;
    saveDetails(details);
    schedulePreview();
  });
}

$('endCard').checked = details.endCard !== false;
$('endCard').addEventListener('change', () => {
  details.endCard = $('endCard').checked;
  saveDetails(details);
  schedulePreview();
});

function bindSegmented(hostId, key, onChange) {
  const host = $(hostId);
  const paint = () => {
    for (const b of host.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.value === details[key]));
    }
  };
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    details[key] = btn.dataset.value;
    saveDetails(details);
    paint();
    if (onChange) onChange(details[key]);
    schedulePreview();
  });
  paint();
}

bindSegmented('invite-lang', 'inviteLang');
bindSegmented('music', 'music', (value) => {
  if (value === 'file') $('song').click();
  else { songPcm = null; refreshSongLabel(); }
});

/* ---------- photo ---------- */

$('photo-btn').addEventListener('click', () => {
  if (photoBitmap) {
    photoBitmap = null;
    setPhoto(null);
    $('photo').value = '';
    $('photo-btn').textContent = t(ui.lang, 'addPhoto');
    schedulePreview();
  } else {
    $('photo').click();
  }
});

$('photo').addEventListener('change', async () => {
  const file = $('photo').files && $('photo').files[0];
  if (!file) return;
  try {
    // createImageBitmap keeps the decode off the main thread and never
    // involves a server; the picture stays in memory on this device.
    photoBitmap = await createImageBitmap(file);
    setPhoto(file);
    $('photo-btn').textContent = t(ui.lang, 'removePhoto');
    schedulePreview();
  } catch {
    $('form-error').textContent = 'That picture could not be opened. Try another one.';
  }
});

/* ---------- the visitor's own song ---------- */

$('song').addEventListener('change', async () => {
  const file = $('song').files && $('song').files[0];
  if (!file) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    songPcm = {
      sampleRate: decoded.sampleRate,
      channels: Array.from({ length: Math.min(2, decoded.numberOfChannels) },
        (_, i) => decoded.getChannelData(i).slice()),
    };
    ctx.close();
    refreshSongLabel(file.name);
  } catch {
    songPcm = null;
    details.music = 'tones';
    saveDetails(details);
    $('song-name').textContent = 'That song could not be read. Soft tones will be used instead.';
  }
});

let songLabel = '';
function refreshSongLabel(name) {
  if (name) songLabel = name;
  $('song-name').textContent = details.music === 'file' && songLabel ? songLabel : '';
}

/* ---------- live preview ---------- */

const preview = $('preview');
const previewCtx = preview.getContext('2d', { alpha: false });
let previewPoint = 0.38;
let previewTimer = null;
let fontsReady = loadFonts(import.meta.env.BASE_URL).catch(() => {});

function values() {
  return {
    slots: { ...toSlots(details, details.inviteLang), domain: SITE_DOMAIN },
    lang: details.inviteLang,
    photo: photoBitmap,
  };
}

function drawPreview() {
  const prepared = prepare(template, {
    endCard: details.endCard !== false,
    hasPhoto: !!photoBitmap,
  });
  renderFrame(previewCtx, prepared, values(), prepared.duration * previewPoint);
}

/** Typing should feel instant, but redrawing on every keystroke is wasteful. */
function schedulePreview() {
  if (previewTimer) cancelAnimationFrame(previewTimer);
  previewTimer = requestAnimationFrame(() => {
    previewTimer = null;
    fontsReady.then(drawPreview);
  });
}

$('scrub').addEventListener('input', () => {
  previewPoint = Number($('scrub').value) / 100;
  schedulePreview();
});

/* ---------- making the video ---------- */

function show(view) {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
  $('preview-wrap').hidden = view !== 'form';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function validate() {
  if (!$('name1').value.trim() && !$('name2').value.trim()) {
    return ui.lang === 'ml'
      ? 'ഒരു പേരെങ്കിലും ടൈപ്പ് ചെയ്യുക.'
      : 'Please type at least one name.';
  }
  return '';
}

$('make').addEventListener('click', async () => {
  const problem = validate();
  $('form-error').textContent = problem;
  if (problem) { $('name1').focus(); return; }

  show('progress');
  setProgress(0, 'fonts');

  worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = async (e) => {
    const d = e.data;
    if (d.type === 'progress') {
      setProgress(d.progress || 0, d.phase);
    } else if (d.type === 'done') {
      cleanupWorker();
      showReady(d.result);
    } else if (d.type === 'cancelled') {
      cleanupWorker();
      show('form');
    } else if (d.type === 'error') {
      cleanupWorker();
      show('form');
      $('form-error').textContent = d.message;
    }
  };
  worker.onerror = () => {
    cleanupWorker();
    show('form');
    $('form-error').textContent = 'Something went wrong while making the video.';
  };

  // The photo is transferred rather than copied, so a large picture does not
  // double in memory on a phone that has little to spare.
  const v = values();
  const transfer = [];
  if (v.photo) transfer.push(v.photo);

  worker.postMessage({
    type: 'render',
    template,
    values: v,
    endCard: details.endCard !== false,
    music: details.music === 'file' && !songPcm ? 'tones' : details.music,
    pcm: songPcm,
    baseUrl: import.meta.env.BASE_URL,
  }, transfer);

  // The bitmap is gone from this thread once transferred; redraw the preview
  // from a fresh copy if the visitor comes back to the form.
  if (v.photo) {
    photoBitmap = null;
    const file = getPhoto();
    if (file) createImageBitmap(file).then((b) => { photoBitmap = b; }).catch(() => {});
  }
});

function setProgress(fraction, phase) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  $('progress-fill').style.width = `${pct}%`;
  $('progress-pct').textContent = phase === 'fonts' ? '…' : `${pct}%`;
}

function cleanupWorker() {
  if (worker) { worker.terminate(); worker = null; }
}

$('cancel').addEventListener('click', () => {
  if (worker) worker.postMessage({ type: 'cancel' });
  cleanupWorker();
  show('form');
});

/* ---------- ready ---------- */

function showReady(result) {
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoBlob = new Blob([result.buffer], { type: 'video/mp4' });
  videoUrl = URL.createObjectURL(videoBlob);

  $('ready-video').src = videoUrl;
  $('download').href = videoUrl;

  const warn = $('codec-warn');
  if (!result.codecs.whatsappReady) {
    warn.hidden = false;
    warn.textContent = ui.lang === 'ml'
      ? 'ഈ ബ്രൗസറിൽ വാട്ട്‌സ്ആപ്പിന് ഏറ്റവും അനുയോജ്യമായ ഫോർമാറ്റ് ലഭ്യമല്ല. Chrome ഉപയോഗിച്ചാൽ കൂടുതൽ നന്നായി പ്രവർത്തിക്കും.'
      : 'This browser could not use the format WhatsApp likes best. The video will still play, but Chrome on Android gives the most reliable result.';
  } else {
    warn.hidden = true;
  }

  history.pushState({ view: 'ready' }, '', '#ready');
  show('ready');
}

$('share').addEventListener('click', async () => {
  if (!videoBlob) return;
  const file = new File([videoBlob], 'kshanam-invite.mp4', { type: 'video/mp4' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Invitation',
        text: `${$('name1').value} & ${$('name2').value}`.trim(),
      });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // they changed their mind
    }
  }
  // No file sharing on this browser: a download is the next best thing, and
  // the file can then be attached in WhatsApp by hand.
  $('download').click();
});

$('fb-good').addEventListener('click', async () => {
  const text = ui.lang === 'ml' ? t('ml', 'shareSite') : t('en', 'shareSite');
  const url = location.origin + import.meta.env.BASE_URL;
  if (navigator.share) {
    try { await navigator.share({ title: 'Kshanam', text, url }); return; } catch { /* dismissed */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    $('fb-reply').textContent = ui.lang === 'ml'
      ? 'ലിങ്ക് പകർത്തി. നന്ദി!'
      : 'Link copied. Thank you!';
  } catch {
    $('fb-reply').textContent = url;
  }
});

$('fb-bad').addEventListener('click', () => {
  if (FEEDBACK_EMAIL) {
    const body = encodeURIComponent(
      `Design: ${template.id}\nInvite language: ${details.inviteLang}\n\nWhat went wrong:\n`);
    location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Kshanam feedback')}&body=${body}`;
    return;
  }
  $('fb-reply').textContent = ui.lang === 'ml'
    ? 'ക്ഷമിക്കണം - ഫീഡ്ബാക്ക് സംവിധാനം ഇതുവരെ ഒരുക്കിയിട്ടില്ല.'
    : 'Sorry — feedback is not switched on yet.';
});

$('again').addEventListener('click', () => {
  history.pushState({ view: 'form' }, '', location.pathname + location.search);
  show('form');
  schedulePreview();
});

window.addEventListener('popstate', () => {
  show(location.hash === '#ready' && videoBlob ? 'ready' : 'form');
});

/* ---------- go ---------- */

applyLanguage(ui.lang);
// A reload always lands on the form: the video lives in memory only, so
// #ready would otherwise show an empty player.
if (location.hash) history.replaceState({ view: 'form' }, '', location.pathname + location.search);
show('form');
fontsReady.then(drawPreview);
