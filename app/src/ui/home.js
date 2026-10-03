/**
 * The home page: choose a celebration, choose a design.
 *
 * Gallery previews are drawn by the real engine rather than being saved
 * pictures, so a card can never show something the editor would not produce.
 * They render lazily as they scroll into view, and only then does that
 * design's typeface get downloaded — opening this page on mobile data should
 * not fetch nine font families.
 */
import { TEMPLATES, forCategory, usedCategories, defaultValuesFor } from '../templates/index.js';
import { categoryName } from '../templates/categories.js';
import { drawStill, createPlayer } from './player.js';
import { loadUi, saveUi } from './store.js';
import { SUPPORT_URL } from '../config.js';

const BASE = import.meta.env.BASE_URL;
const ui = loadUi();
const $ = (id) => document.getElementById(id);

if (SUPPORT_URL) {
  const link = $('footer-support');
  if (link) { link.hidden = false; link.href = SUPPORT_URL; }
}

/* ----------------------------------------------------------- categories */

function renderCategories() {
  const host = $('categories');
  host.textContent = '';

  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'cat';
  all.innerHTML = `Everything <span class="cat-count">${TEMPLATES.length}</span>`;
  all.setAttribute('aria-pressed', String(ui.category === 'all'));
  all.addEventListener('click', () => select('all'));
  host.appendChild(all);

  for (const c of usedCategories()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat';
    b.innerHTML = `${c.name} <span class="cat-count">${forCategory(c.id).length}</span>`;
    b.setAttribute('aria-pressed', String(ui.category === c.id));
    b.addEventListener('click', () => select(c.id));
    host.appendChild(b);
  }
}

function select(category) {
  ui.category = category;
  saveUi(ui);
  renderCategories();
  renderDesigns();
}

/* -------------------------------------------------------------- gallery */

let observer = null;

function renderDesigns() {
  const host = $('design-list');
  const empty = $('design-empty');
  if (observer) observer.disconnect();
  host.textContent = '';

  const list = forCategory(ui.category);
  empty.hidden = list.length > 0;

  observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target._paint();
      }
    }, { rootMargin: '300px 0px' })
    : null;

  for (const template of list) {
    host.appendChild(card(template));
  }
}

function card(template) {
  const a = document.createElement('a');
  a.className = 'design';
  a.href = `${BASE}studio.html?t=${encodeURIComponent(template.id)}`;

  const art = document.createElement('div');
  art.className = 'design-art';

  const canvas = document.createElement('canvas');
  canvas.width = 288;
  canvas.height = 512;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${template.name}: ${template.tagline}`);
  art.appendChild(canvas);

  const play = document.createElement('span');
  play.className = 'design-play';
  play.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1.5v9l8-4.5z" fill="#17141D"/></svg>';
  art.appendChild(play);

  const meta = document.createElement('div');
  meta.className = 'design-meta';
  meta.innerHTML = `<span class="design-name"></span><span class="design-tag"></span>`;
  meta.querySelector('.design-name').textContent = template.name;
  meta.querySelector('.design-tag').textContent = template.tagline;

  a.append(art, meta);

  const entered = defaultValuesFor(template);
  a._paint = () => drawStill(canvas, template, entered, { base: BASE }).catch(() => {});
  if (observer) observer.observe(a);
  else a._paint();

  // Hovering plays the design. Only ever one at a time, so a gallery of
  // twenty nine designs is not twenty nine animation loops.
  let player = null;
  const start = () => {
    if (player || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopOthers();
    player = createPlayer(canvas, { template, entered, base: BASE });
    current = player;
    player.ready(BASE).then(() => player && player.play());
  };
  const stop = () => {
    if (!player) return;
    player.destroy();
    player = null;
    if (current === player) current = null;
    a._paint();
  };
  a.addEventListener('mouseenter', start);
  a.addEventListener('mouseleave', stop);
  a.addEventListener('focus', start);
  a.addEventListener('blur', stop);

  return a;
}

let current = null;
function stopOthers() {
  if (current) { current.destroy(); current = null; }
}

/* ----------------------------------------------------------- hero cards */

async function hero() {
  const picks = ['ivory-deco', 'confetti-pop'];
  const canvases = [$('hero-a'), $('hero-b')];

  for (let i = 0; i < picks.length; i++) {
    const template = TEMPLATES.find((t) => t.id === picks[i]) || TEMPLATES[i];
    const canvas = canvases[i];
    if (!template || !canvas) continue;

    const player = createPlayer(canvas, {
      template,
      entered: defaultValuesFor(template),
      base: BASE,
      onEnd: () => setTimeout(() => player.seek(0) || player.play(), 900),
    });
    await player.ready(BASE);
    // Start on the slide with the names, not on frame zero: at t=0 a design is
    // legitimately just its background, and a hero card that opens blank reads
    // as a broken image.
    const opening = player.prepared.scenes.find((s) => s.id === 'names')
      || player.prepared.scenes[0];
    player.seek(opening.start + Math.min(1.6, opening.duration * 0.45));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTimeout(() => player.play(), i * 1400);
    }
  }
}

renderCategories();
renderDesigns();
hero().catch(() => {});
