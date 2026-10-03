/**
 * Builds the design library.
 *
 * A design is data, but writing fifty designs by hand means fifty chances to
 * mis-type a coordinate and fifty subtly different ideas of where a date
 * belongs. So each design is a compact spec - palette, typefaces, ornaments,
 * one of eight layout recipes, and its own copy - and this expands it into
 * the JSON the engine reads. The output is committed, plain, and editable by
 * hand afterwards: the generator is a starting point, not a dependency.
 *
 * The gates at the bottom are the point of the file. Every one of them exists
 * because it is a thing that makes an invitation look cheap, and a rule a
 * machine can check is worth more than a rule in a style guide nobody reads.
 *
 *   node scripts/gen-templates.mjs
 */
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app/src/templates');

/* ----------------------------------------------------------- the measure */

const W = 360;
const H = 640;
const MID = W / 2;

/**
 * 40px gutters, so the live measure is 280px. This is wider than feels
 * comfortable and that is the whole idea: a family's instinct is to fill the
 * card, and about 55% of every frame here carries no mark at all.
 */
const GUTTER = 40;
const DISPLAY_W = 280;   // names, dates - the lines read from across a room
const BODY_W = 268;      // service copy
const NARROW_W = 212;    // inside an arch
const PANEL_W = 230;     // inside a floating panel
const L = GUTTER;        // the left rail, for left-aligned recipes

/**
 * Blocks sit a little above true centre (320). A centred block reads as
 * sunken in a tall portrait frame, which is the difference between a card
 * that was composed and a div that was middled.
 */
const OC = 302;

/* ------------------------------------------------------------- helpers */

const text = (o) => ({ type: 'text', align: 'center', x: MID, ...o });
const motif = (name, y, size, o = {}) => ({ type: 'motif', name, x: MID, y, size, stroke: '@accent', width: 1.3, ...o });
const rule = (y, half, o = {}) => ({ type: 'line', x1: MID - half, y1: y, x2: MID + half, y2: y, stroke: '@accent', width: 1, anchorX: MID, anchorY: y, ...o });

const fadeUp = (at, dur = 0.85) => ({ in: { preset: 'fade-up', at, dur } });
const fadeIn = (at, dur = 0.8) => ({ in: { preset: 'fade', at, dur } });
const scaleIn = (at, dur = 0.85) => ({ in: { preset: 'scale-in', at, dur } });
const growWidth = (at, dur = 0.8) => ({ in: { preset: 'grow-width', at, dur } });

/** The ground. Flat unless the design asked for a gradient. */
const ground = (spec) => ({ type: 'rect', x: 0, y: 0, w: W, h: H, fill: spec.bgFill || '@bg' });

/**
 * The eyebrow: small, tracked, upper case. The only capitals permitted on
 * any frame, which is why tracking is generous - caps at 13px with no
 * tracking is unreadable, and caps with tracking is the cheapest piece of
 * typographic authority there is.
 */
const eyebrow = (y, o = {}) => text({
  text: '{{eyebrow}}', font: 'body', size: 13, letterSpacing: 3.2, uppercase: true,
  color: '@accentDark', y, maxWidth: DISPLAY_W, ...o,
});

/**
 * Names, by fieldset: two people, or one subject plus a line underneath.
 *
 * `minSize` is set far below `size` on purpose. Every design has to survive a
 * 22-character name by shrinking, never by wrapping somebody's name across
 * two lines - a design that only works for "Anjali & Rahul" is a screenshot,
 * not a template.
 */
function nameLayers(spec, opts) {
  const {
    big, y, gap, align = 'center', x = MID,
    color = '@ink', joinerColor = '@accentDark', joinerScale = 0.44, joinerStyle = 'display',
    maxWidth = align === 'left' ? DISPLAY_W : DISPLAY_W,
    subtitleColor = '@accentDark',
  } = opts;
  const common = { align, x, maxWidth };
  // A script face has a far smaller x-height than a serif, so the same number
  // reads as half the size. Designs that use one say so and get scaled up.
  const size = Math.round(big * (spec.displayScale || 1));
  if (spec.fieldset === 'couple') {
    return [
      text({ ...common, text: '{{name1}}', font: 'display', size, color, minSize: 24, maxLines: 1, y, anim: fadeUp(0.15) }),
      joinerStyle === 'label'
        // A hairline display face sets a three-letter word as a smudge. The
        // joining word becomes a tracked label instead, which also stops it
        // competing with names three times its size.
        ? text({ ...common, text: '{{joiner}}', font: 'body', size: 13, letterSpacing: 3, uppercase: true, color: joinerColor, y: y + gap, maxWidth: 140, anim: fadeIn(0.5, 0.7) })
        : text({ ...common, text: '{{joiner}}', font: 'display', size: Math.round(size * joinerScale), color: joinerColor, y: y + gap, maxWidth: 120, anim: scaleIn(0.5, 0.7) }),
      text({ ...common, text: '{{name2}}', font: 'display', size, color, minSize: 24, maxLines: 1, y: y + gap * 2, anim: fadeUp(0.8) }),
    ];
  }
  // One subject plus a line underneath. The name is allowed two lines, so the
  // subtitle sits a full gap lower than the couple layout would put it -
  // "Daniel Okafor" over "GRADUATES IN LAW" has to clear, not collide.
  return [
    text({ ...common, text: '{{name1}}', font: 'display', size, color, minSize: 24, maxLines: 2, lineHeight: 1.1, y: y + gap * 0.4, anim: fadeUp(0.15) }),
    text({ ...common, text: '{{subtitle}}', font: 'body', size: 16, letterSpacing: 2, uppercase: true, color: subtitleColor, y: y + gap * 2.1, maxWidth: Math.min(maxWidth, 250), maxLines: 2, lineHeight: 1.5, anim: fadeUp(0.7) }),
  ];
}

const photoScene = (layer) => ({
  id: 'photo', duration: 4, requires: 'main',
  layers: [{ type: 'photo', slot: 'main', motion: { preset: 'zoom-in', amount: 0.06 }, anim: scaleIn(0.1, 0.9), ...layer }],
});


/* ------------------------------------------------------- premium finishes */

const hex = (c) => {
  const h = String(c).replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

/** WCAG relative luminance. */
function luminance(colour) {
  const [r, g, b] = hex(colour).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const isDark = (bg) => luminance(bg) < 0.4;

const mix = (a, b, t) => {
  const A = hex(a); const B = hex(b);
  return '#' + [0, 1, 2].map((i) =>
    Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
};

/**
 * A metallic sweep built from the design's own accent.
 *
 * Flat gold looks like a swatch; foil looks like foil because the highlight
 * travels. space:"box" makes it travel across each rule and each motif rather
 * than across the whole frame. It is deliberately never applied to text: a
 * gradient inside a letterform is the single clearest tell of a free
 * template, because real foil is a flat ink that catches light at its edge.
 */
const foilToken = (accent, accentDark) => ({
  type: 'linear', space: 'box', from: [0, 0], to: [1, 0.3],
  stops: [
    [0, accentDark],
    [0.22, mix(accent, '#FFFFFF', 0.55)],
    [0.42, accent],
    [0.6, mix(accent, '#FFFFFF', 0.72)],
    [0.78, accent],
    [1, accentDark],
  ],
});

/**
 * Swap flat accent for foil everywhere it is painted, never where it is read.
 *
 * Filled areas are left alone: a gradient across a 20px band is a gradient
 * across a 20px band, and reads as a cheap sweep rather than as metal. Foil
 * only convinces on a hairline or a 1.3px motif stroke, where a real sheet
 * would catch the light at its edge.
 */
function applyFoil(node) {
  if (Array.isArray(node)) return node.map(applyFoil);
  if (!node || typeof node !== 'object') return node;
  const filled = node.type === 'rect';
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    const paint = k === 'stroke' || (k === 'fill' && !filled);
    out[k] = paint && v === '@accent' ? '@foil' : applyFoil(v);
  }
  return out;
}

/** A texture layer, tuned light or dark to whatever it sits on. */
function textureLayer(name, bg) {
  if (!name || name === 'none') return null;
  const dark = isDark(bg);
  if (name === 'vignette') return { type: 'pattern', name, x: 0, y: 0, w: W, h: H, alpha: dark ? 0.42 : 0.16 };
  return {
    type: 'pattern', name, x: 0, y: 0, w: W, h: H,
    fill: dark ? '#FFFFFF' : '#000000',
    alpha: name === 'linen' ? (dark ? 0.05 : 0.045) : (dark ? 0.06 : 0.05),
    seed: 13,
  };
}

/* ------------------------------------------------------------- recipes */

const RECIPES = {
  /** Centred column inside a hairline frame. The default formal invitation. */
  classic(spec) {
    return {
      background: [
        ground(spec),
        { type: 'frame', name: spec.frame || 'double', inset: 24, stroke: '@accent', width: 1,
          anchorX: MID, anchorY: 320, motion: { preset: 'zoom-in', amount: 0.018 },
          anim: fadeIn(0.4, 1) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 238, 62, { anim: scaleIn(0.45, 0.9) }),
          eyebrow(330, { anim: fadeUp(1.05) }),
          rule(362, 32, { anim: growWidth(1.5) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 19, color: '@muted', y: OC, maxWidth: BODY_W, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 52, y: 252, gap: 48 }),
          rule(404, 26, { anim: growWidth(1.4) }),
        ] },
        photoScene({ x: 90, y: 186, w: 180, h: 240, radius: 3, stroke: '@accent', width: 1, anchorX: MID, anchorY: 306 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'body', weight: 600, size: 26, color: '@ink', y: 284, maxWidth: DISPLAY_W, maxLines: 2, lineHeight: 1.25, minSize: 16, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 18, color: '@muted', y: 334, maxWidth: DISPLAY_W, maxLines: 2, anim: fadeUp(0.75) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', weight: 500, size: 22, color: '@ink', y: OC, maxWidth: BODY_W, maxLines: 3, lineHeight: 1.4, minSize: 15, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 25, color: '@accentDark', y: 270, maxWidth: BODY_W, maxLines: 3, lineHeight: 1.35, minSize: 16, anim: fadeUp(0.2) }),
          rule(316, 20, { anim: growWidth(0.7) }),
          motif(spec.closeMotif || spec.motif, 366, 42, { anim: fadeIn(1) }),
        ] },
      ],
    };
  },

  /** An arch over the content: churches, mandapams, doorways. */
  arch(spec) {
    return {
      background: [
        ground(spec),
        { type: 'frame', name: 'arch', x: 54, y: 88, w: 252, h: 464, stroke: '@accent', width: 1.3,
          anchorX: MID, anchorY: 320, motion: { preset: 'zoom-in', amount: 0.018 },
          anim: fadeIn(0.3, 1.1) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 240, 60, { anim: scaleIn(0.5, 0.9) }),
          eyebrow(332, { maxWidth: NARROW_W, anim: fadeUp(1.05) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@muted', y: 308, maxWidth: NARROW_W, maxLines: 5, lineHeight: 1.5, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 44, y: 256, gap: 46, maxWidth: NARROW_W + 20 }),
          motif(spec.divider || 'diamond', 406, 11, { width: 1, anim: fadeIn(1.3) }),
        ] },
        photoScene({ x: 94, y: 192, w: 172, h: 228, shape: 'arch', stroke: '@accent', width: 1.2, anchorX: MID, anchorY: 306 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 26, color: '@ink', y: 288, maxWidth: NARROW_W + 18, maxLines: 2, lineHeight: 1.25, minSize: 16, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 18, color: '@muted', y: 336, maxWidth: NARROW_W + 18, maxLines: 2, anim: fadeUp(0.75) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 21, color: '@ink', y: 304, maxWidth: NARROW_W, maxLines: 4, lineHeight: 1.4, minSize: 14, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 24, color: '@accentDark', y: 278, maxWidth: NARROW_W, maxLines: 3, lineHeight: 1.35, minSize: 15, anim: fadeUp(0.2) }),
          motif(spec.closeMotif || spec.motif, 368, 40, { anim: fadeIn(0.9) }),
        ] },
      ],
    };
  },

  /**
   * Woven bands top and bottom, after a Kerala kasavu border.
   *
   * The band is a band with threads in it, not a filled gold bar: two
   * hairlines inside the accent make it read as woven, which is what the
   * fabric actually looks like.
   */
  banner(spec) {
    const band = spec.band || '@accent';
    const edge = (y, flip) => [
      { type: 'rect', x: 0, y, w: W, h: 20, fill: band, anchorY: flip ? H : 0, anim: { in: { preset: 'grow-height', dur: 0.7 } } },
      { type: 'line', x1: 0, y1: y + 6, x2: W, y2: y + 6, stroke: '@bg', width: 1, anim: fadeIn(0.5, 0.6) },
      { type: 'line', x1: 0, y1: y + 14, x2: W, y2: y + 14, stroke: '@bg', width: 1, anim: fadeIn(0.6, 0.6) },
      { type: 'rect', x: 0, y: flip ? y - 4 : y + 20, w: W, h: 3, fill: '@ink', anchorY: flip ? H : 0, anim: { in: { preset: 'grow-height', at: 0.1, dur: 0.7 } } },
    ];
    return {
      background: [
        ground(spec),
        ...edge(0, false),
        ...edge(620, true),
        { type: 'frame', name: 'thin', x: 20, y: 44, w: 320, h: 552, stroke: '@accent', width: 1,
          anchorX: MID, anchorY: 320, motion: { preset: 'zoom-in', amount: 0.015 },
          anim: fadeIn(0.5, 1) },
      ],
      scenes: RECIPES.classic(spec).scenes,
    };
  },

  /** Left-aligned, large type, almost no decoration. */
  modern(spec) {
    const bar = (y, o = {}) => ({ type: 'rect', x: L, y, w: 52, h: 2, fill: '@accent', anchorX: L, anchorY: y, anim: growWidth(0.2, 0.7), ...o });
    return {
      background: [ground(spec)],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 232, 56, { x: L + 26, anim: scaleIn(0.4, 0.9) }),
          eyebrow(324, { align: 'left', x: L, anim: fadeUp(1) }),
          bar(352),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ align: 'left', x: L, text: '{{intro}}', font: 'body', size: 20, color: '@muted', y: OC, maxWidth: 276, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 50, y: 250, gap: 52, align: 'left', x: L, joinerScale: 0.38 }),
          bar(420, { anim: growWidth(1.3) }),
        ] },
        photoScene({ x: L, y: 184, w: 280, h: 244, radius: 2, anchorX: MID, anchorY: 306 }),
        { id: 'when', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{dateLong}}', font: 'display', weight: 600, size: 34, color: '@ink', y: 288, maxWidth: 276, maxLines: 2, lineHeight: 1.15, minSize: 18, anim: fadeUp(0.25) }),
          text({ align: 'left', x: L, text: '{{timeLabel}} {{timeText}}', font: 'body', size: 18, color: '@muted', y: 346, maxWidth: 276, anim: fadeUp(0.7) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{venue}}', font: 'body', weight: 500, size: 22, color: '@ink', y: OC, maxWidth: 276, maxLines: 3, lineHeight: 1.4, minSize: 15, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ align: 'left', x: L, text: '{{closing}}', font: 'display', size: 26, color: '@accentDark', y: 288, maxWidth: 276, maxLines: 3, lineHeight: 1.3, minSize: 16, anim: fadeUp(0.2) }),
          bar(348),
        ] },
      ],
    };
  },

  /**
   * The gallery private-view card: no frame, one enormous name across the
   * full measure, one hairline, and most of the sheet left empty on purpose.
   *
   * This is the one recipe where the name is the composition rather than a
   * label inside one, which is why it carries the hairline display faces.
   */
  masthead(spec) {
    return {
      background: [ground(spec)],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          eyebrow(290, { size: 13, letterSpacing: 3.6, anim: fadeUp(0.4) }),
          rule(328, 52, { anim: growWidth(1) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@muted', y: OC, maxWidth: 258, maxLines: 4, lineHeight: 1.55, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 7, layers: [
          ...nameLayers(spec, { big: 66, y: 250, gap: 54, joinerStyle: 'label', joinerColor: '@accentDark' }),
          rule(424, 140, { width: 0.8, anim: growWidth(1.6, 1.1) }),
        ] },
        photoScene({ x: L, y: 148, w: 280, h: 312, radius: 0, anchorX: MID, anchorY: 304 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 42, color: '@ink', y: 290, maxWidth: DISPLAY_W, maxLines: 2, lineHeight: 1.1, minSize: 20, anim: fadeUp(0.25) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 15, letterSpacing: 2.4, uppercase: true, color: '@muted', y: 348, maxWidth: DISPLAY_W, anim: fadeUp(0.8) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 20, color: '@ink', y: OC, maxWidth: 262, maxLines: 3, lineHeight: 1.55, minSize: 14, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          rule(266, 28, { anim: growWidth(0.3) }),
          text({ text: '{{closing}}', font: 'display', size: 28, color: '@accentDark', y: 316, maxWidth: 262, maxLines: 3, lineHeight: 1.35, minSize: 16, anim: fadeUp(0.6) }),
        ] },
      ],
    };
  },

  /**
   * A card floating on a ground - stationery lying on a table. The panel is
   * the design's own ground lifted or dropped a few percent, never a second
   * colour, so it reads as a sheet of paper rather than a coloured box.
   */
  panel(spec) {
    return {
      background: [
        ground(spec),
        { type: 'rect', x: 32, y: 92, w: 296, h: 456, fill: '@panel', radius: 2,
          anchorX: MID, anchorY: 320, anim: fadeIn(0, 0.9) },
        { type: 'frame', name: spec.frame || 'thin', x: 44, y: 104, w: 272, h: 432, stroke: '@accent', width: 1,
          anchorX: MID, anchorY: 320, motion: { preset: 'zoom-in', amount: 0.014 },
          anim: fadeIn(0.5, 1) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 248, 54, { anim: scaleIn(0.5, 0.9) }),
          eyebrow(336, { maxWidth: PANEL_W, anim: fadeUp(1.05) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@muted', y: 308, maxWidth: PANEL_W, maxLines: 5, lineHeight: 1.5, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 42, y: 256, gap: 44, maxWidth: PANEL_W + 14 }),
          rule(392, 24, { anim: growWidth(1.4) }),
        ] },
        photoScene({ x: 72, y: 180, w: 216, h: 248, radius: 2, stroke: '@accent', width: 1, anchorX: MID, anchorY: 304 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'body', weight: 600, size: 24, color: '@ink', y: 288, maxWidth: PANEL_W + 14, maxLines: 2, lineHeight: 1.25, minSize: 15, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 17, color: '@muted', y: 334, maxWidth: PANEL_W + 14, maxLines: 2, anim: fadeUp(0.75) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 20, color: '@ink', y: 304, maxWidth: PANEL_W, maxLines: 4, lineHeight: 1.4, minSize: 14, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 23, color: '@accentDark', y: 282, maxWidth: PANEL_W, maxLines: 3, lineHeight: 1.35, minSize: 15, anim: fadeUp(0.2) }),
          motif(spec.closeMotif || spec.motif, 370, 38, { anim: fadeIn(0.9) }),
        ] },
      ],
    };
  },

  /**
   * One deep band through the middle, the type reversed out of it. The
   * strongest silhouette in the library: blur the frame and a single shape
   * still survives, which is the squint test the others have to work for.
   */
  band(spec) {
    const top = 232;
    const tall = 176;
    return {
      background: [
        ground(spec),
        { type: 'rect', x: 0, y: top, w: W, h: tall, fill: '@ink', anchorX: MID, anchorY: 320,
          anim: { in: { preset: 'grow-height', dur: 0.8 } } },
        { type: 'line', x1: GUTTER, y1: top - 14, x2: W - GUTTER, y2: top - 14, stroke: '@accent', width: 1, anchorX: MID, anchorY: top - 14, anim: growWidth(0.7) },
        { type: 'line', x1: GUTTER, y1: top + tall + 14, x2: W - GUTTER, y2: top + tall + 14, stroke: '@accent', width: 1, anchorX: MID, anchorY: top + tall + 14, anim: growWidth(0.8) },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          // Marks that fall inside the band are drawn in the ground colour,
          // not the accent: a dark gold rule on oxblood is a rule nobody can
          // see, and the contrast gate only ever looked at @ink on @bg.
          motif(spec.motif, 300, 56, { stroke: '@bg', anim: scaleIn(0.5, 0.9) }),
          eyebrow(366, { maxWidth: BODY_W, color: '@bg', anim: fadeUp(1.05) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@bg', y: 318, maxWidth: BODY_W, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 40, y: 276, gap: 44, color: '@bg', joinerColor: '@bg', subtitleColor: '@bg', joinerScale: 0.4, maxWidth: BODY_W }),
        ] },
        photoScene({ x: 0, y: 0, w: W, h: top, anchorX: MID, anchorY: top / 2 }),
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 30, color: '@bg', y: 296, maxWidth: BODY_W, maxLines: 2, lineHeight: 1.2, minSize: 17, anim: fadeUp(0.3) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 16, letterSpacing: 2, uppercase: true, color: '@bg', y: 348, maxWidth: BODY_W, anim: fadeUp(0.8) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 20, color: '@bg', y: 318, maxWidth: BODY_W, maxLines: 3, lineHeight: 1.4, minSize: 14, anim: fadeUp(0.3) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 24, color: '@bg', y: 304, maxWidth: 262, maxLines: 3, lineHeight: 1.35, minSize: 15, anim: fadeUp(0.2) }),
          rule(376, 22, { stroke: '@bg', anim: growWidth(0.9) }),
        ] },
      ],
    };
  },

  /** The photograph is the design. Falls back gracefully with no picture. */
  photoLed(spec) {
    return {
      background: [
        ground(spec),
        { type: 'photo', slot: 'main', x: 0, y: 0, w: W, h: H, placeholderFill: '@bg',
          motion: { preset: 'zoom-in', amount: 0.05 }, anim: fadeIn(0, 1) },
        // Keeps text readable whether or not a picture was added. A gradient
        // falloff, never a hard-edged box behind the caption.
        { type: 'rect', x: 0, y: 236, w: W, h: 404, fill: {
          type: 'linear', from: [0, 236], to: [0, H],
          stops: [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0.80)']] } },
      ],
      scenes: [
        { id: 'open', duration: 5.5, layers: [
          motif(spec.motif, 402, 50, { anim: scaleIn(0.5, 0.9) }),
          eyebrow(470, { color: '@onPhoto', anim: fadeUp(1) }),
        ] },
        { id: 'intro', duration: 4, layers: [
          text({ text: '{{intro}}', font: 'body', size: 18, color: '@onPhoto', y: 448, maxWidth: BODY_W, maxLines: 4, lineHeight: 1.45, anim: fadeUp(0.2) }),
        ] },
        { id: 'names', duration: 6.5, layers: [
          ...nameLayers(spec, { big: 50, y: 374, gap: 50, color: '@onPhoto', joinerColor: '@accent', subtitleColor: '@accent' }),
        ] },
        { id: 'when', duration: 5, layers: [
          text({ text: '{{dateLong}}', font: 'display', size: 30, color: '@onPhoto', y: 424, maxWidth: DISPLAY_W, maxLines: 2, lineHeight: 1.2, minSize: 17, anim: fadeUp(0.25) }),
          text({ text: '{{timeLabel}} {{timeText}}', font: 'body', size: 16, letterSpacing: 2, uppercase: true, color: '@accent', y: 472, maxWidth: DISPLAY_W, anim: fadeUp(0.8) }),
        ] },
        { id: 'where', duration: 5, layers: [
          text({ text: '{{venue}}', font: 'body', size: 21, color: '@onPhoto', y: 446, maxWidth: BODY_W, maxLines: 3, lineHeight: 1.45, minSize: 15, anim: fadeUp(0.25) }),
        ] },
        { id: 'close', duration: 5, layers: [
          text({ text: '{{closing}}', font: 'display', size: 26, color: '@onPhoto', y: 436, maxWidth: 262, maxLines: 3, lineHeight: 1.3, minSize: 16, anim: fadeUp(0.2) }),
        ] },
      ],
    };
  },
};

/* --------------------------------------------------------------- defaults */

/**
 * Only the mechanical fields live here. Every design supplies its own copy,
 * because the defaults are what the owner sees first and twelve designs that
 * all say "Anjali & Rahul" look like one design shown twelve times.
 */
const BASE_DEFAULTS = {
  couple: { date: '2027-02-14', time: '10:30', timeLabel: 'at', joiner: '&' },
  person: { date: '2027-03-20', time: '19:00', timeLabel: 'from' },
  event: { date: '2027-04-11', time: '11:00', timeLabel: 'from' },
};

/** Copy every design has to write for itself. */
const REQUIRED_COPY = {
  couple: ['eyebrow', 'intro', 'name1', 'name2', 'venue', 'closing'],
  person: ['eyebrow', 'intro', 'name1', 'subtitle', 'venue', 'closing'],
  event: ['eyebrow', 'intro', 'name1', 'subtitle', 'venue', 'closing'],
};

/* ------------------------------------------------------------------ specs */

// The library itself. Data, not code - swapping in a new set of designs is
// replacing one JSON file, which is exactly what a wholesale redesign needs
// to be. Each entry is expanded by one of the layout recipes above.
const SPECS = JSON.parse(
  await readFile(new URL('./design-specs.json', import.meta.url), 'utf8'));


/* ------------------------------------------------------------------- gates */

/** Scatter: the thing a design does instead of having a composition. */
const BANNED_PATTERNS = new Set(['confetti', 'dots', 'stars', 'rays']);

/** Textures that read as a printed stock rather than a JPEG artefact. */
const LIGHT_TEXTURES = new Set(['paper', 'linen']);
const DARK_TEXTURES = new Set(['paper', 'linen', 'vignette', 'grain']);

const PURE = new Set(['#FFFFFF', '#FFF', '#000000', '#000']);

/** Ornament, counted per scene: the frame is structure, these are marks. */
function marksIn(scene) {
  return (scene.layers || []).filter((l) =>
    l.type === 'motif' || l.type === 'icon' || l.type === 'line').length;
}

function checkBuilt(spec, template, fail) {
  const { palette } = template;

  for (const [key, value] of Object.entries(palette)) {
    if (typeof value === 'string' && PURE.has(value.toUpperCase())) {
      fail(`palette.${key} is ${value}; pure white and pure black are the fingerprints of software that had no art director`);
    }
  }

  // On a gradient ground every ratio is checked against the worse end, not
  // the end that flatters it.
  const grounds = [palette.bg, ...(spec.gradient && palette.bg2 ? [palette.bg2] : [])];
  for (const bg of grounds) {
    for (const key of ['ink', 'muted', 'accentDark']) {
      const r = contrast(palette[key], bg);
      if (r < 4.5) fail(`${key} ${palette[key]} on ${bg} is ${r.toFixed(2)}:1, needs 4.5:1`);
    }
  }

  const dark = isDark(palette.bg);
  const allowed = dark ? DARK_TEXTURES : LIGHT_TEXTURES;
  if (!spec.texture || spec.texture === 'none') {
    fail('has no texture; flat colour reads as an empty div, and paper or linen at low strength is what buys the printed-card look');
  } else if (!allowed.has(spec.texture)) {
    fail(`texture "${spec.texture}" is not allowed on a ${dark ? 'dark' : 'light'} ground (${[...allowed].join(', ')})`);
  }
  if (spec.pattern) fail('declares a pattern layer; scatter is banned');

  const walk = (layers, where, sceneId) => {
    for (const l of layers || []) {
      if (l.type === 'pattern' && BANNED_PATTERNS.has(l.name)) {
        fail(`${where}: pattern "${l.name}" is scatter`);
      }
      if (l.type === 'text') {
        if (l.color === '@foil') fail(`${where}: foil inside a letterform`);
        if (l.color === '@accent' && contrast(palette.accent, palette.bg) < 4.5 && sceneId !== 'open') {
          fail(`${where}: accent carries text at ${contrast(palette.accent, palette.bg).toFixed(2)}:1`);
        }
        // A tracked 17px label is small caps; a 40px name in capitals is
        // shouting, and shouting is the tell.
        if (l.size > 20 && l.uppercase) {
          fail(`${where}: ${l.size}px upper case; capitals are for labels, not names`);
        }
        if (l.uppercase && !(l.letterSpacing > 1)) {
          fail(`${where}: capitals with no tracking`);
        }
      }
      if ((l.type === 'motif' || l.type === 'icon') && (l.size > 72 || l.size < 10)) {
        fail(`${where}: motif at ${l.size}px (10-72)`);
      }
      if ((l.type === 'motif' || l.type === 'icon') && l.width > 1.6) {
        fail(`${where}: motif stroked at ${l.width}; hand-drawn becomes clipart the moment the stroke thickens`);
      }
    }
  };

  walk(template.background, 'background');
  for (const scene of template.scenes) {
    walk(scene.layers, scene.id, scene.id);
    const n = marksIn(scene);
    if (n > 2) fail(`scene "${scene.id}" carries ${n} ornamental marks; pick two`);
    const sizes = new Set((scene.layers || [])
      .filter((l) => l.type === 'text').map((l) => l.size));
    if (sizes.size > 3) fail(`scene "${scene.id}" has ${sizes.size} type sizes; three is the ceiling`);
    const caps = (scene.layers || []).filter((l) => l.type === 'text' && l.uppercase).length;
    if (caps > 1) fail(`scene "${scene.id}" has ${caps} upper-case lines; one is the ceiling`);
  }

  // Everything on a photoLed design sits on a near-black scrim, so both the
  // text colour and the accent have to survive there, not merely on bg.
  if (spec.recipe === 'photoLed') {
    const onScrim = '#1A1A1A';
    for (const key of ['onPhoto', 'accent']) {
      const r = contrast(palette[key], onScrim);
      if (r < 4.5) fail(`${key} ${palette[key]} is ${r.toFixed(2)}:1 on the photo scrim, needs 4.5:1`);
    }
  }

  const copy = REQUIRED_COPY[spec.fieldset] || [];
  for (const key of copy) {
    if (!spec.defaults || !spec.defaults[key]) {
      fail(`has no copy of its own for "${key}"`);
    }
  }
  const closing = (spec.defaults || {}).closing || '';
  if (/[.!]$/.test(closing)) fail(`closing "${closing}" ends in a full stop or an exclamation mark`);
  const placeholderish = /your name|bride & groom|placeholder|lorem/i;
  for (const [k, v] of Object.entries(spec.defaults || {})) {
    if (typeof v === 'string' && placeholderish.test(v)) fail(`defaults.${k} is placeholder copy`);
  }
}

/* ------------------------------------------------------------------ build */

export function buildTemplate(spec, fail = (m) => { throw new Error(`${spec.id}: ${m}`); }) {
  const recipe = RECIPES[spec.recipe];
  if (!recipe) throw new Error(`${spec.id}: unknown recipe "${spec.recipe}"`);

  const palette = { ...spec.palette };

  // A gradient ground, when the design asked for one. Barely perceptible or
  // not at all: a gradient behind gold hairlines reads as phone wallpaper.
  if (spec.gradient && palette.bg2) {
    spec = { ...spec, bgFill: spec.bgFill || {
      type: 'linear', from: [0, 0], to: [0, H],
      stops: [[0, '@bg'], [1, '@bg2']],
    } };
  }

  // A photograph is a dark scrim whatever the palette is, so the text sitting
  // on it takes the palette's light end rather than its background - which on
  // a dark design is the background, and would be invisible.
  if (spec.recipe === 'photoLed') {
    palette.onPhoto = isDark(palette.bg) ? palette.ink : palette.bg;
  }

  // The panel recipe lifts or drops the ground a few percent for the sheet.
  if (spec.recipe === 'panel') {
    palette.panel = isDark(palette.bg)
      ? mix(palette.bg, '#FFFFFF', 0.085)
      : mix(palette.bg, palette.ink, 0.075);
  }

  let { background, scenes } = recipe(spec);

  if (spec.foil) {
    palette.foil = foilToken(palette.accent, palette.accentDark);
    background = applyFoil(background);
    scenes = applyFoil(scenes);
  }

  const texture = textureLayer(spec.texture, palette.bg);
  if (texture) background = [...background, texture];

  const defaults = { ...BASE_DEFAULTS[spec.fieldset], ...(spec.defaults || {}) };

  const template = {
    _note: 'Generated by scripts/gen-templates.mjs from a compact spec. Safe to edit by hand; re-running the generator overwrites it.',
    id: spec.id,
    name: spec.name,
    tagline: spec.tagline,
    idea: spec.idea,
    hero: spec.hero || undefined,
    categories: spec.categories,
    fieldset: spec.fieldset,
    defaults,
    design: { width: W, height: H },
    palette,
    fonts: spec.fonts,
    photoSlots: [{ key: 'main', label: 'Photo', hint: 'A picture of the people this is about' }],
    transition: 0.5,
    background,
    scenes,
    contrast: {
      inkOnBg: Number(contrast(palette.ink, palette.bg).toFixed(2)),
      labelOnBg: Number(contrast(palette.accentDark, palette.bg).toFixed(2)),
    },
  };

  // The admission test, before any of the measurable ones: if the idea cannot
  // be said in a sentence there is no idea, only arrangement.
  if (!spec.idea || spec.idea.length < 20) {
    fail('has no "idea" - one sentence naming the single decision the design makes');
  }
  checkBuilt(spec, template, fail);

  return template;
}

async function main() {
  const ids = new Set();
  const written = new Set();
  const problems = [];
  const subjects = new Map();

  for (const spec of SPECS) {
    if (ids.has(spec.id)) throw new Error(`duplicate design id: ${spec.id}`);
    ids.add(spec.id);

    const fail = (m) => problems.push(`${spec.id}: ${m}`);
    let template;
    try {
      template = buildTemplate(spec, fail);
    } catch (err) {
      problems.push(`${spec.id}: ${err.message.replace(`${spec.id}: `, '')}`);
      continue;
    }

    // Two designs with the same sample names look like one design listed
    // twice, and the sample names are the first thing anybody sees.
    const d = spec.defaults || {};
    const subject = [d.name1, d.name2 || d.subtitle].filter(Boolean).join(' / ').toLowerCase();
    if (subjects.has(subject)) problems.push(`${spec.id}: shares its sample copy "${subject}" with ${subjects.get(subject)}`);
    subjects.set(subject, spec.id);

    const file = `${spec.id}.json`;
    await writeFile(join(OUT, file), JSON.stringify(template, null, 2) + '\n');
    written.add(file);
  }

  if (problems.length) {
    console.error(`${problems.length} design${problems.length === 1 ? '' : 's'} did not pass:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
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
  const byRecipe = {};
  for (const spec of SPECS) {
    for (const c of spec.categories) byCategory[c] = (byCategory[c] || 0) + 1;
    byRecipe[spec.recipe] = (byRecipe[spec.recipe] || 0) + 1;
  }

  console.log(`Wrote ${SPECS.length} designs${pruned ? `, pruned ${pruned}` : ''}.`);
  console.log('Recipes:  ', Object.entries(byRecipe).sort().map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('Category: ', Object.entries(byCategory).sort().map(([k, v]) => `${k} ${v}`).join(', '));
}

export { SPECS, RECIPES };

if (process.argv[1] && process.argv[1].endsWith('gen-templates.mjs')) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
