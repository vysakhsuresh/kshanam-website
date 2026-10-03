/**
 * Loads the self-hosted fonts and waits for them.
 *
 * CLAUDE.md is explicit about this: Malayalam must render correctly on the
 * canvas, so every face has to be *loaded* before a frame is drawn. A canvas
 * does not wait for fonts the way the DOM does - it silently draws the
 * fallback, and you get boxes where the Malayalam should be.
 *
 * Works unchanged on the main thread and inside a worker, but the set lives
 * in a different place in each: a worker has `self.fonts`, a page has
 * `document.fonts` and no `self.fonts` at all. Reading only `self.fonts` makes
 * this function quietly do nothing on the main thread, the canvas then draws
 * with whatever the system happens to have, and the Malayalam looks fine on a
 * machine with a Malayalam system font and turns into boxes on one without.
 */
import manifest from '../font-manifest.json';

/** Sample text that forces each script we care about to be rasterised. */
const SAMPLES = {
  latin: 'Anjali & Rahul 14',
  malayalam: 'വിവാഹ ക്ഷണം',
};

let loaded = null;

/** The FontFaceSet for this context: `document.fonts` in a page, `self.fonts` in a worker. */
function fontFaceSet() {
  if (typeof document !== 'undefined' && document.fonts) return document.fonts;
  if (typeof self !== 'undefined' && self.fonts) return self.fonts;
  return null;
}

/**
 * @param {string} baseUrl  where /fonts lives, normally import.meta.env.BASE_URL
 * @returns {Promise<void>} resolves once every face is usable for drawing
 */
export function loadFonts(baseUrl = '/') {
  if (loaded) return loaded;

  loaded = (async () => {
    const set = fontFaceSet();
    if (!set) return; // no FontFaceSet: nothing we can do but draw fallbacks

    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    await Promise.all(manifest.map(async (f) => {
      const face = new FontFace(f.family, `url(${base}${f.file}) format('woff2')`, {
        weight: f.weight,
        style: f.style,
        unicodeRange: f.unicodeRange,
      });
      await face.load();
      set.add(face);
    }));

    // Adding a face is not the same as having it ready for fillText, so ask
    // for each family at a real size with text in the script it covers.
    const families = [...new Set(manifest.map((f) => f.family))];
    await Promise.all(families.flatMap((family) =>
      [400, 700].flatMap((weight) =>
        Object.values(SAMPLES).map((sample) =>
          set.load(`${weight} 48px "${family}"`, sample).catch(() => {})))));

    // Deliberately NOT awaiting set.ready: inside a worker it never resolves,
    // because there is no rendering loop to settle it, and the render hangs
    // forever at 0% with no error. It adds nothing anyway - every face has
    // been awaited through face.load() and set.load() above, which is what
    // actually matters before drawing. (tests/diag-fonts.mjs demonstrates it.)
  })();

  return loaded;
}

/** Families the renderer expects, for the diagnostics screen. */
export const fontFamilies = [...new Set(manifest.map((f) => f.family))];

/**
 * Did the fonts actually take?
 *
 * Measuring is the only honest check: FontFaceSet.check() can report true for
 * a face that is merely registered, and a canvas silently falls back to a
 * system font that may or may not have Malayalam glyphs.
 */
export function verifyFonts(ctx) {
  const probe = (family, text) => {
    ctx.font = `400 48px "${family}"`;
    const withFont = ctx.measureText(text).width;
    ctx.font = '400 48px "KshanamNoSuchFamily"';
    const fallback = ctx.measureText(text).width;
    return { family, withFont, fallback, applied: Math.abs(withFont - fallback) > 0.5 };
  };
  return [
    probe('Anek Malayalam', 'Anjali & Rahul'),
    probe('Marcellus', 'Anjali & Rahul'),
    probe('Manjari', 'വിവാഹ ക്ഷണം'),
  ];
}
