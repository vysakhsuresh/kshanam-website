/**
 * The design catalogue.
 *
 * Every *.json in this folder that has scenes is a design. Nothing has to be
 * registered by hand, so adding one really is adding a file — which is the
 * whole promise of the template format.
 */
import FIELDSETS from './fieldsets.json';
import { CATEGORIES } from './categories.js';

const modules = import.meta.glob('./*.json', { eager: true });

export const TEMPLATES = Object.entries(modules)
  .map(([, mod]) => mod.default || mod)
  .filter((t) => t && Array.isArray(t.scenes) && t.id)
  .sort((a, b) => a.name.localeCompare(b.name));

export const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;

/**
 * The two designs the home page plays at the top.
 *
 * A design marks itself with `hero: true` rather than the page naming ids:
 * the library is replaced wholesale from time to time, and a hard-coded id
 * means the hero quietly goes blank the day that design is cut. The fallback
 * picks one light and one dark so the pair always contrast.
 */
export function heroPicks(count = 2) {
  const marked = TEMPLATES.filter((t) => t.hero);
  const picked = marked.slice(0, count);
  // Fall back by alternating light and dark grounds, so whatever is left in
  // the library the pair still read as two different ideas.
  const rest = TEMPLATES.filter((t) => !picked.includes(t));
  const dark = rest.filter((t) => isDarkHex(t.palette && t.palette.bg));
  const light = rest.filter((t) => !isDarkHex(t.palette && t.palette.bg));
  const queues = [light, dark];
  for (let i = 0; picked.length < count && (light.length || dark.length); i++) {
    const next = (queues[i % 2].shift() || queues[(i + 1) % 2].shift());
    if (!next) break;
    picked.push(next);
  }
  return picked;
}

export const forCategory = (category) =>
  (!category || category === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => (t.categories || []).includes(category)));

/** Categories that actually have designs, in the order they are declared. */
export const usedCategories = () =>
  CATEGORIES.filter((c) => forCategory(c.id).length > 0);

/**
 * The editable fields for a design: its fieldset, with its own defaults
 * merged in. The editor renders this; it knows nothing about any one design.
 */
export function fieldsFor(template) {
  const set = FIELDSETS[template.fieldset] || FIELDSETS.couple;
  return set.map((field) => ({
    ...field,
    default: template.defaults && template.defaults[field.key] != null
      ? template.defaults[field.key]
      : field.default,
  }));
}

/** Starting values for a design, for previews and for a fresh editor. */
export function defaultValuesFor(template) {
  const out = {};
  for (const field of fieldsFor(template)) out[field.key] = field.default != null ? field.default : '';
  return out;
}

export { CATEGORIES };
