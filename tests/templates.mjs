/**
 * Checks every design against the template format.
 *
 * Designs are data, which is what makes them cheap to add — and also what
 * makes a mistyped colour token or a slot that no longer exists fail silently
 * at render time instead of at review time. This is the net under that.
 *
 *   node tests/templates.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { motifNames, frameNames, patternNames } from '../app/src/engine/ornaments.js';
import { presets, easings, motions } from '../app/src/engine/anim.js';
import { prepare, frameCount } from '../app/src/engine/render.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'app/src/templates');

const LAYER_TYPES = new Set(['rect', 'border', 'frame', 'pattern', 'line', 'motif', 'icon', 'text', 'photo']);

/**
 * The taste rules, checked on the committed JSON rather than only inside the
 * generator. A design can be edited by hand - that is a promise the README
 * makes - so the bar has to be enforced where the app actually reads it.
 */
const SCATTER = new Set(['confetti', 'dots', 'stars', 'rays']);
const PURE = new Set(['#FFFFFF', '#FFF', '#000000', '#000']);

const hex = (c) => {
  const h = String(c).replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const luminance = (c) => {
  const [r, g, b] = hex(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Ornament counted per scene: the template-level frame is structure. */
const marksIn = (scene) => (scene.layers || [])
  .filter((l) => l.type === 'motif' || l.type === 'icon' || l.type === 'line').length;

function checkTaste(file, t) {
  const palette = t.palette || {};
  for (const [key, value] of Object.entries(palette)) {
    if (typeof value === 'string' && PURE.has(value.toUpperCase())) {
      note(file, `palette.${key} is ${value}; no pure white and no pure black`);
    }
  }
  const grounds = [palette.bg, ...(palette.bg2 ? [palette.bg2] : [])].filter(Boolean);
  for (const bg of grounds) {
    for (const key of ['ink', 'muted', 'accentDark']) {
      if (!palette[key]) continue;
      const r = contrast(palette[key], bg);
      if (r < 4.5) note(file, `${key} ${palette[key]} on ${bg} is ${r.toFixed(2)}:1, needs 4.5:1`);
    }
  }

  if (!t.idea || t.idea.length < 20) {
    note(file, 'has no "idea": one sentence naming the decision the design makes');
  }
  if (!t.tagline) note(file, 'has no tagline for the gallery card');

  for (const { layer, where } of allLayers(t)) {
    if (layer.type === 'pattern' && SCATTER.has(layer.name)) {
      note(file, `${where}: pattern "${layer.name}" is scatter`);
    }
    if (layer.type === 'text') {
      if (layer.color === '@foil') note(file, `${where}: foil inside a letterform`);
      if (layer.size > 20 && layer.uppercase) note(file, `${where}: ${layer.size}px upper case`);
      if (layer.uppercase && !(layer.letterSpacing > 1)) note(file, `${where}: capitals with no tracking`);
    }
    if ((layer.type === 'motif' || layer.type === 'icon')) {
      if (layer.size > 72 || layer.size < 10) note(file, `${where}: motif at ${layer.size}px (10-72)`);
      if (layer.width > 1.6) note(file, `${where}: motif stroked at ${layer.width} (max 1.6)`);
    }
  }

  for (const scene of t.scenes || []) {
    const n = marksIn(scene);
    if (n > 2) note(file, `scene "${scene.id}" carries ${n} ornamental marks; pick two`);
    const sizes = new Set((scene.layers || []).filter((l) => l.type === 'text').map((l) => l.size));
    if (sizes.size > 3) note(file, `scene "${scene.id}" has ${sizes.size} type sizes; three is the ceiling`);
    const caps = (scene.layers || []).filter((l) => l.type === 'text' && l.uppercase).length;
    if (caps > 1) note(file, `scene "${scene.id}" has ${caps} upper-case lines; one is the ceiling`);
  }

  const closing = (t.defaults || {}).closing || '';
  if (/[.!]$/.test(closing)) note(file, `closing "${closing}" ends in a full stop or exclamation mark`);
}

/** Slots the app computes rather than the family typing them. */
const DERIVED = new Set(['dateLong', 'timeText']);

/** CLAUDE.md: videos are 30-60 seconds. */
const MIN_SECONDS = 25;
const MAX_SECONDS = 60;

const problems = [];
const note = (file, message) => problems.push(`${file}: ${message}`);

function allLayers(t) {
  const out = [];
  for (const l of t.background || []) out.push({ layer: l, where: 'background' });
  for (const scene of t.scenes || []) {
    for (const l of scene.background || []) out.push({ layer: l, where: `${scene.id} background` });
    for (const l of scene.layers || []) out.push({ layer: l, where: scene.id });
  }
  return out;
}

function checkColour(file, where, value, palette) {
  if (!value) return;
  if (typeof value === 'object') {
    for (const [, colour] of value.stops || []) checkColour(file, where, colour, palette);
    return;
  }
  if (typeof value !== 'string' || !value.startsWith('@')) return;
  if (!(value.slice(1) in palette)) note(file, `${where}: colour "${value}" is not in the palette`);
}

function slotsIn(value, into) {
  if (value == null) return;
  for (const m of String(value).matchAll(/\{\{(\w+)\}\}/g)) into.add(m[1]);
}

async function checkTemplate(file, fieldsets) {
  let t;
  try {
    t = JSON.parse(await readFile(join(DIR, file), 'utf8'));
  } catch (err) {
    note(file, `is not valid JSON: ${err.message}`);
    return null;
  }

  for (const key of ['id', 'name', 'categories', 'fieldset', 'palette', 'fonts', 'scenes']) {
    if (!(key in t)) note(file, `is missing "${key}"`);
  }
  if (!Array.isArray(t.scenes) || !t.scenes.length) {
    note(file, 'has no scenes');
    return t;
  }
  if (t.id !== file.replace(/\.json$/, '')) {
    note(file, `id "${t.id}" does not match the file name`);
  }
  if (!fieldsets[t.fieldset]) {
    note(file, `fieldset "${t.fieldset}" does not exist`);
    return t;
  }

  const palette = t.palette || {};
  const fonts = t.fonts || {};
  const fieldKeys = new Set(fieldsets[t.fieldset].map((f) => f.key));
  const photoSlots = new Set((t.photoSlots || []).map((p) => p.key));
  const used = new Set();

  const seen = new Set();
  for (const scene of t.scenes) {
    if (!scene.id) note(file, 'a scene has no id');
    if (seen.has(scene.id)) note(file, `two scenes share the id "${scene.id}"`);
    seen.add(scene.id);
    if (!(scene.duration > 0)) note(file, `scene "${scene.id}" has no duration`);
    if (!Array.isArray(scene.layers) || !scene.layers.length) {
      note(file, `scene "${scene.id}" has no layers`);
    }
    if (scene.requires && !photoSlots.has(scene.requires)) {
      note(file, `scene "${scene.id}" requires photo slot "${scene.requires}", which the design does not declare`);
    }
  }

  for (const { layer, where } of allLayers(t)) {
    if (!LAYER_TYPES.has(layer.type)) {
      note(file, `${where}: unknown layer type "${layer.type}"`);
      continue;
    }
    checkColour(file, where, layer.fill, palette);
    checkColour(file, where, layer.stroke, palette);
    checkColour(file, where, layer.color, palette);
    checkColour(file, where, layer.placeholderFill, palette);
    for (const c of layer.colours || []) checkColour(file, where, c, palette);

    if ((layer.type === 'motif' || layer.type === 'icon') && !motifNames.includes(layer.name)) {
      note(file, `${where}: motif "${layer.name}" does not exist`);
    }
    if (layer.type === 'frame' && layer.name && !frameNames.includes(layer.name)) {
      note(file, `${where}: frame "${layer.name}" does not exist`);
    }
    if (layer.type === 'pattern' && !patternNames.includes(layer.name)) {
      note(file, `${where}: pattern "${layer.name}" does not exist`);
    }
    if (layer.type === 'photo' && layer.slot && !photoSlots.has(layer.slot)) {
      note(file, `${where}: photo slot "${layer.slot}" is not declared`);
    }
    if (layer.type === 'text') {
      if (layer.font && !(layer.font in fonts)) {
        note(file, `${where}: font "${layer.font}" is not in the design's fonts`);
      }
      if (!(layer.size > 0)) note(file, `${where}: a text layer has no size`);
      slotsIn(layer.text, used);
    }
    if (layer.anim) {
      for (const phase of ['in', 'out']) {
        const a = layer.anim[phase];
        if (!a) continue;
        if (a.preset && !(a.preset in presets)) note(file, `${where}: animation preset "${a.preset}" does not exist`);
        if (a.ease && !(a.ease in easings)) note(file, `${where}: easing "${a.ease}" does not exist`);
      }
    }
    if (layer.motion) {
      const name = typeof layer.motion === 'string' ? layer.motion : layer.motion.preset;
      if (!(name in motions)) note(file, `${where}: motion "${name}" does not exist`);
    }
  }

  for (const slot of used) {
    if (!fieldKeys.has(slot) && !DERIVED.has(slot)) {
      note(file, `uses {{${slot}}}, which is neither a field of the "${t.fieldset}" fieldset nor derived`);
    }
  }

  // Defaults must cover every field, or the first preview shows gaps.
  for (const field of fieldsets[t.fieldset]) {
    const v = t.defaults ? t.defaults[field.key] : undefined;
    if (v == null || v === '') note(file, `has no default for "${field.key}"`);
  }

  checkTaste(file, t);

  // Lengths, with and without the optional photo scene, through the real
  // timeline builder rather than by adding numbers up here.
  const bare = prepare(t, { photos: [] });
  const withPhoto = prepare(t, { photos: [...photoSlots] });
  if (bare.duration < MIN_SECONDS) note(file, `is only ${bare.duration}s without a photo (want ${MIN_SECONDS}s+)`);
  if (withPhoto.duration > MAX_SECONDS) note(file, `is ${withPhoto.duration}s with a photo (want under ${MAX_SECONDS}s)`);

  return { t, bare, withPhoto, frames: frameCount(withPhoto) };
}

async function main() {
  const fieldsets = JSON.parse(await readFile(join(DIR, 'fieldsets.json'), 'utf8'));
  const files = (await readdir(DIR))
    .filter((f) => f.endsWith('.json') && f !== 'fieldsets.json')
    .sort();

  if (!files.length) {
    console.error('No designs found in app/src/templates/');
    process.exit(1);
  }

  console.log(`Checking ${files.length} designs`);
  const ids = new Set();
  const subjects = new Map();
  const byCategory = {};
  const fontsUsed = new Set();
  let shortest = Infinity;
  let longest = 0;

  for (const file of files) {
    const result = await checkTemplate(file, fieldsets);
    if (!result || !result.t) continue;
    const { t, bare, withPhoto } = result;
    if (ids.has(t.id)) note(file, `id "${t.id}" is used by another design`);
    ids.add(t.id);

    // Two designs showing the same sample names look like one design listed
    // twice, and the sample names are the first thing anybody sees.
    const d = t.defaults || {};
    const subject = [d.name1, d.name2 || d.subtitle].filter(Boolean).join(' / ').toLowerCase();
    if (subjects.has(subject)) note(file, `shares its sample copy "${subject}" with ${subjects.get(subject)}`);
    subjects.set(subject, file);

    for (const c of t.categories || []) byCategory[c] = (byCategory[c] || 0) + 1;
    for (const f of Object.values(t.fonts || {})) fontsUsed.add(f);
    shortest = Math.min(shortest, bare.duration);
    longest = Math.max(longest, withPhoto.duration);
  }

  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`);
    process.exit(1);
  }

  console.log(`\nAll ${files.length} designs are valid.`);
  console.log(`  length:     ${shortest}s without a photo .. ${longest}s with one`);
  console.log(`  typefaces:  ${[...fontsUsed].sort().join(', ')}`);
  console.log('  categories: ' +
    Object.entries(byCategory).sort().map(([k, v]) => `${k} (${v})`).join(', '));
}

main().catch((err) => { console.error(err); process.exit(1); });
