/**
 * Builds the design library.
 *
 * A design is data, but writing thirty designs by hand means thirty chances
 * to mis-type a coordinate and thirty subtly different ideas of where a date
 * belongs. So each design is a compact spec - palette, typefaces, ornaments,
 * one of six layout recipes - and this expands it into the JSON the engine
 * reads. The output is committed, plain, and hand-editable afterwards: the
 * generator is a starting point, not a dependency.
 *
 *   node scripts/gen-templates.mjs
 */
import { readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app/src/templates');

const W = 360;
const MID = W / 2;

/* ------------------------------------------------------------- helpers */

const text = (o) => ({ type: 'text', align: 'center', x: MID, ...o });
const motif = (name, y, size, o = {}) => ({ type: 'motif', name, x: MID, y, size, stroke: '@accent', width: 1.5, ...o });
const rule = (y, half, o = {}) => ({ type: 'line', x1: MID - half, y1: y, x2: MID + half, y2: y, stroke: '@accent', width: 1, anchorX: MID, anchorY: y, ...o });

const fadeUp = (at, dur = 0.85) => ({ in: { preset: 'fade-up', at, dur } });
const fadeIn = (at, dur = 0.8) => ({ in: { preset: 'fade', at, dur } });
const scaleIn = (at, dur = 0.85) => ({ in: { preset: 'scale-in', at, dur } });

/** The eyebrow line: small, spaced, upper case. Every recipe uses it. */
const eyebrow = (y, o = {}) => text({
  text: '{{eyebrow}}', font: 'body', size: 13, letterSpacing: 2.6, uppercase: true,
  color: '@accentDark', y, maxWidth: 290, ...o,
});

/** Names differ by fieldset: two people, or one subject plus a subtitle. */
function nameLayers(spec, { big, y, gap, align = 'center', x = MID }) {
  const common = { align, x, maxWidth: align === 'left' ? 280 : 292 };
  // A script face has a far smaller x-height than a serif, so the same number
  // reads as half the size. Designs that use one say so and get scaled up.
  big = Math.round(big * (spec.displayScale || 1));
  if (spec.fieldset === 'couple') {
    return [
      text({ ...common, text: '{{name1}}', font: 'display', size: big, color: '@ink', minSize: 26, y, anim: fadeUp(0.15) }),
      text({ ...common, text: '{{joiner}}', font: 'display', size: Math.round(big * 0.46), color: '@accentDark', y: y + gap, maxWidth: 120, anim: scaleIn(0.5, 0.7) }),
      text({ ...common, text: '{{name2}}', font: 'display', size: big, color: '@ink', minSize: 26, y: y + gap * 2, anim: fadeUp(0.8) }),
    ];
  }
  return [
    text({ ...common, text: '{{name1}}', font: 'display', size: big, color: '@ink', minSize: 26, y: y + gap * 0.5, anim: fadeUp(0.15) }),
    text({ ...common, text: '{{subtitle}}', font: 'body', size: 18, letterSpacing: 1.6, uppercase: true, color: '@accentDark', y: y + gap * 1.5, maxWidth: 290, anim: fadeUp(0.7) }),
  ];
}

const photoScene = (layer) => ({
  id: 'photo', duration: 4, requires: 'main',
  layers: [{ type: 'photo', slot: 'main', motion: { preset: 'zoom-in', amount: 0.07 }, anim: scaleIn(0.1, 0.9), ...layer }],
});

/* ------------------------------------------------------------- recipes */

const RECIPES = {
  /** Centred column inside a frame. The default formal invitation. */
  classic(spec) {
    return {
      background: [
        { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
        ...(spec.pattern ? [{ type: 'pattern', x: 0, y: 0, w: 360, h: 640, ...spec.pattern }] : []),
        { type: 'frame', name: spec.frame || 'double', inset: 22, stroke: '@accent', width: 1, anim: fadeIn(0.4, 1) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 250, 68, { anim: scaleIn(0.45, 0.9) }),
          eyebrow(342, { anim: fadeUp(1.05) }),
          motif(spec.divider || 'flourish', 392, 12, { width: 1.1, anim: fadeIn(1.5) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 19, color: '@muted', y: 320, maxWidth: 266, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 54, y: 282, gap: 46 }),
          rule(418, 30, { anim: { in: { preset: 'grow-width', at: 1.4, dur: 0.8 } } }),
        ] },
        photoScene({ x: 92, y: 192, w: 176, h: 236, radius: 3, stroke: '@accent', width: 1, anchorX: 180, anchorY: 310 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'body', weight: 600, size: 26, color: '@ink', y: 306, maxWidth: 292, maxLines: 2, lineHeight: 1.25, minSize: 16, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 19, color: '@muted', y: 360, maxWidth: 292, maxLines: 2, anim: fadeUp(0.75) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', weight: 500, size: 23, color: '@ink', y: 320, maxWidth: 286, maxLines: 3, lineHeight: 1.35, minSize: 15, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 25, color: '@accentDark', y: 300, maxWidth: 282, maxLines: 3, lineHeight: 1.35, minSize: 16, anim: fadeUp(0.2) }),
          motif(spec.closeMotif || spec.motif, 404, 46, { width: 1.3, anim: fadeIn(0.9) }),
        ] },
      ],
    };
  },

  /** An arch over the content: churches, mandapams, doorways. */
  arch(spec) {
    return {
      background: [
        { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
        { type: 'frame', name: 'arch', x: 54, y: 86, w: 252, h: 470, stroke: '@accent', width: 1.4, anim: fadeIn(0.3, 1.1) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 238, 66, { anim: scaleIn(0.5, 0.9) }),
          eyebrow(332, { anim: fadeUp(1.05) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@muted', y: 318, maxWidth: 212, maxLines: 5, lineHeight: 1.5, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 46, y: 276, gap: 44 }),
          motif(spec.divider || 'flourish', 416, 11, { width: 1, anim: fadeIn(1.3) }),
        ] },
        photoScene({ x: 94, y: 196, w: 172, h: 230, shape: 'arch', stroke: '@accent', width: 1.2, anchorX: 180, anchorY: 311 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 27, color: '@ink', y: 300, maxWidth: 230, maxLines: 2, lineHeight: 1.25, minSize: 16, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 18, color: '@muted', y: 356, maxWidth: 230, maxLines: 2, anim: fadeUp(0.75) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 21, color: '@ink', y: 320, maxWidth: 222, maxLines: 4, lineHeight: 1.4, minSize: 14, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 24, color: '@accentDark', y: 300, maxWidth: 222, maxLines: 3, lineHeight: 1.35, minSize: 15, anim: fadeUp(0.2) }),
          motif(spec.closeMotif || spec.motif, 400, 42, { width: 1.3, anim: fadeIn(0.9) }),
        ] },
      ],
    };
  },

  /** Woven bands top and bottom, after a Kerala kasavu border. */
  banner(spec) {
    const band = spec.band || '@accent';
    return {
      background: [
        { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
        { type: 'rect', x: 0, y: 0, w: 360, h: 22, fill: band, anchorY: 0, anim: { in: { preset: 'grow-height', dur: 0.7 } } },
        { type: 'rect', x: 0, y: 22, w: 360, h: 4, fill: '@ink', anchorY: 0, anim: { in: { preset: 'grow-height', at: 0.1, dur: 0.7 } } },
        { type: 'rect', x: 0, y: 618, w: 360, h: 22, fill: band, anchorY: 640, anim: { in: { preset: 'grow-height', dur: 0.7 } } },
        { type: 'rect', x: 0, y: 614, w: 360, h: 4, fill: '@ink', anchorY: 640, anim: { in: { preset: 'grow-height', at: 0.1, dur: 0.7 } } },
        { type: 'frame', name: 'thin', x: 18, y: 40, w: 324, h: 560, stroke: '@accent', width: 1, anim: fadeIn(0.5, 1) },
      ],
      scenes: RECIPES.classic(spec).scenes,
    };
  },

  /** Left-aligned, large sans, almost no decoration. */
  modern(spec) {
    const L = 40;
    const bar = (y, o = {}) => ({ type: 'rect', x: L, y, w: 54, h: 3, fill: '@accent', anchorX: L, anchorY: y, anim: { in: { preset: 'grow-width', at: 0.2, dur: 0.7 } }, ...o });
    return {
      background: [
        { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
        ...(spec.pattern ? [{ type: 'pattern', x: 0, y: 0, w: 360, h: 640, ...spec.pattern }] : []),
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 230, 60, { x: L + 28, anim: scaleIn(0.4, 0.9) }),
          eyebrow(322, { align: 'left', x: L, maxWidth: 280, anim: fadeUp(1) }),
          bar(348),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ align: 'left', x: L, text: '{{intro}}', font: 'body', size: 20, color: '@muted', y: 320, maxWidth: 280, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 52, y: 272, gap: 50, align: 'left', x: L }),
          bar(432, { anim: { in: { preset: 'grow-width', at: 1.3, dur: 0.8 } } }),
        ] },
        photoScene({ x: 40, y: 180, w: 280, h: 260, radius: 2, anchorX: 180, anchorY: 310 }),
        { id: 'when', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{dateLong}}', font: 'display', weight: 600, size: 34, color: '@ink', y: 300, maxWidth: 280, maxLines: 2, lineHeight: 1.15, minSize: 18, anim: fadeUp(0.25) }),
          text({ align: 'left', x: L, text: '{{timeLabel}} {{timeText}}', font: 'body', size: 19, color: '@muted', y: 362, maxWidth: 280, anim: fadeUp(0.7) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{venue}}', font: 'body', weight: 500, size: 23, color: '@ink', y: 318, maxWidth: 280, maxLines: 3, lineHeight: 1.4, minSize: 15, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{closing}}', font: 'display', size: 26, color: '@accent', y: 300, maxWidth: 280, maxLines: 3, lineHeight: 1.3, minSize: 16, anim: fadeUp(0.2) }),
          bar(368),
        ] },
      ],
    };
  },

  /** Colour, pattern and movement. Birthdays and festivals. */
  festive(spec) {
    return {
      background: [
        { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
        ...(spec.pattern ? [{ type: 'pattern', x: 0, y: 0, w: 360, h: 640, ...spec.pattern, anim: fadeIn(0.2, 1.2) }] : []),
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 248, 86, { anim: scaleIn(0.35, 0.95), motion: { preset: 'float', amount: 5 } }),
          eyebrow(356, { size: 14, anim: fadeUp(1) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 20, color: '@muted', y: 320, maxWidth: 274, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 58, y: 280, gap: 48 }),
          motif(spec.divider || 'sparkle', 424, 18, { anim: scaleIn(1.3, 0.7) }),
        ] },
        photoScene({ x: 70, y: 180, w: 220, h: 260, shape: 'circle', stroke: '@accent', width: 2, anchorX: 180, anchorY: 310 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', weight: 600, size: 30, color: '@ink', y: 302, maxWidth: 290, maxLines: 2, lineHeight: 1.2, minSize: 17, anim: scaleIn(0.25, 0.8) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 20, color: '@muted', y: 360, maxWidth: 290, anim: fadeUp(0.7) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', weight: 500, size: 23, color: '@ink', y: 320, maxWidth: 284, maxLines: 3, lineHeight: 1.4, minSize: 15, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 27, color: '@accent', y: 300, maxWidth: 284, maxLines: 3, lineHeight: 1.3, minSize: 16, anim: fadeUp(0.2) }),
          motif(spec.closeMotif || spec.motif, 400, 50, { anim: fadeIn(0.9), motion: { preset: 'float', amount: 4 } }),
        ] },
      ],
    };
  },

  /** The photograph is the design. Falls back gracefully with no picture. */
  photoLed(spec) {
    const photo = (o = {}) => ({
      type: 'photo', slot: 'main', x: 0, y: 0, w: 360, h: 640,
      scrim: spec.scrim || 'rgba(0,0,0,0.62)', placeholderFill: '@bg',
      motion: { preset: 'zoom-in', amount: 0.06 }, anim: fadeIn(0, 1), ...o,
    });
    const base = () => [
      { type: 'rect', x: 0, y: 0, w: 360, h: 640, fill: spec.bgFill || '@bg' },
      photo(),
      // Keeps text readable whether or not a picture was added.
      { type: 'rect', x: 0, y: 260, w: 360, h: 380, fill: {
        type: 'linear', from: [0, 260], to: [0, 640],
        stops: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.72)']] } },
    ];
    return {
      background: base(),
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 404, 54, { anim: scaleIn(0.5, 0.9) }),
          eyebrow(474, { color: '@accent', anim: fadeUp(1) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 19, color: '@muted', y: 440, maxWidth: 274, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 52, y: 368, gap: 48 }),
        ] },
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 30, color: '@ink', y: 418, maxWidth: 290, maxLines: 2, lineHeight: 1.2, minSize: 17, anim: fadeUp(0.25) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 19, color: '@muted', y: 468, maxWidth: 290, anim: fadeUp(0.7) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 22, color: '@ink', y: 440, maxWidth: 284, maxLines: 3, lineHeight: 1.4, minSize: 15, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 26, color: '@accent', y: 430, maxWidth: 284, maxLines: 3, lineHeight: 1.3, minSize: 16, anim: fadeUp(0.2) }),
        ] },
      ],
    };
  },
};

/* --------------------------------------------------------------- defaults */

const BASE_DEFAULTS = {
  couple: {
    eyebrow: 'Wedding Invitation',
    intro: 'Together with our families, we invite you to the wedding of',
    name1: 'Anjali', joiner: '&', name2: 'Rahul',
    date: '2027-02-14', time: '10:30', timeLabel: 'at',
    venue: 'Kalyana Mandapam, Thrissur',
    closing: 'Your presence is our blessing',
  },
  person: {
    eyebrow: "You're Invited",
    intro: 'Please join us as we celebrate',
    name1: 'Meera', subtitle: 'turns thirty',
    date: '2027-03-20', time: '19:00', timeLabel: 'from',
    venue: 'The Garden Room, Kochi',
    closing: 'Come as you are',
  },
  event: {
    eyebrow: "You're Invited",
    intro: 'We would be glad to have you with us for',
    name1: 'Our Housewarming', subtitle: 'and a meal together',
    date: '2027-04-11', time: '11:00', timeLabel: 'from',
    venue: '14 Mangalath Lane, Thrissur',
    closing: 'Do come, and bring the children',
  },
};

/* ------------------------------------------------------------------ specs */

const SPECS = [
  // ---------------------------------------------------------- weddings
  { id: 'kasavu-gold', name: 'Kasavu Gold', recipe: 'banner', fieldset: 'couple',
    categories: ['wedding', 'engagement', 'save-the-date'],
    tagline: 'Kerala kasavu, gold and deep red',
    palette: { bg: '#FFFDF7', ink: '#7A1F2B', muted: '#5E4C51', accent: '#C9971C', accentDark: '#8A5A00' },
    fonts: { display: 'Marcellus', body: 'Space Grotesk' },
    motif: 'lamp', closeMotif: 'diya', divider: 'flourish',
    defaults: { timeLabel: 'Muhurtham' } },

  { id: 'nilavilakku', name: 'Nilavilakku', recipe: 'classic', fieldset: 'couple',
    categories: ['wedding', 'engagement'],
    tagline: 'Deep maroon and a golden lamp',
    palette: { bg: '#5E1120', ink: '#FFF6E8', muted: '#E7C6A6', accent: '#F2C14E', accentDark: '#F2C14E' },
    fonts: { display: 'Cinzel', body: 'Outfit' },
    frame: 'double', motif: 'lamp', closeMotif: 'mandala',
    defaults: { timeLabel: 'Muhurtham' } },

  { id: 'lily-and-bells', name: 'Lily and Bells', recipe: 'arch', fieldset: 'couple',
    categories: ['wedding', 'engagement'],
    tagline: 'A quiet blue arch for a church wedding',
    palette: { bg: '#EEF2F6', ink: '#23395B', muted: '#4C6382', accent: '#3D5A80', accentDark: '#2F4A6B' },
    fonts: { display: 'Cormorant Garamond', body: 'Outfit' },
    motif: 'bell', closeMotif: 'dove',
    defaults: { eyebrow: 'Holy Matrimony', name1: 'Ann', name2: 'Thomas', closing: 'Together in His grace' } },

  { id: 'crescent-gold', name: 'Crescent Gold', recipe: 'classic', fieldset: 'couple',
    categories: ['wedding', 'engagement'],
    tagline: 'Deep green and gold for a Nikah',
    palette: { bg: '#0F4D3A', ink: '#FFFFFF', muted: '#CFE6DA', accent: '#E3B341', accentDark: '#E3B341' },
    fonts: { display: 'Cinzel', body: 'Outfit' },
    frame: 'deco', motif: 'crescent', closeMotif: 'mandala',
    defaults: { eyebrow: 'Nikah', name1: 'Ayesha', name2: 'Imran', closing: 'Barakallahu lakuma' } },

  { id: 'ivory-deco', name: 'Ivory Deco', recipe: 'classic', fieldset: 'couple',
    categories: ['wedding', 'reception', 'engagement'],
    tagline: 'Art deco lines on warm ivory',
    palette: { bg: '#F6F2EA', ink: '#1C1A17', muted: '#6B6358', accent: '#B08D3F', accentDark: '#8A6C27' },
    fonts: { display: 'Italiana', body: 'Space Grotesk' },
    frame: 'deco', motif: 'diamond', closeMotif: 'flourish' },

  { id: 'rose-script', name: 'Rose Script', recipe: 'classic', fieldset: 'couple',
    categories: ['wedding', 'engagement', 'anniversary'],
    tagline: 'Blush and a flowing script',
    palette: { bg: '#FBEFEF', ink: '#7D2E46', muted: '#8A6672', accent: '#C98B96', accentDark: '#A4606E' },
    fonts: { display: 'Great Vibes', body: 'Outfit' },
    displayScale: 1.45,
    frame: 'rules', motif: 'heart', closeMotif: 'flourish-leaf' },

  { id: 'midnight-botanical', name: 'Midnight Botanical', recipe: 'classic', fieldset: 'couple',
    categories: ['wedding', 'reception'],
    tagline: 'Dark green with pressed leaves',
    palette: { bg: '#11231C', ink: '#F2EFE6', muted: '#BCCBC0', accent: '#C3A86B', accentDark: '#C3A86B' },
    fonts: { display: 'Playfair Display', body: 'Outfit' },
    frame: 'corners', motif: 'sprig', closeMotif: 'laurel' },

  { id: 'wedding-film', name: 'Wedding Film', recipe: 'photoLed', fieldset: 'couple',
    categories: ['wedding', 'save-the-date', 'engagement'],
    tagline: 'Your photograph, full bleed',
    palette: { bg: '#1A1A1D', ink: '#FFFFFF', muted: '#D6D2CC', accent: '#E6C98A', accentDark: '#8A7347' },
    fonts: { display: 'Playfair Display', body: 'Outfit' },
    motif: 'rings' },

  // ------------------------------------------------------- save the date
  { id: 'save-the-date-bold', name: 'Bold Date', recipe: 'modern', fieldset: 'couple',
    categories: ['save-the-date', 'wedding', 'corporate'],
    tagline: 'Big type, black and amber',
    palette: { bg: '#101014', ink: '#FFFFFF', muted: '#A7A4AD', accent: '#E8B14C', accentDark: '#E8B14C' },
    fonts: { display: 'Outfit', body: 'Space Grotesk' },
    motif: 'diamond',
    defaults: { eyebrow: 'Save the Date', intro: 'We are getting married, and we would love you there.', closing: 'Invitation to follow' } },

  // ------------------------------------------------------------ reception
  { id: 'reception-noir', name: 'Reception Noir', recipe: 'classic', fieldset: 'couple',
    categories: ['reception', 'corporate', 'anniversary'],
    tagline: 'Black and gold, after dark',
    palette: { bg: '#0C0C0E', ink: '#F5EFE2', muted: '#B9B2A4', accent: '#CBA14A', accentDark: '#CBA14A' },
    fonts: { display: 'Italiana', body: 'Outfit' },
    frame: 'deco', motif: 'sparkle', closeMotif: 'starburst',
    defaults: { eyebrow: 'Reception', intro: 'Join us for an evening of dinner and dancing', timeLabel: 'from', closing: 'Dress for a party' } },

  // ------------------------------------------------------------ birthdays
  { id: 'confetti-pop', name: 'Confetti Pop', recipe: 'festive', fieldset: 'person',
    categories: ['birthday', 'first-birthday', 'graduation'],
    tagline: 'White, bright, full of confetti',
    palette: { bg: '#FFFFFF', ink: '#1B1B22', muted: '#5C5A66', accent: '#FF4D6D', accentDark: '#C9284A' },
    fonts: { display: 'Outfit', body: 'Space Grotesk' },
    motif: 'cake', closeMotif: 'sparkle',
    pattern: { name: 'confetti', count: 54, seed: 11, colours: ['@accent', '#FFC24B', '#4FB3A6', '#7C6CF5'], alpha: 0.95 },
    defaults: { eyebrow: 'Birthday Party', intro: 'Please join us to celebrate', closing: 'Cake at eight' } },

  { id: 'golden-year', name: 'Golden Year', recipe: 'festive', fieldset: 'person',
    categories: ['birthday', 'anniversary', 'farewell'],
    tagline: 'Black and gold for a big number',
    palette: { bg: '#121212', ink: '#FFF8E7', muted: '#C9BFA6', accent: '#E6B422', accentDark: '#E6B422' },
    fonts: { display: 'Playfair Display', body: 'Outfit' },
    motif: 'starburst', closeMotif: 'sparkle',
    pattern: { name: 'rays', count: 18, alpha: 0.07, fill: '@accent', cy: 0.32 },
    defaults: { eyebrow: 'Sixty Years', subtitle: 'turns sixty', closing: 'No gifts, just come' } },

  { id: 'balloon-bright', name: 'Balloon Bright', recipe: 'festive', fieldset: 'person',
    categories: ['birthday', 'first-birthday'],
    tagline: 'Soft cream with a cluster of balloons',
    palette: { bg: '#FFF7EC', ink: '#2C2A33', muted: '#6A6672', accent: '#4FB3A6', accentDark: '#2E7F76' },
    fonts: { display: 'Fraunces', body: 'Outfit' },
    motif: 'balloon-cluster', closeMotif: 'heart',
    pattern: { name: 'dots', step: 30, size: 1.4, fill: '@accent', alpha: 0.16 } },

  { id: 'first-year-pastel', name: 'First Year', recipe: 'classic', fieldset: 'person',
    categories: ['first-birthday', 'baby'],
    tagline: 'Pale pink, soft and small',
    palette: { bg: '#FFF4F6', ink: '#4A3B45', muted: '#8A7580', accent: '#F2A1B4', accentDark: '#C96E85' },
    fonts: { display: 'Fraunces', body: 'Outfit' },
    frame: 'rounded', motif: 'cake', closeMotif: 'heart',
    defaults: { eyebrow: 'First Birthday', name1: 'Aarav', subtitle: 'is turning one', intro: 'One whole year. Please come and help us mark it.', closing: 'Come hungry' } },

  { id: 'little-star', name: 'Little Star', recipe: 'festive', fieldset: 'person',
    categories: ['first-birthday', 'baby', 'birthday'],
    tagline: 'Night blue with a sky of stars',
    palette: { bg: '#16203C', ink: '#FFFFFF', muted: '#BFC8DE', accent: '#F5D06F', accentDark: '#F5D06F' },
    fonts: { display: 'Fraunces', body: 'Outfit' },
    motif: 'starburst', closeMotif: 'sparkle',
    pattern: { name: 'stars', count: 90, seed: 5, fill: '#FFFFFF', alpha: 0.75 },
    defaults: { eyebrow: 'Our Little Star', name1: 'Aarav', subtitle: 'is turning one' } },

  // ----------------------------------------------------------------- baby
  { id: 'naming-day', name: 'Naming Day', recipe: 'classic', fieldset: 'person',
    categories: ['baby'],
    tagline: 'Warm cream and a single sprig',
    palette: { bg: '#FBF7EF', ink: '#3E3A32', muted: '#7C7467', accent: '#A88457', accentDark: '#86663F' },
    fonts: { display: 'Cormorant Garamond', body: 'Space Grotesk' },
    frame: 'rules', motif: 'sprig', closeMotif: 'flourish-leaf',
    defaults: { eyebrow: 'Naming Ceremony', name1: 'Our daughter', subtitle: 'will be named', intro: 'We would be glad to have you with us as we name our daughter', closing: 'Blessings welcome' } },

  { id: 'baptism-dove', name: 'Baptism Dove', recipe: 'arch', fieldset: 'person',
    categories: ['baby'],
    tagline: 'Pale blue, a dove and an arch',
    palette: { bg: '#EAF1F6', ink: '#27415C', muted: '#5A7492', accent: '#7FA5C4', accentDark: '#4C7799' },
    fonts: { display: 'Cormorant Garamond', body: 'Outfit' },
    motif: 'dove', closeMotif: 'cross',
    defaults: { eyebrow: 'Baptism', name1: 'Maria', subtitle: 'will be baptised', intro: 'With joy we invite you to the baptism of', closing: 'Grace and peace' } },

  { id: 'baby-shower-mint', name: 'Baby Shower', recipe: 'festive', fieldset: 'person',
    categories: ['baby'],
    tagline: 'Fresh mint, gentle and modern',
    palette: { bg: '#EFF8F3', ink: '#2F4F42', muted: '#64857A', accent: '#86C2A4', accentDark: '#3F7A62' },
    fonts: { display: 'Fraunces', body: 'Outfit' },
    motif: 'rattle', closeMotif: 'heart',
    pattern: { name: 'dots', step: 26, size: 1.4, fill: '@accentDark', alpha: 0.16 },
    defaults: { eyebrow: 'Baby Shower', name1: 'Priya', subtitle: 'is expecting', intro: 'Come and shower the little one with love', closing: 'Tea and cake' } },

  // ---------------------------------------------------------- anniversary
  { id: 'silver-laurel', name: 'Silver Laurel', recipe: 'classic', fieldset: 'couple',
    categories: ['anniversary'],
    tagline: 'Cool grey with a laurel wreath',
    palette: { bg: '#F4F5F7', ink: '#23252B', muted: '#6E717A', accent: '#8A8F99', accentDark: '#5F646E' },
    fonts: { display: 'Cinzel', body: 'Space Grotesk' },
    frame: 'double', motif: 'laurel', closeMotif: 'diamond',
    defaults: { eyebrow: 'Twenty Five Years', intro: 'Twenty five years on, we would love to see you again', closing: 'Still, and always' } },

  { id: 'golden-anniversary', name: 'Golden Anniversary', recipe: 'classic', fieldset: 'couple',
    categories: ['anniversary', 'reception'],
    tagline: 'Deep bronze and gold',
    palette: { bg: '#1C1710', ink: '#FDF6E6', muted: '#CBBC9E', accent: '#D9A441', accentDark: '#D9A441' },
    fonts: { display: 'Playfair Display', body: 'Outfit' },
    frame: 'deco', motif: 'sun', closeMotif: 'laurel',
    defaults: { eyebrow: 'Fifty Years', intro: 'Fifty years married. Please come and celebrate with us', closing: 'With all our love' } },

  // --------------------------------------------------------- housewarming
  { id: 'new-home-warm', name: 'New Home', recipe: 'classic', fieldset: 'event',
    categories: ['housewarming'],
    tagline: 'Terracotta and a simple house',
    palette: { bg: '#FBF3EA', ink: '#4A2F21', muted: '#80675A', accent: '#C76B3F', accentDark: '#A0512C' },
    fonts: { display: 'Fraunces', body: 'Space Grotesk' },
    frame: 'corners', motif: 'house', closeMotif: 'sprig',
    defaults: { eyebrow: 'Housewarming' } },

  { id: 'griha-mandala', name: 'Griha Mandala', recipe: 'classic', fieldset: 'event',
    categories: ['housewarming', 'festival'],
    tagline: 'Deep red with a drawn mandala',
    palette: { bg: '#7A1A12', ink: '#FFF3E0', muted: '#E8C3A6', accent: '#F0B445', accentDark: '#F0B445' },
    fonts: { display: 'Cinzel', body: 'Outfit' },
    frame: 'double', motif: 'mandala', closeMotif: 'diya',
    defaults: { eyebrow: 'Gruhapravesham', name1: 'Our new home', subtitle: 'and a meal together', timeLabel: 'Muhurtham' } },

  // ----------------------------------------------------------- graduation
  { id: 'graduation-navy', name: 'Graduation Navy', recipe: 'modern', fieldset: 'person',
    categories: ['graduation', 'farewell'],
    tagline: 'Navy and gold, quietly proud',
    palette: { bg: '#111C33', ink: '#FFFFFF', muted: '#AFBAD0', accent: '#D7B46A', accentDark: '#D7B46A' },
    fonts: { display: 'Outfit', body: 'Space Grotesk' },
    motif: 'graduation-cap',
    defaults: { eyebrow: 'Graduation', name1: 'Nikhil', subtitle: 'has graduated', intro: 'Four years of work. Come and raise a glass to it.', closing: 'Proud does not cover it' } },

  // ------------------------------------------------------------- farewell
  { id: 'farewell-dusk', name: 'Farewell Dusk', recipe: 'festive', fieldset: 'person',
    categories: ['farewell', 'corporate'],
    tagline: 'A dusk sky, warm and final',
    palette: { bg: '#2A2140', bg2: '#8A4A5E', ink: '#FFFFFF', muted: '#E2D2DA', accent: '#F2B5A0', accentDark: '#F2B5A0' },
    bgFill: { type: 'linear', from: [0, 0], to: [0, 640], stops: [[0, '@bg'], [1, '@bg2']] },
    fonts: { display: 'Playfair Display', body: 'Outfit' },
    motif: 'dove', closeMotif: 'wave',
    pattern: { name: 'rays', count: 14, alpha: 0.06, fill: '#FFFFFF', cy: 0.78 },
    defaults: { eyebrow: 'Farewell', name1: 'Sunil', subtitle: 'retires this month', intro: 'Thirty two years with us. Come and see him off properly.', closing: 'Thank you, from all of us' } },

  // ------------------------------------------------------------ festivals
  { id: 'diwali-diya', name: 'Diwali Diya', recipe: 'festive', fieldset: 'event',
    categories: ['festival'],
    tagline: 'Indigo night lit by a lamp',
    palette: { bg: '#1B1038', ink: '#FFF0D6', muted: '#CDBCE0', accent: '#F5A623', accentDark: '#F5A623' },
    fonts: { display: 'Cinzel', body: 'Outfit' },
    motif: 'diya', closeMotif: 'mandala',
    pattern: { name: 'rays', count: 20, alpha: 0.08, fill: '@accent', cy: 0.35 },
    defaults: { eyebrow: 'Diwali', name1: 'Diwali at ours', subtitle: 'lights, food, family', intro: 'Come and light a lamp with us', closing: 'Happy Diwali' } },

  { id: 'eid-crescent', name: 'Eid Crescent', recipe: 'classic', fieldset: 'event',
    categories: ['festival'],
    tagline: 'Deep teal with a gold crescent',
    palette: { bg: '#0E3B3B', ink: '#F2F7F4', muted: '#BBD3CD', accent: '#D8B35A', accentDark: '#D8B35A' },
    fonts: { display: 'Cinzel', body: 'Outfit' },
    frame: 'deco', motif: 'crescent', closeMotif: 'sparkle',
    defaults: { eyebrow: 'Eid Mubarak', name1: 'Eid at ours', subtitle: 'lunch and sweets', intro: 'Our door is open. Please come and eat with us', closing: 'Eid Mubarak' } },

  { id: 'christmas-eve', name: 'Christmas Eve', recipe: 'classic', fieldset: 'event',
    categories: ['festival'],
    tagline: 'Forest green, warm and traditional',
    palette: { bg: '#10301F', ink: '#FBF6E9', muted: '#C3D3C4', accent: '#D4A24C', accentDark: '#D4A24C' },
    fonts: { display: 'Cormorant Garamond', body: 'Outfit' },
    frame: 'corners', motif: 'candle', closeMotif: 'sprig',
    defaults: { eyebrow: 'Christmas', name1: 'Christmas Eve', subtitle: 'dinner at ours', intro: 'Come and spend the evening with us', closing: 'Merry Christmas' } },

  { id: 'new-year-gold', name: 'New Year Gold', recipe: 'festive', fieldset: 'event',
    categories: ['festival', 'corporate', 'reception'],
    tagline: 'Midnight and a burst of gold',
    palette: { bg: '#0A0A12', ink: '#FFFFFF', muted: '#B9B6C6', accent: '#F0C65A', accentDark: '#F0C65A' },
    fonts: { display: 'Outfit', body: 'Space Grotesk' },
    motif: 'starburst', closeMotif: 'sparkle',
    pattern: { name: 'confetti', count: 60, seed: 21, colours: ['@accent', '#FFFFFF', '#7C6CF5'], alpha: 0.9 },
    defaults: { eyebrow: 'New Year', name1: 'New Year Party', subtitle: 'see the year out with us', intro: 'Bring someone. Stay late.', timeLabel: 'from', closing: 'Happy New Year' } },

  // ------------------------------------------------------------ corporate
  { id: 'opening-minimal', name: 'Opening Minimal', recipe: 'modern', fieldset: 'event',
    categories: ['corporate'],
    tagline: 'White space and one clean accent',
    palette: { bg: '#FFFFFF', ink: '#111113', muted: '#5F5F69', accent: '#2F6BFF', accentDark: '#1E49B8' },
    fonts: { display: 'Space Grotesk', body: 'Space Grotesk' },
    motif: 'starburst',
    defaults: { eyebrow: 'Grand Opening', name1: 'We are open', subtitle: 'come and see the place', intro: 'After a long year of work, the doors are open.', closing: 'Refreshments from noon' } },
];

/* ------------------------------------------------------------------ build */

function buildTemplate(spec) {
  const recipe = RECIPES[spec.recipe];
  if (!recipe) throw new Error(`${spec.id}: unknown recipe "${spec.recipe}"`);

  const { background, scenes } = recipe(spec);
  const defaults = { ...BASE_DEFAULTS[spec.fieldset], ...(spec.defaults || {}) };

  return {
    _note: 'Generated by scripts/gen-templates.mjs from a compact spec. Safe to edit by hand; re-running the generator overwrites it.',
    id: spec.id,
    name: spec.name,
    tagline: spec.tagline,
    categories: spec.categories,
    fieldset: spec.fieldset,
    defaults,
    design: { width: 360, height: 640 },
    palette: spec.palette,
    fonts: spec.fonts,
    photoSlots: [{ key: 'main', label: 'Photo', hint: 'A picture of the people this is about' }],
    transition: 0.5,
    background,
    scenes,
  };
}

async function main() {
  const ids = new Set();
  const written = new Set();

  for (const spec of SPECS) {
    if (ids.has(spec.id)) throw new Error(`duplicate design id: ${spec.id}`);
    ids.add(spec.id);
    const file = `${spec.id}.json`;
    await writeFile(join(OUT, file), JSON.stringify(buildTemplate(spec), null, 2) + '\n');
    written.add(file);
  }

  // A design file the generator no longer produces is one somebody renamed;
  // leaving it behind means the gallery shows a design nothing maintains.
  let pruned = 0;
  for (const name of await readdir(OUT)) {
    if (name.endsWith('.json') && name !== 'fieldsets.json' && !written.has(name)) {
      await rm(join(OUT, name));
      pruned++;
    }
  }

  const byCategory = {};
  for (const spec of SPECS) {
    for (const c of spec.categories) byCategory[c] = (byCategory[c] || 0) + 1;
  }

  console.log(`Wrote ${SPECS.length} designs${pruned ? `, pruned ${pruned}` : ''}.`);
  console.log('Per category:',
    Object.entries(byCategory).sort().map(([k, v]) => `${k} ${v}`).join(', '));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
