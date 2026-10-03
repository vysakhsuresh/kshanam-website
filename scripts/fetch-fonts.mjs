/**
 * Downloads the web fonts and self-hosts them.
 *
 * The brief requires free-licensed, self-hosted fonts: we cannot depend on
 * Google's CDN at render time, because the canvas must have the real font
 * loaded before a single frame is drawn, and because a family that silently
 * falls back turns Malayalam into boxes.
 *
 * Writes:
 *   app/public/fonts/*.woff2      the font files
 *   app/src/ui/fonts.css          @font-face rules, bundled with the app
 *   app/src/font-manifest.json    the same data for the renderer, which
 *                                 registers FontFace objects by hand because
 *                                 a worker has no stylesheet
 *   app/public/fonts/OFL-*.txt    the licence that came with each family
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = resolve(ROOT, 'app/public/fonts');
// The stylesheet lives in the bundle and points at the public files by their
// served path, so Vite never has to resolve anything inside publicDir.
const CSS_OUT = resolve(ROOT, 'app/src/ui/fonts.css');

// A modern UA, or the API answers with .ttf instead of .woff2.
const UA = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

// Only the subsets this site can actually show. Dropping cyrillic/greek/
// devanagari keeps the download small on mobile data.
const KEEP_SUBSETS = new Set(['latin', 'latin-ext', 'malayalam']);

const FAMILIES = [
  // The interface. Space Grotesk, the same face layerbit uses.
  { family: 'Space Grotesk', spec: 'Space+Grotesk:wght@400;500;600;700', slug: 'space-grotesk', ofl: 'spacegrotesk', role: 'ui' },

  // Display faces the designs draw with. Each one is a different voice, so a
  // birthday card and a formal wedding do not have to look like the same card
  // in different colours.
  { family: 'Cormorant Garamond', spec: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400', slug: 'cormorant-garamond', ofl: 'cormorantgaramond', role: 'display' },
  { family: 'Playfair Display', spec: 'Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400', slug: 'playfair-display', ofl: 'playfairdisplay', role: 'display' },
  { family: 'Marcellus', spec: 'Marcellus', slug: 'marcellus', ofl: 'marcellus', role: 'display' },
  { family: 'Italiana', spec: 'Italiana', slug: 'italiana', ofl: 'italiana', role: 'display' },
  { family: 'Cinzel', spec: 'Cinzel:wght@400;500;600', slug: 'cinzel', ofl: 'cinzel', role: 'display' },
  { family: 'Great Vibes', spec: 'Great+Vibes', slug: 'great-vibes', ofl: 'greatvibes', role: 'display' },
  { family: 'Outfit', spec: 'Outfit:wght@300;400;500;600;700', slug: 'outfit', ofl: 'outfit', role: 'display' },
  { family: 'Fraunces', spec: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400', slug: 'fraunces', ofl: 'fraunces', role: 'display' },

  // Malayalam, for text a family types themselves. The site is in English;
  // what goes on the invite is whatever the user writes.
  { family: 'Anek Malayalam', spec: 'Anek+Malayalam:wght@400;500;600;700', slug: 'anek-malayalam', ofl: 'anekmalayalam', role: 'script' },
  { family: 'Manjari', spec: 'Manjari:wght@400;700', slug: 'manjari', ofl: 'manjari', role: 'script' },
];

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

/** Pull the subset comment + descriptors out of each @font-face block. */
function parseCss(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const [, subset, body] = m;
    const pick = (name) => (body.match(new RegExp(name + ':\\s*([^;]+);')) || [])[1]?.trim();
    const url = (body.match(/url\(([^)]+)\)/) || [])[1];
    if (!url) continue;
    faces.push({
      subset,
      family: (pick('font-family') || '').replace(/['"]/g, ''),
      weight: pick('font-weight') || '400',
      style: pick('font-style') || 'normal',
      unicodeRange: pick('unicode-range') || '',
      url,
    });
  }
  return faces;
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });

  // Pass 1: collect every face, grouped by file URL. A variable family serves
  // all its weights from one URL; a static one like Manjari serves a separate
  // file per weight, which is why the file name cannot be decided until we
  // know how many URLs a (family, subset) pair actually has.
  /** @type {Map<string, {slug: string, subset: string, face: object, weights: Set<string>}>} */
  const byUrl = new Map();
  for (const fam of FAMILIES) {
    const css = await get(
      `https://fonts.googleapis.com/css2?family=${fam.spec}&display=swap`);
    for (const face of parseCss(css)) {
      if (!KEEP_SUBSETS.has(face.subset)) continue;
      const existing = byUrl.get(face.url);
      if (existing) {
        existing.weights.add(face.weight);
        continue;
      }
      byUrl.set(face.url, {
        slug: fam.slug, subset: face.subset, face, role: fam.role,
        weights: new Set([face.weight]),
      });
    }
  }

  // Pass 2: name the files, disambiguating by weight only where a
  // (family, subset) pair really has more than one file.
  const perPair = new Map();
  for (const entry of byUrl.values()) {
    const key = `${entry.slug}-${entry.subset}-${entry.face.style}`;
    perPair.set(key, (perPair.get(key) || 0) + 1);
  }
  for (const entry of byUrl.values()) {
    // Must match the key used to count above, style included, or a family
    // with two weights in one subset silently writes both to one file.
    const key = `${entry.slug}-${entry.subset}-${entry.face.style}`;
    const weights = [...entry.weights].map(Number).sort((a, b) => a - b);
    entry.weights = weights;
    entry.weightDescriptor = weights.length > 1
      ? `${weights[0]} ${weights[weights.length - 1]}`
      : String(weights[0]);
    const stem = `${entry.slug}-${entry.subset}`;
    const italic = entry.face.style === 'italic' ? '-italic' : '';
    entry.file = perPair.get(key) > 1
      ? `${stem}${italic}-${weights[0]}.woff2`
      : `${stem}${italic}.woff2`;
  }

  const manifest = [];
  const written = new Set();
  const cssOut = [
    '/* Generated by scripts/fetch-fonts.mjs. Do not edit by hand. */',
    '/* Licences: see OFL-*.txt beside this file. */',
    '',
  ];

  for (const [url, entry] of byUrl) {
    const bytes = await get(url, 'buffer');
    await writeFile(resolve(FONT_DIR, entry.file), bytes);
    written.add(entry.file);

    const { family, style, unicodeRange, subset } = entry.face;
    // Only the interface font goes in the global stylesheet. The display
    // faces are fetched by the renderer when a design actually asks for one,
    // so opening the site on mobile data does not pull down ten families.
    if (entry.role === 'ui') {
      cssOut.push(
        '@font-face {',
        `  font-family: '${family}';`,
        `  font-style: ${style};`,
        `  font-weight: ${entry.weightDescriptor};`,
        '  font-display: swap;',
        `  src: url('/fonts/${entry.file}') format('woff2');`,
        `  unicode-range: ${unicodeRange};`,
        '}',
        '');
    }

    manifest.push({
      family, style, weight: entry.weightDescriptor, subset, unicodeRange,
      role: entry.role, file: `fonts/${entry.file}`, bytes: bytes.length,
    });
    console.log(`  ${entry.file.padEnd(34)} ${String(bytes.length).padStart(7)} bytes  (${family} ${entry.weightDescriptor})`);
  }

  await writeFile(CSS_OUT, cssOut.join('\n'));
  await writeFile(resolve(ROOT, 'app/src/font-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n');

  for (const fam of FAMILIES) {
    try {
      const txt = await get(
        `https://raw.githubusercontent.com/google/fonts/main/ofl/${fam.ofl}/OFL.txt`);
      await writeFile(resolve(FONT_DIR, `OFL-${fam.slug}.txt`), txt);
    } catch (err) {
      console.warn(`  ! could not fetch the licence for ${fam.family}: ${err.message}`);
      console.warn(`    Add ofl/${fam.ofl}/OFL.txt from github.com/google/fonts by hand.`);
    }
  }

  // A .woff2 in here that this run did not write is left over from an earlier
  // naming scheme; nothing references it and it would ship as dead weight.
  // fonts.css used to be written here too, before it moved into the bundle.
  let pruned = 0;
  for (const name of await readdir(FONT_DIR)) {
    const stale = name === 'fonts.css' || (name.endsWith('.woff2') && !written.has(name));
    if (stale) {
      await rm(resolve(FONT_DIR, name));
      pruned++;
    }
  }

  const total = manifest.reduce((n, f) => n + f.bytes, 0);
  console.log(`\n${manifest.length} font files, ${(total / 1024).toFixed(0)} KB in total` +
    (pruned ? `, ${pruned} stale file(s) removed.` : '.'));
}

main().catch((err) => { console.error(err); process.exit(1); });
