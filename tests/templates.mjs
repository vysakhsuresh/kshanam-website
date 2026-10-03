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
