/**
 * Where a guest lands from an invite's end card.
 *
 * They arrive having just watched a video, so the one job of this page is to
 * show the same design and get out of the way.
 */
import { t } from './i18n.js';
import { loadUi, saveUi, loadDetails, saveDetails } from './store.js';
import { byId, TEMPLATES } from '../templates/index.js';
import { loadFonts } from '../engine/fonts.js';
import { prepare, renderFrame } from '../engine/render.js';
import { sampleValues } from '../sample-values.js';

const ui = loadUi();
const params = new URLSearchParams(location.search);
const template = byId(params.get('t')) || TEMPLATES[0];

function applyLanguage(lang) {
  document.documentElement.lang = lang === 'ml' ? 'ml' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(lang, el.dataset.i18n);
  }
  const brand = document.querySelector('[data-brand]');
  if (brand) {
    brand.textContent = t(lang, 'brand');
    brand.classList.toggle('is-ml', lang === 'ml');
  }
  for (const b of document.querySelectorAll('.lang-toggle button')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  document.getElementById('guest-tag').textContent =
    template.tagline ? (template.tagline[lang] || template.tagline.en) : '';
}

for (const btn of document.querySelectorAll('.lang-toggle button')) {
  btn.addEventListener('click', () => {
    ui.lang = btn.dataset.lang;
    saveUi(ui);
    applyLanguage(ui.lang);
  });
}

document.getElementById('guest-name').textContent = template.name;
document.getElementById('use').href = `/details.html?t=${encodeURIComponent(template.id)}`;
document.getElementById('use').addEventListener('click', () => {
  const details = loadDetails();
  details.templateId = template.id;
  saveDetails(details);
});

const canvas = document.createElement('canvas');
canvas.width = 270;
canvas.height = 480;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', `${template.name} design preview`);
document.getElementById('guest-art').appendChild(canvas);

loadFonts(import.meta.env.BASE_URL).catch(() => {}).then(() => {
  const prepared = prepare(template, { endCard: false });
  const names = prepared.scenes.find((s) => s.id === 'names') || prepared.scenes[0];
  renderFrame(canvas.getContext('2d', { alpha: false }), prepared,
    sampleValues(template.defaultLanguage || 'both'),
    names.start + Math.min(2.2, names.duration - 0.2));
});

applyLanguage(ui.lang);
