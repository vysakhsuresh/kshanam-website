/**
 * Where a guest lands from a shared invitation.
 *
 * They have just watched something; the only job of this page is to show the
 * same design playing and get out of the way.
 */
import { byId, TEMPLATES, defaultValuesFor } from '../templates/index.js';
import { createPlayer } from './player.js';
import { SUPPORT_URL } from '../config.js';

const BASE = import.meta.env.BASE_URL;

if (SUPPORT_URL) {
  for (const link of document.querySelectorAll('[data-coffee]')) {
    link.href = SUPPORT_URL;
    link.target = '_blank';
    link.rel = 'noopener';
  }
}
const params = new URLSearchParams(location.search);
const template = byId(params.get('t')) || TEMPLATES[0];

document.getElementById('use').href =
  `${BASE}studio.html?t=${encodeURIComponent(template.id)}`;

const player = createPlayer(document.getElementById('guest-art'), {
  template,
  entered: defaultValuesFor(template),
  base: BASE,
  onEnd: () => setTimeout(() => { player.seek(0); player.play(); }, 1000),
});

player.ready(BASE).then(() => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) player.play();
});
