/**
 * Get help: a button that is always there, and two ways to reach a person.
 *
 * The owner asked for what the Layerbit site does — an email and a WhatsApp
 * chat — because those are the two things somebody with a wedding tonight will
 * actually use. No form, no ticket, no chatbot: this site has no server, so a
 * form would have nowhere to post to, and pretending otherwise would be worse
 * than a mailto.
 *
 * It is deliberately absent from the editor's render screen, the same way ads
 * are: nothing floats over the download and share buttons.
 */
import { HELP, BRAND } from '../config.js';

const SHEET_ID = 'help-sheet';

const ICONS = {
  ask: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"
            stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M9.6 9.1a2.4 2.4 0 1 1 3 2.32V12.6" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="12.6" cy="15" r="0.95" fill="currentColor"/>
    </svg>`,
  email: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" stroke="currentColor" stroke-width="1.7"/>
      <path d="m3.6 6.6 8.4 6.1 8.4-6.1" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    </svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2A9.9 9.9 0 0 0 3.6 17.07L2.05 22l5.07-1.52A9.9 9.9 0 1 0 12.04 2m0 1.84a8.06 8.06 0 1 1-4.1 14.99l-.3-.17-3 .9.92-2.93-.19-.31A8.06 8.06 0 0 1 12.04 3.84m-3.2 4.03c-.15 0-.4.06-.6.3-.21.23-.8.78-.8 1.9 0 1.11.82 2.19.93 2.34.12.15 1.6 2.56 3.95 3.49 1.95.77 2.35.62 2.77.58.42-.04 1.37-.56 1.56-1.1.2-.54.2-1 .14-1.1-.07-.1-.22-.16-.46-.28-.25-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.25-.62.79-.76.95-.14.16-.28.18-.52.06-.25-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.7-.15-.24-.02-.37.1-.49.12-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.54-1.32-.75-1.8-.19-.47-.38-.4-.52-.41z"
            fill="currentColor"/>
    </svg>`,
};

function option(href, label, note, kind, external) {
  const a = document.createElement('a');
  a.className = `help-option help-option-${kind}`;
  a.href = href;
  if (external) { a.target = '_blank'; a.rel = 'noopener'; }
  a.innerHTML = `<span class="help-option-icon">${ICONS[kind]}</span>
    <span class="help-option-text"><strong></strong><span></span></span>`;
  a.querySelector('strong').textContent = label;
  a.querySelector('.help-option-text span').textContent = note;
  return a;
}

function buildSheet() {
  const sheet = document.createElement('div');
  sheet.id = SHEET_ID;
  sheet.className = 'help-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-sheet-title">
      <button type="button" class="help-close" aria-label="Close">&times;</button>
      <h2 id="help-sheet-title"></h2>
      <p class="help-blurb"></p>
      <div class="help-options"></div>
      <p class="help-foot"></p>
    </div>`;

  sheet.querySelector('h2').textContent = 'Need a hand?';
  sheet.querySelector('.help-blurb').textContent =
    `Tell us what went wrong and we will help. Nothing you typed into ${BRAND.name} is sent — only the message you write.`;

  const options = sheet.querySelector('.help-options');
  const subject = encodeURIComponent(`${BRAND.name} — help please`);
  if (HELP.whatsapp) {
    options.appendChild(option(
      `https://wa.me/${HELP.whatsapp}?text=${encodeURIComponent(`Hello, I need help with ${BRAND.name}.`)}`,
      'Chat on WhatsApp', 'The quickest way to reach us', 'whatsapp', true));
  }
  if (HELP.email) {
    options.appendChild(option(
      `mailto:${HELP.email}?subject=${subject}`,
      'Send us an email', HELP.email, 'email', false));
  }
  sheet.querySelector('.help-foot').textContent = HELP.hours || '';
  return sheet;
}

export function mountHelpWidget() {
  if (!HELP || (!HELP.email && !HELP.whatsapp)) return;
  if (document.getElementById(SHEET_ID)) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-fab';
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = `${ICONS.ask}<span>Get help</span>`;

  const sheet = buildSheet();
  document.body.append(button, sheet);

  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('help-open');
    const first = sheet.querySelector('.help-option') || sheet.querySelector('.help-close');
    if (first) first.focus();
  };
  const close = () => {
    sheet.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('help-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  button.addEventListener('click', () => (sheet.hidden ? open() : close()));
  sheet.querySelector('.help-close').addEventListener('click', close);
  // Clicking the backdrop closes; clicking the panel must not.
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });

  // Anything on the page that asks for help opens this rather than navigating,
  // so the footer link and the floating button are the same thing.
  for (const el of document.querySelectorAll('[data-help]')) {
    el.addEventListener('click', (e) => { e.preventDefault(); open(); });
  }

  return { open, close };
}
