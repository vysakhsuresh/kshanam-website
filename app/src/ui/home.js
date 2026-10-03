/**
 * The home page: choose a function, choose a design.
 *
 * The design thumbnails are drawn by the real renderer rather than being
 * saved pictures, so a template can never show a preview that differs from
 * what it actually produces.
 */
import { t, OCCASIONS, occasionName } from './i18n.js';
import { loadUi, saveUi, loadDetails, saveDetails } from './store.js';
import { TEMPLATES, PLANNED, forOccasion, plannedForOccasion } from '../templates/index.js';
import { loadFonts } from '../engine/fonts.js';
import { prepare, renderFrame } from '../engine/render.js';
import { sampleValues } from '../sample-values.js';

const ui = loadUi();

/** Swap every translated string on the page. */
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
  renderOccasions();
  renderDesigns();
}

function renderOccasions() {
  const host = document.getElementById('occasions');
  if (!host) return;
  host.textContent = '';
  for (const o of OCCASIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = occasionName(o.id, ui.lang);
    btn.setAttribute('aria-pressed', String(o.id === ui.occasion));
    btn.addEventListener('click', () => {
      ui.occasion = o.id;
      saveUi(ui);
      renderOccasions();
      renderDesigns();
    });
    host.appendChild(btn);
  }
}

/** One thumbnail, drawn from the template itself. */
function thumbnail(template) {
  const canvas = document.createElement('canvas');
  canvas.width = 270;
  canvas.height = 480;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${template.name} design preview`);

  fontsReady.then(() => {
    const ctx = canvas.getContext('2d', { alpha: false });
    const prepared = prepare(template, { endCard: false });
    // The names scene, a second in, is the frame that says most about a design.
    const names = prepared.scenes.find((s) => s.id === 'names') || prepared.scenes[0];
    renderFrame(ctx, prepared, sampleValues(template.defaultLanguage || 'both'),
      names.start + Math.min(2.2, names.duration - 0.2));
  });

  return canvas;
}

function renderDesigns() {
  const host = document.getElementById('design-list');
  const heading = document.getElementById('designs-heading');
  if (!host) return;

  heading.textContent = `${occasionName(ui.occasion, ui.lang)} ${t(ui.lang, 'designsFor')}`;
  host.textContent = '';

  for (const template of forOccasion(ui.occasion)) {
    const a = document.createElement('a');
    a.className = 'design';
    a.href = `/details.html?t=${encodeURIComponent(template.id)}&o=${encodeURIComponent(ui.occasion)}`;
    a.addEventListener('click', () => {
      const details = loadDetails();
      details.templateId = template.id;
      details.occasion = ui.occasion;
      saveDetails(details);
    });

    const art = document.createElement('div');
    art.className = 'design-art';
    art.appendChild(thumbnail(template));

    const name = document.createElement('span');
    name.className = 'design-name';
    name.textContent = template.name;

    const tag = document.createElement('span');
    tag.className = 'design-tag';
    tag.textContent = template.tagline ? (template.tagline[ui.lang] || template.tagline.en) : '';

    a.append(art, name, tag);
    host.appendChild(a);
  }

  // Designs from the mockups that are not built yet are shown, but plainly
  // marked, so the gallery is honest about what you can actually make today.
  for (const planned of plannedForOccasion(ui.occasion)) {
    const card = document.createElement('div');
    card.className = 'design is-planned';

    const art = document.createElement('div');
    art.className = 'design-art';
    art.style.background = planned.swatch.bg;
    art.style.color = planned.swatch.ink;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = t(ui.lang, 'comingSoon');

    const label = document.createElement('span');
    label.className = 'planned-art-name';
    label.style.color = planned.swatch.ink;
    label.textContent = planned.name;

    art.append(badge, label);

    const name = document.createElement('span');
    name.className = 'design-name';
    name.textContent = planned.name;

    const tag = document.createElement('span');
    tag.className = 'design-tag';
    tag.textContent = planned.tagline[ui.lang] || planned.tagline.en;

    card.append(art, name, tag);
    host.appendChild(card);
  }

  if (!TEMPLATES.length) {
    host.textContent = 'No designs yet.';
  }
}

const fontsReady = loadFonts(import.meta.env.BASE_URL).catch(() => {});

for (const btn of document.querySelectorAll('.lang-toggle button')) {
  btn.addEventListener('click', () => {
    ui.lang = btn.dataset.lang;
    saveUi(ui);
    applyLanguage(ui.lang);
  });
}

applyLanguage(ui.lang);
