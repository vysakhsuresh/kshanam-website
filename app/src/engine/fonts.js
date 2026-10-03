/**
 * Font loading.
 *
 * Two rules, both learned the hard way:
 *
 *  1. A canvas does not wait for fonts the way the DOM does. It silently
 *     draws the fallback, so every face has to be loaded *before* a frame is
 *     drawn or the invite ships with the wrong typeface.
 *  2. The set is loaded per design, not all at once. Ten display families is
 *     almost a megabyte, and nobody on mobile data should pay for nine
 *     families their chosen design never uses.
 *
 * Works on the main thread and inside a worker, which keep their FontFaceSet
 * in different places.
 */
import manifest from '../font-manifest.json';
import { SCRIPT_FALLBACK } from './script-fonts.js';

/** Text that forces each script we support to be rasterised. */
const SAMPLES = ['Festa & Co 1234', 'വിവാഹ ക്ഷണം'];

/** The interface face. The stylesheet loads it too; this is for canvas use. */
export const UI_FAMILY = 'Space Grotesk';

export const ALL_FAMILIES = [...new Set(manifest.map((f) => f.family))];

/** Families that can render text a user types in a non-Latin script. */
export const SCRIPT_FAMILIES = SCRIPT_FALLBACK.filter(
  (f) => manifest.some((m) => m.family === f));

function fontFaceSet() {
  if (typeof document !== 'undefined' && document.fonts) return document.fonts;
  if (typeof self !== 'undefined' && self.fonts) return self.fonts;
  return null;
}

/** family -> promise, so the same family is never fetched twice. */
const inFlight = new Map();

function loadFamily(family, base) {
  if (inFlight.has(family)) return inFlight.get(family);

  const faces = manifest.filter((f) => f.family === family);
  const set = fontFaceSet();

  const promise = (async () => {
    if (!set || !faces.length) return;

    await Promise.all(faces.map(async (f) => {
      const face = new FontFace(family, `url(${base}${f.file}) format('woff2')`, {
        weight: f.weight,
        style: f.style,
        unicodeRange: f.unicodeRange,
      });
      await face.load();
      set.add(face);
    }));

    // Registering a face is not the same as it being ready for fillText.
    await Promise.all([400, 700].flatMap((weight) =>
      SAMPLES.map((sample) =>
        set.load(`${weight} 48px "${family}"`, sample).catch(() => {}))));

    // Deliberately no `await set.ready` here: inside a worker it never
    // resolves, because nothing drives a rendering loop to settle it, and the
    // export hangs forever at 0% with no error. See tests/diag-fonts.mjs.
  })();

  inFlight.set(family, promise);
  return promise;
}

function baseUrl(given) {
  const b = given || '/';
  return b.endsWith('/') ? b : b + '/';
}

/**
 * Load exactly the families named, plus the ones needed for typed scripts.
 *
 * @param {string[]} families
 * @param {string} [base] normally import.meta.env.BASE_URL
 */
export function ensureFonts(families, base) {
  const b = baseUrl(base);
  const wanted = [...new Set([...(families || []), ...SCRIPT_FAMILIES])]
    .filter((f) => ALL_FAMILIES.includes(f));
  return Promise.all(wanted.map((f) => loadFamily(f, b))).then(() => {});
}

/** Everything. Only worth it in tests and the diagnostics page. */
export function loadFonts(base) {
  return ensureFonts(ALL_FAMILIES, base);
}

/**
 * Did the fonts actually take?
 *
 * Measuring is the only honest check: FontFaceSet.check() reports true for a
 * face that is merely registered, and a canvas falls back silently to a
 * system font that may or may not have the glyphs.
 */
export function verifyFonts(ctx, families = ALL_FAMILIES) {
  return families.map((family) => {
    const sample = SCRIPT_FAMILIES.includes(family) ? SAMPLES[1] : SAMPLES[0];
    ctx.font = `400 48px "${family}"`;
    const withFont = ctx.measureText(sample).width;
    ctx.font = '400 48px "FestaNoSuchFamily"';
    const fallback = ctx.measureText(sample).width;
    return { family, withFont, fallback, applied: Math.abs(withFont - fallback) > 0.5 };
  });
}
