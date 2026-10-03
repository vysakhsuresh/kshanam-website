/**
 * Checks every design against the template format.
 *
 * Designs are data, which is what makes them cheap to add - and also what
 * makes a typo in a colour name or a slot that no longer exists fail silently
 * at render time instead of at review time. This is the net under that.
 *
 *   node tests/templates.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { iconNames } from '../app/src/engine/icons.js';
import { presets, easings } from '../app/src/engine/anim.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'app/src/templates');

const LAYER_TYPES = new Set(['rect', 'border', 'line', 'icon', 'text', 'photo']);
const LANGS = new Set(['en', 'ml', 'both']);

/** Slots the app always supplies, whether or not a design declares them. */
const GLOBAL_SLOTS = new Set(['domain']);

/** CLAUDE.md: videos are 30-60 seconds. */
const MIN_SECONDS = 25;
const MAX_SECONDS = 60;

const problems = [];
const note = (file, message) => problems.push(`${file}: ${message}`);

function collectLayers(template) {
  const out = [];
  for (const l of template.background || []) out.push({ layer: l, where: 'background' });
  for (const scene of template.scenes || []) {
    for (const l of scene.background || []) out.push({ layer: l, where: `${scene.id} background` });
    for (const l of scene.layers || []) out.push({ layer: l, where: scene.id });
  }
  for (const l of (template.endCard && template.endCard.layers) || []) {
    out.push({ layer: l, where: 'endCard' });
  }
  return out;
}

function checkColour(file, where, value, palette) {
  if (!value) return;
  if (typeof value === 'object') {
    for (const [, colour] of value.stops || []) checkColour(file, where, colour, palette);
    return;
  }
  if (!value.startsWith('@')) return;
  if (!(value.slice(1) in palette)) {
    note(file, `${where}: colour "${value}" is not in the palette`);
  }
}

function slotsUsed(value, into) {
  if (value == null) return;
  if (typeof value === 'object') {
    for (const v of Object.values(value)) slotsUsed(v, into);
    return;
  }
  for (const m of String(value).matchAll(/\{\{(\w+)\}\}/g)) into.add(m[1]);
}

/** Would this layer be drawn for the given invite language? */
function visibleIn(layer, lang) {
  if (layer.modes) return layer.modes.includes(lang);
  if (!layer.lang) return true;
  if (lang === 'both') return true;
  return layer.lang === lang;
}

async function checkTemplate(file) {
  const raw = await readFile(join(DIR, file), 'utf8');
  let template;
  try {
    template = JSON.parse(raw);
  } catch (err) {
    note(file, `is not valid JSON: ${err.message}`);
    return null;
  }

  for (const key of ['id', 'name', 'occasions', 'languages', 'palette', 'fonts', 'slots', 'scenes']) {
    if (!(key in template)) note(file, `is missing "${key}"`);
  }
  if (!template.scenes || !template.scenes.length) {
    note(file, 'has no scenes');
    return template;
  }

  if (template.id !== file.replace(/\.json$/, '')) {
    note(file, `id "${template.id}" does not match the file name`);
  }

  for (const lang of template.languages || []) {
    if (!LANGS.has(lang)) note(file, `unknown language "${lang}"`);
  }
  if (template.defaultLanguage && !(template.languages || []).includes(template.defaultLanguage)) {
    note(file, `defaultLanguage "${template.defaultLanguage}" is not in languages`);
  }

  const palette = template.palette || {};
  const fonts = template.fonts || {};
  const declaredSlots = new Set([...Object.keys(template.slots || {}), ...GLOBAL_SLOTS]);
  const usedSlots = new Set();

  const seenSceneIds = new Set();
  for (const scene of template.scenes) {
    if (!scene.id) note(file, 'a scene has no id');
    if (seenSceneIds.has(scene.id)) note(file, `two scenes share the id "${scene.id}"`);
    seenSceneIds.add(scene.id);
    if (!(scene.duration > 0)) note(file, `scene "${scene.id}" has no duration`);
    if (!Array.isArray(scene.layers) || !scene.layers.length) {
      note(file, `scene "${scene.id}" has no layers`);
    }
    if (scene.requires && scene.requires !== 'photo') {
      note(file, `scene "${scene.id}" requires "${scene.requires}", which the engine does not know`);
    }
  }

  for (const { layer, where } of collectLayers(template)) {
    if (!LAYER_TYPES.has(layer.type)) {
      note(file, `${where}: unknown layer type "${layer.type}"`);
      continue;
    }
    checkColour(file, where, layer.fill, palette);
    checkColour(file, where, layer.stroke, palette);
    checkColour(file, where, layer.color, palette);

    if (layer.type === 'icon' && !iconNames.includes(layer.name)) {
      note(file, `${where}: icon "${layer.name}" does not exist`);
    }
    if (layer.type === 'text') {
      if (layer.font && !(layer.font in fonts)) {
        note(file, `${where}: font "${layer.font}" is not in the template's fonts`);
      }
      if (!(layer.size > 0)) note(file, `${where}: a text layer has no size`);
      slotsUsed(layer.text, usedSlots);
    }
    if (layer.modes) {
      for (const m of layer.modes) {
        if (!LANGS.has(m)) note(file, `${where}: unknown mode "${m}"`);
      }
    }
    if (layer.lang && !['en', 'ml'].includes(layer.lang)) {
      note(file, `${where}: lang must be "en" or "ml", got "${layer.lang}"`);
    }
    if (layer.anim) {
      for (const phase of ['in', 'out']) {
        const a = layer.anim[phase];
        if (!a) continue;
        if (a.preset && !(a.preset in presets)) {
          note(file, `${where}: animation preset "${a.preset}" does not exist`);
        }
        if (a.ease && !(a.ease in easings)) {
          note(file, `${where}: easing "${a.ease}" does not exist`);
        }
      }
    }
  }

  for (const slot of usedSlots) {
    if (!declaredSlots.has(slot)) {
      note(file, `uses {{${slot}}} but does not declare it in "slots"`);
    }
  }

  // Every invite language the design claims to support must actually draw
  // something in every scene; a scene that is blank in English only shows up
  // when somebody renders it.
  for (const lang of template.languages || []) {
    for (const scene of template.scenes) {
      const visible = (scene.layers || []).filter((l) => visibleIn(l, lang));
      if (!visible.length) {
        note(file, `scene "${scene.id}" draws nothing when the invite language is "${lang}"`);
      }
    }
  }

  const withPhoto = template.scenes.reduce((n, s) => n + (s.duration || 0), 0);
  const withoutPhoto = template.scenes
    .filter((s) => s.requires !== 'photo')
    .reduce((n, s) => n + (s.duration || 0), 0);
  const endCard = template.endCard ? template.endCard.duration : 2;

  if (withoutPhoto + endCard < MIN_SECONDS) {
    note(file, `is only ${withoutPhoto + endCard}s long without a photo (want at least ${MIN_SECONDS}s)`);
  }
  if (withPhoto + endCard > MAX_SECONDS) {
    note(file, `is ${withPhoto + endCard}s long with a photo (want at most ${MAX_SECONDS}s)`);
  }

  console.log(`  ${file.padEnd(24)} ${template.scenes.length} scenes, ` +
    `${withoutPhoto + endCard}-${withPhoto + endCard}s, ` +
    `languages: ${(template.languages || []).join('/')}`);

  return template;
}

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    console.error('No templates found in app/src/templates/');
    process.exit(1);
  }

  console.log(`Checking ${files.length} design${files.length === 1 ? '' : 's'}`);
  const ids = new Set();
  for (const file of files) {
    const template = await checkTemplate(file);
    if (template && template.id) {
      if (ids.has(template.id)) note(file, `id "${template.id}" is used by another design`);
      ids.add(template.id);
    }
  }

  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nEvery design is valid.');
}

main().catch((err) => { console.error(err); process.exit(1); });
